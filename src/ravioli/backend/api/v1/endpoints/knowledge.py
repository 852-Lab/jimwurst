from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from uuid import UUID

from ravioli.backend.core import models, schemas
from ravioli.backend.core.database import get_db
from ravioli.backend.api.v1.endpoints.data import get_current_user
from ravioli.backend.core.notion import NotionSyncService
from ravioli.backend.core.encryption import decrypt_value

router = APIRouter()

@router.get("/", response_model=List[schemas.KnowledgePage])
def list_knowledge_pages(db: Session = Depends(get_db)):
    """List all knowledge pages."""
    return db.query(models.KnowledgePage).options(
        joinedload(models.KnowledgePage.owner_user),
        joinedload(models.KnowledgePage.owner_group),
        joinedload(models.KnowledgePage.creator_user),
        joinedload(models.KnowledgePage.reviewer_user)
    ).order_by(models.KnowledgePage.updated_at.desc()).all()

@router.post("/", response_model=schemas.KnowledgePage, status_code=status.HTTP_201_CREATED)
def create_knowledge_page(
    page: schemas.KnowledgePageCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new knowledge page."""
    db_page = models.KnowledgePage(
        **page.model_dump(exclude={"owner"}),
        owner=page.owner or current_user.id,
        created_by=current_user.id,
        updated_by=current_user.id,
        reviewed_by=current_user.id if current_user.role == "Admin" else None
    )
    db.add(db_page)
    db.commit()
    db.refresh(db_page)
    
    return db.query(models.KnowledgePage).options(
        joinedload(models.KnowledgePage.owner_user),
        joinedload(models.KnowledgePage.owner_group),
        joinedload(models.KnowledgePage.creator_user),
        joinedload(models.KnowledgePage.reviewer_user)
    ).filter(models.KnowledgePage.id == db_page.id).first()

@router.get("/{page_id}", response_model=schemas.KnowledgePage)
def get_knowledge_page(page_id: UUID, db: Session = Depends(get_db)):
    """Get a knowledge page by ID."""
    page = db.query(models.KnowledgePage).options(
        joinedload(models.KnowledgePage.owner_user),
        joinedload(models.KnowledgePage.owner_group),
        joinedload(models.KnowledgePage.creator_user),
        joinedload(models.KnowledgePage.reviewer_user)
    ).filter(models.KnowledgePage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Knowledge page not found")
    return page

@router.patch("/{page_id}", response_model=schemas.KnowledgePage)
def update_knowledge_page(
    page_id: UUID, 
    page_update: schemas.KnowledgePageUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update a knowledge page."""
    db_page = db.query(models.KnowledgePage).filter(models.KnowledgePage.id == page_id).first()
    if not db_page:
        raise HTTPException(status_code=404, detail="Knowledge page not found")
    
    update_data = page_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_page, key, value)
    
    db_page.updated_by = current_user.id
    if current_user.role == "Admin":
        db_page.reviewed_by = current_user.id
    db.commit()
    db.refresh(db_page)
    
    return db.query(models.KnowledgePage).options(
        joinedload(models.KnowledgePage.owner_user),
        joinedload(models.KnowledgePage.owner_group),
        joinedload(models.KnowledgePage.creator_user),
        joinedload(models.KnowledgePage.reviewer_user)
    ).filter(models.KnowledgePage.id == page_id).first()

@router.delete("/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge_page(page_id: UUID, db: Session = Depends(get_db)):
    """Delete a knowledge page."""
    page = db.query(models.KnowledgePage).filter(models.KnowledgePage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Knowledge page not found")
    
    db.delete(page)
    db.commit()
    return None

@router.post("/notion/sync", status_code=status.HTTP_200_OK)
def sync_notion_pages(
    request: schemas.NotionSyncRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Sync Notion pages into the Knowledge Base."""
    # 1. Fetch token from SystemSettings
    setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "notion").first()
    if not setting or "token" not in setting.value or not setting.value["token"]:
        raise HTTPException(status_code=400, detail="Notion token not configured in system settings.")
        
    token = decrypt_value(setting.value["token"])
    
    # 2. Initialize Notion service
    notion_service = NotionSyncService(token=token, db=db, user_id=current_user.id)
    
    # 3. Perform sync
    synced_count = 0
    if request.sync_all:
        synced_count = notion_service.sync_all_accessible_pages()
    elif request.page_ids:
        synced_count = notion_service.sync_pages_by_ids(request.page_ids)
    else:
        raise HTTPException(status_code=400, detail="Must specify sync_all or provide page_ids.")
        
    return {"status": "success", "synced_count": synced_count}

@router.post("/notion/push")
def push_notion_pages(
    request: schemas.NotionSyncRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Push local KnowledgePages back to Notion."""
    # 1. Fetch token from SystemSettings
    setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "notion").first()
    if not setting or "token" not in setting.value or not setting.value["token"]:
        raise HTTPException(status_code=400, detail="Notion token not configured in system settings.")
        
    token = decrypt_value(setting.value["token"])
        
    if not token:
        raise HTTPException(status_code=401, detail="Notion token not configured.")
        
    # 2. Initialize Notion service
    notion_service = NotionSyncService(token=token, db=db, user_id=current_user.id)
    
    # 3. Perform push
    pushed_count = 0
    if request.sync_all:
        pushed_count = notion_service.push_all_pages()
    elif request.page_ids:
        pushed_count = notion_service.push_pages_by_ids(request.page_ids)
    else:
        raise HTTPException(status_code=400, detail="Must specify sync_all or provide page_ids.")
        
    return {"status": "success", "pushed_count": pushed_count}
