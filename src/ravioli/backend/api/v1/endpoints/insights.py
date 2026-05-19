from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List
from uuid import UUID
from datetime import datetime, UTC, timedelta

from ravioli.backend.core.database import get_db
from ravioli.backend.core import models, schemas
from ravioli.ai.Kowalski import KowalskiAgent
from ravioli.ai.skills import analysis as skill_analysis
from ravioli.backend.api.v1.endpoints.data import get_current_user

router = APIRouter()


@router.get("/stats", response_model=schemas.InsightStats)
def get_insight_stats(db: Session = Depends(get_db)):
    """BANs: verified count, total analyses, and contributing analyses (distinct sources with ≥1 verified insight)."""
    verified_count = db.query(func.count(models.Insight.id)).filter(
        models.Insight.is_verified == True
    ).scalar() or 0

    analyses_count = db.query(func.count(models.Analysis.id)).scalar() or 0

    contributors_count = db.query(
        func.count(func.distinct(models.Insight.analysis_id))
    ).filter(models.Insight.is_verified == True).scalar() or 0

    return schemas.InsightStats(
        verified_count=verified_count,
        analyses_count=analyses_count,
        contributors_count=contributors_count,
    )


@router.get("/summary")
async def get_insights_summary(days: int = 7, db: Session = Depends(get_db)):
    """AI-generated executive summary of all verified insights within the last `days` days."""
    since = datetime.now(UTC) - timedelta(days=days)
    insights = (
        db.query(models.Insight)
        .filter(models.Insight.is_verified == True, models.Insight.created_at >= since)
        .order_by(models.Insight.created_at.desc())
        .all()
    )
    contents = [i.content for i in insights]

    agent = KowalskiAgent(db)
    summary = await skill_analysis.generate_insights_summary(contents, days, agent.generate)
    total_verified = db.query(func.count(models.Insight.id)).filter(
        models.Insight.is_verified == True
    ).scalar() or 0

    return {
        "summary": summary,
        "insight_count": len(contents),
        "total_verified_count": total_verified,
        "days": days
    }


@router.get("/review-queue", response_model=List[schemas.Insight])
def get_review_queue(db: Session = Depends(get_db)):
    """Unverified insights awaiting operator review, newest first."""
    return (
        db.query(models.Insight)
        .options(
            joinedload(models.Insight.owner_user),
            joinedload(models.Insight.owner_group),
            joinedload(models.Insight.creator_user),
            joinedload(models.Insight.reviewer_user)
        )
        .filter(models.Insight.is_verified == False)
        .order_by(models.Insight.created_at.desc())
        .all()
    )


@router.get("/feed", response_model=List[schemas.Insight])
def get_insights_feed(days: int = 30, db: Session = Depends(get_db)):
    """Verified insights, newest first, used for the News Feed."""
    since = datetime.now(UTC) - timedelta(days=days)
    return (
        db.query(models.Insight)
        .options(
            joinedload(models.Insight.owner_user),
            joinedload(models.Insight.owner_group),
            joinedload(models.Insight.creator_user),
            joinedload(models.Insight.reviewer_user)
        )
        .filter(models.Insight.is_verified == True, models.Insight.created_at >= since)
        .order_by(models.Insight.created_at.desc())
        .all()
    )


