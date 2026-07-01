# Hall Management Portal — Implementation Plan

Full-stack MVP for IIT Kanpur Hall 12 (Marathas): extras booking with QR codes, weekly menu, wastage tracking, and role-based access for 4 user types.

---

## User Review Required

> [!IMPORTANT]
> **CSV upload mode — Replace vs Append**: The spec says "your choice, but be explicit." I'll implement **Replace** mode: each CSV upload clears the existing `allowed_roll_numbers` table and inserts the new list. The UI will show a warning ("This will replace all 142 existing roll numbers with 150 new ones — confirm?") before proceeding. Students who already have accounts are unaffected (their `users` row persists), but new signups can only happen for roll numbers in the latest upload. This is simpler and less error-prone than append (no duplicates to manage).

> [!IMPORTANT]
> **`prep_time_mins` column**: The spec schema includes `prep_time_mins` in `extras_items`. I'll compute this as `closes_at - opens_at` in minutes and store it as a denormalized field written at create/update time (not user-entered). The staff UI will display it as a derived read-only label.

> [!WARNING]
> **SMTP in dev**: OTP emails will be **logged to the console** in development (no real email sent). The code will use an `EmailService` abstraction with a `ConsoleEmailBackend` by default, swappable to a real SMTP backend via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` env vars.

> [!IMPORTANT]
> **Supabase connection**: The app connects to your existing Supabase Postgres instance via `DATABASE_URL` in `.env`. No local Postgres or Docker. You must have a Supabase project ready with the connection string.

## Open Questions

> [!IMPORTANT]
> **Roll number format**: What format are roll numbers in? I'll assume alphanumeric strings like `230587` or `Y22CS101` — the CSV parser will accept any non-empty trimmed string per row. If there's a strict regex pattern you want enforced, let me know.

> [!NOTE]
> **Recurring extras auto-creation time**: For weekly recurring items, at what time should the system auto-create the fresh listing each week? I'll default to **midnight IST (00:00 Asia/Kolkata)** on the recurring weekday, creating items with the same `opens_at`/`closes_at` times as the template. The APScheduler job runs every hour and checks if today matches any recurring weekday that hasn't been instantiated yet.

---

## Proposed Changes

### Directory Structure

```
HMP/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app, CORS, lifespan (APScheduler)
│   │   ├── config.py                # Pydantic Settings (env vars)
│   │   ├── database.py              # SQLAlchemy engine, sessionmaker
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── allowed_roll.py
│   │   │   ├── extras.py            # ExtrasItem + ExtrasBooking
│   │   │   ├── menu.py
│   │   │   └── wastage.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── extras.py
│   │   │   ├── menu.py
│   │   │   ├── wastage.py
│   │   │   └── hall_office.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py              # /auth/*
│   │   │   ├── dashboard.py         # /dashboard/*
│   │   │   ├── menu.py              # /menu/*
│   │   │   ├── items.py             # /items (student-facing)
│   │   │   ├── bookings.py          # /bookings (student-facing)
│   │   │   ├── staff.py             # /staff/*
│   │   │   ├── worker.py            # /worker/*
│   │   │   └── hall_office.py       # /hall-office/*
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py      # JWT create/verify, password hashing
│   │   │   ├── email_service.py     # OTP email (console backend in dev)
│   │   │   ├── qr_service.py        # QR code generation
│   │   │   └── scheduler.py         # APScheduler recurring items job
│   │   └── dependencies.py          # get_db, get_current_user, role guards
│   ├── alembic/
│   │   ├── env.py
│   │   ├── versions/
│   │   └── alembic.ini
│   ├── scripts/
│   │   └── seed.py                  # Seed hall_office account
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_hall_office.py
│   │   ├── test_items_bookings.py
│   │   ├── test_menu_wastage.py
│   │   └── test_worker.py
│   ├── requirements.txt
│   ├── .env.example
│   └── alembic.ini
├── frontend/
│   ├── public/
│   │   ├── logo.webp                # Copied from root
│   │   └── favicon.ico              # Generated from logo
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx           # Root layout: dark theme, Inter font, metadata
│   │   │   ├── page.tsx             # Redirect to /login or role-based dashboard
│   │   │   ├── globals.css          # Tailwind + CSS custom properties (dark+orange)
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── signup/
│   │   │   │   └── page.tsx         # Multi-step: roll → OTP → password
│   │   │   ├── change-password/
│   │   │   │   └── page.tsx         # Forced change for new staff
│   │   │   ├── student/
│   │   │   │   ├── layout.tsx       # Bottom nav bar wrapper
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx     # Wastage cards + weekly menu
│   │   │   │   ├── browse/
│   │   │   │   │   └── page.tsx     # Available extras
│   │   │   │   ├── history/
│   │   │   │   │   └── page.tsx     # Booking history + running bill
│   │   │   │   └── profile/
│   │   │   │       └── page.tsx     # Basic profile / logout
│   │   │   ├── staff/
│   │   │   │   ├── layout.tsx       # Staff sidebar/nav
│   │   │   │   ├── items/
│   │   │   │   │   └── page.tsx     # CRUD extras items
│   │   │   │   ├── bookings/
│   │   │   │   │   └── page.tsx     # All bookings table
│   │   │   │   ├── menu/
│   │   │   │   │   └── page.tsx     # Weekly menu editor (7×3 grid)
│   │   │   │   └── wastage/
│   │   │   │       └── page.tsx     # Wastage entry form + history
│   │   │   ├── worker/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── scan/
│   │   │   │   │   └── page.tsx     # Full-screen QR scanner
│   │   │   │   └── queue/
│   │   │   │       └── page.tsx     # Today's bookings fallback list
│   │   │   └── hall-office/
│   │   │       ├── layout.tsx
│   │   │       ├── roll-numbers/
│   │   │       │   └── page.tsx     # CSV upload
│   │   │       └── staff-accounts/
│   │   │           └── page.tsx     # Create + list staff
│   │   ├── components/
│   │   │   ├── ui/                  # Reusable: Button, Input, Card, Modal, Toast, Badge
│   │   │   ├── BottomNav.tsx        # Student mobile bottom nav
│   │   │   ├── Header.tsx           # Logo + role label + logout
│   │   │   ├── QRCodeDisplay.tsx    # Shows QR image for a booking
│   │   │   ├── QRScanner.tsx        # html5-qrcode wrapper
│   │   │   ├── WeeklyMenuGrid.tsx   # Shared: read-only (student) + editable (staff)
│   │   │   └── WastageCards.tsx     # Three-card wastage summary
│   │   ├── lib/
│   │   │   ├── api.ts              # Fetch wrapper (base URL, auth headers, refresh)
│   │   │   ├── auth.ts             # AuthContext, useAuth hook, token management
│   │   │   └── utils.ts            # Date helpers, formatters
│   │   └── types/
│   │       └── index.ts            # TypeScript interfaces matching Pydantic schemas
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── logo.webp                        # Original logo (already present)
├── PROJECT.md                       # Original spec (already present)
├── README.md
├── SECURITY.md
└── .gitignore
```

---

### Step 1 — Scaffold & Branding

#### [NEW] `backend/` directory

- Initialize Python project with `requirements.txt`:
  ```
  fastapi==0.115.*
  uvicorn[standard]
  sqlalchemy==2.0.*
  alembic
  psycopg2-binary
  pydantic[email]
  pydantic-settings
  python-jose[cryptography]
  passlib[bcrypt]
  python-multipart
  qrcode[pil]
  apscheduler
  pytest
  httpx            # for test client
  ```
- `app/main.py`: FastAPI app with lifespan, CORS (origin from env), router includes.
- `app/config.py`: `pydantic_settings.BaseSettings` loading `DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM=HS256`, `FRONTEND_URL`, `SMTP_*` vars.
- `app/database.py`: `create_async_engine` → actually use sync engine with `psycopg2` for simplicity in this MVP; `SessionLocal` factory; `get_db` dependency.

#### [NEW] `frontend/` directory

- Scaffold with `npx -y create-next-app@latest ./` (TypeScript, Tailwind, App Router, no src/ alias — actually use `src/`).
- Strip all default content: remove `page.tsx` placeholder, `globals.css` defaults, default icons/images from `public/`.
- Copy `logo.webp` to `frontend/public/logo.webp`.
- Generate a favicon from the logo (convert webp → ico, or just reference the webp directly).
- Configure `tailwind.config.ts` with the dark+orange design tokens:
  ```ts
  colors: {
    background: '#0a0a0a',
    surface: '#141414',
    'surface-hover': '#1e1e1e',
    border: '#2a2a2a',
    'text-primary': '#f5f5f5',
    'text-secondary': '#a3a3a3',
    accent: '#f97316',         // orange-500
    'accent-hover': '#ea580c', // orange-600
    'accent-muted': '#7c2d12', // orange-900
  }
  ```
- `globals.css`: base dark styles, Inter font import from Google Fonts.
- `layout.tsx`: `<html className="dark">`, metadata with "Hall 12 — Marathas" title, favicon link, Inter font.

---

### Step 2 — Database Models + Alembic + Seed

#### [NEW] `backend/app/models/user.py`

```python
class UserRole(str, enum.Enum):
    student = "student"
    mess_staff = "mess_staff"
    mess_worker = "mess_worker"
    hall_office = "hall_office"

