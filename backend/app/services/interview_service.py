import json
from typing import List, Dict
from app.services.llm_client import query_llm_structured
from app.schemas.interview import GeneratedInterview, InterviewEvaluation

async def generate_interview_questions(
    skills: List[str],
    experience_text: str,
    interview_type: str,
    difficulty: str,
    job_description: str = ""
) -> GeneratedInterview:
    """
    Generates tailored mock interview questions based on candidate profile and optional JD.
    """
    system_instruction = (
        "You are an expert interviewer specializing in assessing software developers. "
        "Your task is to generate relevant, challenging questions based on a candidate's profile."
    )

    jd_section = ""
    if job_description and job_description.strip():
        jd_section = (
            f"\n- Target Job Description:\n"
            f"{job_description.strip()[:3000]}\n\n"
            f"IMPORTANT: You MUST tailor all 5 questions specifically to the requirements, "
            f"tech stack, and responsibilities described in the job description above. "
            f"Questions should test skills that are directly relevant to this role."
        )
    
    prompt = (
        f"Generate exactly 5 interview questions for a candidate based on the following details:\n"
        f"- Interview Type: {interview_type}\n"
        f"- Difficulty Level: {difficulty}\n"
        f"- Candidate Skills: {', '.join(skills) if skills else 'Not specified'}\n"
        f"- Relevant Profile Details: {experience_text if experience_text else 'Not specified'}"
        f"{jd_section}\n\n"
        f"Generate questions that are highly professional, avoid generic questions, and focus "
        f"directly on testing practical knowledge relevant to this specific role."
    )
    
    interview_data = await query_llm_structured(
        prompt=prompt,
        response_model=GeneratedInterview,
        system_instruction=system_instruction
    )
    
    return interview_data

async def evaluate_interview(
    qa_list: List[Dict[str, str]]
) -> InterviewEvaluation:
    """
    Evaluates a completed mock interview transcript.
    """
    system_instruction = (
        "You are an expert technical recruiter and interviewer. "
        "Evaluate the candidate's answers against standard industry expectations and provide "
        "honest, constructive feedback."
    )
    
    # Format Q&A transcript for the prompt
    transcript = ""
    for idx, qa in enumerate(qa_list, 1):
        transcript += (
            f"Question {idx}: {qa.get('question')}\n"
            f"Candidate Answer {idx}: {qa.get('answer')}\n\n"
        )
        
    prompt = (
        f"Evaluate the following mock interview transcript:\n\n"
        f"{transcript}\n"
        f"You must grade each question response. For each question, score the response (0 to 100), "
        f"explain what they missed or got wrong in detail, and write a high-quality exemplar answer.\n"
        f"Create a JSON instance populated with the evaluation results, matching the schema structure."
    )
    
    evaluation = await query_llm_structured(
        prompt=prompt,
        response_model=InterviewEvaluation,
        system_instruction=system_instruction
    )
    
    return evaluation
