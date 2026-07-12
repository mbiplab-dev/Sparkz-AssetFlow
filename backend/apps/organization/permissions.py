from rest_framework.permissions import BasePermission

from apps.authentication.models import UserRole


class IsAdmin(BasePermission):
    """Only users with role='admin' pass. Everything on the Org Setup screen is admin-only."""

    message = "Only administrators can perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and getattr(user, "role", None) == UserRole.ADMIN
        )
