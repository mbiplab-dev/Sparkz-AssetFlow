from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.models import User, UserStatus

from .models import AssetCategory, Department, Status
from .permissions import IsAdmin
from .serializers import (
    AssetCategorySerializer,
    DepartmentSerializer,
    EmployeeDepartmentUpdateSerializer,
    EmployeeRoleUpdateSerializer,
    EmployeeSerializer,
    EmployeeStatusUpdateSerializer,
)


@extend_schema_view(
    list=extend_schema(tags=["Organization / Departments"], summary="List departments"),
    retrieve=extend_schema(tags=["Organization / Departments"], summary="Get a department"),
    create=extend_schema(tags=["Organization / Departments"], summary="Create a department"),
    update=extend_schema(tags=["Organization / Departments"], summary="Replace a department"),
    partial_update=extend_schema(
        tags=["Organization / Departments"], summary="Update a department"
    ),
    destroy=extend_schema(
        tags=["Organization / Departments"],
        summary="Soft-deactivate a department",
        description="Sets status='inactive' instead of removing the row.",
    ),
)
class DepartmentViewSet(viewsets.ModelViewSet):
    """
    CRUD for departments (Screen 3 Tab A). Admin-only.

    - DELETE soft-deactivates (status='inactive') rather than removing the row,
      because departments are referenced by users/assets/audits.
    """

    queryset = Department.objects.select_related("parent", "head").all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search")
        status_filter = self.request.query_params.get("status")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))
        if status_filter in (Status.ACTIVE, Status.INACTIVE):
            qs = qs.filter(status=status_filter)
        return qs

    def perform_destroy(self, instance):
        instance.status = Status.INACTIVE
        instance.save(update_fields=["status", "updated_at"])


@extend_schema_view(
    list=extend_schema(tags=["Organization / Categories"], summary="List asset categories"),
    retrieve=extend_schema(tags=["Organization / Categories"], summary="Get a category"),
    create=extend_schema(tags=["Organization / Categories"], summary="Create a category"),
    update=extend_schema(tags=["Organization / Categories"], summary="Replace a category"),
    partial_update=extend_schema(
        tags=["Organization / Categories"], summary="Update a category"
    ),
    destroy=extend_schema(
        tags=["Organization / Categories"],
        summary="Soft-deactivate a category",
        description="Sets status='inactive' instead of removing the row.",
    ),
)
class AssetCategoryViewSet(viewsets.ModelViewSet):
    """CRUD for asset categories (Screen 3 Tab B). Admin-only."""

    queryset = AssetCategory.objects.all()
    serializer_class = AssetCategorySerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search")
        status_filter = self.request.query_params.get("status")
        if search:
            qs = qs.filter(name__icontains=search)
        if status_filter in (Status.ACTIVE, Status.INACTIVE):
            qs = qs.filter(status=status_filter)
        return qs

    def perform_destroy(self, instance):
        instance.status = Status.INACTIVE
        instance.save(update_fields=["status"])


@extend_schema_view(
    list=extend_schema(tags=["Organization / Employees"], summary="List employees"),
    retrieve=extend_schema(tags=["Organization / Employees"], summary="Get an employee"),
)
class EmployeeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Employee directory (Screen 3 Tab C). Admin-only.

    - list / retrieve: read employees
    - PATCH /employees/{id}/role/       -> promote/demote (the only place role is set)
    - PATCH /employees/{id}/status/     -> activate/deactivate
    - PATCH /employees/{id}/department/ -> assign a department
    """

    queryset = User.objects.select_related("department").all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search")
        role = self.request.query_params.get("role")
        department = self.request.query_params.get("department")
        status_filter = self.request.query_params.get("status")
        if search:
            qs = qs.filter(Q(full_name__icontains=search) | Q(email__icontains=search))
        if role:
            qs = qs.filter(role=role)
        if department:
            qs = qs.filter(department_id=department)
        if status_filter in (UserStatus.ACTIVE, UserStatus.INACTIVE):
            qs = qs.filter(status=status_filter)
        return qs

    @extend_schema(
        tags=["Organization / Employees"],
        summary="Change an employee's role",
        request=EmployeeRoleUpdateSerializer,
        responses=EmployeeSerializer,
    )
    @action(detail=True, methods=["patch"], url_path="role")
    def set_role(self, request, pk=None):
        user = self.get_object()
        if user == request.user:
            return Response(
                {"detail": "You cannot change your own role."},
                status=400,
            )
        serializer = EmployeeRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.role = serializer.validated_data["role"]
        user.save(update_fields=["role"])
        return Response(EmployeeSerializer(user).data)

    @extend_schema(
        tags=["Organization / Employees"],
        summary="Activate or deactivate an employee",
        request=EmployeeStatusUpdateSerializer,
        responses=EmployeeSerializer,
    )
    @action(detail=True, methods=["patch"], url_path="status")
    def set_status(self, request, pk=None):
        user = self.get_object()
        if user == request.user:
            return Response(
                {"detail": "You cannot deactivate your own account."},
                status=400,
            )
        serializer = EmployeeStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]
        user.status = new_status
        user.is_active = new_status == UserStatus.ACTIVE
        user.save(update_fields=["status", "is_active"])
        return Response(EmployeeSerializer(user).data)

    @extend_schema(
        tags=["Organization / Employees"],
        summary="Assign an employee to a department",
        request=EmployeeDepartmentUpdateSerializer,
        responses=EmployeeSerializer,
    )
    @action(detail=True, methods=["patch"], url_path="department")
    def set_department(self, request, pk=None):
        user = self.get_object()
        serializer = EmployeeDepartmentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.department = serializer.validated_data.get("department")
        user.save(update_fields=["department"])
        return Response(EmployeeSerializer(user).data)
