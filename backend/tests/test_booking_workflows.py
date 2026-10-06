from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.config import settings
from app.models.extras import BookingStatus, ExtrasBooking, ExtrasItem, MealType
from app.models.user import User, UserRole
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


def _item(db, creator: User, opens_at: datetime, closes_at: datetime) -> ExtrasItem:
    item = ExtrasItem(
        name="Special Thali",
        price=Decimal("50.00"),
        date=datetime.now(ZoneInfo("Asia/Kolkata")).date(),
        meal_type=MealType.lunch,
        opens_at=opens_at,
        closes_at=closes_at,
        prep_time_mins=120,
        is_active=True,
        is_recurring=False,
        created_by=creator.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def test_booking_window_and_duplicate_are_enforced(client, db, monkeypatch):
    monkeypatch.setattr(settings, "QR_SCANNING_ENABLED", True)
    staff = _user(db, "MS-001", UserRole.mess_staff)
    student = _user(db, "230001@iitk.ac.in", UserRole.student)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    future_item = _item(db, staff, now + timedelta(hours=1), now + timedelta(hours=2))

    response = client.post(
        "/bookings", json={"item_id": future_item.id, "qty": 1}, headers=_headers(student)
    )
    assert response.status_code == 400
    assert "not opened" in response.json()["detail"]

    open_item = _item(db, staff, now - timedelta(hours=1), now + timedelta(hours=1))
    response = client.post(
        "/bookings", json={"item_id": open_item.id, "qty": 1}, headers=_headers(student)
    )
    assert response.status_code == 201

    qr_response = client.get(
        f"/bookings/{response.json()['id']}/qr", headers=_headers(student)
    )
    assert qr_response.status_code == 200
    assert qr_response.headers["content-type"] == "image/png"
    assert qr_response.content.startswith(b"\x89PNG")

    duplicate = client.post(
        "/bookings", json={"item_id": open_item.id, "qty": 1}, headers=_headers(student)
    )
    assert duplicate.status_code == 409


def test_cancel_request_can_be_approved(client, db):
    staff = _user(db, "MS-001", UserRole.mess_staff)
    student = _user(db, "230001@iitk.ac.in", UserRole.student)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    item = _item(db, staff, now - timedelta(hours=2), now - timedelta(hours=1))
    booking = ExtrasBooking(
        student_id=student.id,
        item_id=item.id,
        qty=1,
        total_price=item.price,
        status=BookingStatus.booked,
        qr_token="cancel-request-token",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    response = client.post(
        f"/bookings/{booking.id}/request-cancel", headers=_headers(student)
    )
    assert response.status_code == 200

    response = client.post(
        f"/staff/bookings/{booking.id}/cancel-request/approve", headers=_headers(staff)
    )
    assert response.status_code == 200
    db.refresh(booking)
    assert booking.status == BookingStatus.cancelled


def test_worker_queue_uses_service_date(client, db, monkeypatch):
    monkeypatch.setattr(settings, "QR_SCANNING_ENABLED", True)
    staff = _user(db, "MS-001", UserRole.mess_staff)
    student = _user(db, "230001@iitk.ac.in", UserRole.student)
    worker = _user(db, "MW-001", UserRole.mess_worker)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    item = _item(db, staff, now - timedelta(hours=1), now + timedelta(hours=1))
    booking = ExtrasBooking(
        student_id=student.id,
        item_id=item.id,
        qty=2,
        total_price=item.price * 2,
        status=BookingStatus.booked,
        qr_token="today-service-token",
        booked_at=now - timedelta(days=1),
    )
    db.add(booking)
    db.commit()

    response = client.get("/worker/bookings/today", headers=_headers(worker))
    assert response.status_code == 200
    assert [entry["qr_token"] for entry in response.json()] == ["today-service-token"]

    first_scan = client.post(
        "/worker/scan", json={"qr_token": "today-service-token"}, headers=_headers(worker)
    )
    assert first_scan.status_code == 200
    assert first_scan.json()["booking_id"] == booking.id

    second_scan = client.post(
        "/worker/scan", json={"qr_token": "today-service-token"}, headers=_headers(worker)
    )
    assert second_scan.status_code == 200
    assert second_scan.json()["already_served"] is True


def test_qr_scanning_can_be_disabled(client, db, monkeypatch):
    monkeypatch.setattr(settings, "QR_SCANNING_ENABLED", False)
    worker = _user(db, "MW-001", UserRole.mess_worker)

    response = client.post(
        "/worker/scan",
        json={"qr_token": "any-token"},
        headers=_headers(worker),
    )

    assert response.status_code == 503
    assert "temporarily disabled" in response.json()["detail"]
