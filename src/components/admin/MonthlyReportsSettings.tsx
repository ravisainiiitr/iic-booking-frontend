import { useEffect, useState } from "react";
import { CalendarRange, Eye, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  apiClient,
  type MonthlyReportAudience,
  type MonthlyReportPreview,
  type MonthlyReportRecipient,
  type MonthlyReportSettings,
} from "@/lib/api";

type Toggle = "enabled" | "faculty_enabled" | "oic_enabled" | "hod_enabled" | "attach_excel";

export const AUDIENCE_LABELS: Record<MonthlyReportAudience, string> = {
  faculty: "Faculty",
  oic: "Officer in Charge",
  hod: "Head of Department",
};

const STATUS_LABELS: Record<string, string> = {
  sent: "Sent",
  failed: "Failed",
  sending: "Sending",
  skipped_empty: "Nothing to report",
  skipped_opted_out: "Switched off by the user",
};

/** Main Admin: monthly usage report switches and an in-browser preview of any recipient's report. */
export default function MonthlyReportsSettings() {
  const [settings, setSettings] = useState<MonthlyReportSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Toggle | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<MonthlyReportRecipient[] | null>(null);
  const [recipient, setRecipient] = useState<MonthlyReportRecipient | null>(null);
  const [month, setMonth] = useState("");
  const [preview, setPreview] = useState<MonthlyReportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiClient.getMonthlyReportSettings().then((res) => {
      if (cancelled) return;
      if (res.error || !res.data) {
        setError(res.error || "Could not load monthly report settings.");
        return;
      }
      setSettings(res.data);
      setMonth(res.data.default_month ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (key: Toggle, value: boolean) => {
    setSaving(key);
    const res = await apiClient.updateMonthlyReportSettings({ [key]: value });
    setSaving(null);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save.");
      return;
    }
    setSettings(res.data);
    toast.success(
      key === "enabled" ? (value ? "Monthly reports switched on." : "Monthly reports switched off.") : "Saved.",
    );
  };

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearching(true);
    const res = await apiClient.searchMonthlyReportRecipients(query.trim());
    setSearching(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Search failed.");
      return;
    }
    setResults(res.data.results);
  };

  const runPreview = async (who: MonthlyReportRecipient | null = recipient) => {
    if (!who || !month) return;
    setPreviewing(true);
    const res = await apiClient.previewMonthlyReport(who.id, month);
    setPreviewing(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not build the preview.");
      setPreview(null);
      return;
    }
    setPreview(res.data);
  };

  const row = (key: Toggle, label: string, help: string, disabled = false) => (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div>
        <Label htmlFor={`monthly-${key}`}>{label}</Label>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      <Switch
        id={`monthly-${key}`}
        checked={Boolean(settings?.[key])}
        disabled={disabled || saving !== null}
        onCheckedChange={(v) => void toggle(key, v)}
      />
    </div>
  );

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!settings) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-5 w-5" />
            Monthly usage reports
          </CardTitle>
          <CardDescription>
            A summary email of the previous month for faculty (their own and their students' bookings, spend and
            wallet), Officers in Charge (their equipment) and Heads of Department (their department).{" "}
            {settings.schedule ? `${settings.schedule}. ` : ""}People with nothing to report are skipped, and anyone can
            switch these emails off in Notification settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {row(
            "enabled",
            "Send monthly usage reports",
            "Master switch. Off: nothing is sent. Use the preview below before switching it on.",
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {row("faculty_enabled", "Faculty", "Faculty wallet owners.")}
            {row("oic_enabled", "Officers in Charge", "Per assigned equipment.")}
            {row("hod_enabled", "Heads of Department", "Per department.")}
          </div>
          {row("attach_excel", "Attach Excel", "Officer in Charge and Head of Department reports get an .xlsx table.")}
          {settings.last_run ? (
            <p className="text-sm text-muted-foreground" data-testid="monthly-last-run">
              Last run ({settings.last_run.month}):{" "}
              {Object.entries(settings.last_run.counts)
                .filter(([, n]) => n > 0)
                .map(([status, n]) => `${STATUS_LABELS[status] ?? status} ${n}`)
                .join(" · ") || "nothing recorded"}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-5 w-5" />
            Preview a report
          </CardTitle>
          <CardDescription>Shows exactly what a recipient would receive. Nothing is sent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={search} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <Label htmlFor="monthly-search">Recipient</Label>
              <Input
                id="monthly-search"
                placeholder="Search faculty, Officers in Charge or Heads of Department by name or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button type="submit" variant="outline" disabled={searching}>
              {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search
            </Button>
            <div className="space-y-1.5">
              <Label htmlFor="monthly-month">Month</Label>
              <Input
                id="monthly-month"
                type="month"
                value={month}
                max={settings.default_month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-[170px]"
              />
            </div>
          </form>

          {results ? (
            results.length ? (
              <ul className="divide-y rounded-lg border" aria-label="Recipients">
                {results.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {r.name}
                        {r.is_test_account ? (
                          <Badge variant="outline" className="ml-2">
                            Test account
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.email} · {r.audiences.map((a) => AUDIENCE_LABELS[a]).join(", ")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={recipient?.id === r.id ? "default" : "outline"}
                      disabled={!month || previewing}
                      onClick={() => {
                        setRecipient(r);
                        void runPreview(r);
                      }}
                    >
                      Preview
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No faculty, Officer in Charge or Head of Department matches.</p>
            )
          ) : null}

          {previewing ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Building the preview…
            </div>
          ) : null}

          {preview && !previewing ? (
            <div className="space-y-2" data-testid="monthly-preview">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{preview.subject}</span>
                {preview.active_audiences.map((a) => (
                  <Badge key={a} variant="secondary">
                    {AUDIENCE_LABELS[a]}
                  </Badge>
                ))}
                {preview.excel ? <Badge variant="outline">Excel attached</Badge> : null}
              </div>
              <p className={preview.would_send ? "text-sm text-emerald-700" : "text-sm text-amber-700"}>
                {preview.would_send ? `Would be sent for ${preview.month_label}.` : preview.reason}
              </p>
              <iframe
                title="Monthly report preview"
                srcDoc={preview.html}
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                className="h-[900px] w-full rounded-lg border bg-white"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
