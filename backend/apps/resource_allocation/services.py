from django.db import transaction
from django.db.models import F

from .models import MANAGER_HOLDER_ID, Asset, HolderType, Holding, Transfer, TransferKind


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