class User(Base):
    __tablename__ = "users"
    id: Mapped[int]             # PK, auto-increment
    identifier: Mapped[str]     # email for students, staff_id for staff — unique
    email: Mapped[str | None]   # nullable for staff
    password_hash: Mapped[str]
    role: Mapped[UserRole]
    name: Mapped[str]
    is_active: Mapped[bool]     # default True
    otp_hash: Mapped[str | None]
    otp_expires_at: Mapped[datetime | None]
    otp_attempts: Mapped[int]   # default 0
    password_set: Mapped[bool]  # default False (students before password set)
    must_change_password: Mapped[bool]  # default False (True for new staff)
    failed_login_attempts: Mapped[int]  # for rate limiting
    locked_until: Mapped[datetime | None]
    created_by: Mapped[int | None]  # FK to users.id
    created_at: Mapped[datetime]    # default utcnow
```

#### [NEW] `backend/app/models/allowed_roll.py`

```python
class AllowedRollNumber(Base):
    __tablename__ = "allowed_roll_numbers"
    roll_no: Mapped[str]        # PK
    uploaded_by: Mapped[int]    # FK to users.id
    uploaded_at: Mapped[datetime]
```

#### [NEW] `backend/app/models/extras.py`

```python
class ExtrasItem(Base):
    __tablename__ = "extras_items"
    id: Mapped[int]
    name: Mapped[str]
    price: Mapped[Decimal]      # Use Numeric(10,2)
    opens_at: Mapped[time]      # Time of day (not datetime)
    closes_at: Mapped[time]
    prep_time_mins: Mapped[int] # Computed: closes_at - opens_at
    is_recurring: Mapped[bool]
    recurring_weekday: Mapped[int | None]  # 0=Mon..6=Sun
    is_active: Mapped[bool]
    created_by: Mapped[int]
    created_at: Mapped[datetime]

