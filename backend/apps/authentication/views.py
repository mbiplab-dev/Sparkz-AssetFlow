"""Auth endpoints.

Each view stays thin: validate input via a serializer, then delegate all
token/cookie handling to apps.authentication.tokens.
"""

from django.contrib.auth.hashers import make_password
from django.db import IntegrityError
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken

from .models import User
from .otp import OTPError, issue_otp, verify_otp
from .serializers import (
    LoginOTPRequestSerializer,
    LoginSerializer,
    OTPVerifySerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    SignupOTPRequestSerializer,
    UserSerializer,
)
from .tokens import (
    blacklist_refresh_token,
    clear_refresh_cookie,
    get_refresh_token_from_request,
    issue_tokens_for_user,
    rotate_refresh_token,
    set_refresh_cookie,
)


class RegisterView(APIView):
    """Direct signup with no OTP step. Creates the account and logs the user in.

    Accepts full_name, email, phone (optional), password. Role always defaults
    to 'employee' — role is only assignable by admin via the organization APIs.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Register a new employee (no OTP)",
        request=RegisterSerializer,
        responses={201: UserSerializer},
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            user = User.objects.create_user(
                email=data["email"],
                password=data["password"],
                full_name=data["full_name"],
                phone=data.get("phone", ""),
            )
        except IntegrityError:
            return Response(
                {"detail": "An account with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refresh_token, access_token = issue_tokens_for_user(user)
        response = Response(
            {"access": access_token, "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )
        return set_refresh_cookie(response, refresh_token)


class RequestSignupOTPView(APIView):
    """Validate signup details and email a verification code.

    No user is created yet - that happens in VerifySignupOTPView, once the
    code is confirmed.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Request signup verification code",
        request=SignupOTPRequestSerializer,
    )
    def post(self, request):
        serializer = SignupOTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            issue_otp(
                purpose="signup",
                email=data["email"],
                extra={
                    "full_name": data["full_name"],
                    "password_hash": make_password(data["password"]),
                },
            )
        except OTPError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {"detail": "Failed to send the verification email. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"detail": "Verification code sent."})


class VerifySignupOTPView(APIView):
    """Verify the signup code, create the account, and log the user in."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Verify signup code and create account",
        request=OTPVerifySerializer,
        responses={201: UserSerializer},
    )
    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]

        try:
            pending = verify_otp("signup", email, code)
        except OTPError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.create_user_from_hashed_password(
                email=email,
                password_hash=pending["password_hash"],
                full_name=pending["full_name"],
            )
        except IntegrityError:
            return Response(
                {"detail": "An account with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refresh_token, access_token = issue_tokens_for_user(user)
        response = Response(
            {"access": access_token, "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )
        return set_refresh_cookie(response, refresh_token)


class RequestLoginOTPView(APIView):
    """Email a login code if the address belongs to an active account.

    Always returns the same generic response either way, so the response
    itself never reveals whether a given email is registered.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Request login verification code",
        request=LoginOTPRequestSerializer,
    )
    def post(self, request):
        serializer = LoginOTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        if User.objects.filter(email__iexact=email, is_active=True).exists():
            try:
                issue_otp(purpose="login", email=email)
            except OTPError:
                pass  # cooldown already in effect - fine, stay silent either way
            except Exception:
                return Response(
                    {"detail": "Failed to send the verification email. Please try again."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        return Response({"detail": "If an account exists for this email, a code has been sent."})


class VerifyLoginOTPView(APIView):
    """Verify a login code and issue tokens - same response contract as LoginView."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Verify login code",
        request=OTPVerifySerializer,
        responses={200: UserSerializer},
    )
    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]

        try:
            verify_otp("login", email, code)
        except OTPError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            return Response(
                {"detail": "Incorrect code. Please try again."}, status=status.HTTP_400_BAD_REQUEST
            )

        refresh_token, access_token = issue_tokens_for_user(user)
        response = Response({"access": access_token, "user": UserSerializer(user).data})
        return set_refresh_cookie(response, refresh_token)


class RequestPasswordResetOTPView(APIView):
    """Email a password-reset code, if the address belongs to an active account.

    Unlike the login-OTP request, this explicitly reveals whether the email
    is registered - a deliberate choice for this endpoint.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Request password-reset code",
        request=PasswordResetRequestSerializer,
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        if not User.objects.filter(email__iexact=email, is_active=True).exists():
            return Response(
                {"detail": "No account found with this email."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            issue_otp(purpose="password_reset", email=email)
        except OTPError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {"detail": "Failed to send the verification email. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"detail": "Verification code sent."})


class ConfirmPasswordResetView(APIView):
    """Verify a password-reset code and set the new password.

    Doesn't log the user in - they sign in with the new password afterward.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Confirm password reset",
        request=PasswordResetConfirmSerializer,
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]
        new_password = serializer.validated_data["new_password"]

        try:
            verify_otp("password_reset", email, code)
        except OTPError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            return Response(
                {"detail": "No account found with this email."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])

        return Response({"detail": "Password reset successful."})


class LoginView(APIView):
    """Exchange email + password for an access token (body) and refresh cookie."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Log in with email and password",
        request=LoginSerializer,
        responses={200: UserSerializer},
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        refresh_token, access_token = issue_tokens_for_user(user)
        response = Response({"access": access_token, "user": UserSerializer(user).data})
        return set_refresh_cookie(response, refresh_token)


class RefreshView(APIView):
    """Exchange the refresh cookie for a new access token, rotating the cookie."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Refresh access token",
        request=None,
    )
    def post(self, request):
        raw_refresh_token = get_refresh_token_from_request(request)
        if raw_refresh_token is None:
            raise InvalidToken("No refresh token cookie found.")

        access_token, new_refresh_token = rotate_refresh_token(raw_refresh_token)

        response = Response({"access": access_token})
        if new_refresh_token is not None:
            response = set_refresh_cookie(response, new_refresh_token)
        return response


class LogoutView(APIView):
    """Blacklist the current refresh token and clear its cookie."""

    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Authentication"], summary="Log out", request=None, responses={204: None})
    def post(self, request):
        raw_refresh_token = get_refresh_token_from_request(request)
        if raw_refresh_token is not None:
            blacklist_refresh_token(raw_refresh_token)

        response = Response(status=status.HTTP_204_NO_CONTENT)
        return clear_refresh_cookie(response)


class MeView(APIView):
    """Return the authenticated user - lets the frontend hydrate/verify a session."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Authentication"],
        summary="Get the current user",
        responses=UserSerializer,
    )
    def get(self, request):
        return Response(UserSerializer(request.user).data)
