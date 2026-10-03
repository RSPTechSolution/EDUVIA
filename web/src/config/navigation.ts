import {
  Building2, CalendarDays, ClipboardCheck, Wallet, CalendarRange, CreditCard, GraduationCap, Inbox, KeyRound, LayoutDashboard, Layers, School, ScrollText, Settings2, ToggleRight, Users, type LucideIcon,
} from "lucide-react";
import type { Me } from "@/lib/api/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden unless the school has this module enabled. */
  module?: string;
  /** Hidden unless the user holds this permission. */
  permission?: string;
  /** Only shown to these roles. */
  roles?: string[];
  superAdminOnly?: boolean;
  keywords?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Only routes that exist are listed. Each build phase adds its module's pages here. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: ["home"] }],
  },
  {
    label: "Platform",
    items: [
      { label: "Schools", href: "/platform/schools", icon: Building2, superAdminOnly: true, keywords: ["tenants", "provision"] },
      { label: "Plans", href: "/platform/plans", icon: Layers, superAdminOnly: true, keywords: ["pricing", "subscription"] },
      { label: "Leads", href: "/platform/leads", icon: Inbox, superAdminOnly: true, keywords: ["enquiries", "contact", "upgrade requests"] },
    ],
  },
  {
    label: "Academics",
    items: [
      { label: "Students", href: "/students", icon: GraduationCap, module: "students", permission: "students.view", keywords: ["admission", "pupils", "children"] },
      { label: "Classes & sections", href: "/academics/classes", icon: School, module: "students", permission: "students.view", keywords: ["grades", "sections", "class teacher"] },
      { label: "Timetable", href: "/timetable", icon: CalendarRange, module: "academics", permission: "timetable.view", keywords: ["schedule", "periods", "free teacher", "substitute"] },
      { label: "Attendance", href: "/attendance", icon: ClipboardCheck, module: "attendance", permission: "attendance.view", keywords: ["absent", "present", "roll call", "register"] },
      { label: "Attendance", href: "/my-attendance", icon: ClipboardCheck, module: "attendance", roles: ["parent", "student"], keywords: ["absent", "present"] },
      { label: "Fees", href: "/my-fees", icon: Wallet, module: "fees", roles: ["parent", "student"], keywords: ["pay", "dues", "receipt", "invoice"] },
      { label: "My timetable", href: "/my-timetable", icon: CalendarDays, module: "academics", roles: ["teacher", "principal", "parent", "student"], keywords: ["schedule", "today", "classes"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Fees", href: "/fees", icon: Wallet, module: "fees", permission: "fees.view", keywords: ["collect", "dues", "invoice", "receipt", "payment", "concession"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "School profile", href: "/settings/school", icon: Settings2, permission: "school.view", keywords: ["settings", "timezone"] },
      { label: "Modules", href: "/settings/modules", icon: ToggleRight, permission: "modules.manage", keywords: ["features"] },
      { label: "Plan & billing", href: "/settings/billing", icon: CreditCard, permission: "billing.view", keywords: ["subscription", "upgrade", "pricing", "trial"] },
      { label: "Users & roles", href: "/settings/users", icon: Users, permission: "users.view", keywords: ["staff", "accounts", "permissions"] },
      { label: "Audit log", href: "/settings/audit", icon: ScrollText, permission: "audit.view", keywords: ["history", "activity"] },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "My account", href: "/account", icon: KeyRound, keywords: ["password", "profile"] },
    ],
  },
];

export function canSee(item: NavItem, me: Me) {
  const isSuper = me.role === "super_admin";
  if (item.superAdminOnly) return isSuper;
  if (isSuper) return !item.module && !item.permission; // super admin has no school context
  if (item.module && !me.modules.includes(item.module)) return false;
  if (item.permission && !me.permissions.includes(item.permission)) return false;
  if (item.roles && !item.roles.includes(me.role)) return false;
  return true;
}

export function visibleGroups(me: Me): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canSee(i, me)) })).filter((g) => g.items.length);
}

export function findNavItem(pathname: string): NavItem | undefined {
  const all = NAV_GROUPS.flatMap((g) => g.items);
  return all
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
