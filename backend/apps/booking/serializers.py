from rest_framework import serializers

from apps.assets.models import Asset
from apps.organization.models import Department

from .models import Booking, BookingStatus


class BookingSerializer(serializers.ModelSerializer):
    """Read + display shape for a booking (includes joined names)."""

    asset_name = serializers.CharField(source="asset.name", read_only=True)
    asset_tag = serializers.CharField(source="asset.asset_tag", read_only=True)
    booked_by_name = serializers.CharField(source="booked_by.full_name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Booking
        fields = (
            "id",
            "asset",
            "asset_name",
            "asset_tag",
            "booked_by",
            "booked_by_name",
            "department",
            "department_name",
            "starts_at",
            "ends_at",
            "purpose",
            "status",
            "status_label",
            "cancelled_at",
            "cancelled_by",
            "reminder_sent",
            "created_at",
        )
        read_only_fields = (
            "id",
            "asset_name",
            "asset_tag",
            "booked_by",
            "booked_by_name",
            "department_name",
            "status",
            "status_label",
            "cancelled_at",
            "cancelled_by",
            "reminder_sent",
            "created_at",
        )


class BookingCreateSerializer(serializers.Serializer):
    """Write payload for creating a booking."""

    asset = serializers.PrimaryKeyRelatedField(queryset=Asset.objects.all())
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        required=False,
        allow_null=True,
    )
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField()
    purpose = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_asset(self, asset: Asset) -> Asset:
        if not asset.is_bookable:
            raise serializers.ValidationError("This asset is not marked as bookable.")
        return asset

    def validate(self, attrs):
        if attrs["ends_at"] <= attrs["starts_at"]:
            raise serializers.ValidationError({"ends_at": "End time must be after the start time."})
        return attrs


class BookingCancelSerializer(serializers.Serializer):
    """Empty payload — cancel is triggered by the endpoint, not the body."""

    reason = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        # `reason` is currently accepted but not persisted — reserved for a
        # future "cancellation_reason" audit column so the API stays stable.
        model = None
        fields = ("reason",)


# Exposed here so views / tests can reference the enum without re-importing.
BOOKING_STATUS = BookingStatus
