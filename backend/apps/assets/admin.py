from django.contrib import admin

from .models import Asset, Location


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at")
    search_fields = ("name",)


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("asset_tag", "name", "category", "status", "condition", "department", "is_bookable")
    list_filter = ("status", "condition", "is_bookable")
    search_fields = ("asset_tag", "name", "serial_number")
    readonly_fields = ("asset_tag", "created_at", "updated_at")
