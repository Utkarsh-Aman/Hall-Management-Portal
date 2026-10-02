from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.models.user import User, UserRole
from app.models.wastage import WastageLog
from app.services.auth_service import create_access_token, hash_password


def _user(db, identifier: str, role: UserRole) -> User:
    user = User(
        identifier=identifier,
        email=identifier if "@" in identifier else None,
        password_hash=hash_password("TestPass123!"),
        role=role,
        name=identifier,
        is_active=True,
        password_set=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role.value)}"}


def test_wastage_accepts_only_today_and_non_negative_values(client, db):
    staff = _user(db, "MS-WASTE", UserRole.mess_staff)
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    payload = {
        "date": today.isoformat(),
        "bdmr": 92.5,
        "plain_wastage": 8.25,
        "plate_wastage": 4.75,
    }

    created = client.post("/staff/wastage", json=payload, headers=_headers(staff))
    assert created.status_code == 200
    assert created.json()["bdmr"] == 92.5

    payload["bdmr"] = 95.0
    updated = client.post("/staff/wastage", json=payload, headers=_headers(staff))
    assert updated.status_code == 200
    assert updated.json()["bdmr"] == 95.0
    assert db.query(WastageLog).count() == 1

    payload["date"] = (today - timedelta(days=1)).isoformat()
    historical = client.post("/staff/wastage", json=payload, headers=_headers(staff))
    assert historical.status_code == 400

    payload["date"] = (today + timedelta(days=1)).isoformat()
    future = client.post("/staff/wastage", json=payload, headers=_headers(staff))
    assert future.status_code == 400

    payload["date"] = today.isoformat()
    payload["plain_wastage"] = -1
    negative = client.post("/staff/wastage", json=payload, headers=_headers(staff))
    assert negative.status_code == 422


def test_dashboard_uses_calendar_window_and_latest_update(client, db):
    staff = _user(db, "MS-WASTE", UserRole.mess_staff)
    student = _user(db, "230099@iitk.ac.in", UserRole.student)
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    old_update = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=2)
    newest_update = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)

    db.add_all([
        WastageLog(
            date=today,
            bdmr=90,
            plain_wastage=7,
            plate_wastage=3,
            entered_by=staff.id,
            entered_at=old_update,
        ),
        WastageLog(
            date=today - timedelta(days=3),
            bdmr=120,
            plain_wastage=9,
            plate_wastage=5,
            entered_by=staff.id,
            entered_at=newest_update,
        ),
        WastageLog(
            date=today - timedelta(days=7),
            bdmr=999,
            plain_wastage=99,
            plate_wastage=99,
            entered_by=staff.id,
            entered_at=old_update - timedelta(days=1),
        ),
    ])
    db.commit()

    response = client.get("/dashboard/summary", headers=_headers(student))
    assert response.status_code == 200
    summary = response.json()
    assert summary["avg_bdmr"] == 105.0
    assert summary["plain_wastage"] == 7
    assert summary["plate_wastage"] == 3
    assert summary["wastage_date"] == today.isoformat()
    assert datetime.fromisoformat(summary["last_updated"]) == newest_update