class BookingStatus(str, enum.Enum):
    booked = "booked"
    served = "served"

class ExtrasBooking(Base):
    __tablename__ = "extras_bookings"
    id: Mapped[int]
    student_id: Mapped[int]     # FK to users.id
    item_id: Mapped[int]        # FK to extras_items.id
    qty: Mapped[int]
    total_price: Mapped[Decimal]
    status: Mapped[BookingStatus]
    qr_token: Mapped[str]       # UUID4, unique index
    qr_used_at: Mapped[datetime | None]
    served_by: Mapped[int | None]
    booked_at: Mapped[datetime]
```

#### [NEW] `backend/app/models/menu.py`

```python
class MealType(str, enum.Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"

class WeeklyMenu(Base):
    __tablename__ = "weekly_menu"
    id: Mapped[int]
    day_of_week: Mapped[int]        # 0=Monday..6=Sunday
    meal_type: Mapped[MealType]
    description: Mapped[str]
    updated_by: Mapped[int]
    updated_at: Mapped[datetime]
    # Unique constraint on (day_of_week, meal_type)
```

#### [NEW] `backend/app/models/wastage.py`

```python
class WastageLog(Base):
    __tablename__ = "wastage_logs"
    id: Mapped[int]
    date: Mapped[date]              # Unique (one entry per day)
    bdmr: Mapped[float]
    plain_wastage: Mapped[float]
    plate_wastage: Mapped[float]
    entered_by: Mapped[int]
    entered_at: Mapped[datetime]
```

#### [NEW] Alembic setup

- `alembic init alembic` inside `backend/`.
- Configure `alembic/env.py` to import all models and read `DATABASE_URL` from settings.
- Generate initial migration: `alembic revision --autogenerate -m "initial schema"`.

#### [NEW] `backend/scripts/seed.py`

- Creates one `hall_office` account:
  - `identifier`: `admin@hall12`
  - `password`: `Hall12Admin!` (hashed with bcrypt)
  - `name`: `Hall Office Admin`
  - `role`: `hall_office`
  - `password_set`: True, `must_change_password`: False
- Prints confirmation. Idempotent (skips if already exists).

---

### Step 3 — Auth Endpoints + JWT Middleware + Role Guards

#### [NEW] `backend/app/services/auth_service.py`

- `hash_password(plain) -> str` — bcrypt
- `verify_password(plain, hashed) -> bool`
- `create_access_token(user_id, role, expires_delta=15min) -> str`
- `create_refresh_token(user_id, role, expires_delta=7days) -> str`
- `decode_token(token) -> dict` — validates exp, returns `{user_id, role}`
- `generate_otp() -> str` — 6-digit random
- `generate_temp_password() -> str` — 16-char `secrets.token_urlsafe`

#### [NEW] `backend/app/services/email_service.py`

- `EmailService` class with `send_otp(email, otp)` method.
- `ConsoleEmailBackend`: prints to stdout/logger.
- `SMTPEmailBackend`: uses `smtplib` with env vars — loaded conditionally.

#### [NEW] `backend/app/dependencies.py`

- `get_db()` — yields SQLAlchemy session.
- `get_current_user(request)` — extracts Bearer token from `Authorization` header, decodes JWT, fetches user from DB, raises 401 if invalid/expired.
- `require_role(*roles)` — returns a dependency that checks `current_user.role in roles`, raises 403 if not.
- Rate-limiting state: in-memory dict (keyed by email/identifier) tracking OTP requests and login attempts with timestamps. Fine for single-process MVP; documented as needing Redis for multi-process.

#### [NEW] `backend/app/routers/auth.py`

| Endpoint | Logic |
|---|---|
| `POST /auth/signup/request-otp` | Validate roll_no in `allowed_roll_numbers`. Check no existing user with that email. Rate-limit (3/15min). Generate OTP, hash with bcrypt, store in a pending `User` row (or separate temp table — I'll use the `User` row with `password_set=False`). Send OTP via email service. |
| `POST /auth/signup/verify-otp` | Look up user by email, check `otp_hash` matches, check expiry, decrement attempts. Return a short-lived `signup_token` (JWT, 10 min, special claim) on success. |
| `POST /auth/signup/set-password` | Validate `signup_token`. Hash password, set `password_set=True`, clear OTP fields. Issue access+refresh tokens. |
| `POST /auth/login` | Find user by identifier. Check lockout. Verify password. If `must_change_password`, return special response indicating forced change needed (with a temporary token). Otherwise issue access+refresh tokens (refresh as httpOnly cookie). |
| `POST /auth/refresh` | Read refresh token from httpOnly cookie. Validate. Issue new access token. |
| `POST /auth/logout` | Clear refresh token cookie. |
| `POST /auth/change-password` | For forced-change flow. Validate temp token, accept new password, set `must_change_password=False`, issue real tokens. |

---

### Step 4 — Hall Office Endpoints

#### [NEW] `backend/app/routers/hall_office.py`

| Endpoint | Logic |
|---|---|
| `POST /hall-office/roll-numbers/upload` | `require_role("hall_office")`. Accept multipart file. Validate: must be `.csv`, max 1MB, parse with `csv.reader`. Each row should have exactly one non-empty value (the roll number). Delete all existing rows in `allowed_roll_numbers`, insert new ones. Return `{count: N}`. |
| `POST /hall-office/staff` | `require_role("hall_office")`. Accept `{name, role}` where role ∈ {mess_staff, mess_worker}. Generate staff_id (e.g., `MS-001` or `MW-001` auto-incrementing prefix). Generate temp password via `secrets.token_urlsafe(12)`. Create user with `must_change_password=True`. Return `{staff_id, name, role, temp_password}` — this is the **only time** the temp password is visible. |
| `GET /hall-office/staff` | `require_role("hall_office")`. List all users with role ∈ {mess_staff, mess_worker}, showing id, name, role, identifier, is_active, created_at. |
| `PATCH /hall-office/staff/{id}` | `require_role("hall_office")`. Toggle `is_active`. |

---

### Step 5 — Items + Bookings + QR

#### [NEW] `backend/app/services/qr_service.py`

- `generate_qr_image(qr_token: str) -> bytes` — uses `qrcode` library to produce a PNG in memory (BytesIO). The QR encodes just the token UUID string.

#### [NEW] `backend/app/routers/items.py`

| Endpoint | Logic |
|---|---|
| `GET /items` | `require_role("student")`. Return active items where `opens_at <= now.time() <= closes_at` (or all active items with their time windows — let the frontend show "opens at X"). |

#### [NEW] `backend/app/routers/bookings.py`

| Endpoint | Logic |
|---|---|
| `POST /bookings` | `require_role("student")`. Validate item exists, is active, is within booking window. `qty` 1–10. Compute `total_price = qty * item.price`. Generate `qr_token = uuid4()`. Insert booking with status=`booked`. Return booking with QR token. |
| `GET /bookings/me` | `require_role("student")`. Return all bookings for `current_user.id`, ordered by `booked_at` desc. Include item name via join. Also return `running_total` = sum of all `total_price`. |
| `GET /bookings/{id}/qr` | `require_role("student")`. Verify booking belongs to current user. Generate QR image on-the-fly and return as `image/png`. |

#### [NEW] `backend/app/routers/staff.py` — Items CRUD

| Endpoint | Logic |
|---|---|
| `POST /staff/items` | `require_role("mess_staff")`. Create extras item. Compute `prep_time_mins = (closes_at - opens_at).minutes`. |
| `PUT /staff/items/{id}` | `require_role("mess_staff")`. Update item fields. Recompute prep_time. |
| `DELETE /staff/items/{id}` | `require_role("mess_staff")`. Soft-delete (set `is_active=False`) or hard-delete if no bookings reference it. I'll use soft-delete to preserve booking history integrity. |
| `GET /staff/bookings` | `require_role("mess_staff")`. All bookings, filterable by `date` and `item_id` query params. Joins to show student identifier and item name. |

#### [NEW] `backend/app/routers/worker.py`

| Endpoint | Logic |
|---|---|
| `POST /worker/scan` | `require_role("mess_worker")`. Accept `{qr_token}`. Execute atomic update: `UPDATE extras_bookings SET status='served', qr_used_at=now(), served_by=current_user.id WHERE qr_token=:token AND status='booked'`. Check `rowcount`: if 0, look up the token — if it exists with status=served, return `{already_served: true, served_at: ...}`; if not found, return 404. If 1, return booking details (item name, qty, student identifier). |
| `GET /worker/bookings/today` | `require_role("mess_worker")`. All bookings from today with status=`booked`, showing item name, qty, student identifier. |

---

### Step 6 — Weekly Recurrence Scheduler

#### [NEW] `backend/app/services/scheduler.py`

- Uses APScheduler `BackgroundScheduler` started in FastAPI lifespan.
- Job: runs every hour, queries `extras_items` where `is_recurring=True` and `recurring_weekday = today's weekday`. For each, checks if an active item with the same name already exists for today (use a `last_recreated_date` field or simply check `created_at` date). If not, creates a clone with fresh `created_at=now()`, same time windows and price.
- Document in README that for production, this should be replaced with an external cron or Celery beat.

---

### Step 7 — Menu + Wastage + Dashboard

#### [NEW] Menu endpoints in `backend/app/routers/menu.py`

| Endpoint | Logic |
|---|---|
| `GET /menu/weekly` | Public (any authenticated user). Return all 21 slots (7 days × 3 meals), ordered by day_of_week, meal_type. |
| `GET /staff/menu` | `require_role("mess_staff")`. Same data but formatted for editing. |
| `PUT /staff/menu/{day}/{meal}` | `require_role("mess_staff")`. Upsert: if row exists for (day, meal), update description; else insert. |

#### [NEW] Wastage endpoints in `backend/app/routers/staff.py`

| Endpoint | Logic |
|---|---|
| `POST /staff/wastage` | `require_role("mess_staff")`. Accept `{date, bdmr, plain_wastage, plate_wastage}`. Upsert: if entry for that date exists, overwrite (only if date == today, else reject). Stamp `entered_by`, `entered_at`. |
| `GET /staff/wastage` | `require_role("mess_staff")`. Return all wastage logs, newest first. |

#### [NEW] Dashboard endpoint in `backend/app/routers/dashboard.py`

| Endpoint | Logic |
|---|---|
| `GET /dashboard/summary` | `require_role("student")`. Compute: (1) 7-day rolling avg BDMR from last 7 `wastage_logs` entries by date. (2) Latest day's `plain_wastage`. (3) Latest day's `plate_wastage`. (4) `last_updated` = most recent `entered_at` from `wastage_logs`. Return `{avg_bdmr, plain_wastage, plate_wastage, last_updated}`. |

---

### Step 8 — Frontend: Auth Pages

#### [NEW] `frontend/src/lib/api.ts`

- `apiFetch(path, options)` wrapper:
  - Prepends `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`).
  - Attaches `Authorization: Bearer <token>` from in-memory state.
  - On 401, attempts `/auth/refresh` (cookie-based), retries once, or redirects to login.
  - Returns typed JSON.

