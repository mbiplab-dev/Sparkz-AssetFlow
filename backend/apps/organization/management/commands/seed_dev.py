"""Seed development / demo data using Faker.

Idempotent — safe to run multiple times. Skips objects that already exist by
their unique keys (department name, category name, user email, asset tag).

Usage:
    python manage.py seed_dev            # default sizes
    python manage.py seed_dev --reset    # wipe demo data first (keeps admin)
"""

from __future__ import annotations

import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from faker import Faker

from apps.assets.models import Asset, AssetCondition, AssetStatus, Location
from apps.authentication.models import User, UserRole, UserStatus
from apps.booking.models import Booking, BookingStatus
from apps.maintenance.models import MaintenancePriority, MaintenanceRequest, MaintenanceStatus
from apps.organization.models import AssetCategory, Department
from apps.resource_allocation.models import Asset as ResourceAsset
from apps.resource_allocation.services import allocate as ra_allocate
from apps.resource_allocation.services import register_asset as ra_register
from django.utils import timezone


DEPARTMENTS = [
    ("Engineering", "ENG"),
    ("Facilities", "FAC"),
    ("Field Ops (East)", "FLDE"),
    ("Human Resources", "HR"),
    ("Finance", "FIN"),
    ("Marketing", "MKT"),
    ("IT Support", "IT"),
]

CATEGORIES = [
    ("Electronics", {"warranty_months": "int", "voltage": "string"}),
    ("Furniture", {"material": "string"}),
    ("Vehicles", {"license_plate": "string", "fuel_type": "string"}),
    ("IT Equipment", {"warranty_months": "int"}),
    ("Office Supplies", {}),
    ("Meeting Rooms", {"capacity": "int"}),
]

LOCATIONS = [
    ("HQ - Floor 1", "12 Kandivali West, Mumbai"),
    ("HQ - Floor 2", "12 Kandivali West, Mumbai"),
    ("Warehouse A", "Bhiwandi Industrial Area"),
    ("Field Office East", "Sector 62, Noida"),
    ("Server Room", "HQ Basement"),
]

CATEGORY_ASSET_NAMES = {
    "Electronics": ["Projector", "Monitor 27\"", "Wireless Keyboard", "Webcam Pro", "Docking Station"],
    "Furniture": ["Ergonomic Chair", "Standing Desk", "Filing Cabinet", "Bookshelf", "Whiteboard"],
    "Vehicles": ["Tata Ace", "Bolero", "Innova Crysta", "E-Rickshaw", "Mahindra XUV"],
    "IT Equipment": ["MacBook Pro 14\"", "ThinkPad X1", "iPhone 15", "iPad Air", "USB-C Hub"],
    "Office Supplies": ["Coffee Machine", "Water Dispenser", "Paper Shredder", "Printer HP"],
    "Meeting Rooms": ["Boardroom", "Focus Room 1", "Focus Room 2", "Training Hall"],
}


