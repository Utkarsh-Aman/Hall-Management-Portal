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
    AllowedRollCreate,
    AllowedRollResponse,
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
    parsed_rows = []
    for row_idx, row in enumerate(reader):
        if not row or all(cell.strip() == "" for cell in row):
            continue

        roll_no = row[0].strip() if len(row) > 0 else None
        if not roll_no:
            continue

        name = row[1].strip() if len(row) > 1 and row[1].strip() else None
        email = row[2].strip() if len(row) > 2 and row[2].strip() else None
        room_number = row[3].strip() if len(row) > 3 and row[3].strip() else None

        parsed_rows.append({
            "roll_no": roll_no,
            "name": name,
            "email": email,
            "room_number": room_number
        })

    if not parsed_rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file contains no valid roll numbers.",
        )

    # Remove duplicates by roll_no
    seen = set()
    unique_rolls = []
    for row in parsed_rows:
        rn = row["roll_no"]
        if rn not in seen:
            seen.add(rn)
            unique_rolls.append(row)

    # Replace mode: delete all existing, insert new
    db.query(AllowedRollNumber).delete()

    for row in unique_rolls:
        db.add(
            AllowedRollNumber(
                roll_no=row["roll_no"],
                name=row["name"],
                email=row["email"],
                room_number=row["room_number"],
                uploaded_by=current_user.id,
            )
        )

    # Sync User table for students using emails
    active_emails = [row["email"].lower() for row in unique_rolls if row["email"]]
    
    if active_emails:
        # Deactivate removed students
        db.query(User).filter(
            User.role == UserRole.student,
            User.identifier.notin_(active_emails)
        ).update({"is_active": False}, synchronize_session=False)
        
        # Reactivate existing students who are in the new list
        db.query(User).filter(
            User.role == UserRole.student,
            User.identifier.in_(active_emails)
        ).update({"is_active": True}, synchronize_session=False)

    db.commit()

    return RollNumberUploadResponse(
        count=len(unique_rolls),
        message=f"{len(unique_rolls)} roll numbers uploaded (replaced existing list).",
    )


# ---------------------------------------------------------------------------
# Manual Roll Number Management
# ---------------------------------------------------------------------------

@router.get("/roll-numbers/export-setup")
def export_setup_codes(
    current_user: User = Depends(require_role("hall_office")),
    db: Session = Depends(get_db),
):
    import random
    import string
    
    # 1. Fetch all AllowedRollNumber
    all_rolls = db.query(AllowedRollNumber).all()
    
    # 2. Fetch all registered student identifiers (emails) and roll_nos
    registered_users = db.query(User).filter(User.role == UserRole.student).all()
    registered_emails = {u.identifier for u in registered_users if u.identifier}
    registered_rolls = {u.roll_no for u in registered_users if u.roll_no}
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Roll No", "Name", "Email", "Room Number", "Setup Code", "Status"])
    
    changed = False
    
    for roll in all_rolls:
        # Check if they are already registered
        is_registered = False
        if roll.email and roll.email.lower() in registered_emails:
            is_registered = True
        if roll.roll_no and roll.roll_no in registered_rolls:
            is_registered = True
            
        if is_registered:
            status = "Already Registered"
            setup_code = "-"
            # Clear setup code if they somehow registered
            if roll.setup_code:
                roll.setup_code = None
                changed = True
        else:
            status = "Pending Setup"
            # Generate setup code if missing
            if not roll.setup_code:
                # 8 char random alphanumeric
                chars = string.ascii_uppercase + string.digits
                roll.setup_code = ''.join(random.choice(chars) for _ in range(8))
                changed = True
            setup_code = roll.setup_code
            
        writer.writerow([
            roll.roll_no,
            roll.name or "",
            roll.email or "",
            roll.room_number or "",
            setup_code,
            status
        ])
        
    if changed:
        db.commit()
        
    from fastapi.responses import StreamingResponse
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=student_setup_codes.csv"}
    )


@router.get("/roll-numbers", response_model=list[AllowedRollResponse])
def get_roll_numbers(
    current_user: User = Depends(require_role("hall_office")),
    db: Session = Depends(get_db),
):
    rolls = db.query(AllowedRollNumber).order_by(AllowedRollNumber.uploaded_at.desc()).all()
    return rolls


@router.post("/roll-numbers", response_model=AllowedRollResponse)
def add_roll_number(
    body: AllowedRollCreate,
    current_user: User = Depends(require_role("hall_office")),
    db: Session = Depends(get_db),
):
    existing = db.query(AllowedRollNumber).filter(AllowedRollNumber.roll_no == body.roll_no).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Roll number already exists in allowed list.",
        )

    new_roll = AllowedRollNumber(
        roll_no=body.roll_no,
        name=body.name,
        email=body.email,
        room_number=body.room_number,
        uploaded_by=current_user.id,
    )
    db.add(new_roll)

    # Sync User table: Reactivate if the user account already exists
    if body.email:
        db.query(User).filter(
            User.identifier == body.email.lower(), 
            User.role == UserRole.student
        ).update({"is_active": True}, synchronize_session=False)

    db.commit()
    db.refresh(new_roll)
    return new_roll


@router.delete("/roll-numbers/{roll_no}")
def delete_roll_number(
    roll_no: str,
    current_user: User = Depends(require_role("hall_office")),
    db: Session = Depends(get_db),
):
    roll = db.query(AllowedRollNumber).filter(AllowedRollNumber.roll_no == roll_no).first()
    if not roll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roll number not found.",
        )
    db.delete(roll)

    # Sync User table: Deactivate user if they exist
    if roll.email:
        db.query(User).filter(
            User.identifier == roll.email.lower(), 
            User.role == UserRole.student
        ).update({"is_active": False}, synchronize_session=False)

    db.commit()
    return {"message": "Roll number deleted successfully."}


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


# ---------------------------------------------------------------------------
# Delete staff account
# ---------------------------------------------------------------------------

@router.delete("/staff/{user_id}")
def delete_staff_account(
    user_id: int,
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

    db.delete(user)
    db.commit()

    return {"message": "Staff account deleted successfully."}
