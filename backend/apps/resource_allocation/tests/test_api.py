from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.models import User, UserRole
from apps.organization.models import AssetCategory


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
