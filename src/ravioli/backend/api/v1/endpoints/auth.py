from fastapi import APIRouter, Depends, HTTPException, status
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

@router.post("/login", response_model=schemas.User)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Simple password check (direct comparison for this task)
    if user.hashed_password != credentials.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user.status == 'invited':
        raise HTTPException(status_code=403, detail="Account not activated. Please sign up to set your password.")
        
    return user

@router.post("/signup", response_model=schemas.User)
def signup(data: schemas.UserSignup, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(models.User).filter(models.User.email == data.email).first()
    
    if existing_user:
        if existing_user.status == 'active':
            raise HTTPException(status_code=400, detail="User already exists")
        
        # Activating an invited user
        existing_user.name = data.name
        existing_user.hashed_password = data.password
        existing_user.status = 'active'
        db.commit()
        db.refresh(existing_user)
        return existing_user
    
    # Create new user (if not invited)
    new_user = models.User(
        id=uuid.uuid4(),
        name=data.name,
        email=data.email,
        hashed_password=data.password,
        role="Viewer", # Default role for self-signup
        status="active"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/me", response_model=schemas.User)
def get_me(email: str, db: Session = Depends(get_db)):
    # In a real app, this would use a JWT token to get the user
    # For this simple implementation, we'll pass the email as a query param (mock auth)
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
