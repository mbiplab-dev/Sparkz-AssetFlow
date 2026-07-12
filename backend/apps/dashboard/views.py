from datetime import timedelta

from django.apps import apps as django_apps
from django.db.models import Count, Sum
from django.db.models.functions import ExtractHour
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    DashboardReportsSerializer,
    DashboardSummarySerializer,
    NotificationItemSerializer,
)

# Fixed status vocabularies so charts never omit zero buckets.
ASSET_STATUSES = (
    "available",
    "allocated",
    "reserved",
    "under_maintenance",
    "lost",
    "retired",
    "disposed",
)
MAINT_STATUSES = (
    "pending",
    "approved",
    "rejected",
    "assigned",
    "in_progress",
    "resolved",
    "cancelled",
)


def _model(app_label, model_name):
    """Return the model if its app is installed yet, else None."""
    try:
        return django_apps.get_model(app_label, model_name)
    except LookupError:
        return None


class DashboardSummaryView(APIView):
    """Aggregate counts + activity feed for Screen 2 (Dashboard / Home)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Dashboard"],
        summary="Dashboard summary (KPIs + recent activity)",
        responses=DashboardSummarySerializer,
    )
    def get(self, request):
        today = timezone.localdate()
        now = timezone.now()
        user = request.user
        role = getattr(user, "role", None)

        kpis = {
            "assets_available": 0,
            "assets_allocated": 0,
            "maintenance_today": 0,
            "active_bookings": 0,
            "pending_transfers": 0,
            "upcoming_returns": 0,
            "overdue_returns": 0,
        }

        Asset = _model("assets", "Asset")
        MaintenanceRequest = _model("maintenance", "MaintenanceRequest")
        Booking = _model("booking", "Booking")
        AllocationRequest = _model("resource_allocation", "AllocationRequest")
        Holding = _model("resource_allocation", "Holding")
        ActivityLog = _model("activity", "ActivityLog")

        # Employees get personal KPIs (own holdings / own tickets), not org totals.
        if role == "employee":
            if Holding is not None:
                mine = Holding.objects.filter(
                    holder_type="employee", holder_id=user.id, quantity__gt=0
                )
                units = int(mine.aggregate(t=Sum("quantity"))["t"] or 0)
                kpis["assets_allocated"] = units
                kpis["upcoming_returns"] = units
            if Asset is not None:
                # Shared resources they can still book.
                kpis["assets_available"] = Asset.objects.filter(
                    is_bookable=True, status="available"
                ).count()
            if MaintenanceRequest is not None:
                open_statuses = ("pending", "approved", "assigned", "in_progress")
                kpis["maintenance_today"] = MaintenanceRequest.objects.filter(
                    raised_by=user, status__in=open_statuses
                ).count()
            if Booking is not None:
                kpis["active_bookings"] = (
                    Booking.objects.filter(
                        booked_by=user,
                        status__in=("upcoming", "ongoing"),
                        ends_at__gte=now,
                    )
                    .exclude(status="cancelled")
                    .count()
                )
            # Employees don't approve transfers; show 0 rather than org queue.
            kpis["pending_transfers"] = 0
            kpis["overdue_returns"] = 0

            recent_activity = []
            if ActivityLog is not None:
                recent_activity = [
                    {
                        "id": log.id,
                        "message": log.message or str(log),
                        "timestamp": log.created_at,
                    }
                    for log in ActivityLog.objects.filter(actor=user).order_by("-created_at")[:10]
                ]
            return Response({"kpis": kpis, "recent_activity": recent_activity})

        # ── Manager / admin / head: org (or wider) operational totals ─────
        if Asset is not None:
            by_status = {
                row["status"]: row["n"]
                for row in Asset.objects.values("status").annotate(n=Count("id"))
            }
            kpis["assets_available"] = int(by_status.get("available", 0))
            kpis["assets_allocated"] = int(by_status.get("allocated", 0))

        # "Open maintenance" = work currently in the pipeline.
        if MaintenanceRequest is not None:
            open_statuses = ("pending", "approved", "assigned", "in_progress")
            kpis["maintenance_today"] = MaintenanceRequest.objects.filter(
                status__in=open_statuses
            ).count()

        if Booking is not None:
            kpis["active_bookings"] = (
                Booking.objects.filter(
                    status__in=("upcoming", "ongoing"),
                    ends_at__gte=now,
                )
                .exclude(status="cancelled")
                .count()
            )

        if AllocationRequest is not None:
            kpis["pending_transfers"] = AllocationRequest.objects.filter(
                status__in=("open", "partially_fulfilled")
            ).count()

        # Items currently out (employee/dept holdings) as "upcoming returns".
        if Holding is not None:
            out_qs = Holding.objects.exclude(holder_type="manager").filter(quantity__gt=0)
            kpis["upcoming_returns"] = out_qs.count()
            if AllocationRequest is not None:
                week_ago = today - timedelta(days=7)
                kpis["overdue_returns"] = AllocationRequest.objects.filter(
                    status__in=("open", "partially_fulfilled"),
                    created_at__date__lt=week_ago,
                ).count()

        # Fallback: if catalog says allocated but no holdings rows, mirror that.
        if kpis["upcoming_returns"] == 0 and kpis["assets_allocated"] > 0:
            kpis["upcoming_returns"] = kpis["assets_allocated"]

        recent_activity = []
        if ActivityLog is not None:
            recent_activity = [
                {
                    "id": log.id,
                    "message": log.message or str(log),
                    "timestamp": log.created_at,
                }
                for log in ActivityLog.objects.order_by("-created_at")[:10]
            ]

        return Response({"kpis": kpis, "recent_activity": recent_activity})


class DashboardReportsView(APIView):
    """Full analytics aggregation for the Reports & Analytics screen."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Dashboard"],
        summary="Full analytics report",
        responses=DashboardReportsSerializer,
    )
    def get(self, request):
        today = timezone.localdate()
        now = timezone.now()

        # Always emit every status bucket (0 when empty) so charts stay stable.
        assets_by_status = {s: 0 for s in ASSET_STATUSES}
        assets_by_category: list[dict] = []
        assets_by_department: list[dict] = []
        maintenance_by_status = {s: 0 for s in MAINT_STATUSES}
        maintenance_by_category: list[dict] = []
        top_used_assets: list[dict] = []
        booking_load_by_hour: list[dict] = [{"hour": h, "count": 0} for h in range(24)]
        overdue_returns_count = 0
        totals = {
            "assets_total": 0,
            "assets_bookable": 0,
            "bookings_active": 0,
            "bookings_total": 0,
            "maintenance_open": 0,
            "holdings_out": 0,
            "resource_pool_units": 0,
        }

        Asset = _model("assets", "Asset")
        if Asset is not None:
            totals["assets_total"] = Asset.objects.count()
            totals["assets_bookable"] = Asset.objects.filter(is_bookable=True).count()
            for row in Asset.objects.values("status").annotate(n=Count("id")):
                if row["status"] in assets_by_status:
                    assets_by_status[row["status"]] = row["n"]
                else:
                    assets_by_status[row["status"]] = row["n"]

            assets_by_category = [
                {"category": row["category__name"] or "Uncategorized", "count": row["n"]}
                for row in (
                    Asset.objects.values("category__name").annotate(n=Count("id")).order_by("-n")
                )
            ]

            assets_by_department = [
                {"department": row["department__name"] or "Unassigned", "count": row["n"]}
                for row in (
                    Asset.objects.values("department__name").annotate(n=Count("id")).order_by("-n")
                )
                if row["n"] > 0
            ]

        MaintenanceRequest = _model("maintenance", "MaintenanceRequest")
        if MaintenanceRequest is not None:
            for row in MaintenanceRequest.objects.values("status").annotate(n=Count("id")):
                if row["status"] in maintenance_by_status:
                    maintenance_by_status[row["status"]] = row["n"]
                else:
                    maintenance_by_status[row["status"]] = row["n"]

            totals["maintenance_open"] = MaintenanceRequest.objects.filter(
                status__in=("pending", "approved", "assigned", "in_progress")
            ).count()

            maintenance_by_category = [
                {
                    "category": row["asset__category__name"] or "Uncategorized",
                    "count": row["n"],
                }
                for row in (
                    MaintenanceRequest.objects.values("asset__category__name")
                    .annotate(n=Count("id"))
                    .order_by("-n")
                )
            ]

            top_rows = (
                MaintenanceRequest.objects.values("asset__id", "asset__asset_tag", "asset__name")
                .annotate(n=Count("id"))
                .order_by("-n")[:8]
            )
            top_used_assets = [
                {
                    "asset_id": row["asset__id"],
                    "asset_tag": row["asset__asset_tag"] or "",
                    "name": row["asset__name"] or "Unknown",
                    "count": row["n"],
                }
                for row in top_rows
            ]

        Booking = _model("booking", "Booking")
        if Booking is not None:
            totals["bookings_total"] = Booking.objects.exclude(status="cancelled").count()
            totals["bookings_active"] = Booking.objects.filter(
                status__in=("upcoming", "ongoing"),
                ends_at__gte=now,
            ).count()

            hour_counts = {
                int(row["hour"]): row["n"]
                for row in (
                    Booking.objects.exclude(status="cancelled")
                    .annotate(hour=ExtractHour("starts_at"))
                    .values("hour")
                    .annotate(n=Count("id"))
                )
                if row["hour"] is not None
            }
            booking_load_by_hour = [
                {"hour": h, "count": int(hour_counts.get(h, 0))} for h in range(24)
            ]

        Holding = _model("resource_allocation", "Holding")
        if Holding is not None:
            totals["holdings_out"] = (
                Holding.objects.exclude(holder_type="manager").filter(quantity__gt=0).count()
            )
            pool = (
                Holding.objects.filter(holder_type="manager", quantity__gt=0).aggregate(
                    s=Sum("quantity")
                )["s"]
                or 0
            )
            totals["resource_pool_units"] = int(pool)

        AllocationRequest = _model("resource_allocation", "AllocationRequest")
        if AllocationRequest is not None:
            week_ago = today - timedelta(days=7)
            overdue_returns_count = AllocationRequest.objects.filter(
                status__in=("open", "partially_fulfilled"),
                created_at__date__lt=week_ago,
            ).count()

        # Prefer maintenance-frequency top assets; if empty, fall back to
        # bookable / high-status catalog so the card is never blank.
        if not top_used_assets and Asset is not None:
            top_used_assets = [
                {
                    "asset_id": a.id,
                    "asset_tag": a.asset_tag,
                    "name": a.name,
                    "count": 0,
                }
                for a in Asset.objects.order_by("-updated_at")[:5]
            ]

        return Response(
            {
                "assets_by_status": assets_by_status,
                "assets_by_category": assets_by_category,
                "assets_by_department": assets_by_department,
                "maintenance_by_status": maintenance_by_status,
                "maintenance_by_category": maintenance_by_category,
                "top_used_assets": top_used_assets,
                "booking_load_by_hour": booking_load_by_hour,
                "overdue_returns_count": overdue_returns_count,
                "totals": totals,
            }
        )


