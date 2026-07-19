from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database.connection import get_db
from app.models.models import User, Resume, Interview, Question, Response, InterviewStatus
from app.schemas.interview import StartInterviewRequest, SubmitInterviewRequest, InterviewEvaluation, FollowUpRequest, FollowUpResponse
from app.services.interview_service import generate_interview_questions, evaluate_interview
from app.services.llm_client import query_llm_structured
from app.routers.deps import get_current_user

router = APIRouter(prefix="/interview", tags=["Interview"])

@router.post("/start", status_code=status.HTTP_201_CREATED)
async def start_interview(
    payload: StartInterviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Starts a new interview, generates questions via LLM, and stores session state.
    """
    skills = []
    experience_text = ""
    resume_db = None
    
    if payload.resume_id:
        resume_db = db.query(Resume).filter(
            Resume.id == payload.resume_id,
            Resume.user_id == current_user.id
        ).first()
        if not resume_db:
            raise HTTPException(status_code=404, detail="Resume not found.")
        skills = resume_db.extracted_skills or []
        experience_text = resume_db.parsed_raw_text[:2000]  # Grab first 2000 chars as context
        
    try:
        # Call the Interview logic engine
        ai_interview = await generate_interview_questions(
            skills=skills,
            experience_text=experience_text,
            interview_type=payload.type,
            difficulty=payload.difficulty,
            job_description=payload.job_description or ""
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")
        
    # Save session
    interview = Interview(
        user_id=current_user.id,
        resume_id=resume_db.id if resume_db else None,
        type=payload.type,
        difficulty=payload.difficulty,
        status=InterviewStatus.IN_PROGRESS
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)
    
    # Save generated questions
    for idx, q in enumerate(ai_interview.questions):
        db_question = Question(
            interview_id=interview.id,
            question_text=q.question_text,
            topic=q.topic,
            order_index=idx
        )
        db.add(db_question)
    
    db.commit()
    db.refresh(interview)
    
    return {
        "interview_id": interview.id,
        "type": interview.type,
        "difficulty": interview.difficulty,
        "status": interview.status,
        "questions": [
            {"id": q.id, "question_text": q.question_text, "topic": q.topic, "order_index": q.order_index}
            for q in interview.questions
        ]
    }

@router.post("/{interview_id}/submit", response_model=InterviewEvaluation)
async def submit_interview(
    interview_id: int,
    payload: SubmitInterviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits student responses, requests LLM evaluation, and updates DB status.
    """
    interview = db.query(Interview).filter(
        Interview.id == interview_id,
        Interview.user_id == current_user.id
    ).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview session not found.")
    if interview.status != InterviewStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="This interview has already been submitted or completed.")
        
    questions = {q.id: q for q in interview.questions}
    qa_pairs_for_ai = []
    response_objects = []
    
    for ans in payload.answers:
        if ans.question_id not in questions:
            raise HTTPException(
                status_code=400,
                detail=f"Question ID {ans.question_id} does not belong to this interview session."
            )
        q = questions[ans.question_id]
        qa_pairs_for_ai.append({
            "question": q.question_text,
            "answer": ans.answer_text
        })
        
        response_obj = Response(
            question_id=q.id,
            user_answer_text=ans.answer_text,
            wpm=ans.delivery_metadata.wpm if ans.delivery_metadata else None,
            filler_count=ans.delivery_metadata.filler_count if ans.delivery_metadata else None,
            volume_status=ans.delivery_metadata.volume_status if ans.delivery_metadata else None
        )
        response_objects.append(response_obj)
        
    try:
        evaluation = await evaluate_interview(qa_pairs_for_ai)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Evaluation failed: {str(e)}")
        
    # Build a text map to map scores to our response records
    eval_by_question = {item.question_text.strip().lower(): item for item in evaluation.detailed_feedback}
    
    for resp_obj in response_objects:
        question = questions[resp_obj.question_id]
        match_key = question.question_text.strip().lower()
        
        feedback_item = eval_by_question.get(match_key)
        # Attempt fallback matching if spelling/formatting changed slightly
        if not feedback_item:
            # Simple substring matching
            for text, item in eval_by_question.items():
                if text in match_key or match_key in text:
                    feedback_item = item
                    break
                    
        if feedback_item:
            resp_obj.ai_score = feedback_item.score
            resp_obj.ai_feedback = feedback_item.critique
            resp_obj.ideal_answer = feedback_item.ideal_answer
        else:
            resp_obj.ai_score = 0.0
            resp_obj.ai_feedback = "Could not map feedback from evaluation."
            resp_obj.ideal_answer = ""
            
        db.add(resp_obj)
        
    interview.overall_score = evaluation.overall_score
    interview.overall_feedback = evaluation.overall_feedback
    interview.status = InterviewStatus.COMPLETED
    
    db.commit()
    return evaluation

@router.get("/history")
def get_interview_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns list of all interviews taken by the current user.
    """
    interviews = db.query(Interview).filter(
        Interview.user_id == current_user.id
    ).order_by(Interview.created_at.desc()).all()
    
    return [
        {
            "id": i.id,
            "type": i.type,
            "difficulty": i.difficulty,
            "status": i.status,
            "overall_score": i.overall_score,
            "created_at": i.created_at
        }
        for i in interviews
    ]

@router.get("/{interview_id}/report")
def get_interview_report(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns a highly detailed performance report for a specific interview.
    """
    interview = db.query(Interview).filter(
        Interview.id == interview_id,
        Interview.user_id == current_user.id
    ).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview report not found.")
        
    report_questions = []
    for q in interview.questions:
        resp = q.response
        report_questions.append({
            "id": q.id,
            "question_text": q.question_text,
            "topic": q.topic,
            "user_answer": resp.user_answer_text if resp else None,
            "score": resp.ai_score if resp else None,
            "feedback": resp.ai_feedback if resp else None,
            "ideal_answer": resp.ideal_answer if resp else None,
            "wpm": resp.wpm if resp else None,
            "filler_count": resp.filler_count if resp else None,
            "volume_status": resp.volume_status if resp else None
        })
        
    return {
        "id": interview.id,
        "type": interview.type,
        "difficulty": interview.difficulty,
        "status": interview.status,
        "overall_score": interview.overall_score,
        "overall_feedback": interview.overall_feedback,
        "created_at": interview.created_at,
        "questions": report_questions
    }


@router.post("/followup", response_model=FollowUpResponse)
async def generate_followup(
    payload: FollowUpRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Generates a single contextual follow-up question based on the user's
    answer to an interview question. Mimics how real interviewers probe deeper.
    """
    system_instruction = (
        "You are a senior technical interviewer conducting a real-time interview. "
        "Based on the candidate's answer to your previous question, generate exactly ONE "
        "contextual follow-up question that probes deeper into their response. "
        "The follow-up should be relevant, insightful, and test the candidate's true depth of knowledge. "
        "Examples of good follow-ups: asking for clarification, exploring edge cases, "
        "questioning trade-offs in their approach, or asking them to elaborate on a specific point."
    )

    prompt = (
        f"Interview Type: {payload.interview_type}\n\n"
        f"Original Question: {payload.question_text}\n\n"
        f"Candidate's Answer: {payload.user_answer}\n\n"
        f"Generate a single, concise follow-up question that digs deeper into their response. "
        f"Keep it under 2 sentences. Be specific to what they said."
    )

    try:
        result = await query_llm_structured(
            prompt=prompt,
            response_model=FollowUpResponse,
            system_instruction=system_instruction
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate follow-up question: {str(e)}"
        )
