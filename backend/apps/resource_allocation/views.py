from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import User, UserRole
from apps.organization.models import Department

from . import services
from .models import MANAGER_HOLDER_ID, AllocationRequest, Asset, HolderType, Holding, Transfer
from .permissions import (
    IsAssetManager,
    IsAssetManagerOrDepartmentHead,
    IsDepartmentHeadOrEmployee,
)
from .serializers import (
    AdjustStockSerializer,
    AllocateSerializer,
    AllocationRequestSerializer,
    AssetSerializer,
    FulfillRequestSerializer,
    HoldingSerializer,
    ReturnSerializer,
    TransferSerializer,
)


@extend_schema_view(
    list=extend_schema(tags=["Resources / Assets"], summary="List assets"),
    retrieve=extend_schema(tags=["Resources / Assets"], summary="Get an asset"),
    create=extend_schema(tags=["Resources / Assets"], summary="Register an asset"),
    update=extend_schema(tags=["Resources / Assets"], summary="Replace an asset"),
    partial_update=extend_schema(tags=["Resources / Assets"], summary="Update an asset"),
)
class AssetViewSet(viewsets.ModelViewSet):
    """
    Asset catalog. Read: any authenticated user. Write: Asset Manager only.

    total_quantity can only change via the adjust-stock action, never a plain
    PATCH/PUT (see AssetSerializer.update).
    """

    queryset = Asset.objects.select_related("category", "created_by").all()
    serializer_class = AssetSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update", "adjust_stock"):
            return [IsAuthenticated(), IsAssetManager()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search")
        category = self.request.query_params.get("category")
        if search:
            qs = qs.filter(Q(name__icontains=search))
        if category:
            qs = qs.filter(category_id=category)
        return qs

    def perform_create(self, serializer):
        asset = services.register_asset(
            name=serializer.validated_data["name"],
            category=serializer.validated_data["category"],
            total_quantity=serializer.validated_data["total_quantity"],
            condition=serializer.validated_data.get("condition", ""),
            location=serializer.validated_data.get("location", ""),
            is_bookable=serializer.validated_data.get("is_bookable", False),
            created_by=self.request.user,
        )
        serializer.instance = asset

    @extend_schema(
        tags=["Resources / Assets"],
        summary="Adjust total stock quantity",
        request=AdjustStockSerializer,
        responses=AssetSerializer,
    )
    @action(detail=True, methods=["post"], url_path="adjust-stock")
    def adjust_stock(self, request, pk=None):
        asset = self.get_object()
        serializer = AdjustStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = services.adjust_stock(
            asset=asset,
            delta=serializer.validated_data["delta"],
            performed_by=request.user,
        )
        return Response(AssetSerializer(updated).data)


def _own_holder_filters(user):
    """Q-expression fragments describing which Holding rows this user may see."""
    if user.role == UserRole.ASSET_MANAGER:
        return Q()
    if user.role == UserRole.DEPARTMENT_HEAD:
        dept = Department.objects.filter(head=user).first()
        if not dept:
            return Q(pk__in=[])
        employee_ids = list(dept.employees.values_list("id", flat=True))
        return Q(holder_type=HolderType.DEPARTMENT, holder_id=dept.id) | Q(
            holder_type=HolderType.EMPLOYEE, holder_id__in=employee_ids
        )
    return Q(holder_type=HolderType.EMPLOYEE, holder_id=user.id)


@extend_schema_view(
    list=extend_schema(tags=["Resources / Holdings"], summary="List holdings"),
    retrieve=extend_schema(tags=["Resources / Holdings"], summary="Get a holding"),
)
class HoldingViewSet(viewsets.ReadOnlyModelViewSet):
    """Current-state view of who holds how much of each asset, scoped by role."""

    queryset = Holding.objects.select_related("asset").all()
    serializer_class = HoldingSerializer

    def get_queryset(self):
        qs = super().get_queryset().filter(_own_holder_filters(self.request.user))
        asset_id = self.request.query_params.get("asset")
        if asset_id:
            qs = qs.filter(asset_id=asset_id)
        return qs


@extend_schema_view(
    list=extend_schema(tags=["Resources / Transfers"], summary="List transfers (ledger)"),
    retrieve=extend_schema(tags=["Resources / Transfers"], summary="Get a transfer"),
)
class TransferViewSet(viewsets.ReadOnlyModelViewSet):
    """Immutable movement ledger, scoped by role the same way as HoldingViewSet."""

    queryset = Transfer.objects.select_related("asset", "performed_by").all()
    serializer_class = TransferSerializer

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.role == UserRole.ASSET_MANAGER:
            pass
        elif user.role == UserRole.DEPARTMENT_HEAD:
            dept = Department.objects.filter(head=user).first()
            if not dept:
                qs = qs.none()
            else:
                employee_ids = list(dept.employees.values_list("id", flat=True))
                qs = qs.filter(
                    Q(from_holder_type=HolderType.DEPARTMENT, from_holder_id=dept.id)
                    | Q(to_holder_type=HolderType.DEPARTMENT, to_holder_id=dept.id)
                    | Q(from_holder_type=HolderType.EMPLOYEE, from_holder_id__in=employee_ids)
                    | Q(to_holder_type=HolderType.EMPLOYEE, to_holder_id__in=employee_ids)
                )
        else:
            qs = qs.filter(
                Q(from_holder_type=HolderType.EMPLOYEE, from_holder_id=user.id)
                | Q(to_holder_type=HolderType.EMPLOYEE, to_holder_id=user.id)
            )
        asset_id = self.request.query_params.get("asset")
        if asset_id:
            qs = qs.filter(asset_id=asset_id)
        return qs


@extend_schema_view(
    list=extend_schema(tags=["Resources / Requests"], summary="List allocation requests"),
    retrieve=extend_schema(tags=["Resources / Requests"], summary="Get an allocation request"),
    create=extend_schema(tags=["Resources / Requests"], summary="Raise an allocation request"),
)
class AllocationRequestViewSet(viewsets.ModelViewSet):
    """
    Requests for asset quantity. Any authenticated user may create one for
    themselves or their own department; Asset Manager and peer Department
    Heads fulfill them (see `fulfill`, `broadcast`).
    """

    queryset = AllocationRequest.objects.select_related("asset", "requested_by").all()
    serializer_class = AllocationRequestSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        # fulfill/reject/cancel act on requests that may belong to another
        # department entirely (that's the point of peer fulfillment via
        # broadcast) or that the acting user doesn't own outright (cancel).
        # Their authorization is enforced by permission_classes and by the
        # service layer (e.g. cancel_request raising InvalidHolderError),
        # not by this list/retrieve visibility scoping.
        if self.action in ("fulfill", "reject", "cancel"):
            return qs
        if user.role == UserRole.ASSET_MANAGER:
            return qs
        if user.role == UserRole.DEPARTMENT_HEAD:
            dept = Department.objects.filter(head=user).first()
            dept_id = dept.id if dept else None
            return qs.filter(
                Q(requested_by=user)
                | Q(for_holder_type=HolderType.DEPARTMENT, for_holder_id=dept_id)
            )
        return qs.filter(requested_by=user)

    def perform_create(self, serializer):
        request_obj = services.create_request(
            asset=serializer.validated_data["asset"],
            requested_by=self.request.user,
            for_holder_type=serializer.validated_data["for_holder_type"],
            for_holder_id=serializer.validated_data["for_holder_id"],
            quantity_requested=serializer.validated_data["quantity_requested"],
        )
        serializer.instance = request_obj

    @extend_schema(
        tags=["Resources / Requests"],
        summary="List open requests this department could fulfill from spare quantity",
        parameters=[],
        responses=AllocationRequestSerializer(many=True),
    )
    @action(
        detail=False, methods=["get"], url_path="broadcast", permission_classes=[IsAuthenticated]
    )
    def broadcast(self, request):
        asset_id = request.query_params.get("asset")
        if not asset_id:
            return Response({"detail": "asset query param is required."}, status=400)
        asset = Asset.objects.get(pk=asset_id)

        if request.user.role == UserRole.ASSET_MANAGER:
            dept_ids_with_spare = [
                d.id
                for d in Department.objects.all()
                if services.spare_quantity(asset=asset, department_id=d.id) > 0
            ]
        else:
            dept = Department.objects.filter(head=request.user).first()
            if not dept or services.spare_quantity(asset=asset, department_id=dept.id) <= 0:
                return Response([])
            dept_ids_with_spare = [dept.id]

        open_requests = (
            services.open_requests_for_peer_fulfillment(asset=asset)
            .filter(for_holder_type=HolderType.DEPARTMENT)
            .exclude(for_holder_id__in=dept_ids_with_spare)
        )
        return Response(AllocationRequestSerializer(open_requests, many=True).data)

    @extend_schema(
        tags=["Resources / Requests"],
        summary="Fulfill a request (Asset Manager from the pool, or a peer Department Head)",
        request=FulfillRequestSerializer,
        responses=AllocationRequestSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, IsAssetManagerOrDepartmentHead],
    )
    def fulfill(self, request, pk=None):
        allocation_request = self.get_object()
        serializer = FulfillRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quantity = serializer.validated_data["quantity"]

        if request.user.role == UserRole.ASSET_MANAGER:
            from_holder_type, from_holder_id = HolderType.MANAGER, MANAGER_HOLDER_ID
        else:
            dept = Department.objects.filter(head=request.user).first()
            if not dept:
                return Response(
                    {"detail": "You do not head a department."},
                    status=403,
                )
            from_holder_type, from_holder_id = HolderType.DEPARTMENT, dept.id

        services.fulfill_request(
            request=allocation_request,
            from_holder_type=from_holder_type,
            from_holder_id=from_holder_id,
            quantity=quantity,
            performed_by=request.user,
        )
        allocation_request.refresh_from_db()
        return Response(AllocationRequestSerializer(allocation_request).data)

    @extend_schema(
        tags=["Resources / Requests"],
        summary="Reject a request",
        responses=AllocationRequestSerializer,
    )
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsAssetManager])
    def reject(self, request, pk=None):
        allocation_request = self.get_object()
        services.reject_request(request=allocation_request, performed_by=request.user)
        allocation_request.refresh_from_db()
        return Response(AllocationRequestSerializer(allocation_request).data)

    @extend_schema(
        tags=["Resources / Requests"],
        summary="Cancel own request",
        responses=AllocationRequestSerializer,
    )
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def cancel(self, request, pk=None):
        allocation_request = self.get_object()
        try:
            services.cancel_request(request=allocation_request, performed_by=request.user)
        except services.InvalidHolderError as exc:
            return Response({"detail": str(exc)}, status=403)
        allocation_request.refresh_from_db()
        return Response(AllocationRequestSerializer(allocation_request).data)


