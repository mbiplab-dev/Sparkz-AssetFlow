from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.models import User, UserRole
from apps.organization.models import AssetCategory, Department
from apps.resource_allocation import services
from apps.resource_allocation.models import HolderType


class AssetApiTests(APITestCase):
    def setUp(self):
        self.category = AssetCategory.objects.create(name="Vehicles")
        self.manager = User.objects.create_user(
            email="mgr9@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.employee = User.objects.create_user(
            email="emp9@example.com",
            password="pw",
            full_name="Employee",
        )

    def test_asset_manager_can_register_asset(self):
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            "/api/resources/assets/",
            {
                "name": "Cars",
                "category": self.category.id,
                "total_quantity": 10,
                "condition": "good",
                "location": "Lot A",
                "is_bookable": False,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["total_quantity"], 10)

    def test_employee_cannot_register_asset(self):
        self.client.force_authenticate(self.employee)
        response = self.client.post(
            "/api/resources/assets/",
            {
                "name": "Cars",
                "category": self.category.id,
                "total_quantity": 10,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_any_authenticated_user_can_list_assets(self):
        self.client.force_authenticate(self.manager)
        self.client.post(
            "/api/resources/assets/",
            {
                "name": "Cars",
                "category": self.category.id,
                "total_quantity": 10,
            },
        )
        self.client.force_authenticate(self.employee)
        response = self.client.get("/api/resources/assets/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_adjust_stock_increases_manager_pool(self):
        self.client.force_authenticate(self.manager)
        create_response = self.client.post(
            "/api/resources/assets/",
            {
                "name": "Cars",
                "category": self.category.id,
                "total_quantity": 10,
            },
        )
        asset_id = create_response.data["id"]
        response = self.client.post(f"/api/resources/assets/{asset_id}/adjust-stock/", {"delta": 5})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_quantity"], 15)

    def test_updating_total_quantity_directly_is_ignored(self):
        self.client.force_authenticate(self.manager)
        create_response = self.client.post(
            "/api/resources/assets/",
            {
                "name": "Cars",
                "category": self.category.id,
                "total_quantity": 10,
            },
        )
        asset_id = create_response.data["id"]
        response = self.client.patch(f"/api/resources/assets/{asset_id}/", {"total_quantity": 999})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_quantity"], 10)


class HoldingScopingApiTests(APITestCase):
    def setUp(self):
        self.category = AssetCategory.objects.create(name="Vehicles")
        self.manager = User.objects.create_user(
            email="mgr10@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.dept_a = Department.objects.create(name="Dept A")
        self.dept_b = Department.objects.create(name="Dept B")
        self.head_a = User.objects.create_user(
            email="head-a10@example.com",
            password="pw",
            full_name="Head A",
            role=UserRole.DEPARTMENT_HEAD,
            department=self.dept_a,
        )
        self.dept_a.head = self.head_a
        self.dept_a.save()
        self.employee_a = User.objects.create_user(
            email="emp-a10@example.com",
            password="pw",
            full_name="Emp A",
            department=self.dept_a,
        )
        self.asset = services.register_asset(
            name="Cars",
            category=self.category,
            total_quantity=10,
            condition="good",
            location="Lot A",
            is_bookable=False,
            created_by=self.manager,
        )
        services.allocate(
            asset=self.asset,
            to_holder_type=HolderType.DEPARTMENT,
            to_holder_id=self.dept_a.id,
            quantity=5,
            performed_by=self.manager,
        )
        services.allocate(
            asset=self.asset,
            to_holder_type=HolderType.DEPARTMENT,
            to_holder_id=self.dept_b.id,
            quantity=3,
            performed_by=self.manager,
        )
        services.sub_allocate(
            asset=self.asset,
            department=self.dept_a,
            employee=self.employee_a,
            quantity=2,
            performed_by=self.head_a,
        )

    def test_asset_manager_sees_all_holdings(self):
        self.client.force_authenticate(self.manager)
        response = self.client.get("/api/resources/holdings/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # manager pool + dept A + dept B + employee A
        self.assertEqual(len(response.data), 4)

    def test_department_head_sees_own_department_and_employees_only(self):
        self.client.force_authenticate(self.head_a)
        response = self.client.get("/api/resources/holdings/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        holder_ids = {(r["holder_type"], r["holder_id"]) for r in response.data}
        self.assertEqual(
            holder_ids, {("department", self.dept_a.id), ("employee", self.employee_a.id)}
        )

    def test_employee_sees_only_own_holding(self):
        self.client.force_authenticate(self.employee_a)
        response = self.client.get("/api/resources/holdings/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        holder_ids = {(r["holder_type"], r["holder_id"]) for r in response.data}
        self.assertEqual(holder_ids, {("employee", self.employee_a.id)})
