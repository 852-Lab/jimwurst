from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
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
def login(credentials: schemas.UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Simple password check (direct comparison for this task)
    if user.hashed_password != credentials.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user.status == 'invited':
        raise HTTPException(status_code=403, detail="Account not activated. Please sign up to set your password.")
        
    # Set session cookie (max_age = 30 days)
    response.set_cookie(key="ravioli_session", value=user.email, max_age=2592000, httponly=False)
    return user

@router.post("/signup", response_model=schemas.User)
def signup(data: schemas.UserSignup, response: Response, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(models.User).filter(models.User.email == data.email).first()
    
    user = None
    if existing_user:
        if existing_user.status == 'active':
            raise HTTPException(status_code=400, detail="User already exists")
        
        # Activating an invited user
        existing_user.name = data.name
        existing_user.hashed_password = data.password
        existing_user.status = 'active'
        db.commit()
        db.refresh(existing_user)
        user = existing_user
    else:
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
        user = new_user

    # Set session cookie (max_age = 30 days)
    response.set_cookie(key="ravioli_session", value=user.email, max_age=2592000, httponly=False)
    return user

@router.get("/me", response_model=schemas.User)
def get_me(email: str = None, ravioli_session: str = Cookie(None), db: Session = Depends(get_db)):
    # Use email from query param if provided, otherwise check cookie
    user_email = email or ravioli_session
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    user = db.query(models.User).filter(models.User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
