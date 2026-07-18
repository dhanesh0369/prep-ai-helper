import os
from dotenv import load_dotenv

# Load variables from .env file if it exists
load_dotenv()

class Settings:
    ENV: str = os.getenv("ENV", "development")
    
    # AI Config
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    
    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-key-change-me-in-production-12345!")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # Default 24 hrs
    
    # Database (PostgreSQL URL)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:postgres@localhost:5432/interview_helper"
    )

settings = Settings()
