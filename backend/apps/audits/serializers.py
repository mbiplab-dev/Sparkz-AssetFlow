from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.assets.models import Location
from apps.authentication.models import User, UserRole, UserStatus
from apps.organization.models import Department

from .models import AuditCycle, AuditItem, AuditVerdict, Discrepancy


class AuditorBriefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.CharField()


class AuditCycleSerializer(serializers.ModelSerializer):
    scope_department_name = serializers.CharField(
        source="scope_department.name", read_only=True, default=None
    )
    scope_location_name = serializers.CharField(
        source="scope_location.name", read_only=True, default=None
    )
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    closed_by_name = serializers.CharField(
        source="closed_by.full_name", read_only=True, default=None
    )
    auditors = serializers.SerializerMethodField()
    items_total = serializers.IntegerField(read_only=True, required=False)
    items_pending = serializers.IntegerField(read_only=True, required=False)
    items_done = serializers.IntegerField(read_only=True, required=False)
    open_discrepancies = serializers.IntegerField(read_only=True, required=False)

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
            "auditors",
            "created_by",
            "created_by_name",
            "closed_by",
            "closed_by_name",
            "closed_at",
            "created_at",
            "items_total",
            "items_pending",
            "items_done",
            "open_discrepancies",
        )
        read_only_fields = fields

    @extend_schema_field(AuditorBriefSerializer(many=True))
    def get_auditors(self, obj):
        # Prefetch when list/retrieve uses prefetch_related("auditors").
        return [{"id": u.id, "full_name": u.full_name or u.email} for u in obj.auditors.all()]


def _active_employee_qs():
    return User.objects.filter(status=UserStatus.ACTIVE, role=UserRole.EMPLOYEE)


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
        queryset=_active_employee_qs(),
        many=True,
        required=False,
    )

    def validate(self, attrs):
        if attrs["ends_on"] < attrs["starts_on"]:
            raise serializers.ValidationError({"ends_on": "Must be on/after starts_on."})
        return attrs


class AuditorsUpdateSerializer(serializers.Serializer):
    auditor_ids = serializers.PrimaryKeyRelatedField(
        source="auditors",
        queryset=_active_employee_qs(),
        many=True,
    )


class AuditItemSerializer(serializers.ModelSerializer):
    asset_tag = serializers.CharField(source="asset.asset_tag", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    verified_by_name = serializers.CharField(
        source="verified_by.full_name", read_only=True, default=None
    )
    expected_location_id = serializers.IntegerField(
        source="asset.location_id", read_only=True, default=None
    )
    expected_location_name = serializers.CharField(
        source="asset.location.name", read_only=True, default=None
    )

    class Meta:
        model = AuditItem
        fields = (
            "id",
            "cycle",
            "asset",
            "asset_tag",
            "asset_name",
            "expected_location_id",
            "expected_location_name",
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
    resolved_by_name = serializers.CharField(
        source="resolved_by.full_name", read_only=True, default=None
    )

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
            "resolved_by_name",
            "resolved_at",
            "created_at",
        )
        read_only_fields = fields
