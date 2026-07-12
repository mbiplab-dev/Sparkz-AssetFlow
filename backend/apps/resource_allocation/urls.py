from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AllocationRequestViewSet, AssetViewSet, HoldingViewSet, TransferViewSet

router = DefaultRouter()
router.register(r"assets", AssetViewSet, basename="resource-asset")
router.register(r"holdings", HoldingViewSet, basename="holding")
router.register(r"transfers", TransferViewSet, basename="transfer")
router.register(r"requests", AllocationRequestViewSet, basename="allocation-request")

urlpatterns = [
    path("", include(router.urls)),
]