@router.patch("/{insight_id}/verify", response_model=schemas.Insight)
def verify_insight(
    insight_id: UUID, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Mark an insight as verified."""
    insight = db.query(models.Insight).filter(models.Insight.id == insight_id).first()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    insight.is_verified = True
    insight.updated_at = datetime.now(UTC)
    insight.updated_by = current_user.id
    insight.reviewed_by = current_user.id
    db.commit()
    db.refresh(insight)
    
    # Return with eager loaded relations
    return db.query(models.Insight).options(
        joinedload(models.Insight.owner_user),
        joinedload(models.Insight.owner_group),
        joinedload(models.Insight.creator_user),
        joinedload(models.Insight.reviewer_user)
    ).filter(models.Insight.id == insight_id).first()


@router.patch("/{insight_id}/reject", response_model=schemas.Insight)
def reject_insight(insight_id: UUID, db: Session = Depends(get_db)):
    """Remove an insight from the review queue (soft-reject: delete the row)."""
    insight = db.query(models.Insight).filter(models.Insight.id == insight_id).first()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    db.delete(insight)
    db.commit()
    return insight


@router.get("/", response_model=List[schemas.Insight])
def list_insights(db: Session = Depends(get_db)):
    return db.query(models.Insight).options(
        joinedload(models.Insight.owner_user),
        joinedload(models.Insight.owner_group),
        joinedload(models.Insight.creator_user),
        joinedload(models.Insight.reviewer_user)
    ).order_by(models.Insight.created_at.desc()).all()


@router.get("/lineage", response_model=schemas.LineageResponse)
def get_insights_lineage(db: Session = Depends(get_db)):
    """Fetch the lineage graph of data sources, analyses, insights, and knowledge pages."""
    nodes = []
    edges = []
    
    # 1. Fetch and add DataSources
    datasources = db.query(models.DataSource).options(
        joinedload(models.DataSource.owner_user),
        joinedload(models.DataSource.owner_group),
        joinedload(models.DataSource.creator_user)
    ).all()
    for ds in datasources:
        nodes.append(schemas.LineageNode(
            id=f"datasource-{ds.id}",
            type="datasource",
            label=ds.original_filename,
            metadata={
                "id": str(ds.id),
                "filename": ds.filename,
                "content_type": ds.content_type,
                "row_count": ds.row_count,
                "size_bytes": ds.size_bytes,
                "has_pii": ds.has_pii,
                "owner_name": ds.owner_user.name if ds.owner_type == "user" and ds.owner_user else (ds.owner_group.name if ds.owner_type == "group" and ds.owner_group else None),
                "owner_type": ds.owner_type,
                "creator_name": ds.creator_user.name if ds.creator_user else None
            }
        ))
        
    # 2. Fetch and add Analyses
    analyses = db.query(models.Analysis).options(
        joinedload(models.Analysis.owner_user),
        joinedload(models.Analysis.owner_group),
        joinedload(models.Analysis.creator_user)
    ).all()
    for ana in analyses:
        nodes.append(schemas.LineageNode(
            id=f"analysis-{ana.id}",
            type="analysis",
            label=ana.title,
            metadata={
                "id": str(ana.id),
                "status": ana.status,
                "description": ana.description,
                "created_at": ana.created_at.isoformat() if ana.created_at else None,
                "owner_name": ana.owner_user.name if ana.owner_type == "user" and ana.owner_user else (ana.owner_group.name if ana.owner_type == "group" and ana.owner_group else None),
                "owner_type": ana.owner_type,
                "creator_name": ana.creator_user.name if ana.creator_user else None
            }
        ))
        # Add edge: DataSource -> Analysis
        if ana.analysis_metadata:
            file_id = ana.analysis_metadata.get("file_id")
            if file_id:
                edges.append(schemas.LineageEdge(
                    source=f"datasource-{file_id}",
                    target=f"analysis-{ana.id}",
                    type="queried"
                ))
            elif ana.analysis_metadata.get("filename"):
                filename = ana.analysis_metadata.get("filename")
                ds_match = next((d for d in datasources if d.original_filename == filename or d.filename == filename), None)
                if ds_match:
                    edges.append(schemas.LineageEdge(
                        source=f"datasource-{ds_match.id}",
                        target=f"analysis-{ana.id}",
                        type="queried"
                    ))
                    
    # 3. Fetch and add Insights (with parents loaded)
    insights = db.query(models.Insight).options(
        joinedload(models.Insight.parents),
        joinedload(models.Insight.owner_user),
        joinedload(models.Insight.owner_group),
        joinedload(models.Insight.creator_user)
    ).all()
    for ins in insights:
        nodes.append(schemas.LineageNode(
            id=f"insight-{ins.id}",
            type="insight",
            label=ins.content[:60] + ("..." if len(ins.content) > 60 else ""),
            metadata={
                "id": str(ins.id),
                "content": ins.content,
                "is_verified": ins.is_verified,
                "is_published": ins.is_published,
                "source_label": ins.source_label,
                "owner_name": ins.owner_user.name if ins.owner_type == "user" and ins.owner_user else (ins.owner_group.name if ins.owner_type == "group" and ins.owner_group else None),
                "owner_type": ins.owner_type,
                "creator_name": ins.creator_user.name if ins.creator_user else None
            }
        ))
        # Add edge: Analysis -> Insight
        edges.append(schemas.LineageEdge(
            source=f"analysis-{ins.analysis_id}",
            target=f"insight-{ins.id}",
            type="extracted_from"
        ))
        # Add edges: Parent Insight -> Child Insight
        for p in ins.parents:
            edges.append(schemas.LineageEdge(
                source=f"insight-{p.id}",
                target=f"insight-{ins.id}",
                type="derived_from"
            ))

    # 4. Fetch and add KnowledgePages
    pages = db.query(models.KnowledgePage).options(
        joinedload(models.KnowledgePage.owner_user),
        joinedload(models.KnowledgePage.owner_group),
        joinedload(models.KnowledgePage.creator_user)
    ).all()
    for page in pages:
        nodes.append(schemas.LineageNode(
            id=f"knowledge-{page.id}",
            type="knowledge",
            label=page.title,
            metadata={
                "id": str(page.id),
                "source": page.source,
                "source_id": page.source_id,
                "updated_at": page.updated_at.isoformat() if page.updated_at else None,
                "owner_name": page.owner_user.name if page.owner_type == "user" and page.owner_user else (page.owner_group.name if page.owner_type == "group" and page.owner_group else None),
                "owner_type": page.owner_type,
                "creator_name": page.creator_user.name if page.creator_user else None
            }
        ))
        # Add edge: Insight -> KnowledgePage
        if page.source_id:
            try:
                page_source_uuid = UUID(page.source_id)
                ins_match = next((i for i in insights if i.id == page_source_uuid), None)
                if ins_match:
                    edges.append(schemas.LineageEdge(
                        source=f"insight-{ins_match.id}",
                        target=f"knowledge-{page.id}",
                        type="documented_in"
                    ))
            except ValueError:
                # source_id is not a UUID (e.g., non-insight source); skip creating an insight lineage edge.
                pass
                
    return schemas.LineageResponse(nodes=nodes, edges=edges)
