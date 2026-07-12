"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api/http";
import { useAsyncList } from "@/lib/hooks/useAsyncList";
import {
  listDepartments,
  listEmployees,
  updateEmployeeDepartment,
  updateEmployeeRole,
  updateEmployeeStatus,
  type Department,
  type Employee,
  type EmployeeRole,
  type OrgStatus,
} from "@/lib/api/organization";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { StatusBadge } from "./StatusBadge";

const ROLE_LABELS: Record<EmployeeRole, string> = {
  admin: "Admin",
  asset_manager: "Asset Manager",
  department_head: "Department Head",
  employee: "Employee",
};

const ROLE_TINTS: Record<EmployeeRole, string> = {
  admin: "border-accent-purple/30 bg-accent-purple/20 text-accent-purple-deep",
  asset_manager: "border-accent-sky/30 bg-accent-sky/15 text-accent-sky",
  department_head: "border-accent-teal/30 bg-accent-teal/15 text-accent-teal",
  employee: "border-border bg-muted text-ink-muted",
};

type EmployeeEditForm = {
  role: EmployeeRole;
  status: OrgStatus;
  department: number | null;
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}

export function EmployeesTab() {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | EmployeeRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | OrgStatus>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeEditForm>({
    role: "employee",
    status: "active",
    department: null,
  });
  const [saving, setSaving] = useState(false);

  const { loading, reload } = useAsyncList(
    () =>
      Promise.all([
        listEmployees({
          search: search || undefined,
          role: roleFilter === "all" ? undefined : roleFilter,
          status: statusFilter === "all" ? undefined : statusFilter,
        }),
        listDepartments({ status: "active" }),
      ]).then(([emps, depts]) => {
        setEmployees(emps);
        setDepartments(depts);
        return emps;
      }),
    [search, roleFilter, statusFilter],
  );

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({
      role: emp.role,
      status: emp.status,
      department: emp.department,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const calls: Array<Promise<Employee>> = [];
      if (form.role !== editing.role) {
        calls.push(updateEmployeeRole(editing.id, form.role));
      }
      if (form.status !== editing.status) {
        calls.push(updateEmployeeStatus(editing.id, form.status));
      }
      if (form.department !== editing.department) {
        calls.push(updateEmployeeDepartment(editing.id, form.department));
      }

      if (calls.length === 0) {
        setDialogOpen(false);
        return;
      }

      await Promise.all(calls);
      toast.success("Employee updated");
      setDialogOpen(false);
      reload();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const isSelf = (emp: Employee) => currentUser?.id === emp.id;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
        <div className="relative min-w-0 sm:col-span-2 lg:col-span-1 lg:min-w-[14rem] lg:flex-1 lg:max-w-xs">
          <Search className="text-ink-faint absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as "all" | EmployeeRole)}>
          <SelectTrigger className="w-full lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="asset_manager">Asset Manager</SelectItem>
            <SelectItem value="department_head">Department Head</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | OrgStatus)}>
          <SelectTrigger className="w-full lg:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="px-0">
          {loading ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="bg-accent-purple/20 flex size-11 items-center justify-center rounded-xl">
                <Users className="text-accent-purple-deep size-5" />
              </span>
              <p className="text-ink-secondary text-sm font-medium">No employees found</p>
              <p className="text-ink-muted text-sm">
                Employees appear here after they sign up. This is the only place you can promote roles.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2.5">
                        <span className="bg-accent-sky/20 text-ink flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                          {initials(emp.full_name)}
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <span className="text-ink truncate text-sm font-medium">
                            {emp.full_name}
                            {isSelf(emp) && (
                              <span className="text-ink-faint ml-1.5 text-xs font-normal">(you)</span>
                            )}
                          </span>
                          <span className="text-ink-muted truncate text-xs">{emp.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-ink-muted">{emp.department_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("rounded-full", ROLE_TINTS[emp.role])}>
                        {ROLE_LABELS[emp.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={emp.status} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" disabled={isSelf(emp)}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(emp)}>
                            <Pencil />
                            Edit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[min(90dvh,40rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit employee</DialogTitle>
            <DialogDescription>
              {editing && `Update role, status, or department for ${editing.full_name}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Role</label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as EmployeeRole })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as EmployeeRole[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Status</label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as OrgStatus })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Department</label>
              <Select
                value={form.department?.toString() ?? "none"}
                onValueChange={(v) =>
                  setForm({ ...form, department: v === "none" ? null : Number(v) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id.toString()}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-full">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
