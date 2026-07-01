"""
Tests for auth endpoints: signup flow, login, rate limiting, token refresh.
"""

import pytest
from app.models.user import User, UserRole
from app.models.allowed_roll import AllowedRollNumber
from app.services.auth_service import hash_password


class TestSignupFlow:
    """Test the 3-step student signup: request OTP → verify → set password."""

    def test_request_otp_roll_not_allowed(self, client):
        """Reject signup if roll number not in allowed list."""
        resp = client.post("/auth/signup/request-otp", json={
            "email": "test@iitk.ac.in",
            "roll_no": "999999",
        })
        assert resp.status_code == 403
        assert "roll number" in resp.json()["detail"].lower()

    def test_request_otp_wrong_domain(self, client):
        """Reject if email doesn't end with @iitk.ac.in."""
        resp = client.post("/auth/signup/request-otp", json={
            "email": "test@gmail.com",
            "roll_no": "230001",
        })
        assert resp.status_code == 400
        assert "iitk.ac.in" in resp.json()["detail"]

    def test_request_otp_success(self, client, db):
        """Happy path: allowed roll number, valid email → OTP sent."""
        # Seed allowed roll number
        db.add(AllowedRollNumber(roll_no="230001", uploaded_by=1))
        db.commit()

        resp = client.post("/auth/signup/request-otp", json={
            "email": "230001@iitk.ac.in",
            "roll_no": "230001",
        })
        assert resp.status_code == 200
        assert resp.json()["message"] == "OTP sent to your email."

    def test_duplicate_signup_rejected(self, client, db):
        """If user already has a password set, reject."""
        db.add(AllowedRollNumber(roll_no="230002", uploaded_by=1))
        db.add(User(
            identifier="230002@iitk.ac.in",
            email="230002@iitk.ac.in",
            password_hash=hash_password("Existing123!"),
            role=UserRole.student,
            name="230002",
            is_active=True,
            password_set=True,
        ))
        db.commit()

        resp = client.post("/auth/signup/request-otp", json={
            "email": "230002@iitk.ac.in",
            "roll_no": "230002",
        })
        assert resp.status_code == 409


class TestLogin:
    """Test login for various roles."""

    def test_login_success(self, client, db):
        """Correct credentials should return access token."""
        db.add(User(
            identifier="admin@hall12",
            email="admin@hall12.iitk.ac.in",
            password_hash=hash_password("TestPass123!"),
            role=UserRole.hall_office,
            name="Admin",
            is_active=True,
            password_set=True,
            must_change_password=False,
        ))
        db.commit()

        resp = client.post("/auth/login", json={
            "identifier": "admin@hall12",
            "password": "TestPass123!",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["role"] == "hall_office"

    def test_login_wrong_password(self, client, db):
        """Wrong password should return 401."""
        db.add(User(
            identifier="admin@hall12",
            email="admin@hall12.iitk.ac.in",
            password_hash=hash_password("CorrectPass123!"),
            role=UserRole.hall_office,
            name="Admin",
            is_active=True,
            password_set=True,
        ))
        db.commit()

        resp = client.post("/auth/login", json={
            "identifier": "admin@hall12",
            "password": "WrongPass123!",
        })
        assert resp.status_code == 401

    def test_login_deactivated_account(self, client, db):
        """Deactivated accounts should return 403."""
        db.add(User(
            identifier="deactivated@hall12",
            password_hash=hash_password("TestPass123!"),
            role=UserRole.mess_staff,
            name="Staff",
            is_active=False,
            password_set=True,
        ))
        db.commit()

        resp = client.post("/auth/login", json={
            "identifier": "deactivated@hall12",
            "password": "TestPass123!",
        })
        assert resp.status_code == 403

    def test_login_must_change_password(self, client, db):
        """Staff with must_change_password should get change_token instead of access_token."""
        db.add(User(
            identifier="MS-001",
            password_hash=hash_password("TempPass123!"),
            role=UserRole.mess_staff,
            name="Staff",
            is_active=True,
            password_set=True,
            must_change_password=True,
        ))
        db.commit()

        resp = client.post("/auth/login", json={
            "identifier": "MS-001",
            "password": "TempPass123!",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["must_change_password"] is True
        assert "change_token" in data


class TestLogout:
    def test_logout(self, client):
        resp = client.post("/auth/logout")
        assert resp.status_code == 200
