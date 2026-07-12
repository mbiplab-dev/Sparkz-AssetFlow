/** Client-side validators for auth forms. Mirror backend constraints where known. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** International-friendly phone: optional +, then 10–15 digits (spaces/dashes/parens allowed). */
const PHONE_RE = /^\+?[\d\s().-]{10,20}$/;

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Email is required.";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
  return null;
}

export function validateFullName(value: string): string | null {
  const name = value.trim();
  if (!name) return "Full name is required.";
  if (name.length < 2) return "Full name must be at least 2 characters.";
  if (name.length > 150) return "Full name must be 150 characters or fewer.";
  return null;
}

export function validatePhone(value: string): string | null {
  const phone = value.trim();
  if (!phone) return "Phone number is required.";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return "Enter a valid phone number (10–15 digits).";
  }
  if (!PHONE_RE.test(phone)) {
    return "Enter a valid phone number.";
  }
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Password is required.";
  if (value.length < 8) return "Password must be at least 8 characters.";
  return null;
}

/** Normalize phone for API payload (keep leading + if present, strip other formatting). */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  return trimmed.replace(/\D/g, "");
}
