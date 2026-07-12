from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.authentication.models import UserRole

from .models import Booking, BookingStatus
from .permissions import BookingPermission
from .serializers import (
    BookingCancelSerializer,
    BookingCreateSerializer,
    BookingSerializer,
)


def _is_privileged(user) -> bool:
    return getattr(user, "role", None) in (UserRole.ADMIN, UserRole.ASSET_MANAGER)


@extend_schema_view(
    list=extend_schema(
        tags=["Booking"],
        summary="List bookings visible to the current user",
        parameters=[
            OpenApiParameter("asset", str, description="Filter by asset id"),
            OpenApiParameter(
                "starts_after",
                str,
                description="ISO datetime — only bookings ending after this",
            ),
            OpenApiParameter(
                "ends_before",
                str,
                description="ISO datetime — only bookings starting before this",
            ),
        ],
    ),
    retrieve=extend_schema(tags=["Booking"], summary="Get a booking"),
    create=extend_schema(
        tags=["Booking"],
        summary="Create a new booking",
        request=BookingCreateSerializer,
        responses=BookingSerializer,
    ),
    destroy=extend_schema(
        tags=["Booking"],
        summary="Cancel a booking (soft delete)",
        description="Sets status='cancelled' and records cancelled_by/cancelled_at.",
    ),
)
class BookingViewSet(viewsets.ModelViewSet):
    """
    Time-slot bookings for shared assets.

    - Non-admin users see: bookings they created OR bookings for any asset
      whose current holding is their department. asset_manager/admin see all.
    - Overlap protection is enforced at the DB layer by the GiST EXCLUDE
      constraint; the view catches the ``IntegrityError`` and returns 400.
    """

    queryset = Booking.objects.select_related(
        "asset", "asset__category", "booked_by", "department"
    )
    serializer_class = BookingSerializer
    permission_classes = [BookingPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        params = self.request.query_params

        # Role-scoped visibility. Privileged roles see everything; everyone
        # else sees their own bookings plus any booking in their department.
        if not _is_privileged(user):
            dept_id = getattr(user, "department_id", None)
            visibility = Q(booked_by=user)
            if dept_id:
                visibility |= Q(department_id=dept_id)
            qs = qs.filter(visibility)

        asset = params.get("asset")
        starts_after = params.get("starts_after")
        ends_before = params.get("ends_before")

        if asset:
            qs = qs.filter(asset_id=asset)
        if starts_after:
            qs = qs.filter(ends_at__gt=starts_after)
        if ends_before:
            qs = qs.filter(starts_at__lt=ends_before)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            with transaction.atomic():
                booking = Booking.objects.create(
                    asset=data["asset"],
                    booked_by=request.user,
                    department=data.get("department"),
                    starts_at=data["starts_at"],
                    ends_at=data["ends_at"],
                    purpose=data.get("purpose", ""),
                    status=BookingStatus.UPCOMING,
                )
        except IntegrityError as exc:
            # Both the CHECK (ends > starts) and the GiST EXCLUDE overlap
            # constraint surface as IntegrityError. Distinguish by message
            # so the client sees a helpful error.
            message = str(exc).lower()
            if "overlap" in message or "bookings_no_overlap" in message:
                raise ValidationError(
                    {
                        "non_field_errors": [
                            "This time slot overlaps an existing booking for the asset."
                        ]
                    }
                )
            raise ValidationError({"non_field_errors": [str(exc)]})

        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        """Cancel a booking instead of hard-deleting it."""
        booking = self.get_object()
        if booking.status == BookingStatus.CANCELLED:
            return Response(BookingSerializer(booking).data)
        booking.status = BookingStatus.CANCELLED
        booking.cancelled_at = timezone.now()
        booking.cancelled_by = request.user
        booking.save(update_fields=["status", "cancelled_at", "cancelled_by"])
        return Response(BookingSerializer(booking).data)

    @extend_schema(
        tags=["Booking"],
        summary="Cancel a booking (explicit action)",
        request=BookingCancelSerializer,
        responses=BookingSerializer,
    )
    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        return self.destroy(request)
