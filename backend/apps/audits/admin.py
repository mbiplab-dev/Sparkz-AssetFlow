from django.contrib import admin

from .models import AuditCycle, AuditItem, Discrepancy


@admin.register(AuditCycle)
class AuditCycleAdmin(admin.ModelAdmin):
    list_display = ("name", "scope_department", "scope_location", "status", "starts_on", "ends_on")
    list_filter = ("status",)
    search_fields = ("name",)


@admin.register(AuditItem)
class AuditItemAdmin(admin.ModelAdmin):
    list_display = ("cycle", "asset", "verdict", "verified_by", "verified_at")
    list_filter = ("verdict",)


@admin.register(Discrepancy)
class DiscrepancyAdmin(admin.ModelAdmin):
    list_display = ("audit_item", "kind", "resolved", "resolved_by", "created_at")
    list_filter = ("kind", "resolved")
