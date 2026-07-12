from rest_framework import serializers


class DashboardKPISerializer(serializers.Serializer):
    """Counts for the Screen 2 'Today's Overview' cards."""

    assets_available = serializers.IntegerField()
    assets_allocated = serializers.IntegerField()
    maintenance_today = serializers.IntegerField()
    active_bookings = serializers.IntegerField()
    pending_transfers = serializers.IntegerField()
    upcoming_returns = serializers.IntegerField()
    overdue_returns = serializers.IntegerField()


class ActivityItemSerializer(serializers.Serializer):
    """One row of the dashboard Recent Activity feed."""

    id = serializers.IntegerField()
    message = serializers.CharField()
    timestamp = serializers.DateTimeField()


class DashboardSummarySerializer(serializers.Serializer):
    kpis = DashboardKPISerializer()
    recent_activity = ActivityItemSerializer(many=True)


class CategoryCountSerializer(serializers.Serializer):
    category = serializers.CharField()
    count = serializers.IntegerField()


class DepartmentCountSerializer(serializers.Serializer):
    department = serializers.CharField()
    count = serializers.IntegerField()


class TopUsedAssetSerializer(serializers.Serializer):
    asset_id = serializers.IntegerField()
    asset_tag = serializers.CharField()
    name = serializers.CharField()
    count = serializers.IntegerField()


class BookingHourLoadSerializer(serializers.Serializer):
    hour = serializers.IntegerField()
    count = serializers.IntegerField()


class DashboardTotalsSerializer(serializers.Serializer):
    assets_total = serializers.IntegerField()
    assets_bookable = serializers.IntegerField()
    bookings_active = serializers.IntegerField()
    bookings_total = serializers.IntegerField()
    maintenance_open = serializers.IntegerField()
    holdings_out = serializers.IntegerField()
    resource_pool_units = serializers.IntegerField()


class DashboardReportsSerializer(serializers.Serializer):
    """Full analytics payload for the Reports screen."""

    assets_by_status = serializers.DictField(child=serializers.IntegerField())
    assets_by_category = CategoryCountSerializer(many=True)
    assets_by_department = DepartmentCountSerializer(many=True)
    maintenance_by_status = serializers.DictField(child=serializers.IntegerField())
    maintenance_by_category = CategoryCountSerializer(many=True)
    top_used_assets = TopUsedAssetSerializer(many=True)
    booking_load_by_hour = BookingHourLoadSerializer(many=True)
    overdue_returns_count = serializers.IntegerField()
    totals = DashboardTotalsSerializer(required=False)


class NotificationItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    kind = serializers.CharField()
    title = serializers.CharField()
    body = serializers.CharField()
    entity = serializers.CharField()
    entity_id = serializers.IntegerField()
    actor_name = serializers.CharField(allow_null=True, required=False)
    timestamp = serializers.DateTimeField()
    is_overdue = serializers.BooleanField(required=False, default=False)


class NotificationFeedSerializer(serializers.Serializer):
    results = NotificationItemSerializer(many=True)
