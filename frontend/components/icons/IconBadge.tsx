import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppIcon, ICON_STROKE } from "./AppIcon";

const SIZE = {
  xs: { box: "size-6 rounded-md", icon: "size-3" },
  sm: { box: "size-7 rounded-lg", icon: "size-3.5" },
  md: { box: "size-9 rounded-xl", icon: "size-4" },
  lg: { box: "size-11 rounded-xl", icon: "size-5" },
} as const;

export type IconBadgeSize = keyof typeof SIZE;

export type IconBadgeProps = {
  icon: LucideIcon;
  /** Tailwind text color class, e.g. `text-accent-sky` */
  tint?: string;
  /** Tailwind background class, e.g. `bg-accent-sky/15` */
  bg?: string;
  size?: IconBadgeSize;
  className?: string;
  iconClassName?: string;
  /** Soft ring for depth on light surfaces */
  ring?: boolean;
};

/**
 * Tinted icon chip used on KPIs, activity rows, empty states, and cards.
 */
export function IconBadge({
  icon,
  tint = "text-ink-muted",
  bg = "bg-muted",
  size = "md",
  className,
  iconClassName,
  ring = true,
}: IconBadgeProps) {
  const s = SIZE[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        s.box,
        bg,
        ring && "ring-1 ring-inset ring-black/[0.04]",
        className,
      )}
    >
      <AppIcon
        icon={icon}
        strokeWidth={ICON_STROKE}
        className={cn(s.icon, tint, iconClassName)}
      />
    </span>
  );
}
