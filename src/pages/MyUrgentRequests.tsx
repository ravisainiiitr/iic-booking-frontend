import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import DashboardHeader from "@/components/DashboardHeader";
import { ArrowLeft, Loader2, AlertCircle, Clock, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { format } from "date-fns";

type MyUrgentRequestRow = {
  id: number;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  request_type: string;
  status: string;
  requested_at: string | null;
  decided_at: string | null;
  expiry_at: string | null;
  pending_wallet_approval: boolean;
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  NO_SLOT: "Unable to get slot despite repeated trials",
  REVIEWER_URGENT: "Urgent comment from reviewer",
};

/** Format seconds as HH:MM:SS (e.g. 3665 -> "01:01:05"). */
function formatTimeRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Returns seconds until expiry (positive), or 0 if already expired. */
function getSecondsRemaining(expiryAtIso: string | null): number {
  if (!expiryAtIso) return 0;
  const expiry = new Date(expiryAtIso).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((expiry - now) / 1000));
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

const MyUrgentRequests = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [list, setList] = useState<MyUrgentRequestRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Update every second for Time Remaining countdown
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiClient
      .listMyUrgentBookingRequests({ limit: 50, offset: 0 })
      .then((res) => {
        if (cancelled) return;
        if (res.data?.urgent_requests) {
          setList(res.data.urgent_requests);
          setTotalCount(res.data.total_count ?? res.data.urgent_requests.length);
        } else {
          setList([]);
          setTotalCount(0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setList([]);
          setTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, isAuthenticated, user, authLoading]);

  const getStatusBadge = (row: MyUrgentRequestRow) => {
    const status = (row.status || "").toUpperCase();
    const timeExpired = getSecondsRemaining(row.expiry_at) <= 0;
    if (status === "PENDING" && timeExpired && row.expiry_at) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <HelpCircle className="h-3 w-3 mr-1" />
          {STATUS_LABELS.EXPIRED}
        </Badge>
      );
    }
    if (row.pending_wallet_approval) {
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          <Clock className="h-3 w-3 mr-1" />
          Awaiting Supervisor
        </Badge>
      );
    }
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            {STATUS_LABELS.PENDING}
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            {STATUS_LABELS.APPROVED}
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            {STATUS_LABELS.REJECTED}
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <HelpCircle className="h-3 w-3 mr-1" />
            {STATUS_LABELS.EXPIRED}
          </Badge>
        );
      default:
        return <Badge variant="outline">{STATUS_LABELS[status] || row.status}</Badge>;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Back to dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">My urgent request status</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                View the status of your submitted urgent booking requests
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Urgent requests
            </CardTitle>
            <CardDescription>
              {totalCount === 0
                ? "You have not submitted any urgent booking requests."
                : `You have ${totalCount} urgent request${totalCount !== 1 ? "s" : ""}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : list.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No urgent requests</p>
                <p className="text-sm mt-1">
                  When you submit an urgent booking request from an equipment page, it will appear here.
                </p>
                <Button variant="outline" className="mt-4" onClick={() => navigate("/equipments")}>
                  Browse equipment
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Equipment</TableHead>
                    <TableHead className="font-semibold">Request type</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Time remaining</TableHead>
                    <TableHead className="font-semibold">Requested</TableHead>
                    <TableHead className="font-semibold">Decided</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((row) => {
                    const statusUpper = (row.status || "").toUpperCase();
                    const isExpired = statusUpper === "EXPIRED" || getSecondsRemaining(row.expiry_at) <= 0;
                    const secondsRemaining = getSecondsRemaining(row.expiry_at);
                    return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <span className="font-medium">{row.equipment_name}</span>
                        {row.equipment_code && (
                          <span className="text-muted-foreground text-sm ml-1">({row.equipment_code})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {REQUEST_TYPE_LABELS[row.request_type] || row.request_type}
                      </TableCell>
                      <TableCell>{getStatusBadge(row)}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {statusUpper === "APPROVED" || statusUpper === "REJECTED"
                          ? "—"
                          : isExpired
                            ? "Expired"
                            : row.expiry_at
                              ? formatTimeRemaining(secondsRemaining)
                              : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.requested_at ? format(new Date(row.requested_at), "dd MMM yyyy, HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.decided_at ? format(new Date(row.decided_at), "dd MMM yyyy, HH:mm") : "—"}
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MyUrgentRequests;
