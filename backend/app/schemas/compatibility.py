from pydantic import BaseModel, Field
from typing import List

class CompatibilityRequest(BaseModel):
    resume_text: str = Field(description="Raw text extracted from the resume")
    job_description: str = Field(description="The job description to match against")

class CompatibilityResult(BaseModel):
    score: int = Field(description="Overall compatibility score from 0 to 100")
    summary: str = Field(description="A concise 2-3 sentence summary of how well the resume matches the JD")
    matched_skills: List[str] = Field(description="Skills and qualifications found in both the resume and JD")
    missing_skills: List[str] = Field(description="Key skills or qualifications required by the JD but absent from the resume")
    suggestions: List[str] = Field(description="Specific, actionable suggestions to improve the resume for this JD")
