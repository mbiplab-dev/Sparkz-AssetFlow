# Frontend change log — Login & Register redesign

**Date:** 2026-07-12  
**Scope:** Frontend only (auth UI + API client alignment). Backend changes are listed as requests for the backend team.

---

## Summary

Redesigned **Login** and **Register (signup)** pages to match the Notion-inspired design system (`DESIGN.md`, `AGENTS.md`), with client-side field validation only.

**Registration is a single step** — full name, email, phone, password. **No email OTP and no phone verification on signup.** OTP is used only on the existing **forgot-password** flow (and the optional login-OTP page already in the app).

---

## Files changed / added

| Path                            | Action    | Notes                                                                 |
| ------------------------------- | --------- | --------------------------------------------------------------------- |
| `app/(auth)/layout.tsx`         | Updated   | Warm `bg-background` canvas                                           |
| `app/(auth)/login/page.tsx`     | Rewritten | shadcn Card/Field/Input/Button; email/password validation             |
| `app/(auth)/signup/page.tsx`    | Rewritten | Single form: Full name, Email, Phone, Password — **no OTP step**      |
| `app/(auth)/login_otp/page.tsx` | Rewritten | Same Notion/shadcn auth card as login; email → OTP flow preserved     |
| `components/PasswordInput.tsx`  | Updated   | shadcn `Input` + lucide eye icons                                     |
| `lib/auth/authApi.ts`           | Updated   | `AuthUser` aligned with backend; `register()` (direct, no signup OTP) |
| `lib/auth/validation.ts`        | **Added** | Client format checks only (not verification codes)                    |
| `context/AuthContext.tsx`       | Updated   | Exposes `register` instead of signup OTP helpers                      |
| `app/dashboard/page.tsx`        | Updated   | `user.name` → `user.full_name`                                        |
| `FRONTEND_CHANGELOG.md`         | **Added** | This log                                                              |

---

## Registration UX (product)

| Field     | Client validation only                             |
| --------- | -------------------------------------------------- |
| Full name | Required, 2–150 chars                              |
| Email     | Required, valid email format                       |
| Phone     | Required, 10–15 digits (format check, **not** OTP) |
| Password  | Required, min 8 characters                         |

Submit → create account + log in → `/dashboard`. No intermediate verify step.

---

## API (frontend)

### Login

- `POST /api/auth/login/` — `{ email, password }` → `{ access, user }` + refresh cookie

### Register (direct, no OTP)

- `POST /api/auth/register/` — `{ full_name, email, phone, password }` → `{ access, user }` + refresh cookie  
  (expected contract; see backend gap below)

### Forgot password (OTP — only place registration-related OTP is not; this is password reset)

- `POST /api/auth/password-reset/request-otp/`
- `POST /api/auth/password-reset/confirm/`

### AuthUser shape

```ts
{
  (id, email, full_name, phone, role, status, department, department_name);
}
```

---

## Backend requirements (hand to backend team)

### 1. Direct register endpoint (required for product signup)

Product signup has **no OTP**. Frontend calls:

`POST /api/auth/register/`  
Body: `{ full_name, email, phone, password }`  
Response: same as login — `{ access, user }` + httpOnly refresh cookie  
Role: always `employee`

**Current backend only has:**

- `POST /api/auth/register/request-otp/`
- `POST /api/auth/register/verify-otp/`

Those are **not** used by the registration page. Please add a direct register (or repurpose create-user without OTP) so frontend signup works.

### 2. Accept and store `phone` on register

`User.phone` exists on the model but was not part of the old OTP signup serializer. Register body must accept `phone` and persist it.

### 3. OTP remains for password reset only (for this product story)

Keep password-reset OTP as-is. Signup must not require email verification codes.

---

## Correction note (2026-07-12, later)

An earlier version of the signup page reused the scaffold’s **email OTP** step. That was removed: registration is form-only; OTP stays on **forgot-password** (and existing login-OTP route if still linked from login).

---

## Out of scope

- Restyling `login_otp` / `forgot-password` beyond existing behavior
- Dashboard redesign
- Backend implementation

---

## How to verify

```bash
cd frontend
npm run build
npm run dev
# /login — email + password
# /signup — four fields, submit once, no OTP UI
# /forgot-password — OTP still used here
```
