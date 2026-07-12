from django.conf import settings
from django.db import models

from apps.organization.models import AssetCategory, Department


class AssetStatus(models.TextChoices):
    AVAILABLE = "available", "Available"
    ALLOCATED = "allocated", "Allocated"
    RESERVED = "reserved", "Reserved"
    UNDER_MAINTENANCE = "under_maintenance", "Under Maintenance"
    LOST = "lost", "Lost"
    RETIRED = "retired", "Retired"
    DISPOSED = "disposed", "Disposed"


class AssetCondition(models.TextChoices):
    NEW = "new", "New"
    GOOD = "good", "Good"
    FAIR = "fair", "Fair"
    POOR = "poor", "Poor"
    DAMAGED = "damaged", "Damaged"


class Location(models.Model):
    """Physical location used for storage, allocation, and audit scoping."""

    name = models.CharField(max_length=150, unique=True)
    address = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Asset(models.Model):
    """Master asset record with lifecycle status and auto-generated asset tag."""

    asset_tag = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=200)
    category = models.ForeignKey(
        AssetCategory, on_delete=models.PROTECT, related_name="assets"
    )
    serial_number = models.CharField(max_length=200, blank=True, default="")
    qr_code = models.CharField(max_length=200, blank=True, default="")
    acquisition_date = models.DateField(null=True, blank=True)
    acquisition_cost = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    condition = models.CharField(
        max_length=16, choices=AssetCondition.choices, default=AssetCondition.GOOD
    )
    status = models.CharField(
        max_length=24, choices=AssetStatus.choices, default=AssetStatus.AVAILABLE
    )
    location = models.ForeignKey(
        Location, on_delete=models.SET_NULL, null=True, blank=True, related_name="assets"
    )
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="assets"
    )
    is_bookable = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assets_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["category"]),
            models.Index(fields=["department"]),
        ]

    def __str__(self):
        return f"{self.asset_tag} — {self.name}"

    def save(self, *args, **kwargs):
        if not self.asset_tag:
            self.asset_tag = self._generate_tag()
        super().save(*args, **kwargs)

    def _generate_tag(self) -> str:
        last = Asset.objects.order_by("-id").first()
        next_num = (last.id + 1) if last else 1
        return f"AF-{next_num:04d}"
