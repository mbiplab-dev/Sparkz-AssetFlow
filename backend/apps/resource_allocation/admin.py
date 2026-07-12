from django.contrib import admin

from .models import AllocationRequest, Asset, Holding, Transfer


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "total_quantity", "is_bookable", "created_at")
    list_filter = ("category", "is_bookable")
    search_fields = ("name",)


@admin.register(Holding)
class HoldingAdmin(admin.ModelAdmin):
    list_display = ("asset", "holder_type", "holder_id", "quantity")
    list_filter = ("holder_type",)


@admin.register(AllocationRequest)
class AllocationRequestAdmin(admin.ModelAdmin):
    list_display = ("asset", "quantity_requested", "quantity_fulfilled", "status", "created_at")
    list_filter = ("status",)


@admin.register(Transfer)
class TransferAdmin(admin.ModelAdmin):
    list_display = (
        "asset",
        "from_holder_type",
        "to_holder_type",
        "quantity",
        "kind",
        "created_at",
    )
    list_filter = ("kind",)
