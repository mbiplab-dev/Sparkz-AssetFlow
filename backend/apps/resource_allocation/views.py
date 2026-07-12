from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import services
from .models import Asset
from .permissions import IsAssetManager
from .serializers import AdjustStockSerializer, AssetSerializer


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
