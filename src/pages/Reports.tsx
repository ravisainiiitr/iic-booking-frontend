import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiClient, type FacultyWalletExpenseReportData } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardHeader from "@/components/DashboardHeader";
import { useToast } from "@/hooks/use-toast";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Calendar,
  IndianRupee,
  Clock,
  TrendingUp,
  ArrowRight,
  Loader2,
  FileDown,
  FileSpreadsheet,
  Package,
  Users,
  Building2,
  FlaskConical,
  Star,
  Wallet,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

interface BookingStats {
  totalBookings: number;
  totalSpent: number;
  totalHours: number;
  statusCounts: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  BOOKED: "#22c55e",
  PENDING: "#eab308",
  COMPLETED: "#3b82f6",
  CANCELLED: "#ef4444",
  ABSENT: "#f97316",
  REFUNDED: "#8b5cf6",
  BOOKING_NOT_UTILIZED: "#d97706",
  UNKNOWN: "#94a3b8",
};

const UTILIZATION_PIE_COLORS = ["#22c55e", "#a855f7", "#f97316", "#eab308", "#64748b"];

const getStatusColor = (status: string) => STATUS_COLORS[status] ?? "#94a3b8";

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Year-to-date: 1 Jan of current year through today (local). */
function getDefaultReportDateRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  return { from: `${y}-01-01`, to: formatYmdLocal(now) };
}

function formatReportDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

type EquipmentReportData = Awaited<ReturnType<typeof apiClient.getEquipmentReportData>>["data"];

function ReportBanner({ header }: { header: NonNullable<EquipmentReportData>["report_header"] }) {
  const fullTitle = header.report_title || "";
  const forMarker = " for ";
  const forIdx = fullTitle.indexOf(forMarker);
  const titleMain = forIdx === -1 ? fullTitle.trim() : fullTitle.slice(0, forIdx).trim();
  const titleEquipment = forIdx === -1 ? "" : fullTitle.slice(forIdx + forMarker.length).trim();
  const durationHuman = header.period_display ?? "";
  const durationSuffix = header.report_duration_suffix ?? "";
  return (
    <div className="mb-6 rounded-xl border bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-6 text-white shadow-lg">
      <p className="text-sm font-medium uppercase tracking-wider text-teal-200/90">{header.institute_name}</p>
      <p className="text-lg text-slate-200">{header.organization}</p>
      <h3 className="mt-3 text-left text-2xl font-bold tracking-tight break-words">
        <span>{titleMain}</span>
        {titleEquipment ? (
          <span className="font-extrabold text-teal-100">
            {forMarker}
            {titleEquipment}
          </span>
        ) : null}
      </h3>
      <p className="mt-2 text-sm text-slate-300">
        <span className="font-semibold text-slate-200">Report Duration: </span>
        {durationHuman}
        {durationSuffix}
      </p>
    </div>
  );
}

