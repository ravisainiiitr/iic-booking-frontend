import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api";
import type { RegistrationLogFilters, RegistrationLogPage } from "@/lib/registrationApprovalTypes";
import { channelLabel, EventDetails, formatMoment, roleLabel } from "./shared";

const ALL = "__all";
const ROLES = ["main_admin", "faculty", "user", "system"];

export default function RegistrationLogTab({ onOpenUser }: { onOpenUser: (userId: number) => void }) {
  const [filters, setFilters] = useState<RegistrationLogFilters>({ page: 1, page_size: 50 });
  const [search, setSearch] = useState("");
  const [data, setData] = useState<RegistrationLogPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getRegistrationLog(filters);
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load the log.");
      return;
    }
    setData(res.data);
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search, page: 1 })), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const set = (patch: Partial<RegistrationLogFilters>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));

  const exportCsv = async () => {
    setExporting(true);
    const res = await apiClient.downloadRegistrationLogCsv(filters);
    setExporting(false);
    if (res.error) toast.error(res.error);
  };

  const pages = data ? Math.max(1, Math.ceil(data.count / (data.page_size || 50))) : 1;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1 lg:col-span-2">
            <Label htmlFor="reglog-q">Search</Label>
            <Input id="reglog-q" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="User or actor name / email" />
          </div>
          <div className="space-y-1">
            <Label>Event</Label>
            <Select value={filters.action || ALL} onValueChange={(v) => set({ action: v === ALL ? undefined : v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All events</SelectItem>
                {(data?.actions ?? []).map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Who</Label>
            <Select value={filters.actor_role || ALL} onValueChange={(v) => set({ actor_role: v === ALL ? undefined : v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Everyone</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="reglog-from">From</Label>
            <DateInput id="reglog-from" value={filters.date_from ?? ""} onChange={(e) => set({ date_from: e.target.value || undefined })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="reglog-to">To</Label>
            <DateInput id="reglog-to" value={filters.date_to ?? ""} onChange={(e) => set({ date_to: e.target.value || undefined })} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{data ? `${data.count} event(s)` : ""}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
              {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
              Export CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>User</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Channel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : data?.results.length ? (
                data.results.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap align-top text-xs">{formatMoment(e.at)}</TableCell>
                    <TableCell className="align-top">
                      <p className="text-sm font-medium">{e.action_label}</p>
                      <EventDetails details={e.details} />
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      {e.user_id ? (
                        <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => onOpenUser(e.user_id as number)}>
                          {e.user_name || e.user_email}
                        </button>
                      ) : (
                        e.user_name || e.user_email || "—"
                      )}
                      {e.user_email ? <p className="text-xs text-muted-foreground">{e.user_email}</p> : null}
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      {e.actor_name || e.actor_email || "—"}
                      <p className="text-xs text-muted-foreground">{roleLabel(e.actor_role)}</p>
                    </TableCell>
                    <TableCell className="align-top text-xs">
                      {channelLabel(e.channel)}
                      {e.ip_address ? <p className="text-muted-foreground">{e.ip_address}</p> : null}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No events match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {pages > 1 ? (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}>
              Previous
            </Button>
            <span>
              Page {filters.page ?? 1} of {pages}
            </span>
            <Button variant="outline" size="sm" disabled={(filters.page ?? 1) >= pages} onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}>
              Next
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