class Command(BaseCommand):
    help = "Seed demo data (departments, categories, employees, locations, assets)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Wipe existing demo data before seeding (preserves admin).",
        )
        parser.add_argument(
            "--employees",
            type=int,
            default=20,
            help="How many employees to create (default: 20).",
        )
        parser.add_argument(
            "--assets",
            type=int,
            default=40,
            help="How many assets to create (default: 40).",
        )
        parser.add_argument("--seed", type=int, default=42, help="Random seed.")

    @transaction.atomic
    def handle(self, *args, **opts):
        fake = Faker("en_IN")
        Faker.seed(opts["seed"])
        random.seed(opts["seed"])

        if opts["reset"]:
            self._wipe()

        depts = self._seed_departments()
        cats = self._seed_categories()
        locs = self._seed_locations()
        managers, heads, employees = self._seed_users(fake, depts, opts["employees"])
        self._seed_assets(fake, cats, depts, locs, opts["assets"])
        self._seed_resource_assets(cats, managers[0] if managers else None)
        self._seed_holdings(managers[0] if managers else None, depts, employees)
        self._seed_maintenance(fake, managers[0] if managers else None, employees)
        self._seed_bookings(fake, employees)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded: {len(depts)} depts, {len(cats)} categories, "
                f"{len(locs)} locations, {len(managers) + len(heads) + len(employees)} users, "
                f"{Asset.objects.count()} assets."
            )
        )

    # ---- helpers -------------------------------------------------------------

    def _wipe(self):
        self.stdout.write("Wiping demo data (keeping admin)...")
        Booking.objects.all().delete()
        MaintenanceRequest.objects.all().delete()
        # Cascade order for resource_allocation — Transfer + Holding then Asset
        from apps.resource_allocation.models import (
            AllocationRequest,
            Holding,
            Transfer,
        )
        Transfer.objects.all().delete()
        AllocationRequest.objects.all().delete()
        Holding.objects.all().delete()
        ResourceAsset.objects.all().delete()
        Asset.objects.all().delete()
        Location.objects.all().delete()
        User.objects.exclude(role=UserRole.ADMIN).delete()
        Department.objects.all().delete()
        AssetCategory.objects.all().delete()

    def _seed_departments(self) -> list[Department]:
        out = []
        for name, code in DEPARTMENTS:
            dept, _ = Department.objects.get_or_create(
                name=name,
                defaults={"code": code, "status": "active"},
            )
            out.append(dept)
        return out

    def _seed_categories(self) -> list[AssetCategory]:
        out = []
        for name, schema in CATEGORIES:
            cat, _ = AssetCategory.objects.get_or_create(
                name=name,
                defaults={"custom_fields_schema": schema, "status": "active"},
            )
            out.append(cat)
        return out

    def _seed_locations(self) -> list[Location]:
        out = []
        for name, addr in LOCATIONS:
            loc, _ = Location.objects.get_or_create(
                name=name,
                defaults={"address": addr},
            )
            out.append(loc)
        return out

    def _seed_users(
        self, fake: Faker, depts: list[Department], n_employees: int
    ) -> tuple[list[User], list[User], list[User]]:
        # One asset_manager per Engineering + Facilities
        managers = []
        for dept_name in ("Engineering", "Facilities"):
            dept = next(d for d in depts if d.name == dept_name)
            u, created = User.objects.get_or_create(
                email=f"manager.{dept.code.lower()}@assetflow.local",
                defaults={
                    "full_name": fake.name(),
                    "role": UserRole.ASSET_MANAGER,
                    "status": UserStatus.ACTIVE,
                    "department": dept,
                    "is_active": True,
                },
            )
            # Always re-apply known demo password so login quick-buttons work.
            u.set_password("Demo@12345")
            u.role = UserRole.ASSET_MANAGER
            u.status = UserStatus.ACTIVE
            u.is_active = True
            u.department = dept
            u.save()
            managers.append(u)

        # One department_head per department (skip Engineering & Facilities to
        # avoid stepping on the manager role for those two)
        heads = []
        for dept in depts:
            if dept.name in ("Engineering", "Facilities"):
                continue
            u, created = User.objects.get_or_create(
                email=f"head.{dept.code.lower()}@assetflow.local",
                defaults={
                    "full_name": fake.name(),
                    "role": UserRole.DEPARTMENT_HEAD,
                    "status": UserStatus.ACTIVE,
                    "department": dept,
                    "is_active": True,
                },
            )
            u.set_password("Demo@12345")
            u.role = UserRole.DEPARTMENT_HEAD
            u.status = UserStatus.ACTIVE
            u.is_active = True
            u.department = dept
            u.save()
            if created or dept.head_id != u.id:
                dept.head = u
                dept.save(update_fields=["head", "updated_at"])
            heads.append(u)

        # Regular employees
        employees = []
        for i in range(n_employees):
            email = f"employee{i + 1}@assetflow.local"
            u, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "full_name": fake.name(),
                    "role": UserRole.EMPLOYEE,
                    "status": UserStatus.ACTIVE,
                    "department": random.choice(depts),
                    "is_active": True,
                    "phone": fake.msisdn()[:12],
                },
            )
            u.set_password("Demo@12345")
            u.role = UserRole.EMPLOYEE
            u.status = UserStatus.ACTIVE
            u.is_active = True
            u.save()
            employees.append(u)

        return managers, heads, employees

    def _seed_assets(
        self,
        fake: Faker,
        cats: list[AssetCategory],
        depts: list[Department],
        locs: list[Location],
        n: int,
    ):
        statuses = [
            AssetStatus.AVAILABLE,
            AssetStatus.AVAILABLE,
            AssetStatus.AVAILABLE,
            AssetStatus.ALLOCATED,
            AssetStatus.ALLOCATED,
            AssetStatus.UNDER_MAINTENANCE,
            AssetStatus.RESERVED,
        ]
        conditions = [AssetCondition.NEW, AssetCondition.GOOD, AssetCondition.GOOD, AssetCondition.FAIR]

        existing = Asset.objects.count()
        if existing >= n:
            return  # already seeded to (or past) the target

        start_tag = existing + 1
        for i in range(n - existing):
            cat = random.choice(cats)
            names = CATEGORY_ASSET_NAMES.get(cat.name, [f"{cat.name} Item"])
            asset_tag = f"AF-{start_tag + i:04d}"
            if Asset.objects.filter(asset_tag=asset_tag).exists():
                continue
            Asset.objects.create(
                asset_tag=asset_tag,
                name=random.choice(names),
                category=cat,
                serial_number=fake.bothify(text="SN-####-????").upper(),
                acquisition_date=date.today() - timedelta(days=random.randint(30, 900)),
                acquisition_cost=Decimal(random.randint(5000, 150000)),
                condition=random.choice(conditions),
                status=random.choice(statuses),
                location=random.choice(locs),
                department=random.choice(depts),
                is_bookable=cat.name == "Meeting Rooms",
                notes=fake.sentence(nb_words=8) if random.random() < 0.3 else "",
            )

    def _seed_resource_assets(self, cats: list[AssetCategory], created_by: User | None):
        """Seed the resource_allocation quantity-tracked catalog for the Allocate dialog."""
        if ResourceAsset.objects.exists():
            return
        if created_by is None:
            created_by = User.objects.filter(role=UserRole.ADMIN).first()
        if created_by is None:
            return
        by_name = {c.name: c for c in cats}
        items = [
            ("MacBook Pro 14\"", "IT Equipment", 25),
            ("ThinkPad X1", "IT Equipment", 30),
            ("Dell Monitor 27\"", "Electronics", 40),
            ("USB-C Hub", "Electronics", 60),
            ("Ergonomic Chair", "Furniture", 50),
            ("Standing Desk", "Furniture", 20),
            ("Company Van — Innova", "Vehicles", 5),
            ("Projector Unit", "Electronics", 8),
        ]
        for name, cat_name, qty in items:
            cat = by_name.get(cat_name) or cats[0]
            # Use the service so the initial manager-pool Holding is created too;
            # otherwise `allocate` has nothing to pull from.
            ra_register(
                name=name,
                category=cat,
                total_quantity=qty,
                condition="",
                location="",
                is_bookable=False,
                created_by=created_by,
            )

    def _seed_holdings(
        self, manager: User | None, depts: list[Department], employees: list[User]
    ):
        """Allocate a few resource-catalog items to employees + departments."""
        from apps.resource_allocation.models import Holding

        if Holding.objects.filter(quantity__gt=0).exclude(holder_type="manager").exists():
            return
        if manager is None or not employees or not depts:
            return

        r_assets = list(ResourceAsset.objects.all())
        if not r_assets:
            return

        # Allocate 3–5 quantity from each catalog item to random employees/departments
        for r in r_assets[:6]:
            # 1 employee holding
            emp = random.choice(employees)
            try:
                ra_allocate(
                    asset=r,
                    to_holder_type="employee",
                    to_holder_id=emp.id,
                    quantity=random.randint(1, min(3, r.total_quantity)),
                    performed_by=manager,
                )
            except Exception:
                pass
            # 1 department holding
            dept = random.choice(depts)
            try:
                ra_allocate(
                    asset=r,
                    to_holder_type="department",
                    to_holder_id=dept.id,
                    quantity=random.randint(2, min(5, r.total_quantity)),
                    performed_by=manager,
                )
            except Exception:
                pass

    def _seed_maintenance(self, fake: Faker, manager: User | None, employees: list[User]):
        if MaintenanceRequest.objects.exists():
            return
        if not employees:
            return
        assets = list(Asset.objects.all()[:8])
        if not assets:
            return

        # 1 pending, 1 approved, 1 in_progress, 1 resolved
        specs = [
            (MaintenanceStatus.PENDING, MaintenancePriority.LOW, None, None, None),
            (MaintenanceStatus.APPROVED, MaintenancePriority.HIGH, manager, "TechCare Services", None),
            (
                MaintenanceStatus.IN_PROGRESS,
                MaintenancePriority.MEDIUM,
                manager,
                "AutoCare Workshop",
                None,
            ),
            (
                MaintenanceStatus.RESOLVED,
                MaintenancePriority.MEDIUM,
                manager,
                "Apple Authorized",
                "Display cable reseated. Working normally.",
            ),
        ]
        for asset, (status, priority, approver, tech_name, resolution) in zip(assets, specs):
            raiser = random.choice(employees)
            req = MaintenanceRequest(
                asset=asset,
                raised_by=raiser,
                issue_description=fake.sentence(nb_words=8),
                priority=priority,
                status=status,
                estimated_cost=Decimal(random.randint(150, 500)),
            )
            if approver:
                req.approved_by = approver
                req.approved_at = timezone.now()
            if tech_name:
                req.technician_name = tech_name if hasattr(req, "technician_name") else ""
            if status == MaintenanceStatus.IN_PROGRESS:
                req.started_at = timezone.now()
            if resolution:
                req.resolution_notes = resolution
                req.resolved_at = timezone.now()
                req.actual_cost = Decimal(random.randint(120, 400))
            req.save()

    def _seed_bookings(self, fake: Faker, employees: list[User]):
        if Booking.objects.exists():
            return
        if not employees:
            return
        bookable = list(Asset.objects.filter(is_bookable=True)[:3])
        if not bookable:
            return
        now = timezone.now().replace(minute=0, second=0, microsecond=0)
        for asset in bookable:
            for hour_offset in (2, 26, 50):  # today afternoon, tomorrow, next day
                start = now + timedelta(hours=hour_offset)
                end = start + timedelta(hours=1)
                try:
                    Booking.objects.create(
                        asset=asset,
                        booked_by=random.choice(employees),
                        starts_at=start,
                        ends_at=end,
                        purpose=fake.sentence(nb_words=4),
                        status=BookingStatus.UPCOMING,
                    )
                except Exception:
                    pass  # respects the no-overlap constraint if any conflict
