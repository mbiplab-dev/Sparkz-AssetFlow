"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AppSidebar, NAV_ITEMS } from "@/components/AppSidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex w-64 flex-col gap-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
    );
  }

  const title =
    NAV_ITEMS.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`))?.label ??
    "AssetFlow";

  return (
    <div className="flex min-h-dvh flex-1">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader title={title} />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
