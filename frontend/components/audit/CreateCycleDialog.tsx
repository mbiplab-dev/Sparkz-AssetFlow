"use client";

import { useState } from "react";
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
import type { AuditAuditor, CreateAuditCycleInput } from "@/lib/api/audits";

/** Demo org directory until create form loads real /api/org pickers. */
const DEPTS = [
  { id: "dept-eng", name: "Engineering" },
  { id: "dept-ops", name: "Operations" },
  { id: "dept-fac", name: "Facilities" },
  { id: "dept-fin", name: "Finance" },
];

const LOCS = [
  { id: "loc-east-3", name: "HQ East · Floor 3" },
  { id: "loc-west", name: "HQ West" },
  { id: "loc-yard-a", name: "Fleet Yard A" },
  { id: "loc-wh-b", name: "Warehouse B" },
];

const AUDITOR_POOL = [
  { id: "user-priya", full_name: "Priya Shah" },
  { id: "user-jordan", full_name: "Jordan Lee" },
  { id: "user-sam", full_name: "Sam Ortiz" },
  { id: "user-morgan", full_name: "Morgan Blake" },
];

/** Same shape as CreateAuditCycleInput — form → API. */
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

  function reset() {
    setName("");
    setDeptId("none");
    setLocId("none");
    setStartsOn("");
    setEndsOn("");
    setAuditors([]);
    setError(null);
    setSubmitting(false);
  }

  function addAuditor(id: string) {
    const person = AUDITOR_POOL.find((a) => a.id === id);
    if (!person || auditors.some((a) => a.id === id)) return;
    setAuditors((prev) => [...prev, person]);
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

    const dept = DEPTS.find((d) => d.id === deptId);
    const loc = LOCS.find((l) => l.id === locId);

    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        scope_dept_id: dept?.id ?? null,
        scope_dept_name: dept?.name ?? null,
        scope_loc_id: loc?.id ?? null,
        scope_loc_name: loc?.name ?? null,
        starts_on: startsOn,
        ends_on: endsOn,
        auditors,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold tracking-tight">
            Create audit cycle
          </DialogTitle>
          <DialogDescription className="text-ink-muted">
            Scope department and/or location, set the date range, assign auditors. Status starts as
            draft.
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
                  <SelectTrigger className="rounded-xs">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {DEPTS.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Location</FieldLabel>
                <Select value={locId} onValueChange={setLocId}>
                  <SelectTrigger className="rounded-xs">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {LOCS.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
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
              <FieldDescription>One or more auditors per cycle.</FieldDescription>
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
              <Select onValueChange={(v) => addAuditor(v)}>
                <SelectTrigger className="mt-2 rounded-xs">
                  <SelectValue placeholder="Add auditor…" />
                </SelectTrigger>
                <SelectContent>
                  {AUDITOR_POOL.filter((a) => !auditors.some((x) => x.id === a.id)).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name}
                    </SelectItem>
                  ))}
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
            <Button type="submit" className="rounded-full" disabled={submitting}>
              {submitting ? "Creating…" : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
