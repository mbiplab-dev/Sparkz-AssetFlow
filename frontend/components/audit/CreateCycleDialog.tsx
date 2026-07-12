"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptySelectOptions } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditAuditor, CreateAuditCycleInput } from "@/lib/api/audits";
import { listLocations, type Location } from "@/lib/api/assets";
import {
  listDepartments,
  listEmployees,
  type Department,
  type Employee,
} from "@/lib/api/organization";

export type CreateCycleFormInput = CreateAuditCycleInput;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateCycleFormInput) => void | Promise<void>;
};

export function CreateCycleDialog({ open, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState("");
  const [deptId, setDeptId] = useState<string>("none");
  const [locId, setLocId] = useState<string>("none");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [auditors, setAuditors] = useState<AuditAuditor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([
      listEmployees({ status: "active", role: "employee" }).catch(() => [] as Employee[]),
      listDepartments({ status: "active" }).catch(() => [] as Department[]),
      listLocations().catch(() => [] as Location[]),
    ])
      .then(([emps, depts, locs]) => {
        if (cancelled) return;
        setEmployees(
          (Array.isArray(emps) ? emps : []).filter((e) => e.role === "employee"),
        );
        setDepartments(Array.isArray(depts) ? depts : []);
        setLocations(Array.isArray(locs) ? locs : []);
        setLoadingOptions(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const availableAuditors = useMemo(
    () =>
      employees
        .filter((e) => !auditors.some((a) => a.id === e.id))
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [employees, auditors],
  );

  function reset() {
    setName("");
    setDeptId("none");
    setLocId("none");
    setStartsOn("");
    setEndsOn("");
    setAuditors([]);
    setError(null);
    setSubmitting(false);
    setLoadingOptions(true);
  }

  function addAuditor(id: string) {
    const person = employees.find((e) => String(e.id) === id);
    if (!person || auditors.some((a) => a.id === person.id)) return;
    setAuditors((prev) => [
      ...prev,
      { id: person.id, full_name: person.full_name || person.email },
    ]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Cycle name is required.");
      return;
    }
    if (!startsOn || !endsOn) {
      setError("Start and end dates are required.");
      return;
    }
    if (endsOn < startsOn) {
      setError("End date must be on or after start date.");
      return;
    }
    if (deptId === "none" && locId === "none") {
      setError("Scope at least one of department or location.");
      return;
    }
    if (auditors.length === 0) {
      setError("Assign at least one auditor.");
      return;
    }

    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        scope_department: deptId === "none" ? null : Number(deptId),
        scope_location: locId === "none" ? null : Number(locId),
        starts_on: startsOn,
        ends_on: endsOn,
        auditor_ids: auditors.map((a) => a.id),
      });
      reset();
      onOpenChange(false);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[min(90dvh,40rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold tracking-tight">
            Create audit cycle
          </DialogTitle>
          <DialogDescription className="text-ink-muted">
            Scope department and/or location, set dates, and assign employees as auditors.
            Creating the cycle snapshots every in-scope asset as a pending verification item
            (status = open).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel htmlFor="cycle-name">Name</FieldLabel>
              <Input
                id="cycle-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Q3 inventory — HQ East"
                className="rounded-xs"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Department</FieldLabel>
                <Select value={deptId} onValueChange={setDeptId}>
                  <SelectTrigger className="w-full rounded-xs">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {loadingOptions ? (
                      <div className="px-3 py-2">
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ) : departments.length === 0 ? (
                      <EmptySelectOptions
                        title="No departments found"
                        description="Create departments in Organization setup."
                        actionHref="/organization"
                        actionLabel="Create a department →"
                      />
                    ) : (
                      departments.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Location</FieldLabel>
                <Select value={locId} onValueChange={setLocId}>
                  <SelectTrigger className="w-full rounded-xs">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {loadingOptions ? (
                      <div className="px-3 py-2">
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ) : locations.length === 0 ? (
                      <EmptySelectOptions
                        title="No locations found"
                        description="Locations are optional if a department is scoped."
                      />
                    ) : (
                      locations.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          {l.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="starts-on">Starts on</FieldLabel>
                <Input
                  id="starts-on"
                  type="date"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                  className="rounded-xs"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ends-on">Ends on</FieldLabel>
                <Input
                  id="ends-on"
                  type="date"
                  value={endsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                  className="rounded-xs"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Auditors</FieldLabel>
              <FieldDescription>
                Only users with role <span className="font-medium">employee</span> can be auditors.
              </FieldDescription>
              <div className="flex flex-wrap gap-1.5">
                {auditors.map((a) => (
                  <span
                    key={a.id}
                    className="border-border bg-muted text-ink inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                  >
                    {a.full_name}
                    <button
                      type="button"
                      className="text-ink-muted hover:text-ink"
                      onClick={() => setAuditors((prev) => prev.filter((x) => x.id !== a.id))}
                      aria-label={`Remove ${a.full_name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
              <Select
                value=""
                onValueChange={(v) => {
                  if (v) addAuditor(v);
                }}
              >
                <SelectTrigger className="mt-2 w-full rounded-xs">
                  <SelectValue
                    placeholder={
                      loadingOptions
                        ? "Loading employees…"
                        : availableAuditors.length === 0
                          ? employees.length === 0
                            ? "No employees available"
                            : "All employees already added"
                          : "Add auditor…"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {loadingOptions ? (
                    <div className="space-y-2 px-3 py-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : availableAuditors.length === 0 ? (
                    <EmptySelectOptions
                      title={
                        employees.length === 0
                          ? "No employees found"
                          : "All employees already assigned"
                      }
                      description={
                        employees.length === 0
                          ? "Employees appear after people sign up."
                          : "Every active employee is already on this cycle."
                      }
                    />
                  ) : (
                    availableAuditors.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        <span className="font-medium">{e.full_name}</span>
                        <span className="text-ink-faint ml-2 text-xs">
                          {e.email}
                          {e.department_name ? ` · ${e.department_name}` : ""}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-md"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-full" disabled={submitting || loadingOptions}>
              {submitting ? "Creating…" : "Create cycle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
