from django.urls import path

from .exports import (
    ExportAssetsView,
    ExportBookingsView,
    ExportCategoriesView,
    ExportDepartmentsView,
    ExportEmployeesView,
    ExportHoldingsView,
    ExportMaintenanceView,
)
from .views import (
    DashboardNotificationsView,
    DashboardReportsView,
    DashboardSummaryView,
)

urlpatterns = [
    path("summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("reports/", DashboardReportsView.as_view(), name="dashboard-reports"),
    path(
        "notifications/",
        DashboardNotificationsView.as_view(),
        name="dashboard-notifications",
    ),
    # CSV exports — appended at bottom to minimise merge conflicts with other agents.
    path(
        "export/departments/",
        ExportDepartmentsView.as_view(),
        name="dashboard-export-departments",
    ),
    path(
        "export/categories/",
        ExportCategoriesView.as_view(),
        name="dashboard-export-categories",
    ),
    path(
        "export/employees/",
        ExportEmployeesView.as_view(),
        name="dashboard-export-employees",
    ),
    path(
        "export/assets/",
        ExportAssetsView.as_view(),
        name="dashboard-export-assets",
    ),
    path(
        "export/holdings/",
        ExportHoldingsView.as_view(),
        name="dashboard-export-holdings",
    ),
    path(
        "export/bookings/",
        ExportBookingsView.as_view(),
        name="dashboard-export-bookings",
    ),
    path(
        "export/maintenance/",
        ExportMaintenanceView.as_view(),
        name="dashboard-export-maintenance",
    ),
]
