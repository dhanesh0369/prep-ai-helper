from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Float, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database.connection import Base

class InterviewStatus(str, enum.Enum):
    SETUP = "setup"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="user", cascade="all, delete-orphan")

class Resume(Base):
    __tablename__ = "resumes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String, nullable=False)
    extracted_skills = Column(JSON, nullable=True)       # list of strings
    extracted_experience = Column(JSON, nullable=True)   # list of experience dicts
    extracted_projects = Column(JSON, nullable=True)     # list of project dicts
    parsed_raw_text = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="resumes")
    interviews = relationship("Interview", back_populates="resume")

class Interview(Base):
    __tablename__ = "interviews"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    resume_id = Column(Integer, ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True)
    type = Column(String, nullable=False)  # e.g., "Technical", "Behavioral"
    difficulty = Column(String, nullable=False)
    status = Column(SQLEnum(InterviewStatus), default=InterviewStatus.SETUP)
    overall_score = Column(Float, nullable=True)
    overall_feedback = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="interviews")
    resume = relationship("Resume", back_populates="interviews")
    questions = relationship("Question", back_populates="interview", cascade="all, delete-orphan")

class Question(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    order_index = Column(Integer, nullable=False)
    
    # Relationships
    interview = relationship("Interview", back_populates="questions")
    response = relationship("Response", back_populates="question", uselist=False, cascade="all, delete-orphan")

class Response(Base):
    __tablename__ = "responses"
    
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, unique=True)
    user_answer_text = Column(String, nullable=False)
    ai_score = Column(Float, nullable=True)
    ai_feedback = Column(String, nullable=True)
    ideal_answer = Column(String, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    question = relationship("Question", back_populates="response")
