import {
  Apple,
  BriefcaseBusiness,
  CalendarDays,
  ChartSpline,
  ClipboardCheck,
  Droplets,
  LayoutDashboard,
  ListTodo,
  Repeat2,
  Settings,
  Sparkles,
  Timer,
  type LucideIcon,
} from "lucide-react";
import type { ModulePreferences } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  module?: keyof ModulePreferences;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/calendar", label: "Calendar & history", shortLabel: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Daily practice",
    items: [
      { href: "/check-in", label: "Daily check-in", shortLabel: "Check-in", icon: ClipboardCheck },
      { href: "/nutrition", label: "Nutrition", icon: Apple },
      { href: "/water", label: "Water", icon: Droplets },
      { href: "/tasks", label: "To-do list", shortLabel: "Tasks", icon: ListTodo },
      { href: "/study", label: "Study & focus", shortLabel: "Study", icon: Timer, module: "study" },
      { href: "/habits", label: "Habits & routines", shortLabel: "Habits", icon: Repeat2, module: "habits" },
    ],
  },
  {
    label: "Long view",
    items: [
      { href: "/career", label: "Career & skills", shortLabel: "Career", icon: BriefcaseBusiness, module: "career" },
      { href: "/analytics", label: "Analytics", icon: ChartSpline },
      { href: "/recap", label: "Monthly recap", shortLabel: "Recap", icon: Sparkles },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export function visibleGroups(modules: ModulePreferences): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.module || modules[item.module]),
  })).filter((group) => group.items.length > 0);
}

export const MOBILE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/check-in", label: "Check-in", icon: ClipboardCheck },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
];
