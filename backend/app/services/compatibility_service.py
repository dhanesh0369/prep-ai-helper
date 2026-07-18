from app.services.llm_client import query_llm_structured
from app.schemas.compatibility import CompatibilityResult

async def analyze_resume_compatibility(
    resume_text: str,
    job_description: str
) -> CompatibilityResult:
    """
    Analyzes how well a resume matches a given job description using AI.
    Returns a compatibility score, matched/missing skills, and improvement suggestions.
    """
    system_instruction = (
        "You are an expert ATS (Applicant Tracking System) analyst and career coach. "
        "Your job is to objectively evaluate how well a candidate's resume matches a job description "
        "and provide specific, actionable feedback to help them improve their application."
    )

    prompt = (
        f"Analyze the compatibility between the following resume and job description.\n\n"
        f"=== RESUME ===\n{resume_text[:4000]}\n\n"
        f"=== JOB DESCRIPTION ===\n{job_description[:3000]}\n\n"
        f"Evaluate the match and provide:\n"
        f"1. An overall compatibility score (0-100) based on skill match, experience relevance, and keyword alignment\n"
        f"2. A concise 2-3 sentence summary of the overall match quality\n"
        f"3. A list of skills/qualifications present in BOTH the resume and JD (matched_skills)\n"
        f"4. A list of important skills/qualifications required by the JD but MISSING from the resume (missing_skills)\n"
        f"5. At least 4 specific, actionable suggestions to improve the resume for this specific role (suggestions)\n\n"
        f"Be honest and specific. Focus on technical skills, experience levels, domain knowledge, and keywords."
    )

    result = await query_llm_structured(
        prompt=prompt,
        response_model=CompatibilityResult,
        system_instruction=system_instruction
    )

    return result
