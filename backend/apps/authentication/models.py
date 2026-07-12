from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class UserRole(models.TextChoices):
    ADMIN = "admin", "Admin"
    ASSET_MANAGER = "asset_manager", "Asset Manager"
    DEPARTMENT_HEAD = "department_head", "Department Head"
    EMPLOYEE = "employee", "Employee"


class UserStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"


class UserManager(BaseUserManager):
    """Creates User instances, using email as the unique identifier."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", UserRole.EMPLOYEE)
        return self._create_user(email, password, **extra_fields)

    def create_user_from_hashed_password(self, email, password_hash, **extra_fields):
        """Like create_user, but accepts an already-hashed password.

        Used by the OTP-gated signup flow: the password is hashed at
        OTP-issue time (before the account exists) and handed to us
        pre-hashed here, so it must never be re-hashed via set_password.
        """
        if not email:
            raise ValueError("Users must have an email address")
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", UserRole.EMPLOYEE)
        email = self.normalize_email(email)
        user = self.model(email=email, password=password_hash, **extra_fields)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", UserRole.ADMIN)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Employee directory record + auth in one table.

    Signup always creates role='employee'. Admin promotes users via the
    organization APIs — role is never selectable at signup.
    """

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=32, blank=True, default="")

    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employees",
    )
    role = models.CharField(
        max_length=32,
        choices=UserRole.choices,
        default=UserRole.EMPLOYEE,
    )
    status = models.CharField(
        max_length=16,
        choices=UserStatus.choices,
        default=UserStatus.ACTIVE,
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    def __str__(self):
        return self.email
