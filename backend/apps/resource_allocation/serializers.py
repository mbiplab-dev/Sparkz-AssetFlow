from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import AllocationRequest, Asset, HolderType, Holding, Transfer


class AssetSerializer(serializers.ModelSerializer):
    """Quantity-tracked catalog item (resource pool) — distinct from assets.Asset."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    # Unallocated quantity sitting in the manager pool (what allocate can pull).
    available_quantity = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        ref_name = "ResourceAsset"
        fields = (
            "id",
            "name",
            "category",
            "category_name",
            "total_quantity",
            "available_quantity",
            "condition",
            "location",
            "is_bookable",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "category_name",
            "available_quantity",
            "created_by",
            "created_at",
            "updated_at",
        )

    @extend_schema_field(serializers.IntegerField())
    def get_available_quantity(self, obj):
        from .models import MANAGER_HOLDER_ID, HolderType, Holding

        holding = (
            Holding.objects.filter(
                asset=obj,
                holder_type=HolderType.MANAGER,
                holder_id=MANAGER_HOLDER_ID,
            )
            .only("quantity")
            .first()
        )
        return holding.quantity if holding else 0

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Asset name is required.")
        return value

    def update(self, instance, validated_data):
        # total_quantity can only change via the adjust-stock action.
        validated_data.pop("total_quantity", None)
        return super().update(instance, validated_data)


class HoldingSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source="asset.name", read_only=True)

    class Meta:
        model = Holding
        fields = ("id", "asset", "asset_name", "holder_type", "holder_id", "quantity")
        read_only_fields = fields


class AllocationRequestSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    requested_by_name = serializers.CharField(source="requested_by.full_name", read_only=True)
    remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = AllocationRequest
        fields = (
            "id",
            "asset",
            "asset_name",
            "requested_by",
            "requested_by_name",
            "for_holder_type",
            "for_holder_id",
            "quantity_requested",
            "quantity_fulfilled",
            "remaining",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "asset_name",
            "requested_by",
            "requested_by_name",
            "quantity_fulfilled",
            "remaining",
            "status",
            "created_at",
            "updated_at",
        )

    def validate_quantity_requested(self, value):
        if value <= 0:
            raise serializers.ValidationError("quantity_requested must be positive.")
        return value


class TransferSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source="asset.name", read_only=True)

    class Meta:
        model = Transfer
        fields = (
            "id",
            "asset",
            "asset_name",
            "from_holder_type",
            "from_holder_id",
            "to_holder_type",
            "to_holder_id",
            "quantity",
            "kind",
            "request",
            "performed_by",
            "notes",
            "created_at",
        )
        read_only_fields = fields


class AdjustStockSerializer(serializers.Serializer):
    delta = serializers.IntegerField()

    def validate_delta(self, value):
        if value == 0:
            raise serializers.ValidationError("delta must be non-zero.")
        return value


class AllocateSerializer(serializers.Serializer):
    asset = serializers.PrimaryKeyRelatedField(queryset=Asset.objects.all())
    to_holder_type = serializers.ChoiceField(choices=HolderType.choices)
    to_holder_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class FulfillRequestSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)


class ReturnSerializer(serializers.Serializer):
    asset = serializers.PrimaryKeyRelatedField(queryset=Asset.objects.all())
    quantity = serializers.IntegerField(min_value=1)
