"""Email delivery for one-time passcodes."""

from django.conf import settings
from django.core.mail import send_mail

_SUBJECTS = {
    "signup": "Verify your email",
    "login": "Your login code",
    "password_reset": "Your password reset code",
}


def send_otp_email(email, code, purpose):
    subject = _SUBJECTS.get(purpose, "Your verification code")
    message = f"Your code is {code}. It expires in 5 minutes."
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )
