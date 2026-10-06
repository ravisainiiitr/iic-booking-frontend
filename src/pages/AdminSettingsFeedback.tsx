import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, type PortalFeedbackAdminParams } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Download, Loader2, RefreshCw, Search, Star, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { USER_TYPE_DISPLAY_NAMES } from "@/lib/userTypes";
import { cn } from "@/lib/utils";

type FeedbackRow = {
  feedback_id: number;
  user_name: string;
  user_email: string;
  user_type: string;
  user_type_display: string | null;
  department_name: string | null;
  overall_rating: number;
  ease_of_booking: number;
  website_usability: number;
  equipment_booking_experience: number;
  average_rating: number;
  suggestions: string;
  comments: string;
  created_at: string;
  updated_at: string;
};

type Stats = {
  total: number;
  avg_overall: number;
  avg_ease_of_booking: number;
  avg_website_usability: number;
  avg_equipment_booking_experience: number;
  rating_distribution: Record<string, number>;
  by_user_type: Array<{ user_type: string | null; count: number; avg_overall: number }>;
};

type SortField = "user__name" | "user__user_type" | "overall_rating" | "updated_at";

const PAGE_SIZES = [25, 50, 100];

const RATING_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Any rating" },
  { value: "eq:5", label: "5 stars" },
  { value: "eq:4", label: "4 stars" },
  { value: "eq:3", label: "3 stars" },
  { value: "eq:2", label: "2 stars" },
  { value: "eq:1", label: "1 star" },
  { value: "gte:4", label: "4 stars and above" },
  { value: "lte:2", label: "2 stars and below" },
];

function ratingParams(value: string): Pick<PortalFeedbackAdminParams, "rating" | "min_rating" | "max_rating"> {
  const [op, raw] = value.split(":");
  const n = Number(raw);
  if (!raw || Number.isNaN(n)) return {};
  if (op === "eq") return { rating: n };
  if (op === "gte") return { min_rating: n };
  if (op === "lte") return { max_rating: n };
  return {};
}

function formatDate(value: string | null | undefined, pattern = "d MMM yyyy") {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : format(d, pattern);
}

