from rest_framework.permissions import BasePermission

from apps.authentication.models import UserRole


class IsAssetManager(BasePermission):
    message = "Only the Asset Manager can perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.role in (UserRole.ADMIN, UserRole.ASSET_MANAGER)
        )


class IsAssetManagerOrDepartmentHead(BasePermission):
    message = "Only the Asset Manager or a Department Head can perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role in (UserRole.ADMIN, UserRole.ASSET_MANAGER, UserRole.DEPARTMENT_HEAD)
        )


class IsDepartmentHeadOrEmployee(BasePermission):
    message = "Only a Department Head or Employee can perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role in (UserRole.ADMIN, UserRole.DEPARTMENT_HEAD, UserRole.EMPLOYEE)
        )
