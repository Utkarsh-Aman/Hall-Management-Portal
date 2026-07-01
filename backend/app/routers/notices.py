"""
Notice Board router.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_role
from app.models.notice import Notice
from app.models.user import User, UserRole
from app.schemas.notice import NoticeCreate, NoticeResponse

router = APIRouter(tags=["notices"])

@router.get("/notices", response_model=list[NoticeResponse])
def get_all_notices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Any authenticated user can read notices."""
    notices = db.query(Notice).order_by(Notice.created_at.desc()).all()
    return notices


@router.post("/notices", response_model=NoticeResponse, status_code=status.HTTP_201_CREATED)
def create_notice(
    body: NoticeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Only hall_office or mess_staff can create notices."""
    if current_user.role not in (UserRole.hall_office, UserRole.mess_staff):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to post notices.",
        )

    notice = Notice(
        title=body.title,
        description=body.description,
        link=body.link,
        created_by=current_user.id,
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice


@router.delete("/notices/{notice_id}")
def delete_notice(
    notice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Only hall_office or mess_staff can delete notices."""
    if current_user.role not in (UserRole.hall_office, UserRole.mess_staff):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete notices.",
        )

    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notice not found.",
        )

    db.delete(notice)
    db.commit()
    return {"message": "Notice deleted."}
