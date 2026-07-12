from rest_framework import serializers

from apps.assets.models import Location
from apps.authentication.models import User, UserStatus
from apps.organization.models import Department

from .models import AuditCycle, AuditItem, AuditVerdict, Discrepancy


class AuditCycleSerializer(serializers.ModelSerializer):
    scope_department_name = serializers.CharField(source="scope_department.name", read_only=True)
    scope_location_name = serializers.CharField(source="scope_location.name", read_only=True)
    auditor_ids = serializers.PrimaryKeyRelatedField(source="auditors", many=True, read_only=True)

    class Meta:
        model = AuditCycle
        fields = (
            "id",
            "name",
            "scope_department",
            "scope_department_name",
            "scope_location",
            "scope_location_name",
            "starts_on",
            "ends_on",
            "status",
            "auditor_ids",
            "created_by",
            "closed_by",
            "closed_at",
            "created_at",
        )
        read_only_fields = (
            "id",
            "scope_department_name",
            "scope_location_name",
            "status",
            "auditor_ids",
            "created_by",
            "closed_by",
            "closed_at",
            "created_at",
        )


class AuditCycleCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    scope_department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), required=False, allow_null=True
    )
    scope_location = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.all(), required=False, allow_null=True
    )
    starts_on = serializers.DateField()
    ends_on = serializers.DateField()
    auditor_ids = serializers.PrimaryKeyRelatedField(
        source="auditors",
        queryset=User.objects.filter(status=UserStatus.ACTIVE),
        many=True,
        required=False,
    )

    def validate(self, attrs):
        if attrs["ends_on"] < attrs["starts_on"]:
            raise serializers.ValidationError({"ends_on": "Must be on/after starts_on."})
        return attrs


class AuditorsUpdateSerializer(serializers.Serializer):
    auditor_ids = serializers.PrimaryKeyRelatedField(
        source="auditors", queryset=User.objects.filter(status=UserStatus.ACTIVE), many=True
    )


class AuditItemSerializer(serializers.ModelSerializer):
    asset_tag = serializers.CharField(source="asset.asset_tag", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    verified_by_name = serializers.CharField(source="verified_by.full_name", read_only=True)

    class Meta:
        model = AuditItem
        fields = (
            "id",
            "cycle",
            "asset",
            "asset_tag",
            "asset_name",
            "verdict",
            "verified_by",
            "verified_by_name",
            "verified_at",
            "notes",
        )
        read_only_fields = fields


class AuditItemVerdictSerializer(serializers.Serializer):
    verdict = serializers.ChoiceField(
        choices=[c for c in AuditVerdict.choices if c[0] != AuditVerdict.PENDING]
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class DiscrepancySerializer(serializers.ModelSerializer):
    asset_tag = serializers.CharField(source="audit_item.asset.asset_tag", read_only=True)
    asset_name = serializers.CharField(source="audit_item.asset.name", read_only=True)
    cycle = serializers.PrimaryKeyRelatedField(source="audit_item.cycle", read_only=True)

    class Meta:
        model = Discrepancy
        fields = (
            "id",
            "audit_item",
            "cycle",
            "asset_tag",
            "asset_name",
            "kind",
            "detail",
            "resolved",
            "resolved_by",
            "resolved_at",
            "created_at",
        )
        read_only_fields = fields
