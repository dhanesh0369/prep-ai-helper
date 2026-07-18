from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.models import User, Resume as DbResume
from app.schemas.resume import ResumeParsedData
from app.schemas.compatibility import CompatibilityRequest, CompatibilityResult
from app.services.resume_service import parse_and_extract_resume
from app.services.compatibility_service import analyze_resume_compatibility
from app.routers.deps import get_current_user
from app.services.pdf_parser import extract_text_from_pdf

router = APIRouter(prefix="/resume", tags=["Resume"])

@router.post("/upload", response_model=ResumeParsedData)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint to upload, parse, and save a PDF resume associated with the logged-in user.
    """
    if file.content_type != "application/pdf" and not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    try:
        file_bytes = await file.read()
        
        # 1. Parse and extract structure using the LLM resume service
        parsed_data = await parse_and_extract_resume(file_bytes)
        
        # 2. Save structural representation to Postgres/SQLite database
        db_resume = DbResume(
            user_id=current_user.id,
            file_path=file.filename,
            extracted_skills=parsed_data.skills,
            extracted_experience=[e.model_dump() for e in parsed_data.experience],
            extracted_projects=[p.model_dump() for p in parsed_data.projects],
            parsed_raw_text=extract_text_from_pdf(file_bytes)
        )
        
        db.add(db_resume)
        db.commit()
        db.refresh(db_resume)
        
        return parsed_data
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed parsing resume: {str(e)}")


@router.post("/compatibility", response_model=CompatibilityResult)
async def check_compatibility(
    file: UploadFile = File(...),
    job_description: str = Form(""),
    jd_file: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads a resume PDF and either a JD text string or a JD PDF file.
    Returns a compatibility score and actionable improvement suggestions.
    """
    if file.content_type != "application/pdf" and not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported for the resume.")

    try:
        # Extract resume text
        file_bytes = await file.read()
        resume_text = extract_text_from_pdf(file_bytes)
        if not resume_text or len(resume_text.strip()) < 50:
            raise HTTPException(status_code=400, detail="Could not extract enough text from the resume PDF.")

        # Resolve JD text — prefer uploaded PDF if provided
        jd_text = ""
        if jd_file and jd_file.filename:
            if not jd_file.filename.endswith(".pdf"):
                raise HTTPException(status_code=400, detail="Job description file must be a PDF.")
            jd_bytes = await jd_file.read()
            jd_text = extract_text_from_pdf(jd_bytes)
            if not jd_text or len(jd_text.strip()) < 30:
                raise HTTPException(status_code=400, detail="Could not extract text from the job description PDF.")
        elif job_description and job_description.strip():
            jd_text = job_description.strip()
        else:
            raise HTTPException(status_code=400, detail="Please provide a job description — either paste the text or upload a PDF.")

        result = await analyze_resume_compatibility(
            resume_text=resume_text,
            job_description=jd_text
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compatibility analysis failed: {str(e)}")

