import logging
from typing import List
from uuid import UUID
from sqlalchemy.orm import Session
from notion_client import Client
from ravioli.backend.core import models

logger = logging.getLogger(__name__)

SUPPORTED_BLOCK_TYPES = {
    "paragraph",
    "heading_1",
    "heading_2",
    "heading_3",
    "bulleted_list_item",
    "numbered_list_item",
    "quote",
    "code",
    "callout",
    "divider",
    "to_do",
    "toggle"
}

class NotionSyncService:
    def __init__(self, token: str, db: Session, user_id: UUID):
        self.client = Client(auth=token)
        self.db = db
        self.user_id = user_id
    
    def sync_pages_by_ids(self, page_ids: List[str]) -> int:
        """
        Sync specific Notion pages by ID.
        Returns the number of pages successfully synced.
        """
        count = 0
        for pid in page_ids:
            if self._fetch_and_store_page(pid):
                count += 1
        return count

    def sync_all_accessible_pages(self) -> int:
        """
        Search for all pages the integration has access to and sync them.
        """
        count = 0
        has_more = True
        next_cursor = None
        
        while has_more:
            try:
                response = self.client.search(
                    filter={"value": "page", "property": "object"},
                    start_cursor=next_cursor,
                    page_size=100
                )
                for page in response.get("results", []):
                    if self._fetch_and_store_page(page.get("id"), page):
                        count += 1
                
                has_more = response.get("has_more", False)
                next_cursor = response.get("next_cursor")
            except Exception as e:
                logger.error(f"Error searching Notion pages: {e}")
                break
                
        return count

    def _extract_title(self, properties: dict) -> str:
        for prop_name, prop_data in properties.items():
            if prop_data.get("type") == "title":
                title_arr = prop_data.get("title", [])
                if title_arr:
                    return "".join(t.get("plain_text", "") for t in title_arr)
        return "Untitled"

    def _fetch_all_blocks(self, block_id: str) -> List[dict]:
        """
        Fetch all child blocks of a given block (or page).
        Recursively fetches if necessary, though for simplicity we primarily grab the top level text blocks.
        """
        blocks = []
        has_more = True
        next_cursor = None
        
        while has_more:
            try:
                response = self.client.blocks.children.list(
                    block_id=block_id,
                    start_cursor=next_cursor,
                    page_size=100
                )
                for block in response.get("results", []):
                    b_type = block.get("type")
                    if b_type in SUPPORTED_BLOCK_TYPES:
                        blocks.append(block)
                has_more = response.get("has_more", False)
                next_cursor = response.get("next_cursor")
            except Exception as e:
                logger.error(f"Error fetching blocks for {block_id}: {e}")
                break
        return blocks

    def _fetch_and_store_page(self, page_id: str, page_metadata: dict = None) -> bool:
        """
        Fetches a Notion page and stores it as a KnowledgePage in the database.
        Skips fetching blocks if the page hasn't been edited since the last sync.
        """
        try:
            # 1. Fetch Page Metadata if not provided
            page = page_metadata or self.client.pages.retrieve(page_id=page_id)
            
            notion_edited_time = page.get("last_edited_time")
            
            # Check if it exists and is up to date
            db_page = self.db.query(models.KnowledgePage).filter(
                models.KnowledgePage.source == "notion",
                models.KnowledgePage.source_id == page_id
            ).first()
            
            if db_page and db_page.properties.get("_notion_last_edited_time") == notion_edited_time:
                # Already up to date, skip ingestion
                return False
            
            title = self._extract_title(page.get("properties", {}))
            if len(title) > 255:
                title = title[:252] + "..."
                
            icon = page.get("icon")
            cover = page.get("cover")
            properties = page.get("properties", {})
            
            # Store the Notion timestamp so we know next time
            properties["_notion_last_edited_time"] = notion_edited_time
            
            # 2. Fetch Page Content (Blocks)
            blocks = self._fetch_all_blocks(page_id)
            
            # 3. Create or Update KnowledgePage
            if db_page:
                db_page.title = title
                db_page.icon = icon
                db_page.cover = cover
                db_page.properties = properties
                db_page.content = blocks
                db_page.updated_by = self.user_id
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(db_page, "properties")
            else:
                db_page = models.KnowledgePage(
                    title=title,
                    icon=icon,
                    cover=cover,
                    properties=properties,
                    content=blocks,
                    source="notion",
                    source_id=page_id,
                    owner=self.user_id,
                    owner_type="user",
                    owner_id=str(self.user_id),
                    created_by=self.user_id,
                    updated_by=self.user_id
                )
                self.db.add(db_page)
                
            self.db.commit()
            return True
            
        except Exception as e:
            logger.error(f"Error processing Notion page {page_id}: {e}")
            self.db.rollback()
            return False

    def push_all_pages(self) -> int:
        """
        Pushes all KnowledgePages back to Notion. 
        Updates existing ones and creates new ones for locally authored pages.
        """
        # Exclude pages from other integrations if they exist (e.g. confluence, motherduck)
        # We only push 'Ravioli' or 'manual' pages
        pages = self.db.query(models.KnowledgePage).filter(
            models.KnowledgePage.source.in_(["Ravioli", "manual", None])
        ).all()
        
        count = 0
        for page in pages:
            if self._push_page(page):
                count += 1
        return count

    def push_pages_by_ids(self, page_ids: list[str]) -> int:
        """
        Pushes specific KnowledgePages back to Notion.
        """
        pages = self.db.query(models.KnowledgePage).filter(
            models.KnowledgePage.id.in_(page_ids),
            models.KnowledgePage.source.in_(["Ravioli", "manual", None])
        ).all()
        
        count = 0
        for page in pages:
            if self._push_page(page):
                count += 1
        return count

    def _sanitize_blocks_for_push(self, blocks: list) -> list:
        """Removes read-only attributes and null values from Notion blocks recursively"""
        sanitized = []
        read_only_fields = {"id", "parent", "created_time", "last_edited_time", "created_by", "last_edited_by", "has_children"}
        
        def clean_dict(d: dict) -> dict:
            cleaned = {}
            for k, v in d.items():
                if k in read_only_fields or v is None:
                    continue
                if isinstance(v, dict):
                    cleaned[k] = clean_dict(v)
                elif isinstance(v, list):
                    new_list = []
                    for item in v:
                        if isinstance(item, dict):
                            new_list.append(clean_dict(item))
                        else:
                            new_list.append(item)
                    cleaned[k] = new_list
                else:
                    cleaned[k] = v
            return cleaned

        for b in blocks:
            if not isinstance(b, dict):
                continue
            sanitized.append(clean_dict(b))
            
        return sanitized

    def _push_page(self, db_page: models.KnowledgePage) -> bool:
        """
        Overwrites a Notion page with the contents of a local KnowledgePage, or creates it if new.
        """
        try:
            page_id = db_page.source_id
            
            # Create the page if it doesn't exist in Notion yet
            if not page_id:
                # Find an accessible parent page
                search_res = self.client.search(filter={"property": "object", "value": "page"})
                if not search_res.get("results"):
                    logger.error("Cannot push new page: Notion integration has no access to any parent pages.")
                    return False
                    
                parent_id = search_res["results"][0]["id"]
                
                new_page = self.client.pages.create(
                    parent={"type": "page_id", "page_id": parent_id},
                    properties={
                        "title": {
                            "title": [{"text": {"content": db_page.title or "Untitled Knowledge Page"}}]
                        }
                    }
                )
                page_id = new_page["id"]
                
                # Update source to explicitly be Ravioli
                db_page.source = "Ravioli"
                db_page.source_id = page_id
                self.db.commit()
            
            # 1. Update Title and Properties
            update_kwargs = {}
            if db_page.properties:
                update_kwargs["properties"] = {
                    "title": {
                        "title": [{"text": {"content": db_page.title}}]
                    }
                }
            if db_page.icon:
                update_kwargs["icon"] = db_page.icon
            if db_page.cover:
                update_kwargs["cover"] = db_page.cover
                
            if update_kwargs:
                self.client.pages.update(page_id=page_id, **update_kwargs)
            
            # 2. Overwrite blocks
            # Notion doesn't have an overwrite endpoint, so we must delete existing blocks then append
            existing_blocks = self._fetch_all_blocks(page_id)
            for block in existing_blocks:
                try:
                    self.client.blocks.delete(block_id=block["id"])
                except Exception as e:
                    logger.warning(f"Failed to delete block {block['id']} during push: {e}")
            
            # Append new blocks
            if db_page.content:
                sanitized_blocks = self._sanitize_blocks_for_push(db_page.content)
                # Notion allows max 100 blocks per append request
                for i in range(0, len(sanitized_blocks), 100):
                    chunk = sanitized_blocks[i:i + 100]
                    self.client.blocks.children.append(block_id=page_id, children=chunk)
                    
            # Update local tracking
            page_meta = self.client.pages.retrieve(page_id=page_id)
            if not db_page.properties:
                db_page.properties = {}
            db_page.properties["_notion_last_edited_time"] = page_meta.get("last_edited_time")
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(db_page, "properties")
            self.db.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"Error pushing Notion page {db_page.id}: {e}")
            self.db.rollback()
            return False
