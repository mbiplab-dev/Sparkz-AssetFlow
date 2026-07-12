"""Cache-backed one-time-passcode issuance and verification.

Each OTP is a random 6-digit code, hashed (bound to the email so it can't be
replayed against a different address) before being cached in Django's default
cache backend, valid for OTP_TTL_SECONDS, rate-limited by a resend cooldown,
and capped on incorrect verification attempts.
"""

import hashlib
import random

from django.core.cache import cache
from django.utils import timezone

from .mail import send_otp_email

OTP_TTL_SECONDS = 5 * 60
RESEND_COOLDOWN_SECONDS = 60
MAX_VERIFY_ATTEMPTS = 5


class OTPError(Exception):
    """Raised for any OTP issuance/verification failure; message is user-facing."""


def _otp_cache_key(purpose, email):
    return f"otp:{purpose}:{email.lower()}"


def _cooldown_cache_key(purpose, email):
    return f"otp-cooldown:{purpose}:{email.lower()}"


def _generate_code():
    return f"{random.randint(0, 999999):06d}"


def _hash_code(email, code):
    return hashlib.sha256(f"{email.lower()}:{code}".encode()).hexdigest()


def issue_otp(purpose, email, extra=None):
    """Generate a code, email it, then cache it (only after the send succeeds).

    Raises OTPError if a resend is requested before the cooldown elapses.
    Any exception raised by send_otp_email propagates unchanged (callers
    should catch it separately from OTPError and turn it into a 500).
    """
    if cache.get(_cooldown_cache_key(purpose, email)):
        raise OTPError("Please wait before requesting another code.")

    code = _generate_code()
    send_otp_email(email, code, purpose)

    expires_at = timezone.now() + timezone.timedelta(seconds=OTP_TTL_SECONDS)
    cache.set(
        _otp_cache_key(purpose, email),
        {
            "code_hash": _hash_code(email, code),
            "attempts": 0,
            "expires_at": expires_at,
            "extra": extra or {},
        },
        timeout=OTP_TTL_SECONDS,
    )
    cache.set(_cooldown_cache_key(purpose, email), True, timeout=RESEND_COOLDOWN_SECONDS)


def verify_otp(purpose, email, submitted_code):
    """Validate a submitted code. Returns the `extra` dict stashed at issue
    time on success. Raises OTPError with a user-facing message otherwise."""
    key = _otp_cache_key(purpose, email)
    record = cache.get(key)
    if record is None:
        raise OTPError("This code has expired or was never requested. Please request a new one.")

    if timezone.now() >= record["expires_at"]:
        cache.delete(key)
        raise OTPError("This code has expired. Please request a new one.")

    if record["attempts"] >= MAX_VERIFY_ATTEMPTS:
        cache.delete(key)
        raise OTPError("Too many incorrect attempts. Please request a new code.")

    if _hash_code(email, submitted_code) != record["code_hash"]:
        record["attempts"] += 1
        remaining = (record["expires_at"] - timezone.now()).total_seconds()
        cache.set(key, record, timeout=max(int(remaining), 1))
        raise OTPError("Incorrect code. Please try again.")

    cache.delete(key)
    return record["extra"]