#### [NEW] `frontend/src/lib/auth.ts`

- `AuthContext` + `AuthProvider`:
  - State: `user` (id, role, name, identifier), `accessToken`, `isLoading`.
  - On mount: try `/auth/refresh` to restore session from httpOnly cookie.
  - `login(identifier, password)`: calls `/auth/login`, stores access token in memory, sets user.
  - `logout()`: calls `/auth/logout`, clears state, redirects.
  - `signup(email, rollNo)` / `verifyOtp(email, otp)` / `setPassword(token, password)`.

#### [NEW] Login page (`/login`)

- Dark card with logo, "Hall 12 — Marathas" text.
- Identifier + password fields, "Login" button (orange).
- Link to "Student? Sign up here" → `/signup`.
- Shows error toasts for invalid credentials, locked out, etc.

#### [NEW] Signup page (`/signup`)

- Multi-step form (animated slide transitions):
  1. Roll number + email → "Send OTP".
  2. 6-digit OTP input (auto-focus, numeric) → "Verify".
  3. Set password (with confirm) → "Create Account".
- Back buttons, error messages at each step.

#### [NEW] Change password page (`/change-password`)

- Shown when login returns `must_change_password=true`.
- New password + confirm → "Set New Password" → redirect to role dashboard.

---

### Step 9 — Frontend: Hall Office Dashboard

