"""CSV export endpoints for the dashboard.

One `APIView` per core resource — each streams a CSV via Python's stdlib
`csv.writer` on a Django `HttpResponse` (`text/csv`). Columns are the useful
public fields plus human-friendly joined labels (e.g. category_name,
department_name, holder_name).
"""

from __future__ import annotations

import csv
from datetime import date

from django.apps import apps as django_apps
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework.views import APIView

from apps.activity.permissions import CanExportData


def _csv_response(filename_stem: str) -> tuple[HttpResponse, csv._writer]:
    """Create an HttpResponse pre-configured for a CSV attachment + a writer."""
    filename = f"assetflow-{filename_stem}-{date.today().isoformat()}.csv"
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response, csv.writer(response)


def _model(app_label: str, model_name: str):
    try:
        return django_apps.get_model(app_label, model_name)
    except LookupError:
        return None


def _fmt_dt(value) -> str:
    return value.isoformat() if value else ""


def _fmt(value) -> str:
    if value is None:
        return ""
    return str(value)


class ExportDepartmentsView(APIView):
    permission_classes = [CanExportData]

    @extend_schema(
        tags=["Dashboard / Exports"],
        summary="Download CSV of departments",
    )
    def get(self, request):
        response, writer = _csv_response("departments")
        writer.writerow(
            [
                "id",
                "name",
                "code",
                "parent_name",
                "head_name",
                "status",
                "created_at",
                "updated_at",
            ]
        )
        Department = _model("organization", "Department")
        if Department is None:
            return response
        qs = Department.objects.select_related("parent", "head").order_by("name")
        for d in qs:
            writer.writerow(
                [
                    d.id,
                    d.name,
                    d.code,
                    d.parent.name if d.parent_id else "",
                    (getattr(d.head, "full_name", "") or getattr(d.head, "email", ""))
                    if d.head_id
                    else "",
                    d.status,
                    _fmt_dt(d.created_at),
                    _fmt_dt(d.updated_at),
                ]
            )
        return response


class ExportCategoriesView(APIView):
    permission_classes = [CanExportData]

    @extend_schema(
        tags=["Dashboard / Exports"],
        summary="Download CSV of asset categories",
    )
    def get(self, request):
        response, writer = _csv_response("categories")
        writer.writerow(["id", "name", "description", "status", "created_at"])
        AssetCategory = _model("organization", "AssetCategory")
        if AssetCategory is None:
            return response
        for c in AssetCategory.objects.order_by("name"):
            writer.writerow(
                [
                    c.id,
                    c.name,
                    c.description,
                    c.status,
                    _fmt_dt(c.created_at),
                ]
            )
        return response


class ExportEmployeesView(APIView):
    permission_classes = [CanExportData]

    @extend_schema(
        tags=["Dashboard / Exports"],
        summary="Download CSV of employees",
    )
    def get(self, request):
        response, writer = _csv_response("employees")
        writer.writerow(
            [
                "id",
                "full_name",
                "email",
                "phone",
                "role",
                "status",
                "department_name",
                "date_joined",
            ]
        )
        User = _model("authentication", "User")
        if User is None:
            return response
        qs = User.objects.select_related("department").order_by("full_name")
        for u in qs:
            writer.writerow(
                [
                    u.id,
                    u.full_name,
                    u.email,
                    u.phone,
                    u.role,
                    u.status,
                    u.department.name if u.department_id else "",
                    _fmt_dt(u.date_joined),
                ]
            )
        return response


class ExportAssetsView(APIView):
    permission_classes = [CanExportData]

    @extend_schema(
        tags=["Dashboard / Exports"],
        summary="Download CSV of assets",
    )
    def get(self, request):
        response, writer = _csv_response("assets")
        writer.writerow(
            [
                "id",
                "asset_tag",
                "name",
                "category_name",
                "serial_number",
                "status",
                "condition",
                "location_name",
                "department_name",
                "is_bookable",
                "acquisition_date",
                "acquisition_cost",
                "created_at",
            ]
        )
        Asset = _model("assets", "Asset")
        if Asset is None:
            return response
        qs = Asset.objects.select_related("category", "location", "department").order_by(
            "asset_tag"
        )
        for a in qs:
            writer.writerow(
                [
                    a.id,
                    a.asset_tag,
                    a.name,
                    a.category.name if a.category_id else "",
                    a.serial_number,
                    a.status,
                    a.condition,
                    a.location.name if a.location_id else "",
                    a.department.name if a.department_id else "",
                    "true" if a.is_bookable else "false",
                    _fmt(a.acquisition_date),
                    _fmt(a.acquisition_cost),
                    _fmt_dt(a.created_at),
                ]
            )
        return response


def _holder_name(holder_type: str, holder_id: int, dept_map: dict, user_map: dict) -> str:
    if holder_type == "manager":
        return "Manager Pool"
    if holder_type == "department":
        return dept_map.get(holder_id, f"Department #{holder_id}")
    if holder_type == "employee":
        u = user_map.get(holder_id)
        if u is None:
            return f"Employee #{holder_id}"
        return u.get("full_name") or u.get("email") or f"Employee #{holder_id}"
    return f"{holder_type}:{holder_id}"


