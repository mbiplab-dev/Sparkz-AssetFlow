from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.authentication.models import UserRole

from .models import ActivityLog
from .permissions import CanViewActivity
from .serializers import ActivityLogSerializer


@extend_schema_view(
    list=extend_schema(
        tags=["Activity"],
        summary="List activity logs",
        parameters=[
            OpenApiParameter(name="action", description="Filter by action prefix"),
            OpenApiParameter(name="entity_type", description="Filter by entity type"),
            OpenApiParameter(name="search", description="Search in message"),
        ],
    ),
    retrieve=extend_schema(tags=["Activity"], summary="Get one activity log entry"),
)
class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Persistent audit trail.

    - Admin / Asset Manager / Department Head: all org activity
    - Employee: only rows where they are the actor
    """

    queryset = ActivityLog.objects.select_related("actor").all()
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated, CanViewActivity]
    lookup_value_regex = r"[0-9]+"

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role = getattr(user, "role", None)

        if role not in (
            UserRole.ADMIN,
            UserRole.ASSET_MANAGER,
            UserRole.DEPARTMENT_HEAD,
        ):
            qs = qs.filter(actor=user)

        action = self.request.query_params.get("action")
        entity_type = self.request.query_params.get("entity_type")
        search = self.request.query_params.get("search")
        if action:
            qs = qs.filter(action__istartswith=action)
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        if search:
            qs = qs.filter(
                Q(message__icontains=search)
                | Q(action__icontains=search)
                | Q(actor__full_name__icontains=search)
                | Q(actor__email__icontains=search)
            )
        return qs
