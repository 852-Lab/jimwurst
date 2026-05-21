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
                    if self._fetch_and_store_page(page.get("id")):
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

    def _fetch_and_store_page(self, page_id: str) -> bool:
        """
        Fetches a Notion page and stores it as a KnowledgePage in the database.
        """
        try:
            # 1. Fetch Page Metadata
            page = self.client.pages.retrieve(page_id=page_id)
            
            title = self._extract_title(page.get("properties", {}))
            icon = page.get("icon")
            cover = page.get("cover")
            properties = page.get("properties", {})
            
            # 2. Fetch Page Content (Blocks)
            blocks = self._fetch_all_blocks(page_id)
            
            # 3. Create or Update KnowledgePage
            # We use source='notion' and source_id=page_id to track synced pages
            db_page = self.db.query(models.KnowledgePage).filter(
                models.KnowledgePage.source == "notion",
                models.KnowledgePage.source_id == page_id
            ).first()
            
            if db_page:
                db_page.title = title
                db_page.icon = icon
                db_page.cover = cover
                db_page.properties = properties
                db_page.content = blocks
                db_page.updated_by = self.user_id
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