const Reports = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<BookingStats>({
    totalBookings: 0,
    totalSpent: 0,
    totalHours: 0,
    statusCounts: {},
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  /** Lab Incharge (operator): restricted view — equipment performance only. */
  const [isLabInchargeUser, setIsLabInchargeUser] = useState(false);
  /** IITR Faculty: research-group wallet spend vs balance (linked students). */
  const [isFacultyUser, setIsFacultyUser] = useState(false);
  const [facultyReportData, setFacultyReportData] = useState<FacultyWalletExpenseReportData | null>(null);
  const [facultyReportLoading, setFacultyReportLoading] = useState(false);
  const [facultyDateFrom, setFacultyDateFrom] = useState(() => getDefaultReportDateRange().from);
  const [facultyDateTo, setFacultyDateTo] = useState(() => getDefaultReportDateRange().to);
  const [facultyEquipmentId, setFacultyEquipmentId] = useState<string>("all");
  const [facultyEquipmentOptions, setFacultyEquipmentOptions] = useState<
    Array<{ equipment_id: number; name: string; code: string }>
  >([]);
  const [facultyExpandedMembers, setFacultyExpandedMembers] = useState<Record<number, boolean>>({});

  // Equipment utilization (admin only)
  const [equipmentReportData, setEquipmentReportData] = useState<EquipmentReportData | null>(null);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => getDefaultReportDateRange().from);
  const [dateTo, setDateTo] = useState(() => getDefaultReportDateRange().to);
  const [equipmentId, setEquipmentId] = useState<string>("all");
  const [equipmentList, setEquipmentList] = useState<Array<{ equipment_id: number; name: string; code: string }>>([]);
  /** After equipment list fetch completes (so auto-report waits for default equipment id). */
  const [equipmentListLoaded, setEquipmentListLoaded] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  useEffect(() => {
    checkAuthAndFetchStats();
  }, []);

  const checkAuthAndFetchStats = async () => {
    const token = apiClient.getToken();
    if (!token) {
      navigate("/auth");
      return;
    }

    const userResponse = await apiClient.getCurrentUser();
    if (userResponse.error || !userResponse.data) {
      navigate("/auth");
      return;
    }

    const adminByType = apiClient.isAdminPanelUser(userResponse.data.user_type);
    const adminCheck = await apiClient.checkAdminRole(String(userResponse.data.id));
    setIsAdmin(adminByType || adminCheck.data?.is_admin === true);
    const labIncharge = String(userResponse.data.user_type || "").toLowerCase() === "operator";
    setIsLabInchargeUser(labIncharge);
    const faculty = String(userResponse.data.user_type || "").toLowerCase() === "faculty";
    setIsFacultyUser(faculty);

    if (!labIncharge) {
      fetchStats();
    } else {
      setLoading(false);
    }

    if (adminByType || adminCheck.data?.is_admin === true) {
      loadEquipmentList();
    } else if (!labIncharge) {
      setLoading(false);
    }

  };

  const fetchStats = async () => {
    const response = await apiClient.getBookingStats();
    if (response.data) {
      setStats({
        totalBookings: Number(response.data.total_bookings || 0),
        totalSpent: Number(response.data.total_spent || 0),
        totalHours: Number(response.data.total_hours || 0),
        statusCounts: response.data.status_counts || {},
      });
    }
    setLoading(false);
  };

  const loadEquipmentList = async () => {
    try {
      const res = await apiClient.adminList<{ equipment_id: number; name: string; code: string }>("equipment");
      const raw = res.data;
      const list = Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object" && "results" in raw
          ? (raw as { results: Array<{ equipment_id: number; name: string; code: string }> }).results
          : [];
      setEquipmentList(list);
      if (list.length > 0) {
        setEquipmentId(String(list[0].equipment_id));
      }
    } catch {
      setEquipmentList([]);
    } finally {
      setEquipmentListLoaded(true);
    }
  };

  const loadEquipmentReport = useCallback(async () => {
    setEquipmentLoading(true);
    const params: { date_from?: string; date_to?: string; equipment_id?: number[] } = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (equipmentId && equipmentId !== "all") params.equipment_id = [Number(equipmentId)];
    const res = await apiClient.getEquipmentReportData(params);
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
      setEquipmentReportData(null);
    } else if (res.data) {
      setEquipmentReportData(res.data);
    }
    setEquipmentLoading(false);
  }, [dateFrom, dateTo, equipmentId, toast]);

  useEffect(() => {
    if (!isAdmin || !dateFrom || !dateTo || !equipmentListLoaded) return;
    loadEquipmentReport();
  }, [isAdmin, dateFrom, dateTo, equipmentListLoaded, equipmentId, loadEquipmentReport]);

  const facultyEquipmentFetched = useRef(false);

  useEffect(() => {
    if (!isFacultyUser || isLabInchargeUser) return;
    if (facultyEquipmentFetched.current) return;
    facultyEquipmentFetched.current = true;
    (async () => {
      try {
        const eqRes = await apiClient.getEquipments(undefined, "ACTIVE");
        const list = eqRes.data?.equipments ?? [];
        setFacultyEquipmentOptions(
          list.map((e) => ({ equipment_id: e.equipment_id, name: e.name, code: e.code }))
        );
      } catch {
        setFacultyEquipmentOptions([]);
      }
    })();
  }, [isFacultyUser, isLabInchargeUser]);

  const loadFacultyExpenseReport = useCallback(async () => {
    if (!isFacultyUser || isLabInchargeUser) return;
    setFacultyReportLoading(true);
    const params: { date_from?: string; date_to?: string; equipment_id?: number } = {
      date_from: facultyDateFrom,
      date_to: facultyDateTo,
    };
    if (facultyEquipmentId !== "all") params.equipment_id = Number(facultyEquipmentId);
    const res = await apiClient.getFacultyWalletExpenseReport(params);
    if (res.error) {
      toast({ title: "Report unavailable", description: res.error, variant: "destructive" });
      setFacultyReportData(null);
    } else if (res.data) {
      setFacultyReportData(res.data);
    }
    setFacultyReportLoading(false);
  }, [isFacultyUser, isLabInchargeUser, facultyDateFrom, facultyDateTo, facultyEquipmentId, toast]);

  useEffect(() => {
    if (!isFacultyUser || isLabInchargeUser) return;
    void loadFacultyExpenseReport();
  }, [isFacultyUser, isLabInchargeUser, loadFacultyExpenseReport]);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    const params: { date_from?: string; date_to?: string; equipment_id?: number[] } = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (equipmentId && equipmentId !== "all") params.equipment_id = [Number(equipmentId)];
    const res = await apiClient.downloadEquipmentReportPdf(params);
    setDownloadingPdf(false);
    if (res.error) toast({ title: "Download failed", description: res.error, variant: "destructive" });
    else toast({ title: "Download started", description: "PDF report is downloading." });
  };

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    const params: { date_from?: string; date_to?: string; equipment_id?: number[] } = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (equipmentId && equipmentId !== "all") params.equipment_id = [Number(equipmentId)];
    const res = await apiClient.downloadEquipmentReportExcel(params);
    setDownloadingExcel(false);
    if (res.error) toast({ title: "Download failed", description: res.error, variant: "destructive" });
    else toast({ title: "Download started", description: "Excel report is downloading." });
  };

  const pieData = useMemo(
    () =>
      Object.entries(stats.statusCounts).map(([name, value]) => ({
        name: name.replace(/_/g, " "),
        value,
        fill: getStatusColor(name),
      })),
    [stats.statusCounts]
  );

  const barData = useMemo(
    () =>
      Object.entries(stats.statusCounts).map(([name, value]) => ({
        status: name.replace(/_/g, " "),
        count: value,
        fill: getStatusColor(name),
      })),
    [stats.statusCounts]
  );

  const utilizationPieData = useMemo(
    () =>
      equipmentReportData?.utilization_pie?.map((p, i) => ({
        ...p,
        fill: UTILIZATION_PIE_COLORS[i % UTILIZATION_PIE_COLORS.length],
      })) ?? [],
    [equipmentReportData]
  );

  const utilizationPieTotalHours = useMemo(
    () => utilizationPieData.reduce((s, x) => s + (Number(x.hours) || 0), 0),
    [utilizationPieData]
  );

  const averageCost = stats.totalBookings > 0 ? stats.totalSpent / stats.totalBookings : 0;

  const facultyBarData = useMemo(() => {
    if (!facultyReportData?.by_member?.length) return [];
    return facultyReportData.by_member.slice(0, 16).map((m) => ({
      label: m.name.length > 32 ? `${m.name.slice(0, 29)}…` : m.name,
      spend: Number(m.total_spend) || 0,
    }));
  }, [facultyReportData]);

  if (loading) {
    return (
      <div className="page-shell flex flex-col items-center justify-center">
        <DashboardHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-teal-700" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-700 p-6 sm:p-8 text-white shadow-xl">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {isLabInchargeUser ? "Equipment performance reports" : "Reports & Statistics"}
          </h1>
          <p className="mt-2 text-white/85 text-sm sm:text-base max-w-3xl">
            {isLabInchargeUser
              ? "Monthly-style performance metrics (users, samples, hours, working-window availability, ratings) for your assigned equipment. Export to PDF or Excel."
              : isFacultyUser
                ? "Your personal booking overview is below. The research-group wallet panel summarises spend by linked students against your consolidated balance, recharges, and optional equipment filters."
                : "Click any section to view the full list of bookings with amount spent."}
          </p>
        </div>

        {isFacultyUser && !isLabInchargeUser && (
          <Card className="mb-10 overflow-hidden border-teal-200/60 shadow-md dark:border-teal-900/50 rounded-2xl">
            <div className="border-b bg-gradient-to-r from-teal-900 via-teal-800 to-cyan-900 px-6 py-5 text-white">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-teal-50">
                    Research group wallet & booking spend
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm text-teal-100/80">
                    Consolidated view for your supervisor wallet and approved linked members: period spend vs current
                    balance, recharges credited in the same window, and per-member / per-equipment splits.
                  </p>
                </div>
                <Wallet className="h-10 w-10 shrink-0 text-teal-100/90 opacity-90" aria-hidden />
              </div>
            </div>
            <CardContent className="space-y-6 pt-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>Date from</Label>
                  <Input
                    type="date"
                    value={facultyDateFrom}
                    onChange={(e) => setFacultyDateFrom(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date to</Label>
                  <Input
                    type="date"
                    value={facultyDateTo}
                    onChange={(e) => setFacultyDateTo(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Equipment</Label>
                  <Select value={facultyEquipmentId} onValueChange={setFacultyEquipmentId}>
                    <SelectTrigger className="w-[min(100vw-3rem,22rem)]">
                      <SelectValue placeholder="All equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All equipment</SelectItem>
                      {facultyEquipmentOptions.map((eq) => (
                        <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                          {eq.code} – {eq.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="secondary" onClick={() => void loadFacultyExpenseReport()} disabled={facultyReportLoading}>
                  {facultyReportLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Refresh
                </Button>
              </div>

              {facultyReportLoading && !facultyReportData ? (
                <div className="flex justify-center py-14">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
              ) : facultyReportData ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border bg-card p-4 shadow-sm">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current balance</p>
                      <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                        ₹{Number(facultyReportData.current_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Sum of all department sub-wallets</p>
                    </div>
                    <div className="rounded-xl border bg-card p-4 shadow-sm">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Period booking spend</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                        ₹{Number(facultyReportData.period_booking_spend?.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {facultyReportData.period_booking_spend?.booking_count ?? 0} booking(s) in range
                        {facultyReportData.equipment_filter_id != null ? " (filtered)" : ""}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-card p-4 shadow-sm">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recharges (period)</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                        ₹
                        {Number(facultyReportData.period_wallet_movements?.recharges_and_similar_credits || 0).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Credits excluding refunds & internal transfers</p>
                    </div>
                    <div className="rounded-xl border bg-card p-4 shadow-sm">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wallet members</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {facultyReportData.member_user_ids?.length ?? 0}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {facultyReportData.linked_students?.length ?? 0} linked student(s) + supervisor
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border p-4">
                      <p className="mb-3 text-sm font-semibold">Spend share by member</p>
                      {facultyBarData.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">No booking spend in this period</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={Math.max(280, facultyBarData.length * 36)}>
                          <BarChart data={facultyBarData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                            <XAxis type="number" tickFormatter={(v) => `₹${v}`} />
                            <YAxis type="category" dataKey="label" width={168} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v: number) => [`₹${Number(v).toFixed(2)}`, "Spend"]} />
                            <Bar dataKey="spend" name="Spend" fill="#0f766e" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="mb-3 text-sm font-semibold">Wallet movements (same date range)</p>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between border-b border-dashed pb-2">
                          <span className="text-muted-foreground">Total debits</span>
                          <span className="font-medium">₹{Number(facultyReportData.period_wallet_movements?.total_debits || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b border-dashed pb-2">
                          <span className="text-muted-foreground">Total credits</span>
                          <span className="font-medium">₹{Number(facultyReportData.period_wallet_movements?.total_credits || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b border-dashed pb-2">
                          <span className="text-muted-foreground">Refund credits</span>
                          <span className="font-medium text-amber-700 dark:text-amber-300">
                            ₹{Number(facultyReportData.period_wallet_movements?.refund_credits || 0).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Booking spend totals use confirmed booking charges in the period (excludes cancelled, refunded, waitlisted, and pending).
                          Recharge totals exclude refund lines and sub-wallet transfers so you can compare inflows to current balance.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-sm font-semibold">Approved recharges (accounts team)</p>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Offline recharge requests approved in this date range. Project head (PI) is taken from the linked
                      project; legacy free-text project details appear when no project was selected.
                    </p>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead>Credited (approved)</TableHead>
                            <TableHead>Submitted</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Funding agency</TableHead>
                            <TableHead>Project head (PI)</TableHead>
                            <TableHead>Requested by</TableHead>
                            <TableHead>Accounts / notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(facultyReportData.approved_recharges?.length ?? 0) === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                                No accounts-team recharges were approved in this period.
                              </TableCell>
                            </TableRow>
                          ) : (
                            facultyReportData.approved_recharges!.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell className="whitespace-nowrap text-sm">
                                    {formatReportDateTime(row.responded_at)}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                    {formatReportDateTime(row.created_at)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium whitespace-nowrap">
                                    ₹{Number(row.amount || 0).toLocaleString("en-IN", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </TableCell>
                                  <TableCell className="text-sm">{row.department_name}</TableCell>
                                  <TableCell className="text-sm max-w-[14rem]">
                                    {row.project_name?.trim() ? (
                                      <>
                                        <span className="font-medium">{row.project_name}</span>
                                        {row.project_code?.trim() ? (
                                          <span className="block text-xs text-muted-foreground font-mono mt-0.5">
                                            {row.project_code}
                                          </span>
                                        ) : null}
                                      </>
                                    ) : row.project_details_legacy?.trim() ? (
                                      <span className="text-muted-foreground line-clamp-3">{row.project_details_legacy}</span>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm max-w-[12rem]">
                                    {row.project_agency?.trim() || "—"}
                                  </TableCell>
                                  <TableCell className="text-sm max-w-[12rem]">
                                    {row.project_head_name || row.project_head_email ? (
                                      <>
                                        <div className="font-medium">{row.project_head_name || "—"}</div>
                                        {row.project_head_email ? (
                                          <div className="text-xs text-muted-foreground">{row.project_head_email}</div>
                                        ) : null}
                                      </>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm max-w-[11rem]">
                                    <div>{row.requested_by_name}</div>
                                    <div className="text-xs text-muted-foreground">{row.requested_by_email}</div>
                                  </TableCell>
                                  <TableCell className="text-sm max-w-[14rem]">
                                    {row.approved_by_email ? (
                                      <div className="text-xs text-muted-foreground mb-1">{row.approved_by_email}</div>
                                    ) : null}
                                    {row.response_message ? (
                                      <span className="line-clamp-3">{row.response_message}</span>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {facultyReportData.sub_wallets && facultyReportData.sub_wallets.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold">Balance by department (sub-wallets)</p>
                      <div className="overflow-x-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Department</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {facultyReportData.sub_wallets.map((sw) => (
                              <TableRow key={sw.department_id}>
                                <TableCell className="font-medium">{sw.department_name}</TableCell>
                                <TableCell className="text-right">₹{Number(sw.balance || 0).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-sm font-semibold">Per-member spend & equipment break-up</p>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Expand a row to see how much each member spent on individual instruments (still within your date and equipment filters).
                    </p>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="w-10" />
                            <TableHead>Member</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Bookings</TableHead>
                            <TableHead className="text-right">Spend</TableHead>
                            <TableHead className="text-right">Share</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {facultyReportData.by_member.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                                No spend recorded for linked members in this period.
                              </TableCell>
                            </TableRow>
                          ) : (
                            facultyReportData.by_member.map((m) => {
                              const open = !!facultyExpandedMembers[m.user_id];
                              const hasEq = (m.by_equipment?.length ?? 0) > 0;
                              return (
                                <Fragment key={m.user_id}>
                                  <TableRow className={open ? "bg-muted/20" : undefined}>
                                    <TableCell className="align-middle">
                                      {hasEq ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          aria-expanded={open}
                                          onClick={() =>
                                            setFacultyExpandedMembers((prev) => ({ ...prev, [m.user_id]: !prev[m.user_id] }))
                                          }
                                        >
                                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </Button>
                                      ) : (
                                        <span className="inline-block w-8" />
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-medium">{m.name}</div>
                                      <div className="text-xs text-muted-foreground">{m.email}</div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{m.role_label}</TableCell>
                                    <TableCell className="text-right">{m.booking_count}</TableCell>
                                    <TableCell className="text-right font-medium">₹{Number(m.total_spend || 0).toFixed(2)}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">{m.share_of_period_spend_percent.toFixed(1)}%</TableCell>
                                  </TableRow>
                                  {open && hasEq ? (
                                    <TableRow className="bg-slate-50/80 dark:bg-slate-900/40">
                                      <TableCell colSpan={6} className="p-0">
                                        <div className="border-t px-4 py-3">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Equipment</TableHead>
                                                <TableHead className="text-right">Bookings</TableHead>
                                                <TableHead className="text-right">Spend</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {m.by_equipment.map((eq) => (
                                                <TableRow key={`${m.user_id}-${eq.equipment_id}`}>
                                                  <TableCell className="text-sm">
                                                    <span className="font-mono text-xs mr-2">{eq.equipment_code}</span>
                                                    {eq.equipment_name}
                                                  </TableCell>
                                                  <TableCell className="text-right">{eq.booking_count}</TableCell>
                                                  <TableCell className="text-right">₹{Number(eq.total_spend || 0).toFixed(2)}</TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ) : null}
                                </Fragment>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {facultyReportData.by_equipment.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold">Aggregate spend by equipment</p>
                      <div className="overflow-x-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Equipment</TableHead>
                              <TableHead className="text-right">Bookings</TableHead>
                              <TableHead className="text-right">Total spend</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {facultyReportData.by_equipment.map((eq) => (
                              <TableRow key={eq.equipment_id}>
                                <TableCell className="font-medium">
                                  <span className="font-mono text-xs text-muted-foreground mr-2">{eq.equipment_code}</span>
                                  {eq.equipment_name}
                                </TableCell>
                                <TableCell className="text-right">{eq.booking_count}</TableCell>
                                <TableCell className="text-right">₹{Number(eq.total_spend || 0).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-6">No data loaded.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* My bookings stats — hidden for Lab Incharge (operators see equipment section only) */}
        {!isLabInchargeUser && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link to="/reports/bookings" className="block group">
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-primary/40 hover:scale-[1.02]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Bookings
                </CardTitle>
                <Calendar className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-primary">{stats.totalBookings}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  View full list <ArrowRight className="h-3 w-3" />
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/reports/bookings" className="block group">
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-primary/40 hover:scale-[1.02]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Spent
                </CardTitle>
                <IndianRupee className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-primary">₹{stats.totalSpent.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  View amount details <ArrowRight className="h-3 w-3" />
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/reports/bookings" className="block group">
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-primary/40 hover:scale-[1.02]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Hours Booked
                </CardTitle>
                <Clock className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-primary">{stats.totalHours.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  View booking list <ArrowRight className="h-3 w-3" />
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/reports/bookings" className="block group">
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-primary/40 hover:scale-[1.02]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg. Cost per Booking
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-primary">₹{averageCost.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  View all bookings <ArrowRight className="h-3 w-3" />
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
        )}

        {!isLabInchargeUser && (
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Booking Status (Pie Chart)</CardTitle>
              <CardDescription>Share of bookings by status</CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No bookings yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, "Bookings"]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Booking Status (Bar Chart)</CardTitle>
              <CardDescription>Count by status</CardDescription>
            </CardHeader>
            <CardContent>
              {barData.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No bookings yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Bookings" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
        )}

        {!isLabInchargeUser && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Booking Status Breakdown</CardTitle>
            <CardDescription>
              <Link to="/reports/bookings" className="text-primary hover:underline font-medium">
                View complete list of bookings with amount spent →
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.statusCounts).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No bookings yet</p>
            ) : (
              <div className="grid gap-3">
                {Object.entries(stats.statusCounts).map(([status, count]) => (
                  <Link
                    key={status}
                    to={`/reports/bookings?status=${encodeURIComponent(status)}`}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 hover:border-primary/30 transition-colors group"
                  >
                    <span className="font-medium capitalize">{status.replace(/_/g, " ")}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-primary">{count}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Equipment utilization reports (admin panel: admin, manager, operator, finance) */}
        {isAdmin && (
          <>
            {!isLabInchargeUser && (
              <>
                <h2 className="text-2xl font-bold mb-2 mt-10">Equipment performance reports</h2>
                <p className="text-muted-foreground mb-6">
                  Monthly-style performance metrics (users, samples from input A, hours, working-window availability, ratings) with PDF/Excel export.
                  Scheduled emails go to each equipment&apos;s Officer(s) in charge and Lab operator(s) (one PDF per equipment).
                </p>
              </>
            )}

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Filters
                </CardTitle>
                <CardDescription>Set date range and optional equipment to generate or download the report.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>Date from</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
                </div>
                <div className="space-y-2">
                  <Label>Date to</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
                </div>
                <div className="space-y-2">
                  <Label>Equipment</Label>
                  <Select value={equipmentId} onValueChange={setEquipmentId}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="All equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All equipment</SelectItem>
                      {equipmentList.map((eq) => (
                        <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                          {eq.code} – {eq.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={loadEquipmentReport} disabled={equipmentLoading}>
                  {equipmentLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Generate report
                </Button>
                <Button variant="outline" onClick={handleDownloadPdf} disabled={downloadingPdf || equipmentLoading}>
                  {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
                  Download PDF
                </Button>
                <Button variant="outline" onClick={handleDownloadExcel} disabled={downloadingExcel || equipmentLoading}>
                  {downloadingExcel ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                  Download Excel
                </Button>
              </CardContent>
            </Card>

            {equipmentLoading && !equipmentReportData && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            )}

            {equipmentReportData && (
              <div className={equipmentLoading ? "relative opacity-60 pointer-events-none" : undefined}>
                {equipmentLoading && equipmentReportData ? (
                  <div className="absolute inset-0 z-10 flex items-start justify-center pt-24 bg-background/30">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  </div>
                ) : null}
                {equipmentReportData.report_header ? <ReportBanner header={equipmentReportData.report_header} /> : null}

                <div className="mb-4 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground/85">Report Duration: </span>
                  {equipmentReportData.report_header?.period_display ??
                    `${equipmentReportData.date_from} – ${equipmentReportData.date_to}`}
                  {equipmentReportData.report_header?.report_duration_suffix ?? ""}
                  <span className="mx-2 text-muted-foreground/80">·</span>
                  {equipmentReportData.summary.total_equipment} equipment
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <IndianRupee className="h-4 w-4" />
                        Revenue (total)
                      </CardTitle>
                      <CardDescription>Completed bookings in period</CardDescription>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      ₹{Number(equipmentReportData.summary.revenue_total || 0).toFixed(2)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Revenue (internal)</CardTitle>
                      <CardDescription>Students / faculty</CardDescription>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      ₹{Number(equipmentReportData.summary.revenue_internal || 0).toFixed(2)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Revenue (external)</CardTitle>
                      <CardDescription>External categories combined</CardDescription>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      ₹{Number(equipmentReportData.summary.revenue_external || 0).toFixed(2)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Utilization factor
                      </CardTitle>
                      <CardDescription>
                        BOOKED slot hours / all slot hours
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="text-2xl font-semibold">
                        {((Number(equipmentReportData.summary.utilization_factor || 0) || 0) * 100).toFixed(2)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Utilized: {Number(equipmentReportData.summary.utilized_hours || 0).toFixed(2)}h · Total:{" "}
                        {Number(equipmentReportData.summary.total_hours || 0).toFixed(2)}h · Downtime:{" "}
                        {Number(equipmentReportData.summary.downtime_hours || 0).toFixed(2)}h
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-teal-200/60 bg-gradient-to-br from-teal-50/80 to-background dark:from-teal-950/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4 text-teal-600" />
                        Working-window availability
                      </CardTitle>
                      <CardDescription>Mon–Fri, excl. holidays · slot time window</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="text-2xl font-semibold text-teal-800 dark:text-teal-200">
                        {Number(equipmentReportData.summary.available_hours_working_window || 0).toFixed(2)}h
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Completed in same window:{" "}
                        {Number(equipmentReportData.summary.completed_hours_in_working_window || 0).toFixed(2)}h
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-teal-200/60 bg-gradient-to-br from-teal-50/80 to-background dark:from-teal-950/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Package className="h-4 w-4 text-teal-700" />
                        Utilization vs capacity
                      </CardTitle>
                      <CardDescription>Completed hours / available working-window hours</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold text-teal-800 dark:text-teal-200">
                        {((Number(equipmentReportData.summary.utilization_vs_working_capacity || 0) || 0) * 100).toFixed(2)}%
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {equipmentReportData.financial && (
                  <div className="grid lg:grid-cols-2 gap-6 mb-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Revenue by user type</CardTitle>
                        <CardDescription>Internal + external category distribution</CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>User type</TableHead>
                              <TableHead className="text-right">Bookings</TableHead>
                              <TableHead className="text-right">Revenue</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(equipmentReportData.financial.revenue_by_user_type || []).map((r, idx) => (
                              <TableRow key={`${r.user_type_snapshot}-${idx}`}>
                                <TableCell className="font-medium">{String(r.user_type_snapshot || "—")}</TableCell>
                                <TableCell className="text-right">{Number(r.count || 0)}</TableCell>
                                <TableCell className="text-right">₹{Number(r.total || 0).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Revenue by department</CardTitle>
                        <CardDescription>Internal department split (where available)</CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Department</TableHead>
                              <TableHead className="text-right">Bookings</TableHead>
                              <TableHead className="text-right">Revenue</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(equipmentReportData.financial.revenue_by_department || []).map((r, idx) => (
                              <TableRow key={`${r.user__department__name}-${idx}`}>
                                <TableCell className="font-medium">{String(r.user__department__name || "—")}</TableCell>
                                <TableCell className="text-right">{Number(r.count || 0)}</TableCell>
                                <TableCell className="text-right">₹{Number(r.total || 0).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {equipmentReportData.financial && (
                  <div className="grid lg:grid-cols-2 gap-6 mb-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Revenue by equipment</CardTitle>
                        <CardDescription>Completed bookings revenue per equipment</CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Equipment</TableHead>
                              <TableHead className="text-right">Bookings</TableHead>
                              <TableHead className="text-right">Revenue</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(equipmentReportData.financial.revenue_by_equipment || []).slice(0, 30).map((r, idx) => (
                              <TableRow key={`${r.equipment_id}-${idx}`}>
                                <TableCell className="font-medium">
                                  {String(r.equipment__code || "")} – {String(r.equipment__name || "—")}
                                </TableCell>
                                <TableCell className="text-right">{Number(r.count || 0)}</TableCell>
                                <TableCell className="text-right">₹{Number(r.total || 0).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>External revenue by category</CardTitle>
                        <CardDescription>RND / Industry / Educational Institute / Other</CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-right">Bookings</TableHead>
                              <TableHead className="text-right">Revenue</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(equipmentReportData.financial.revenue_by_external_category || []).map((r, idx) => (
                              <TableRow key={`${r.user_type_snapshot}-${idx}`}>
                                <TableCell className="font-medium">{String(r.user_type_snapshot || "—")}</TableCell>
                                <TableCell className="text-right">{Number(r.count || 0)}</TableCell>
                                <TableCell className="text-right">₹{Number(r.total || 0).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="grid lg:grid-cols-2 gap-6 mb-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Overall equipment utilization</CardTitle>
                      <CardDescription>Share of hours by category (pie chart)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {utilizationPieData.length === 0 || (utilizationPieData.length === 1 && utilizationPieData[0].hours === 0) ? (
                        <p className="text-center text-muted-foreground py-8">No slot data in this period</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={320}>
                          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                            <Pie
                              data={utilizationPieData}
                              dataKey="hours"
                              nameKey="name"
                              cx="50%"
                              cy="45%"
                              outerRadius={88}
                              label={false}
                              labelLine={false}
                            >
                              {utilizationPieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number, name: string) => {
                                const h = Number(value) || 0;
                                const pct =
                                  utilizationPieTotalHours > 0
                                    ? ((h / utilizationPieTotalHours) * 100).toFixed(2)
                                    : "0";
                                return [`${h.toFixed(2)} h (${pct}%)`, name];
                              }}
                            />
                            <Legend
                              layout="vertical"
                              verticalAlign="middle"
                              align="right"
                              wrapperStyle={{ paddingLeft: 8, fontSize: 12 }}
                              formatter={(value, entry) => {
                                const h = Number((entry.payload as { hours?: number })?.hours) || 0;
                                const pct =
                                  utilizationPieTotalHours > 0
                                    ? ((h / utilizationPieTotalHours) * 100).toFixed(1)
                                    : "0";
                                return `${value} (${pct}%)`;
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Per-equipment charts</CardTitle>
                      <CardDescription>Slot-hour mix per equipment follows this section</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm">
                        Each equipment card below includes users, samples (input A), booking hours, working-window utilization, weekend/holiday slot hours, disruption hours, and user ratings.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-8 mb-10">
                  {equipmentReportData.equipment.map((eq) => {
                    const capBar = [
                      { label: "Available (work window)", h: Number(eq.available_hours_working_window ?? 0), fill: "#0d9488" },
                      { label: "Completed (work window)", h: Number(eq.completed_slot_hours_working_window ?? 0), fill: "#7c3aed" },
                    ];
                    const userBar = [
                      { label: "Internal users", n: eq.distinct_users_internal ?? 0, fill: "#2563eb" },
                      { label: "External users", n: eq.distinct_users_external ?? 0, fill: "#ea580c" },
                    ];
                    const critLabels: Record<string, string> = {
                      on_time_operator_availability: "On-time & operator availability",
                      laboratory_cleanliness_organization: "Lab cleanliness & organization",
                      sample_handling_care: "Sample handling & care",
                      operator_behaviour_professionalism: "Operator professionalism",
                      compliance_booking_request_parameters: "Compliance with request",
                    };
                    const ur = eq.user_ratings;
                    return (
                      <Card
                        key={eq.equipment_id}
                        className="overflow-hidden border-l-4 border-l-teal-600 shadow-md"
                      >
                        <CardHeader className="bg-gradient-to-r from-slate-50 to-teal-50/50 dark:from-slate-900 dark:to-teal-950/40">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <CardTitle className="text-xl flex items-center gap-2">
                                <FlaskConical className="h-5 w-5 text-teal-600" />
                                {eq.name}
                              </CardTitle>
                              <CardDescription className="mt-1 font-mono text-base text-foreground/80">
                                {eq.code}
                                <span className="ml-2 font-sans text-sm text-muted-foreground">
                                  · Slot window: {eq.slot_window_display ?? "—"}
                                </span>
                              </CardDescription>
                            </div>
                            <div className="text-right text-sm">
                              <span
                                className={
                                  eq.status === "ACTIVE"
                                    ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                                    : "inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                                }
                              >
                                {eq.status_display || eq.status || ""}
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                            <div className="flex items-start gap-2">
                              <Building2 className="h-4 w-4 mt-0.5 shrink-0 text-slate-500" />
                              <span>
                                <span className="font-medium text-foreground">OIC:</span>{" "}
                                {(eq.officers_in_charge || []).map((m) => m.name || m.email).join(", ") || "—"}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <Users className="h-4 w-4 mt-0.5 shrink-0 text-slate-500" />
                              <span>
                                <span className="font-medium text-foreground">Lab operator(s):</span>{" "}
                                {(eq.lab_operators || []).map((m) => m.name || m.email).join(", ") || "—"}
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-8 pt-6">
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-lg border bg-card p-4">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Distinct users served</p>
                              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{eq.distinct_users_served ?? 0}</p>
                              <p className="text-xs text-muted-foreground mt-1">Excl. cancelled / refunded / waitlist / pending</p>
                            </div>
                            <div className="rounded-lg border bg-card p-4">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Samples (input A)</p>
                              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{eq.total_samples ?? 0}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Int. {eq.samples_internal ?? 0} · Ext. {eq.samples_external ?? 0}
                              </p>
                            </div>
                            <div className="rounded-lg border bg-card p-4">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Booking hours</p>
                              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                                {Number(eq.total_booking_hours ?? 0).toFixed(1)}h
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Int. {Number(eq.booking_hours_internal ?? 0).toFixed(1)}h · Ext.{" "}
                                {Number(eq.booking_hours_external ?? 0).toFixed(1)}h
                              </p>
                            </div>
                            <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-950/30">
                              <p className="text-xs font-medium uppercase tracking-wide text-violet-800 dark:text-violet-200">
                                Utilization vs working capacity
                              </p>
                              <p className="mt-1 text-2xl font-bold text-violet-900 dark:text-violet-100">
                                {((Number(eq.utilization_vs_working_capacity ?? 0) || 0) * 100).toFixed(1)}%
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Weekend / holiday slot hours: {Number(eq.available_hours_weekend_or_holiday ?? 0).toFixed(1)}h
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-6 lg:grid-cols-2">
                            <div>
                              <p className="mb-2 text-sm font-semibold">Users: internal vs external (distinct)</p>
                              <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={userBar} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                  <YAxis allowDecimals={false} />
                                  <Tooltip />
                                  <Bar dataKey="n" name="Users" radius={[4, 4, 0, 0]}>
                                    {userBar.map((e, i) => (
                                      <Cell key={i} fill={e.fill} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            <div>
                              <p className="mb-2 text-sm font-semibold">Working window: available vs completed (hours)</p>
                              <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={capBar} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={56} />
                                  <YAxis />
                                  <Tooltip formatter={(v: number) => [`${v}h`, "Hours"]} />
                                  <Bar dataKey="h" name="Hours" radius={[4, 4, 0, 0]}>
                                    {capBar.map((e, i) => (
                                      <Cell key={i} fill={e.fill} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-sm font-semibold">Slot disposition (hours)</p>
                            <div className="overflow-x-auto rounded-lg border">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-slate-100 dark:bg-slate-800">
                                    <TableHead>Metric</TableHead>
                                    <TableHead className="text-right">Hours</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  <TableRow>
                                    <TableCell>Booking not utilized</TableCell>
                                    <TableCell className="text-right font-medium">{eq.booking_not_utilized_hours}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>Under maintenance</TableCell>
                                    <TableCell className="text-right font-medium text-orange-700 dark:text-orange-300">
                                      {eq.under_maintenance_hours}
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>Operator absent</TableCell>
                                    <TableCell className="text-right font-medium text-amber-700 dark:text-amber-300">
                                      {eq.operator_absent_hours}
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>Other disruption</TableCell>
                                    <TableCell className="text-right font-medium text-red-700 dark:text-red-300">
                                      {Number(eq.other_disruption_hours ?? 0).toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>Blocked</TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                      {Number(eq.blocked_hours ?? 0).toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>No booking (available)</TableCell>
                                    <TableCell className="text-right">{eq.no_booking_hours}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>Booked (all statuses)</TableCell>
                                    <TableCell className="text-right text-emerald-700 dark:text-emerald-300 font-medium">
                                      {eq.booked_hours}
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                              <Star className="h-4 w-4 text-amber-500" />
                              User ratings (submitted in period)
                            </p>
                            {ur && (ur.ratings_submitted_count ?? 0) > 0 ? (
                              <div className="space-y-3 rounded-lg border bg-amber-50/30 p-4 dark:bg-amber-950/20">
                                <p className="text-sm text-muted-foreground">
                                  {ur.ratings_submitted_count} response(s)
                                  {ur.overall_rating_avg != null && (
                                    <span className="ml-2 font-medium text-foreground">
                                      · Avg. overall {ur.overall_rating_avg} / 5
                                    </span>
                                  )}
                                </p>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Criterion</TableHead>
                                      <TableHead className="text-right">Yes</TableHead>
                                      <TableHead className="text-right">No</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {Object.entries(critLabels).map(([key, label]) => {
                                      const c = ur.criteria?.[key];
                                      return (
                                        <TableRow key={key}>
                                          <TableCell className="text-sm">{label}</TableCell>
                                          <TableCell className="text-right text-emerald-700 dark:text-emerald-300">
                                            {c?.yes ?? 0}
                                          </TableCell>
                                          <TableCell className="text-right text-red-600 dark:text-red-400">{c?.no ?? 0}</TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No ratings in this period.</p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-4 border-t pt-4 text-sm text-muted-foreground">
                            <span>
                              Bookings (period) <strong className="text-foreground">{eq.total_bookings_in_period}</strong>
                            </span>
                            <span>
                              Completed <strong className="text-foreground">{eq.completed_in_period}</strong>
                            </span>
                            <span>
                              Overall <strong className="text-foreground">{eq.overall_bookings}</strong>
                            </span>
                            <span>
                              Current BOOKED <strong className="text-foreground">{eq.overall_current_bookings}</strong>
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Reports;
