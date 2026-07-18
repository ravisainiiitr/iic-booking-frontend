import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { ArrowLeft, Star } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CHARGE_ESTIMATE_USER_TYPE_OPTIONS } from "@/lib/userTypes";

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

const AdminSettingsFeedback = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const isAdmin = String(user?.user_type || "").toLowerCase() === "admin";

  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userType, setUserType] = useState("all");
  const [minRating, setMinRating] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getPortalFeedbackAdmin({
        search: search.trim() || undefined,
        user_type: userType !== "all" ? userType : undefined,
        min_rating: minRating !== "all" ? Number(minRating) : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: 100,
        offset: 0,
      });
      if (res.error) {
        toast.error(res.error);
        setRows([]);
        setStats(null);
        return;
      }
      setRows((res.data?.feedback || []) as FeedbackRow[]);
      setStats(res.data?.stats || null);
      setCount(res.data?.count || 0);
    } finally {
      setLoading(false);
    }
  }, [search, userType, minRating, dateFrom, dateTo]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) void load();
  }, [isAuthenticated, isAdmin, load]);

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="page-shell">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
          Admin access required.
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-700 p-6 text-white shadow-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin-settings")}
            className="mb-3 text-white/90 hover:text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Admin Settings
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Portal Experience Feedback</h1>
          <p className="text-sm text-white/85 mt-1">
            Ratings and suggestions from users ({count} responses)
          </p>
        </div>

        {stats && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Responses", value: String(stats.total) },
              { label: "Avg overall", value: `${stats.avg_overall.toFixed(1)}★` },
              { label: "Avg ease of booking", value: `${stats.avg_ease_of_booking.toFixed(1)}★` },
              { label: "Avg usability", value: `${stats.avg_website_usability.toFixed(1)}★` },
              {
                label: "Avg equipment UX",
                value: `${stats.avg_equipment_booking_experience.toFixed(1)}★`,
              },
            ].map((s) => (
              <Card key={s.label}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardDescription>{s.label}</CardDescription>
                  <CardTitle className="text-xl">{s.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {stats && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Overall rating distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-sm">
              {[1, 2, 3, 4, 5].map((r) => (
                <div key={r} className="rounded-lg border px-3 py-2 flex items-center gap-2">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                  <span>
                    {r}★ — {stats.rating_distribution[String(r)] || 0}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Input
              placeholder="Search name, email, text…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[220px]"
            />
            <Select value={userType} onValueChange={setUserType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="User type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All user types</SelectItem>
                {CHARGE_ESTIMATE_USER_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.code} value={o.code}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={minRating} onValueChange={setMinRating}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Min rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any rating</SelectItem>
                {[5, 4, 3, 2, 1].map((r) => (
                  <SelectItem key={r} value={String(r)}>
                    {r}+ stars
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
            <Button onClick={() => void load()}>Apply</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No feedback found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Dept</TableHead>
                      <TableHead>Overall</TableHead>
                      <TableHead>Ease</TableHead>
                      <TableHead>Usability</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Suggestions</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.feedback_id}>
                        <TableCell>
                          <div className="font-medium">{r.user_name}</div>
                          <div className="text-xs text-muted-foreground">{r.user_email}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.user_type_display || r.user_type}
                        </TableCell>
                        <TableCell className="text-sm">{r.department_name || "—"}</TableCell>
                        <TableCell>{r.overall_rating}★</TableCell>
                        <TableCell>{r.ease_of_booking}★</TableCell>
                        <TableCell>{r.website_usability}★</TableCell>
                        <TableCell>{r.equipment_booking_experience}★</TableCell>
                        <TableCell className="max-w-[220px] truncate text-sm" title={r.suggestions}>
                          {r.suggestions || r.comments || "—"}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(new Date(r.updated_at), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettingsFeedback;
