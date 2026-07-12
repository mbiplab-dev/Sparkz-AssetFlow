from django.urls import path

from .views import (
    ConfirmPasswordResetView,
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
    RequestLoginOTPView,
    RequestPasswordResetOTPView,
    RequestSignupOTPView,
    VerifyLoginOTPView,
    VerifySignupOTPView,
)

urlpatterns = [
    path("register/request-otp/", RequestSignupOTPView.as_view(), name="auth-register-request-otp"),
    path("register/verify-otp/", VerifySignupOTPView.as_view(), name="auth-register-verify-otp"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("login/request-otp/", RequestLoginOTPView.as_view(), name="auth-login-request-otp"),
    path("login/verify-otp/", VerifyLoginOTPView.as_view(), name="auth-login-verify-otp"),
    path(
        "password-reset/request-otp/",
        RequestPasswordResetOTPView.as_view(),
        name="auth-password-reset-request-otp",
    ),
    path(
        "password-reset/confirm/",
        ConfirmPasswordResetView.as_view(),
        name="auth-password-reset-confirm",
    ),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
]
