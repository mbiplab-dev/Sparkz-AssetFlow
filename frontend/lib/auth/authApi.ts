import { authRequest } from "@/lib/api/client";
import { request } from "@/lib/api/http";
import { clearAccessToken, setAccessToken } from "./tokenStorage";

/** Matches backend UserSerializer (`apps.authentication.serializers.UserSerializer`). */
export type AuthUser = {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  status: string;
  department: number | null;
  department_name: string | null;
};

export type AuthSession = {
  access: string;
  user: AuthUser;
};

export type LoginInput = {
  email: string;
  password: string;
};

/** Payload for direct registration (no email/phone OTP on signup). */
export type RegisterInput = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
};

export type OtpVerifyInput = {
  email: string;
  code: string;
};

export async function login(input: LoginInput): Promise<AuthSession> {
  const session = (await request("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify(input),
  })) as AuthSession;
  setAccessToken(session.access);
  return session;
}

/**
 * Create an employee account and log in.
 *
 * Expected: POST /api/auth/register/ → { access, user } + refresh cookie.
 * Backend currently only exposes OTP-gated signup routes
 * (`register/request-otp/`, `register/verify-otp/`). Product registration
 * has no OTP step — backend needs a direct register endpoint (or equivalent).
 * See FRONTEND_CHANGELOG.md.
 */
export async function register(input: RegisterInput): Promise<AuthSession> {
  const session = (await request("/api/auth/register/", {
    method: "POST",
    body: JSON.stringify(input),
  })) as AuthSession;
  setAccessToken(session.access);
  return session;
}

/** Emails a login code if the address belongs to an account. Always resolves the same way either way. */
export async function requestLoginOtp(email: string): Promise<{ detail: string }> {
  return (await request("/api/auth/login/request-otp/", {
    method: "POST",
    body: JSON.stringify({ email }),
  })) as { detail: string };
}

export async function verifyLoginOtp(input: OtpVerifyInput): Promise<AuthSession> {
  const session = (await request("/api/auth/login/verify-otp/", {
    method: "POST",
    body: JSON.stringify(input),
  })) as AuthSession;
  setAccessToken(session.access);
  return session;
}

/** Emails a password-reset code. Fails (with a message) if the email isn't registered. */
export async function requestPasswordResetOtp(email: string): Promise<{ detail: string }> {
  return (await request("/api/auth/password-reset/request-otp/", {
    method: "POST",
    body: JSON.stringify({ email }),
  })) as { detail: string };
}

/** Verifies the code and sets the new password. Doesn't log the user in. */
export async function confirmPasswordReset(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<{ detail: string }> {
  return (await request("/api/auth/password-reset/confirm/", {
    method: "POST",
    body: JSON.stringify({ email: input.email, code: input.code, new_password: input.newPassword }),
  })) as { detail: string };
}

/** Blacklists the refresh token server-side and clears the local access token. */
export async function logout(): Promise<void> {
  try {
    await authRequest("/api/auth/logout/", { method: "POST" });
  } finally {
    clearAccessToken();
  }
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  return (await authRequest("/api/auth/me/")) as AuthUser;
}
