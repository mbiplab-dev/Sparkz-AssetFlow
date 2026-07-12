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
