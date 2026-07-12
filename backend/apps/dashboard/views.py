from datetime import timedelta

from django.apps import apps as django_apps
from django.db.models import Count
from django.db.models.functions import ExtractHour
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import DashboardSummarySerializer


def _model(app_label, model_name):
    """Return the model if its app is installed yet, else None.

    The asset/booking/maintenance/audit apps land incrementally during the
    hackathon; the dashboard reports 0 for domains that don't exist yet so the
    frontend contract never changes.
    """
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
        if Asset is not None:
            kpis["assets_available"] = Asset.objects.filter(status="available").count()
            kpis["assets_allocated"] = Asset.objects.filter(status="allocated").count()

        MaintenanceRequest = _model("maintenance", "MaintenanceRequest")
        if MaintenanceRequest is not None:
            kpis["maintenance_today"] = MaintenanceRequest.objects.filter(
                status__in=("approved", "assigned", "in_progress"),
                updated_at__date=today,
            ).count()

        Booking = _model("booking", "Booking")
        if Booking is not None:
            kpis["active_bookings"] = Booking.objects.filter(
                starts_at__lte=now,
                ends_at__gte=now,
                status__in=("upcoming", "ongoing"),
            ).count()

        # Open allocation requests stand in for "pending transfers" in the
        # quantity-ledger model (resource_allocation).
        AllocationRequest = _model("resource_allocation", "AllocationRequest")
        if AllocationRequest is not None:
            kpis["pending_transfers"] = AllocationRequest.objects.filter(
                status__in=("open", "partially_fulfilled")
            ).count()

        recent_activity = []
        ActivityLog = _model("activity", "ActivityLog")
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
    """Full analytics aggregation for the Reports & Analytics screen.

    All aggregation happens in-database so the frontend can render simple
    bar/list widgets without a chart library. Missing apps degrade to empty
    lists / zero counts rather than 500s.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Dashboard"], summary="Full analytics report")
    def get(self, request):
        today = timezone.localdate()

        assets_by_status: dict[str, int] = {}
        assets_by_category: list[dict] = []
        assets_by_department: list[dict] = []
        maintenance_by_status: dict[str, int] = {}
        maintenance_by_category: list[dict] = []
        top_used_assets: list[dict] = []
        booking_load_by_hour: list[dict] = []
        overdue_returns_count = 0

        Asset = _model("assets", "Asset")
        if Asset is not None:
            for row in Asset.objects.values("status").annotate(n=Count("id")):
                assets_by_status[row["status"]] = row["n"]

            assets_by_category = [
                {"category": row["category__name"] or "Uncategorized", "count": row["n"]}
                for row in (
                    Asset.objects.values("category__name")
                    .annotate(n=Count("id"))
                    .order_by("-n")
                )
            ]

            assets_by_department = [
                {"department": row["department__name"], "count": row["n"]}
                for row in (
                    Asset.objects.filter(department__isnull=False)
                    .values("department__name")
                    .annotate(n=Count("id"))
                    .order_by("-n")
                )
                if row["n"] > 0
            ]

        MaintenanceRequest = _model("maintenance", "MaintenanceRequest")
        if MaintenanceRequest is not None:
            for row in MaintenanceRequest.objects.values("status").annotate(n=Count("id")):
                maintenance_by_status[row["status"]] = row["n"]

            maintenance_by_category = [
                {"category": row["asset__category__name"] or "Uncategorized", "count": row["n"]}
                for row in (
                    MaintenanceRequest.objects.values("asset__category__name")
                    .annotate(n=Count("id"))
                    .order_by("-n")
                )
            ]

            top_used_assets = [
                {
                    "asset_id": row["asset__id"],
                    "asset_tag": row["asset__asset_tag"],
                    "name": row["asset__name"],
                    "count": row["n"],
                }
                for row in (
                    MaintenanceRequest.objects.values(
                        "asset__id", "asset__asset_tag", "asset__name"
                    )
                    .annotate(n=Count("id"))
                    .order_by("-n")[:5]
                )
            ]

        Booking = _model("booking", "Booking")
        if Booking is not None:
            hour_counts = {
                row["hour"]: row["n"]
                for row in (
                    Booking.objects.annotate(hour=ExtractHour("starts_at"))
                    .values("hour")
                    .annotate(n=Count("id"))
                )
            }
            booking_load_by_hour = [
                {"hour": h, "count": int(hour_counts.get(h, 0))} for h in range(24)
            ]

        # Overdue returns: not modeled as due-dates on Holding yet.
        # Surface open allocation requests older than 7 days as a soft proxy.
        AllocationRequest = _model("resource_allocation", "AllocationRequest")
        if AllocationRequest is not None:
            week_ago = today - timedelta(days=7)
            overdue_returns_count = AllocationRequest.objects.filter(
                status__in=("open", "partially_fulfilled"),
                created_at__date__lt=week_ago,
            ).count()

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
    """Merged activity feed derived from existing domain tables.

    No new models — scans MaintenanceRequest, Booking, and
    resource_allocation.Transfer rows from the last 30 days and returns the 50
    most-recent items in a uniform shape for the frontend.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Dashboard"], summary="Activity feed")
    def get(self, request):
        now = timezone.now()
        since = now - timedelta(days=30)
        items: list[dict] = []

        MaintenanceRequest = _model("maintenance", "MaintenanceRequest")
        if MaintenanceRequest is not None:
            for mr in (
                MaintenanceRequest.objects
                .select_related("asset", "raised_by")
                .filter(created_at__gte=since)
            ):
                items.append({
                    "id": f"maint-created-{mr.pk}",
                    "kind": "maintenance_created",
                    "title": "Maintenance request raised",
                    "body": _truncate(mr.issue_description),
                    "entity": "maintenance_request",
                    "entity_id": mr.pk,
                    "actor_name": _actor_name(mr.raised_by),
                    "timestamp": mr.created_at,
                })

            for mr in (
                MaintenanceRequest.objects
                .select_related("asset", "approved_by")
                .filter(approved_at__isnull=False, approved_at__gte=since)
            ):
                items.append({
                    "id": f"maint-approved-{mr.pk}",
                    "kind": "maintenance_approved",
                    "title": "Maintenance request approved",
                    "body": _truncate(mr.issue_description),
                    "entity": "maintenance_request",
                    "entity_id": mr.pk,
                    "actor_name": _actor_name(mr.approved_by),
                    "timestamp": mr.approved_at,
                })

            for mr in (
                MaintenanceRequest.objects
                .select_related("asset", "technician")
                .filter(resolved_at__isnull=False, resolved_at__gte=since)
            ):
                items.append({
                    "id": f"maint-resolved-{mr.pk}",
                    "kind": "maintenance_resolved",
                    "title": "Maintenance request resolved",
                    "body": _truncate(mr.resolution_notes or mr.issue_description),
                    "entity": "maintenance_request",
                    "entity_id": mr.pk,
                    "actor_name": _actor_name(mr.technician),
                    "timestamp": mr.resolved_at,
                })

        Booking = _model("booking", "Booking")
        if Booking is not None:
            for b in (
                Booking.objects
                .select_related("asset", "booked_by")
                .filter(created_at__gte=since)
            ):
                items.append({
                    "id": f"book-created-{b.pk}",
                    "kind": "booking_created",
                    "title": "Booking created",
                    "body": _truncate(b.purpose or f"Booking for {b.asset}"),
                    "entity": "booking",
                    "entity_id": b.pk,
                    "actor_name": _actor_name(b.booked_by),
                    "timestamp": b.created_at,
                })

            for b in (
                Booking.objects
                .select_related("asset", "cancelled_by")
                .filter(cancelled_at__isnull=False, cancelled_at__gte=since)
            ):
                items.append({
                    "id": f"book-cancelled-{b.pk}",
                    "kind": "booking_cancelled",
                    "title": "Booking cancelled",
                    "body": _truncate(b.purpose or f"Booking for {b.asset}"),
                    "entity": "booking",
                    "entity_id": b.pk,
                    "actor_name": _actor_name(b.cancelled_by),
                    "timestamp": b.cancelled_at,
                })

        Transfer = _model("resource_allocation", "Transfer")
        if Transfer is not None:
            for t in (
                Transfer.objects
                .select_related("asset", "performed_by")
                .filter(kind="allocate", created_at__gte=since)
            ):
                items.append({
                    "id": f"xfer-alloc-{t.pk}",
                    "kind": "asset_allocated",
                    "title": "Asset allocated",
                    "body": _truncate(
                        f"{t.quantity} \u00d7 {t.asset} \u2192 "
                        f"{t.to_holder_type}:{t.to_holder_id}"
                    ),
                    "entity": "transfer",
                    "entity_id": t.pk,
                    "actor_name": _actor_name(t.performed_by),
                    "timestamp": t.created_at,
                })

        # TODO: emit overdue_return items once Holding tracks expected_return_at
        # / returned_at. The current resource_allocation.Holding is a simple
        # quantity ledger (asset + holder + quantity) with no due-date fields,
        # so there is nothing to compare against `now`.

        items.sort(key=lambda i: i["timestamp"], reverse=True)
        items = items[:50]
        for it in items:
            it["timestamp"] = it["timestamp"].isoformat()
        return Response(items)
