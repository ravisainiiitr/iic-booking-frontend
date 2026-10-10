import type { ComponentType } from "react";
import { CalendarX2, Users, Wrench } from "lucide-react";
import { INSIGHT_PATHS } from "@/lib/adminInsights";

export interface InsightMenuItem {
  id: string;
  label: string;
  path: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

/** Dashboard menu entries (Overview section) for the Main / Department Administrator. Ids are saved in menu layouts. */
export const INSIGHT_MENU: InsightMenuItem[] = [
  {
    id: "equipment_overview",
    label: "Equipment overview",
    path: INSIGHT_PATHS.equipment,
    description: "Status, OICs, downtime, upcoming bookings and utilisation",
    icon: Wrench,
  },
  {
    id: "users_overview",
    label: "Users overview",
    path: INSIGHT_PATHS.users,
    description: "Categories, programmes, departments, organisations and sign-ups",
    icon: Users,
  },
  {
    id: "cancellations_dashboard",
    label: "Cancellations",
    path: INSIGHT_PATHS.cancellations,
    description: "Who cancelled, reasons, lead time, refunds and re-booked slots",
    icon: CalendarX2,
  },
];
