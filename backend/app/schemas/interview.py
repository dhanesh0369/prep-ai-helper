from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Any

class GeneratedQuestion(BaseModel):
    question_text: str = Field(description="The interview question text itself.")
    topic: str = Field(description="The primary topic area (e.g. 'React', 'Database Design', 'Python', 'Behavioral').")

    @model_validator(mode='before')
    @classmethod
    def handle_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Map 'question' or 'q' to 'question_text' if needed
            if "q" in data and "question_text" not in data:
                data["question_text"] = data["q"]
            elif "question" in data and "question_text" not in data:
                data["question_text"] = data["question"]
            if "topic" not in data or not data["topic"]:
                data["topic"] = "General"
        return data

class GeneratedInterview(BaseModel):
    questions: List[GeneratedQuestion] = Field(description="List of exactly 5 generated interview questions.")

    @model_validator(mode='before')
    @classmethod
    def clean_interview_data(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # 1. If Ollama nested it under a "data" attribute
            if "data" in data and isinstance(data["data"], dict):
                inner_data = data["data"]
                if "questions" in inner_data:
                    data["questions"] = inner_data["questions"]
            
            # 2. Extract and flatten the questions array
            if "questions" in data:
                raw_qs = data["questions"]
                
                # If Ollama nested it as a list of lists (e.g. [[{"q": "..."}]])
                if isinstance(raw_qs, list):
                    flat_qs = []
                    for item in raw_qs:
                        if isinstance(item, list):
                            for inner_item in item:
                                if isinstance(inner_item, dict):
                                    q_text = inner_item.get("q") or inner_item.get("question") or inner_item.get("question_text")
                                    topic = inner_item.get("topic") or "General"
                                    if q_text:
                                        flat_qs.append({"question_text": str(q_text), "topic": str(topic)})
                        elif isinstance(item, dict):
                            q_text = item.get("q") or item.get("question") or item.get("question_text")
                            topic = item.get("topic") or "General"
                            if q_text:
                                flat_qs.append({"question_text": str(q_text), "topic": str(topic)})
                    
                    data["questions"] = flat_qs
        return data

class QuestionFeedback(BaseModel):
    question_text: str = Field(description="The question that was asked.")
    user_answer: str = Field(description="The answer given by the user.")
    score: float = Field(description="Score from 0 to 100 for this answer.")
    critique: str = Field(description="Constructive critique detailing missing concepts or mistakes.")
    ideal_answer: str = Field(description="An exemplar/ideal response to demonstrate how to improve.")

    @model_validator(mode='before')
    @classmethod
    def handle_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Map common key variants
            if "question" in data and "question_text" not in data:
                data["question_text"] = data["question"]
            if "answer" in data and "user_answer" not in data:
                data["user_answer"] = data["answer"]
            elif "user_response" in data and "user_answer" not in data:
                data["user_answer"] = data["user_response"]
            elif "response" in data and "user_answer" not in data:
                data["user_answer"] = data["response"]
        return data

class InterviewEvaluation(BaseModel):
    overall_score: float = Field(description="Weighted overall score from 0 to 100 for the entire interview.")
    overall_feedback: str = Field(description="A high-level summary of strengths and areas for improvement.")
    detailed_feedback: List[QuestionFeedback] = Field(description="List of evaluations for each individual question response.")

# API Request/Response Schemas
class StartInterviewRequest(BaseModel):
    resume_id: Optional[int] = None
    type: str = Field("Technical", description="HR, Technical, Behavioral, etc.")
    difficulty: str = Field("Medium", description="Easy, Medium, Hard")
    job_description: Optional[str] = Field(None, description="Optional job description to target questions to a specific role")

class DeliveryMetadata(BaseModel):
    wpm: Optional[int] = None
    filler_count: Optional[int] = None
    volume_status: Optional[str] = None

class SubmitAnswerItem(BaseModel):
    question_id: int
    answer_text: str
    delivery_metadata: Optional[DeliveryMetadata] = None

class SubmitInterviewRequest(BaseModel):
    answers: List[SubmitAnswerItem]

class FollowUpRequest(BaseModel):
    question_text: str = Field(description="The original interview question that was asked")
    user_answer: str = Field(description="The user's response to the original question")
    interview_type: str = Field("Technical", description="The type of interview (Technical, Behavioral, etc.)")

class FollowUpResponse(BaseModel):
    follow_up_question: str = Field(description="A contextual follow-up question based on the user's answer")

