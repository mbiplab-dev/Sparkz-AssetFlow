from django.conf import settings
from django.db import models


class Status(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"


class Department(models.Model):
    """A department in the organization. Supports hierarchy via `parent`."""

    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=32, blank=True, default="")
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
    )
    head = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="departments_headed",
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class AssetCategory(models.Model):
    """Asset category (Electronics, Furniture, ...) with optional per-category fields."""

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default="")
    custom_fields_schema = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Asset Categories"

    def __str__(self):
        return self.name
