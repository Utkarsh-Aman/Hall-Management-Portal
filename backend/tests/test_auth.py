"""
Tests for auth endpoints: signup flow, login, rate limiting, token refresh.
"""

import pytest
from app.models.user import User, UserRole
from app.models.allowed_roll import AllowedRollNumber
from app.services.auth_service import hash_password


class TestSetupFlow:
    """Test setup-code based student onboarding."""

    def test_setup_roll_not_allowed(self, client):
        resp = client.post("/auth/setup/verify", json={
            "roll_no": "999999",
            "setup_code": "ABCDEFGH",
        })
        assert resp.status_code == 404

    def test_setup_invalid_code(self, client, db):
        db.add(AllowedRollNumber(
            roll_no="230001",
            email="230001@iitk.ac.in",
            setup_code="ABCDEFGH",
            uploaded_by=1,
        ))
        db.commit()

        resp = client.post("/auth/setup/verify", json={
            "roll_no": "230001",
            "setup_code": "ZZZZZZZZ",
        })
        assert resp.status_code == 400

    def test_setup_verify_success(self, client, db):
        db.add(AllowedRollNumber(
            roll_no="230002",
            name="Student",
            email="230002@iitk.ac.in",
            room_number="A-101",
            setup_code="ABCDEFGH",
            uploaded_by=1,
        ))
        db.commit()

        resp = client.post("/auth/setup/verify", json={
            "roll_no": "230002",
            "setup_code": "ABCDEFGH",
        })
        assert resp.status_code == 200
        assert resp.json()["email"] == "230002@iitk.ac.in"

    def test_duplicate_setup_rejected(self, client, db):
        db.add(AllowedRollNumber(
            roll_no="230003",
            email="230003@iitk.ac.in",
            setup_code="ABCDEFGH",
            uploaded_by=1,
        ))
        db.add(User(
            identifier="230003@iitk.ac.in",
            email="230003@iitk.ac.in",
            password_hash=hash_password("Existing123!"),
            role=UserRole.student,
            name="230003",
            roll_no="230003",
            is_active=True,
            password_set=True,
        ))
        db.commit()

        resp = client.post("/auth/setup/verify", json={
            "roll_no": "230003",
            "setup_code": "ABCDEFGH",
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
