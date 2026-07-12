from django.db import transaction
from django.db.models import F

from .models import (
    MANAGER_HOLDER_ID,
    AllocationRequest,
    Asset,
    HolderType,
    Holding,
    RequestStatus,
    Transfer,
    TransferKind,
)


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
    *,
    asset,
    from_holder_type,
    from_holder_id,
    to_holder_type,
    to_holder_id,
    quantity,
    performed_by,
    kind,
    request=None,
    notes="",
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
        from_holder_type=from_holder_type,
        from_holder_id=from_holder_id,
        to_holder_type=to_holder_type,
        to_holder_id=to_holder_id,
        quantity=quantity,
        kind=kind,
        request=request,
        performed_by=performed_by,
        notes=notes,
    )


@transaction.atomic
def register_asset(*, name, category, total_quantity, condition, location, is_bookable, created_by):
    """Create an Asset and its initial fully-unallocated manager Holding."""
    if total_quantity < 0:
        raise ValueError("total_quantity must be >= 0")
    asset = Asset.objects.create(
        name=name,
        category=category,
        total_quantity=total_quantity,
        condition=condition,
        location=location,
        is_bookable=is_bookable,
        created_by=created_by,
    )
    Holding.objects.create(
        asset=asset,
        holder_type=HolderType.MANAGER,
        holder_id=MANAGER_HOLDER_ID,
        quantity=total_quantity,
    )
    return asset


def sync_catalog_into_resource_pool(*, performed_by) -> int:
    """Ensure every main-catalog asset (`apps.assets.Asset`) is allocatable.

    The allocate modal uses the resource_allocation quantity catalog. The
    registration screen writes to `apps.assets`. This mirrors missing catalog
    rows into the resource pool (1 unit each for unique physical assets) so
    asset managers always see the full set when allocating.

    Returns the number of newly registered resource assets.
    """
    from apps.assets.models import Asset as CatalogAsset

    existing = set(Asset.objects.values_list("name", flat=True))
    created = 0
    for ca in CatalogAsset.objects.select_related("category").order_by("asset_tag"):
        # Prefer tag-qualified name so duplicates in the catalog stay unique.
        preferred = f"{ca.name} ({ca.asset_tag})"
        if preferred in existing or ca.name in existing:
            continue
        register_asset(
            name=preferred,
            category=ca.category,
            total_quantity=1,
            condition=ca.get_condition_display() if hasattr(ca, "get_condition_display") else "",
            location=ca.location.name if ca.location_id else "",
            is_bookable=bool(ca.is_bookable),
            created_by=performed_by,
        )
        existing.add(preferred)
        created += 1
    return created


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


def allocate(*, asset, to_holder_type, to_holder_id, quantity, performed_by):
    """Asset Manager discretionary push from the unallocated manager pool. No approval check."""
    return move_quantity(
        asset=asset,
        from_holder_type=HolderType.MANAGER,
        from_holder_id=MANAGER_HOLDER_ID,
        to_holder_type=to_holder_type,
        to_holder_id=to_holder_id,
        quantity=quantity,
        performed_by=performed_by,
        kind=TransferKind.ALLOCATE,
    )


def return_quantity(*, asset, from_holder_type, from_holder_id, quantity, performed_by):
    """Return held quantity back to the unallocated manager pool."""
    return move_quantity(
        asset=asset,
        from_holder_type=from_holder_type,
        from_holder_id=from_holder_id,
        to_holder_type=HolderType.MANAGER,
        to_holder_id=MANAGER_HOLDER_ID,
        quantity=quantity,
        performed_by=performed_by,
        kind=TransferKind.RETURN,
    )


def sub_allocate(*, asset, department, employee, quantity, performed_by):
    """Department Head pushes quantity they hold to one of their own employees."""
    if employee.department_id != department.id:
        raise InvalidHolderError("Employee does not belong to this department.")
    return move_quantity(
        asset=asset,
        from_holder_type=HolderType.DEPARTMENT,
        from_holder_id=department.id,
        to_holder_type=HolderType.EMPLOYEE,
        to_holder_id=employee.id,
        quantity=quantity,
        performed_by=performed_by,
        kind=TransferKind.SUB_ALLOCATE,
    )


def create_request(*, asset, requested_by, for_holder_type, for_holder_id, quantity_requested):
    """Raise demand for `quantity_requested` units of `asset`."""
    if quantity_requested <= 0:
        raise ValueError("quantity_requested must be positive")
    return AllocationRequest.objects.create(
        asset=asset,
        requested_by=requested_by,
        for_holder_type=for_holder_type,
        for_holder_id=for_holder_id,
        quantity_requested=quantity_requested,
    )


def spare_quantity(*, asset, department_id):
    """Department's current holding: quantity it has not already sub-allocated to an employee.

    `sub_allocate` moves quantity out of the department's own Holding row and into the
    employee's, so the department's live Holding.quantity is already net of everything it
    has sub-allocated -- it does not need to be subtracted again here.
    """
    dept_holding = Holding.objects.filter(
        asset=asset, holder_type=HolderType.DEPARTMENT, holder_id=department_id
    ).first()
    return dept_holding.quantity if dept_holding else 0


@transaction.atomic
def fulfill_request(*, request, from_holder_type, from_holder_id, quantity, performed_by):
    """
    Fulfill (fully or partially) an AllocationRequest from a given source holder.
    from_holder_type=MANAGER -> Asset Manager fulfilling from the unallocated pool.
    from_holder_type=DEPARTMENT -> a peer Department Head fulfilling from their own spare quantity.
    """
    locked_request = AllocationRequest.objects.select_for_update().get(pk=request.pk)
    if locked_request.status in (
        RequestStatus.FULFILLED,
        RequestStatus.REJECTED,
        RequestStatus.CANCELLED,
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
        from_holder_type=from_holder_type,
        from_holder_id=from_holder_id,
        to_holder_type=locked_request.for_holder_type,
        to_holder_id=locked_request.for_holder_id,
        quantity=quantity,
        performed_by=performed_by,
        kind=kind,
        request=locked_request,
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
        RequestStatus.FULFILLED,
        RequestStatus.REJECTED,
        RequestStatus.CANCELLED,
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
        RequestStatus.FULFILLED,
        RequestStatus.REJECTED,
        RequestStatus.CANCELLED,
    ):
        raise ValueError(f"Request is already {locked_request.status}.")
    locked_request.status = RequestStatus.CANCELLED
    locked_request.save(update_fields=["status"])
    return locked_request


def open_requests_for_peer_fulfillment(*, asset):
    """Requests still needing quantity, for departments holding spare units to see and act on."""
    return AllocationRequest.objects.filter(
        asset=asset,
        status__in=(RequestStatus.OPEN, RequestStatus.PARTIALLY_FULFILLED),
    ).order_by("created_at")
