import threading

from django.db import connection
from django.test import TestCase, TransactionTestCase

from apps.authentication.models import User, UserRole
from apps.organization.models import AssetCategory, Department
from apps.resource_allocation import services
from apps.resource_allocation.models import (
    MANAGER_HOLDER_ID,
    HolderType,
    Holding,
    Transfer,
    TransferKind,
)


class RegisterAssetTests(TestCase):
    def setUp(self):
        self.category = AssetCategory.objects.create(name="Stationery")
        self.manager = User.objects.create_user(
            email="mgr@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )

    def test_creates_asset_with_full_manager_holding(self):
        asset = services.register_asset(
            name="Pens",
            category=self.category,
            total_quantity=500,
            condition="new",
            location="HQ",
            is_bookable=False,
            created_by=self.manager,
        )
        holding = Holding.objects.get(
            asset=asset,
            holder_type=HolderType.MANAGER,
            holder_id=MANAGER_HOLDER_ID,
        )
        self.assertEqual(holding.quantity, 500)
        self.assertEqual(asset.total_quantity, 500)


class MoveQuantityTests(TestCase):
    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        self.manager_user = User.objects.create_user(
            email="mgr2@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.asset = services.register_asset(
            name="Cars",
            category=category,
            total_quantity=10,
            condition="good",
            location="Lot A",
            is_bookable=False,
            created_by=self.manager_user,
        )

    def test_moves_quantity_between_holdings_and_logs_transfer(self):
        transfer = services.move_quantity(
            asset=self.asset,
            from_holder_type=HolderType.MANAGER,
            from_holder_id=MANAGER_HOLDER_ID,
            to_holder_type=HolderType.DEPARTMENT,
            to_holder_id=1,
            quantity=3,
            performed_by=self.manager_user,
            kind=TransferKind.ALLOCATE,
        )
        manager_holding = Holding.objects.get(
            asset=self.asset,
            holder_type=HolderType.MANAGER,
            holder_id=MANAGER_HOLDER_ID,
        )
        dept_holding = Holding.objects.get(
            asset=self.asset,
            holder_type=HolderType.DEPARTMENT,
            holder_id=1,
        )
        self.assertEqual(manager_holding.quantity, 7)
        self.assertEqual(dept_holding.quantity, 3)
        self.assertEqual(transfer.quantity, 3)
        self.assertEqual(Transfer.objects.count(), 1)

    def test_insufficient_quantity_raises_and_leaves_holdings_untouched(self):
        with self.assertRaises(services.InsufficientQuantityError):
            services.move_quantity(
                asset=self.asset,
                from_holder_type=HolderType.MANAGER,
                from_holder_id=MANAGER_HOLDER_ID,
                to_holder_type=HolderType.DEPARTMENT,
                to_holder_id=1,
                quantity=999,
                performed_by=self.manager_user,
                kind=TransferKind.ALLOCATE,
            )
        manager_holding = Holding.objects.get(
            asset=self.asset,
            holder_type=HolderType.MANAGER,
            holder_id=MANAGER_HOLDER_ID,
        )
        self.assertEqual(manager_holding.quantity, 10)
        self.assertEqual(Transfer.objects.count(), 0)

    def test_zero_or_negative_quantity_rejected(self):
        with self.assertRaises(ValueError):
            services.move_quantity(
                asset=self.asset,
                from_holder_type=HolderType.MANAGER,
                from_holder_id=MANAGER_HOLDER_ID,
                to_holder_type=HolderType.DEPARTMENT,
                to_holder_id=1,
                quantity=0,
                performed_by=self.manager_user,
                kind=TransferKind.ALLOCATE,
            )


class AdjustStockTests(TestCase):
    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        self.manager_user = User.objects.create_user(
            email="mgr3@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.asset = services.register_asset(
            name="Cars",
            category=category,
            total_quantity=10,
            condition="good",
            location="Lot A",
            is_bookable=False,
            created_by=self.manager_user,
        )

    def test_increase_adds_to_manager_pool_and_total(self):
        services.adjust_stock(asset=self.asset, delta=5, performed_by=self.manager_user)
        self.asset.refresh_from_db()
        holding = Holding.objects.get(
            asset=self.asset,
            holder_type=HolderType.MANAGER,
            holder_id=MANAGER_HOLDER_ID,
        )
        self.assertEqual(self.asset.total_quantity, 15)
        self.assertEqual(holding.quantity, 15)

    def test_decrease_beyond_manager_pool_rejected(self):
        services.move_quantity(
            asset=self.asset,
            from_holder_type=HolderType.MANAGER,
            from_holder_id=MANAGER_HOLDER_ID,
            to_holder_type=HolderType.DEPARTMENT,
            to_holder_id=1,
            quantity=8,
            performed_by=self.manager_user,
            kind=TransferKind.ALLOCATE,
        )
        with self.assertRaises(services.InsufficientQuantityError):
            services.adjust_stock(asset=self.asset, delta=-5, performed_by=self.manager_user)


class ConcurrentMoveQuantityTests(TransactionTestCase):
    """Race two concurrent moves against a finite manager pool; invariant must hold."""

    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        self.manager_user = User.objects.create_user(
            email="mgr4@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.asset = services.register_asset(
            name="Cars",
            category=category,
            total_quantity=5,
            condition="good",
            location="Lot A",
            is_bookable=False,
            created_by=self.manager_user,
        )

    def test_two_racing_allocations_never_oversell_the_pool(self):
        errors = []

        def try_allocate(dept_id, qty):
            try:
                services.move_quantity(
                    asset=self.asset,
                    from_holder_type=HolderType.MANAGER,
                    from_holder_id=MANAGER_HOLDER_ID,
                    to_holder_type=HolderType.DEPARTMENT,
                    to_holder_id=dept_id,
                    quantity=qty,
                    performed_by=self.manager_user,
                    kind=TransferKind.ALLOCATE,
                )
            except services.InsufficientQuantityError as exc:
                errors.append(exc)
            finally:
                connection.close()

        t1 = threading.Thread(target=try_allocate, args=(1, 3))
        t2 = threading.Thread(target=try_allocate, args=(2, 3))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Only one of the two 3-unit allocations can succeed against a pool of 5.
        self.assertEqual(len(errors), 1)
        total_held = Holding.objects.filter(asset=self.asset).aggregate(
            total=__import__("django.db.models", fromlist=["Sum"]).Sum("quantity")
        )["total"]
        self.assertEqual(total_held, 5)


class AllocateTests(TestCase):
    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        self.manager_user = User.objects.create_user(
            email="mgr5@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.asset = services.register_asset(
            name="Cars",
            category=category,
            total_quantity=10,
            condition="good",
            location="Lot A",
            is_bookable=False,
            created_by=self.manager_user,
        )

    def test_allocate_pushes_from_manager_pool_with_no_approval_check(self):
        services.allocate(
            asset=self.asset,
            to_holder_type=HolderType.DEPARTMENT,
            to_holder_id=1,
            quantity=4,
            performed_by=self.manager_user,
        )
        dept_holding = Holding.objects.get(
            asset=self.asset,
            holder_type=HolderType.DEPARTMENT,
            holder_id=1,
        )
        self.assertEqual(dept_holding.quantity, 4)


class SubAllocateTests(TestCase):
    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        self.dept = Department.objects.create(name="Sales")
        self.head = User.objects.create_user(
            email="head@example.com",
            password="pw",
            full_name="Head",
            role=UserRole.DEPARTMENT_HEAD,
            department=self.dept,
        )
        self.employee_in_dept = User.objects.create_user(
            email="emp-in@example.com",
            password="pw",
            full_name="Employee In",
            department=self.dept,
        )
        self.employee_other_dept = User.objects.create_user(
            email="emp-out@example.com",
            password="pw",
            full_name="Employee Out",
        )
        self.asset = services.register_asset(
            name="Cars",
            category=category,
            total_quantity=10,
            condition="good",
            location="Lot A",
            is_bookable=False,
            created_by=self.head,
        )
        services.allocate(
            asset=self.asset,
            to_holder_type=HolderType.DEPARTMENT,
            to_holder_id=self.dept.id,
            quantity=5,
            performed_by=self.head,
        )

    def test_sub_allocate_to_own_employee_succeeds(self):
        services.sub_allocate(
            asset=self.asset,
            department=self.dept,
            employee=self.employee_in_dept,
            quantity=2,
            performed_by=self.head,
        )
        emp_holding = Holding.objects.get(
            asset=self.asset,
            holder_type=HolderType.EMPLOYEE,
            holder_id=self.employee_in_dept.id,
        )
        dept_holding = Holding.objects.get(
            asset=self.asset,
            holder_type=HolderType.DEPARTMENT,
            holder_id=self.dept.id,
        )
        self.assertEqual(emp_holding.quantity, 2)
        self.assertEqual(dept_holding.quantity, 3)

    def test_sub_allocate_to_employee_outside_department_rejected(self):
        with self.assertRaises(services.InvalidHolderError):
            services.sub_allocate(
                asset=self.asset,
                department=self.dept,
                employee=self.employee_other_dept,
                quantity=1,
                performed_by=self.head,
            )


class ReturnQuantityTests(TestCase):
    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        self.manager_user = User.objects.create_user(
            email="mgr7@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.asset = services.register_asset(
            name="Cars",
            category=category,
            total_quantity=10,
            condition="good",
            location="Lot A",
            is_bookable=False,
            created_by=self.manager_user,
        )
        services.allocate(
            asset=self.asset,
            to_holder_type=HolderType.DEPARTMENT,
            to_holder_id=1,
            quantity=4,
            performed_by=self.manager_user,
        )

    def test_return_moves_quantity_back_to_manager_pool(self):
        services.return_quantity(
            asset=self.asset,
            from_holder_type=HolderType.DEPARTMENT,
            from_holder_id=1,
            quantity=2,
            performed_by=self.manager_user,
        )
        manager_holding = Holding.objects.get(
            asset=self.asset,
            holder_type=HolderType.MANAGER,
            holder_id=MANAGER_HOLDER_ID,
        )
        dept_holding = Holding.objects.get(
            asset=self.asset,
            holder_type=HolderType.DEPARTMENT,
            holder_id=1,
        )
        self.assertEqual(manager_holding.quantity, 8)
        self.assertEqual(dept_holding.quantity, 2)
