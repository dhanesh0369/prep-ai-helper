import os
# Force testing environment configurations before importing application modules
os.environ["ENV"] = "testing"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from app.database.connection import Base, get_db, engine
from app.models.models import User, Resume, Interview, Question, Response
from app.main import app

@pytest.fixture(scope="function")
def db_session():
    # Setup tables on the test engine (which is forced to SQLite in-memory)
    Base.metadata.create_all(bind=engine)
    from app.database.connection import SessionLocal
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
