from rest_framework import serializers

from apps.assets.models import Asset

from .models import MaintenancePriority, MaintenanceRequest, MaintenanceStatus


class MaintenanceRequestSerializer(serializers.ModelSerializer):
    """Read serializer with resolved names/labels for the Kanban card."""

    asset_tag = serializers.CharField(source="asset.asset_tag", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    category_name = serializers.CharField(source="asset.category.name", read_only=True)

    raised_by_name = serializers.CharField(source="raised_by.full_name", read_only=True)
    raised_by_email = serializers.CharField(source="raised_by.email", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.full_name", read_only=True)
    technician_name = serializers.CharField(source="technician.full_name", read_only=True)

    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = MaintenanceRequest
        fields = (
            "id",
            "asset",
            "asset_tag",
            "asset_name",
            "category_name",
            "raised_by",
            "raised_by_name",
            "raised_by_email",
            "issue_description",
            "priority",
            "priority_label",
            "status",
            "status_label",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "rejection_reason",
            "technician",
            "technician_name",
            "assigned_at",
            "started_at",
            "resolved_at",
            "resolution_notes",
            "estimated_cost",
            "actual_cost",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "asset_tag",
            "asset_name",
            "category_name",
            "raised_by",
            "raised_by_name",
            "raised_by_email",
            "priority_label",
            "status",
            "status_label",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "rejection_reason",
            "technician",
            "technician_name",
            "assigned_at",
            "started_at",
            "resolved_at",
            "resolution_notes",
            "actual_cost",
            "created_at",
            "updated_at",
        )


class MaintenanceRequestCreateSerializer(serializers.Serializer):
    """Write payload for raising a new maintenance request."""

    asset = serializers.PrimaryKeyRelatedField(queryset=Asset.objects.all())
    issue_description = serializers.CharField()
    priority = serializers.ChoiceField(
        choices=MaintenancePriority.choices, default=MaintenancePriority.MEDIUM
    )
    estimated_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )

    def validate_issue_description(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Issue description is required.")
        return value


class MaintenanceRejectSerializer(serializers.Serializer):
    reason = serializers.CharField()

    def validate_reason(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Rejection reason is required.")
        return value


class MaintenanceStartSerializer(serializers.Serializer):
    technician = serializers.IntegerField(required=False, allow_null=True)


class MaintenanceResolveSerializer(serializers.Serializer):
    resolution_notes = serializers.CharField()
    actual_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )

    def validate_resolution_notes(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Resolution notes are required.")
        return value


# Valid transitions enforced at the action layer.
ALLOWED_SOURCE = {
    "approve": {MaintenanceStatus.PENDING},
    "reject": {MaintenanceStatus.PENDING},
    "start": {MaintenanceStatus.APPROVED, MaintenanceStatus.ASSIGNED},
    "resolve": {MaintenanceStatus.IN_PROGRESS},
}
