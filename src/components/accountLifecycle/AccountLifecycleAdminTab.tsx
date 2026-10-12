import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { formatDay } from "@/components/registrationApprovals/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import type { AccountLifecycleStatus, LifecycleReport } from "@/lib/accountLifecycle";

const CATEGORY_LABEL: Record<string, string> = {
  iitr_student: "IITR Students",
  iitr_postdoc: "IITR Post Doctoral Fellows",
  iitr_research_associate: "IITR Research Associates in Projects",
  iitr_startup: "IITR Startups",
};

const DEGREE_LABEL: Record<string, string> = {
  phd: "Ph.D. (5 years)",
  msc: "M.Sc. (2 years)",
  mtech: "M.Tech. (2 years)",
  int_mtech: "Int. M.Tech (5 years)",
  btech: "B.Tech. (4 years)",
  other: "Other (5 years)",
  no_degree_no_joining_date: "No degree or joining date",
};

type UserStatus = AccountLifecycleStatus & { user: { id: number; name: string; email: string } };

/** Main Administrator: read-only end-date report and direct extension / override for one user. */
export default function AccountLifecycleAdminTab() {
  const [report, setReport] = useState<LifecycleReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [found, setFound] = useState<UserStatus | null>(null);
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getAccountLifecycleReport();
    setLoading(false);
    if (res.error || !res.data) toast.error(res.error || "Could not load the report.");
    else setReport(res.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lookUp = async () => {
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) return;
    const res = await apiClient.getAdminUserLifecycle(id);
    if (res.error || !res.data) {
      setFound(null);
      toast.error(res.error || "User not found.");
      return;
    }
    setFound(res.data);
    setUntil(res.data.extension_max_until || "");
  };

  const extend = async () => {
    if (!found) return;
    setBusy(true);
    const res = await apiClient.adminExtendUserLifecycle(found.user.id, until, reason);
    setBusy(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not extend.");
      return;
    }
    toast.success(res.data.message);
    setFound({ ...found, ...res.data.status });
    setReason("");
    void load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Programme / employment end dates</CardTitle>
          <CardDescription>
            {report?.enforcement_enabled
              ? "Enforcement is on: accounts past their end date are suspended (sign-in, past bookings and results stay available)."
              : "Enforcement is off: end dates are computed and shown, nobody is suspended and no reminder emails are sent."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !report ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
          {report ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Active users</TableHead>
                    <TableHead className="text-right">Past end date</TableHead>
                    <TableHead className="text-right">Ending in 30 days</TableHead>
                    <TableHead className="text-right">No end date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(report.by_category).map(([key, row]) => (
                    <TableRow key={key}>
                      <TableCell>{CATEGORY_LABEL[key] || key}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.active_users ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.would_suspend_now ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.ending_within_30_days ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.missing_end_date ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IITR Students by degree</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                    <TableHead className="text-right">Past end date</TableHead>
                    <TableHead className="text-right">From graduation date</TableHead>
                    <TableHead className="text-right">From joining date</TableHead>
                    <TableHead className="text-right">No dates</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(report.iitr_students_by_degree).map(([key, row]) => (
                    <TableRow key={key}>
                      <TableCell>{DEGREE_LABEL[key] || key}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.active_users ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.would_suspend_now ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.from_graduation_date ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.derived_from_joining ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.missing_end_date ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-sm text-muted-foreground">
                {report.would_suspend_now_total} account(s) are past their end date; {report.would_suspend_now_with_future_bookings} of them
                have upcoming bookings and {report.would_suspend_now_without_resolvable_supervisor} have no linked supervisor.{" "}
                {report.missing_end_date_total} account(s) have no end date.
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Extend one account</CardTitle>
          <CardDescription>Extend or override an end date directly (up to six months at a time). Any pending request is closed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="lc-user-id">User ID</Label>
              <Input id="lc-user-id" inputMode="numeric" value={userId} onChange={(e) => setUserId(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" onClick={lookUp} disabled={!userId}>
              Look up
            </Button>
          </div>
          {found ? (
            <div className="space-y-3 rounded-lg border p-3 text-sm">
              <p>
                <span className="font-medium">{found.user.name}</span> · {found.category_label} · end date{" "}
                {found.programme_end_date ? formatDay(found.programme_end_date) : "not available"} ({found.end_date_source_note})
                {found.suspended ? " · suspended" : ""}
              </p>
              {found.programme_end_date ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="lc-until">Extend until (latest {formatDay(found.extension_max_until)})</Label>
                    <Input
                      id="lc-until"
                      type="date"
                      value={until}
                      max={found.extension_max_until || undefined}
                      onChange={(e) => setUntil(e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lc-reason">Reason (recorded and emailed to the user)</Label>
                    <Textarea id="lc-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />
                  </div>
                  <Button onClick={extend} disabled={busy || !until || !reason.trim()}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Extend
                  </Button>
                </>
              ) : (
                <Alert>
                  <AlertDescription>This account has no end date yet, so there is nothing to extend.</AlertDescription>
                </Alert>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
