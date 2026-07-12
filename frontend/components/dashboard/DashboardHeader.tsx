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
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-ink-faint text-xs font-semibold tracking-wide uppercase">{dateLabel}</p>
        <h2 className="font-display text-ink text-2xl font-bold tracking-tight sm:text-3xl">
          {greeting}, {firstNameOf(user.full_name)}
        </h2>
        <p className="text-ink-muted text-sm">
          You&apos;re signed in as{" "}
          <span className="text-ink-secondary font-medium">{ROLE_LABELS[user.role]}</span>.
          Here&apos;s your operational snapshot.
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="rounded-md"
      >
        <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
        {isRefreshing ? "Refreshing" : "Refresh"}
      </Button>
    </div>
  );
}
