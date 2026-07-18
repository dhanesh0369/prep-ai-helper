from unittest.mock import patch
from app.schemas.interview import GeneratedInterview, InterviewEvaluation

@patch("app.routers.interview.generate_interview_questions")
def test_start_interview(mock_generate, client):
    client.post(
        "/api/auth/register",
        json={"email": "int@example.com", "name": "Int User", "password": "mypassword"}
    )
    login_resp = client.post(
        "/api/auth/login",
        data={"username": "int@example.com", "password": "mypassword"}
    )
    token = login_resp.json()["access_token"]

    mock_generate.return_value = GeneratedInterview(
        questions=[
            {"question_text": "Q1", "topic": "React"},
            {"question_text": "Q2", "topic": "Python"},
            {"question_text": "Q3", "topic": "DB"},
            {"question_text": "Q4", "topic": "HR"},
            {"question_text": "Q5", "topic": "DSA"}
        ]
    )

    response = client.post(
        "/api/interview/start",
        json={"type": "Technical", "difficulty": "Medium"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 201
    data = response.json()
    assert "interview_id" in data
    assert len(data["questions"]) == 5
    assert data["questions"][0]["question_text"] == "Q1"

@patch("app.routers.interview.evaluate_interview")
@patch("app.routers.interview.generate_interview_questions")
def test_submit_interview(mock_generate, mock_evaluate, client):
    client.post(
        "/api/auth/register",
        json={"email": "int2@example.com", "name": "Int User 2", "password": "mypassword"}
    )
    login_resp = client.post(
        "/api/auth/login",
        data={"username": "int2@example.com", "password": "mypassword"}
    )
    token = login_resp.json()["access_token"]

    mock_generate.return_value = GeneratedInterview(
        questions=[
            {"question_text": "Q1", "topic": "React"},
            {"question_text": "Q2", "topic": "Python"},
            {"question_text": "Q3", "topic": "DB"},
            {"question_text": "Q4", "topic": "HR"},
            {"question_text": "Q5", "topic": "DSA"}
        ]
    )

    start_resp = client.post(
        "/api/interview/start",
        json={"type": "Technical", "difficulty": "Medium"},
        headers={"Authorization": f"Bearer {token}"}
    )
    interview_id = start_resp.json()["interview_id"]
    questions = start_resp.json()["questions"]

    mock_evaluate.return_value = InterviewEvaluation(
        overall_score=85.0,
        overall_feedback="Good work",
        detailed_feedback=[
            {
                "question_text": "Q1",
                "user_answer": "ans1",
                "score": 90.0,
                "critique": "great",
                "ideal_answer": "perfect"
            },
            {
                "question_text": "Q2",
                "user_answer": "ans2",
                "score": 80.0,
                "critique": "good",
                "ideal_answer": "standard"
            },
            {
                "question_text": "Q3",
                "user_answer": "ans3",
                "score": 85.0,
                "critique": "okay",
                "ideal_answer": "better"
            },
            {
                "question_text": "Q4",
                "user_answer": "ans4",
                "score": 85.0,
                "critique": "okay",
                "ideal_answer": "better"
            },
            {
                "question_text": "Q5",
                "user_answer": "ans5",
                "score": 85.0,
                "critique": "okay",
                "ideal_answer": "better"
            }
        ]
    )

    answers_payload = {
        "answers": [
            {"question_id": q["id"], "answer_text": f"ans{idx+1}"}
            for idx, q in enumerate(questions)
        ]
    }
    
    submit_resp = client.post(
        f"/api/interview/{interview_id}/submit",
        json=answers_payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert submit_resp.status_code == 200
    data = submit_resp.json()
    assert data["overall_score"] == 85.0
