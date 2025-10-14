import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

interface BookingStats {
  totalBookings: number;
  totalSpent: number;
  totalHours: number;
  statusCounts: Record<string, number>;
}

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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    fetchStats(session.user.id);
  };

  const fetchStats = async (userId: string) => {
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", userId);

    if (!error && bookings) {
      const stats: BookingStats = {
        totalBookings: bookings.length,
        totalSpent: bookings.reduce((sum, b) => sum + Number(b.total_cost), 0),
        totalHours: bookings.reduce((sum, b) => sum + Number(b.total_hours), 0),
        statusCounts: {},
      };

      bookings.forEach((booking) => {
        stats.statusCounts[booking.status] = 
          (stats.statusCounts[booking.status] || 0) + 1;
      });

      setStats(stats);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Reports & Statistics</h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-4xl font-bold text-primary">
                {stats.totalBookings}
              </CardTitle>
              <CardDescription>Total Bookings</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-4xl font-bold text-primary">
                ${stats.totalSpent.toFixed(2)}
              </CardTitle>
              <CardDescription>Total Spent</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-4xl font-bold text-primary">
                {stats.totalHours.toFixed(2)}
              </CardTitle>
              <CardDescription>Total Hours Booked</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-4xl font-bold text-primary">
                ${stats.totalBookings > 0 ? (stats.totalSpent / stats.totalBookings).toFixed(2) : "0.00"}
              </CardTitle>
              <CardDescription>Average Cost per Booking</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Booking Status Breakdown</CardTitle>
            <CardDescription>Number of bookings by status</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.statusCounts).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No bookings yet
              </p>
            ) : (
              <div className="grid gap-4">
                {Object.entries(stats.statusCounts).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <span className="font-medium capitalize">{status}</span>
                    <span className="text-2xl font-bold text-primary">{count}</span>
                  </div>
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