from rest_framework import serializers

from apps.authentication.models import User, UserRole, UserStatus

from .models import AssetCategory, Department


class DepartmentSerializer(serializers.ModelSerializer):
    head_name = serializers.CharField(source="head.full_name", read_only=True)
    parent_name = serializers.CharField(source="parent.name", read_only=True)

    class Meta:
        model = Department
        fields = (
            "id",
            "name",
            "code",
            "parent",
            "parent_name",
            "head",
            "head_name",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "parent_name", "head_name", "created_at", "updated_at")

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Department name is required.")
        return value

    def validate(self, attrs):
        parent = attrs.get("parent")
        if parent and self.instance and parent.pk == self.instance.pk:
            raise serializers.ValidationError({"parent": "A department cannot be its own parent."})
        return attrs


class AssetCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetCategory
        fields = ("id", "name", "description", "custom_fields_schema", "status", "created_at")
        read_only_fields = ("id", "created_at")

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Category name is required.")
        return value

    def validate_custom_fields_schema(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("custom_fields_schema must be a JSON object.")
        return value


class EmployeeSerializer(serializers.ModelSerializer):
    """Employee directory row - used on Screen 3 Tab C."""

    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "phone",
            "role",
            "status",
            "department",
            "department_name",
            "date_joined",
        )
        read_only_fields = ("id", "email", "full_name", "phone", "department_name", "date_joined")


class EmployeeRoleUpdateSerializer(serializers.Serializer):
    """Admin promotes/demotes an employee - the only place role is assigned."""

    role = serializers.ChoiceField(choices=UserRole.choices)


class EmployeeStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=UserStatus.choices)


class EmployeeDepartmentUpdateSerializer(serializers.Serializer):
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        allow_null=True,
    )
