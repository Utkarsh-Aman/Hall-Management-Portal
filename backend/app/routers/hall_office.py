"""
Hall office router — CSV upload and staff account management.
"""

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_role
from app.models.allowed_roll import AllowedRollNumber
from app.models.user import User, UserRole
from app.schemas.hall_office import (
    RollNumberUploadResponse,
    StaffCreateRequest,
    StaffCreateResponse,
    StaffListItem,
    StaffToggleRequest,
)
from app.services.auth_service import generate_temp_password, hash_password

router = APIRouter(prefix="/hall-office", tags=["hall-office"])


# ---------------------------------------------------------------------------
# CSV upload — replace mode
# ---------------------------------------------------------------------------

@router.post(
    "/roll-numbers/upload",
    response_model=RollNumberUploadResponse,
)
def upload_roll_numbers(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("hall_office")),
    db: Session = Depends(get_db),
):
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a .csv file.",
        )

    # Validate file size (max 1MB)
    content = file.file.read()
    if len(content) > 1_048_576:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 1MB.",
        )

    # Parse CSV
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is not valid UTF-8 text.",
        )

    reader = csv.reader(io.StringIO(text))
    roll_numbers: list[str] = []

    for row_idx, row in enumerate(reader):
        # Skip empty rows
        if not row or all(cell.strip() == "" for cell in row):
            continue

        # Take the first non-empty cell in each row as the roll number
        roll_no = row[0].strip()
        if roll_no:
            roll_numbers.append(roll_no)

    if not roll_numbers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file contains no valid roll numbers.",
        )

    # Remove duplicates while preserving order
    seen = set()
    unique_rolls = []
    for rn in roll_numbers:
        if rn not in seen:
            seen.add(rn)
            unique_rolls.append(rn)

    # Replace mode: delete all existing, insert new
    db.query(AllowedRollNumber).delete()

    for roll_no in unique_rolls:
        db.add(
            AllowedRollNumber(
                roll_no=roll_no,
                uploaded_by=current_user.id,
            )
        )

    db.commit()

    return RollNumberUploadResponse(
        count=len(unique_rolls),
        message=f"{len(unique_rolls)} roll numbers uploaded (replaced existing list).",
    )


# ---------------------------------------------------------------------------
# Create staff account
# ---------------------------------------------------------------------------

@router.post("/staff", response_model=StaffCreateResponse)
def create_staff_account(
    body: StaffCreateRequest,
    current_user: User = Depends(require_role("hall_office")),
    db: Session = Depends(get_db),
):
    role = UserRole(body.role)

    # Generate a sequential staff ID based on role prefix
    prefix = "MS" if role == UserRole.mess_staff else "MW"
    existing_count = (
        db.query(User).filter(User.role == role).count()
    )
    staff_id = f"{prefix}-{existing_count + 1:03d}"

    # Ensure uniqueness
    while db.query(User).filter(User.identifier == staff_id).first():
        existing_count += 1
        staff_id = f"{prefix}-{existing_count + 1:03d}"

    # Generate temporary password
    temp_password = generate_temp_password()

    user = User(
        identifier=staff_id,
        email=None,
        password_hash=hash_password(temp_password),
        role=role,
        name=body.name,
        is_active=True,
        password_set=True,
        must_change_password=True,
        created_by=current_user.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return StaffCreateResponse(
        id=user.id,
        identifier=staff_id,
        name=user.name,
        role=user.role.value,
        temp_password=temp_password,
    )


# ---------------------------------------------------------------------------
# List staff accounts
# ---------------------------------------------------------------------------

@router.get("/staff", response_model=list[StaffListItem])
def list_staff(
    current_user: User = Depends(require_role("hall_office")),
    db: Session = Depends(get_db),
):
    staff = (
        db.query(User)
        .filter(User.role.in_([UserRole.mess_staff, UserRole.mess_worker]))
        .order_by(User.created_at.desc())
        .all()
    )
    return staff


# ---------------------------------------------------------------------------
# Toggle staff active/inactive
# ---------------------------------------------------------------------------

@router.patch("/staff/{user_id}")
def toggle_staff_status(
    user_id: int,
    body: StaffToggleRequest,
    current_user: User = Depends(require_role("hall_office")),
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.role.in_([UserRole.mess_staff, UserRole.mess_worker]),
        )
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff account not found.",
        )

    user.is_active = body.is_active
    db.commit()

    return {"message": f"Account {'activated' if body.is_active else 'deactivated'}."}
