from rest_framework.permissions import BasePermission

from apps.authentication.models import UserRole

# Who can see the full org activity trail.
_VIEWERS = {
    UserRole.ADMIN,
    UserRole.ASSET_MANAGER,
    UserRole.DEPARTMENT_HEAD,
}


class CanViewActivity(BasePermission):
    """Admins / managers / dept heads see full trail; employees see own actions."""

    message = "You do not have permission to view activity logs."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated)


class CanExportData(BasePermission):
    """CSV exports are for managers and above (not plain employees)."""

    message = "Only administrators, asset managers, and department heads can export data."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "role", None)
            in (UserRole.ADMIN, UserRole.ASSET_MANAGER, UserRole.DEPARTMENT_HEAD)
        )


class IsManagerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "role", None) in (UserRole.ADMIN, UserRole.ASSET_MANAGER)
        )
