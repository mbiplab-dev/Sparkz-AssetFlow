"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/auth/authApi";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  asset_manager: "Asset Manager",
  department_head: "Department Head",
  employee: "Employee",
};

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstNameOf(fullName: string): string {
  return fullName.split(/\s+/).filter(Boolean)[0] ?? fullName;
}

export function DashboardHeader({
  isRefreshing,
  onRefresh,
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const { user } = useAuth();
  if (!user) return null;

  const now = new Date();
  const greeting = greetingFor(now.getHours());
  const dateLabel = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-ink-faint text-xs font-semibold tracking-wide uppercase">{dateLabel}</p>
        <h2 className="font-display text-ink text-xl font-bold tracking-tight break-words sm:text-2xl md:text-3xl">
          {greeting}, {firstNameOf(user.full_name)}
        </h2>
        <p className="text-ink-muted text-sm">
          You&apos;re signed in as{" "}
          <span className="text-ink-secondary font-medium">{ROLE_LABELS[user.role]}</span>.
          <span className="hidden sm:inline"> Here&apos;s your operational snapshot.</span>
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="w-full rounded-md sm:w-auto"
      >
        <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
        {isRefreshing ? "Refreshing" : "Refresh"}
      </Button>
    </div>
  );
}
