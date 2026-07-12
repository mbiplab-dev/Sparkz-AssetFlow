from rest_framework import status
from rest_framework.test import APITestCase

from apps.assets.models import Asset, AssetStatus
from apps.audits import services
from apps.audits.models import AuditVerdict
from apps.authentication.models import User, UserRole
from apps.organization.models import AssetCategory, Department


class AuditApiTests(APITestCase):
    def setUp(self):
        self.category = AssetCategory.objects.create(name="Electronics")
        self.dept = Department.objects.create(name="Sales")
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="pw",
            full_name="Admin",
            role=UserRole.ADMIN,
        )
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
        self.employee = User.objects.create_user(
            email="emp@example.com",
            password="pw",
            full_name="Employee",
        )
        self.asset = Asset.objects.create(
            name="Laptop", category=self.category, department=self.dept
        )

    def test_asset_manager_can_create_cycle_and_it_snapshots_assets(self):
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            "/api/audits/cycles/",
            {
                "name": "Q1 Audit",
                "scope_department": self.dept.id,
                "starts_on": "2026-01-01",
                "ends_on": "2026-01-31",
                "auditor_ids": [self.auditor.id],
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        cycle_id = response.data["id"]

        items_response = self.client.get(f"/api/audits/items/?cycle={cycle_id}")
        self.assertEqual(len(items_response.data), 1)
        self.assertEqual(items_response.data[0]["asset"], self.asset.id)
        self.assertEqual(items_response.data[0]["verdict"], "pending")

    def test_employee_cannot_create_cycle(self):
        self.client.force_authenticate(self.employee)
        response = self.client.post(
            "/api/audits/cycles/",
            {
                "name": "Q1 Audit",
                "starts_on": "2026-01-01",
                "ends_on": "2026-01-31",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_assigned_auditor_can_set_verdict(self):
        cycle = services.create_cycle(
            name="Q1 Audit",
            starts_on="2026-01-01",
            ends_on="2026-01-31",
            scope_department=self.dept,
            scope_location=None,
            auditor_ids=[self.auditor.id],
            created_by=self.manager,
        )
        item = cycle.items.get(asset=self.asset)

        self.client.force_authenticate(self.auditor)
        response = self.client.patch(
            f"/api/audits/items/{item.id}/verdict/",
            {
                "verdict": "missing",
                "notes": "not found on shelf",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["verdict"], "missing")

        discrepancies = self.client.get(f"/api/audits/discrepancies/?cycle={cycle.id}")
        self.assertEqual(len(discrepancies.data), 1)
        self.assertEqual(discrepancies.data[0]["kind"], "missing")

    def test_unassigned_employee_cannot_set_verdict(self):
        cycle = services.create_cycle(
            name="Q1 Audit",
            starts_on="2026-01-01",
            ends_on="2026-01-31",
            scope_department=self.dept,
            scope_location=None,
            auditor_ids=[self.auditor.id],
            created_by=self.manager,
        )
        item = cycle.items.get(asset=self.asset)

        self.client.force_authenticate(self.employee)
        response = self.client.patch(
            f"/api/audits/items/{item.id}/verdict/", {"verdict": "verified"}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_verdict_rejected_after_cycle_closed(self):
        cycle = services.create_cycle(
            name="Q1 Audit",
            starts_on="2026-01-01",
            ends_on="2026-01-31",
            scope_department=self.dept,
            scope_location=None,
            auditor_ids=[self.auditor.id],
            created_by=self.manager,
        )
        item = cycle.items.get(asset=self.asset)
        services.close_cycle(cycle=cycle, performed_by=self.manager)

        self.client.force_authenticate(self.auditor)
        response = self.client.patch(
            f"/api/audits/items/{item.id}/verdict/", {"verdict": "verified"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_close_cycle_applies_asset_status_and_admin_can_do_it(self):
        cycle = services.create_cycle(
            name="Q1 Audit",
            starts_on="2026-01-01",
            ends_on="2026-01-31",
            scope_department=self.dept,
            scope_location=None,
            auditor_ids=[self.auditor.id],
            created_by=self.manager,
        )
        item = cycle.items.get(asset=self.asset)
        services.set_verdict(item=item, verdict=AuditVerdict.MISSING, performed_by=self.auditor)

        self.client.force_authenticate(self.admin)
        response = self.client.post(f"/api/audits/cycles/{cycle.id}/close/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["status"], "closed")

        self.asset.refresh_from_db()
        self.assertEqual(self.asset.status, AssetStatus.LOST)

    def test_admin_can_resolve_discrepancy(self):
        cycle = services.create_cycle(
            name="Q1 Audit",
            starts_on="2026-01-01",
            ends_on="2026-01-31",
            scope_department=self.dept,
            scope_location=None,
            auditor_ids=[],
            created_by=self.manager,
        )
        item = cycle.items.get(asset=self.asset)
        services.set_verdict(item=item, verdict=AuditVerdict.DAMAGED, performed_by=self.manager)
        discrepancy_id = item.discrepancy.id

        self.client.force_authenticate(self.admin)
        response = self.client.post(f"/api/audits/discrepancies/{discrepancy_id}/resolve/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data["resolved"])

    def test_employee_cannot_resolve_discrepancy(self):
        cycle = services.create_cycle(
            name="Q1 Audit",
            starts_on="2026-01-01",
            ends_on="2026-01-31",
            scope_department=self.dept,
            scope_location=None,
            auditor_ids=[],
            created_by=self.manager,
        )
        item = cycle.items.get(asset=self.asset)
        services.set_verdict(item=item, verdict=AuditVerdict.DAMAGED, performed_by=self.manager)
        discrepancy_id = item.discrepancy.id

        self.client.force_authenticate(self.employee)
        response = self.client.post(f"/api/audits/discrepancies/{discrepancy_id}/resolve/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
