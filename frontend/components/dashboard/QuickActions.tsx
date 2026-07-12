"use client";

import Link from "next/link";
import { AppIcon, DomainIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useCan } from "@/lib/auth/permissions";

export function QuickActions({ pendingTransfers }: { pendingTransfers: number }) {
  const { user } = useAuth();
  const canRegisterAssets = useCan("assets.register");
  const canBook = useCan("bookings.create");
  const canRaiseMaintenance = useCan("maintenance.raise");
  const canApproveTransfers = useCan("transfers.approve");
  const canViewAudit = useCan("audit.view");
  const canManageAudit = useCan("audit.manage");
  const isEmployee = user?.role === "employee";

  if (!user) return null;

  return (
    <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
      {canRegisterAssets && (
        <Button asChild className="w-full rounded-full sm:w-auto">
          <Link href="/assets">
            <AppIcon icon={DomainIcons.assetsRegister} />
            Register Asset
          </Link>
        </Button>
      )}
      {isEmployee && (
        <Button asChild className="w-full rounded-full sm:w-auto">
          <Link href="/allocation">
            <AppIcon icon={DomainIcons.assets} />
            My allocations
          </Link>
        </Button>
      )}
      {canBook && (
        <Button asChild variant="outline" className="w-full rounded-full sm:w-auto">
          <Link href="/booking">
            <AppIcon icon={DomainIcons.booking} />
            Book Resource
          </Link>
        </Button>
      )}
      {canRaiseMaintenance && (
        <Button asChild variant="outline" className="w-full rounded-full sm:w-auto">
          <Link href="/maintenance">
            <AppIcon icon={DomainIcons.maintenance} />
            Raise Maintenance
          </Link>
        </Button>
      )}
      {isEmployee && canViewAudit && !canManageAudit && (
        <Button asChild variant="outline" className="w-full rounded-full sm:w-auto">
          <Link href="/audit">
            <AppIcon icon={DomainIcons.auditCycle} />
            My audit work
          </Link>
        </Button>
      )}

      {canApproveTransfers && pendingTransfers > 0 && (
        <Button asChild variant="secondary" className="w-full rounded-full sm:w-auto">
          <Link href="/allocation">
            <AppIcon icon={DomainIcons.allocation} />
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
