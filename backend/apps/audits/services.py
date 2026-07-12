from django.db import transaction
from django.utils import timezone

from apps.assets.models import Asset, AssetCondition, AssetStatus

from .models import (
    AuditCycle,
    AuditCycleStatus,
    AuditItem,
    AuditVerdict,
    Discrepancy,
    DiscrepancyKind,
)


@transaction.atomic
def create_cycle(
    *, name, starts_on, ends_on, scope_department, scope_location, auditor_ids, created_by
):
    """Create a cycle and snapshot every in-scope asset as a pending AuditItem."""
    cycle = AuditCycle.objects.create(
        name=name,
        starts_on=starts_on,
        ends_on=ends_on,
        scope_department=scope_department,
        scope_location=scope_location,
        created_by=created_by,
    )
    if auditor_ids:
        cycle.auditors.set(auditor_ids)

    assets_qs = Asset.objects.all()
    if scope_department:
        assets_qs = assets_qs.filter(department=scope_department)
    if scope_location:
        assets_qs = assets_qs.filter(location=scope_location)

    AuditItem.objects.bulk_create(AuditItem(cycle=cycle, asset=asset) for asset in assets_qs)
    return cycle


@transaction.atomic
def set_verdict(*, item, verdict, performed_by, notes=""):
    """Record an auditor's verdict and keep the item's Discrepancy row in sync."""
    item.verdict = verdict
    item.verified_by = performed_by
    item.verified_at = timezone.now()
    item.notes = notes
    item.save(update_fields=["verdict", "verified_by", "verified_at", "notes"])

    if verdict in (AuditVerdict.MISSING, AuditVerdict.DAMAGED):
        kind = (
            DiscrepancyKind.MISSING if verdict == AuditVerdict.MISSING else DiscrepancyKind.DAMAGED
        )
        Discrepancy.objects.update_or_create(
            audit_item=item,
            defaults={
                "kind": kind,
                "detail": notes,
                "resolved": False,
                "resolved_by": None,
                "resolved_at": None,
            },
        )
    else:
        Discrepancy.objects.filter(audit_item=item).delete()

    return item


@transaction.atomic
def resolve_discrepancy(*, discrepancy, performed_by):
    discrepancy.resolved = True
    discrepancy.resolved_by = performed_by
    discrepancy.resolved_at = timezone.now()
    discrepancy.save(update_fields=["resolved", "resolved_by", "resolved_at"])
    return discrepancy


@transaction.atomic
def close_cycle(*, cycle, performed_by):
    """Lock the cycle and apply confirmed-missing/damaged verdicts to the real asset."""
    if cycle.status == AuditCycleStatus.CLOSED:
        raise ValueError("Cycle is already closed.")

    missing_asset_ids = list(
        cycle.items.filter(verdict=AuditVerdict.MISSING).values_list("asset_id", flat=True)
    )
    damaged_asset_ids = list(
        cycle.items.filter(verdict=AuditVerdict.DAMAGED).values_list("asset_id", flat=True)
    )
    if missing_asset_ids:
        Asset.objects.filter(id__in=missing_asset_ids).update(status=AssetStatus.LOST)
    if damaged_asset_ids:
        Asset.objects.filter(id__in=damaged_asset_ids).update(condition=AssetCondition.DAMAGED)

    cycle.status = AuditCycleStatus.CLOSED
    cycle.closed_by = performed_by
    cycle.closed_at = timezone.now()
    cycle.save(update_fields=["status", "closed_by", "closed_at"])
    return cycle
