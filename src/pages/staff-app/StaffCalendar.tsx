import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiClient, type StaffAppToday } from "@/lib/api";
import StaffTopBar from "./StaffTopBar";
import StaffWeekCalendar from "./StaffWeekCalendar";

export default function StaffCalendar() {
  const [equipment, setEquipment] = useState<StaffAppToday["equipment"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiClient.getStaffAppToday().then((res) => {
      if (cancelled) return;
      if (res.data) setEquipment(res.data.equipment);
      else setError(res.error || "Could not load your instruments.");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-muted/20">
      <StaffTopBar title="Week calendar" subtitle="Tap a booking to open its job sheet" />
      <main className="mx-auto max-w-3xl px-4 py-4">
        <div className="rounded-xl border bg-card p-4">
          {equipment ? (
            <StaffWeekCalendar equipment={equipment} />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading…
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
