import threading

from django.db import connection
from django.db.models import Sum
from django.test import TestCase, TransactionTestCase

from apps.authentication.models import User, UserRole
from apps.organization.models import AssetCategory, Department
from apps.resource_allocation import services
from apps.resource_allocation.models import HolderType, Holding, RequestStatus


class RequestFixtureMixin:
    def make_fixture(self, total_quantity=10):
        category = AssetCategory.objects.create(name="Vehicles")
        self.manager_user = User.objects.create_user(
            email="mgr6@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.dept_a = Department.objects.create(name="Dept A")
        self.dept_b = Department.objects.create(name="Dept B")
        self.dept_c = Department.objects.create(name="Dept C")
        self.head_a = User.objects.create_user(
            email="head-a@example.com",
            password="pw",
            full_name="Head A",
            role=UserRole.DEPARTMENT_HEAD,
            department=self.dept_a,
        )
        self.head_b = User.objects.create_user(
            email="head-b@example.com",
            password="pw",
            full_name="Head B",
            role=UserRole.DEPARTMENT_HEAD,
            department=self.dept_b,
        )
        self.head_c = User.objects.create_user(
            email="head-c@example.com",
            password="pw",
            full_name="Head C",
            role=UserRole.DEPARTMENT_HEAD,
            department=self.dept_c,
        )
        self.asset = services.register_asset(
            name="Cars",
            category=category,
            total_quantity=total_quantity,
            condition="good",
            location="Lot A",
            is_bookable=False,
            created_by=self.manager_user,
        )
        return self.asset


class CreateRequestTests(RequestFixtureMixin, TestCase):
    def test_creates_open_request(self):
        asset = self.make_fixture()
        req = services.create_request(
            asset=asset,
            requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT,
            for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )
        self.assertEqual(req.status, RequestStatus.OPEN)
        self.assertEqual(req.quantity_fulfilled, 0)


class SpareQuantityTests(RequestFixtureMixin, TestCase):
    def test_spare_is_department_holding_minus_employee_suballocations(self):
        asset = self.make_fixture()
        employee = User.objects.create_user(
            email="emp-a@example.com",
            password="pw",
            full_name="Emp A",
            department=self.dept_a,
        )
        services.allocate(
            asset=asset,
            to_holder_type=HolderType.DEPARTMENT,
            to_holder_id=self.dept_a.id,
            quantity=5,
            performed_by=self.manager_user,
        )
        services.sub_allocate(
            asset=asset,
            department=self.dept_a,
            employee=employee,
            quantity=2,
            performed_by=self.head_a,
        )
        self.assertEqual(services.spare_quantity(asset=asset, department_id=self.dept_a.id), 3)


class FulfillFromManagerPoolTests(RequestFixtureMixin, TestCase):
    def test_fulfill_from_manager_pool_resolves_request(self):
        asset = self.make_fixture()
        req = services.create_request(
            asset=asset,
            requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT,
            for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )
        services.fulfill_request(
            request=req,
            from_holder_type=HolderType.MANAGER,
            from_holder_id=0,
            quantity=2,
            performed_by=self.manager_user,
        )
        req.refresh_from_db()
        self.assertEqual(req.status, RequestStatus.FULFILLED)
        self.assertEqual(req.quantity_fulfilled, 2)

    def test_overfulfilling_rejected(self):
        asset = self.make_fixture()
        req = services.create_request(
            asset=asset,
            requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT,
            for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )
        with self.assertRaises(services.InsufficientQuantityError):
            services.fulfill_request(
                request=req,
                from_holder_type=HolderType.MANAGER,
                from_holder_id=0,
                quantity=3,
                performed_by=self.manager_user,
            )


class PeerFulfillmentTests(RequestFixtureMixin, TestCase):
    """Reproduces the '10 cars, Dept C wants 2, manager pool empty' scenario."""

    def setUp(self):
        asset = self.make_fixture(total_quantity=10)
        # All 10 cars pushed out to Dept A (6) and Dept B (4); manager pool is now empty.
        services.allocate(
            asset=asset,
            to_holder_type=HolderType.DEPARTMENT,
            to_holder_id=self.dept_a.id,
            quantity=6,
            performed_by=self.manager_user,
        )
        services.allocate(
            asset=asset,
            to_holder_type=HolderType.DEPARTMENT,
            to_holder_id=self.dept_b.id,
            quantity=4,
            performed_by=self.manager_user,
        )
        self.asset = asset
        self.request = services.create_request(
            asset=asset,
            requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT,
            for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )

    def test_request_appears_for_holders_with_spare_quantity(self):
        open_requests = services.open_requests_for_peer_fulfillment(asset=self.asset)
        self.assertIn(self.request, list(open_requests))

    def test_single_department_can_fully_fulfill(self):
        services.fulfill_request(
            request=self.request,
            from_holder_type=HolderType.DEPARTMENT,
            from_holder_id=self.dept_a.id,
            quantity=2,
            performed_by=self.head_a,
        )
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, RequestStatus.FULFILLED)
        dept_a_holding = Holding.objects.get(
            asset=self.asset,
            holder_type=HolderType.DEPARTMENT,
            holder_id=self.dept_a.id,
        )
        self.assertEqual(dept_a_holding.quantity, 4)

    def test_two_departments_can_split_fulfillment(self):
        services.fulfill_request(
            request=self.request,
            from_holder_type=HolderType.DEPARTMENT,
            from_holder_id=self.dept_a.id,
            quantity=1,
            performed_by=self.head_a,
        )
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, RequestStatus.PARTIALLY_FULFILLED)

        services.fulfill_request(
            request=self.request,
            from_holder_type=HolderType.DEPARTMENT,
            from_holder_id=self.dept_b.id,
            quantity=1,
            performed_by=self.head_b,
        )
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, RequestStatus.FULFILLED)
        self.assertEqual(self.request.quantity_fulfilled, 2)

    def test_invariant_holds_after_fulfillment(self):
        services.fulfill_request(
            request=self.request,
            from_holder_type=HolderType.DEPARTMENT,
            from_holder_id=self.dept_a.id,
            quantity=2,
            performed_by=self.head_a,
        )
        total = Holding.objects.filter(asset=self.asset).aggregate(total=Sum("quantity"))["total"]
        self.assertEqual(total, 10)


