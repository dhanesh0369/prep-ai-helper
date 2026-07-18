def test_register_user(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "test@example.com", "name": "Test User", "password": "securepassword"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test User"
    assert "id" in data

def test_register_duplicate_email(client):
    client.post(
        "/api/auth/register",
        json={"email": "duplicate@example.com", "name": "First User", "password": "password"}
    )
    response = client.post(
        "/api/auth/register",
        json={"email": "duplicate@example.com", "name": "Second User", "password": "password"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "A user with this email is already registered."

def test_login_success(client):
    client.post(
        "/api/auth/register",
        json={"email": "user@example.com", "name": "Login User", "password": "validpassword"}
    )
    response = client.post(
        "/api/auth/login",
        data={"username": "user@example.com", "password": "validpassword"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_incorrect_password(client):
    client.post(
        "/api/auth/register",
        json={"email": "user@example.com", "name": "Login User", "password": "validpassword"}
    )
    response = client.post(
        "/api/auth/login",
        data={"username": "user@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"

def test_get_me_protected(client):
    client.post(
        "/api/auth/register",
        json={"email": "me@example.com", "name": "Me User", "password": "mypassword"}
    )
    login_resp = client.post(
        "/api/auth/login",
        data={"username": "me@example.com", "password": "mypassword"}
    )
    token = login_resp.json()["access_token"]
    
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@example.com"
    assert data["name"] == "Me User"

def test_get_me_unauthorized(client):
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalidtoken"}
    )
    assert response.status_code == 401
