"""
APScheduler integration — weekly recurrence job for extras items.

Runs inside the FastAPI process. For production, swap to an external cron
or Celery beat by calling `recreate_recurring_items()` from that scheduler
instead of using APScheduler's BackgroundScheduler.
"""

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.extras import ExtrasItem, ExtrasBooking, BookingStatus, MealType

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def recreate_recurring_items() -> None:
    """
    Check for recurring extras items whose weekday matches today.
    If no active item with the same name was created today, clone it.
    """
    db: Session = SessionLocal()
    try:
        today_weekday = datetime.now(timezone.utc).weekday()  # 0=Mon..6=Sun
        today_date = datetime.now(timezone.utc).date()

        recurring_items = (
            db.query(ExtrasItem)
            .filter(
                ExtrasItem.is_recurring.is_(True),
                ExtrasItem.date < today_date, # Only look at past templates
                ExtrasItem.is_active.is_(True),
            )
            .all()
        )

        for template in recurring_items:
            # We assume it recurrs every 7 days.
            # Calculate the next occurrence date
            days_diff = (today_date - template.date).days
            if days_diff <= 0 or days_diff % 7 != 0:
                continue

            # Check if already created today
            existing_today = (
                db.query(ExtrasItem)
                .filter(
                    ExtrasItem.name == template.name,
                    ExtrasItem.is_active.is_(True),
                    ExtrasItem.date == today_date,
                    ExtrasItem.meal_type == template.meal_type,
                )
                .first()
            )

            if existing_today and existing_today.id != template.id:
                logger.debug(
                    f"Recurring item '{template.name}' already exists for today."
                )
                continue

            # Clone the template as a new item for today
            # We copy opens_at and closes_at relative to the new date
            time_diff = template.closes_at - template.opens_at
            
            # Keep the same time, but change the date
            new_closes_at = datetime.combine(today_date, template.closes_at.time())
            new_opens_at = new_closes_at - time_diff

            new_item = ExtrasItem(
                name=template.name,
                price=template.price,
                date=today_date,
                meal_type=template.meal_type,
                opens_at=new_opens_at,
                closes_at=new_closes_at,
                prep_time_mins=template.prep_time_mins,
                is_recurring=False,  # The clone is not itself recurring
                is_active=True,
                created_by=template.created_by,
            )
            db.add(new_item)
            logger.info(f"Created recurring clone of '{template.name}' for today.")

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Error in recurring items job")
    finally:
        db.close()


def mark_missed_bookings() -> None:
    """
    Mark bookings as missed if they are still 'booked' or 'cancel_requested' and the meal window has passed.
    Meal cutoffs (IST):
    - Breakfast: 9:30 AM
    - Lunch: 2:30 PM (14:30)
    - Dinner: 9:30 PM (21:30)
    """
    db: Session = SessionLocal()
    try:
        from zoneinfo import ZoneInfo
        from datetime import datetime, time
        
        ist = ZoneInfo("Asia/Kolkata")
        now_ist = datetime.now(ist)
        today = now_ist.date()
        current_time = now_ist.time()
        
        # Find all 'booked' or 'cancel_requested' bookings
        pending_bookings = (
            db.query(ExtrasBooking)
            .join(ExtrasItem)
            .filter(ExtrasBooking.status.in_([BookingStatus.booked, BookingStatus.cancel_requested]))
            .all()
        )
        
        count = 0
        for booking in pending_bookings:
            item = booking.item
            is_missed = False
            
            # If the item date is strictly in the past, it's definitively missed
            if item.date < today:
                is_missed = True
            elif item.date == today:
                # Check specific time cutoffs for today's meals
                if item.meal_type == MealType.breakfast and current_time >= time(9, 30):
                    is_missed = True
                elif item.meal_type == MealType.lunch and current_time >= time(14, 30):
                    is_missed = True
                elif item.meal_type == MealType.dinner and current_time >= time(21, 30):
                    is_missed = True
            
            if is_missed:
                booking.status = BookingStatus.missed
                count += 1
            
        if count > 0:
            logger.info(f"Marked {count} bookings as missed.")
            db.commit()
            
    except Exception:
        db.rollback()
        logger.exception("Error in mark_missed_bookings job")
    finally:
        db.close()


def start_scheduler() -> None:
    """Start the background scheduler with the recurring items job."""
    scheduler.add_job(
        recreate_recurring_items,
        "interval",
        hours=1,
        id="recreate_recurring_items",
        replace_existing=True,
    )
    scheduler.add_job(
        mark_missed_bookings,
        "interval",
        hours=1,
        id="mark_missed_bookings",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("APScheduler started — recurring items job runs every hour.")


def stop_scheduler() -> None:
    """Shut down the scheduler gracefully."""
    scheduler.shutdown(wait=False)
    logger.info("APScheduler stopped.")
