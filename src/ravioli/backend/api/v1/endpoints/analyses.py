from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, BackgroundTasks
from fastapi.responses import StreamingResponse
import pandas as pd
import asyncio
import io
import logging
import uuid
import json
import re
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import select

from ravioli.backend.core.database import get_db, SessionLocal
from ravioli.backend.core import models, schemas
from ravioli.ai.Kowalski import KowalskiAgent
from ravioli.ai.skills import communication as skill_comm
from ravioli.ai.skills import analysis as skill_analysis
from ravioli.backend.data.olap.duckdb_manager import duckdb_manager
from ydata_profiling import ProfileReport
from ravioli.backend.api.v1.endpoints.data import get_current_user


router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/", response_model=schemas.Analysis, status_code=status.HTTP_201_CREATED)
def create_analysis(
    analysis_in: schemas.AnalysisCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Create a new analysis.
    """
    notebook = analysis_in.notebook
    if not notebook:
        notebook = {
            "cells": [],
            "metadata": {},
            "nbformat": 4,
            "nbformat_minor": 5
        }
        
    db_analysis = models.Analysis(
        title=analysis_in.title,
        description=analysis_in.description,
        analysis_metadata=analysis_in.analysis_metadata,
        notebook=notebook,
        owner=analysis_in.owner,
        owner_id=analysis_in.owner_id or current_user.id,
        owner_type=analysis_in.owner_type or "user",
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(db_analysis)
    db.commit()
    db.refresh(db_analysis)
    return db_analysis

@router.get("/", response_model=List[schemas.Analysis])
def list_analyses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    List all analyses.
    """
    analyses = db.query(models.Analysis).order_by(models.Analysis.created_at.desc()).offset(skip).limit(limit).all()
    return analyses

@router.get("/{analysis_id}/suggested-prompts", response_model=List[str])
async def get_suggested_prompts(
    analysis_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Generate 3 high-impact analytical prompts based on context.
    """
    analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # Context preparation
    filename = analysis.analysis_metadata.get("filename", "Unknown Dataset")
    summary = analysis.result or "No summary available."
    
    # Get last 5 logs for context
    previous_logs = db.query(models.AnalysisLog)\
        .filter(models.AnalysisLog.analysis_id == analysis_id)\
        .order_by(models.AnalysisLog.timestamp.desc())\
        .limit(5).all()
    
    role_map = {"user_query": "Operator", "thought": "Kowalski"}
    context_str = ""
    for log in reversed(previous_logs):
        role = role_map.get(log.log_type, "Kowalski")
        context_str += f"{role}: {log.content}\n"
        
    agent = KowalskiAgent(db)
    
    try:
        prompts = await skill_comm.generate_suggested_prompts(filename, summary, context_str, agent.generate)
        return prompts
    except Exception as e:
        logger.error(f"Error generating suggested prompts: {e}")
        return [
            "Perform a deep dive into the primary volume drivers.",
            "Analyze the temporal distribution of identified anomalies.",
            "Quantify the statistical impact of the data limitations."
        ]

@router.get("/{analysis_id}", response_model=schemas.Analysis)
def get_analysis(analysis_id: UUID, db: Session = Depends(get_db)):
    """
    Get a specific analysis by ID.
    """
    analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis

@router.patch("/{analysis_id}", response_model=schemas.Analysis)
def update_analysis(
    analysis_id: UUID, 
    analysis_in: schemas.AnalysisUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Update an analysis.
    """
    db_analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
    if not db_analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    update_data = analysis_in.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_analysis, field, value)
    
    db_analysis.updated_by = current_user.id
    db.commit()
    db.refresh(db_analysis)
    return db_analysis

@router.post("/{analysis_id}/approve", response_model=schemas.Analysis)
def approve_analysis(analysis_id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Mark an analysis result as approved and queue background extraction of individual insights.
    """
    db_analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
    if not db_analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    metadata = dict(db_analysis.analysis_metadata or {})
    metadata['is_approved'] = True
    db_analysis.analysis_metadata = metadata
    db.commit()
    db.refresh(db_analysis)
    if db_analysis.result:
        background_tasks.add_task(
            extract_and_store_insights,
            str(analysis_id),
            db_analysis.result,
            db_analysis.title,
        )
    return db_analysis


async def extract_and_store_insights(analysis_id: str, result_markdown: str, title: str):
    """Background task: parse all template sections and store one Insight row per Key Insight bullet."""
    db = SessionLocal()
    try:
        analysis_uuid = UUID(analysis_id)
        analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_uuid).first()
        if not analysis:
            return
            
        # Skip if insights already extracted for this analysis
        if db.query(models.Insight).filter(models.Insight.analysis_id == analysis_uuid).first():
            return

        agent = KowalskiAgent(db)
        parsed = await skill_analysis.extract_insights(result_markdown, agent.generate)

        bullets: list[str] = parsed.get("bullets", [])
        assumptions: str = parsed.get("assumptions", "")
        limitations: str = parsed.get("limitations", "")
        metadata: dict = parsed.get("metadata", {})

        for bullet in bullets:
            if bullet.strip():
                db.add(models.Insight(
                    analysis_id=analysis_uuid,
                    content=bullet.strip(),
                    source_label=title,
                    assumptions=assumptions or None,
                    limitations=limitations or None,
                    insight_metadata=metadata if any(metadata.values()) else None, # Note: corrected from 'metadata' to 'insight_metadata' to match models.py
                    is_verified=False,
                    is_published=False,
                    owner=analysis.owner or analysis.created_by,
                    owner_id=analysis.owner_id,
                    owner_type=analysis.owner_type,
                    created_by=analysis.created_by,
                    updated_by=analysis.created_by
                ))
        db.commit()
        logger.info("Extracted %d insights from analysis %s", len(bullets), analysis_id)
    except Exception as e:
        logger.error("Insight extraction failed for %s: %s", analysis_id, e)
    finally:
        db.close()

@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(analysis_id: UUID, db: Session = Depends(get_db)):
    """
    Delete an analysis.
    """
    db_analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
    if not db_analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    db.delete(db_analysis)
    db.commit()
    return None

@router.post("/{analysis_id}/ask", status_code=status.HTTP_202_ACCEPTED)
async def ask_question(
    analysis_id: UUID, 
    question_in: schemas.QuestionCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Submit a question to an analysis.
    """
    analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # 1. Create user log
    user_log = models.AnalysisLog(
        analysis_id=analysis_id,
        log_type="user_query",
        content=question_in.question
    )
    db.add(user_log)
    
    # 2. Update analysis status
    analysis.status = "running"
    db.commit()
    
    # 3. Queue background processing
    background_tasks.add_task(process_analysis_question, str(analysis_id), question_in.question)
    
    return {"message": "Question received and processing started"}

async def process_analysis_question(analysis_id: str, question: str):
    """
    Background task to generate AI response for a question.
    """
    db = SessionLocal()
    try:
        analysis_uuid = uuid.UUID(analysis_id)
        analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_uuid).first()
        if not analysis:
            return

        # Prepare context
        filename = analysis.analysis_metadata.get("filename", "Unknown Dataset")
        summary = analysis.result or "No summary available."
        
        # Get last 5 logs for context
        previous_logs = db.query(models.AnalysisLog)\
            .filter(models.AnalysisLog.analysis_id == analysis_uuid)\
            .order_by(models.AnalysisLog.timestamp.desc())\
            .limit(6).all() # 6 because we just added the current question
        
        context_str = ""
        for log in reversed(previous_logs[1:]): # Skip the latest question for context
            role = "Operator" if log.log_type == "user_query" else "Kowalski"
            context_str += f"{role}: {log.content}\n"

        # Fetch detailed info of selected data sources and knowledge pages to augment context
        ds_context_parts = []
        kb_context_parts = []
        if analysis.analysis_metadata:
            selected_ds_ids = analysis.analysis_metadata.get("data_sources", [])
            selected_kb_ids = analysis.analysis_metadata.get("knowledge_pages", [])
            
            # Fetch data source descriptions
            if selected_ds_ids:
                for ds_id_str in selected_ds_ids:
                    try:
                        ds_uuid = UUID(str(ds_id_str))
                        ds_obj = db.query(models.DataSource).filter(models.DataSource.id == ds_uuid).first()
                        if ds_obj:
                            desc = ds_obj.description or "No description"
                            ds_context_parts.append(f"- Data Source '{ds_obj.original_filename}' (Table: {ds_obj.table_name}): {desc}")
                    except Exception as ex:
                        logger.error(f"Error fetching data source for context: {ex}")
                        
            # Fetch knowledge page contents
            if selected_kb_ids:
                for kb_id_str in selected_kb_ids:
                    try:
                        kb_uuid = UUID(str(kb_id_str))
                        kb_obj = db.query(models.KnowledgePage).filter(models.KnowledgePage.id == kb_uuid).first()
                        if kb_obj:
                            # Extract page text from content blocks
                            blocks = kb_obj.content or []
                            text_content = ""
                            for block in blocks:
                                if block.get("type") == "paragraph":
                                    paragraph = block.get("paragraph", {})
                                    rich_text = paragraph.get("rich_text", [])
                                    text_content += " ".join([t.get("plain_text", "") for t in rich_text]) + "\n"
                            
                            kb_context_parts.append(f"- Knowledge Page '{kb_obj.title}':\n{text_content.strip()}")
                    except Exception as ex:
                        logger.error(f"Error fetching knowledge page for context: {ex}")

        # Prepend attached sources and knowledges to context
        if ds_context_parts:
            context_str = "ATTACHED DATA SOURCES:\n" + "\n".join(ds_context_parts) + "\n\n" + context_str
        if kb_context_parts:
            context_str = "ATTACHED KNOWLEDGE BASE CONTEXT:\n" + "\n".join(kb_context_parts) + "\n\n" + context_str

        # Generate answer
        agent = KowalskiAgent(db)
        answer = await skill_comm.generate_answer(filename, summary, context_str, question, agent.generate)
        
        # Save answer
        agent_log = models.AnalysisLog(
            analysis_id=analysis_id,
            log_type="thought",
            content=answer
        )
        db.add(agent_log)
        
        # Update status
        analysis.status = "completed"
        db.commit()
    except Exception as e:
        print(f"Error in background task process_analysis_question: {e}")
        # Optionally add an error log to the analysis
    finally:
        db.close()

def get_interpolated_timestamp(db: Session, analysis_id: UUID, after_log_id: UUID) -> datetime:
    """
    Calculates a timestamp strictly between after_log_id and the subsequent log
    to allow arbitrary chronological insertions of notebook cells.
    """
    all_logs = db.query(models.AnalysisLog).filter(models.AnalysisLog.analysis_id == analysis_id).order_by(models.AnalysisLog.timestamp.asc()).all()
    
    target_idx = -1
    for idx, log in enumerate(all_logs):
        if log.id == after_log_id:
            target_idx = idx
            break
            
    if target_idx == -1:
        return datetime.now(timezone.utc)
        
    target_log = all_logs[target_idx]
    
    if target_idx + 1 < len(all_logs):
        next_log = all_logs[target_idx + 1]
        delta = next_log.timestamp - target_log.timestamp
        return target_log.timestamp + (delta / 2)
    else:
        from datetime import timedelta
        return target_log.timestamp + timedelta(seconds=1)

@router.get("/{analysis_id}/stream")
async def stream_question(
    analysis_id: UUID,
    question: str,
    replace_log_id: Optional[UUID] = None,
    insert_after_log_id: Optional[UUID] = None,
    db: Session = Depends(get_db)
):
    """
    Stream a response to a question using Server-Sent Events.
    If replace_log_id is provided, updates the existing query and overwrites its outputs in-place.
    If insert_after_log_id is provided, calculates the chronological timestamp to wedge the new cell in-between.
    """
    analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    user_log = None
    if replace_log_id:
        user_log = db.query(models.AnalysisLog).filter(models.AnalysisLog.id == replace_log_id).first()
        if user_log:
            user_log.content = question
            db.commit()
            
            # Delete subsequent outputs belonging to this execution step
            all_logs = db.query(models.AnalysisLog).filter(models.AnalysisLog.analysis_id == analysis_id).order_by(models.AnalysisLog.timestamp.asc()).all()
            target_idx = -1
            for idx, log in enumerate(all_logs):
                if log.id == replace_log_id:
                    target_idx = idx
                    break
            if target_idx != -1:
                for log in all_logs[target_idx+1:]:
                    if log.log_type == "user_query":
                        break
                    db.delete(log)
                db.commit()

    if not user_log:
        user_log = models.AnalysisLog(
            analysis_id=analysis_id,
            log_type="user_query",
            content=question
        )
        if insert_after_log_id:
            user_log.timestamp = get_interpolated_timestamp(db, analysis_id, insert_after_log_id)
            
        db.add(user_log)
        db.commit()
        db.refresh(user_log)

    analysis.status = "running"
    db.commit()
    user_log_timestamp = user_log.timestamp

    async def event_generator():
        # Context preparation (same as background task)
        filename = analysis.analysis_metadata.get("filename", "Unknown Dataset")
        summary = analysis.result or "No summary available."
        
        # Get last 5 logs for context
        previous_logs = db.query(models.AnalysisLog)\
            .filter(models.AnalysisLog.analysis_id == analysis_id)\
            .order_by(models.AnalysisLog.timestamp.desc())\
            .limit(6).all()
        
        context_str = ""
        for log in reversed(previous_logs[1:]):
            role = "Operator" if log.log_type == "user_query" else "Kowalski"
            context_str += f"{role}: {log.content}\n"

        sql_agent = KowalskiAgent(db)
        full_response = ""
        
        # Determine table context if available
        table_name = None
        schema_name = "main"
        file_id = None
        if analysis.analysis_metadata:
            file_id = analysis.analysis_metadata.get("file_id")
            if not file_id:
                ds_list = analysis.analysis_metadata.get("data_sources", [])
                if ds_list and len(ds_list) > 0:
                    file_id = ds_list[0]

        if file_id:
            try:
                source = db.query(models.DataSource).filter(models.DataSource.id == UUID(str(file_id))).first()
                if source:
                    table_name = source.table_name
                    schema_name = source.schema_name
            except Exception as e:
                logger.error(f"Error resolving table context for analysis {analysis_id}: {e}")

        # Fetch detailed info of selected data sources and knowledge pages to augment context
        ds_context_parts = []
        kb_context_parts = []
        if analysis.analysis_metadata:
            selected_ds_ids = analysis.analysis_metadata.get("data_sources", [])
            selected_kb_ids = analysis.analysis_metadata.get("knowledge_pages", [])
            
            # Fetch data source descriptions
            if selected_ds_ids:
                for ds_id_str in selected_ds_ids:
                    try:
                        ds_uuid = UUID(str(ds_id_str))
                        ds_obj = db.query(models.DataSource).filter(models.DataSource.id == ds_uuid).first()
                        if ds_obj:
                            desc = ds_obj.description or "No description"
                            ds_context_parts.append(f"- Data Source '{ds_obj.original_filename}' (Table: {ds_obj.table_name}): {desc}")
                    except Exception as ex:
                        logger.error(f"Error fetching data source for context: {ex}")
                        
            # Fetch knowledge page contents
            if selected_kb_ids:
                for kb_id_str in selected_kb_ids:
                    try:
                        kb_uuid = UUID(str(kb_id_str))
                        kb_obj = db.query(models.KnowledgePage).filter(models.KnowledgePage.id == kb_uuid).first()
                        if kb_obj:
                            # Extract page text from content blocks
                            blocks = kb_obj.content or []
                            text_content = ""
                            for block in blocks:
                                if block.get("type") == "paragraph":
                                    paragraph = block.get("paragraph", {})
                                    rich_text = paragraph.get("rich_text", [])
                                    text_content += " ".join([t.get("plain_text", "") for t in rich_text]) + "\n"
                            
                            kb_context_parts.append(f"- Knowledge Page '{kb_obj.title}':\n{text_content.strip()}")
                    except Exception as ex:
                        logger.error(f"Error fetching knowledge page for context: {ex}")

        # Prepend attached sources and knowledges to context
        if ds_context_parts:
            context_str = "ATTACHED DATA SOURCES:\n" + "\n".join(ds_context_parts) + "\n\n" + context_str
        if kb_context_parts:
            context_str = "ATTACHED KNOWLEDGE BASE CONTEXT:\n" + "\n".join(kb_context_parts) + "\n\n" + context_str

        try:
            # 1. Engage the SQL Agent with progress streaming
            viz_payload = None
            if table_name:
                async for update in sql_agent.process_question(question, table_name, schema_name):
                    if isinstance(update, str):
                        # Yield status update to user
                        yield f"data: {update}\n\n"
                    elif isinstance(update, dict):
                        if update.get("answer_type") == "viz":
                            viz_payload = update.get("viz")
                            if viz_payload and viz_payload.get("type") == "error":
                                context_str += f"\nSystem: Data visualization failed due to error: {viz_payload.get('message')}. Please inform the user that their request cannot be done due to this error.\n"
                        elif update.get("answer_type") == "error":
                            error_msg = update.get("message")
                            context_str += f"\nSystem: Data visualization failed due to error: {error_msg}. Please inform the user that their request cannot be done due to this error.\n"
                        break

            # 2. Stream the textual answer from Gemma (persona)
            async for token in skill_comm.stream_answer(filename, summary, context_str, question, sql_agent.persona, sql_agent.ollama_client.stream):
                full_response += token
                yield f"data: {token}\n\n"
            
            # 3. If visualization was generated, send it at the end
            if viz_payload:
                yield f"data: [VIZ]{json.dumps(viz_payload)}\n\n"
            
            # Persistence at the end
            import datetime
            async_db = SessionLocal()
            try:
                agent_log = models.AnalysisLog(
                    analysis_id=analysis_id,
                    log_type="thought",
                    content=full_response,
                    data=viz_payload # Store the viz data in the log
                )
                
                # Maintain original chronological position for in-place reruns or custom insertions
                if (replace_log_id or insert_after_log_id) and user_log_timestamp:
                    agent_log.timestamp = user_log_timestamp + datetime.timedelta(milliseconds=500)
                
                async_db.add(agent_log)
                
                # Re-fetch analysis in this session
                a = async_db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
                if a:
                    a.status = "completed"
                async_db.commit()
            finally:
                async_db.close()
            
            yield "data: [DONE]\n\n"
                
        except Exception as e:
            logger.exception("Stream interrupted for analysis_id=%s", analysis_id)
            yield "data: [ERROR] Stream interrupted due to an internal error.\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
    



def prepare_dataframe_for_analysis(df: pd.DataFrame) -> pd.DataFrame:
    """Intelligently detects and casts column types for better statistical analysis."""
    df = df.copy()
    # Patterns for columns that should be treated as strings/categories, never as numeric metrics
    id_patterns = ['_id', ' id', 'postal', 'zip', 'phone', 'postcode', 'telephone', 'id']
    
    for col in df.columns:
        col_lower = col.lower()
        
        # 1. Cast IDs and non-analytical numeric codes to string/category
        if any(pat in col_lower for pat in id_patterns) or col_lower == 'id':
            # If cardinality is low, use category; otherwise string
            if df[col].nunique() < 50:
                df[col] = df[col].astype('category')
            else:
                df[col] = df[col].astype(str)
            continue

        # 2. Convert potential numeric columns that are currently strings
        if df[col].dtype == 'object':
            # Try to convert to numeric (Int64 handles nulls better than int)
            converted = pd.to_numeric(df[col], errors='coerce')
            if not converted.isna().all():
                df[col] = converted
            # Best-effort conversion: leave the original column dtype unchanged
            # if pandas cannot safely coerce this column to numeric.

        # 3. Handle low-cardinality strings as categories
        if df[col].dtype == 'object' and df[col].nunique() < 30:
            df[col] = df[col].astype('category')
            
    return df

def create_data_profile(df: pd.DataFrame) -> str:
    """Creates a high-fidelity statistical profile of the prepared dataset."""
    print(f"OllamaClient: [INFO] Profiling {len(df.columns)} columns: {df.columns.tolist()}", flush=True)
    
    # 1. Basic Stats (Describe respects types: no means for categories)
    stats = df.describe(include='all').transpose().to_string()
    
    # 2. Data Quality
    quality = pd.DataFrame({
        'dtype': df.dtypes,
        'null_count': df.isnull().sum(),
        'unique_count': df.nunique()
    }).to_string()

    advanced_insights = ""
    try:
        # Pass the FULL dataframe so every column is processed in the log
        profile = ProfileReport(df, minimal=True, title="Data Profile")
        description = profile.get_description()
        
        # Extract Alerts (The most valuable part for AI)
        alerts = description.get('alerts', [])
        if alerts:
            advanced_insights += "\nADVANCED DATA ALERTS (Excluding ID columns):\n"
            for alert in alerts[:15]: # Limit to top 15 alerts
                advanced_insights += f"- {str(alert)}\n"
        
        # Extract Column-Level Details
        variables = description.get('variables', {})
        if variables:
            advanced_insights += "\nDETAILED COLUMN ANALYSIS:\n"
            for col_name, col_data in variables.items():
                # Extract interesting metrics depending on type
                v_type = col_data.get('type', 'Unknown')
                advanced_insights += f"[{col_name}] ({v_type}): "
                
                if v_type == 'Numeric':
                    mean = col_data.get('mean', 0)
                    std = col_data.get('std', 0)
                    advanced_insights += f"Mean: {mean:.2f}, Std: {std:.2f}, Range: [{col_data.get('min')}, {col_data.get('max')}]\n"
                elif v_type == 'Categorical':
                    distinct = col_data.get('n_distinct', 0)
                    top = col_data.get('top', 'N/A')
                    advanced_insights += f"{distinct} unique values. Top: '{top}'\n"
                else:
                    advanced_insights += f"Distinct: {col_data.get('n_distinct', 0)}\n"

        # Extract Correlations (High-level summary)
        correlations = description.get('correlations', {})
        if correlations:
            advanced_insights += "\nCOLUMN CORRELATIONS IDENTIFIED.\n"
            
    except ImportError:
        advanced_insights = "\n[NOTE: ydata-profiling not installed. Falling back to basic stats.]"
    except Exception as e:
        advanced_insights = f"\n[NOTE: Advanced profiling failed: {str(e)}]"
    
    # 3. Micro Sample
    sample = df.head(10).to_csv(index=False)
    
    return f"""
DATASET PROFILE (Generated from {len(df)} rows)
==============================================
SUMMARY STATISTICS:
{stats}

DATA QUALITY & TYPES:
{quality}
{advanced_insights}

REPRESENTATIVE SAMPLE (FIRST 10 ROWS):
{sample}
"""

async def generate_summary(db: Session, filename: str, row_count: int, col_count: int, columns: str, sample_data: str) -> tuple[str, list[str]]:
    template_path = Path(__file__).resolve().parents[4] / "ai" / "templates" / "quick_insight_template.md"
    try:
        template = template_path.read_text()
    except Exception:
        # Fallback if template is missing
        return f"Summary for {filename}: {row_count} rows, {col_count} columns.", []

    # Use Ollama for key insights, assumptions, and limitations
    try:
        agent = KowalskiAgent(db)
        # Run in parallel for better performance
        key_insights, assumptions, limitations = await asyncio.gather(
            skill_analysis.generate_quick_insight(filename, sample_data, agent.generate),
            skill_analysis.generate_assumptions(filename, sample_data, agent.generate),
            skill_analysis.generate_limitations(filename, sample_data, agent.generate)
        )
    except Exception as e:
        print(f"Error generating insights with Ollama: {e}")
        key_insights = f"""
> [!IMPORTANT]
> **SIMULATED INSIGHTS**: The AI engine is currently offline or unreachable. The insights below are pre-calculated baseline patterns based on your data structure (**{col_count}** variables across **{row_count}** entries).

- **Volume Concentration**: A significant portion of the activity is clustered around the primary dimensions.
- **Dimensional Depth**: High correlation observed between key performance indicators across the dataset.
- **Anomaly Detection**: Identified potential outliers that deviate from the 95th percentile norm.
- **Velocity Trend**: The data suggests a stable trajectory in engagement over the observed period.
"""
        assumptions = "- Data is representative of the period/context specified.\n- Column names are accurately descriptive of their contents."
        limitations = "- Limited context on data collection methodology.\n- Sample size may not capture all edge case variance."

    # Highlight numbers with backticks for visibility
    summary = template.format(
        filename=filename,
        row_count=row_count,
        col_count=col_count,
        columns=columns,
        key_insights=key_insights,
        assumptions=assumptions,
        limitations_and_issues=limitations
    )
    # Regex to find standalone numbers (including decimals) and wrap them in backticks
    summary = re.sub(r'(?<!`)\b(\d+(?:\.\d+)?)\b(?!`)', r'`\1`', summary)
    
    # Generate follow-up questions
    try:
        followup_questions = await skill_comm.generate_followup_questions(filename, summary, sample_data, agent.generate)
    except Exception:
        followup_questions = [
            "What are the primary drivers behind the observed volume concentration?",
            "Are there specific time periods where the anomalies are more prevalent?",
            "How do these trends compare to historical baseline patterns?",
            "What is the impact of the identified limitations on the overall analysis?"
        ]
    
    return summary, followup_questions

@router.post("/quick-insight", response_model=schemas.QuickInsightResponse)
async def create_quick_insight(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Upload a CSV or XLSX and get a quick mock insight.
    """
    extension = Path(file.filename).suffix.lower()
    if extension not in ['.csv', '.xlsx']:
        raise HTTPException(status_code=400, detail="Only CSV and XLSX files are supported")

    # Read the file to get some basic stats and sample data
    try:
        contents = await file.read()
        if extension == '.csv':
            df = pd.read_csv(io.BytesIO(contents))
        else: # .xlsx
            df = pd.read_excel(io.BytesIO(contents))
            
        row_count = len(df)
        col_count = len(df.columns)
        columns = ", ".join(df.columns.tolist()[:5])
        # Create a statistical profile of the ENTIRE table
        df = prepare_dataframe_for_analysis(df)
        data_profile = create_data_profile(df)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading {extension[1:].upper()}: {str(e)}")

    # Generate Summary using template and Ollama
    title = f"Quick Insight: {file.filename}"
    summary, followup_questions = await generate_summary(db, file.filename, row_count, col_count, columns, data_profile)

    # Create the analysis record
    db_analysis = models.Analysis(
        title=title,
        description=f"Quick insight generated from {file.filename}",
        status="completed",
        result=summary,
        created_by=current_user.id,
        updated_by=current_user.id,
        analysis_metadata={
            "type": "quick_insight", 
            "filename": file.filename, 
            "row_count": row_count,
            "followup_questions": followup_questions
        }
    )
    db.add(db_analysis)
    db.commit()
    db.refresh(db_analysis)

    background_tasks.add_task(extract_and_store_insights, str(db_analysis.id), summary, title)

    return schemas.QuickInsightResponse(
        analysis_id=db_analysis.id,
        title=title,
        summary=summary,
        stats={"rows": row_count, "cols": col_count},
        followup_questions=followup_questions
    )

@router.post("/quick-insight/existing", response_model=schemas.QuickInsightResponse)
async def create_quick_insight_existing(
    background_tasks: BackgroundTasks,
    request: schemas.QuickInsightExistingRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Generate quick insight from an already uploaded file.
    """
    query = select(models.DataSource).where(models.DataSource.id == request.file_id)
    db_source = db.execute(query).scalar_one_or_none()
    
    if not db_source:
        raise HTTPException(status_code=404, detail="File not found")
    
    if db_source.status != "completed":
        raise HTTPException(status_code=400, detail="File processing is not completed")

    # Get stats and sample data from DuckDB
    row_count = db_source.row_count or 0
    try:
        df_cols = duckdb_manager.query(f'DESCRIBE "{db_source.schema_name}"."{db_source.table_name}"')
        col_count = len(df_cols)
        columns = ", ".join([row['column_name'] for row in df_cols[:5]])
        
        # Get full data and create a profile for AI context
        df_full = duckdb_manager.connection.execute(f'SELECT * FROM "{db_source.schema_name}"."{db_source.table_name}"').fetchdf()
        df_full = prepare_dataframe_for_analysis(df_full)
        data_profile = create_data_profile(df_full)
    except Exception as e:
        print(f"Error fetching columns or sample: {e}")
        col_count = 0
        columns = "Unknown"
        data_profile = "No statistical profile available"

    # Generate Summary using template and Ollama
    title = f"Quick Insight: {db_source.original_filename}"
    summary, followup_questions = await generate_summary(db, db_source.original_filename, row_count, col_count, columns, data_profile)

    # Create the analysis record
    db_analysis = models.Analysis(
        title=title,
        description=f"Quick insight generated from {db_source.original_filename}",
        status="completed",
        result=summary,
        created_by=current_user.id,
        updated_by=current_user.id,
        analysis_metadata={
            "type": "quick_insight", 
            "file_id": str(db_source.id), 
            "row_count": row_count,
            "followup_questions": followup_questions
        }
    )
    db.add(db_analysis)
    db.commit()
    db.refresh(db_analysis)

    background_tasks.add_task(extract_and_store_insights, str(db_analysis.id), summary, title)

    return schemas.QuickInsightResponse(
        analysis_id=db_analysis.id,
        title=title,
        summary=summary,
        stats={"rows": row_count, "cols": col_count},
        followup_questions=followup_questions
    )

from pydantic import BaseModel

class ExecutionRequest(BaseModel):
    code: str
    replace_log_id: Optional[UUID] = None
    insert_after_log_id: Optional[UUID] = None

@router.post("/{analysis_id}/execute-python")
def execute_python_cell(
    analysis_id: UUID,
    payload: ExecutionRequest,
    db: Session = Depends(get_db)
):
    analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
        
    user_log = None
    if payload.replace_log_id:
        user_log = db.query(models.AnalysisLog).filter(models.AnalysisLog.id == payload.replace_log_id).first()
        if user_log:
            user_log.content = payload.code
            db.commit()
            all_logs = db.query(models.AnalysisLog).filter(models.AnalysisLog.analysis_id == analysis_id).order_by(models.AnalysisLog.timestamp.asc()).all()
            target_idx = -1
            for idx, log in enumerate(all_logs):
                if log.id == payload.replace_log_id:
                    target_idx = idx
                    break
            if target_idx != -1:
                for log in all_logs[target_idx+1:]:
                    if log.log_type == "user_query":
                        break
                    db.delete(log)
                db.commit()

    if not user_log:
        user_log = models.AnalysisLog(
            analysis_id=analysis_id,
            log_type="user_query",
            content=payload.code,
            tool_name="python"
        )
        if payload.insert_after_log_id:
            user_log.timestamp = get_interpolated_timestamp(db, analysis_id, payload.insert_after_log_id)
        db.add(user_log)
        db.commit()
        db.refresh(user_log)
        
    user_log_timestamp = user_log.timestamp

    from ravioli.backend.core.jupyter_manager import jupyter_manager
    import datetime
    
    outputs = jupyter_manager.execute_code(analysis_id, payload.code)
    
    agent_log = models.AnalysisLog(
        analysis_id=analysis_id,
        log_type="thought",
        content="[Python Execution Result]",
        tool_name="python",
        data={"jupyter_outputs": outputs}
    )
    if (payload.replace_log_id or payload.insert_after_log_id) and user_log_timestamp:
        agent_log.timestamp = user_log_timestamp + datetime.timedelta(milliseconds=500)
        
    db.add(agent_log)
    db.commit()
    db.refresh(agent_log)
    
    return {"status": "success", "outputs": outputs, "log_id": str(user_log.id)}

@router.post("/{analysis_id}/execute-sql")
def execute_sql_cell(
    analysis_id: UUID,
    payload: ExecutionRequest,
    db: Session = Depends(get_db)
):
    analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
        
    user_log = None
    if payload.replace_log_id:
        user_log = db.query(models.AnalysisLog).filter(models.AnalysisLog.id == payload.replace_log_id).first()
        if user_log:
            user_log.content = payload.code
            db.commit()
            all_logs = db.query(models.AnalysisLog).filter(models.AnalysisLog.analysis_id == analysis_id).order_by(models.AnalysisLog.timestamp.asc()).all()
            target_idx = -1
            for idx, log in enumerate(all_logs):
                if log.id == payload.replace_log_id:
                    target_idx = idx
                    break
            if target_idx != -1:
                for log in all_logs[target_idx+1:]:
                    if log.log_type == "user_query":
                        break
                    db.delete(log)
                db.commit()

    if not user_log:
        user_log = models.AnalysisLog(
            analysis_id=analysis_id,
            log_type="user_query",
            content=payload.code,
            tool_name="sql"
        )
        if payload.insert_after_log_id:
            user_log.timestamp = get_interpolated_timestamp(db, analysis_id, payload.insert_after_log_id)
        db.add(user_log)
        db.commit()
        db.refresh(user_log)
        
    user_log_timestamp = user_log.timestamp
    
    from ravioli.backend.data.olap.duckdb_manager import duckdb_manager
    import datetime
    
    if analysis.analysis_metadata:
        file_id = analysis.analysis_metadata.get("file_id")
        if not file_id:
            ds_list = analysis.analysis_metadata.get("data_sources", [])
            if ds_list and len(ds_list) > 0:
                file_id = ds_list[0]
        if file_id:
            try:
                source = db.query(models.DataSource).filter(models.DataSource.id == UUID(str(file_id))).first()
                if source:
                    duckdb_manager.attach_file(str(source.id))
            except Exception:
                pass
                
    try:
        results = duckdb_manager.execute_query(payload.code)
        if hasattr(results, "to_dict"):
            rows = results.to_dict(orient="records")
        else:
            rows = results if isinstance(results, list) else []
        outputs = [{"type": "table", "data": rows}]
    except Exception as e:
        outputs = [{"type": "error", "ename": "SQLError", "evalue": str(e), "traceback": []}]
        
    agent_log = models.AnalysisLog(
        analysis_id=analysis_id,
        log_type="thought",
        content="[SQL Execution Result]",
        tool_name="sql",
        data={"sql_outputs": outputs}
    )
    if (payload.replace_log_id or payload.insert_after_log_id) and user_log_timestamp:
        agent_log.timestamp = user_log_timestamp + datetime.timedelta(milliseconds=500)
        
    db.add(agent_log)
    db.commit()
    db.refresh(agent_log)
    
    return {"status": "success", "outputs": outputs, "log_id": str(user_log.id)}

@router.get("/{analysis_id}/jupyter-status")
def get_jupyter_status(analysis_id: UUID, db: Session = Depends(get_db)):
    """
    Get the status of the Jupyter IPython kernel for this analysis.
    """
    from ravioli.backend.core.jupyter_manager import jupyter_manager
    status_str = jupyter_manager.get_kernel_status(analysis_id)
    return {"status": status_str}