function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`} title={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(cls, i <= value ? "fill-amber-400 text-amber-500" : "text-muted-foreground/30")}
        />
      ))}
    </span>
  );
}

const AdminSettingsFeedback = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const isAdmin = String(user?.user_type || "").toLowerCase() === "admin";

  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [userType, setUserType] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortDesc, setSortDesc] = useState(true);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<FeedbackRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 400);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const filters = useMemo<PortalFeedbackAdminParams>(
    () => ({
      search: search || undefined,
      user_type: userType !== "all" ? userType : undefined,
      ...ratingParams(ratingFilter),
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      ordering: `${sortDesc ? "-" : ""}${sortField}`,
    }),
    [search, userType, ratingFilter, dateFrom, dateTo, sortField, sortDesc]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getPortalFeedbackAdmin({ ...filters, limit: pageSize, offset: page * pageSize });
      if (res.error) {
        toast.error(res.error);
        setRows([]);
        setStats(null);
        setCount(0);
        return;
      }
      setRows((res.data?.feedback || []) as FeedbackRow[]);
      setStats(res.data?.stats || null);
      setCount(res.data?.count || 0);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) void load();
  }, [isAuthenticated, isAdmin, load]);

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(0);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDesc((d) => !d);
    } else {
      setSortField(field);
      setSortDesc(field === "updated_at" || field === "overall_rating");
    }
    setPage(0);
  };

  const hasFilters = Boolean(search || userType !== "all" || ratingFilter !== "all" || dateFrom || dateTo);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setUserType("all");
    setRatingFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await apiClient.downloadPortalFeedbackCsv(filters);
      if (res.error || !res.blob) {
        toast.error(res.error || "Export failed");
        return;
      }
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename || "portal-feedback.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const userTypeOptions = useMemo(
    () => Object.entries(USER_TYPE_DISPLAY_NAMES).sort((a, b) => a[1].localeCompare(b[1])),
    []
  );

  if (!isAuthenticated || !isAdmin) {
    return (
      <PageShell>
        <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
          Main Administrator access required.
        </div>
      </PageShell>
    );
  }

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const firstRow = count === 0 ? 0 : page * pageSize + 1;
  const lastRow = Math.min(count, (page + 1) * pageSize);
  const distributionTotal = stats ? Object.values(stats.rating_distribution).reduce((a, b) => a + b, 0) : 0;

  const sortHead = (field: SortField, label: string, className?: string) => {
    const active = sortField === field;
    const Icon = !active ? ArrowUpDown : sortDesc ? ArrowDown : ArrowUp;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground font-semibold")}
        >
          {label}
          <Icon className="h-3.5 w-3.5" />
        </button>
      </TableHead>
    );
  };

  return (
    <PageShell>
      <main className="container mx-auto px-4 py-5 space-y-5">
        <StandaloneOnly>
          <PageHero
            title="Rate your experience — responses"
            description="Ratings and suggestions users shared through “Rate your experience”. Each user has one response, which they can update."
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin-settings")}
              className="mb-4 text-white/90 hover:text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Admin Settings
            </Button>
          </PageHero>
        </StandaloneOnly>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => void exportCsv()} disabled={exporting || count === 0}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export CSV
          </Button>
        </div>

        {stats && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Responses", value: String(stats.total), stars: null as number | null },
              { label: "Average overall", value: stats.avg_overall.toFixed(2), stars: stats.avg_overall },
              { label: "Ease of booking", value: stats.avg_ease_of_booking.toFixed(2), stars: stats.avg_ease_of_booking },
              { label: "Website usability", value: stats.avg_website_usability.toFixed(2), stars: stats.avg_website_usability },
              {
                label: "Equipment booking",
                value: stats.avg_equipment_booking_experience.toFixed(2),
                stars: stats.avg_equipment_booking_experience,
              },
            ].map((s) => (
              <Card key={s.label}>
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardDescription>{s.label}</CardDescription>
                  <CardTitle className="text-2xl flex items-baseline gap-2">
                    {s.value}
                    {s.stars != null && <span className="text-sm font-normal text-muted-foreground">/ 5</span>}
                  </CardTitle>
                  {s.stars != null && <Stars value={Math.round(s.stars)} />}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {stats && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Overall rating distribution</CardTitle>
                <CardDescription>Click a row to show only that rating.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {[5, 4, 3, 2, 1].map((r) => {
                  const n = stats.rating_distribution[String(r)] || 0;
                  const pct = distributionTotal ? Math.round((n / distributionTotal) * 100) : 0;
                  const active = ratingFilter === `eq:${r}`;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => resetPage(setRatingFilter)(active ? "all" : `eq:${r}`)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2 py-1 text-sm hover:bg-muted/60",
                        active && "bg-primary/10"
                      )}
                    >
                      <span className="flex w-12 shrink-0 items-center gap-1 font-medium">
                        {r} <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                      </span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-20 shrink-0 text-right text-muted-foreground">
                        {n} ({pct}%)
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By user type</CardTitle>
                <CardDescription>Responses and average overall rating.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {stats.by_user_type.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No responses yet.</p>
                ) : (
                  stats.by_user_type.map((row) => (
                    <Badge key={row.user_type || "none"} variant="secondary" className="gap-1.5 py-1 text-xs font-normal">
                      <span className="font-medium">
                        {(row.user_type && USER_TYPE_DISPLAY_NAMES[row.user_type]) || row.user_type || "Unknown"}
                      </span>
                      <span>· {row.count}</span>
                      <span>· {row.avg_overall.toFixed(1)}★</span>
                    </Badge>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px] space-y-1">
                <p className="text-xs text-muted-foreground">Search</p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Name, email, department, comment…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">User type</p>
                <Select value={userType} onValueChange={resetPage(setUserType)}>
                  <SelectTrigger className="w-[190px]">
                    <SelectValue placeholder="All user types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All user types</SelectItem>
                    {userTypeOptions.map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Overall rating</p>
                <Select value={ratingFilter} onValueChange={resetPage(setRatingFilter)}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RATING_FILTERS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">From</p>
                <DateInput
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => resetPage(setDateFrom)(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">To</p>
                <DateInput
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => resetPage(setDateTo)(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              {hasFilters && (
                <Button variant="ghost" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Dates filter on when the response was last submitted or updated. Summary figures reflect the current filters.
            </p>

            {loading && rows.length === 0 ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">
                {hasFilters ? "No responses match these filters." : "No one has rated their experience yet."}
              </p>
            ) : (
              <>
                <div className={cn("overflow-x-auto rounded-xl border", loading && "opacity-60")}>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        {sortHead("user__name", "User")}
                        {sortHead("user__user_type", "User type")}
                        <TableHead>Department</TableHead>
                        {sortHead("overall_rating", "Overall")}
                        <TableHead className="whitespace-nowrap">Ease · Usability · Equipment</TableHead>
                        <TableHead>Comment</TableHead>
                        {sortHead("updated_at", "Date", "whitespace-nowrap")}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => {
                        const comment = [r.suggestions, r.comments].filter((t) => t && t.trim()).join(" — ");
                        return (
                          <TableRow
                            key={r.feedback_id}
                            className="cursor-pointer hover:bg-primary/5 dark:hover:bg-primary/10 align-top"
                            onClick={() => setSelected(r)}
                          >
                            <TableCell>
                              <div className="font-medium">{r.user_name || "—"}</div>
                              <div className="text-xs text-muted-foreground">{r.user_email}</div>
                            </TableCell>
                            <TableCell className="text-sm">{r.user_type_display || r.user_type || "—"}</TableCell>
                            <TableCell className="text-sm">{r.department_name || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Stars value={r.overall_rating} />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {r.ease_of_booking}★ · {r.website_usability}★ · {r.equipment_booking_experience}★
                            </TableCell>
                            <TableCell className="max-w-[320px] text-sm">
                              {comment ? (
                                <span className="line-clamp-2 whitespace-pre-line" title={comment}>
                                  {comment}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap" title={`First submitted ${formatDate(r.created_at)}`}>
                              {formatDate(r.updated_at)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>
                    Showing {firstRow}–{lastRow} of {count}
                  </span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        setPageSize(Number(v));
                        setPage(0);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} / page
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 0 || loading}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <span>
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page + 1 >= totalPages || loading}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.user_name || selected.user_email}</DialogTitle>
                <DialogDescription>
                  {[selected.user_email, selected.user_type_display || selected.user_type, selected.department_name]
                    .filter(Boolean)
                    .join(" · ")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Overall", value: selected.overall_rating },
                    { label: "Ease of booking", value: selected.ease_of_booking },
                    { label: "Website usability", value: selected.website_usability },
                    { label: "Equipment booking", value: selected.equipment_booking_experience },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border p-2.5">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <Stars value={item.value} size="md" />
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suggestions</p>
                  <p className="mt-1 whitespace-pre-wrap">{selected.suggestions?.trim() || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Additional comments</p>
                  <p className="mt-1 whitespace-pre-wrap">{selected.comments?.trim() || "—"}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  First submitted {formatDate(selected.created_at, "d MMM yyyy, h:mm a")} · Last updated{" "}
                  {formatDate(selected.updated_at, "d MMM yyyy, h:mm a")}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default AdminSettingsFeedback;
