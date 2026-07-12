from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AssetCategoryViewSet, DepartmentViewSet, EmployeeViewSet

router = DefaultRouter()
router.register(r"departments", DepartmentViewSet, basename="department")
router.register(r"categories", AssetCategoryViewSet, basename="category")
router.register(r"employees", EmployeeViewSet, basename="employee")

urlpatterns = [
    path("", include(router.urls)),
]