#### [NEW] `/hall-office/roll-numbers`

- File input (accept `.csv`), upload button.
- On upload, shows preview: "This will replace existing roll numbers. X new roll numbers found. Confirm?"
- After confirm, shows success: "142 roll numbers uploaded."
- Current count of roll numbers displayed.

#### [NEW] `/hall-office/staff-accounts`

- **Create form**: Name input + role dropdown (Mess Staff / Mess Worker) + "Create Account" button.
- On success: modal/card showing the generated staff ID and temporary password with a "Copy" button and a warning "This password will not be shown again."
- **List**: table of all staff/worker accounts with Name, Staff ID, Role, Status (active/inactive toggle), Created date.

---

### Step 10 — Frontend: Student Dashboard

#### [NEW] `/student/dashboard`

- **Wastage summary strip**: 3 cards in a row (responsive: stack on ≤375px).
  - Each card: label on top, large number below.
  - Card 1: "Avg. BDMR (7-day)" — value from API.
  - Card 2: "Plain Wastage" — latest.
  - Card 3: "Plate Wastage" — latest.
  - Below cards: "Last updated: Jun 30, 2026 at 8:42 PM" in muted text.

- **Weekly menu**: Day-by-day cards or a table.
  - Each day shows: Day name, Breakfast, Lunch, Dinner descriptions.
  - Today's row has an orange left-border or background highlight.
  - If no menu data yet, shows "Menu not available yet."

