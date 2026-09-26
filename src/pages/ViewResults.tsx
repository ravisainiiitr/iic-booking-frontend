import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, type ResultsInboxItem } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DashboardHeader from "@/components/DashboardHeader";
import { BookingResultsDialog } from "@/components/BookingResultsDialog";
import { ArrowLeft, Download, FileCheck2, Loader2, Lock, RefreshCw, RotateCcw, Share2, Star } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, withTime ? "dd MMM yyyy, hh:mm a" : "dd MMM yyyy");
}

export default function ViewResults() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ResultsInboxItem[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogItem, setDialogItem] = useState<ResultsInboxItem | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    const res = await apiClient.getResultsInbox();
    if (res.error) {
      toast.error(res.error);
    } else if (res.data) {
      setItems(res.data.results);
      setNewCount(res.data.new_count);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!apiClient.getToken() || !user) {
      navigate("/auth");
      return;
    }
    void load(true);
  }, [authLoading, user, navigate, load]);

  if (!user) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-5">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <Card className="overflow-hidden border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
                  <FileCheck2 className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    View Results
                    {newCount > 0 ? <Badge className="bg-green-600 hover:bg-green-600">{newCount} new</Badge> : null}
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    Bookings with results available. New results are listed first; once downloaded, a booking moves to
                    the end of the list.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <FileCheck2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No results are available yet.</p>
                  <p className="text-sm mt-1">You will see your bookings here as soon as their results are uploaded.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <li
                      key={item.booking_id}
                      className={`p-5 ${item.is_new ? "bg-green-50/60 dark:bg-green-950/20" : ""}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{item.equipment_name}</span>
                            <span className="text-xs text-muted-foreground">({item.equipment_code})</span>
                            {item.is_new ? (
                              <Badge className="bg-green-600 hover:bg-green-600">New</Badge>
                            ) : (
                              <Badge variant="secondary">Viewed</Badge>
                            )}
                            {item.active_share_count > 0 ? (
                              <Badge variant="outline" className="gap-1">
                                <Share2 className="h-3 w-3" />
                                Shared with {item.active_share_count}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Booking <span className="font-medium text-foreground">{item.display_id}</span>
                            {item.department_name ? ` · ${item.department_name}` : ""}
                            {` · ${item.status_display}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Booked for {formatDate(item.booking_date)} · Results available{" "}
                            {formatDate(item.results_available_at, true)}
                            {item.viewed_at ? ` · Last downloaded ${formatDate(item.viewed_at, true)}` : ""}
                          </p>
                          {item.locked_reason ? (
                            <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                              <Lock className="h-3 w-3" />
                              {item.locked_reason}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {item.locked_code === "rating_required" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => navigate("/my-bookings?pending_rating=1")}
                            >
                              <Star className="h-4 w-4" />
                              Rate booking
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            className="gap-1 bg-green-600 hover:bg-green-700"
                            disabled={item.locked_code === "not_completed" || item.locked_code === "rating_required"}
                            onClick={() => setDialogItem(item)}
                          >
                            <Download className="h-4 w-4" />
                            Download results
                          </Button>
                          {item.status === "COMPLETED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() =>
                                navigate(`/book-equipment?equipment_id=${item.equipment_id}&rebookOf=${item.booking_id}`)
                              }
                            >
                              <RotateCcw className="h-4 w-4" />
                              Book again
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <BookingResultsDialog
        bookingId={dialogItem?.booking_id ?? null}
        bookingLabel={dialogItem?.display_id}
        open={dialogItem != null}
        onOpenChange={(open) => {
          if (!open) setDialogItem(null);
        }}
        onDownloaded={() => void load()}
      />
    </div>
  );
}
