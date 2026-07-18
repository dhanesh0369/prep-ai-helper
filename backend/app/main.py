from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.routers import auth, resume, interview
from app.database.connection import engine, Base
from app.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Only auto-create tables if we are not running unit tests
    if settings.ENV != "testing":
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            print(f"Warning: Could not connect to PostgreSQL on startup: {e}")
            print("Ensure PostgreSQL is running locally or set correct DATABASE_URL in .env")
    yield

app = FastAPI(title="AI Mock Interview Platform API", lifespan=lifespan)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to the frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(resume.router, prefix="/api")
app.include_router(interview.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Welcome to the AI Mock Interview Platform API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
