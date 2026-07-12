"""Seed a single admin account on first migrate.

Credentials come from env: ADMIN_EMAIL / ADMIN_PASSWORD (with defaults for dev).
If a user with ADMIN_EMAIL already exists we leave it alone.
"""

import os

from django.contrib.auth.hashers import make_password
from django.db import migrations

DEFAULT_ADMIN_EMAIL = "admin@assetflow.local"
DEFAULT_ADMIN_PASSWORD = "Admin@12345"
DEFAULT_ADMIN_NAME = "Administrator"


def seed_admin(apps, schema_editor):
    User = apps.get_model("authentication", "User")

    email = os.environ.get("ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL).strip().lower()
    password = os.environ.get("ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD)
    full_name = os.environ.get("ADMIN_NAME", DEFAULT_ADMIN_NAME)

    if User.objects.filter(email__iexact=email).exists():
        return

    User.objects.create(
        email=email,
        full_name=full_name,
        password=make_password(password),
        role="admin",
        status="active",
        is_staff=True,
        is_superuser=True,
        is_active=True,
    )


def unseed_admin(apps, schema_editor):
    User = apps.get_model("authentication", "User")
    email = os.environ.get("ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL).strip().lower()
    User.objects.filter(email__iexact=email, role="admin").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("organization", "0001_initial"),
        ("authentication", "0002_user_department"),
    ]

    operations = [
        migrations.RunPython(seed_admin, reverse_code=unseed_admin),
    ]
