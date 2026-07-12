from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Public-facing representation of a user, used in login/register/me responses."""

    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "phone",
            "role",
            "status",
            "department",
            "department_name",
        )
        read_only_fields = fields


class AuthSessionSerializer(serializers.Serializer):
    """Access JWT in the body + user payload. Refresh token is an httpOnly cookie."""

    access = serializers.CharField(help_text="JWT access token (Bearer).")
    user = UserSerializer()


class AccessTokenSerializer(serializers.Serializer):
    """Response from POST /api/auth/refresh/."""

    access = serializers.CharField()


class DetailMessageSerializer(serializers.Serializer):
    """Generic `{detail: string}` response used across auth and resource actions."""

    detail = serializers.CharField()


class RegisterSerializer(serializers.Serializer):
    """Direct signup (no OTP). Creates the account immediately with role='employee'."""

    full_name = serializers.CharField(max_length=150, min_length=2)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_full_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Full name is required.")
        return value


class SignupOTPRequestSerializer(serializers.Serializer):
    """Validates signup details before an OTP is issued. Does not create a user.

    Only three fields are accepted at signup — role is never selectable and
    defaults to 'employee'. Admin promotes users via the organization APIs.
    """

    full_name = serializers.CharField(max_length=150, min_length=2)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_full_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Full name is required.")
        return value


class OTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)


class LoginOTPRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])


class LoginSerializer(serializers.Serializer):
    """Validates email + password credentials against Django's auth backend."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["email"],
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account is inactive.")
        attrs["user"] = user
        return attrs
