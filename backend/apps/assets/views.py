from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.authentication.models import UserRole

from .models import Asset, Location
from .serializers import (
    AssetCreateSerializer,
    AssetSerializer,
    AssetStatusUpdateSerializer,
    LocationSerializer,
)


class IsAssetManagerOrAdmin(BasePermission):
    """Read for all authenticated; write for admin + asset_manager."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return getattr(user, "role", None) in (UserRole.ADMIN, UserRole.ASSET_MANAGER)


@extend_schema_view(
    list=extend_schema(tags=["Assets"], summary="List / search assets"),
    retrieve=extend_schema(tags=["Assets"], summary="Get an asset"),
    create=extend_schema(tags=["Assets"], summary="Register a new asset"),
    update=extend_schema(tags=["Assets"], summary="Replace an asset"),
    partial_update=extend_schema(tags=["Assets"], summary="Update an asset"),
    destroy=extend_schema(tags=["Assets"], summary="Delete an asset"),
)
class AssetViewSet(viewsets.ModelViewSet):
    """
    Asset registration & directory (Screen 4).

    - All authenticated users can list/retrieve (scoped later by role).
    - Only admin / asset_manager can create, update, or change status.
    - Search by tag, serial, name; filter by category, status, department, bookable.
    """

    queryset = Asset.objects.select_related("category", "department", "location", "created_by")
    serializer_class = AssetSerializer
    permission_classes = [IsAuthenticated, IsAssetManagerOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role = getattr(user, "role", None)

        # Admin + asset managers see the full catalog.
        # Department heads: assets in their department + all bookable resources.
        # Employees: bookable resources (for booking) + assets tagged to their dept.
        if role not in (UserRole.ADMIN, UserRole.ASSET_MANAGER):
            if role == UserRole.DEPARTMENT_HEAD:
                from apps.organization.models import Department

                headed = Department.objects.filter(head=user).values_list("id", flat=True)
                dept_ids = list(headed)
                if user.department_id and user.department_id not in dept_ids:
                    dept_ids.append(user.department_id)
                qs = qs.filter(Q(department_id__in=dept_ids) | Q(is_bookable=True))
            elif role == UserRole.EMPLOYEE:
                # Bookable shared resources + any asset assigned to their department.
                qs = qs.filter(
                    Q(is_bookable=True) | Q(department_id=user.department_id) | Q(created_by=user)
                )
            else:
                qs = qs.none()

        params = self.request.query_params
        search = params.get("search")
        status_filter = params.get("status")
        category = params.get("category")
        department = params.get("department")
        bookable = params.get("is_bookable")

        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(asset_tag__icontains=search)
                | Q(serial_number__icontains=search)
            )
        if status_filter:
            qs = qs.filter(status=status_filter)
        if category:
            qs = qs.filter(category_id=category)
        if department:
            qs = qs.filter(department_id=department)
        if bookable in ("true", "false"):
            qs = qs.filter(is_bookable=bookable == "true")
        return qs

    @extend_schema(tags=["Assets"], summary="Register a new asset", request=AssetCreateSerializer)
    def create(self, request, *args, **kwargs):
        serializer = AssetCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        asset = Asset.objects.create(**serializer.validated_data)
        return Response(AssetSerializer(asset).data, status=201)

    @extend_schema(tags=["Assets"], summary="Update an asset", request=AssetSerializer)
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @extend_schema(
        tags=["Assets"],
        summary="Change an asset's lifecycle status",
        request=AssetStatusUpdateSerializer,
    )
    @action(detail=True, methods=["patch"], url_path="status")
    def set_status(self, request, pk=None):
        asset = self.get_object()
        serializer = AssetStatusUpdateSerializer(
            data=request.data, context={"current_status": asset.status}
        )
        serializer.is_valid(raise_exception=True)
        asset.status = serializer.validated_data["status"]
        asset.save(update_fields=["status", "updated_at"])
        return Response(AssetSerializer(asset).data)


@extend_schema_view(
    list=extend_schema(tags=["Assets / Locations"], summary="List locations"),
    retrieve=extend_schema(tags=["Assets / Locations"], summary="Get a location"),
    create=extend_schema(tags=["Assets / Locations"], summary="Create a location"),
    update=extend_schema(tags=["Assets / Locations"], summary="Replace a location"),
    partial_update=extend_schema(tags=["Assets / Locations"], summary="Update a location"),
    destroy=extend_schema(tags=["Assets / Locations"], summary="Delete a location"),
)
class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [IsAuthenticated, IsAssetManagerOrAdmin]
