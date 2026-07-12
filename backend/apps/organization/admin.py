from django.contrib import admin

from .models import AssetCategory, Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "head", "parent", "status")
    list_filter = ("status",)
    search_fields = ("name", "code")


@admin.register(AssetCategory)
class AssetCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("name",)
