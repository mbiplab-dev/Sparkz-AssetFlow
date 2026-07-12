from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.authentication.models import UserRole

from . import services
from .models import AuditCycle, AuditCycleStatus, AuditItem, AuditVerdict, Discrepancy
from .serializers import (
    AuditCycleCreateSerializer,
    AuditCycleSerializer,
    AuditItemSerializer,
    AuditItemVerdictSerializer,
    AuditorsUpdateSerializer,
    DiscrepancySerializer,
)


class IsAdminOrAssetManager(BasePermission):
    """Read for all authenticated; write for admin + asset_manager."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return getattr(user, "role", None) in (UserRole.ADMIN, UserRole.ASSET_MANAGER)


def _cycle_queryset():
    return (
        AuditCycle.objects.select_related(
            "scope_department", "scope_location", "created_by", "closed_by"
        )
        .prefetch_related("auditors")
        .annotate(
            items_total=Count("items", distinct=True),
            items_pending=Count(
                "items", filter=Q(items__verdict=AuditVerdict.PENDING), distinct=True
            ),
            items_done=Count(
                "items",
                filter=~Q(items__verdict=AuditVerdict.PENDING),
                distinct=True,
            ),
            open_discrepancies=Count(
                "items__discrepancy",
                filter=Q(items__discrepancy__resolved=False),
                distinct=True,
            ),
        )
    )


@extend_schema_view(
    list=extend_schema(tags=["Audits / Cycles"], summary="List audit cycles"),
    retrieve=extend_schema(tags=["Audits / Cycles"], summary="Get an audit cycle"),
)
class AuditCycleViewSet(viewsets.ModelViewSet):
    """
    Audit cycles (Screen 8).
    - List/retrieve: authenticated. Employees only see cycles they are assigned to.
    - Create / close / set auditors: admin + asset_manager.
    Creating a cycle snapshots every in-scope asset as a pending AuditItem.
    """

    queryset = AuditCycle.objects.all()
    serializer_class = AuditCycleSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAssetManager]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = _cycle_queryset()
        user = self.request.user
        role = getattr(user, "role", None)
        if role in (UserRole.ADMIN, UserRole.ASSET_MANAGER):
            return qs
        # Employees (and other roles) only see cycles where they are auditors.
        return qs.filter(auditors=user).distinct()

    @extend_schema(
        tags=["Audits / Cycles"],
        summary="Create an audit cycle",
        request=AuditCycleCreateSerializer,
        responses=AuditCycleSerializer,
    )
    def create(self, request, *args, **kwargs):
        serializer = AuditCycleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        cycle = services.create_cycle(
            name=data["name"],
            starts_on=data["starts_on"],
            ends_on=data["ends_on"],
            scope_department=data.get("scope_department"),
            scope_location=data.get("scope_location"),
            auditor_ids=[u.id for u in data.get("auditors", [])],
            created_by=request.user,
        )
        # Re-fetch with annotations for a consistent response shape.
        cycle = self.get_queryset().get(pk=cycle.pk)
        return Response(AuditCycleSerializer(cycle).data, status=201)

    @extend_schema(
        tags=["Audits / Cycles"],
        summary="Close an audit cycle",
        request=None,
        responses=AuditCycleSerializer,
    )
    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        cycle = self.get_object()
        try:
            services.close_cycle(cycle=cycle, performed_by=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        cycle = self.get_queryset().get(pk=cycle.pk)
        return Response(AuditCycleSerializer(cycle).data)

    @extend_schema(
        tags=["Audits / Cycles"],
        summary="Set the auditors assigned to a cycle (replaces the full list)",
        request=AuditorsUpdateSerializer,
        responses=AuditCycleSerializer,
    )
    @action(detail=True, methods=["post"], url_path="auditors")
    def set_auditors(self, request, pk=None):
        cycle = self.get_object()
        if cycle.status == AuditCycleStatus.CLOSED:
            return Response({"detail": "Cannot modify auditors on a closed cycle."}, status=400)
        serializer = AuditorsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cycle.auditors.set([u.id for u in serializer.validated_data["auditors"]])
        cycle = self.get_queryset().get(pk=cycle.pk)
        return Response(AuditCycleSerializer(cycle).data)


@extend_schema_view(
    list=extend_schema(tags=["Audits / Items"], summary="List audit items"),
    retrieve=extend_schema(tags=["Audits / Items"], summary="Get an audit item"),
)
class AuditItemViewSet(viewsets.ReadOnlyModelViewSet):
    """Per-asset rows within a cycle. Any authenticated user may read; verdict is gated per-item."""

    queryset = AuditItem.objects.select_related(
        "cycle", "asset", "asset__location", "verified_by"
    )
    serializer_class = AuditItemSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role = getattr(user, "role", None)
        if role not in (UserRole.ADMIN, UserRole.ASSET_MANAGER):
            qs = qs.filter(cycle__auditors=user)
        cycle_id = self.request.query_params.get("cycle")
        if cycle_id:
            qs = qs.filter(cycle_id=cycle_id)
        return qs.distinct()

    @extend_schema(
        tags=["Audits / Items"],
        summary="Set an item's verdict (assigned auditor, admin, or asset manager)",
        request=AuditItemVerdictSerializer,
        responses=AuditItemSerializer,
    )
    @action(detail=True, methods=["patch"])
    def verdict(self, request, pk=None):
        item = self.get_object()
        user = request.user
        is_privileged = getattr(user, "role", None) in (UserRole.ADMIN, UserRole.ASSET_MANAGER)
        if not is_privileged and not item.cycle.auditors.filter(pk=user.pk).exists():
            return Response(
                {"detail": "Only an assigned auditor, admin, or asset manager can set a verdict."},
                status=403,
            )
        serializer = AuditItemVerdictSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            services.set_verdict(
                item=item,
                verdict=serializer.validated_data["verdict"],
                performed_by=user,
                notes=serializer.validated_data.get("notes", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        item.refresh_from_db()
        return Response(AuditItemSerializer(item).data)


@extend_schema_view(
    list=extend_schema(tags=["Audits / Discrepancies"], summary="List discrepancies"),
    retrieve=extend_schema(tags=["Audits / Discrepancies"], summary="Get a discrepancy"),
)
class DiscrepancyViewSet(viewsets.ReadOnlyModelViewSet):
    """Auto-generated discrepancy report. Read: scoped. Resolve: admin/asset_manager."""

    queryset = Discrepancy.objects.select_related(
        "audit_item__asset", "audit_item__cycle", "resolved_by"
    )
    serializer_class = DiscrepancySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role = getattr(user, "role", None)
        if role not in (UserRole.ADMIN, UserRole.ASSET_MANAGER):
            qs = qs.filter(audit_item__cycle__auditors=user)
        cycle_id = self.request.query_params.get("cycle")
        resolved = self.request.query_params.get("resolved")
        if cycle_id:
            qs = qs.filter(audit_item__cycle_id=cycle_id)
        if resolved in ("true", "false"):
            qs = qs.filter(resolved=resolved == "true")
        return qs.distinct()

    @extend_schema(
        tags=["Audits / Discrepancies"],
        summary="Mark a discrepancy resolved",
        request=None,
        responses=DiscrepancySerializer,
    )
    @action(
        detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsAdminOrAssetManager]
    )
    def resolve(self, request, pk=None):
        discrepancy = self.get_object()
        services.resolve_discrepancy(discrepancy=discrepancy, performed_by=request.user)
        discrepancy.refresh_from_db()
        return Response(DiscrepancySerializer(discrepancy).data)
