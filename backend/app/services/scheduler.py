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
from app.models.extras import ExtrasItem

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
                ExtrasItem.recurring_weekday == today_weekday,
                ExtrasItem.is_active.is_(True),
            )
            .all()
        )

        for template in recurring_items:
            # Check if already created today
            existing_today = (
                db.query(ExtrasItem)
                .filter(
                    ExtrasItem.name == template.name,
                    ExtrasItem.is_active.is_(True),
                    ExtrasItem.created_at >= datetime.combine(
                        today_date,
                        datetime.min.time(),
                    ),
                )
                .first()
            )

            if existing_today and existing_today.id != template.id:
                logger.debug(
                    f"Recurring item '{template.name}' already exists for today."
                )
                continue

            # Clone the template as a new item for today
            new_item = ExtrasItem(
                name=template.name,
                price=template.price,
                opens_at=template.opens_at,
                closes_at=template.closes_at,
                prep_time_mins=template.prep_time_mins,
                is_recurring=False,  # The clone is not itself recurring
                recurring_weekday=None,
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


def start_scheduler() -> None:
    """Start the background scheduler with the recurring items job."""
    scheduler.add_job(
        recreate_recurring_items,
        "interval",
        hours=1,
        id="recreate_recurring_items",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("APScheduler started — recurring items job runs every hour.")


def stop_scheduler() -> None:
    """Shut down the scheduler gracefully."""
    scheduler.shutdown(wait=False)
    logger.info("APScheduler stopped.")
