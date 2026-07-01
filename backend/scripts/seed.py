"""
Seed script — creates the initial hall_office admin account.

Usage:
    cd backend
    uv run python -m scripts.seed

This is idempotent: it skips creation if the account already exists.
"""

import sys
import os

# Add parent directory to path so we can import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.services.auth_service import hash_password


def seed_hall_office():
    """Create the bootstrap hall_office admin account."""
    db = SessionLocal()
    try:
        identifier = "admin@hall12"

        existing = db.query(User).filter(User.identifier == identifier).first()
        if existing:
            print(f"✓ Hall office account '{identifier}' already exists. Skipping.")
            return

        user = User(
            identifier=identifier,
            email="hall12@iitk.ac.in",
            password_hash=hash_password("Hall12kaAdmin!"),
            role=UserRole.hall_office,
            name="Hall Office Admin",
            is_active=True,
            password_set=True,
            must_change_password=False,
        )
        db.add(user)
        db.commit()

        print(f"✓ Hall office account created:")
        print(f"  Identifier: {identifier}")
        print(f"  Password:   Hall12kaAdmin!")
        print(f"  Role:       hall_office")
        print()
        print("  ⚠ Changed this password in production chill!")

    except Exception as e:
        db.rollback()
        print(f"✗ Error seeding hall_office account: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_hall_office()
