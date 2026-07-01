# Hall 12 — Marathas Portal

Hall Management Portal for IIT Kanpur Hall of Residence XII (Marathas). Students browse and book paid food extras, receive a single-use QR code, and a mess worker scans it to mark the item served. Mess staff manage extras, the weekly menu, and daily wastage figures.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy ORM, Pydantic v2 |
| Database | PostgreSQL (Supabase-hosted) |
| Auth | Custom JWT (access + refresh tokens), bcrypt |
| QR | `qrcode` (Python) for generation, `html5-qrcode` (JS) for scanning |

## Quick Start

### Prerequisites

- Python 3.11+
- [uv](https://github.com/astral-sh/uv) (Python package manager)
- Node.js 18+
- A Supabase project with the Postgres connection string

### 1. Backend Setup

```bash
cd backend

# Install dependencies
uv sync

# Create your .env file
cp .env.example .env
# Edit .env — fill in DATABASE_URL, JWT_SECRET, FRONTEND_URL

#for first time only
uv run alembic revision --autogenerate -m "initial"

# Run database migrations
uv run alembic upgrade head

# Seed the initial hall_office admin account
uv run python -m scripts.seed

# Start the backend (port 8000)
uv run uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create your .env.local file
cp .env.example .env.local
# Edit .env.local if API is not at http://localhost:8000

# Start the frontend (port 3000)
npm run dev
```

### 3. First Login

Use the seeded hall_office admin account:
- **Identifier:** `admin@hall12`
- **Password:** `Hall12Admin!`

> ⚠️ Change this password in production.

From here you can:
1. Upload a student roll number CSV
2. Create mess_staff and mess_worker accounts
3. Log into those accounts (forced password change on first login)

## Roles

| Role | Access |
|---|---|
| `hall_office` | Upload roll numbers CSV, create/manage staff accounts |
| `mess_staff` | Manage extras items, view bookings, edit weekly menu, enter wastage |
| `mess_worker` | QR scanner, today's booking queue |
| `student` | View dashboard (wastage + menu), browse/book extras, booking history + QR |

## Project Structure

```
HMP/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app entry
│   │   ├── config.py        # Environment-based settings
│   │   ├── database.py      # SQLAlchemy engine
│   │   ├── dependencies.py  # Auth, role guards, rate limiting
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic v2 request/response schemas
│   │   ├── routers/         # API route handlers
│   │   └── services/        # Auth, email, QR, scheduler
│   ├── alembic/             # Database migrations
│   ├── scripts/seed.py      # Bootstrap admin account
│   └── tests/               # pytest test suite
├── frontend/
│   └── src/
│       ├── app/             # Next.js App Router pages
│       ├── components/      # Reusable UI components
│       ├── lib/             # API wrapper, auth context, utilities
│       └── types/           # TypeScript type definitions
├── README.md
└── SECURITY.md
```

## API Endpoints

See `PROJECT.md` for the full API specification. Key route groups:

- `POST /auth/*` — Signup OTP flow, login, refresh, logout
- `GET /dashboard/summary` — Student wastage summary
- `GET /menu/weekly` — Weekly menu
- `GET /items` — Available extras
- `POST /bookings` — Create a booking
- `/staff/*` — Item CRUD, bookings list, menu editor, wastage
- `/worker/*` — QR scan, today's queue
- `/hall-office/*` — CSV upload, staff accounts

## Notes

- **Recurring extras:** APScheduler runs inside the FastAPI process, checking hourly for items to recreate on their designated weekday. For production, swap to an external cron or Celery beat.
- **Email in dev:** OTPs are logged to the console. Set `SMTP_*` env vars for real email delivery.
- **Rate limiting:** In-memory (single-process). For multi-process production, use Redis.
