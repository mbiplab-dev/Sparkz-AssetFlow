import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared stroke for a refined, modern look (Lucide default is 2). */
export const ICON_STROKE = 1.75;

export type AppIconProps = LucideProps & {
  icon: LucideIcon;
};

/**
 * Consistent Lucide rendering across the app — stroke weight, rounded caps,
 * and no accidental pointer events on decorative icons.
 */
export function AppIcon({
  icon: Icon,
  className,
  strokeWidth = ICON_STROKE,
  absoluteStrokeWidth,
  "aria-hidden": ariaHidden = true,
  ...props
}: AppIconProps) {
  return (
    <Icon
      className={cn("shrink-0", className)}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth={absoluteStrokeWidth}
      aria-hidden={ariaHidden}
      {...props}
    />
  );
}
