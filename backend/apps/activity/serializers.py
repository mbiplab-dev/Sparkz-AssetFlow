from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_email = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = [
            "id",
            "action",
            "entity_type",
            "entity_id",
            "message",
            "before_data",
            "after_data",
            "actor",
            "actor_name",
            "actor_email",
            "ip_addr",
            "created_at",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_actor_name(self, obj):
        if not obj.actor_id:
            return None
        return obj.actor.full_name or obj.actor.email

    @extend_schema_field(serializers.EmailField(allow_null=True))
    def get_actor_email(self, obj):
        if not obj.actor_id:
            return None
        return obj.actor.email