class RejectAndCancelTests(RequestFixtureMixin, TestCase):
    def test_reject_sets_status(self):
        asset = self.make_fixture()
        req = services.create_request(
            asset=asset,
            requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT,
            for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )
        services.reject_request(request=req, performed_by=self.manager_user)
        req.refresh_from_db()
        self.assertEqual(req.status, RequestStatus.REJECTED)

    def test_cancel_only_by_requester(self):
        asset = self.make_fixture()
        req = services.create_request(
            asset=asset,
            requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT,
            for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )
        with self.assertRaises(services.InvalidHolderError):
            services.cancel_request(request=req, performed_by=self.head_a)
        services.cancel_request(request=req, performed_by=self.head_c)
        req.refresh_from_db()
        self.assertEqual(req.status, RequestStatus.CANCELLED)

    def test_cannot_act_on_already_resolved_request(self):
        asset = self.make_fixture()
        req = services.create_request(
            asset=asset,
            requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT,
            for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )
        services.reject_request(request=req, performed_by=self.manager_user)
        with self.assertRaises(ValueError):
            services.reject_request(request=req, performed_by=self.manager_user)


class ConcurrentPeerFulfillmentTests(RequestFixtureMixin, TransactionTestCase):
    def test_two_departments_racing_to_fulfill_never_overfulfill(self):
        asset = self.make_fixture(total_quantity=10)
        services.allocate(
            asset=asset,
            to_holder_type=HolderType.DEPARTMENT,
            to_holder_id=self.dept_a.id,
            quantity=6,
            performed_by=self.manager_user,
        )
        services.allocate(
            asset=asset,
            to_holder_type=HolderType.DEPARTMENT,
            to_holder_id=self.dept_b.id,
            quantity=4,
            performed_by=self.manager_user,
        )
        request = services.create_request(
            asset=asset,
            requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT,
            for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )
        errors = []

        def try_fulfill(from_dept_id, head_user, qty):
            try:
                services.fulfill_request(
                    request=request,
                    from_holder_type=HolderType.DEPARTMENT,
                    from_holder_id=from_dept_id,
                    quantity=qty,
                    performed_by=head_user,
                )
            except (services.InsufficientQuantityError, ValueError) as exc:
                errors.append(exc)
            finally:
                connection.close()

        t1 = threading.Thread(target=try_fulfill, args=(self.dept_a.id, self.head_a, 2))
        t2 = threading.Thread(target=try_fulfill, args=(self.dept_b.id, self.head_b, 2))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        request.refresh_from_db()
        self.assertEqual(request.quantity_fulfilled, 2)
        self.assertEqual(request.status, RequestStatus.FULFILLED)
        self.assertEqual(len(errors), 1)
