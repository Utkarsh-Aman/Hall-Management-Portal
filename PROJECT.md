## Project Goal

Build a full-stack web application called **Hall Management Portal** for IIT Kanpur Hall of Residence XII ("Marathas"). Students browse and book optional paid food "extras" (e.g. extra roti, special thali), receive a single-use QR code per booking, and a mess worker scans that QR to mark the item served. Mess staff manage what extras are available, their prices and timing, the weekly regular mess menu, and daily wastage figures. This is an MVP — build only the scope below, but structure the code so more roles/features can be added later without a rewrite.

## Branding & Setup Notes

- Use the Hall 12 (Marathas) logo, provided as a file in the project base folder, as the app's favicon and header logo.
- Remove all default Next.js scaffold icons, boilerplate images, and starter page content — this should not look like an unmodified `create-next-app` output.

## Tech Stack (use exactly this, do not substitute)

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS. Mobile-first responsive design — most students and the mess worker will use this on a phone.
- **Backend**: FastAPI (Python), SQLAlchemy ORM, Pydantic v2 for validation.
- **Database**: PostgreSQL. Use SQLAlchemy migrations (Alembic).
- **Auth**: Custom JWT-based auth (access token + refresh token), bcrypt for password hashing. No third-party auth provider.
- **QR**: `qrcode` Python library for generation; `html5-qrcode` (JS) for scanning in the browser — no native app.
- **Database hosting**: Supabase (managed Postgres) — no local Postgres instance, no Docker. Connection string read from `.env`.
- Local dev: run the backend directly with `uvicorn app.main:app --reload` on port 8000, and the frontend with `npm run dev` on port 3000, both connecting to the same Supabase instance via environment variables.

## Roles in this MVP (exactly these four — do NOT build any other hall_office permission or rebate features yet)

1. `hall_office` — narrow admin role, limited to exactly two things: uploading the student roll-number CSV, and creating login credentials for mess_staff/mess_worker accounts. Nothing else (no billing, no bookings visibility, no editing extras/menu/wastage). Login with a staff ID + password (seed one dummy account for testing).
2. `mess_staff` — management role. Login with a staff ID + password (account created by hall_office — see below, no self-signup).
3. `mess_worker` — distributor role. Login with a staff ID + password (account created by hall_office).
4. `student` — books and tracks own extras, views the weekly menu and hall wastage stats. Self-signup with verification (see Auth Flow below).

## Auth Flow

**Student signup:**
1. Student enters their `roll@iitk.ac.in` email and roll number.
2. Backend checks the roll number against an `allowed_roll_numbers` table (populated by hall_office uploading a CSV through the app — see the hall_office feature spec below).
3. If not on the list, show a clear message: "Your roll number isn't recognized. Contact the hall office to be added." Do not allow signup.
4. If on the list, send a 6-digit OTP to that email (use any SMTP-compatible email sending — stub it with console-log in dev, but structure the code so a real SMTP provider can be swapped in via environment variables).
5. Student enters the OTP (expires in 10 minutes, max 5 attempts, then must request a new one).
6. On successful OTP verification, student sets a password. This is now their permanent login (email + password) — OTP is never required again after this point.

**Staff login (hall_office, mess_staff, mess_worker):** simple email/ID + password login. No self-signup, no OTP. `hall_office` is the only role that can create `mess_staff`/`mess_worker` accounts (see below); seed one `hall_office` account via a script so there's a way in on day one.

**Security requirements for auth (non-negotiable):**
- Passwords hashed with bcrypt, never stored or logged in plaintext.
- JWT access tokens short-lived (15 min), refresh tokens longer-lived (7 days), refresh tokens stored as httpOnly secure cookies, not localStorage.
- Rate-limit OTP requests (max 3 per email per 15 minutes) and login attempts (lock out after 5 failed attempts for 15 minutes) to prevent brute force.
- All API routes must validate the JWT role claim server-side before performing the action — never trust a role sent from the frontend.
- Use parameterized queries via the ORM only — no raw string-interpolated SQL anywhere.
- CORS configured to only allow the deployed frontend origin, not `*`.
- All secrets (DB url, JWT secret, SMTP credentials) read from environment variables, never hardcoded. Provide a `.env.example` file but make sure `.env` itself is gitignored.
- CSV upload must validate file type/size server-side, reject anything that isn't a well-formed roll-number list, and never `eval` or directly execute uploaded content. Parse with a standard CSV library only.
- When hall_office creates a mess_staff/mess_worker account, generate a strong random temporary password server-side (never let hall_office type an arbitrary password over the network in plaintext form that gets logged) and force a password change on that account's first login.

