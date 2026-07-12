from django.apps import apps as django_apps
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

        Booking = _model("bookings", "Booking")
        if Booking is not None:
            kpis["active_bookings"] = Booking.objects.filter(
                start_time__lte=now, end_time__gte=now, status="confirmed"
            ).count()

        TransferRequest = _model("allocations", "TransferRequest")
        if TransferRequest is not None:
            kpis["pending_transfers"] = TransferRequest.objects.filter(status="pending").count()

        Allocation = _model("allocations", "Allocation")
        if Allocation is not None:
            open_allocations = Allocation.objects.filter(
                returned_at__isnull=True, expected_return_date__isnull=False
            )
            kpis["upcoming_returns"] = open_allocations.filter(
                expected_return_date__gte=today
            ).count()
            kpis["overdue_returns"] = open_allocations.filter(
                expected_return_date__lt=today
            ).count()

        recent_activity = []
        ActivityLog = _model("activity", "ActivityLog")
        if ActivityLog is not None:
            recent_activity = [
                {"id": log.id, "message": str(log), "timestamp": log.created_at}
                for log in ActivityLog.objects.order_by("-created_at")[:10]
            ]

        return Response({"kpis": kpis, "recent_activity": recent_activity})
