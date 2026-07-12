from django.contrib import admin

from .models import MaintenanceRequest


@admin.register(MaintenanceRequest)
class MaintenanceRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "asset", "priority", "status", "raised_by", "technician", "created_at")
    list_filter = ("status", "priority")
    search_fields = ("asset__asset_tag", "asset__name", "issue_description")
    readonly_fields = ("created_at", "updated_at")