## Feature Spec by Role

### `hall_office`
Deliberately narrow — this role does exactly two things in this MVP, nothing more:
- Upload a CSV of allowed roll numbers, which replaces (or appends to, your choice — but be explicit in the UI which one it does) the `allowed_roll_numbers` table. Show a confirmation summary (e.g. "142 roll numbers added") before and after.
- Create a new `mess_staff` or `mess_worker` account: enter name + role, system generates a temporary password, shown once on screen (not emailed, not logged) for hall_office to hand off manually. Also list existing staff/worker accounts with an active/inactive toggle.
- No access to bookings, billing, pricing, menu, wastage, or extras management. Enforce this via role check, not just by hiding UI.

### `student`
- **Lands on a Dashboard page immediately after login** (this is the default/home route for students). See "Student Dashboard" section below for its exact layout.
- Separately, a Browse page: view currently available extras (name, price, time window it's open for booking, no photo for now — skip image upload entirely in this MVP).
- Book an extra with a quantity selector (e.g. 1–10), see live total price before confirming.
- After booking, see a generated QR code on screen (and able to view it again later from booking history) representing that specific booking.
- View own booking history: each past/current booking with item name, qty, total price, status (`booked` / `served`), and timestamp.
- View a simple running bill total (sum of all `booked` + `served` bookings) — no payment integration needed yet, just a number.
- Cannot see any other student's data.

### `mess_staff`
- Create / edit / delete extra items: name, price, opening time, closing time (used to compute a prep-time window — show staff "X minutes of prep time" derived from closing minus opening), active/inactive toggle.
- Mark an item as "recurring weekly" — pick a day of week, and the system should auto-recreate this item as a fresh available listing on that day each week (implement via a scheduled job — APScheduler running inside the FastAPI app is fine for this MVP, document how to swap to an external cron later).
- View all bookings across all students: filterable by date and by item, with student identifier, qty, total, and status visible.
- **Manage the weekly mess menu**: a 7-day × 3-meal (breakfast/lunch/dinner) grid, each cell a simple text description (e.g. "Aloo Paratha, Curd, Pickle"). Editable any time; the most recent edit is what students see.
- **Enter daily wastage figures**: BDMR, plain wastage, plate wastage — one entry per day, editable if re-entered same day. Each entry stamps `entered_by` and `entered_at`; the latest entry's timestamp is what powers the "last updated" label students see on their dashboard.
- Cannot access mess_worker's scanning function or vice versa (enforce via role check, not just UI hiding).

### `mess_worker`
- A simple, large-button, phone-friendly QR scanner screen using the device camera.
- On successful scan, look up the booking by QR token and show item name + qty + student identifier, with a clear "Mark Served" confirmation button.
- The "mark served" action must be atomic — use a conditional DB update (`UPDATE ... SET status='served' WHERE qr_token=... AND status='booked'`) so that two simultaneous scans of the same QR cannot both succeed. If already served, show "Already used at [time]" instead of erroring silently.
- View today's list of valid (not-yet-served) bookings as a fallback if the scanner can't be used.
- Cannot view pricing, billing, menu, wastage, or any student's booking history beyond today's queue.

## Student Dashboard (landing page after login)

Layout, top to bottom:

1. **Top — Wastage summary strip**: three cards side by side (stack vertically on narrow phones): "Avg. BDMR" (7-day rolling average), "Plain Wastage" (latest single day's figure), "Plate Wastage" (latest single day's figure). Below the cards, a small "Last updated: [date, time]" label sourced from the most recent `wastage_logs` entry.
2. **Bottom — Weekly menu**: the current week's menu as a simple 7-row table or day-by-day cards, each showing breakfast/lunch/dinner text for that day. Today's row visually highlighted.

Keep this page read-only and lightweight for students — no editing, no drill-down needed for the MVP.

## Database Schema (build exactly this for the MVP)

```
users
  id, identifier (email or staff_id), email, password_hash, role
  (enum: student/mess_staff/mess_worker/hall_office), name, is_active,
  otp_hash, otp_expires_at, otp_attempts, password_set,
  must_change_password, created_by, created_at

allowed_roll_numbers
  roll_no (primary key), uploaded_by, uploaded_at

extras_items
  id, name, price, opens_at, closes_at, prep_time_mins,
  is_recurring, recurring_weekday, is_active, created_by, created_at

extras_bookings
  id, student_id, item_id, qty, total_price, status (booked/served),
  qr_token (unique), qr_used_at, served_by, booked_at

weekly_menu
  id, day_of_week (0-6), meal_type (breakfast/lunch/dinner),
  description, updated_by, updated_at

wastage_logs
  id, date, bdmr, plain_wastage, plate_wastage, entered_by, entered_at
```

`total_price` is calculated and stored at booking time (qty × item price at that moment), so later price edits never change a student's already-placed order.

## API Endpoints (build these; keep route naming consistent)

```
POST /auth/signup/request-otp
POST /auth/signup/verify-otp
POST /auth/signup/set-password
POST /auth/login
POST /auth/refresh
POST /auth/logout

GET  /dashboard/summary            (student: {avg_bdmr, plain_wastage, plate_wastage, last_updated})
GET  /menu/weekly                  (student: current week's menu, read-only)

GET    /items                      (student: active items only)
POST   /bookings                   (student: {item_id, qty})
GET    /bookings/me                (student: own history)
GET    /bookings/{id}/qr           (student: own QR image)

POST   /staff/items
PUT    /staff/items/{id}
DELETE /staff/items/{id}
GET    /staff/bookings             (filterable by date, item_id)
GET    /staff/menu                 (full editable weekly grid)
PUT    /staff/menu/{day}/{meal}    (update one meal slot)
POST   /staff/wastage              ({date, bdmr, plain_wastage, plate_wastage})
GET    /staff/wastage              (history, editable for today's entry)

POST   /worker/scan                ({qr_token} -> atomic mark-served)
GET    /worker/bookings/today

POST   /hall-office/roll-numbers/upload   (multipart CSV)
POST   /hall-office/staff                 ({name, role: mess_staff|mess_worker} -> returns temp password once)
GET    /hall-office/staff                 (list accounts, active/inactive)
PATCH  /hall-office/staff/{id}            ({is_active})
```

## Frontend UX Guidelines

**Color scheme: dark mode, with orange as the accent color** (buttons, highlights, active nav states, the "today" highlight on the menu). Keep the base dark palette neutral (charcoal/near-black backgrounds) so the orange accent stays legible and isn't overused.

Keep this simple and unpretentious — this is not a startup landing page, it's a utility tool students will open quickly on a phone between classes. Prioritize:
- Mobile-first layout (test at 375px width first, scale up).
- Minimal color palette beyond the dark+orange scheme, clear typography, generous tap targets (mess_worker's scan button especially — they'll be using this one-handed, quickly, in a serving line).
- No heavy animation libraries, no unnecessary client-side state complexity — plain React state/Context is enough, no Redux.
- Clear, immediate feedback on every action (booking confirmed, QR scanned, item already used, etc.) — toast/banner messages, not silent failures.
- A persistent bottom nav bar on mobile for students (Dashboard / Browse / History / Profile) and a single-purpose full-screen scanner view for mess_worker.

## Build Order (tell the agent to follow this sequence)

1. Scaffold repo structure (`/backend`, `/frontend`); apply Hall 12 (Marathas) branding (logo, favicon, dark+orange theme) and strip default Next.js starter content immediately so nothing downstream is built against placeholder branding.
2. Backend: DB models + Alembic migration + seed script (one hall_office account to bootstrap; no other staff seeded — those get created through the app).
3. Backend: auth endpoints + JWT middleware + role-guard dependency.
4. Backend: hall_office endpoints (CSV upload, staff account creation) with forced-password-change flow.
5. Backend: items + bookings + QR generation + atomic scan endpoint.
6. Backend: weekly recurrence scheduled job for extras.
7. Backend: weekly menu endpoints + wastage log endpoints + dashboard summary endpoint (7-day BDMR average calculation).
8. Frontend: auth pages (signup OTP flow, login, forced password change on first staff login).
9. Frontend: hall_office dashboard (CSV upload, staff account creation/list).
10. Frontend: student dashboard (wastage summary strip + weekly menu) as the post-login landing page.
11. Frontend: student Browse/book/history/QR flow.
12. Frontend: mess_staff dashboard (item CRUD, bookings table, weekly menu editor, wastage entry form).
13. Frontend: mess_worker scanner page.
14. Write a README with setup steps, and a short SECURITY.md noting the auth/QR-atomicity/account-creation decisions above.

Run and verify each layer (backend via pytest + manual curl checks, frontend via the built-in browser subagent) before moving to the next step. Surface an implementation plan for my review before generating code.