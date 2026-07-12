from rest_framework.permissions import BasePermission

from apps.authentication.models import UserRole


def _is_privileged(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and getattr(user, "role", None) in (UserRole.ADMIN, UserRole.ASSET_MANAGER)
    )


class BookingPermission(BasePermission):
    """Object-level rules for bookings.

    - Read: any authenticated user (further scoping happens in the queryset).
    - Create: any authenticated user.
    - Update / Delete: only the booking owner OR admin/asset_manager.
    """

    message = "You do not have permission to modify this booking."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        user = request.user
        if _is_privileged(user):
            return True
        return obj.booked_by_id == user.id
