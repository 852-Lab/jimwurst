from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ravioli.backend.core import models, schemas
from ravioli.backend.core.database import SessionLocal
import uuid

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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
    new_group = models.UserGroup(
        id=uuid.uuid4(),
        name=group_in.name,
        description=group_in.description
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return new_group

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
