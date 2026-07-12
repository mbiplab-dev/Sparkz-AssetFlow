from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status as http_status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.assets.models import AssetStatus
from apps.authentication.models import User, UserRole

from .models import MaintenanceRequest, MaintenanceStatus
from .serializers import (
    ALLOWED_SOURCE,
    MaintenanceRejectSerializer,
    MaintenanceRequestCreateSerializer,
    MaintenanceRequestSerializer,
    MaintenanceResolveSerializer,
    MaintenanceStartSerializer,
)


class IsAssetManagerOrAdmin(BasePermission):
    """Only admin + asset_manager may approve/reject/start/resolve.

    Any authenticated user may raise a request or read the list.
    """

    write_actions = {"approve", "reject", "start", "resolve"}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        action_name = getattr(view, "action", None)
        if action_name in self.write_actions:
            return getattr(user, "role", None) in (UserRole.ADMIN, UserRole.ASSET_MANAGER)
        return True


@extend_schema_view(
    list=extend_schema(tags=["Maintenance"], summary="List / filter maintenance requests"),
    retrieve=extend_schema(tags=["Maintenance"], summary="Get a maintenance request"),
    create=extend_schema(
        tags=["Maintenance"],
        summary="Raise a maintenance request",
        request=MaintenanceRequestCreateSerializer,
        responses=MaintenanceRequestSerializer,
    ),
    update=extend_schema(tags=["Maintenance"], summary="Replace a maintenance request"),
    partial_update=extend_schema(tags=["Maintenance"], summary="Update a maintenance request"),
    destroy=extend_schema(tags=["Maintenance"], summary="Cancel a maintenance request"),
)
class MaintenanceRequestViewSet(viewsets.ModelViewSet):
    """
    Maintenance workflow (Screen 6).

    Kanban lifecycle:
        pending  → approved | rejected
        approved → in_progress (Start Work; optional technician)
        in_progress → resolved

    On approval, the asset flips to under_maintenance.
    On resolution, the asset flips back to available.
    `raised_by` is always taken from request.user.
    """

    serializer_class = MaintenanceRequestSerializer
    permission_classes = [IsAuthenticated, IsAssetManagerOrAdmin]

    def get_queryset(self):
        qs = MaintenanceRequest.objects.select_related(
            "asset",
            "asset__category",
            "raised_by",
            "approved_by",
            "technician",
        )
        params = self.request.query_params
        asset = params.get("asset")
        status_filter = params.get("status")
        priority = params.get("priority")
        technician = params.get("technician")
        starts_on = params.get("starts_on")
        ends_on = params.get("ends_on")

        if asset:
            qs = qs.filter(asset_id=asset)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if priority:
            qs = qs.filter(priority=priority)
        if technician:
            qs = qs.filter(technician_id=technician)
        if starts_on:
            qs = qs.filter(created_at__date__gte=starts_on)
        if ends_on:
            qs = qs.filter(created_at__date__lte=ends_on)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = MaintenanceRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        req = MaintenanceRequest.objects.create(
            asset=data["asset"],
            issue_description=data["issue_description"],
            priority=data["priority"],
            estimated_cost=data.get("estimated_cost"),
            raised_by=request.user,
        )
        return Response(MaintenanceRequestSerializer(req).data, status=http_status.HTTP_201_CREATED)

    def _ensure_source_status(self, req: MaintenanceRequest, action_name: str) -> Response | None:
        allowed = ALLOWED_SOURCE[action_name]
        if req.status not in allowed:
            return Response(
                {
                    "detail": (
                        f"Cannot {action_name} a request with status '{req.status}'. "
                        f"Allowed source statuses: {sorted(allowed)}."
                    )
                },
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        return None

    @extend_schema(
        tags=["Maintenance"],
        summary="Approve a pending request (flips asset to under_maintenance)",
        request=None,
        responses=MaintenanceRequestSerializer,
    )
    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        req = self.get_object()
        blocked = self._ensure_source_status(req, "approve")
        if blocked:
            return blocked

        with transaction.atomic():
            req.status = MaintenanceStatus.APPROVED
            req.approved_by = request.user
            req.approved_at = timezone.now()
            req.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
            # Flip the asset to under_maintenance.
            asset = req.asset
            if asset.status != AssetStatus.UNDER_MAINTENANCE:
                asset.status = AssetStatus.UNDER_MAINTENANCE
                asset.save(update_fields=["status", "updated_at"])

        return Response(MaintenanceRequestSerializer(req).data)

    @extend_schema(
        tags=["Maintenance"],
        summary="Reject a pending request",
        request=MaintenanceRejectSerializer,
        responses=MaintenanceRequestSerializer,
    )
    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        req = self.get_object()
        blocked = self._ensure_source_status(req, "reject")
        if blocked:
            return blocked
        serializer = MaintenanceRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        req.status = MaintenanceStatus.REJECTED
        req.rejection_reason = serializer.validated_data["reason"]
        req.approved_by = request.user
        req.approved_at = timezone.now()
        req.save(
            update_fields=[
                "status",
                "rejection_reason",
                "approved_by",
                "approved_at",
                "updated_at",
            ]
        )
        return Response(MaintenanceRequestSerializer(req).data)

    @extend_schema(
        tags=["Maintenance"],
        summary="Start work on an approved request",
        request=MaintenanceStartSerializer,
        responses=MaintenanceRequestSerializer,
    )
    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        req = self.get_object()
        blocked = self._ensure_source_status(req, "start")
        if blocked:
            return blocked
        serializer = MaintenanceStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        technician_id = serializer.validated_data.get("technician")

        now = timezone.now()
        req.status = MaintenanceStatus.IN_PROGRESS
        req.started_at = now
        update_fields = ["status", "started_at", "updated_at"]
        if technician_id:
            try:
                technician = User.objects.get(pk=technician_id)
            except User.DoesNotExist:
                return Response(
                    {"technician": "Unknown user id."},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
            req.technician = technician
            req.assigned_at = now
            update_fields += ["technician", "assigned_at"]
        req.save(update_fields=update_fields)
        return Response(MaintenanceRequestSerializer(req).data)

    @extend_schema(
        tags=["Maintenance"],
        summary="Resolve an in-progress request (flips asset back to available)",
        request=MaintenanceResolveSerializer,
        responses=MaintenanceRequestSerializer,
    )
    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        req = self.get_object()
        blocked = self._ensure_source_status(req, "resolve")
        if blocked:
            return blocked
        serializer = MaintenanceResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            req.status = MaintenanceStatus.RESOLVED
            req.resolved_at = timezone.now()
            req.resolution_notes = serializer.validated_data["resolution_notes"]
            actual_cost = serializer.validated_data.get("actual_cost")
            update_fields = ["status", "resolved_at", "resolution_notes", "updated_at"]
            if actual_cost is not None:
                req.actual_cost = actual_cost
                update_fields.append("actual_cost")
            req.save(update_fields=update_fields)

            # Flip the asset back to available if it was under maintenance.
            asset = req.asset
            if asset.status == AssetStatus.UNDER_MAINTENANCE:
                asset.status = AssetStatus.AVAILABLE
                asset.save(update_fields=["status", "updated_at"])

        return Response(MaintenanceRequestSerializer(req).data)
