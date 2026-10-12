import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDay } from "@/components/registrationApprovals/shared";
import { apiClient } from "@/lib/api";
import type { SupervisorLifecycleOverview } from "@/lib/accountLifecycle";

/** Faculty: students / post-docs / RAs / startups linked to them whose end date is near or has passed. */
export default function SupervisedEndDatesCard({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<SupervisorLifecycleOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiClient.getSupervisorLifecycle().then((res) => {
      if (!cancelled && res.data) setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || (!data.users.length && !data.pending_extensions.length)) return null;
  const rows = compact ? data.users.slice(0, 5) : data.users;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4" aria-hidden />
          Supervised users: end dates
        </CardTitle>
        <CardDescription>
          Linked users whose programme / employment end date is within {data.nearing_days} days or has passed.
          {data.pending_extensions.length
            ? ` ${data.pending_extensions.length} extension request(s) are waiting for you under Pending approvals.`
            : " You can extend an end date by up to six months when they ask."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length ? (
          <ul className="divide-y text-sm">
            {rows.map((row) => (
              <li key={row.user.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="font-medium">{row.user.name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {row.category_label}
                    {row.degree_name ? ` · ${row.degree_name}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{formatDay(row.programme_end_date)}</span>
                  {row.suspended ? (
                    <Badge variant="destructive">Suspended</Badge>
                  ) : row.days_left < 0 ? (
                    <Badge variant="secondary">Ended</Badge>
                  ) : (
                    <Badge variant="outline">{row.days_left} day(s) left</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {compact ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/registration-approvals">Open Pending approvals</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
