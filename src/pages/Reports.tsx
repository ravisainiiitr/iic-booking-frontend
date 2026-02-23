import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardHeader from "@/components/DashboardHeader";
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
} from "recharts";
import { Calendar, IndianRupee, Clock, TrendingUp, ArrowRight, Loader2 } from "lucide-react";

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
  UNKNOWN: "#94a3b8",
};

const getStatusColor = (status: string) => STATUS_COLORS[status] ?? "#94a3b8";

const Reports = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<BookingStats>({
    totalBookings: 0,
    totalSpent: 0,
    totalHours: 0,
    statusCounts: {},
  });
  const [loading, setLoading] = useState(true);

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

    fetchStats();
  };

  const fetchStats = async () => {
    const response = await apiClient.getBookings();
    if (response.data && response.data.bookings) {
      const bookings = response.data.bookings;
      const statusCounts: Record<string, number> = {};
      bookings.forEach((booking: any) => {
        const status = booking.status || booking.status_display || "UNKNOWN";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      setStats({
        totalBookings: response.data.count ?? bookings.length,
        totalSpent: bookings.reduce((sum: number, b: any) => sum + Number(b.total_charge || 0), 0),
        totalHours: bookings.reduce((sum: number, b: any) => sum + Number(b.total_hours || 0), 0),
        statusCounts,
      });
    }
    setLoading(false);
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
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Reports & Statistics</h1>
        <p className="text-muted-foreground mb-8">
          Click any section to view the full list of bookings with amount spent.
        </p>

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

        <Card>
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
      </main>
    </div>
  );
};

export default Reports;
