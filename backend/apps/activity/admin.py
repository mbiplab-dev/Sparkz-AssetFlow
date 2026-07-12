from django.contrib import admin

from .models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("id", "action", "message", "actor", "entity_type", "entity_id", "created_at")
    list_filter = ("action", "entity_type")
    search_fields = ("message", "action", "actor__email", "actor__full_name")
    readonly_fields = (
        "actor",
        "action",
        "entity_type",
        "entity_id",
        "message",
        "before_data",
        "after_data",
        "ip_addr",
        "created_at",
    )
    ordering = ("-created_at",)
