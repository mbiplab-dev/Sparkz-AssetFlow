"use client";

import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { can, canAny, type Capability } from "@/lib/auth/permissions";

/**
 * Conditionally render children based on capability. Use for buttons/sections.
 * When `fallback` is omitted and access is denied, renders nothing.
 */
export function Can({
  capability,
  anyOf,
  children,
  fallback = null,
}: {
  capability?: Capability;
  anyOf?: Capability[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user } = useAuth();
  const allowed = anyOf
    ? canAny(user, anyOf)
    : capability
      ? can(user, capability)
      : true;
  return allowed ? <>{children}</> : <>{fallback}</>;
}

/**
 * Full-page access denial for route-level gates.
 */
export function AccessDenied({
  title = "You don't have access",
  description = "Your role does not include permission for this area. Contact an administrator if you need access.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-md py-16">
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="bg-muted flex size-11 items-center justify-center rounded-xl">
            <ShieldAlert className="text-ink-faint size-5" />
          </span>
          <h2 className="font-display text-ink text-lg font-semibold">{title}</h2>
          <p className="text-ink-muted text-sm">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Route-level gate: show children only when the user has the capability.
 */
export function RoleGate({
  capability,
  anyOf,
  title,
  description,
  children,
}: {
  capability?: Capability;
  anyOf?: Capability[];
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const allowed = anyOf
    ? canAny(user, anyOf)
    : capability
      ? can(user, capability)
      : true;

  if (!allowed) {
    return <AccessDenied title={title} description={description} />;
  }
  return <>{children}</>;
}
