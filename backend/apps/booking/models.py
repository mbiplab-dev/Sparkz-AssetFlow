from django.conf import settings
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField
from django.db import models
from django.db.models.expressions import Func, F

from apps.assets.models import Asset
from apps.organization.models import Department


class TstzRange(Func):
    """Postgres tstzrange(starts_at, ends_at, '[)') expression."""

    function = "tstzrange"
    output_field = DateTimeRangeField()


class BookingStatus(models.TextChoices):
    UPCOMING = "upcoming", "Upcoming"
    ONGOING = "ongoing", "Ongoing"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class Booking(models.Model):
    """Time-slot booking for a shared / bookable asset.

    The no-overlap invariant for non-cancelled bookings on the same asset is
    enforced at the database level via a Postgres GiST EXCLUDE constraint on
    ``tstzrange(starts_at, ends_at, '[)')`` (added in the initial migration).
    Ranges are half-open, so ``[09:00, 10:00)`` and ``[10:00, 11:00)`` do NOT
    overlap.
    """

    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    booked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="bookings",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bookings",
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    purpose = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=16,
        choices=BookingStatus.choices,
        default=BookingStatus.UPCOMING,
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bookings_cancelled",
    )
    reminder_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["starts_at"]
        indexes = [
            models.Index(fields=["asset", "starts_at", "ends_at"]),
            models.Index(fields=["booked_by"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(ends_at__gt=models.F("starts_at")),
                name="booking_ends_after_starts",
            ),
            ExclusionConstraint(
                name="booking_no_overlap",
                expressions=[
                    ("asset", "="),
                    (
                        TstzRange(
                            F("starts_at"),
                            F("ends_at"),
                            models.Value("[)"),
                        ),
                        "&&",
                    ),
                ],
                condition=models.Q(status__in=("upcoming", "ongoing")),
            ),
        ]

    def __str__(self):
        return f"{self.asset_id} @ {self.starts_at:%Y-%m-%d %H:%M}"
