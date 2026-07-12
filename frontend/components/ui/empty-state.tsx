"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { IconBadge } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Empty message inside a Select dropdown (Radix SelectContent).
 * Not a SelectItem — disabled interactive shell with optional CTA link.
 */
export function EmptySelectOptions({
  title = "Nothing found",
  description,
  actionHref,
  actionLabel,
  className,
}: {
  title?: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "text-muted-foreground flex flex-col items-start gap-1.5 px-3 py-3 text-sm",
        className,
      )}
    >
      <p className="text-foreground font-medium">{title}</p>
      {description ? <p className="text-xs leading-snug">{description}</p> : null}
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="text-primary mt-0.5 text-xs font-semibold hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Full-width empty state for lists/tables/cards (not inside Select).
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionHref,
  actionLabel,
  onAction,
  className,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-12 text-center", className)}>
      <IconBadge icon={Icon} size="lg" tint="text-ink-faint" bg="bg-muted" />
      <p className="text-ink-secondary text-sm font-medium">{title}</p>
      {description ? <p className="text-ink-muted max-w-sm text-sm">{description}</p> : null}
      {children}
      {actionHref && actionLabel ? (
        <Button asChild variant="outline" className="mt-1 rounded-full">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
      {onAction && actionLabel && !actionHref ? (
        <Button type="button" variant="outline" className="mt-1 rounded-full" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
