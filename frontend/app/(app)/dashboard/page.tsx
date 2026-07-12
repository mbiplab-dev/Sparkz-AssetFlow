"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionNeededCard } from "@/components/dashboard/ActionNeededCard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { MyAssetsCard } from "@/components/dashboard/MyAssetsCard";
import { OnboardingEmptyState } from "@/components/dashboard/OnboardingEmptyState";
import { OrgSetupCard } from "@/components/dashboard/OrgSetupCard";
import { OverdueAlert } from "@/components/dashboard/OverdueAlert";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { SectionReveal } from "@/components/dashboard/SectionReveal";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/http";
import { getDashboardSummary, type DashboardSummary } from "@/lib/api/dashboard";

function LowerSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDashboardSummary()
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load the dashboard.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    getDashboardSummary()
      .then((data) => {
        setSummary(data);
        setError(null);
        toast.success("Dashboard refreshed");
      })
      .catch((err: unknown) => {
        const msg = err instanceof ApiError ? err.message : "Could not refresh the dashboard.";
        toast.error("Couldn't refresh dashboard", { description: msg });
      })
      .finally(() => setIsRefreshing(false));
  }, []);

  if (!user) return null;

  const kpis = summary?.kpis ?? null;
  const overdue = summary?.kpis.overdue_returns ?? 0;

  const allZero =
    !!summary &&
    Object.values(summary.kpis).every((v) => v === 0) &&
    summary.recent_activity.length === 0;

  const role = user.role;
  const isManagerLike = role === "admin" || role === "asset_manager" || role === "department_head";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <SectionReveal>
        <DashboardHeader isRefreshing={isRefreshing} onRefresh={handleRefresh} />
      </SectionReveal>

      {error && !summary && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Couldn&apos;t load dashboard data</AlertTitle>
          <AlertDescription className="flex items-center gap-3">
            {error}
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {overdue > 0 && (
        <SectionReveal delay={40}>
          <OverdueAlert count={overdue} />
        </SectionReveal>
      )}

      <KpiGrid kpis={kpis} />

      <SectionReveal delay={160}>
        <QuickActions pendingTransfers={summary?.kpis.pending_transfers ?? 0} />
      </SectionReveal>

      {!summary ? (
        <SectionReveal delay={240}>
          <LowerSkeleton />
        </SectionReveal>
      ) : allZero ? (
        <SectionReveal delay={240}>
          <OnboardingEmptyState role={role} />
        </SectionReveal>
      ) : role === "admin" ? (
        <>
          <SectionReveal delay={240} className="grid gap-4 lg:grid-cols-2">
            <OrgSetupCard />
            <ActionNeededCard kpis={summary.kpis} />
          </SectionReveal>
          <SectionReveal delay={320}>
            <RecentActivity items={summary.recent_activity} />
          </SectionReveal>
        </>
      ) : (
        <SectionReveal delay={240} className="grid gap-4 lg:grid-cols-2">
          {isManagerLike ? <ActionNeededCard kpis={summary.kpis} /> : <MyAssetsCard />}
          <RecentActivity items={summary.recent_activity} />
        </SectionReveal>
      )}
    </div>
  );
}
