import {
  AlarmClock,
  BarChart3,
  Bell,
  CalendarCheck,
  FileCheck2,
  GraduationCap,
  ListOrdered,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  tone: string;
}

/** Display names and colours for the notification categories the backend assigns. */
export const NOTIFICATION_CATEGORIES: Record<string, CategoryMeta> = {
  bookings: { label: "Bookings", icon: CalendarCheck, tone: "text-sky-600 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300" },
  results: { label: "Results", icon: FileCheck2, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300" },
  payments: { label: "Wallet", icon: Wallet, tone: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300" },
  messages: { label: "Messages", icon: MessageSquare, tone: "text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300" },
  reminders: { label: "Reminders", icon: AlarmClock, tone: "text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-300" },
  waitlist: { label: "Waitlist", icon: ListOrdered, tone: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 dark:text-cyan-300" },
  training: { label: "Training", icon: GraduationCap, tone: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300" },
  staff: { label: "Lab operations", icon: Wrench, tone: "text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-200" },
  announcements: { label: "Announcements", icon: Megaphone, tone: "text-pink-600 bg-pink-50 dark:bg-pink-950/40 dark:text-pink-300" },
  account: { label: "Account", icon: ShieldCheck, tone: "text-teal-600 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-300" },
  monthly_reports: { label: "Monthly reports", icon: BarChart3, tone: "text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300" },
  other: { label: "Other", icon: Bell, tone: "text-muted-foreground bg-muted" },
};

export function categoryMeta(key: string | null | undefined): CategoryMeta {
  return NOTIFICATION_CATEGORIES[key ?? ""] ?? NOTIFICATION_CATEGORIES.other;
}

/** Same-origin absolute URLs from the API become in-app paths so React Router can navigate. */
export function toInAppPath(link: string): string {
  try {
    const u = new URL(link, typeof window !== "undefined" ? window.location.origin : undefined);
    if (typeof window !== "undefined" && u.origin === window.location.origin) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    /* ignore */
  }
  return link;
}
