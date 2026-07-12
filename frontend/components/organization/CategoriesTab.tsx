"use client";

import { useState } from "react";
import { Download, LayoutGrid, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { downloadCsv } from "@/lib/api/exports";
import { ApiError } from "@/lib/api/http";
import { useAsyncList } from "@/lib/hooks/useAsyncList";
import {
  createCategory,
  deactivateCategory,
  listCategories,
  updateCategory,
  type AssetCategory,
  type CategoryInput,
  type OrgStatus,
} from "@/lib/api/organization";
import { ConfirmDialog } from "./ConfirmDialog";
import { StatusBadge } from "./StatusBadge";

export function CategoriesTab() {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrgStatus>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AssetCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CategoryInput>({ name: "", description: "", status: "active" });

  const { loading } = useAsyncList(
    () =>
      listCategories({
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
      }).then((data) => {
        setCategories(data);
        return data;
      }),
    [search, statusFilter],
  );

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", status: "active" });
    setDialogOpen(true);
  }

  function openEdit(cat: AssetCategory) {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description, status: cat.status });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name?.trim()) {
      toast.error("Category name is required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateCategory(editing.id, form);
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        toast.success("Category updated");
      } else {
        const created = await createCategory(form);
        setCategories((prev) => [...prev, created]);
        toast.success("Category created");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(editing ? "Failed to update category" : "Failed to create category", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: number) {
    try {
      await deactivateCategory(id);
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, status: "inactive" } : c)));
      toast.success("Category deactivated");
    } catch (err) {
      toast.error("Failed to deactivate category", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-1 sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 sm:min-w-[14rem] sm:flex-1 sm:max-w-xs">
            <Search className="text-ink-faint absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search categories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | OrgStatus)}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv("categories")}
            className="w-full sm:w-auto"
          >
            <Download />
            Export CSV
          </Button>
          <Button onClick={openCreate} className="w-full shrink-0 rounded-full sm:w-auto">
            <Plus />
            Add Category
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          {loading ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="bg-accent-teal/15 flex size-11 items-center justify-center rounded-xl">
                <LayoutGrid className="text-accent-teal size-5" />
              </span>
              <p className="text-ink-secondary text-sm font-medium">No categories yet</p>
              <p className="text-ink-muted text-sm">Create categories like Electronics, Furniture, or Vehicles.</p>
              <Button onClick={openCreate} variant="outline" className="mt-1 rounded-full">
                <Plus />
                Add Category
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="pl-4 font-medium text-ink">{cat.name}</TableCell>
                    <TableCell className="text-ink-muted max-w-xs truncate">
                      {cat.description || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={cat.status} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(cat)}>
                            <Pencil />
                            Edit
                          </DropdownMenuItem>
                          {cat.status === "active" && (
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
                                title="Deactivate category?"
                                description={`"${cat.name}" will be marked inactive. Existing assets keep their category.`}
                                confirmLabel="Deactivate"
                                onConfirm={() => handleDeactivate(cat.id)}
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
        <DialogContent className="max-h-[min(90dvh,40rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the category details." : "Create a new asset category."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Electronics"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink-secondary text-sm font-medium">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
              />
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
            <Button onClick={handleSave} disabled={saving} className="rounded-full">
              {saving ? "Saving…" : editing ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