def _actor_name(user):
    if user is None:
        return None
    return getattr(user, "full_name", None) or getattr(user, "email", None)


def _truncate(text, limit=120):
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "\u2026"


class DashboardNotificationsView(APIView):
    """Merged activity feed derived from existing domain tables."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Dashboard"],
        summary="Activity / notifications feed",
        responses=NotificationItemSerializer(many=True),
    )
    def get(self, request):
        now = timezone.now()
        since = now - timedelta(days=30)
        items: list[dict] = []

        MaintenanceRequest = _model("maintenance", "MaintenanceRequest")
        if MaintenanceRequest is not None:
            for mr in MaintenanceRequest.objects.select_related("asset", "raised_by").filter(
                created_at__gte=since
            ):
                items.append(
                    {
                        "id": f"maint-created-{mr.pk}",
                        "kind": "maintenance_created",
                        "title": "Maintenance request raised",
                        "body": _truncate(mr.issue_description),
                        "entity": "maintenance_request",
                        "entity_id": mr.pk,
                        "actor_name": _actor_name(mr.raised_by),
                        "timestamp": mr.created_at,
                    }
                )

            for mr in MaintenanceRequest.objects.select_related("asset", "approved_by").filter(
                approved_at__isnull=False, approved_at__gte=since
            ):
                items.append(
                    {
                        "id": f"maint-approved-{mr.pk}",
                        "kind": "maintenance_approved",
                        "title": "Maintenance request approved",
                        "body": _truncate(mr.issue_description),
                        "entity": "maintenance_request",
                        "entity_id": mr.pk,
                        "actor_name": _actor_name(mr.approved_by),
                        "timestamp": mr.approved_at,
                    }
                )

            for mr in MaintenanceRequest.objects.select_related("asset", "technician").filter(
                resolved_at__isnull=False, resolved_at__gte=since
            ):
                items.append(
                    {
                        "id": f"maint-resolved-{mr.pk}",
                        "kind": "maintenance_resolved",
                        "title": "Maintenance request resolved",
                        "body": _truncate(mr.resolution_notes or mr.issue_description),
                        "entity": "maintenance_request",
                        "entity_id": mr.pk,
                        "actor_name": _actor_name(mr.technician),
                        "timestamp": mr.resolved_at,
                    }
                )

        Booking = _model("booking", "Booking")
        if Booking is not None:
            for b in Booking.objects.select_related("asset", "booked_by").filter(
                created_at__gte=since
            ):
                items.append(
                    {
                        "id": f"book-created-{b.pk}",
                        "kind": "booking_created",
                        "title": "Booking created",
                        "body": _truncate(b.purpose or f"Booking for {b.asset}"),
                        "entity": "booking",
                        "entity_id": b.pk,
                        "actor_name": _actor_name(b.booked_by),
                        "timestamp": b.created_at,
                    }
                )

            for b in Booking.objects.select_related("asset", "cancelled_by").filter(
                cancelled_at__isnull=False, cancelled_at__gte=since
            ):
                items.append(
                    {
                        "id": f"book-cancelled-{b.pk}",
                        "kind": "booking_cancelled",
                        "title": "Booking cancelled",
                        "body": _truncate(b.purpose or f"Booking for {b.asset}"),
                        "entity": "booking",
                        "entity_id": b.pk,
                        "actor_name": _actor_name(b.cancelled_by),
                        "timestamp": b.cancelled_at,
                    }
                )

        Transfer = _model("resource_allocation", "Transfer")
        if Transfer is not None:
            for t in Transfer.objects.select_related("asset", "performed_by").filter(
                kind="allocate", created_at__gte=since
            ):
                items.append(
                    {
                        "id": f"xfer-alloc-{t.pk}",
                        "kind": "asset_allocated",
                        "title": "Asset allocated",
                        "body": _truncate(
                            f"{t.quantity} × {t.asset} → {t.to_holder_type}:{t.to_holder_id}"
                        ),
                        "entity": "transfer",
                        "entity_id": t.pk,
                        "actor_name": _actor_name(t.performed_by),
                        "timestamp": t.created_at,
                    }
                )

        # Activity log rows for a fuller feed.
        ActivityLog = _model("activity", "ActivityLog")
        if ActivityLog is not None:
            for log in ActivityLog.objects.select_related("actor").filter(created_at__gte=since)[
                :30
            ]:
                items.append(
                    {
                        "id": f"activity-{log.pk}",
                        "kind": "asset_allocated"
                        if "allocat" in (log.action or "")
                        else "maintenance_created",
                        "title": (log.action or "activity").replace(".", " ").title(),
                        "body": _truncate(log.message),
                        "entity": log.entity_type or "activity",
                        "entity_id": int(log.entity_id) if str(log.entity_id).isdigit() else 0,
                        "actor_name": _actor_name(log.actor),
                        "timestamp": log.created_at,
                    }
                )

        items.sort(key=lambda i: i["timestamp"], reverse=True)
        items = items[:50]
        for it in items:
            ts = it["timestamp"]
            it["timestamp"] = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
        return Response(items)
