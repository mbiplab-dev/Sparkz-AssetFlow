"use client";

import Link from "next/link";
import { ArrowLeftRight, CalendarPlus, PackagePlus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export function QuickActions({ pendingTransfers }: { pendingTransfers: number }) {
  const { user } = useAuth();
  if (!user) return null;

  const canRegisterAssets = user.role === "admin" || user.role === "asset_manager";
  const canApproveTransfers =
    user.role === "admin" || user.role === "asset_manager" || user.role === "department_head";

  return (
    <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
      {canRegisterAssets && (
        <Button asChild className="w-full rounded-full sm:w-auto">
          <Link href="/assets">
            <PackagePlus />
            Register Asset
          </Link>
        </Button>
      )}
      <Button asChild variant="outline" className="w-full rounded-full sm:w-auto">
        <Link href="/booking">
          <CalendarPlus />
          Book Resource
        </Link>
      </Button>
      <Button asChild variant="outline" className="w-full rounded-full sm:w-auto">
        <Link href="/maintenance">
          <Wrench />
          Raise Maintenance
        </Link>
      </Button>

      {canApproveTransfers && pendingTransfers > 0 && (
        <Button asChild variant="secondary" className="w-full rounded-full sm:w-auto">
          <Link href="/allocation">
            <ArrowLeftRight />
            Approve Transfers
            <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold">
              {pendingTransfers}
            </span>
          </Link>
        </Button>
      )}
    </div>
  );
}