---

### Step 11 — Frontend: Student Browse / Book / History / QR

#### [NEW] `/student/browse`

- Grid/list of active extras items.
- Each card: item name, price (₹), time window ("Available 7:00 PM – 8:30 PM").
- "Book" button opens a modal: quantity selector (1–10, stepper or dropdown), live total = qty × price. "Confirm Booking" button.
- On success: toast "Booked! View your QR code" with link to history.

#### [NEW] `/student/history`

- **Running bill** at the top: "Total: ₹X" (sum of all bookings).
- List of bookings, newest first:
  - Item name, qty, total price, status badge (`Booked` = orange, `Served` = green), timestamp.
  - "View QR" button → opens modal with QR image (fetched from `/bookings/{id}/qr`).

---

### Step 12 — Frontend: Mess Staff Dashboard

#### [NEW] `/staff/items`

- "Add Item" button → form: name, price, opens_at (time picker), closes_at, recurring toggle (if on, show weekday picker), active toggle.
- List/table of all items with edit/delete actions.
- Each item shows computed prep time: "45 min prep time".

#### [NEW] `/staff/bookings`

- Filterable table: date picker, item dropdown.
- Columns: Student ID, Item, Qty, Total, Status, Booked At.

#### [NEW] `/staff/menu`

- 7×3 grid (days as rows, meals as columns).
- Each cell is an editable text area. "Save" button per cell (or auto-save on blur).
- Visual indicator when a cell has been modified.

