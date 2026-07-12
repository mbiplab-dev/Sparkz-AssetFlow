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
from apps.organization.models import AssetCategory, Department


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
            if created:
                u.set_password("Demo@12345")
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
            if created:
                u.set_password("Demo@12345")
                u.save()
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
            if created:
                u.set_password("Demo@12345")
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
