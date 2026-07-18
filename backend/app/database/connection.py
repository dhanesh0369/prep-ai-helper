from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.config import settings

db_url = settings.DATABASE_URL
# SQLAlchemy 1.4+ requires 'postgresql://' instead of 'postgres://' which is common on Heroku/Render
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Dynamic fallback configuration for SQLite (used during unit testing)
connect_args = {}
extra_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    extra_args = {"poolclass": StaticPool}

engine = create_engine(db_url, connect_args=connect_args, **extra_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get DB session in FastAPI route handlers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
