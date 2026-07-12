# Resource Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `apps.resource_allocation` Django app — a quantity-based asset catalog with allocation, request/fulfillment (including cross-department peer fulfillment), and return workflows — per `docs/superpowers/specs/2026-07-12-resource-allocation-design.md`.

**Architecture:** A ledger-based inventory model. `Holding` rows track current quantity per `(asset, holder)` where holder is the Asset Manager pool, a Department, or an Employee. Every quantity movement goes through one atomic service function (`move_quantity`) that locks both sides with `select_for_update()`, so `sum(Holding.quantity) == Asset.total_quantity` can never drift, even under concurrent requests. `Transfer` is the immutable audit ledger; `AllocationRequest` tracks demand and accumulates fulfillment (possibly from multiple departments) until satisfied.

**Tech Stack:** Django 5.2, DRF, drf-spectacular, PostgreSQL (via `make db`), `uv run python manage.py test`.

## Global Constraints

- Everything is quantity-based — no per-unit serial/asset-tag tracking (confirmed deviation from base spec).
- `sum(Holding.quantity) for an asset == Asset.total_quantity`, always — must hold under concurrency.
- No approval gate between `asset_manager` and `department_head` — both act directly within their own authority.
- Peer department-to-department fulfillment requires an explicit action by the fulfilling Department Head — never automatic matching.
- Follow existing repo conventions: one app = `apps.resource_allocation`; `ModelViewSet` + `DefaultRouter` + `@action` (see `apps/organization/views.py`); role permission classes in `permissions.py` (see `apps/organization/permissions.py`); `drf-spectacular` `@extend_schema`/`@extend_schema_view` tags; `ruff` clean (`line-length = 100`, `select = ["E","F","I","W","UP","B","DJ"]`).
- Tests use Django's built-in test runner (no pytest in this repo): `cd backend && uv run python manage.py test apps.resource_allocation`. Requires Postgres running (`make db` from repo root) since the project has no SQLite fallback configured.
- Run `cd backend && uv run ruff check . && uv run ruff format .` before each commit that touches backend code. If `ruff check .` reports import-order (`I001`) or unused-import errors, run `uv run ruff check . --fix` (these are auto-fixable) and re-run `ruff check .` to confirm clean before moving on — don't hand-sort imports to match ruff/isort's exact ordering rules.

---

## Task 1: Models — Asset, Holding, AllocationRequest, Transfer

**Files:**
- Create: `backend/apps/resource_allocation/__init__.py`
- Create: `backend/apps/resource_allocation/apps.py`
- Create: `backend/apps/resource_allocation/models.py`
- Create: `backend/apps/resource_allocation/admin.py`
- Create: `backend/apps/resource_allocation/migrations/__init__.py`
- Create: `backend/apps/resource_allocation/tests/__init__.py`
- Create: `backend/apps/resource_allocation/tests/test_models.py`
- Modify: `backend/config/settings.py` — add `"apps.resource_allocation"` to `INSTALLED_APPS`

**Interfaces:**
- Produces: `HolderType` (TextChoices: `MANAGER`, `DEPARTMENT`, `EMPLOYEE`), `MANAGER_HOLDER_ID = 0`, `RequestStatus` (TextChoices: `OPEN`, `PARTIALLY_FULFILLED`, `FULFILLED`, `REJECTED`, `CANCELLED`), `TransferKind` (TextChoices: `ALLOCATE`, `SUB_ALLOCATE`, `FULFILL_REQUEST`, `PEER_TRANSFER`, `RETURN`), `Asset`, `Holding`, `AllocationRequest` (with `.remaining` property), `Transfer` — all used by every later task.

- [ ] **Step 1: Add the app to `INSTALLED_APPS`**

In `backend/config/settings.py`, find the `INSTALLED_APPS` list and add the new app after `"apps.organization"`:

```python
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "apps.authentication",
    "apps.organization",
    "apps.resource_allocation",
]
```

- [ ] **Step 2: Scaffold the app package**

Create `backend/apps/resource_allocation/__init__.py` (empty file).

Create `backend/apps/resource_allocation/apps.py`:

```python
from django.apps import AppConfig


class ResourceAllocationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.resource_allocation"
```

Create `backend/apps/resource_allocation/migrations/__init__.py` (empty file).

Create `backend/apps/resource_allocation/tests/__init__.py` (empty file).

- [ ] **Step 3: Write the failing model tests**

Create `backend/apps/resource_allocation/tests/test_models.py`:

```python
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.authentication.models import User, UserRole
from apps.organization.models import AssetCategory, Department
from apps.resource_allocation.models import (
    Asset,
    HolderType,
    Holding,
    MANAGER_HOLDER_ID,
    RequestStatus,
    Transfer,
    TransferKind,
    AllocationRequest,
)


class AssetModelTests(TestCase):
    def setUp(self):
        self.category = AssetCategory.objects.create(name="Vehicles")
        self.manager = User.objects.create_user(
            email="mgr@example.com", password="pw", full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )

    def test_str_returns_name(self):
        asset = Asset.objects.create(
            name="Cars", category=self.category, total_quantity=10,
            created_by=self.manager,
        )
        self.assertEqual(str(asset), "Cars")


class HoldingModelTests(TestCase):
    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        manager = User.objects.create_user(
            email="mgr2@example.com", password="pw", full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.asset = Asset.objects.create(
            name="Cars", category=category, total_quantity=10, created_by=manager,
        )

    def test_negative_quantity_rejected_at_db_level(self):
        holding = Holding(
            asset=self.asset, holder_type=HolderType.DEPARTMENT, holder_id=1, quantity=-1,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                holding.save()

    def test_manager_holding_must_use_sentinel_id(self):
        holding = Holding(
            asset=self.asset, holder_type=HolderType.MANAGER, holder_id=5, quantity=1,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                holding.save()

    def test_non_manager_holder_id_zero_rejected(self):
        holding = Holding(
            asset=self.asset, holder_type=HolderType.DEPARTMENT, holder_id=0, quantity=1,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                holding.save()

    def test_manager_sentinel_id_is_zero(self):
        self.assertEqual(MANAGER_HOLDER_ID, 0)

    def test_uniqueness_per_asset_holder(self):
        Holding.objects.create(
            asset=self.asset, holder_type=HolderType.DEPARTMENT, holder_id=1, quantity=2,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Holding.objects.create(
                    asset=self.asset, holder_type=HolderType.DEPARTMENT, holder_id=1, quantity=3,
                )


class AllocationRequestModelTests(TestCase):
    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        self.employee = User.objects.create_user(
            email="emp@example.com", password="pw", full_name="Employee",
        )
        self.asset = Asset.objects.create(
            name="Cars", category=category, total_quantity=10, created_by=self.employee,
        )

    def test_remaining_property(self):
        req = AllocationRequest.objects.create(
            asset=self.asset, requested_by=self.employee,
            for_holder_type=HolderType.EMPLOYEE, for_holder_id=self.employee.id,
            quantity_requested=5, quantity_fulfilled=2,
        )
        self.assertEqual(req.remaining, 3)

    def test_fulfilled_cannot_exceed_requested(self):
        req = AllocationRequest(
            asset=self.asset, requested_by=self.employee,
            for_holder_type=HolderType.EMPLOYEE, for_holder_id=self.employee.id,
            quantity_requested=5, quantity_fulfilled=6,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                req.save()

    def test_default_status_is_open(self):
        req = AllocationRequest.objects.create(
            asset=self.asset, requested_by=self.employee,
            for_holder_type=HolderType.EMPLOYEE, for_holder_id=self.employee.id,
            quantity_requested=5,
        )
        self.assertEqual(req.status, RequestStatus.OPEN)


class TransferModelTests(TestCase):
    def test_str_format(self):
        category = AssetCategory.objects.create(name="Vehicles")
        manager = User.objects.create_user(
            email="mgr3@example.com", password="pw", full_name="Manager",
        )
        asset = Asset.objects.create(
            name="Cars", category=category, total_quantity=10, created_by=manager,
        )
        transfer = Transfer.objects.create(
            asset=asset,
            from_holder_type=HolderType.MANAGER, from_holder_id=MANAGER_HOLDER_ID,
            to_holder_type=HolderType.DEPARTMENT, to_holder_id=1,
            quantity=3, kind=TransferKind.ALLOCATE, performed_by=manager,
        )
        self.assertIn("manager->department", str(transfer))
```

