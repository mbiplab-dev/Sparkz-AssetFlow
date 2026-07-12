from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AllocateView,
    AllocationRequestViewSet,
    AssetViewSet,
    HoldingViewSet,
    ReturnView,
    TransferViewSet,
)

router = DefaultRouter()
router.register(r"assets", AssetViewSet, basename="resource-asset")
router.register(r"holdings", HoldingViewSet, basename="holding")
router.register(r"transfers", TransferViewSet, basename="transfer")
router.register(r"requests", AllocationRequestViewSet, basename="allocation-request")

urlpatterns = [
    path("allocate/", AllocateView.as_view(), name="resource-allocate"),
    path("return/", ReturnView.as_view(), name="resource-return"),
    path("", include(router.urls)),
]
