from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.authentication.models import UserRole


class IsAdmin(BasePermission):
    """Only users with role='admin' pass. Used for role promotion & hard admin actions."""

    message = "Only administrators can perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and getattr(user, "role", None) == UserRole.ADMIN
        )


class IsAdminOrReadOnly(BasePermission):
    """
    Authenticated users may list/retrieve master data (departments, categories).
    Create / update / delete stay admin-only.

    Asset managers need categories & departments to register assets and allocate;
    department heads need them for filters and booking-on-behalf flows.
    """

    message = "Only administrators can modify organization master data."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return getattr(user, "role", None) == UserRole.ADMIN


class CanReadEmployees(BasePermission):
    """
    List/retrieve employees:
      - admin: everyone
      - asset_manager: everyone (needed for allocation pickers)
      - department_head: everyone active (UI may still filter; server can scope later)
      - employee: self only (handled in get_queryset)

    Mutations (role / status / department) stay admin-only via IsAdmin on actions.
    """

    message = "You do not have permission to view the employee directory."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        # Write actions on the viewset (custom @action mutations) require admin.
        action = getattr(view, "action", None)
        if action in ("set_role", "set_status", "set_department"):
            return getattr(user, "role", None) == UserRole.ADMIN
        if request.method in SAFE_METHODS or action in ("list", "retrieve", None):
            return True
        return getattr(user, "role", None) == UserRole.ADMIN
