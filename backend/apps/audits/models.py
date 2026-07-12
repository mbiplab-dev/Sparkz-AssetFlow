from django.conf import settings
from django.db import models

from apps.assets.models import Asset, Location
from apps.organization.models import Department


class AuditCycleStatus(models.TextChoices):
    OPEN = "open", "Open"
    CLOSED = "closed", "Closed"


class AuditVerdict(models.TextChoices):
    PENDING = "pending", "Pending"
    VERIFIED = "verified", "Verified"
    MISSING = "missing", "Missing"
    DAMAGED = "damaged", "Damaged"


class DiscrepancyKind(models.TextChoices):
    MISSING = "missing", "Missing"
    DAMAGED = "damaged", "Damaged"


class AuditCycle(models.Model):
    """A structured verification cycle over a scoped set of assets."""

    name = models.CharField(max_length=150)
    scope_department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_cycles"
    )
    scope_location = models.ForeignKey(
        Location, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_cycles"
    )
    starts_on = models.DateField()
    ends_on = models.DateField()
    status = models.CharField(
        max_length=16, choices=AuditCycleStatus.choices, default=AuditCycleStatus.OPEN
    )
    auditors = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="audit_cycles_assigned", blank=True
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(ends_on__gte=models.F("starts_on")),
                name="audit_cycle_ends_on_gte_starts_on",
            ),
        ]

    def __str__(self):
        return self.name


class AuditItem(models.Model):
    """One asset's verification row within a cycle."""

    cycle = models.ForeignKey(AuditCycle, on_delete=models.CASCADE, related_name="items")
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="audit_items")
    verdict = models.CharField(
        max_length=16, choices=AuditVerdict.choices, default=AuditVerdict.PENDING
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["asset__asset_tag"]
        constraints = [
            models.UniqueConstraint(
                fields=["cycle", "asset"], name="uniq_audit_item_per_cycle_asset"
            ),
        ]

    def __str__(self):
        return f"{self.cycle_id}:{self.asset_id}={self.verdict}"


class Discrepancy(models.Model):
    """Auto-generated for any AuditItem flagged missing/damaged; independently resolvable."""

    audit_item = models.OneToOneField(
        AuditItem, on_delete=models.CASCADE, related_name="discrepancy"
    )
    kind = models.CharField(max_length=16, choices=DiscrepancyKind.choices)
    detail = models.TextField(blank=True, default="")
    resolved = models.BooleanField(default=False)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Discrepancy({self.audit_item_id}, {self.kind})"
