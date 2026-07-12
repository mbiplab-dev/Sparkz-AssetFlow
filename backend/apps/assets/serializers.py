from rest_framework import serializers

from apps.organization.models import AssetCategory, Department

from .models import Asset, AssetCondition, AssetStatus, Location


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ("id", "name", "address", "created_at")
        read_only_fields = ("id", "created_at")


class AssetSerializer(serializers.ModelSerializer):
    """Asset directory row with resolved names for display."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    condition_label = serializers.CharField(source="get_condition_display", read_only=True)

    class Meta:
        model = Asset
        fields = (
            "id",
            "asset_tag",
            "name",
            "category",
            "category_name",
            "serial_number",
            "qr_code",
            "acquisition_date",
            "acquisition_cost",
            "condition",
            "condition_label",
            "status",
            "status_label",
            "location",
            "location_name",
            "department",
            "department_name",
            "is_bookable",
            "notes",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "asset_tag",
            "category_name",
            "department_name",
            "location_name",
            "created_by_name",
            "status_label",
            "condition_label",
            "created_at",
            "updated_at",
        )

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Asset name is required.")
        return value

    def validate_serial_number(self, value):
        value = value.strip()
        if value and Asset.objects.filter(serial_number=value).exists():
            raise serializers.ValidationError("An asset with this serial number already exists.")
        return value

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        return super().create(validated_data)


class AssetCreateSerializer(serializers.Serializer):
    """Write payload for registering a new asset (asset_tag is auto-generated)."""

    name = serializers.CharField(max_length=200)
    category = serializers.PrimaryKeyRelatedField(queryset=AssetCategory.objects.all())
    serial_number = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    qr_code = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    acquisition_date = serializers.DateField(required=False, allow_null=True)
    acquisition_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    condition = serializers.ChoiceField(
        choices=AssetCondition.choices, default=AssetCondition.GOOD
    )
    location = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.all(), required=False, allow_null=True
    )
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), required=False, allow_null=True
    )
    is_bookable = serializers.BooleanField(default=False)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Asset name is required.")
        return value

    def validate_serial_number(self, value):
        value = value.strip()
        if value and Asset.objects.filter(serial_number=value).exists():
            raise serializers.ValidationError("An asset with this serial number already exists.")
        return value


# Valid lifecycle transitions (from db-schema.txt invariants).
VALID_TRANSITIONS = {
    AssetStatus.AVAILABLE: {
        AssetStatus.ALLOCATED,
        AssetStatus.RESERVED,
        AssetStatus.UNDER_MAINTENANCE,
        AssetStatus.LOST,
        AssetStatus.RETIRED,
    },
    AssetStatus.ALLOCATED: {
        AssetStatus.AVAILABLE,
        AssetStatus.UNDER_MAINTENANCE,
        AssetStatus.LOST,
    },
    AssetStatus.UNDER_MAINTENANCE: {AssetStatus.AVAILABLE},
    AssetStatus.RESERVED: {AssetStatus.AVAILABLE, AssetStatus.ALLOCATED},
    AssetStatus.LOST: set(),
    AssetStatus.RETIRED: {AssetStatus.DISPOSED},
    AssetStatus.DISPOSED: set(),
}


class AssetStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=AssetStatus.choices)

    def validate(self, attrs):
        target = attrs["status"]
        current = self.context.get("current_status")
        if current and target != current:
            allowed = VALID_TRANSITIONS.get(current, set())
            if target not in allowed:
                raise serializers.ValidationError(
                    {"status": f"Cannot transition from {current} to {target}."}
                )
        return attrs