class AllocateView(APIView):
    """
    POST asset/to_holder_type/to_holder_id/quantity.

    Asset Manager: pushes from the unallocated manager pool (no approval check).
    Department Head: sub-allocates from their own department's holding to one
    of their own employees (to_holder_type must be 'employee').
    """

    permission_classes = [IsAuthenticated, IsAssetManagerOrDepartmentHead]

    def post(self, request):
        serializer = AllocateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if request.user.role == UserRole.ASSET_MANAGER:
            try:
                services.allocate(
                    asset=data["asset"],
                    to_holder_type=data["to_holder_type"],
                    to_holder_id=data["to_holder_id"],
                    quantity=data["quantity"],
                    performed_by=request.user,
                )
            except services.InsufficientQuantityError as exc:
                return Response({"detail": str(exc)}, status=400)
            return Response({"detail": "Allocated."})

        # Department Head
        if data["to_holder_type"] != HolderType.EMPLOYEE:
            return Response(
                {"detail": "A Department Head can only sub-allocate to an employee."},
                status=400,
            )
        dept = Department.objects.filter(head=request.user).first()
        if not dept:
            return Response({"detail": "You do not head a department."}, status=403)
        try:
            employee = User.objects.get(pk=data["to_holder_id"])
        except User.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=400)
        try:
            services.sub_allocate(
                asset=data["asset"],
                department=dept,
                employee=employee,
                quantity=data["quantity"],
                performed_by=request.user,
            )
        except (services.InvalidHolderError, services.InsufficientQuantityError) as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response({"detail": "Allocated."})


class ReturnView(APIView):
    """
    POST asset/quantity. Department Head returns from their department's
    holding; Employee returns from their own holding. Both go back to the
    unallocated manager pool.
    """

    permission_classes = [IsAuthenticated, IsDepartmentHeadOrEmployee]

    def post(self, request):
        serializer = ReturnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if request.user.role == UserRole.DEPARTMENT_HEAD:
            dept = Department.objects.filter(head=request.user).first()
            if not dept:
                return Response({"detail": "You do not head a department."}, status=403)
            from_holder_type, from_holder_id = HolderType.DEPARTMENT, dept.id
        else:
            from_holder_type, from_holder_id = HolderType.EMPLOYEE, request.user.id

        try:
            services.return_quantity(
                asset=data["asset"],
                from_holder_type=from_holder_type,
                from_holder_id=from_holder_id,
                quantity=data["quantity"],
                performed_by=request.user,
            )
        except services.InsufficientQuantityError as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response({"detail": "Returned."})
