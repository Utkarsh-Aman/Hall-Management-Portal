# Security Design — Hall 12 Marathas Portal

This document outlines the security decisions made for this MVP.

## Authentication

### Password Storage
- All passwords are hashed with **bcrypt** (work factor 12) via the `passlib` library.
- Passwords are never stored, logged, or transmitted in plaintext.

### JWT Token Architecture
- **Access tokens**: Short-lived (15 minutes), stored in JavaScript memory only (not localStorage, not cookies).
- **Refresh tokens**: Longer-lived (7 days), stored as `httpOnly`, `secure`, `sameSite=lax` cookies. This prevents JavaScript access, mitigating XSS-based token theft.
- Token refresh is handled automatically by the API wrapper; the user experiences seamless session continuation.

### Student Signup OTP Flow
1. Roll number verified against an allow-list uploaded by hall_office.
2. A 6-digit OTP is sent to the student's `@iitk.ac.in` email.
3. OTP is hashed with bcrypt before storage — even a database leak won't expose valid OTPs.
4. OTP expires in 10 minutes. Max 5 verification attempts per OTP.
5. OTP requests are rate-limited: max 3 per email per 15 minutes.

### Staff Account Creation
- Hall_office creates accounts; the system generates a **strong random temporary password** server-side using `secrets.token_urlsafe(12)`.
- Hall_office **cannot** choose or type a password — the temp password is shown once on screen and never logged.
- Staff must change their password on first login (`must_change_password` flag).

## Rate Limiting

- **OTP requests**: Max 3 per email per 15 minutes.
- **Login attempts**: Max 5 failed attempts per identifier per 15 minutes (then locked out).
- Current implementation: in-memory dict (single-process). **For production**: swap to Redis-based rate limiting to work across multiple processes.

## Authorization

- Every API endpoint validates the JWT `role` claim **server-side** via the `require_role()` dependency.
- Role checks are enforced at the middleware level — not just by hiding UI elements.
- A student token cannot access `/staff/*`, `/worker/*`, or `/hall-office/*` routes, and vice versa.

## QR Code Atomicity

- The "mark served" operation uses a **conditional database UPDATE**:
  ```sql
  UPDATE extras_bookings
  SET status = 'served', qr_used_at = now(), served_by = :worker_id
  WHERE qr_token = :token AND status = 'booked'
  ```
- This is atomic: if two workers scan the same QR simultaneously, only one `UPDATE` will match (rowcount = 1), the other will get rowcount = 0 and see "Already used."
- No race conditions, no double-serving.

## Input Validation

- **CSV upload**: Server-side validation of file type (`.csv`), file size (max 1MB), and content (parsed with Python's `csv` library — no `eval`, no arbitrary code execution).
- **All inputs**: Validated via Pydantic v2 schemas with field constraints (min/max length, regex patterns, numeric bounds).
- **SQL**: All queries use SQLAlchemy ORM (parameterized queries). No raw string-interpolated SQL anywhere.

## CORS

- CORS is configured to allow only the deployed frontend origin (from `FRONTEND_URL` environment variable).
- The default is `http://localhost:3000` for development — never `*`.

## Secrets Management

- All secrets (`DATABASE_URL`, `JWT_SECRET`, `SMTP_*`) are read from environment variables via Pydantic Settings.
- `.env` is gitignored. A `.env.example` template is provided.
- No secrets are hardcoded in source code.

## Future Improvements (Beyond MVP)

- [ ] Redis-based rate limiting for multi-process deployments
- [ ] CSRF protection for cookie-based auth (currently mitigated by sameSite=lax)
- [ ] Token revocation list (blacklist) for logged-out refresh tokens
- [ ] Audit logging for sensitive operations (account creation, status changes)
- [ ] Content Security Policy (CSP) headers
- [ ] Password complexity requirements beyond minimum length
