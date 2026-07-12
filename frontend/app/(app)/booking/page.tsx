"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addWeeks,
  differenceInMinutes,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
} from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight, MapPin, Plus, Tag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/auth/permissions";
import { listAssets, type Asset } from "@/lib/api/assets";
import {
  cancelBooking,
  createBooking,
  listBookings,
  type Booking,
} from "@/lib/api/booking";
import { ExportButton } from "@/components/ExportButton";
import { useAsyncList } from "@/lib/hooks/useAsyncList";

const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i); // 8..20
const ROW_H = 56;

function weekLabel(start: Date): string {
  const end = addDays(start, 6);
  return `${format(start, "d LLL yyyy")} – ${format(end, "d LLL yyyy")}`;
}

export default function BookingPage() {
  const canBook = useCan("bookings.create");

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 }),
  );
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);

  const { data: assets, loading: assetsLoading } = useAsyncList<Asset[]>(
    () => listAssets({ is_bookable: "true" }),
    [],
  );

  const selected = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) ?? assets[0] ?? null,
    [assets, selectedAssetId],
  );

  const startsAfter = weekStart.toISOString();
  const endsBefore = addDays(weekStart, 7).toISOString();

  const {
    data: bookings,
    loading: bookingsLoading,
    reload,
  } = useAsyncList<Booking[]>(
    () =>
      selected
        ? listBookings({
            asset: selected.id,
            starts_after: startsAfter,
            ends_before: endsBefore,
          })
        : Promise.resolve([]),
    [selected?.id, startsAfter, endsBefore],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [createSeed, setCreateSeed] = useState<{ day: Date; hour: number } | null>(null);
  const [detailFor, setDetailFor] = useState<Booking | null>(null);

  function openCreateForSlot(day: Date, hour: number) {
    if (!canBook || !selected) return;
    setCreateSeed({ day, hour });
    setCreateOpen(true);
  }

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
              <CalendarClock className="text-primary size-4" />
            </span>
            <h2 className="font-display text-ink text-2xl font-bold tracking-tight">
              Resource Booking
            </h2>
          </div>
          <p className="text-ink-muted text-sm">
            Reserve rooms, vehicles, and equipment with overlap-protected time slots.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton resource="bookings" />
          {canBook ? (
            <Button
              onClick={() => {
                setCreateSeed(null);
                setCreateOpen(true);
              }}
              className="rounded-full"
              disabled={!selected}
            >
              <Plus />
              New Booking
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* Resource list */}
        <Card className="flex flex-col gap-2 p-3 shadow-none">
          <div className="text-ink flex items-center gap-2 px-2 py-1 text-sm font-semibold">
            <CalendarClock className="text-ink-muted size-4" /> Resources
          </div>
          {assetsLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <p className="text-ink-faint px-2 py-6 text-center text-xs">
              No bookable resources yet. Mark assets as bookable in the Assets tab.
            </p>
          ) : (
            assets.map((a) => {
              const active = selected?.id === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAssetId(a.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-md border p-3 text-left transition-colors",
                    active
                      ? "border-accent-green bg-accent-green/5"
                      : "border-border bg-card hover:border-border/80",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-ink text-sm font-medium">{a.name}</span>
                    <span className="text-ink-muted bg-muted rounded-full px-2 py-0.5 text-[10px] font-medium">
                      {a.category_name ?? "Resource"}
                    </span>
                  </div>
                  <div className="text-ink-muted flex flex-wrap items-center gap-3 text-xs">
                    {a.location_name ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {a.location_name}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Tag className="size-3" /> {a.asset_tag}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </Card>

        {/* Calendar */}
        <Card className="flex flex-col shadow-none">
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              {selected ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-ink text-base font-semibold">{selected.name}</span>
                    <span className="text-ink-muted bg-muted rounded-full px-2 py-0.5 text-xs">
                      {selected.category_name ?? "Resource"}
                    </span>
                  </div>
                  <p className="text-ink-muted mt-0.5 text-xs">
                    {weekLabel(weekStart)} · click an empty slot to book
                  </p>
                </>
              ) : (
                <p className="text-ink-muted text-sm">
                  Select a resource on the left to view its calendar.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                onClick={() => setWeekStart(addWeeks(weekStart, -1))}
                aria-label="Previous week"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                onClick={() => setWeekStart(addWeeks(weekStart, 1))}
                aria-label="Next week"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>

          {/* Week grid */}
          <div className="relative overflow-x-auto">
            <div
              className="grid min-w-[720px]"
              style={{
                gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))",
              }}
            >
              {/* Header row */}
              <div className="border-border border-b" />
              {days.map((d) => {
                const today = isSameDay(d, new Date());
                return (
                  <div
                    key={`h-${d.toISOString()}`}
                    className={cn(
                      "border-border flex flex-col items-center gap-0.5 border-b border-l py-2",
                      today && "bg-accent-green/5",
                    )}
                  >
                    <span className="text-ink-muted text-[10px] font-medium tracking-wider uppercase">
                      {format(d, "EEE")}
                    </span>
                    <span
                      className={cn(
                        "text-ink text-lg font-semibold",
                        today && "text-accent-green",
                      )}
                    >
                      {format(d, "d")}
                    </span>
                  </div>
                );
              })}

              {/* Time rows */}
              {HOURS.map((h) => (
                <div key={`row-${h}`} className="contents">
                  <div
                    className="text-ink-muted border-border border-b px-2 pt-1 text-right text-[11px]"
                    style={{ height: ROW_H }}
                  >
                    {format(new Date(2000, 0, 1, h), "h a")}
                  </div>
                  {days.map((d) => (
                    <button
                      key={`c-${d.toISOString()}-${h}`}
                      onClick={() => openCreateForSlot(d, h)}
                      disabled={!canBook || !selected}
                      className={cn(
                        "border-border relative border-b border-l text-left transition-colors",
                        canBook && selected
                          ? "hover:bg-accent-green/5 cursor-pointer"
                          : "cursor-default",
                      )}
                      style={{ height: ROW_H }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Bookings overlay */}
            {selected && !bookingsLoading ? (
              <BookingsOverlay
                bookings={bookings}
                days={days}
                onSelect={(b) => setDetailFor(b)}
              />
            ) : null}
          </div>
        </Card>
      </div>

      {selected ? (
        <CreateBookingDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          asset={selected}
          seed={createSeed}
          onCreated={() => {
            setCreateOpen(false);
            reload();
          }}
        />
      ) : null}

      <BookingDetailDialog
        booking={detailFor}
        open={detailFor != null}
        onOpenChange={(v) => !v && setDetailFor(null)}
        onCancelled={() => {
          setDetailFor(null);
          reload();
        }}
      />
    </div>
  );
}

// ── Bookings overlay ─────────────────────────────────────────────────────────
// Absolutely-positioned coloured blocks anchored to each day column, using the
// same grid template as the underlying calendar. Top offset skips the header.
const HEADER_H = 56; // px — day-header row height

function BookingsOverlay({
  bookings,
  days,
  onSelect,
}: {
  bookings: Booking[];
  days: Date[];
  onSelect: (b: Booking) => void;
}) {
  return (
    <div
      aria-hidden={false}
      className="pointer-events-none absolute inset-0"
      style={{ top: HEADER_H }}
    >
      <div
        className="grid min-w-[720px]"
        style={{ gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))" }}
      >
        <div />
        {days.map((d) => {
          const rowsForDay = bookings.filter((b) =>
            isSameDay(parseISO(b.starts_at), d),
          );
          return (
            <div key={`col-${d.toISOString()}`} className="relative">
              {rowsForDay.map((b) => {
                const s = parseISO(b.starts_at);
                const e = parseISO(b.ends_at);
                const startMin = s.getHours() * 60 + s.getMinutes();
                const endMin = e.getHours() * 60 + e.getMinutes();
                const baseMin = HOURS[0] * 60;
                const top = ((startMin - baseMin) / 60) * ROW_H;
                const height = Math.max(((endMin - startMin) / 60) * ROW_H, ROW_H * 0.5);
                const cancelled = b.status === "cancelled";
                return (
                  <button
                    key={b.id}
                    onClick={() => onSelect(b)}
                    className={cn(
                      "pointer-events-auto absolute inset-x-1 rounded-md border px-2 py-1 text-left text-xs shadow-sm transition-colors",
                      cancelled
                        ? "border-border bg-muted text-ink-muted line-through"
                        : "border-accent-sky/40 bg-accent-sky/10 text-accent-sky hover:bg-accent-sky/20",
                    )}
                    style={{ top, height }}
                  >
                    <div className="truncate font-medium">{b.purpose || "Booking"}</div>
                    <div className="text-[10px] opacity-90">
                      {format(s, "HH:mm")} – {format(e, "HH:mm")}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Create booking dialog ────────────────────────────────────────────────────
function CreateBookingDialog({
  open,
  onOpenChange,
  asset,
  seed,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset: Asset;
  seed: { day: Date; hour: number } | null;
  onCreated: () => void;
}) {
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [purpose, setPurpose] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const d = seed?.day ?? new Date();
    const h = seed?.hour ?? 9;
    const base = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0);
    setStartsAt(format(base, "yyyy-MM-dd'T'HH:mm"));
    setEndsAt(
      format(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h + 1, 0), "yyyy-MM-dd'T'HH:mm"),
    );
    setPurpose("");
  }, [open, seed]);

  async function submit() {
    if (differenceInMinutes(new Date(endsAt), new Date(startsAt)) <= 0) {
      toast.error("End time must be after start time");
      return;
    }
    setSaving(true);
    try {
      await createBooking({
        asset: asset.id,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        purpose,
      });
      toast.success("Booking created");
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create booking";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New booking</DialogTitle>
          <DialogDescription>{asset.name}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="starts_at">Starts</Label>
            <Input
              id="starts_at"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ends_at">Ends</Label>
            <Input
              id="ends_at"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="purpose">Purpose (optional)</Label>
            <Textarea
              id="purpose"
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Client demo"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Book"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail dialog ────────────────────────────────────────────────────────────
function BookingDetailDialog({
  booking,
  open,
  onOpenChange,
  onCancelled,
}: {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCancelled: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function doCancel() {
    if (!booking) return;
    setSaving(true);
    try {
      await cancelBooking(booking.id);
      toast.success("Booking cancelled");
      onCancelled();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to cancel booking";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!booking) return null;
  const s = parseISO(booking.starts_at);
  const e = parseISO(booking.ends_at);
  const cancelled = booking.status === "cancelled";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{booking.purpose || "Booking"}</DialogTitle>
          <DialogDescription>{booking.asset_name}</DialogDescription>
        </DialogHeader>
        <dl className="text-sm">
          <Row
            label="When"
            value={`${format(s, "d LLL yyyy")} · ${format(s, "HH:mm")} – ${format(e, "HH:mm")}`}
          />
          <Row label="Booked by" value={booking.booked_by_name} />
          {booking.department_name ? (
            <Row label="Department" value={booking.department_name} />
          ) : null}
          <Row label="Status" value={booking.status_label} />
        </dl>
        <DialogFooter>
          {!cancelled ? (
            <Button variant="destructive" onClick={doCancel} disabled={saving}>
              {saving ? "Cancelling…" : "Cancel booking"}
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1">
      <dt className="text-ink-muted text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-ink col-span-2 text-sm">{value}</dd>
    </div>
  );
}