class ExportHoldingsView(APIView):
    permission_classes = [CanExportData]

    @extend_schema(
        tags=["Dashboard / Exports"],
        summary="Download CSV of active holdings (non-manager)",
    )
    def get(self, request):
        response, writer = _csv_response("holdings")
        writer.writerow(
            [
                "id",
                "asset_id",
                "asset_name",
                "holder_type",
                "holder_id",
                "holder_name",
                "quantity",
            ]
        )
        Holding = _model("resource_allocation", "Holding")
        if Holding is None:
            return response

        qs = (
            Holding.objects.select_related("asset")
            .exclude(holder_type="manager")
            .filter(quantity__gt=0)
            .order_by("asset__name")
        )

        Department = _model("organization", "Department")
        User = _model("authentication", "User")
        dept_map = {d.id: d.name for d in Department.objects.all()} if Department else {}
        user_map = (
            {u.id: {"full_name": u.full_name, "email": u.email} for u in User.objects.all()}
            if User
            else {}
        )

        for h in qs:
            writer.writerow(
                [
                    h.id,
                    h.asset_id,
                    h.asset.name if h.asset_id else "",
                    h.holder_type,
                    h.holder_id,
                    _holder_name(h.holder_type, h.holder_id, dept_map, user_map),
                    h.quantity,
                ]
            )
        return response


class ExportBookingsView(APIView):
    permission_classes = [CanExportData]

    @extend_schema(
        tags=["Dashboard / Exports"],
        summary="Download CSV of bookings",
    )
    def get(self, request):
        response, writer = _csv_response("bookings")
        writer.writerow(
            [
                "id",
                "asset_id",
                "asset_tag",
                "asset_name",
                "booked_by_name",
                "department_name",
                "starts_at",
                "ends_at",
                "status",
                "purpose",
                "cancelled_at",
                "cancelled_by_name",
                "created_at",
            ]
        )
        Booking = _model("booking", "Booking")
        if Booking is None:
            return response
        qs = Booking.objects.select_related(
            "asset", "booked_by", "department", "cancelled_by"
        ).order_by("-starts_at")
        for b in qs:
            writer.writerow(
                [
                    b.id,
                    b.asset_id,
                    getattr(b.asset, "asset_tag", "") if b.asset_id else "",
                    getattr(b.asset, "name", "") if b.asset_id else "",
                    (getattr(b.booked_by, "full_name", "") or getattr(b.booked_by, "email", ""))
                    if b.booked_by_id
                    else "",
                    b.department.name if b.department_id else "",
                    _fmt_dt(b.starts_at),
                    _fmt_dt(b.ends_at),
                    b.status,
                    b.purpose,
                    _fmt_dt(b.cancelled_at),
                    (
                        getattr(b.cancelled_by, "full_name", "")
                        or getattr(b.cancelled_by, "email", "")
                    )
                    if b.cancelled_by_id
                    else "",
                    _fmt_dt(b.created_at),
                ]
            )
        return response


class ExportMaintenanceView(APIView):
    permission_classes = [CanExportData]

    @extend_schema(
        tags=["Dashboard / Exports"],
        summary="Download CSV of maintenance requests",
    )
    def get(self, request):
        response, writer = _csv_response("maintenance")
        writer.writerow(
            [
                "id",
                "asset_id",
                "asset_tag",
                "asset_name",
                "raised_by_name",
                "priority",
                "status",
                "issue_description",
                "approved_by_name",
                "approved_at",
                "technician_name",
                "assigned_at",
                "started_at",
                "resolved_at",
                "resolution_notes",
                "estimated_cost",
                "actual_cost",
                "created_at",
            ]
        )
        MaintenanceRequest = _model("maintenance", "MaintenanceRequest")
        if MaintenanceRequest is None:
            return response
        qs = MaintenanceRequest.objects.select_related(
            "asset", "raised_by", "approved_by", "technician"
        ).order_by("-created_at")
        for m in qs:
            writer.writerow(
                [
                    m.id,
                    m.asset_id,
                    getattr(m.asset, "asset_tag", "") if m.asset_id else "",
                    getattr(m.asset, "name", "") if m.asset_id else "",
                    (getattr(m.raised_by, "full_name", "") or getattr(m.raised_by, "email", ""))
                    if m.raised_by_id
                    else "",
                    m.priority,
                    m.status,
                    m.issue_description,
                    (getattr(m.approved_by, "full_name", "") or getattr(m.approved_by, "email", ""))
                    if m.approved_by_id
                    else "",
                    _fmt_dt(m.approved_at),
                    (getattr(m.technician, "full_name", "") or getattr(m.technician, "email", ""))
                    if m.technician_id
                    else "",
                    _fmt_dt(m.assigned_at),
                    _fmt_dt(m.started_at),
                    _fmt_dt(m.resolved_at),
                    m.resolution_notes,
                    _fmt(m.estimated_cost),
                    _fmt(m.actual_cost),
                    _fmt_dt(m.created_at),
                ]
            )
        return response