- [ ] **Step 4: Run tests to verify they fail (module doesn't exist yet)**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_models -v 2`
Expected: FAIL / ERROR — `ModuleNotFoundError: No module named 'apps.resource_allocation.models'`

- [ ] **Step 5: Write the models**

Create `backend/apps/resource_allocation/models.py`:

```python
from django.conf import settings
from django.db import models

MANAGER_HOLDER_ID = 0


class HolderType(models.TextChoices):
    MANAGER = "manager", "Asset Manager (unallocated pool)"
    DEPARTMENT = "department", "Department"
    EMPLOYEE = "employee", "Employee"


class RequestStatus(models.TextChoices):
    OPEN = "open", "Open"
    PARTIALLY_FULFILLED = "partially_fulfilled", "Partially Fulfilled"
    FULFILLED = "fulfilled", "Fulfilled"
    REJECTED = "rejected", "Rejected"
    CANCELLED = "cancelled", "Cancelled"


class TransferKind(models.TextChoices):
    ALLOCATE = "allocate", "Allocate"
    SUB_ALLOCATE = "sub_allocate", "Sub-allocate"
    FULFILL_REQUEST = "fulfill_request", "Fulfill Request"
    PEER_TRANSFER = "peer_transfer", "Peer Transfer"
    RETURN = "return", "Return"


class Asset(models.Model):
    """Quantity-tracked asset catalog entry (e.g. 'Pens', 'Toyota Innova')."""

    name = models.CharField(max_length=150)
    category = models.ForeignKey(
        "organization.AssetCategory", on_delete=models.PROTECT, related_name="resource_assets"
    )
    total_quantity = models.PositiveIntegerField()
    condition = models.CharField(max_length=100, blank=True, default="")
    location = models.CharField(max_length=150, blank=True, default="")
    is_bookable = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Holding(models.Model):
    """Current quantity of an asset held by a given holder (manager/department/employee)."""

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="holdings")
    holder_type = models.CharField(max_length=16, choices=HolderType.choices)
    holder_id = models.PositiveIntegerField()
    quantity = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["asset", "holder_type", "holder_id"],
                name="uniq_holding_per_asset_holder",
            ),
            models.CheckConstraint(
                check=models.Q(quantity__gte=0), name="holding_quantity_gte_0"
            ),
            models.CheckConstraint(
                check=(
                    models.Q(holder_type=HolderType.MANAGER, holder_id=MANAGER_HOLDER_ID)
                    | (~models.Q(holder_type=HolderType.MANAGER) & models.Q(holder_id__gt=0))
                ),
                name="holding_holder_id_matches_type",
            ),
        ]

    def __str__(self):
        return f"{self.asset_id} {self.holder_type}:{self.holder_id} = {self.quantity}"


class AllocationRequest(models.Model):
    """A request for `quantity_requested` units of an asset, for a given holder."""

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="requests")
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    for_holder_type = models.CharField(max_length=16, choices=HolderType.choices)
    for_holder_id = models.PositiveIntegerField()
    quantity_requested = models.PositiveIntegerField()
    quantity_fulfilled = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=24, choices=RequestStatus.choices, default=RequestStatus.OPEN
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(quantity_fulfilled__lte=models.F("quantity_requested")),
                name="request_fulfilled_lte_requested",
            ),
        ]

    @property
    def remaining(self):
        return self.quantity_requested - self.quantity_fulfilled

    def __str__(self):
        return f"Request({self.asset_id}, {self.quantity_requested}, {self.status})"


class Transfer(models.Model):
    """Immutable ledger row: every quantity movement, ever."""

    asset = models.ForeignKey(Asset, on_delete=models.PROTECT, related_name="transfers")
    from_holder_type = models.CharField(max_length=16, choices=HolderType.choices)
    from_holder_id = models.PositiveIntegerField()
    to_holder_type = models.CharField(max_length=16, choices=HolderType.choices)
    to_holder_id = models.PositiveIntegerField()
    quantity = models.PositiveIntegerField()
    kind = models.CharField(max_length=24, choices=TransferKind.choices)
    request = models.ForeignKey(
        AllocationRequest, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="transfers",
    )
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(check=models.Q(quantity__gt=0), name="transfer_quantity_gt_0"),
        ]

    def __str__(self):
        return (
            f"Transfer({self.asset_id}, {self.from_holder_type}->{self.to_holder_type}, "
            f"{self.quantity})"
        )
```

Create `backend/apps/resource_allocation/admin.py`:

```python
from django.contrib import admin

from .models import Asset, AllocationRequest, Holding, Transfer


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "total_quantity", "is_bookable", "created_at")
    list_filter = ("category", "is_bookable")
    search_fields = ("name",)


@admin.register(Holding)
class HoldingAdmin(admin.ModelAdmin):
    list_display = ("asset", "holder_type", "holder_id", "quantity")
    list_filter = ("holder_type",)


@admin.register(AllocationRequest)
class AllocationRequestAdmin(admin.ModelAdmin):
    list_display = ("asset", "quantity_requested", "quantity_fulfilled", "status", "created_at")
    list_filter = ("status",)


@admin.register(Transfer)
class TransferAdmin(admin.ModelAdmin):
    list_display = (
        "asset", "from_holder_type", "to_holder_type", "quantity", "kind", "created_at",
    )
    list_filter = ("kind",)
```

- [ ] **Step 6: Generate and apply the migration**

Run: `cd backend && uv run python manage.py makemigrations resource_allocation`
Expected: `Migrations for 'resource_allocation': ... 0001_initial.py` created with the four models and constraints.

Run: `cd backend && uv run python manage.py migrate`
Expected: `Applying resource_allocation.0001_initial... OK`

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_models -v 2`
Expected: All tests PASS (`OK`)

- [ ] **Step 8: Lint and commit**

Run: `cd backend && uv run ruff check . && uv run ruff format .`

```bash
git add backend/apps/resource_allocation backend/config/settings.py
git commit -m "feat(resource_allocation): add Asset, Holding, AllocationRequest, Transfer models"
```

---

## Task 2: Core service primitives — `move_quantity`, `register_asset`, `adjust_stock`

**Files:**
- Create: `backend/apps/resource_allocation/services.py`
- Create: `backend/apps/resource_allocation/tests/test_services.py`

**Interfaces:**
- Consumes: `Asset`, `Holding`, `HolderType`, `MANAGER_HOLDER_ID`, `TransferKind`, `Transfer` (Task 1)
- Produces: `InsufficientQuantityError`, `InvalidHolderError` (exceptions), `move_quantity(*, asset, from_holder_type, from_holder_id, to_holder_type, to_holder_id, quantity, performed_by, kind, request=None, notes="") -> Transfer`, `register_asset(*, name, category, total_quantity, condition, location, is_bookable, created_by) -> Asset`, `adjust_stock(*, asset, delta, performed_by) -> Asset` — all consumed by Task 3+.

- [ ] **Step 1: Write the failing service tests**

Create `backend/apps/resource_allocation/tests/test_services.py`:

```python
import threading

from django.db import connection
from django.test import TestCase, TransactionTestCase

from apps.authentication.models import User, UserRole
from apps.organization.models import AssetCategory
from apps.resource_allocation import services
from apps.resource_allocation.models import (
    Asset, HolderType, Holding, MANAGER_HOLDER_ID, Transfer, TransferKind,
)


class RegisterAssetTests(TestCase):
    def setUp(self):
        self.category = AssetCategory.objects.create(name="Stationery")
        self.manager = User.objects.create_user(
            email="mgr@example.com", password="pw", full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )

    def test_creates_asset_with_full_manager_holding(self):
        asset = services.register_asset(
            name="Pens", category=self.category, total_quantity=500,
            condition="new", location="HQ", is_bookable=False, created_by=self.manager,
        )
        holding = Holding.objects.get(
            asset=asset, holder_type=HolderType.MANAGER, holder_id=MANAGER_HOLDER_ID,
        )
        self.assertEqual(holding.quantity, 500)
        self.assertEqual(asset.total_quantity, 500)


class MoveQuantityTests(TestCase):
    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        self.manager_user = User.objects.create_user(
            email="mgr2@example.com", password="pw", full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.asset = services.register_asset(
            name="Cars", category=category, total_quantity=10,
            condition="good", location="Lot A", is_bookable=False,
            created_by=self.manager_user,
        )

    def test_moves_quantity_between_holdings_and_logs_transfer(self):
        transfer = services.move_quantity(
            asset=self.asset,
            from_holder_type=HolderType.MANAGER, from_holder_id=MANAGER_HOLDER_ID,
            to_holder_type=HolderType.DEPARTMENT, to_holder_id=1,
            quantity=3, performed_by=self.manager_user, kind=TransferKind.ALLOCATE,
        )
        manager_holding = Holding.objects.get(
            asset=self.asset, holder_type=HolderType.MANAGER, holder_id=MANAGER_HOLDER_ID,
        )
        dept_holding = Holding.objects.get(
            asset=self.asset, holder_type=HolderType.DEPARTMENT, holder_id=1,
        )
        self.assertEqual(manager_holding.quantity, 7)
        self.assertEqual(dept_holding.quantity, 3)
        self.assertEqual(transfer.quantity, 3)
        self.assertEqual(Transfer.objects.count(), 1)

    def test_insufficient_quantity_raises_and_leaves_holdings_untouched(self):
        with self.assertRaises(services.InsufficientQuantityError):
            services.move_quantity(
                asset=self.asset,
                from_holder_type=HolderType.MANAGER, from_holder_id=MANAGER_HOLDER_ID,
                to_holder_type=HolderType.DEPARTMENT, to_holder_id=1,
                quantity=999, performed_by=self.manager_user, kind=TransferKind.ALLOCATE,
            )
        manager_holding = Holding.objects.get(
            asset=self.asset, holder_type=HolderType.MANAGER, holder_id=MANAGER_HOLDER_ID,
        )
        self.assertEqual(manager_holding.quantity, 10)
        self.assertEqual(Transfer.objects.count(), 0)

    def test_zero_or_negative_quantity_rejected(self):
        with self.assertRaises(ValueError):
            services.move_quantity(
                asset=self.asset,
                from_holder_type=HolderType.MANAGER, from_holder_id=MANAGER_HOLDER_ID,
                to_holder_type=HolderType.DEPARTMENT, to_holder_id=1,
                quantity=0, performed_by=self.manager_user, kind=TransferKind.ALLOCATE,
            )


class AdjustStockTests(TestCase):
    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        self.manager_user = User.objects.create_user(
            email="mgr3@example.com", password="pw", full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.asset = services.register_asset(
            name="Cars", category=category, total_quantity=10,
            condition="good", location="Lot A", is_bookable=False,
            created_by=self.manager_user,
        )

    def test_increase_adds_to_manager_pool_and_total(self):
        services.adjust_stock(asset=self.asset, delta=5, performed_by=self.manager_user)
        self.asset.refresh_from_db()
        holding = Holding.objects.get(
            asset=self.asset, holder_type=HolderType.MANAGER, holder_id=MANAGER_HOLDER_ID,
        )
        self.assertEqual(self.asset.total_quantity, 15)
        self.assertEqual(holding.quantity, 15)

    def test_decrease_beyond_manager_pool_rejected(self):
        services.move_quantity(
            asset=self.asset,
            from_holder_type=HolderType.MANAGER, from_holder_id=MANAGER_HOLDER_ID,
            to_holder_type=HolderType.DEPARTMENT, to_holder_id=1,
            quantity=8, performed_by=self.manager_user, kind=TransferKind.ALLOCATE,
        )
        with self.assertRaises(services.InsufficientQuantityError):
            services.adjust_stock(asset=self.asset, delta=-5, performed_by=self.manager_user)


class ConcurrentMoveQuantityTests(TransactionTestCase):
    """Race two concurrent moves against a finite manager pool; invariant must hold."""

    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        self.manager_user = User.objects.create_user(
            email="mgr4@example.com", password="pw", full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.asset = services.register_asset(
            name="Cars", category=category, total_quantity=5,
            condition="good", location="Lot A", is_bookable=False,
            created_by=self.manager_user,
        )

    def test_two_racing_allocations_never_oversell_the_pool(self):
        errors = []

        def try_allocate(dept_id, qty):
            try:
                services.move_quantity(
                    asset=self.asset,
                    from_holder_type=HolderType.MANAGER, from_holder_id=MANAGER_HOLDER_ID,
                    to_holder_type=HolderType.DEPARTMENT, to_holder_id=dept_id,
                    quantity=qty, performed_by=self.manager_user, kind=TransferKind.ALLOCATE,
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
```

- [ ] **Step 2: Run tests to verify they fail (module doesn't exist yet)**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_services -v 2`
Expected: FAIL / ERROR — `ModuleNotFoundError: No module named 'apps.resource_allocation.services'`

- [ ] **Step 3: Write the service module**

Create `backend/apps/resource_allocation/services.py`:

```python
from django.db import transaction
from django.db.models import F

from .models import Asset, HolderType, Holding, MANAGER_HOLDER_ID, Transfer, TransferKind


class InsufficientQuantityError(Exception):
    """Raised when a holder doesn't have enough quantity to cover a requested movement."""


class InvalidHolderError(Exception):
    """Raised when a holder reference is structurally or authorization-wise invalid."""


def _locked_holding(asset, holder_type, holder_id):
    """Lock (or create) a Holding row. Must be called inside an outer atomic block."""
    holding, _ = Holding.objects.select_for_update().get_or_create(
        asset=asset, holder_type=holder_type, holder_id=holder_id, defaults={"quantity": 0}
    )
    return holding


@transaction.atomic
def move_quantity(
    *, asset, from_holder_type, from_holder_id, to_holder_type, to_holder_id,
    quantity, performed_by, kind, request=None, notes="",
):
    """Atomically move `quantity` from one Holding to another and log a Transfer."""
    if quantity <= 0:
        raise ValueError("quantity must be positive")

    from_key = (from_holder_type, from_holder_id)
    to_key = (to_holder_type, to_holder_id)
    if from_key == to_key:
        raise ValueError("from and to holders must differ")

    # Lock in a stable order regardless of from/to role, so two transfers
    # touching the same pair of holdings in opposite directions can't deadlock.
    if from_key < to_key:
        from_holding = _locked_holding(asset, from_holder_type, from_holder_id)
        to_holding = _locked_holding(asset, to_holder_type, to_holder_id)
    else:
        to_holding = _locked_holding(asset, to_holder_type, to_holder_id)
        from_holding = _locked_holding(asset, from_holder_type, from_holder_id)

    if from_holding.quantity < quantity:
        raise InsufficientQuantityError(
            f"{from_holder_type}:{from_holder_id} has {from_holding.quantity}, needs {quantity}"
        )

    from_holding.quantity = F("quantity") - quantity
    from_holding.save(update_fields=["quantity"])
    to_holding.quantity = F("quantity") + quantity
    to_holding.save(update_fields=["quantity"])

    return Transfer.objects.create(
        asset=asset,
        from_holder_type=from_holder_type, from_holder_id=from_holder_id,
        to_holder_type=to_holder_type, to_holder_id=to_holder_id,
        quantity=quantity, kind=kind, request=request,
        performed_by=performed_by, notes=notes,
    )


@transaction.atomic
def register_asset(*, name, category, total_quantity, condition, location, is_bookable, created_by):
    """Create an Asset and its initial fully-unallocated manager Holding."""
    if total_quantity < 0:
        raise ValueError("total_quantity must be >= 0")
    asset = Asset.objects.create(
        name=name, category=category, total_quantity=total_quantity,
        condition=condition, location=location, is_bookable=is_bookable,
        created_by=created_by,
    )
    Holding.objects.create(
        asset=asset, holder_type=HolderType.MANAGER, holder_id=MANAGER_HOLDER_ID,
        quantity=total_quantity,
    )
    return asset


@transaction.atomic
def adjust_stock(*, asset, delta, performed_by):
    """Increase/decrease total_quantity. Decreases can only draw down the unallocated pool."""
    if delta == 0:
        raise ValueError("delta must be non-zero")

    manager_holding = _locked_holding(asset, HolderType.MANAGER, MANAGER_HOLDER_ID)
    if delta < 0 and manager_holding.quantity < abs(delta):
        raise InsufficientQuantityError(
            "Cannot reduce stock below the unallocated manager pool quantity."
        )

    manager_holding.quantity = F("quantity") + delta
    manager_holding.save(update_fields=["quantity"])
    asset.total_quantity = F("total_quantity") + delta
    asset.save(update_fields=["total_quantity"])
    asset.refresh_from_db()
    return asset
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_services -v 2`
Expected: All tests PASS (`OK`)

- [ ] **Step 5: Lint and commit**

```bash
cd backend && uv run ruff check . && uv run ruff format .
git add backend/apps/resource_allocation/services.py backend/apps/resource_allocation/tests/test_services.py
git commit -m "feat(resource_allocation): add move_quantity ledger primitive, register_asset, adjust_stock"
```

---

## Task 3: `allocate` and `sub_allocate` services

**Files:**
- Modify: `backend/apps/resource_allocation/services.py`
- Modify: `backend/apps/resource_allocation/tests/test_services.py`

**Interfaces:**
- Consumes: `move_quantity`, `InvalidHolderError` (Task 2); `User.department_id` (from `apps.authentication.models.User`)
- Produces: `allocate(*, asset, to_holder_type, to_holder_id, quantity, performed_by) -> Transfer`, `sub_allocate(*, asset, department, employee, quantity, performed_by) -> Transfer`

- [ ] **Step 1: Write the failing tests**

Append to `backend/apps/resource_allocation/tests/test_services.py`:

```python
from apps.organization.models import Department


class AllocateTests(TestCase):
    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        self.manager_user = User.objects.create_user(
            email="mgr5@example.com", password="pw", full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.asset = services.register_asset(
            name="Cars", category=category, total_quantity=10,
            condition="good", location="Lot A", is_bookable=False,
            created_by=self.manager_user,
        )

    def test_allocate_pushes_from_manager_pool_with_no_approval_check(self):
        services.allocate(
            asset=self.asset, to_holder_type=HolderType.DEPARTMENT, to_holder_id=1,
            quantity=4, performed_by=self.manager_user,
        )
        dept_holding = Holding.objects.get(
            asset=self.asset, holder_type=HolderType.DEPARTMENT, holder_id=1,
        )
        self.assertEqual(dept_holding.quantity, 4)


class SubAllocateTests(TestCase):
    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        self.dept = Department.objects.create(name="Sales")
        self.head = User.objects.create_user(
            email="head@example.com", password="pw", full_name="Head",
            role=UserRole.DEPARTMENT_HEAD, department=self.dept,
        )
        self.employee_in_dept = User.objects.create_user(
            email="emp-in@example.com", password="pw", full_name="Employee In",
            department=self.dept,
        )
        self.employee_other_dept = User.objects.create_user(
            email="emp-out@example.com", password="pw", full_name="Employee Out",
        )
        self.asset = services.register_asset(
            name="Cars", category=category, total_quantity=10,
            condition="good", location="Lot A", is_bookable=False,
            created_by=self.head,
        )
        services.allocate(
            asset=self.asset, to_holder_type=HolderType.DEPARTMENT, to_holder_id=self.dept.id,
            quantity=5, performed_by=self.head,
        )

    def test_sub_allocate_to_own_employee_succeeds(self):
        services.sub_allocate(
            asset=self.asset, department=self.dept, employee=self.employee_in_dept,
            quantity=2, performed_by=self.head,
        )
        emp_holding = Holding.objects.get(
            asset=self.asset, holder_type=HolderType.EMPLOYEE, holder_id=self.employee_in_dept.id,
        )
        dept_holding = Holding.objects.get(
            asset=self.asset, holder_type=HolderType.DEPARTMENT, holder_id=self.dept.id,
        )
        self.assertEqual(emp_holding.quantity, 2)
        self.assertEqual(dept_holding.quantity, 3)

    def test_sub_allocate_to_employee_outside_department_rejected(self):
        with self.assertRaises(services.InvalidHolderError):
            services.sub_allocate(
                asset=self.asset, department=self.dept, employee=self.employee_other_dept,
                quantity=1, performed_by=self.head,
            )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_services.AllocateTests apps.resource_allocation.tests.test_services.SubAllocateTests -v 2`
Expected: FAIL — `AttributeError: module 'apps.resource_allocation.services' has no attribute 'allocate'`

- [ ] **Step 3: Implement `allocate` and `sub_allocate`**

Append to `backend/apps/resource_allocation/services.py`:

```python
def allocate(*, asset, to_holder_type, to_holder_id, quantity, performed_by):
    """Asset Manager discretionary push from the unallocated manager pool. No approval check."""
    return move_quantity(
        asset=asset,
        from_holder_type=HolderType.MANAGER, from_holder_id=MANAGER_HOLDER_ID,
        to_holder_type=to_holder_type, to_holder_id=to_holder_id,
        quantity=quantity, performed_by=performed_by, kind=TransferKind.ALLOCATE,
    )


def sub_allocate(*, asset, department, employee, quantity, performed_by):
    """Department Head pushes quantity they hold to one of their own employees."""
    if employee.department_id != department.id:
        raise InvalidHolderError("Employee does not belong to this department.")
    return move_quantity(
        asset=asset,
        from_holder_type=HolderType.DEPARTMENT, from_holder_id=department.id,
        to_holder_type=HolderType.EMPLOYEE, to_holder_id=employee.id,
        quantity=quantity, performed_by=performed_by, kind=TransferKind.SUB_ALLOCATE,
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_services -v 2`
Expected: All tests PASS

- [ ] **Step 5: Lint and commit**

```bash
cd backend && uv run ruff check . && uv run ruff format .
git add backend/apps/resource_allocation/services.py backend/apps/resource_allocation/tests/test_services.py
git commit -m "feat(resource_allocation): add allocate and sub_allocate services"
```

---

## Task 4: Request lifecycle — `create_request`, `spare_quantity`, `fulfill_request`, `reject_request`, `cancel_request`, `open_requests_for_peer_fulfillment`

**Files:**
- Modify: `backend/apps/resource_allocation/services.py`
- Create: `backend/apps/resource_allocation/tests/test_requests.py`

**Interfaces:**
- Consumes: `move_quantity`, `InsufficientQuantityError`, `InvalidHolderError` (Task 2/3); `AllocationRequest`, `RequestStatus`, `HolderType` (Task 1); `apps.authentication.models.User`
- Produces: `create_request(*, asset, requested_by, for_holder_type, for_holder_id, quantity_requested) -> AllocationRequest`, `spare_quantity(*, asset, department_id) -> int`, `fulfill_request(*, request, from_holder_type, from_holder_id, quantity, performed_by) -> Transfer`, `reject_request(*, request, performed_by) -> AllocationRequest`, `cancel_request(*, request, performed_by) -> AllocationRequest`, `open_requests_for_peer_fulfillment(*, asset) -> QuerySet[AllocationRequest]`

- [ ] **Step 1: Write the failing tests**

Create `backend/apps/resource_allocation/tests/test_requests.py`:

```python
import threading

from django.db import connection
from django.db.models import Sum
from django.test import TestCase, TransactionTestCase

from apps.authentication.models import User, UserRole
from apps.organization.models import AssetCategory, Department
from apps.resource_allocation import services
from apps.resource_allocation.models import (
    AllocationRequest, HolderType, Holding, RequestStatus,
)


class RequestFixtureMixin:
    def make_fixture(self, total_quantity=10):
        category = AssetCategory.objects.create(name="Vehicles")
        self.manager_user = User.objects.create_user(
            email="mgr6@example.com", password="pw", full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.dept_a = Department.objects.create(name="Dept A")
        self.dept_b = Department.objects.create(name="Dept B")
        self.dept_c = Department.objects.create(name="Dept C")
        self.head_a = User.objects.create_user(
            email="head-a@example.com", password="pw", full_name="Head A",
            role=UserRole.DEPARTMENT_HEAD, department=self.dept_a,
        )
        self.head_b = User.objects.create_user(
            email="head-b@example.com", password="pw", full_name="Head B",
            role=UserRole.DEPARTMENT_HEAD, department=self.dept_b,
        )
        self.head_c = User.objects.create_user(
            email="head-c@example.com", password="pw", full_name="Head C",
            role=UserRole.DEPARTMENT_HEAD, department=self.dept_c,
        )
        self.asset = services.register_asset(
            name="Cars", category=category, total_quantity=total_quantity,
            condition="good", location="Lot A", is_bookable=False,
            created_by=self.manager_user,
        )
        return self.asset


class CreateRequestTests(RequestFixtureMixin, TestCase):
    def test_creates_open_request(self):
        asset = self.make_fixture()
        req = services.create_request(
            asset=asset, requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT, for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )
        self.assertEqual(req.status, RequestStatus.OPEN)
        self.assertEqual(req.quantity_fulfilled, 0)


class SpareQuantityTests(RequestFixtureMixin, TestCase):
    def test_spare_is_department_holding_minus_employee_suballocations(self):
        asset = self.make_fixture()
        employee = User.objects.create_user(
            email="emp-a@example.com", password="pw", full_name="Emp A",
            department=self.dept_a,
        )
        services.allocate(
            asset=asset, to_holder_type=HolderType.DEPARTMENT, to_holder_id=self.dept_a.id,
            quantity=5, performed_by=self.manager_user,
        )
        services.sub_allocate(
            asset=asset, department=self.dept_a, employee=employee,
            quantity=2, performed_by=self.head_a,
        )
        self.assertEqual(
            services.spare_quantity(asset=asset, department_id=self.dept_a.id), 3
        )


class FulfillFromManagerPoolTests(RequestFixtureMixin, TestCase):
    def test_fulfill_from_manager_pool_resolves_request(self):
        asset = self.make_fixture()
        req = services.create_request(
            asset=asset, requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT, for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )
        services.fulfill_request(
            request=req, from_holder_type=HolderType.MANAGER, from_holder_id=0,
            quantity=2, performed_by=self.manager_user,
        )
        req.refresh_from_db()
        self.assertEqual(req.status, RequestStatus.FULFILLED)
        self.assertEqual(req.quantity_fulfilled, 2)

    def test_overfulfilling_rejected(self):
        asset = self.make_fixture()
        req = services.create_request(
            asset=asset, requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT, for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )
        with self.assertRaises(services.InsufficientQuantityError):
            services.fulfill_request(
                request=req, from_holder_type=HolderType.MANAGER, from_holder_id=0,
                quantity=3, performed_by=self.manager_user,
            )


class PeerFulfillmentTests(RequestFixtureMixin, TestCase):
    """Reproduces the '10 cars, Dept C wants 2, manager pool empty' scenario."""

    def setUp(self):
        asset = self.make_fixture(total_quantity=10)
        # All 10 cars pushed out to Dept A (6) and Dept B (4); manager pool is now empty.
        services.allocate(
            asset=asset, to_holder_type=HolderType.DEPARTMENT, to_holder_id=self.dept_a.id,
            quantity=6, performed_by=self.manager_user,
        )
        services.allocate(
            asset=asset, to_holder_type=HolderType.DEPARTMENT, to_holder_id=self.dept_b.id,
            quantity=4, performed_by=self.manager_user,
        )
        self.asset = asset
        self.request = services.create_request(
            asset=asset, requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT, for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )

    def test_request_appears_for_holders_with_spare_quantity(self):
        open_requests = services.open_requests_for_peer_fulfillment(asset=self.asset)
        self.assertIn(self.request, list(open_requests))

    def test_single_department_can_fully_fulfill(self):
        services.fulfill_request(
            request=self.request,
            from_holder_type=HolderType.DEPARTMENT, from_holder_id=self.dept_a.id,
            quantity=2, performed_by=self.head_a,
        )
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, RequestStatus.FULFILLED)
        dept_a_holding = Holding.objects.get(
            asset=self.asset, holder_type=HolderType.DEPARTMENT, holder_id=self.dept_a.id,
        )
        self.assertEqual(dept_a_holding.quantity, 4)

    def test_two_departments_can_split_fulfillment(self):
        services.fulfill_request(
            request=self.request,
            from_holder_type=HolderType.DEPARTMENT, from_holder_id=self.dept_a.id,
            quantity=1, performed_by=self.head_a,
        )
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, RequestStatus.PARTIALLY_FULFILLED)

        services.fulfill_request(
            request=self.request,
            from_holder_type=HolderType.DEPARTMENT, from_holder_id=self.dept_b.id,
            quantity=1, performed_by=self.head_b,
        )
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, RequestStatus.FULFILLED)
        self.assertEqual(self.request.quantity_fulfilled, 2)

    def test_invariant_holds_after_fulfillment(self):
        services.fulfill_request(
            request=self.request,
            from_holder_type=HolderType.DEPARTMENT, from_holder_id=self.dept_a.id,
            quantity=2, performed_by=self.head_a,
        )
        total = Holding.objects.filter(asset=self.asset).aggregate(total=Sum("quantity"))["total"]
        self.assertEqual(total, 10)


class RejectAndCancelTests(RequestFixtureMixin, TestCase):
    def test_reject_sets_status(self):
        asset = self.make_fixture()
        req = services.create_request(
            asset=asset, requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT, for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )
        services.reject_request(request=req, performed_by=self.manager_user)
        req.refresh_from_db()
        self.assertEqual(req.status, RequestStatus.REJECTED)

    def test_cancel_only_by_requester(self):
        asset = self.make_fixture()
        req = services.create_request(
            asset=asset, requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT, for_holder_id=self.dept_c.id,
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
            asset=asset, requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT, for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )
        services.reject_request(request=req, performed_by=self.manager_user)
        with self.assertRaises(ValueError):
            services.reject_request(request=req, performed_by=self.manager_user)


class ConcurrentPeerFulfillmentTests(RequestFixtureMixin, TransactionTestCase):
    def test_two_departments_racing_to_fulfill_never_overfulfill(self):
        asset = self.make_fixture(total_quantity=10)
        services.allocate(
            asset=asset, to_holder_type=HolderType.DEPARTMENT, to_holder_id=self.dept_a.id,
            quantity=6, performed_by=self.manager_user,
        )
        services.allocate(
            asset=asset, to_holder_type=HolderType.DEPARTMENT, to_holder_id=self.dept_b.id,
            quantity=4, performed_by=self.manager_user,
        )
        request = services.create_request(
            asset=asset, requested_by=self.head_c,
            for_holder_type=HolderType.DEPARTMENT, for_holder_id=self.dept_c.id,
            quantity_requested=2,
        )
        errors = []

        def try_fulfill(from_dept_id, head_user, qty):
            try:
                services.fulfill_request(
                    request=request,
                    from_holder_type=HolderType.DEPARTMENT, from_holder_id=from_dept_id,
                    quantity=qty, performed_by=head_user,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_requests -v 2`
Expected: FAIL — `AttributeError: module 'apps.resource_allocation.services' has no attribute 'create_request'`

- [ ] **Step 3: Implement the request lifecycle functions**

Append to `backend/apps/resource_allocation/services.py`:

```python
from django.db.models import Sum

from .models import AllocationRequest, RequestStatus


def create_request(*, asset, requested_by, for_holder_type, for_holder_id, quantity_requested):
    """Raise demand for `quantity_requested` units of `asset`."""
    if quantity_requested <= 0:
        raise ValueError("quantity_requested must be positive")
    return AllocationRequest.objects.create(
        asset=asset, requested_by=requested_by,
        for_holder_type=for_holder_type, for_holder_id=for_holder_id,
        quantity_requested=quantity_requested,
    )


def spare_quantity(*, asset, department_id):
    """Department's current holding minus what it has already sub-allocated to its employees."""
    from apps.authentication.models import User

    dept_holding = Holding.objects.filter(
        asset=asset, holder_type=HolderType.DEPARTMENT, holder_id=department_id
    ).first()
    dept_qty = dept_holding.quantity if dept_holding else 0

    employee_ids = list(User.objects.filter(department_id=department_id).values_list("id", flat=True))
    sub_allocated = (
        Holding.objects.filter(
            asset=asset, holder_type=HolderType.EMPLOYEE, holder_id__in=employee_ids
        ).aggregate(total=Sum("quantity"))["total"]
        or 0
    )
    return dept_qty - sub_allocated


@transaction.atomic
def fulfill_request(*, request, from_holder_type, from_holder_id, quantity, performed_by):
    """
    Fulfill (fully or partially) an AllocationRequest from a given source holder.
    from_holder_type=MANAGER -> Asset Manager fulfilling from the unallocated pool.
    from_holder_type=DEPARTMENT -> a peer Department Head fulfilling from their own spare quantity.
    """
    locked_request = AllocationRequest.objects.select_for_update().get(pk=request.pk)
    if locked_request.status in (
        RequestStatus.FULFILLED, RequestStatus.REJECTED, RequestStatus.CANCELLED,
    ):
        raise ValueError(f"Request is already {locked_request.status} and cannot be fulfilled.")

    remaining = locked_request.quantity_requested - locked_request.quantity_fulfilled
    if quantity > remaining:
        raise InsufficientQuantityError(
            f"Request only needs {remaining} more, cannot fulfill {quantity}."
        )

    kind = (
        TransferKind.FULFILL_REQUEST
        if from_holder_type == HolderType.MANAGER
        else TransferKind.PEER_TRANSFER
    )
    transfer = move_quantity(
        asset=locked_request.asset,
        from_holder_type=from_holder_type, from_holder_id=from_holder_id,
        to_holder_type=locked_request.for_holder_type, to_holder_id=locked_request.for_holder_id,
        quantity=quantity, performed_by=performed_by, kind=kind, request=locked_request,
    )

    locked_request.quantity_fulfilled = F("quantity_fulfilled") + quantity
    locked_request.save(update_fields=["quantity_fulfilled"])
    locked_request.refresh_from_db()
    locked_request.status = (
        RequestStatus.FULFILLED
        if locked_request.quantity_fulfilled >= locked_request.quantity_requested
        else RequestStatus.PARTIALLY_FULFILLED
    )
    locked_request.save(update_fields=["status"])
    return transfer


@transaction.atomic
def reject_request(*, request, performed_by):
    locked_request = AllocationRequest.objects.select_for_update().get(pk=request.pk)
    if locked_request.status in (
        RequestStatus.FULFILLED, RequestStatus.REJECTED, RequestStatus.CANCELLED,
    ):
        raise ValueError(f"Request is already {locked_request.status}.")
    locked_request.status = RequestStatus.REJECTED
    locked_request.save(update_fields=["status"])
    return locked_request


@transaction.atomic
def cancel_request(*, request, performed_by):
    locked_request = AllocationRequest.objects.select_for_update().get(pk=request.pk)
    if locked_request.requested_by_id != performed_by.id:
        raise InvalidHolderError("Only the requester can cancel this request.")
    if locked_request.status in (
        RequestStatus.FULFILLED, RequestStatus.REJECTED, RequestStatus.CANCELLED,
    ):
        raise ValueError(f"Request is already {locked_request.status}.")
    locked_request.status = RequestStatus.CANCELLED
    locked_request.save(update_fields=["status"])
    return locked_request


def open_requests_for_peer_fulfillment(*, asset):
    """Requests still needing quantity, for departments holding spare units to see and act on."""
    return AllocationRequest.objects.filter(
        asset=asset, status__in=(RequestStatus.OPEN, RequestStatus.PARTIALLY_FULFILLED),
    ).order_by("created_at")
```

Move the `from django.db.models import Sum` and `from .models import AllocationRequest, RequestStatus` imports to the top of `backend/apps/resource_allocation/services.py` alongside the existing imports (do not leave inline imports scattered mid-file) — final import block at the top of the file should read:

```python
from django.db import transaction
from django.db.models import F, Sum

from .models import (
    Asset,
    AllocationRequest,
    HolderType,
    Holding,
    MANAGER_HOLDER_ID,
    RequestStatus,
    Transfer,
    TransferKind,
)
```

Keep the `from apps.authentication.models import User` import local inside `spare_quantity` (avoids a circular import at module load time between `authentication` and `resource_allocation`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_requests -v 2`
Expected: All tests PASS

- [ ] **Step 5: Lint and commit**

```bash
cd backend && uv run ruff check . && uv run ruff format .
git add backend/apps/resource_allocation/services.py backend/apps/resource_allocation/tests/test_requests.py
git commit -m "feat(resource_allocation): add allocation request lifecycle with peer fulfillment"
```

---

## Task 5: `return_quantity` service

**Files:**
- Modify: `backend/apps/resource_allocation/services.py`
- Modify: `backend/apps/resource_allocation/tests/test_services.py`

**Interfaces:**
- Consumes: `move_quantity` (Task 2)
- Produces: `return_quantity(*, asset, from_holder_type, from_holder_id, quantity, performed_by) -> Transfer`

- [ ] **Step 1: Write the failing test**

Append to `backend/apps/resource_allocation/tests/test_services.py`:

```python
class ReturnQuantityTests(TestCase):
    def setUp(self):
        category = AssetCategory.objects.create(name="Vehicles")
        self.manager_user = User.objects.create_user(
            email="mgr7@example.com", password="pw", full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.asset = services.register_asset(
            name="Cars", category=category, total_quantity=10,
            condition="good", location="Lot A", is_bookable=False,
            created_by=self.manager_user,
        )
        services.allocate(
            asset=self.asset, to_holder_type=HolderType.DEPARTMENT, to_holder_id=1,
            quantity=4, performed_by=self.manager_user,
        )

    def test_return_moves_quantity_back_to_manager_pool(self):
        services.return_quantity(
            asset=self.asset, from_holder_type=HolderType.DEPARTMENT, from_holder_id=1,
            quantity=2, performed_by=self.manager_user,
        )
        manager_holding = Holding.objects.get(
            asset=self.asset, holder_type=HolderType.MANAGER, holder_id=MANAGER_HOLDER_ID,
        )
        dept_holding = Holding.objects.get(
            asset=self.asset, holder_type=HolderType.DEPARTMENT, holder_id=1,
        )
        self.assertEqual(manager_holding.quantity, 8)
        self.assertEqual(dept_holding.quantity, 2)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_services.ReturnQuantityTests -v 2`
Expected: FAIL — `AttributeError: module 'apps.resource_allocation.services' has no attribute 'return_quantity'`

- [ ] **Step 3: Implement `return_quantity`**

Append to `backend/apps/resource_allocation/services.py`:

```python
def return_quantity(*, asset, from_holder_type, from_holder_id, quantity, performed_by):
    """Return held quantity back to the unallocated manager pool."""
    return move_quantity(
        asset=asset,
        from_holder_type=from_holder_type, from_holder_id=from_holder_id,
        to_holder_type=HolderType.MANAGER, to_holder_id=MANAGER_HOLDER_ID,
        quantity=quantity, performed_by=performed_by, kind=TransferKind.RETURN,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_services.ReturnQuantityTests -v 2`
Expected: PASS

- [ ] **Step 5: Lint and commit**

```bash
cd backend && uv run ruff check . && uv run ruff format .
git add backend/apps/resource_allocation/services.py backend/apps/resource_allocation/tests/test_services.py
git commit -m "feat(resource_allocation): add return_quantity service"
```

---

## Task 6: Permissions and serializers

**Files:**
- Create: `backend/apps/resource_allocation/permissions.py`
- Create: `backend/apps/resource_allocation/serializers.py`
- Create: `backend/apps/resource_allocation/tests/test_serializers.py`

**Interfaces:**
- Consumes: `apps.authentication.models.UserRole`; `Asset`, `Holding`, `AllocationRequest`, `Transfer`, `HolderType` (Task 1)
- Produces: `IsAssetManager`, `IsAssetManagerOrDepartmentHead`, `IsDepartmentHeadOrEmployee` (permission classes); `AssetSerializer`, `HoldingSerializer`, `AllocationRequestSerializer`, `TransferSerializer`, `AdjustStockSerializer`, `AllocateSerializer`, `FulfillRequestSerializer`, `ReturnSerializer` — all consumed by Tasks 7-10.

- [ ] **Step 1: Write the failing serializer tests**

Create `backend/apps/resource_allocation/tests/test_serializers.py`:

```python
from django.test import TestCase

from apps.authentication.models import User, UserRole
from apps.organization.models import AssetCategory
from apps.resource_allocation.models import HolderType
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
            email="mgr8@example.com", password="pw", full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )

    def test_valid_payload_is_accepted(self):
        serializer = AssetSerializer(data={
            "name": "Cars", "category": self.category.id, "total_quantity": 10,
            "condition": "good", "location": "Lot A", "is_bookable": False,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_negative_total_quantity_rejected(self):
        serializer = AssetSerializer(data={
            "name": "Cars", "category": self.category.id, "total_quantity": -1,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("total_quantity", serializer.errors)


class ActionSerializerTests(TestCase):
    def test_adjust_stock_requires_nonzero_delta(self):
        serializer = AdjustStockSerializer(data={"delta": 0})
        self.assertFalse(serializer.is_valid())

    def test_allocate_requires_positive_quantity(self):
        serializer = AllocateSerializer(data={
            "asset": 1, "to_holder_type": HolderType.DEPARTMENT, "to_holder_id": 1, "quantity": 0,
        })
        self.assertFalse(serializer.is_valid())

    def test_fulfill_requires_positive_quantity(self):
        serializer = FulfillRequestSerializer(data={"quantity": -1})
        self.assertFalse(serializer.is_valid())

    def test_return_requires_positive_quantity(self):
        serializer = ReturnSerializer(data={"asset": 1, "quantity": 0})
        self.assertFalse(serializer.is_valid())
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_serializers -v 2`
Expected: FAIL — `ModuleNotFoundError: No module named 'apps.resource_allocation.serializers'`

- [ ] **Step 3: Write permissions.py**

Create `backend/apps/resource_allocation/permissions.py`:

```python
from rest_framework.permissions import BasePermission

from apps.authentication.models import UserRole


class IsAssetManager(BasePermission):
    message = "Only the Asset Manager can perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == UserRole.ASSET_MANAGER)


class IsAssetManagerOrDepartmentHead(BasePermission):
    message = "Only the Asset Manager or a Department Head can perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated
            and user.role in (UserRole.ASSET_MANAGER, UserRole.DEPARTMENT_HEAD)
        )


class IsDepartmentHeadOrEmployee(BasePermission):
    message = "Only a Department Head or Employee can perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated
            and user.role in (UserRole.DEPARTMENT_HEAD, UserRole.EMPLOYEE)
        )
```

- [ ] **Step 4: Write serializers.py**

Create `backend/apps/resource_allocation/serializers.py`:

```python
from rest_framework import serializers

from .models import Asset, AllocationRequest, HolderType, Holding, Transfer


class AssetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Asset
        fields = (
            "id", "name", "category", "category_name", "total_quantity",
            "condition", "location", "is_bookable", "created_by", "created_at", "updated_at",
        )
        read_only_fields = ("id", "category_name", "created_by", "created_at", "updated_at")

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Asset name is required.")
        return value

    def update(self, instance, validated_data):
        # total_quantity can only change via the adjust-stock action.
        validated_data.pop("total_quantity", None)
        return super().update(instance, validated_data)


class HoldingSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source="asset.name", read_only=True)

    class Meta:
        model = Holding
        fields = ("id", "asset", "asset_name", "holder_type", "holder_id", "quantity")
        read_only_fields = fields


class AllocationRequestSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    requested_by_name = serializers.CharField(source="requested_by.full_name", read_only=True)
    remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = AllocationRequest
        fields = (
            "id", "asset", "asset_name", "requested_by", "requested_by_name",
            "for_holder_type", "for_holder_id", "quantity_requested", "quantity_fulfilled",
            "remaining", "status", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "asset_name", "requested_by", "requested_by_name",
            "quantity_fulfilled", "remaining", "status", "created_at", "updated_at",
        )

    def validate_quantity_requested(self, value):
        if value <= 0:
            raise serializers.ValidationError("quantity_requested must be positive.")
        return value


class TransferSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source="asset.name", read_only=True)

    class Meta:
        model = Transfer
        fields = (
            "id", "asset", "asset_name", "from_holder_type", "from_holder_id",
            "to_holder_type", "to_holder_id", "quantity", "kind", "request",
            "performed_by", "notes", "created_at",
        )
        read_only_fields = fields


class AdjustStockSerializer(serializers.Serializer):
    delta = serializers.IntegerField()

    def validate_delta(self, value):
        if value == 0:
            raise serializers.ValidationError("delta must be non-zero.")
        return value


class AllocateSerializer(serializers.Serializer):
    asset = serializers.PrimaryKeyRelatedField(queryset=Asset.objects.all())
    to_holder_type = serializers.ChoiceField(choices=HolderType.choices)
    to_holder_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class FulfillRequestSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)


class ReturnSerializer(serializers.Serializer):
    asset = serializers.PrimaryKeyRelatedField(queryset=Asset.objects.all())
    quantity = serializers.IntegerField(min_value=1)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_serializers -v 2`
Expected: All tests PASS

- [ ] **Step 6: Lint and commit**

```bash
cd backend && uv run ruff check . && uv run ruff format .
git add backend/apps/resource_allocation/permissions.py backend/apps/resource_allocation/serializers.py backend/apps/resource_allocation/tests/test_serializers.py
git commit -m "feat(resource_allocation): add permissions and serializers"
```

---

## Task 7: `AssetViewSet` + URL wiring

**Files:**
- Create: `backend/apps/resource_allocation/views.py`
- Create: `backend/apps/resource_allocation/urls.py`
- Create: `backend/apps/resource_allocation/tests/test_api.py`
- Modify: `backend/config/urls.py` — add `path("api/resources/", include("apps.resource_allocation.urls"))`

**Interfaces:**
- Consumes: `AssetSerializer`, `AdjustStockSerializer` (Task 6); `services.register_asset`, `services.adjust_stock` (Task 2); `IsAssetManager` (Task 6)
- Produces: `AssetViewSet` (registered at `assets`), base `router` object in `urls.py` that Tasks 8-9 register onto.

- [ ] **Step 1: Write the failing API tests**

Create `backend/apps/resource_allocation/tests/test_api.py`:

```python
from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.models import User, UserRole
from apps.organization.models import AssetCategory


class AssetApiTests(APITestCase):
    def setUp(self):
        self.category = AssetCategory.objects.create(name="Vehicles")
        self.manager = User.objects.create_user(
            email="mgr9@example.com", password="pw", full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.employee = User.objects.create_user(
            email="emp9@example.com", password="pw", full_name="Employee",
        )

    def test_asset_manager_can_register_asset(self):
        self.client.force_authenticate(self.manager)
        response = self.client.post("/api/resources/assets/", {
            "name": "Cars", "category": self.category.id, "total_quantity": 10,
            "condition": "good", "location": "Lot A", "is_bookable": False,
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["total_quantity"], 10)

    def test_employee_cannot_register_asset(self):
        self.client.force_authenticate(self.employee)
        response = self.client.post("/api/resources/assets/", {
            "name": "Cars", "category": self.category.id, "total_quantity": 10,
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_any_authenticated_user_can_list_assets(self):
        self.client.force_authenticate(self.manager)
        self.client.post("/api/resources/assets/", {
            "name": "Cars", "category": self.category.id, "total_quantity": 10,
        })
        self.client.force_authenticate(self.employee)
        response = self.client.get("/api/resources/assets/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_adjust_stock_increases_manager_pool(self):
        self.client.force_authenticate(self.manager)
        create_response = self.client.post("/api/resources/assets/", {
            "name": "Cars", "category": self.category.id, "total_quantity": 10,
        })
        asset_id = create_response.data["id"]
        response = self.client.post(
            f"/api/resources/assets/{asset_id}/adjust-stock/", {"delta": 5}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_quantity"], 15)

    def test_updating_total_quantity_directly_is_ignored(self):
        self.client.force_authenticate(self.manager)
        create_response = self.client.post("/api/resources/assets/", {
            "name": "Cars", "category": self.category.id, "total_quantity": 10,
        })
        asset_id = create_response.data["id"]
        response = self.client.patch(
            f"/api/resources/assets/{asset_id}/", {"total_quantity": 999}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_quantity"], 10)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_api.AssetApiTests -v 2`
Expected: FAIL — `ModuleNotFoundError: No module named 'apps.resource_allocation.views'` (or a 404, since the URL isn't wired yet)

- [ ] **Step 3: Write `views.py`, `urls.py`, and wire `config/urls.py`**

Create `backend/apps/resource_allocation/views.py`:

```python
from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import services
from .models import Asset
from .permissions import IsAssetManager
from .serializers import AdjustStockSerializer, AssetSerializer


@extend_schema_view(
    list=extend_schema(tags=["Resources / Assets"], summary="List assets"),
    retrieve=extend_schema(tags=["Resources / Assets"], summary="Get an asset"),
    create=extend_schema(tags=["Resources / Assets"], summary="Register an asset"),
    update=extend_schema(tags=["Resources / Assets"], summary="Replace an asset"),
    partial_update=extend_schema(tags=["Resources / Assets"], summary="Update an asset"),
)
class AssetViewSet(viewsets.ModelViewSet):
    """
    Asset catalog. Read: any authenticated user. Write: Asset Manager only.

    total_quantity can only change via the adjust-stock action, never a plain
    PATCH/PUT (see AssetSerializer.update).
    """

    queryset = Asset.objects.select_related("category", "created_by").all()
    serializer_class = AssetSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update", "adjust_stock"):
            return [IsAuthenticated(), IsAssetManager()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search")
        category = self.request.query_params.get("category")
        if search:
            qs = qs.filter(Q(name__icontains=search))
        if category:
            qs = qs.filter(category_id=category)
        return qs

    def perform_create(self, serializer):
        asset = services.register_asset(
            name=serializer.validated_data["name"],
            category=serializer.validated_data["category"],
            total_quantity=serializer.validated_data["total_quantity"],
            condition=serializer.validated_data.get("condition", ""),
            location=serializer.validated_data.get("location", ""),
            is_bookable=serializer.validated_data.get("is_bookable", False),
            created_by=self.request.user,
        )
        serializer.instance = asset

    @extend_schema(
        tags=["Resources / Assets"],
        summary="Adjust total stock quantity",
        request=AdjustStockSerializer,
        responses=AssetSerializer,
    )
    @action(detail=True, methods=["post"], url_path="adjust-stock")
    def adjust_stock(self, request, pk=None):
        asset = self.get_object()
        serializer = AdjustStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = services.adjust_stock(
            asset=asset, delta=serializer.validated_data["delta"], performed_by=request.user,
        )
        return Response(AssetSerializer(updated).data)
```

Create `backend/apps/resource_allocation/urls.py`:

```python
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AssetViewSet

router = DefaultRouter()
router.register(r"assets", AssetViewSet, basename="resource-asset")

urlpatterns = [
    path("", include(router.urls)),
]
```

In `backend/config/urls.py`, add the new include next to the organization one:

```python
urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.authentication.urls")),
    path("api/org/", include("apps.organization.urls")),
    path("api/resources/", include("apps.resource_allocation.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_api.AssetApiTests -v 2`
Expected: All tests PASS

- [ ] **Step 5: Lint and commit**

```bash
cd backend && uv run ruff check . && uv run ruff format .
git add backend/apps/resource_allocation/views.py backend/apps/resource_allocation/urls.py backend/apps/resource_allocation/tests/test_api.py backend/config/urls.py
git commit -m "feat(resource_allocation): add AssetViewSet and wire /api/resources/"
```

---

## Task 8: `HoldingViewSet` and `TransferViewSet` (read-only, scoped)

**Files:**
- Modify: `backend/apps/resource_allocation/views.py`
- Modify: `backend/apps/resource_allocation/urls.py`
- Modify: `backend/apps/resource_allocation/tests/test_api.py`

**Interfaces:**
- Consumes: `HoldingSerializer`, `TransferSerializer` (Task 6); `Holding`, `Transfer`, `HolderType` (Task 1); `apps.organization.models.Department`
- Produces: `HoldingViewSet` (registered at `holdings`), `TransferViewSet` (registered at `transfers`)

- [ ] **Step 1: Write the failing tests**

Append to `backend/apps/resource_allocation/tests/test_api.py`:

```python
from apps.organization.models import Department
from apps.resource_allocation import services
from apps.resource_allocation.models import HolderType


class HoldingScopingApiTests(APITestCase):
    def setUp(self):
        self.category = AssetCategory.objects.create(name="Vehicles")
        self.manager = User.objects.create_user(
            email="mgr10@example.com", password="pw", full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.dept_a = Department.objects.create(name="Dept A")
        self.dept_b = Department.objects.create(name="Dept B")
        self.head_a = User.objects.create_user(
            email="head-a10@example.com", password="pw", full_name="Head A",
            role=UserRole.DEPARTMENT_HEAD, department=self.dept_a,
        )
        self.employee_a = User.objects.create_user(
            email="emp-a10@example.com", password="pw", full_name="Emp A",
            department=self.dept_a,
        )
        self.asset = services.register_asset(
            name="Cars", category=self.category, total_quantity=10,
            condition="good", location="Lot A", is_bookable=False, created_by=self.manager,
        )
        services.allocate(
            asset=self.asset, to_holder_type=HolderType.DEPARTMENT, to_holder_id=self.dept_a.id,
            quantity=5, performed_by=self.manager,
        )
        services.allocate(
            asset=self.asset, to_holder_type=HolderType.DEPARTMENT, to_holder_id=self.dept_b.id,
            quantity=3, performed_by=self.manager,
        )
        services.sub_allocate(
            asset=self.asset, department=self.dept_a, employee=self.employee_a,
            quantity=2, performed_by=self.head_a,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_api.HoldingScopingApiTests -v 2`
Expected: FAIL — 404 (URL `holdings/` not registered)

- [ ] **Step 3: Implement `HoldingViewSet` and `TransferViewSet`**

Update the import block at the **top** of `backend/apps/resource_allocation/views.py` (do not add new `import` statements mid-file — ruff's `E402`/`I` rules require them at the top) to read:

```python
from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.models import UserRole
from apps.organization.models import Department

from . import services
from .models import Asset, HolderType, Holding, Transfer
from .permissions import IsAssetManager
from .serializers import AdjustStockSerializer, AssetSerializer, HoldingSerializer, TransferSerializer
```

Then append the new classes below the existing `AssetViewSet`:

```python
def _own_holder_filters(user):
    """Q-expression fragments describing which Holding rows this user may see."""
    if user.role == UserRole.ASSET_MANAGER:
        return Q()
    if user.role == UserRole.DEPARTMENT_HEAD:
        dept = Department.objects.filter(head=user).first()
        if not dept:
            return Q(pk__in=[])
        employee_ids = list(
            dept.employees.values_list("id", flat=True)
        )
        return Q(holder_type=HolderType.DEPARTMENT, holder_id=dept.id) | Q(
            holder_type=HolderType.EMPLOYEE, holder_id__in=employee_ids
        )
    return Q(holder_type=HolderType.EMPLOYEE, holder_id=user.id)


@extend_schema_view(
    list=extend_schema(tags=["Resources / Holdings"], summary="List holdings"),
    retrieve=extend_schema(tags=["Resources / Holdings"], summary="Get a holding"),
)
class HoldingViewSet(viewsets.ReadOnlyModelViewSet):
    """Current-state view of who holds how much of each asset, scoped by role."""

    queryset = Holding.objects.select_related("asset").all()
    serializer_class = HoldingSerializer

    def get_queryset(self):
        qs = super().get_queryset().filter(_own_holder_filters(self.request.user))
        asset_id = self.request.query_params.get("asset")
        if asset_id:
            qs = qs.filter(asset_id=asset_id)
        return qs


@extend_schema_view(
    list=extend_schema(tags=["Resources / Transfers"], summary="List transfers (ledger)"),
    retrieve=extend_schema(tags=["Resources / Transfers"], summary="Get a transfer"),
)
class TransferViewSet(viewsets.ReadOnlyModelViewSet):
    """Immutable movement ledger, scoped by role the same way as HoldingViewSet."""

    queryset = Transfer.objects.select_related("asset", "performed_by").all()
    serializer_class = TransferSerializer

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.role == UserRole.ASSET_MANAGER:
            pass
        elif user.role == UserRole.DEPARTMENT_HEAD:
            dept = Department.objects.filter(head=user).first()
            if not dept:
                qs = qs.none()
            else:
                employee_ids = list(dept.employees.values_list("id", flat=True))
                qs = qs.filter(
                    Q(from_holder_type=HolderType.DEPARTMENT, from_holder_id=dept.id)
                    | Q(to_holder_type=HolderType.DEPARTMENT, to_holder_id=dept.id)
                    | Q(from_holder_type=HolderType.EMPLOYEE, from_holder_id__in=employee_ids)
                    | Q(to_holder_type=HolderType.EMPLOYEE, to_holder_id__in=employee_ids)
                )
        else:
            qs = qs.filter(
                Q(from_holder_type=HolderType.EMPLOYEE, from_holder_id=user.id)
                | Q(to_holder_type=HolderType.EMPLOYEE, to_holder_id=user.id)
            )
        asset_id = self.request.query_params.get("asset")
        if asset_id:
            qs = qs.filter(asset_id=asset_id)
        return qs
```

Update `backend/apps/resource_allocation/urls.py`:

```python
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AssetViewSet, HoldingViewSet, TransferViewSet

router = DefaultRouter()
router.register(r"assets", AssetViewSet, basename="resource-asset")
router.register(r"holdings", HoldingViewSet, basename="holding")
router.register(r"transfers", TransferViewSet, basename="transfer")

urlpatterns = [
    path("", include(router.urls)),
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_api -v 2`
Expected: All tests PASS

- [ ] **Step 5: Lint and commit**

```bash
cd backend && uv run ruff check . && uv run ruff format .
git add backend/apps/resource_allocation/views.py backend/apps/resource_allocation/urls.py backend/apps/resource_allocation/tests/test_api.py
git commit -m "feat(resource_allocation): add scoped HoldingViewSet and TransferViewSet"
```

---

## Task 9: `AllocationRequestViewSet` — create/list + fulfill/reject/cancel/broadcast actions

**Files:**
- Modify: `backend/apps/resource_allocation/views.py`
- Modify: `backend/apps/resource_allocation/urls.py`
- Modify: `backend/apps/resource_allocation/tests/test_api.py`

**Interfaces:**
- Consumes: `AllocationRequestSerializer`, `FulfillRequestSerializer` (Task 6); `services.create_request`, `services.fulfill_request`, `services.reject_request`, `services.cancel_request`, `services.open_requests_for_peer_fulfillment`, `services.spare_quantity` (Task 4); `IsAssetManagerOrDepartmentHead` (Task 6)
- Produces: `AllocationRequestViewSet` (registered at `requests`, with `fulfill`, `reject`, `cancel`, `broadcast` actions)

- [ ] **Step 1: Write the failing tests — the exact "10 cars, Dept C wants 2" scenario from the design**

Append to `backend/apps/resource_allocation/tests/test_api.py`:

```python
class AllocationRequestApiTests(APITestCase):
    def setUp(self):
        self.category = AssetCategory.objects.create(name="Vehicles")
        self.manager = User.objects.create_user(
            email="mgr11@example.com", password="pw", full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.dept_a = Department.objects.create(name="Dept A")
        self.dept_c = Department.objects.create(name="Dept C")
        self.head_a = User.objects.create_user(
            email="head-a11@example.com", password="pw", full_name="Head A",
            role=UserRole.DEPARTMENT_HEAD, department=self.dept_a,
        )
        self.head_c = User.objects.create_user(
            email="head-c11@example.com", password="pw", full_name="Head C",
            role=UserRole.DEPARTMENT_HEAD, department=self.dept_c,
        )
        self.asset = services.register_asset(
            name="Cars", category=self.category, total_quantity=10,
            condition="good", location="Lot A", is_bookable=False, created_by=self.manager,
        )
        # All 10 cars already pushed to Dept A. Manager pool is empty.
        services.allocate(
            asset=self.asset, to_holder_type=HolderType.DEPARTMENT, to_holder_id=self.dept_a.id,
            quantity=10, performed_by=self.manager,
        )

    def test_dept_c_requests_two_cars_and_dept_a_fulfills_via_broadcast(self):
        self.client.force_authenticate(self.head_c)
        create_response = self.client.post("/api/resources/requests/", {
            "asset": self.asset.id, "for_holder_type": "department",
            "for_holder_id": self.dept_c.id, "quantity_requested": 2,
        })
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
        create_response = self.client.post("/api/resources/requests/", {
            "asset": self.asset.id, "for_holder_type": "department",
            "for_holder_id": self.dept_c.id, "quantity_requested": 2,
        })
        request_id = create_response.data["id"]

        self.client.force_authenticate(self.manager)
        reject_response = self.client.post(f"/api/resources/requests/{request_id}/reject/")
        self.assertEqual(reject_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reject_response.data["status"], "rejected")

    def test_requester_can_cancel_own_request(self):
        self.client.force_authenticate(self.head_c)
        create_response = self.client.post("/api/resources/requests/", {
            "asset": self.asset.id, "for_holder_type": "department",
            "for_holder_id": self.dept_c.id, "quantity_requested": 2,
        })
        request_id = create_response.data["id"]

        cancel_response = self.client.post(f"/api/resources/requests/{request_id}/cancel/")
        self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_response.data["status"], "cancelled")

    def test_other_department_head_cannot_cancel_someone_elses_request(self):
        self.client.force_authenticate(self.head_c)
        create_response = self.client.post("/api/resources/requests/", {
            "asset": self.asset.id, "for_holder_type": "department",
            "for_holder_id": self.dept_c.id, "quantity_requested": 2,
        })
        request_id = create_response.data["id"]

        self.client.force_authenticate(self.head_a)
        cancel_response = self.client.post(f"/api/resources/requests/{request_id}/cancel/")
        self.assertEqual(cancel_response.status_code, status.HTTP_403_FORBIDDEN)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_api.AllocationRequestApiTests -v 2`
Expected: FAIL — 404 (URL `requests/` not registered)

- [ ] **Step 3: Implement `AllocationRequestViewSet`**

Update the import block at the **top** of `backend/apps/resource_allocation/views.py` to read:

```python
from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.models import UserRole
from apps.organization.models import Department

from . import services
from .models import AllocationRequest, Asset, HolderType, Holding, MANAGER_HOLDER_ID, Transfer
from .permissions import IsAssetManager, IsAssetManagerOrDepartmentHead
from .serializers import (
    AdjustStockSerializer,
    AllocationRequestSerializer,
    AssetSerializer,
    FulfillRequestSerializer,
    HoldingSerializer,
    TransferSerializer,
)
```

Then append the new viewset below the existing `HoldingViewSet`/`TransferViewSet`:

```python
@extend_schema_view(
    list=extend_schema(tags=["Resources / Requests"], summary="List allocation requests"),
    retrieve=extend_schema(tags=["Resources / Requests"], summary="Get an allocation request"),
    create=extend_schema(tags=["Resources / Requests"], summary="Raise an allocation request"),
)
class AllocationRequestViewSet(viewsets.ModelViewSet):
    """
    Requests for asset quantity. Any authenticated user may create one for
    themselves or their own department; Asset Manager and peer Department
    Heads fulfill them (see `fulfill`, `broadcast`).
    """

    queryset = AllocationRequest.objects.select_related("asset", "requested_by").all()
    serializer_class = AllocationRequestSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.role == UserRole.ASSET_MANAGER:
            return qs
        if user.role == UserRole.DEPARTMENT_HEAD:
            dept = Department.objects.filter(head=user).first()
            dept_id = dept.id if dept else None
            return qs.filter(
                Q(requested_by=user) | Q(for_holder_type=HolderType.DEPARTMENT, for_holder_id=dept_id)
            )
        return qs.filter(requested_by=user)

    def perform_create(self, serializer):
        request_obj = services.create_request(
            asset=serializer.validated_data["asset"],
            requested_by=self.request.user,
            for_holder_type=serializer.validated_data["for_holder_type"],
            for_holder_id=serializer.validated_data["for_holder_id"],
            quantity_requested=serializer.validated_data["quantity_requested"],
        )
        serializer.instance = request_obj

    @extend_schema(
        tags=["Resources / Requests"],
        summary="List open requests this department could fulfill from spare quantity",
        parameters=[],
        responses=AllocationRequestSerializer(many=True),
    )
    @action(detail=False, methods=["get"], url_path="broadcast", permission_classes=[IsAuthenticated])
    def broadcast(self, request):
        asset_id = request.query_params.get("asset")
        if not asset_id:
            return Response({"detail": "asset query param is required."}, status=400)
        asset = Asset.objects.get(pk=asset_id)

        if request.user.role == UserRole.ASSET_MANAGER:
            dept_ids_with_spare = [
                d.id for d in Department.objects.all()
                if services.spare_quantity(asset=asset, department_id=d.id) > 0
            ]
        else:
            dept = Department.objects.filter(head=request.user).first()
            if not dept or services.spare_quantity(asset=asset, department_id=dept.id) <= 0:
                return Response([])
            dept_ids_with_spare = [dept.id]

        open_requests = services.open_requests_for_peer_fulfillment(asset=asset).filter(
            for_holder_type=HolderType.DEPARTMENT
        ).exclude(for_holder_id__in=dept_ids_with_spare)
        return Response(AllocationRequestSerializer(open_requests, many=True).data)

    @extend_schema(
        tags=["Resources / Requests"],
        summary="Fulfill a request (Asset Manager from the pool, or a peer Department Head)",
        request=FulfillRequestSerializer,
        responses=AllocationRequestSerializer,
    )
    @action(
        detail=True, methods=["post"],
        permission_classes=[IsAuthenticated, IsAssetManagerOrDepartmentHead],
    )
    def fulfill(self, request, pk=None):
        allocation_request = self.get_object()
        serializer = FulfillRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quantity = serializer.validated_data["quantity"]

        if request.user.role == UserRole.ASSET_MANAGER:
            from_holder_type, from_holder_id = HolderType.MANAGER, MANAGER_HOLDER_ID
        else:
            dept = Department.objects.filter(head=request.user).first()
            if not dept:
                return Response(
                    {"detail": "You do not head a department."}, status=403,
                )
            from_holder_type, from_holder_id = HolderType.DEPARTMENT, dept.id

        services.fulfill_request(
            request=allocation_request,
            from_holder_type=from_holder_type, from_holder_id=from_holder_id,
            quantity=quantity, performed_by=request.user,
        )
        allocation_request.refresh_from_db()
        return Response(AllocationRequestSerializer(allocation_request).data)

    @extend_schema(
        tags=["Resources / Requests"], summary="Reject a request", responses=AllocationRequestSerializer,
    )
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsAssetManager])
    def reject(self, request, pk=None):
        allocation_request = self.get_object()
        services.reject_request(request=allocation_request, performed_by=request.user)
        allocation_request.refresh_from_db()
        return Response(AllocationRequestSerializer(allocation_request).data)

    @extend_schema(
        tags=["Resources / Requests"], summary="Cancel own request", responses=AllocationRequestSerializer,
    )
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def cancel(self, request, pk=None):
        allocation_request = self.get_object()
        try:
            services.cancel_request(request=allocation_request, performed_by=request.user)
        except services.InvalidHolderError as exc:
            return Response({"detail": str(exc)}, status=403)
        allocation_request.refresh_from_db()
        return Response(AllocationRequestSerializer(allocation_request).data)
```

Update `backend/apps/resource_allocation/urls.py`:

```python
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AllocationRequestViewSet, AssetViewSet, HoldingViewSet, TransferViewSet

router = DefaultRouter()
router.register(r"assets", AssetViewSet, basename="resource-asset")
router.register(r"holdings", HoldingViewSet, basename="holding")
router.register(r"transfers", TransferViewSet, basename="transfer")
router.register(r"requests", AllocationRequestViewSet, basename="allocation-request")

urlpatterns = [
    path("", include(router.urls)),
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_api.AllocationRequestApiTests -v 2`
Expected: All tests PASS

- [ ] **Step 5: Lint and commit**

```bash
cd backend && uv run ruff check . && uv run ruff format .
git add backend/apps/resource_allocation/views.py backend/apps/resource_allocation/urls.py backend/apps/resource_allocation/tests/test_api.py
git commit -m "feat(resource_allocation): add AllocationRequestViewSet with broadcast/fulfill/reject/cancel"
```

---

## Task 10: `AllocateView` and `ReturnView` (direct-push and return endpoints)

**Files:**
- Modify: `backend/apps/resource_allocation/views.py`
- Modify: `backend/apps/resource_allocation/urls.py`
- Modify: `backend/apps/resource_allocation/tests/test_api.py`

**Interfaces:**
- Consumes: `AllocateSerializer`, `ReturnSerializer` (Task 6); `services.allocate`, `services.sub_allocate`, `services.return_quantity` (Task 3/5); `IsAssetManagerOrDepartmentHead`, `IsDepartmentHeadOrEmployee` (Task 6)
- Produces: `AllocateView`, `ReturnView`, mounted at `/api/resources/allocate/` and `/api/resources/return/`

- [ ] **Step 1: Write the failing tests**

Append to `backend/apps/resource_allocation/tests/test_api.py`:

```python
class AllocateAndReturnApiTests(APITestCase):
    def setUp(self):
        self.category = AssetCategory.objects.create(name="Vehicles")
        self.manager = User.objects.create_user(
            email="mgr12@example.com", password="pw", full_name="Manager",
            role=UserRole.ASSET_MANAGER,
        )
        self.dept_a = Department.objects.create(name="Dept A")
        self.head_a = User.objects.create_user(
            email="head-a12@example.com", password="pw", full_name="Head A",
            role=UserRole.DEPARTMENT_HEAD, department=self.dept_a,
        )
        self.employee_a = User.objects.create_user(
            email="emp-a12@example.com", password="pw", full_name="Emp A",
            department=self.dept_a,
        )
        self.employee_other = User.objects.create_user(
            email="emp-other12@example.com", password="pw", full_name="Emp Other",
        )
        self.asset = services.register_asset(
            name="Cars", category=self.category, total_quantity=10,
            condition="good", location="Lot A", is_bookable=False, created_by=self.manager,
        )

    def test_asset_manager_can_push_allocate_with_no_check(self):
        self.client.force_authenticate(self.manager)
        response = self.client.post("/api/resources/allocate/", {
            "asset": self.asset.id, "to_holder_type": "department",
            "to_holder_id": self.dept_a.id, "quantity": 4,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_department_head_can_sub_allocate_to_own_employee(self):
        self.client.force_authenticate(self.manager)
        self.client.post("/api/resources/allocate/", {
            "asset": self.asset.id, "to_holder_type": "department",
            "to_holder_id": self.dept_a.id, "quantity": 4,
        })

        self.client.force_authenticate(self.head_a)
        response = self.client.post("/api/resources/allocate/", {
            "asset": self.asset.id, "to_holder_type": "employee",
            "to_holder_id": self.employee_a.id, "quantity": 2,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_department_head_cannot_allocate_to_employee_outside_department(self):
        self.client.force_authenticate(self.manager)
        self.client.post("/api/resources/allocate/", {
            "asset": self.asset.id, "to_holder_type": "department",
            "to_holder_id": self.dept_a.id, "quantity": 4,
        })

        self.client.force_authenticate(self.head_a)
        response = self.client.post("/api/resources/allocate/", {
            "asset": self.asset.id, "to_holder_type": "employee",
            "to_holder_id": self.employee_other.id, "quantity": 1,
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_employee_cannot_use_allocate_endpoint(self):
        self.client.force_authenticate(self.employee_a)
        response = self.client.post("/api/resources/allocate/", {
            "asset": self.asset.id, "to_holder_type": "employee",
            "to_holder_id": self.employee_a.id, "quantity": 1,
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_department_head_can_return_quantity_to_manager_pool(self):
        self.client.force_authenticate(self.manager)
        self.client.post("/api/resources/allocate/", {
            "asset": self.asset.id, "to_holder_type": "department",
            "to_holder_id": self.dept_a.id, "quantity": 4,
        })

        self.client.force_authenticate(self.head_a)
        response = self.client.post("/api/resources/return/", {
            "asset": self.asset.id, "quantity": 2,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_api.AllocateAndReturnApiTests -v 2`
Expected: FAIL — 404 (URLs not registered)

- [ ] **Step 3: Implement `AllocateView` and `ReturnView`**

Update the import block at the **top** of `backend/apps/resource_allocation/views.py` to read:

```python
from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import User, UserRole
from apps.organization.models import Department

from . import services
from .models import AllocationRequest, Asset, HolderType, Holding, MANAGER_HOLDER_ID, Transfer
from .permissions import (
    IsAssetManager,
    IsAssetManagerOrDepartmentHead,
    IsDepartmentHeadOrEmployee,
)
from .serializers import (
    AdjustStockSerializer,
    AllocateSerializer,
    AllocationRequestSerializer,
    AssetSerializer,
    FulfillRequestSerializer,
    HoldingSerializer,
    ReturnSerializer,
    TransferSerializer,
)
```

Note the added `User` import from `apps.authentication.models` — `AllocateView` below looks up the target employee by id. Then append the new views below `AllocationRequestViewSet`:

```python
class AllocateView(APIView):
    """
    POST asset/to_holder_type/to_holder_id/quantity.

    Asset Manager: pushes from the unallocated manager pool (no approval check).
    Department Head: sub-allocates from their own department's holding to one
    of their own employees (to_holder_type must be 'employee').
    """

    permission_classes = [IsAuthenticated, IsAssetManagerOrDepartmentHead]

    def post(self, request):
        serializer = AllocateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if request.user.role == UserRole.ASSET_MANAGER:
            try:
                services.allocate(
                    asset=data["asset"], to_holder_type=data["to_holder_type"],
                    to_holder_id=data["to_holder_id"], quantity=data["quantity"],
                    performed_by=request.user,
                )
            except services.InsufficientQuantityError as exc:
                return Response({"detail": str(exc)}, status=400)
            return Response({"detail": "Allocated."})

        # Department Head
        if data["to_holder_type"] != HolderType.EMPLOYEE:
            return Response(
                {"detail": "A Department Head can only sub-allocate to an employee."},
                status=400,
            )
        dept = Department.objects.filter(head=request.user).first()
        if not dept:
            return Response({"detail": "You do not head a department."}, status=403)
        try:
            employee = User.objects.get(pk=data["to_holder_id"])
        except User.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=400)
        try:
            services.sub_allocate(
                asset=data["asset"], department=dept, employee=employee,
                quantity=data["quantity"], performed_by=request.user,
            )
        except (services.InvalidHolderError, services.InsufficientQuantityError) as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response({"detail": "Allocated."})


class ReturnView(APIView):
    """
    POST asset/quantity. Department Head returns from their department's
    holding; Employee returns from their own holding. Both go back to the
    unallocated manager pool.
    """

    permission_classes = [IsAuthenticated, IsDepartmentHeadOrEmployee]

    def post(self, request):
        serializer = ReturnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if request.user.role == UserRole.DEPARTMENT_HEAD:
            dept = Department.objects.filter(head=request.user).first()
            if not dept:
                return Response({"detail": "You do not head a department."}, status=403)
            from_holder_type, from_holder_id = HolderType.DEPARTMENT, dept.id
        else:
            from_holder_type, from_holder_id = HolderType.EMPLOYEE, request.user.id

        try:
            services.return_quantity(
                asset=data["asset"], from_holder_type=from_holder_type,
                from_holder_id=from_holder_id, quantity=data["quantity"],
                performed_by=request.user,
            )
        except services.InsufficientQuantityError as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response({"detail": "Returned."})
```

Update `backend/apps/resource_allocation/urls.py`:

```python
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AllocateView,
    AllocationRequestViewSet,
    AssetViewSet,
    HoldingViewSet,
    ReturnView,
    TransferViewSet,
)

router = DefaultRouter()
router.register(r"assets", AssetViewSet, basename="resource-asset")
router.register(r"holdings", HoldingViewSet, basename="holding")
router.register(r"transfers", TransferViewSet, basename="transfer")
router.register(r"requests", AllocationRequestViewSet, basename="allocation-request")

urlpatterns = [
    path("allocate/", AllocateView.as_view(), name="resource-allocate"),
    path("return/", ReturnView.as_view(), name="resource-return"),
    path("", include(router.urls)),
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run python manage.py test apps.resource_allocation.tests.test_api.AllocateAndReturnApiTests -v 2`
Expected: All tests PASS

- [ ] **Step 5: Lint and commit**

```bash
cd backend && uv run ruff check . && uv run ruff format .
git add backend/apps/resource_allocation/views.py backend/apps/resource_allocation/urls.py backend/apps/resource_allocation/tests/test_api.py
git commit -m "feat(resource_allocation): add AllocateView and ReturnView"
```

---

## Task 11: Full-suite verification and API schema check

**Files:**
- No new files — this task only runs verification commands.

**Interfaces:**
- Consumes: everything from Tasks 1-10.
- Produces: nothing new; this is the acceptance gate for the whole plan.

- [ ] **Step 1: Run the entire `resource_allocation` test suite**

Run: `cd backend && uv run python manage.py test apps.resource_allocation -v 2`
Expected: All tests PASS, `OK`, with a summary showing every test class from Tasks 1-10 (models, services, requests, serializers, api).

- [ ] **Step 2: Run the full backend test suite to confirm no regressions in `authentication`/`organization`**

Run: `cd backend && uv run python manage.py test`
Expected: All tests PASS (`OK`)

- [ ] **Step 3: Lint the whole backend**

Run: `cd backend && uv run ruff check . && uv run ruff format --check .`
Expected: no errors; if `ruff format --check` reports files needing formatting, run `uv run ruff format .` and re-check.

- [ ] **Step 4: Confirm the OpenAPI schema generates cleanly with the new endpoints**

Run: `cd backend && uv run python manage.py spectacular --file /tmp/resource_allocation_schema_check.yml`
Expected: exits 0 with no warnings about `resource_allocation` models/views (drf-spectacular sometimes warns about missing `@extend_schema` on custom actions — if it warns about `AllocateView`/`ReturnView`, add `@extend_schema(tags=["Resources / Allocate"], ...)` / `@extend_schema(tags=["Resources / Return"], ...)` decorators to their `post` methods and re-run).

Run: `grep -c "resources" /tmp/resource_allocation_schema_check.yml`
Expected: a non-zero count, confirming `/api/resources/...` paths are present in the generated schema.

- [ ] **Step 5: Manual smoke test via Swagger UI**

Run: `cd /home/manas/Projects/Sparkz-AssetFlow && make run-backend` (leave running)

Open `http://localhost:8000/api/docs/` in a browser and manually walk through the "10 cars" scenario end-to-end using the interactive Swagger UI (obtain a JWT via `/api/auth/login/` for an admin user first, promote test users to `asset_manager`/`department_head` via `/api/org/employees/{id}/role/`, then exercise `/api/resources/assets/`, `/api/resources/allocate/`, `/api/resources/requests/`, `/api/resources/requests/{id}/broadcast/`... `/fulfill/`, `/api/resources/holdings/`) to confirm the flows work outside of the automated tests too. Note any friction for follow-up.

- [ ] **Step 6: Update `AGENTS.md`'s implementation checklist**

In `AGENTS.md`, under "Not built yet (priority order for agents)", change the line:

```
1. Assets app (register, tags, lifecycle, search, attachments)
2. Allocations + transfers + returns + overdue job/query
```

to:

```
1. ~~Assets app~~ / ~~Allocations + transfers + returns~~ → done as `apps.resource_allocation`
   (quantity-based catalog + allocate/sub-allocate/request/peer-fulfill/return;
   see `docs/superpowers/specs/2026-07-12-resource-allocation-design.md`).
   Per-unit serialized tracking and overdue-return tracking were NOT built —
   intentional deviation, quantity-only model.
2. Bookings app (Screen 6) — still not built (planned as a separate `booking` app)
```

Also add a row to the "Apps" table under "Backend conventions":

```
| `apps.resource_allocation` | Quantity-based asset catalog + allocation/request/transfer workflow; `/api/resources/*` |
```

- [ ] **Step 7: Commit the documentation update**

```bash
git add AGENTS.md
git commit -m "docs: mark resource_allocation app as built in AGENTS.md"
```
