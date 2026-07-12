import type { LucideIcon } from "lucide-react";
import { DomainIcons, DomainTints } from "@/components/icons";

export type ActivityIconSpec = {
  icon: LucideIcon;
  tint: string;
  bg: string;
};

const RULES: { keywords: string[]; spec: ActivityIconSpec }[] = [
  {
    keywords: ["transfer"],
    spec: { icon: DomainIcons.allocation, ...DomainTints.purple },
  },
  {
    keywords: ["allocat", "assign"],
    spec: { icon: DomainIcons.assetsOk, ...DomainTints.sky },
  },
  {
    keywords: ["return"],
    spec: { icon: DomainIcons.return, ...DomainTints.pink },
  },
  {
    keywords: ["book"],
    spec: { icon: DomainIcons.booking, ...DomainTints.teal },
  },
  {
    keywords: ["maint", "repair"],
    spec: { icon: DomainIcons.maintenance, ...DomainTints.orange },
  },
  {
    keywords: ["audit"],
    spec: { icon: DomainIcons.audit, ...DomainTints.brown },
  },
  {
    keywords: ["register", "asset"],
    spec: { icon: DomainIcons.assets, ...DomainTints.green },
  },
  {
    keywords: ["overdue"],
    spec: { icon: DomainIcons.overdue, ...DomainTints.danger },
  },
  {
    keywords: ["notif", "alert"],
    spec: { icon: DomainIcons.notifications, ...DomainTints.primary },
  },
  {
    keywords: ["user", "role", "employ"],
    spec: { icon: DomainIcons.people, ...DomainTints.purple },
  },
];

const DEFAULT_SPEC: ActivityIconSpec = {
  icon: DomainIcons.activity,
  ...DomainTints.muted,
};

/** Picks a decorative accent icon + tint for an activity row by keyword. */
export function activityIcon(message: string): ActivityIconSpec {
  const lower = message.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.spec;
  }
  return DEFAULT_SPEC;
}
