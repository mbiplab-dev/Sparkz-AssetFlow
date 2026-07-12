"use client";

import { useState } from "react";
import { ArrowLeftRight, Search } from "lucide-react";
import { ModuleScreen } from "@/components/ModuleScreen";
import { AssetStatusBadge } from "@/components/assets/AssetStatusBadge";
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

export default function AllocationPage() {
  const [search, setSearch] = useState("");
  const { data: assets, loading } = useAsyncList(
    () => listAssets({ search: search || undefined }),
    [search],
  );

  const allocated = assets.filter(
    (a) => a.status === "allocated" || a.status === "available" || a.status === "reserved",
  );

  return (
    <ModuleScreen
      icon={ArrowLeftRight}
      title="Allocation & Transfer"
      description="Allocate assets to employees/departments, handle transfers when assets are already held, and track returns with overdue flagging."
      features={[
        { label: "Allocate assets", desc: "Assign to employees or departments with expected return dates" },
        { label: "Transfer workflow", desc: "Requested → Approved → Re-allocated when an asset is already held" },
        { label: "Return & check-in", desc: "Mark returned, capture condition notes, auto-revert to available" },
        { label: "Overdue flagging", desc: "Auto-flag allocations past their expected return date" },
      ]}
      ctaHref="/assets"
      ctaLabel="Browse assets to allocate"
    >
      <Card>
        <CardContent className="px-0">
          <div className="flex items-center justify-between px-4 pb-3">
            <h3 className="text-ink-secondary text-sm font-medium">Assets available for allocation</h3>
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
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : allocated.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              <p className="text-ink-muted text-sm">No assets to display yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Asset Tag</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="pr-4">Bookable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocated.map((asset: Asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="pl-4 font-mono text-xs font-medium text-ink">
                      {asset.asset_tag}
                    </TableCell>
                    <TableCell className="font-medium text-ink">{asset.name}</TableCell>
                    <TableCell>
                      <AssetStatusBadge status={asset.status} />
                    </TableCell>
                    <TableCell className="text-ink-muted">
                      {asset.department_name || "—"}
                    </TableCell>
                    <TableCell className="pr-4">
                      {asset.is_bookable ? (
                        <span className="text-accent-teal text-sm font-medium">Yes</span>
                      ) : (
                        <span className="text-ink-faint text-sm">No</span>
                      )}
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
