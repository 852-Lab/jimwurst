from ravioli.backend.core.database import SessionLocal
from ravioli.backend.core import models
from datetime import datetime, UTC, timedelta

db = SessionLocal()
try:
    total_verified = db.query(models.Insight).filter(models.Insight.is_verified == True).count()
    print(f"Total verified insights: {total_verified}")
    
    since_7d = datetime.now(UTC) - timedelta(days=7)
    recent_verified = db.query(models.Insight).filter(models.Insight.is_verified == True, models.Insight.created_at >= since_7d).count()
    print(f"Verified insights in last 7 days: {recent_verified}")
    
    insights = db.query(models.Insight).filter(models.Insight.is_verified == True).all()
    for i in insights:
        print(f"ID: {i.id}, Created At: {i.created_at}, Verified: {i.is_verified}")
finally:
    db.close()