#### [NEW] `/staff/wastage`

- Today's entry form: BDMR, Plain Wastage, Plate Wastage (numeric inputs). Submit button.
- If entry for today already exists, pre-fill and allow editing.
- Below: history table of past entries.

---

### Step 13 — Frontend: Mess Worker Scanner

#### [NEW] `/worker/scan`

- Full-screen camera view using `html5-qrcode`.
- Large "Tap to Scan" button if camera needs permission prompt.
- On scan success:
  - Show result card: Item name, Qty, Student ID.
  - Large "Mark Served" button (orange, full-width, min-height 56px for tap target).
  - On confirm: call `/worker/scan` API.
  - Show success: "✓ Marked as served" (green).
  - Or error: "Already served at 7:42 PM" (yellow warning).
- "View Today's Queue" link → `/worker/queue`.

#### [NEW] `/worker/queue`

- List of today's unserved bookings.
- Each row: item name, qty, student identifier, "Mark Served" button (manual fallback).

---

### Step 14 — README + SECURITY.md

#### [NEW] `README.md`

- Project overview, tech stack, setup instructions:
  1. Clone repo.
  2. Backend: create venv, `pip install -r requirements.txt`, copy `.env.example` → `.env`, fill in Supabase URL + JWT secret.
  3. Run migrations: `alembic upgrade head`.
  4. Seed: `python scripts/seed.py`.
  5. Start backend: `uvicorn app.main:app --reload --port 8000`.
  6. Frontend: `npm install`, copy `.env.example` → `.env.local`, start: `npm run dev`.
- Default hall_office credentials for testing.
- Architecture diagram (text-based).

#### [NEW] `SECURITY.md`

- Auth decisions: bcrypt, JWT access/refresh split, httpOnly cookies.
- QR atomicity: conditional UPDATE prevents double-serve.
- Staff account creation: server-generated temp passwords, forced change.
- CSV upload: server-side validation, no eval, standard csv library.
- Rate limiting: OTP and login attempt limits.
- CORS: restricted to frontend origin.

---

## Verification Plan

### Automated Tests

```bash
# Backend tests (from /backend directory)
pytest tests/ -v

# Specific test suites:
pytest tests/test_auth.py -v          # Signup flow, login, JWT, rate limiting
pytest tests/test_hall_office.py -v   # CSV upload, staff creation
pytest tests/test_items_bookings.py -v # CRUD, booking, QR
pytest tests/test_menu_wastage.py -v  # Menu CRUD, wastage, dashboard summary
pytest tests/test_worker.py -v        # Scan atomicity, double-scan prevention
```

### Manual Verification

After each backend step:
- Curl/httpie against running `uvicorn` to verify endpoints return expected data.
- Verify role guards: e.g., student token can't hit `/staff/*` routes.

After each frontend step:
- Open in browser at 375px mobile viewport.
- Walk through the user flow for that role.
- Verify dark+orange theme consistency.
- Test error states (wrong password, expired OTP, already-scanned QR).

### End-to-End Flow

1. Seed hall_office → login → upload CSV → create mess_staff + mess_worker accounts.
2. Login as mess_staff (forced password change) → create extras items → set weekly menu → enter wastage.
3. Student signup (OTP flow) → view dashboard (wastage + menu) → browse extras → book → see QR.
4. Login as mess_worker (forced password change) → scan student's QR → mark served → try scanning again (should show "already used").
