from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AssetViewSet, LocationViewSet

router = DefaultRouter()
router.register(r"assets", AssetViewSet, basename="asset")
router.register(r"locations", LocationViewSet, basename="location")

urlpatterns = [
    path("", include(router.urls)),
]
