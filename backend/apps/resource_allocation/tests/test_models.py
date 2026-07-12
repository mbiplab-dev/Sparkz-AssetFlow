from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.authentication.models import User, UserRole
from apps.organization.models import AssetCategory
from apps.resource_allocation.models import (
    MANAGER_HOLDER_ID,
    AllocationRequest,
    Asset,
    HolderType,
    Holding,
    RequestStatus,
    Transfer,
    TransferKind,
)


class AssetModelTests(TestCase):
    def setUp(self):
        self.category = AssetCategory.objects.create(name="Vehicles")
        self.manager = User.objects.create_user(
            email="mgr@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )

    def test_str_returns_name(self):
        asset = Asset.objects.create(
            name="Cars",
            category=self.category,
            total_quantity=10,
            created_by=self.manager,
        )
        self.assertEqual(str(asset), "Cars")


class HoldingModelTests(TestCase):
    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        manager = User.objects.create_user(
            email="mgr2@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.asset = Asset.objects.create(
            name="Cars",
            category=category,
            total_quantity=10,
            created_by=manager,
        )

    def test_negative_quantity_rejected_at_db_level(self):
        holding = Holding(
            asset=self.asset,
            holder_type=HolderType.DEPARTMENT,
            holder_id=1,
            quantity=-1,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                holding.save()

    def test_manager_holding_must_use_sentinel_id(self):
        holding = Holding(
            asset=self.asset,
            holder_type=HolderType.MANAGER,
            holder_id=5,
            quantity=1,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                holding.save()

    def test_non_manager_holder_id_zero_rejected(self):
        holding = Holding(
            asset=self.asset,
            holder_type=HolderType.DEPARTMENT,
            holder_id=0,
            quantity=1,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                holding.save()

    def test_manager_sentinel_id_is_zero(self):
        self.assertEqual(MANAGER_HOLDER_ID, 0)

    def test_uniqueness_per_asset_holder(self):
        Holding.objects.create(
            asset=self.asset,
            holder_type=HolderType.DEPARTMENT,
            holder_id=1,
            quantity=2,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Holding.objects.create(
                    asset=self.asset,
                    holder_type=HolderType.DEPARTMENT,
                    holder_id=1,
                    quantity=3,
                )


class AllocationRequestModelTests(TestCase):
    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        self.employee = User.objects.create_user(
            email="emp@example.com",
            password="pw",
            full_name="Employee",
        )
        self.asset = Asset.objects.create(
            name="Cars",
            category=category,
            total_quantity=10,
            created_by=self.employee,
        )

    def test_remaining_property(self):
        req = AllocationRequest.objects.create(
            asset=self.asset,
            requested_by=self.employee,
            for_holder_type=HolderType.EMPLOYEE,
            for_holder_id=self.employee.id,
            quantity_requested=5,
            quantity_fulfilled=2,
        )
        self.assertEqual(req.remaining, 3)

    def test_fulfilled_cannot_exceed_requested(self):
        req = AllocationRequest(
            asset=self.asset,
            requested_by=self.employee,
            for_holder_type=HolderType.EMPLOYEE,
            for_holder_id=self.employee.id,
            quantity_requested=5,
            quantity_fulfilled=6,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                req.save()

    def test_default_status_is_open(self):
        req = AllocationRequest.objects.create(
            asset=self.asset,
            requested_by=self.employee,
            for_holder_type=HolderType.EMPLOYEE,
            for_holder_id=self.employee.id,
            quantity_requested=5,
        )
        self.assertEqual(req.status, RequestStatus.OPEN)


class TransferModelTests(TestCase):
    def test_str_format(self):
        category = AssetCategory.objects.create(name="Vehicles")
        manager = User.objects.create_user(
            email="mgr3@example.com",
            password="pw",
            full_name="Manager",
        )
        asset = Asset.objects.create(
            name="Cars",
            category=category,
            total_quantity=10,
            created_by=manager,
        )
        transfer = Transfer.objects.create(
            asset=asset,
            from_holder_type=HolderType.MANAGER,
            from_holder_id=MANAGER_HOLDER_ID,
            to_holder_type=HolderType.DEPARTMENT,
            to_holder_id=1,
            quantity=3,
            kind=TransferKind.ALLOCATE,
            performed_by=manager,
        )
        self.assertIn("manager->department", str(transfer))
