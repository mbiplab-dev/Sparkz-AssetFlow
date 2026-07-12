import type { ComponentType } from "react";
import {
  ArrowLeftRight,
  Boxes,
  CalendarClock,
  CircleCheckBig,
  ClipboardCheck,
  Package,
  Undo2,
  Wrench,
} from "lucide-react";

export type ActivityIconSpec = {
  icon: ComponentType<{ className?: string }>;
  tint: string;
  bg: string;
};

const RULES: { keywords: string[]; spec: ActivityIconSpec }[] = [
  {
    keywords: ["transfer"],
    spec: { icon: ArrowLeftRight, tint: "text-accent-purple-deep", bg: "bg-accent-purple/25" },
  },
  {
    keywords: ["allocat", "assign"],
    spec: { icon: Boxes, tint: "text-accent-sky", bg: "bg-accent-sky/15" },
  },
  {
    keywords: ["return"],
    spec: { icon: Undo2, tint: "text-accent-pink", bg: "bg-accent-pink/15" },
  },
  {
    keywords: ["book"],
    spec: { icon: CalendarClock, tint: "text-accent-teal", bg: "bg-accent-teal/15" },
  },
  {
    keywords: ["maint", "repair"],
    spec: { icon: Wrench, tint: "text-accent-orange", bg: "bg-accent-orange/15" },
  },
  {
    keywords: ["audit"],
    spec: { icon: ClipboardCheck, tint: "text-accent-brown", bg: "bg-accent-brown/15" },
  },
  {
    keywords: ["register", "asset"],
    spec: { icon: Package, tint: "text-accent-green", bg: "bg-accent-green/15" },
  },
  {
    keywords: ["overdue"],
    spec: { icon: CircleCheckBig, tint: "text-destructive", bg: "bg-destructive/10" },
  },
];

const DEFAULT_SPEC: ActivityIconSpec = {
  icon: CircleCheckBig,
  tint: "text-ink-muted",
  bg: "bg-muted",
};

/** Picks a decorative accent icon + tint for an activity row by keyword. */
export function activityIcon(message: string): ActivityIconSpec {
  const lower = message.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.spec;
  }
  return DEFAULT_SPEC;
}
