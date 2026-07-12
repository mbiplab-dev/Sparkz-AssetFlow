import datetime

from django.test import TestCase

from apps.assets.models import Asset, AssetCondition, AssetStatus, Location
from apps.audits import services
from apps.audits.models import AuditCycleStatus, AuditItem, AuditVerdict, Discrepancy
from apps.authentication.models import User, UserRole
from apps.organization.models import AssetCategory, Department


class AuditsFixtureMixin:
    def make_fixture(self):
        self.category = AssetCategory.objects.create(name="Electronics")
        self.dept_a = Department.objects.create(name="Dept A")
        self.dept_b = Department.objects.create(name="Dept B")
        self.manager = User.objects.create_user(
            email="mgr@example.com",
            password="pw",
            full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.auditor = User.objects.create_user(
            email="auditor@example.com",
            password="pw",
            full_name="Auditor",
        )
        self.asset_a1 = Asset.objects.create(
            name="Laptop A1",
            category=self.category,
            department=self.dept_a,
        )
        self.asset_a2 = Asset.objects.create(
            name="Laptop A2",
            category=self.category,
            department=self.dept_a,
        )
        self.asset_b1 = Asset.objects.create(
            name="Laptop B1",
            category=self.category,
            department=self.dept_b,
        )


class CreateCycleTests(AuditsFixtureMixin, TestCase):
    def test_snapshots_only_in_scope_assets(self):
        self.make_fixture()
        cycle = services.create_cycle(
            name="Q1 Audit",
            starts_on=datetime.date(2026, 1, 1),
            ends_on=datetime.date(2026, 1, 31),
            scope_department=self.dept_a,
            scope_location=None,
            auditor_ids=[self.auditor.id],
            created_by=self.manager,
        )
        item_assets = set(AuditItem.objects.filter(cycle=cycle).values_list("asset_id", flat=True))
        self.assertEqual(item_assets, {self.asset_a1.id, self.asset_a2.id})
        self.assertEqual(list(cycle.auditors.all()), [self.auditor])

    def test_no_scope_includes_all_assets(self):
        self.make_fixture()
        cycle = services.create_cycle(
            name="Org-wide Audit",
            starts_on=datetime.date(2026, 1, 1),
            ends_on=datetime.date(2026, 1, 31),
            scope_department=None,
            scope_location=None,
            auditor_ids=[],
            created_by=self.manager,
        )
        self.assertEqual(AuditItem.objects.filter(cycle=cycle).count(), 3)

    def test_items_start_pending(self):
        self.make_fixture()
        cycle = services.create_cycle(
            name="Q1 Audit",
            starts_on=datetime.date(2026, 1, 1),
            ends_on=datetime.date(2026, 1, 31),
            scope_department=self.dept_a,
            scope_location=None,
            auditor_ids=[],
            created_by=self.manager,
        )
        self.assertTrue(all(i.verdict == AuditVerdict.PENDING for i in cycle.items.all()))

    def test_scope_location_only_snapshots_assets_in_that_location(self):
        self.make_fixture()
        location = Location.objects.create(name="Warehouse 1")
        in_location_asset = Asset.objects.create(
            name="Monitor",
            category=self.category,
            department=self.dept_a,
            location=location,
        )
        cycle = services.create_cycle(
            name="Location Audit",
            starts_on=datetime.date(2026, 1, 1),
            ends_on=datetime.date(2026, 1, 31),
            scope_department=None,
            scope_location=location,
            auditor_ids=[],
            created_by=self.manager,
        )
        item_assets = set(AuditItem.objects.filter(cycle=cycle).values_list("asset_id", flat=True))
        self.assertEqual(item_assets, {in_location_asset.id})


class SetVerdictTests(AuditsFixtureMixin, TestCase):
    def setUp(self):
        self.make_fixture()
        self.cycle = services.create_cycle(
            name="Q1 Audit",
            starts_on=datetime.date(2026, 1, 1),
            ends_on=datetime.date(2026, 1, 31),
            scope_department=self.dept_a,
            scope_location=None,
            auditor_ids=[self.auditor.id],
            created_by=self.manager,
        )
        self.item = self.cycle.items.get(asset=self.asset_a1)

    def test_verified_creates_no_discrepancy(self):
        services.set_verdict(
            item=self.item, verdict=AuditVerdict.VERIFIED, performed_by=self.auditor
        )
        self.assertFalse(Discrepancy.objects.filter(audit_item=self.item).exists())

    def test_missing_creates_discrepancy(self):
        services.set_verdict(
            item=self.item,
            verdict=AuditVerdict.MISSING,
            performed_by=self.auditor,
            notes="not on shelf",
        )
        discrepancy = Discrepancy.objects.get(audit_item=self.item)
        self.assertEqual(discrepancy.kind, "missing")
        self.assertEqual(discrepancy.detail, "not on shelf")
        self.assertFalse(discrepancy.resolved)

    def test_changing_verdict_back_to_verified_clears_discrepancy(self):
        services.set_verdict(
            item=self.item, verdict=AuditVerdict.DAMAGED, performed_by=self.auditor
        )
        self.assertTrue(Discrepancy.objects.filter(audit_item=self.item).exists())
        services.set_verdict(
            item=self.item, verdict=AuditVerdict.VERIFIED, performed_by=self.auditor
        )
        self.assertFalse(Discrepancy.objects.filter(audit_item=self.item).exists())

    def test_records_who_and_when(self):
        services.set_verdict(
            item=self.item, verdict=AuditVerdict.VERIFIED, performed_by=self.auditor
        )
        self.item.refresh_from_db()
        self.assertEqual(self.item.verified_by, self.auditor)
        self.assertIsNotNone(self.item.verified_at)

    def test_direct_transition_between_flagged_kinds_reuses_discrepancy_row(self):
        services.set_verdict(
            item=self.item,
            verdict=AuditVerdict.MISSING,
            performed_by=self.auditor,
            notes="not on shelf",
        )
        services.set_verdict(
            item=self.item,
            verdict=AuditVerdict.DAMAGED,
            performed_by=self.auditor,
            notes="found broken",
        )
        self.assertEqual(Discrepancy.objects.filter(audit_item=self.item).count(), 1)
        discrepancy = Discrepancy.objects.get(audit_item=self.item)
        self.assertEqual(discrepancy.kind, "damaged")

    def test_resubmitting_same_verdict_kind_preserves_resolution(self):
        services.set_verdict(
            item=self.item,
            verdict=AuditVerdict.MISSING,
            performed_by=self.auditor,
            notes="not on shelf",
        )
        discrepancy = Discrepancy.objects.get(audit_item=self.item)
        services.resolve_discrepancy(discrepancy=discrepancy, performed_by=self.manager)

        services.set_verdict(
            item=self.item,
            verdict=AuditVerdict.MISSING,
            performed_by=self.auditor,
            notes="still missing, updated note",
        )
        discrepancy.refresh_from_db()
        self.assertTrue(discrepancy.resolved)
        self.assertEqual(discrepancy.detail, "still missing, updated note")


class ResolveDiscrepancyTests(AuditsFixtureMixin, TestCase):
    def test_marks_resolved(self):
        self.make_fixture()
        cycle = services.create_cycle(
            name="Q1 Audit",
            starts_on=datetime.date(2026, 1, 1),
            ends_on=datetime.date(2026, 1, 31),
            scope_department=self.dept_a,
            scope_location=None,
            auditor_ids=[],
            created_by=self.manager,
        )
        item = cycle.items.get(asset=self.asset_a1)
        services.set_verdict(item=item, verdict=AuditVerdict.DAMAGED, performed_by=self.manager)
        discrepancy = Discrepancy.objects.get(audit_item=item)
        services.resolve_discrepancy(discrepancy=discrepancy, performed_by=self.manager)
        discrepancy.refresh_from_db()
        self.assertTrue(discrepancy.resolved)
        self.assertEqual(discrepancy.resolved_by, self.manager)


class CloseCycleTests(AuditsFixtureMixin, TestCase):
    def setUp(self):
        self.make_fixture()
        self.cycle = services.create_cycle(
            name="Q1 Audit",
            starts_on=datetime.date(2026, 1, 1),
            ends_on=datetime.date(2026, 1, 31),
            scope_department=self.dept_a,
            scope_location=None,
            auditor_ids=[],
            created_by=self.manager,
        )

    def test_missing_item_sets_asset_lost(self):
        item = self.cycle.items.get(asset=self.asset_a1)
        services.set_verdict(item=item, verdict=AuditVerdict.MISSING, performed_by=self.manager)
        services.close_cycle(cycle=self.cycle, performed_by=self.manager)
        self.asset_a1.refresh_from_db()
        self.assertEqual(self.asset_a1.status, AssetStatus.LOST)

    def test_damaged_item_sets_asset_condition(self):
        item = self.cycle.items.get(asset=self.asset_a2)
        services.set_verdict(item=item, verdict=AuditVerdict.DAMAGED, performed_by=self.manager)
        services.close_cycle(cycle=self.cycle, performed_by=self.manager)
        self.asset_a2.refresh_from_db()
        self.assertEqual(self.asset_a2.condition, AssetCondition.DAMAGED)

    def test_pending_item_left_untouched(self):
        # asset_a1 and asset_a2 are both left pending (no verdict set).
        original_status = self.asset_a1.status
        services.close_cycle(cycle=self.cycle, performed_by=self.manager)
        self.asset_a1.refresh_from_db()
        self.assertEqual(self.asset_a1.status, original_status)

    def test_locks_cycle(self):
        services.close_cycle(cycle=self.cycle, performed_by=self.manager)
        self.cycle.refresh_from_db()
        self.assertEqual(self.cycle.status, AuditCycleStatus.CLOSED)
        self.assertEqual(self.cycle.closed_by, self.manager)
        self.assertIsNotNone(self.cycle.closed_at)

    def test_double_close_rejected(self):
        services.close_cycle(cycle=self.cycle, performed_by=self.manager)
        with self.assertRaises(ValueError):
            services.close_cycle(cycle=self.cycle, performed_by=self.manager)
