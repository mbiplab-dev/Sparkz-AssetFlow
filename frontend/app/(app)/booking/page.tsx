"use client";

import { useState } from "react";
import { CalendarClock, Search } from "lucide-react";
import { ModuleScreen } from "@/components/ModuleScreen";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAsyncList } from "@/lib/hooks/useAsyncList";
import { listAssets, type Asset } from "@/lib/api/assets";

export default function BookingPage() {
  const [search, setSearch] = useState("");
  const { data: assets, loading } = useAsyncList(
    () => listAssets({ is_bookable: "true", search: search || undefined }),
    [search],
  );

  return (
    <ModuleScreen
      icon={CalendarClock}
      title="Resource Booking"
      description="Book shared resources (rooms, vehicles, equipment) by time slot with overlap validation and reminders."
      features={[
        { label: "Calendar view", desc: "See existing bookings for any shared resource" },
        { label: "Overlap validation", desc: "Two people can't book the same resource at overlapping times" },
        { label: "Booking lifecycle", desc: "Upcoming → Ongoing → Completed, with cancel/reschedule" },
        { label: "Reminders", desc: "Notification before your booking slot starts" },
      ]}
      ctaHref="/assets"
      ctaLabel="Browse all assets"
    >
      <Card>
        <CardContent className="px-0">
          <div className="flex items-center justify-between px-4 pb-3">
            <h3 className="text-ink-secondary text-sm font-medium">Bookable resources</h3>
            <div className="relative">
              <Search className="text-ink-faint absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48 pl-8"
              />
            </div>
          </div>
          {loading ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              <span className="bg-accent-teal/15 flex size-10 items-center justify-center rounded-full">
                <CalendarClock className="text-accent-teal size-5" />
              </span>
              <p className="text-ink-secondary text-sm font-medium">No bookable resources yet</p>
              <p className="text-ink-muted text-sm">
                Mark assets as &quot;shared / bookable&quot; in the asset directory to make them available for booking.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Asset Tag</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset: Asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="pl-4 font-mono text-xs font-medium text-ink">
                      {asset.asset_tag}
                    </TableCell>
                    <TableCell className="font-medium text-ink">{asset.name}</TableCell>
                    <TableCell className="text-ink-muted">{asset.category_name}</TableCell>
                    <TableCell className="text-ink-muted">
                      {asset.location_name || "—"}
                    </TableCell>
                    <TableCell className="pr-4">
                      <span className="text-accent-teal text-sm font-medium">Bookable</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </ModuleScreen>
  );
}
