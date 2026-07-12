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
            models.CheckConstraint(check=models.Q(quantity__gte=0), name="holding_quantity_gte_0"),
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

    def __str__(self):
        return f"Request({self.asset_id}, {self.quantity_requested}, {self.status})"

    @property
    def remaining(self):
        return self.quantity_requested - self.quantity_fulfilled


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
        AllocationRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
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
