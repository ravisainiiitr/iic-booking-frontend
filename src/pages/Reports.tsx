import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiClient } from "@/lib/api";
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

type EquipmentReportData = Awaited<ReturnType<typeof apiClient.getEquipmentReportData>>["data"];

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

  // Equipment utilization (admin only)
  const [equipmentReportData, setEquipmentReportData] = useState<EquipmentReportData | null>(null);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [equipmentId, setEquipmentId] = useState<string>("all");
  const [equipmentList, setEquipmentList] = useState<Array<{ equipment_id: number; name: string; code: string }>>([]);
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

    fetchStats();

    if (adminByType || adminCheck.data?.is_admin === true) {
      loadEquipmentList();
    } else {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    const response = await apiClient.getBookings();
    if (response.data && response.data.bookings) {
      const bookings = response.data.bookings;
      const statusCounts: Record<string, number> = {};
      bookings.forEach((booking: { status?: string; status_display?: string; total_charge?: number; total_hours?: number }) => {
        const status = booking.status || booking.status_display || "UNKNOWN";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      setStats({
        totalBookings: response.data.count ?? bookings.length,
        totalSpent: bookings.reduce((sum: number, b: { total_charge?: number }) => sum + Number(b.total_charge || 0), 0),
        totalHours: bookings.reduce((sum: number, b: { total_hours?: number }) => sum + Number(b.total_hours || 0), 0),
        statusCounts,
      });
    }
    setLoading(false);
  };

  const loadEquipmentList = async () => {
    const res = await apiClient.adminList<{ equipment_id: number; name: string; code: string }>("equipment");
    const raw = res.data;
    const list = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && "results" in raw
        ? (raw as { results: Array<{ equipment_id: number; name: string; code: string }> }).results
        : [];
    if (list.length) setEquipmentList(list);
  };

  const loadEquipmentReport = async () => {
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
  };

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

  const pieData = Object.entries(stats.statusCounts).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
    fill: getStatusColor(name),
  }));

  const barData = Object.entries(stats.statusCounts).map(([name, value]) => ({
    status: name.replace(/_/g, " "),
    count: value,
    fill: getStatusColor(name),
  }));

  const utilizationPieData =
    equipmentReportData?.utilization_pie?.map((p, i) => ({
      ...p,
      fill: UTILIZATION_PIE_COLORS[i % UTILIZATION_PIE_COLORS.length],
    })) ?? [];

  const averageCost = stats.totalBookings > 0 ? stats.totalSpent / stats.totalBookings : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-accent/20">
        <DashboardHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="text-3xl font-bold mb-2">Reports & Statistics</h1>
        <p className="text-muted-foreground mb-8">
          Click any section to view the full list of bookings with amount spent.
        </p>

        {/* My bookings stats */}
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

        {/* Equipment utilization reports (admin only) */}
        {isAdmin && (
          <>
            <h2 className="text-2xl font-bold mb-2 mt-10">Equipment Utilization Reports</h2>
            <p className="text-muted-foreground mb-6">
              Generate and download reports by date range and equipment. OICs receive a PDF on the 1st of each month for their equipment.
            </p>

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

            {equipmentReportData && !equipmentLoading && (
              <>
                <div className="mb-4 text-sm text-muted-foreground">
                  Report period: {equipmentReportData.date_from} to {equipmentReportData.date_to} · {equipmentReportData.summary.total_equipment} equipment
                </div>

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
                        <ResponsiveContainer width="100%" height={280}>
                          <PieChart>
                            <Pie
                              data={utilizationPieData}
                              dataKey="hours"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                              {utilizationPieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => [value, "Hours"]} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Per-equipment summary</CardTitle>
                      <CardDescription>Bookings and slot breakdown (table below)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm">
                        Total bookings in period, completed in period, overall bookings, current (BOOKED) count, under maintenance / operator absent / not utilized / no booking (slots and hours).
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Equipment details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipment</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead className="text-right">Bookings (period)</TableHead>
                          <TableHead className="text-right">Completed (period)</TableHead>
                          <TableHead className="text-right">Overall</TableHead>
                          <TableHead className="text-right">Current (BOOKED)</TableHead>
                          <TableHead className="text-right">Under maint. (hrs)</TableHead>
                          <TableHead className="text-right">Operator absent (hrs)</TableHead>
                          <TableHead className="text-right">Not utilized (hrs)</TableHead>
                          <TableHead className="text-right">No booking (hrs)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {equipmentReportData.equipment.map((eq) => (
                          <TableRow key={eq.equipment_id}>
                            <TableCell className="font-medium">{eq.name}</TableCell>
                            <TableCell>{eq.code}</TableCell>
                            <TableCell className="text-right">{eq.total_bookings_in_period}</TableCell>
                            <TableCell className="text-right">{eq.completed_in_period}</TableCell>
                            <TableCell className="text-right">{eq.overall_bookings}</TableCell>
                            <TableCell className="text-right">{eq.overall_current_bookings}</TableCell>
                            <TableCell className="text-right">{eq.under_maintenance_hours}</TableCell>
                            <TableCell className="text-right">{eq.operator_absent_hours}</TableCell>
                            <TableCell className="text-right">{eq.booking_not_utilized_hours}</TableCell>
                            <TableCell className="text-right">{eq.no_booking_hours}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Reports;
