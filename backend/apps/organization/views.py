from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.models import User, UserRole, UserStatus

from .models import AssetCategory, Department, Status
from .permissions import CanReadEmployees, IsAdmin, IsAdminOrReadOnly
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
    Departments master data.

    - list / retrieve: any authenticated user (needed by managers for pickers)
    - create / update / destroy: admin only
    """

    queryset = Department.objects.select_related("parent", "head").all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Non-admins only need active departments in pickers.
        if getattr(user, "role", None) != UserRole.ADMIN:
            qs = qs.filter(status=Status.ACTIVE)
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
    partial_update=extend_schema(tags=["Organization / Categories"], summary="Update a category"),
    destroy=extend_schema(
        tags=["Organization / Categories"],
        summary="Soft-deactivate a category",
        description="Sets status='inactive' instead of removing the row.",
    ),
)
class AssetCategoryViewSet(viewsets.ModelViewSet):
    """
    Asset categories.

    - list / retrieve: any authenticated user (asset registration pickers)
    - write: admin only
    """

    queryset = AssetCategory.objects.all()
    serializer_class = AssetCategorySerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if getattr(user, "role", None) != UserRole.ADMIN:
            qs = qs.filter(status=Status.ACTIVE)
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
    Employee directory.

    - list / retrieve: authenticated; scoped by role in get_queryset
    - PATCH role / status / department: admin only (IsAdmin on those actions)
    """

    queryset = User.objects.select_related("department").all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, CanReadEmployees]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role = getattr(user, "role", None)

        # Employees only see themselves on the directory API.
        if role == UserRole.EMPLOYEE:
            qs = qs.filter(pk=user.pk)
        # Managers / heads / admin see the full directory (active by default for
        # non-admin unless status= is passed).
        elif role != UserRole.ADMIN:
            qs = qs.filter(status=UserStatus.ACTIVE, is_active=True)

        search = self.request.query_params.get("search")
        role_filter = self.request.query_params.get("role")
        department = self.request.query_params.get("department")
        status_filter = self.request.query_params.get("status")
        if search:
            qs = qs.filter(Q(full_name__icontains=search) | Q(email__icontains=search))
        if role_filter:
            qs = qs.filter(role=role_filter)
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
    @action(
        detail=True,
        methods=["patch"],
        url_path="role",
        permission_classes=[IsAuthenticated, IsAdmin],
    )
    def set_role(self, request, pk=None):
        user = self.get_object()
        if user == request.user:
            return Response(
                {"detail": "You cannot change your own role."},
                status=400,
            )
        serializer = EmployeeRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        previous_role = user.role
        new_role = serializer.validated_data["role"]
        user.role = new_role
        user.save(update_fields=["role"])
        try:
            from apps.activity.services import log_activity

            log_activity(
                action="user.role_change",
                message=(
                    f"{request.user.full_name or request.user.email} changed role of "
                    f"{user.full_name or user.email} from {previous_role} to {new_role}"
                ),
                actor=request.user,
                entity_type="user",
                entity_id=user.pk,
                before_data={"role": previous_role},
                after_data={"role": new_role},
                ip_addr=request.META.get("REMOTE_ADDR"),
            )
        except Exception:
            pass
        return Response(EmployeeSerializer(user).data)

    @extend_schema(
        tags=["Organization / Employees"],
        summary="Activate or deactivate an employee",
        request=EmployeeStatusUpdateSerializer,
        responses=EmployeeSerializer,
    )
    @action(
        detail=True,
        methods=["patch"],
        url_path="status",
        permission_classes=[IsAuthenticated, IsAdmin],
    )
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
    @action(
        detail=True,
        methods=["patch"],
        url_path="department",
        permission_classes=[IsAuthenticated, IsAdmin],
    )
    def set_department(self, request, pk=None):
        user = self.get_object()
        serializer = EmployeeDepartmentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.department = serializer.validated_data.get("department")
        user.save(update_fields=["department"])
        return Response(EmployeeSerializer(user).data)
