from django.contrib import admin

from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "asset",
        "booked_by",
        "starts_at",
        "ends_at",
        "status",
    )
    list_filter = ("status", "reminder_sent")
    search_fields = ("asset__asset_tag", "asset__name", "booked_by__email", "purpose")
    readonly_fields = ("created_at", "cancelled_at", "cancelled_by", "reminder_sent")
