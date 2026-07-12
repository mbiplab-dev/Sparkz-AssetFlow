from django.test import TestCase

from apps.authentication.models import User, UserRole
from apps.organization.models import AssetCategory
from apps.resource_allocation.models import Asset, HolderType
from apps.resource_allocation.serializers import (
    AdjustStockSerializer,
    AllocateSerializer,
    AssetSerializer,
    FulfillRequestSerializer,
    ReturnSerializer,
)


class AssetSerializerTests(TestCase):
    def setUp(self):
        self.category = AssetCategory.objects.create(name="Vehicles")
        self.manager = User.objects.create_user(
            email="mgr8@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )

    def test_valid_payload_is_accepted(self):
        serializer = AssetSerializer(
            data={
                "name": "Cars",
                "category": self.category.id,
                "total_quantity": 10,
                "condition": "good",
                "location": "Lot A",
                "is_bookable": False,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_negative_total_quantity_rejected(self):
        serializer = AssetSerializer(
            data={
                "name": "Cars",
                "category": self.category.id,
                "total_quantity": -1,
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("total_quantity", serializer.errors)

    def test_total_quantity_cannot_be_updated_via_serializer(self):
        """Regression test: total_quantity must not change via serializer.update()"""
        asset = Asset.objects.create(
            name="Laptops",
            category=self.category,
            total_quantity=10,
            created_by=self.manager,
        )
        original_quantity = asset.total_quantity

        serializer = AssetSerializer(
            instance=asset,
            data={
                "name": "Updated Laptops",
                "category": self.category.id,
                "total_quantity": 999,
            },
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        asset.refresh_from_db()
        self.assertEqual(asset.total_quantity, original_quantity)
        self.assertEqual(asset.total_quantity, 10)


class ActionSerializerTests(TestCase):
    def test_adjust_stock_requires_nonzero_delta(self):
        serializer = AdjustStockSerializer(data={"delta": 0})
        self.assertFalse(serializer.is_valid())

    def test_allocate_requires_positive_quantity(self):
        serializer = AllocateSerializer(
            data={
                "asset": 1,
                "to_holder_type": HolderType.DEPARTMENT,
                "to_holder_id": 1,
                "quantity": 0,
            }
        )
        self.assertFalse(serializer.is_valid())

    def test_fulfill_requires_positive_quantity(self):
        serializer = FulfillRequestSerializer(data={"quantity": -1})
        self.assertFalse(serializer.is_valid())

    def test_return_requires_positive_quantity(self):
        serializer = ReturnSerializer(data={"asset": 1, "quantity": 0})
        self.assertFalse(serializer.is_valid())
