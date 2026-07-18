from unittest.mock import patch
from app.schemas.resume import ResumeParsedData

def test_upload_resume_invalid_format(client):
    client.post(
        "/api/auth/register",
        json={"email": "res@example.com", "name": "Resume User", "password": "mypassword"}
    )
    login_resp = client.post(
        "/api/auth/login",
        data={"username": "res@example.com", "password": "mypassword"}
    )
    token = login_resp.json()["access_token"]

    response = client.post(
        "/api/resume/upload",
        files={"file": ("resume.txt", b"some text", "text/plain")},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Only PDF files are supported."

@patch("app.routers.resume.parse_and_extract_resume")
@patch("app.routers.resume.extract_text_from_pdf")
def test_upload_resume_success(mock_extract_text, mock_parse_extract, client):
    client.post(
        "/api/auth/register",
        json={"email": "res2@example.com", "name": "Resume User 2", "password": "mypassword"}
    )
    login_resp = client.post(
        "/api/auth/login",
        data={"username": "res2@example.com", "password": "mypassword"}
    )
    token = login_resp.json()["access_token"]

    mock_extract_text.return_value = "Extracted resume content"
    mock_parse_extract.return_value = ResumeParsedData(
        skills=["Python", "React"],
        projects=[{"title": "Test Proj", "description": "Desc"}],
        experience=[{"company": "Comp", "role": "Dev", "duration": "1yr", "responsibilities": ["code"]}],
        education=[{"institution": "Test College", "degree": "B.S. CS"}]
    )

    response = client.post(
        "/api/resume/upload",
        files={"file": ("resume.pdf", b"%PDF-1.4 ...", "application/pdf")},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "skills" in data
    assert "Python" in data["skills"]
    assert "React" in data["skills"]
