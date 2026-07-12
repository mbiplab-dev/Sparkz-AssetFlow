from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AuditCycleViewSet, AuditItemViewSet, DiscrepancyViewSet

router = DefaultRouter()
router.register(r"cycles", AuditCycleViewSet, basename="audit-cycle")
router.register(r"items", AuditItemViewSet, basename="audit-item")
router.register(r"discrepancies", DiscrepancyViewSet, basename="discrepancy")

urlpatterns = [
    path("", include(router.urls)),
]
