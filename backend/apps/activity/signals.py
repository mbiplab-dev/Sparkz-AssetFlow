"""Domain signals that write ActivityLog rows.

Hooks:
- User role changes (pre_save → post_save comparison)
- Transfer (allocation ledger) creation
- Booking create / status change / cancel
- MaintenanceRequest status transitions
"""

from __future__ import annotations

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.authentication.models import User

from .services import log_activity

# Track previous role values for users about to be saved.
_user_role_cache: dict[int, str] = {}


@receiver(pre_save, sender=User)
def cache_user_role(sender, instance: User, **kwargs):
    if not instance.pk:
        return
    try:
        previous = User.objects.only("role").get(pk=instance.pk)
        _user_role_cache[instance.pk] = previous.role
    except User.DoesNotExist:
        pass


@receiver(post_save, sender=User)
def log_user_role_change(sender, instance: User, created: bool, **kwargs):
    if created:
        log_activity(
            action="user.create",
            message=f"User {instance.full_name or instance.email} created as {instance.role}",
            actor=None,
            entity_type="user",
            entity_id=instance.pk,
            after_data={"role": instance.role, "email": instance.email},
        )
        return

    previous_role = _user_role_cache.pop(instance.pk, None)
    if previous_role is not None and previous_role != instance.role:
        log_activity(
            action="user.role_change",
            message=(
                f"Role of {instance.full_name or instance.email} "
                f"changed from {previous_role} to {instance.role}"
            ),
            actor=None,  # request user not available in signal; views may also log explicitly
            entity_type="user",
            entity_id=instance.pk,
            before_data={"role": previous_role},
            after_data={"role": instance.role},
        )


def _safe_connect():
    """Connect signals for domain models that may not be loaded yet."""
    try:
        from apps.resource_allocation.models import Transfer

        @receiver(post_save, sender=Transfer, weak=False)
        def log_transfer(sender, instance, created, **kwargs):
            if not created:
                return
            log_activity(
                action=f"allocation.{instance.kind}",
                message=(
                    f"Transfer {instance.kind}: {instance.quantity}× asset#{instance.asset_id} "
                    f"{instance.from_holder_type}:{instance.from_holder_id} → "
                    f"{instance.to_holder_type}:{instance.to_holder_id}"
                ),
                actor=instance.performed_by,
                entity_type="transfer",
                entity_id=instance.pk,
                after_data={
                    "kind": instance.kind,
                    "asset_id": instance.asset_id,
                    "quantity": instance.quantity,
                    "from": f"{instance.from_holder_type}:{instance.from_holder_id}",
                    "to": f"{instance.to_holder_type}:{instance.to_holder_id}",
                },
            )

    except Exception:
        pass

    try:
        from apps.booking.models import Booking

        _booking_status_cache: dict[int, str] = {}

        @receiver(pre_save, sender=Booking, weak=False)
        def cache_booking_status(sender, instance, **kwargs):
            if not instance.pk:
                return
            try:
                prev = Booking.objects.only("status").get(pk=instance.pk)
                _booking_status_cache[instance.pk] = prev.status
            except Booking.DoesNotExist:
                pass

        @receiver(post_save, sender=Booking, weak=False)
        def log_booking(sender, instance, created, **kwargs):
            if created:
                log_activity(
                    action="booking.create",
                    message=(
                        f"Booking created for asset#{instance.asset_id} "
                        f"by {getattr(instance.booked_by, 'email', '?')} "
                        f"({instance.starts_at} → {instance.ends_at})"
                    ),
                    actor=instance.booked_by,
                    entity_type="booking",
                    entity_id=instance.pk,
                    after_data={
                        "status": instance.status,
                        "asset_id": instance.asset_id,
                        "starts_at": str(instance.starts_at),
                        "ends_at": str(instance.ends_at),
                    },
                )
                return

            prev = _booking_status_cache.pop(instance.pk, None)
            if prev is not None and prev != instance.status:
                log_activity(
                    action="booking.status_change",
                    message=(
                        f"Booking #{instance.pk} status {prev} → {instance.status} "
                        f"(asset#{instance.asset_id})"
                    ),
                    actor=instance.cancelled_by or instance.booked_by,
                    entity_type="booking",
                    entity_id=instance.pk,
                    before_data={"status": prev},
                    after_data={"status": instance.status},
                )

    except Exception:
        pass

    try:
        from apps.maintenance.models import MaintenanceRequest

        _maint_status_cache: dict[int, str] = {}

        @receiver(pre_save, sender=MaintenanceRequest, weak=False)
        def cache_maint_status(sender, instance, **kwargs):
            if not instance.pk:
                return
            try:
                prev = MaintenanceRequest.objects.only("status").get(pk=instance.pk)
                _maint_status_cache[instance.pk] = prev.status
            except MaintenanceRequest.DoesNotExist:
                pass

        @receiver(post_save, sender=MaintenanceRequest, weak=False)
        def log_maintenance(sender, instance, created, **kwargs):
            if created:
                log_activity(
                    action="maintenance.create",
                    message=(
                        f"Maintenance request raised for asset#{instance.asset_id} "
                        f"({instance.priority})"
                    ),
                    actor=instance.raised_by,
                    entity_type="maintenance_request",
                    entity_id=instance.pk,
                    after_data={
                        "status": instance.status,
                        "priority": instance.priority,
                        "asset_id": instance.asset_id,
                    },
                )
                return

            prev = _maint_status_cache.pop(instance.pk, None)
            if prev is not None and prev != instance.status:
                log_activity(
                    action="maintenance.status_change",
                    message=(
                        f"Maintenance #{instance.pk} status {prev} → {instance.status} "
                        f"(asset#{instance.asset_id})"
                    ),
                    actor=instance.approved_by or instance.technician or instance.raised_by,
                    entity_type="maintenance_request",
                    entity_id=instance.pk,
                    before_data={"status": prev},
                    after_data={"status": instance.status},
                )

    except Exception:
        pass


_safe_connect()
