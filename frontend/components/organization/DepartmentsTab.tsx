"use client";

import { useState } from "react";
import { Building2, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  createDepartment,
  deactivateDepartment,
  listDepartments,
  listEmployees,
  updateDepartment,
  type Department,
  type DepartmentInput,
  type Employee,
  type OrgStatus,
} from "@/lib/api/organization";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./ConfirmDialog";
import { StatusBadge } from "./StatusBadge";

export function DepartmentsTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrgStatus>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DepartmentInput>({
    name: "",
    code: "",
    parent: null,
    head: null,
    status: "active",
  });
  const [employees, setEmployees] = useState<Employee[]>([]);

  const { data: departments, loading } = useAsyncList(
    () =>
      Promise.all([
        listDepartments({
          search: search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
        }),
        listEmployees({ status: "active" }),
      ]).then(([depts, emps]) => {
        setEmployees(emps);
        return depts;
      }),
    [search, statusFilter],
  );

  function openCreate() {
    setEditing(null);
    setForm({ name: "", code: "", parent: null, head: null, status: "active" });
    setDialogOpen(true);
  }

  function openEdit(dept: Department) {
    setEditing(dept);
    setForm({
      name: dept.name,
      code: dept.code,
      parent: dept.parent,
      head: dept.head,
      status: dept.status,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name?.trim()) {
      toast.error("Department name is required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateDepartment(editing.id, form);
        setDepartments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        toast.success("Department updated");
      } else {
        const created = await createDepartment(form);
        setDepartments((prev) => [...prev, created]);
        toast.success("Department created");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(editing ? "Failed to update department" : "Failed to create department", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: number) {
    try {
      await deactivateDepartment(id);
      setDepartments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: "inactive" } : d)),
      );
      toast.success("Department deactivated");
    } catch (err) {
      toast.error("Failed to deactivate department", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    }
  }

  const activeDepartments = departments.filter((d) => d.status === "active");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="text-ink-faint absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search departments…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | OrgStatus)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} className="rounded-full">
          <Plus />
          Add Department
        </Button>
      </div>

      <Card>
        <CardContent className="px-0">
          {loading ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : departments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="bg-accent-sky/15 flex size-11 items-center justify-center rounded-xl">
                <Building2 className="text-accent-sky size-5" />
              </span>
              <p className="text-ink-secondary text-sm font-medium">No departments yet</p>
              <p className="text-ink-muted text-sm">Create your first department to get started.</p>
              <Button onClick={openCreate} variant="outline" className="mt-1 rounded-full">
                <Plus />
                Add Department
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Head</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="pl-4 font-medium text-ink">{dept.name}</TableCell>
                    <TableCell className="text-ink-muted">{dept.code || "—"}</TableCell>
                    <TableCell className="text-ink-muted">{dept.parent_name || "—"}</TableCell>
                    <TableCell className="text-ink-muted">{dept.head_name || "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={dept.status} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(dept)}>
                            <Pencil />
                            Edit
                          </DropdownMenuItem>
                          {dept.status === "active" && (
                            <>
                              <DropdownMenuSeparator />
                              <ConfirmDialog
                                trigger={
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={(e) => e.preventDefault()}
                                  >
                                    <Trash2 />
                                    Deactivate
                                  </DropdownMenuItem>
                                }
                                title="Deactivate department?"
                                description={`"${dept.name}" will be marked inactive. You can reactivate it later.`}
                                confirmLabel="Deactivate"
                                onConfirm={() => handleDeactivate(dept.id)}
                              />
                            </>
                          )}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit department" : "Add department"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the department details."
                : "Create a new department for your organization."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Engineering"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Code</label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. ENG"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Parent department</label>
              <Select
                value={form.parent?.toString() ?? "none"}
                onValueChange={(v) =>
                  setForm({ ...form, parent: v === "none" ? null : Number(v) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent</SelectItem>
                  {activeDepartments
                    .filter((d) => d.id !== editing?.id)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Department head</label>
              <Select
                value={form.head?.toString() ?? "none"}
                onValueChange={(v) =>
                  setForm({ ...form, head: v === "none" ? null : Number(v) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Status</label>
              <Select
                value={form.status ?? "active"}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className={cn("rounded-full")}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
