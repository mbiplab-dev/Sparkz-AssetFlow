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


class AllocationRequestApiTests(APITestCase):
    def setUp(self):
        self.category = AssetCategory.objects.create(name="Vehicles")
        self.manager = User.objects.create_user(
            email="mgr11@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.dept_a = Department.objects.create(name="Dept A")
        self.dept_c = Department.objects.create(name="Dept C")
        self.head_a = User.objects.create_user(
            email="head-a11@example.com",
            password="pw",
            full_name="Head A",
            role=UserRole.DEPARTMENT_HEAD,
            department=self.dept_a,
        )
        self.head_c = User.objects.create_user(
            email="head-c11@example.com",
            password="pw",
            full_name="Head C",
            role=UserRole.DEPARTMENT_HEAD,
            department=self.dept_c,
        )
        self.dept_a.head = self.head_a
        self.dept_a.save()
        self.dept_c.head = self.head_c
        self.dept_c.save()
        self.asset = services.register_asset(
            name="Cars",
            category=self.category,
            total_quantity=10,
            condition="good",
            location="Lot A",
            is_bookable=False,
            created_by=self.manager,
        )
        # All 10 cars already pushed to Dept A. Manager pool is empty.
        services.allocate(
            asset=self.asset,
            to_holder_type=HolderType.DEPARTMENT,
            to_holder_id=self.dept_a.id,
            quantity=10,
            performed_by=self.manager,
        )

    def test_dept_c_requests_two_cars_and_dept_a_fulfills_via_broadcast(self):
        self.client.force_authenticate(self.head_c)
        create_response = self.client.post(
            "/api/resources/requests/",
            {
                "asset": self.asset.id,
                "for_holder_type": "department",
                "for_holder_id": self.dept_c.id,
                "quantity_requested": 2,
            },
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED, create_response.data)
        request_id = create_response.data["id"]

        self.client.force_authenticate(self.head_a)
        broadcast_response = self.client.get(
            f"/api/resources/requests/broadcast/?asset={self.asset.id}"
        )
        self.assertEqual(broadcast_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(broadcast_response.data), 1)
        self.assertEqual(broadcast_response.data[0]["id"], request_id)

        fulfill_response = self.client.post(
            f"/api/resources/requests/{request_id}/fulfill/", {"quantity": 2}
        )
        self.assertEqual(fulfill_response.status_code, status.HTTP_200_OK, fulfill_response.data)
        self.assertEqual(fulfill_response.data["status"], "fulfilled")
        self.assertEqual(fulfill_response.data["quantity_fulfilled"], 2)

    def test_asset_manager_can_reject_a_request(self):
        self.client.force_authenticate(self.head_c)
        create_response = self.client.post(
            "/api/resources/requests/",
            {
                "asset": self.asset.id,
                "for_holder_type": "department",
                "for_holder_id": self.dept_c.id,
                "quantity_requested": 2,
            },
        )
        request_id = create_response.data["id"]

        self.client.force_authenticate(self.manager)
        reject_response = self.client.post(f"/api/resources/requests/{request_id}/reject/")
        self.assertEqual(reject_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reject_response.data["status"], "rejected")

    def test_requester_can_cancel_own_request(self):
        self.client.force_authenticate(self.head_c)
        create_response = self.client.post(
            "/api/resources/requests/",
            {
                "asset": self.asset.id,
                "for_holder_type": "department",
                "for_holder_id": self.dept_c.id,
                "quantity_requested": 2,
            },
        )
        request_id = create_response.data["id"]

        cancel_response = self.client.post(f"/api/resources/requests/{request_id}/cancel/")
        self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_response.data["status"], "cancelled")

    def test_other_department_head_cannot_cancel_someone_elses_request(self):
        self.client.force_authenticate(self.head_c)
        create_response = self.client.post(
            "/api/resources/requests/",
            {
                "asset": self.asset.id,
                "for_holder_type": "department",
                "for_holder_id": self.dept_c.id,
                "quantity_requested": 2,
            },
        )
        request_id = create_response.data["id"]

        self.client.force_authenticate(self.head_a)
        cancel_response = self.client.post(f"/api/resources/requests/{request_id}/cancel/")
        self.assertEqual(cancel_response.status_code, status.HTTP_403_FORBIDDEN)


class AllocateAndReturnApiTests(APITestCase):
    def setUp(self):
        self.category = AssetCategory.objects.create(name="Vehicles")
        self.manager = User.objects.create_user(
            email="mgr12@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.dept_a = Department.objects.create(name="Dept A")
        self.head_a = User.objects.create_user(
            email="head-a12@example.com",
            password="pw",
            full_name="Head A",
            role=UserRole.DEPARTMENT_HEAD,
            department=self.dept_a,
        )
        self.dept_a.head = self.head_a
        self.dept_a.save()
        self.employee_a = User.objects.create_user(
            email="emp-a12@example.com",
            password="pw",
            full_name="Emp A",
            department=self.dept_a,
        )
        self.employee_other = User.objects.create_user(
            email="emp-other12@example.com",
            password="pw",
            full_name="Emp Other",
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

    def test_asset_manager_can_push_allocate_with_no_check(self):
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            "/api/resources/allocate/",
            {
                "asset": self.asset.id,
                "to_holder_type": "department",
                "to_holder_id": self.dept_a.id,
                "quantity": 4,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_department_head_can_sub_allocate_to_own_employee(self):
        self.client.force_authenticate(self.manager)
        self.client.post(
            "/api/resources/allocate/",
            {
                "asset": self.asset.id,
                "to_holder_type": "department",
                "to_holder_id": self.dept_a.id,
                "quantity": 4,
            },
        )

        self.client.force_authenticate(self.head_a)
        response = self.client.post(
            "/api/resources/allocate/",
            {
                "asset": self.asset.id,
                "to_holder_type": "employee",
                "to_holder_id": self.employee_a.id,
                "quantity": 2,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_department_head_cannot_allocate_to_employee_outside_department(self):
        self.client.force_authenticate(self.manager)
        self.client.post(
            "/api/resources/allocate/",
            {
                "asset": self.asset.id,
                "to_holder_type": "department",
                "to_holder_id": self.dept_a.id,
                "quantity": 4,
            },
        )

        self.client.force_authenticate(self.head_a)
        response = self.client.post(
            "/api/resources/allocate/",
            {
                "asset": self.asset.id,
                "to_holder_type": "employee",
                "to_holder_id": self.employee_other.id,
                "quantity": 1,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_employee_cannot_use_allocate_endpoint(self):
        self.client.force_authenticate(self.employee_a)
        response = self.client.post(
            "/api/resources/allocate/",
            {
                "asset": self.asset.id,
                "to_holder_type": "employee",
                "to_holder_id": self.employee_a.id,
                "quantity": 1,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_department_head_can_return_quantity_to_manager_pool(self):
        self.client.force_authenticate(self.manager)
        self.client.post(
            "/api/resources/allocate/",
            {
                "asset": self.asset.id,
                "to_holder_type": "department",
                "to_holder_id": self.dept_a.id,
                "quantity": 4,
            },
        )

        self.client.force_authenticate(self.head_a)
        response = self.client.post(
            "/api/resources/return/",
            {
                "asset": self.asset.id,
                "quantity": 2,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
