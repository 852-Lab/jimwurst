from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ravioli.backend.core import models, schemas
from ravioli.backend.core.database import get_db
import uuid
from ravioli.backend.api.v1.endpoints.data import get_current_user

router = APIRouter()

@router.get("/", response_model=List[schemas.User])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()

@router.post("/", response_model=schemas.User)
def create_user(
    user_in: schemas.UserCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    new_user_id = uuid.uuid4()
    new_user = models.User(
        id=new_user_id,
        name=user_in.name,
        email=user_in.email,
        role=user_in.role,
        status="invited", # Created by admin, needs activation
        hashed_password=None, # Password set during activation
        created_by=current_user.id if current_user else new_user_id,
        updated_by=current_user.id if current_user else new_user_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/groups", response_model=List[schemas.UserGroup])
def list_groups(db: Session = Depends(get_db)):
    return db.query(models.UserGroup).all()

@router.post("/groups", response_model=schemas.UserGroup)
def create_group(
    group_in: schemas.UserGroupBase, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Validate owner if provided
    if group_in.owner_id:
        owner = db.query(models.User).filter(models.User.id == group_in.owner_id).first()
        if not owner:
            raise HTTPException(status_code=404, detail="Owner user not found")

    new_group = models.UserGroup(
        id=uuid.uuid4(),
        name=group_in.name,
        description=group_in.description,
        owner_id=group_in.owner_id,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return new_group

@router.patch("/groups/{group_id}", response_model=schemas.UserGroup)
def update_group(
    group_id: uuid.UUID,
    group_in: schemas.UserGroupUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    group = db.query(models.UserGroup).filter(models.UserGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if group_in.owner_id is not None:
        owner = db.query(models.User).filter(models.User.id == group_in.owner_id).first()
        if not owner:
            raise HTTPException(status_code=404, detail="Owner user not found")
            
    update_data = group_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)
        
    group.updated_by = current_user.id
    db.commit()
    db.refresh(group)
    return group

@router.delete("/groups/{group_id}")
def delete_group(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    group = db.query(models.UserGroup).filter(models.UserGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    db.delete(group)
    db.commit()
    return {"message": "Group deleted successfully"}

@router.get("/groups/{group_id}", response_model=schemas.UserGroupDetail)
def get_group(group_id: uuid.UUID, db: Session = Depends(get_db)):
    group = db.query(models.UserGroup).filter(models.UserGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.get("/groups/{group_id}/members", response_model=List[schemas.User])

def list_group_members(group_id: uuid.UUID, db: Session = Depends(get_db)):
    group = db.query(models.UserGroup).filter(models.UserGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group.members

@router.post("/groups/{group_id}/members/{user_id}")
def add_group_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    role: Optional[str] = "Member",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    group = db.query(models.UserGroup).filter(models.UserGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    membership = db.query(models.UserGroupMember).filter(
        models.UserGroupMember.group_id == group_id,
        models.UserGroupMember.user_id == user_id
    ).first()
    
    if membership:
        return {"message": "User already in group"}
    
    new_membership = models.UserGroupMember(
        user_id=user_id,
        group_id=group_id,
        role_in_group=role,
        updated_by=current_user.id
    )
    db.add(new_membership)
    db.commit()
    return {"message": "User added to group"}

@router.delete("/groups/{group_id}/members/{user_id}")
def remove_group_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    group = db.query(models.UserGroup).filter(models.UserGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    membership = db.query(models.UserGroupMember).filter(
        models.UserGroupMember.group_id == group_id,
        models.UserGroupMember.user_id == user_id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=400, detail="User not in group")
    
    db.delete(membership)
    db.commit()
    return {"message": "User removed from group"}

@router.patch("/groups/{group_id}/members/{user_id}")
def update_group_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    role_in_group: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    membership = db.query(models.UserGroupMember).filter(
        models.UserGroupMember.group_id == group_id,
        models.UserGroupMember.user_id == user_id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
        
    membership.role_in_group = role_in_group
    membership.updated_by = current_user.id
    db.commit()
    return {"message": "Membership updated successfully"}

@router.patch("/{user_id}", response_model=schemas.User)
def update_user(
    user_id: uuid.UUID, 
    user_in: schemas.UserUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    user.updated_by = current_user.id
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Self-deletion safety check
    if current_user and user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete currently logged-in user")
        
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}
