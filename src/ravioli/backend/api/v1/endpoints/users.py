from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ravioli.backend.core import models, schemas
from ravioli.backend.core.database import get_db
import uuid

router = APIRouter()

@router.get("/", response_model=List[schemas.User])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()

@router.post("/", response_model=schemas.User)
def create_user(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    new_user = models.User(
        id=uuid.uuid4(),
        name=user_in.name,
        email=user_in.email,
        role=user_in.role,
        status="invited", # Created by admin, needs activation
        hashed_password=None # Password set during activation
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/groups", response_model=List[schemas.UserGroup])
def list_groups(db: Session = Depends(get_db)):
    return db.query(models.UserGroup).all()

@router.post("/groups", response_model=schemas.UserGroup)
def create_group(group_in: schemas.UserGroupBase, db: Session = Depends(get_db)):
    # Validate owner if provided
    if group_in.owner_id:
        owner = db.query(models.User).filter(models.User.id == group_in.owner_id).first()
        if not owner:
            raise HTTPException(status_code=404, detail="Owner user not found")

    new_group = models.UserGroup(
        id=uuid.uuid4(),
        name=group_in.name,
        description=group_in.description,
        owner_id=group_in.owner_id
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return new_group

@router.get("/groups/{group_id}/members", response_model=List[schemas.User])
def list_group_members(group_id: uuid.UUID, db: Session = Depends(get_db)):
    group = db.query(models.UserGroup).filter(models.UserGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group.members

@router.post("/groups/{group_id}/members/{user_id}")
def add_group_member(group_id: uuid.UUID, user_id: uuid.UUID, db: Session = Depends(get_db)):
    group = db.query(models.UserGroup).filter(models.UserGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user in group.members:
        return {"message": "User already in group"}
    
    group.members.append(user)
    db.commit()
    return {"message": "User added to group"}

@router.delete("/groups/{group_id}/members/{user_id}")
def remove_group_member(group_id: uuid.UUID, user_id: uuid.UUID, db: Session = Depends(get_db)):
    group = db.query(models.UserGroup).filter(models.UserGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user not in group.members:
        raise HTTPException(status_code=400, detail="User not in group")
    
    group.members.remove(user)
    db.commit()
    return {"message": "User removed from group"}

@router.patch("/{user_id}", response_model=schemas.User)
def update_user(user_id: uuid.UUID, user_in: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
