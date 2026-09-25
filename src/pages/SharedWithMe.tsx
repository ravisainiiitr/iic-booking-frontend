import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, type SharedWithMeItem } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DashboardHeader from "@/components/DashboardHeader";
import { BookingResultsDialog } from "@/components/BookingResultsDialog";
import { ArrowLeft, Download, Loader2, Lock, RefreshCw, Share2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, withTime ? "dd MMM yyyy, hh:mm a" : "dd MMM yyyy");
}

function formatDuration(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} h` : null, m ? `${m} min` : null].filter(Boolean).join(" ");
}

export default function SharedWithMe() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<SharedWithMeItem[]>([]);
  const [eligible, setEligible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [dialogItem, setDialogItem] = useState<SharedWithMeItem | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    const res = await apiClient.getSharedWithMe();
    if (res.error) {
      toast.error(res.error);
    } else if (res.data) {
      setItems(res.data.results);
      setEligible(res.data.eligible);
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
      <main className="container mx-auto px-4 py-8">
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
            <CardHeader className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg">
                  <Share2 className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">Shared with me</CardTitle>
                  <CardDescription className="mt-0.5">
                    Research data that IIT Roorkee students and faculty have shared with you.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !eligible ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Lock className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Research data sharing is available only to IIT Roorkee students and faculty.</p>
                </div>
              ) : items.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Share2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No research data has been shared with you yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.share_id} className={`p-5 ${item.is_new ? "bg-sky-50/60 dark:bg-sky-950/20" : ""}`}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{item.equipment_name}</span>
                            <span className="text-xs text-muted-foreground">({item.equipment_code})</span>
                            {item.is_new ? (
                              <Badge className="bg-sky-600 hover:bg-sky-600">New</Badge>
                            ) : (
                              <Badge variant="secondary">Viewed</Badge>
                            )}
                          </div>
                          <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                            <p>
                              <span className="text-muted-foreground">Booking: </span>
                              <span className="font-medium">{item.display_id}</span>
                            </p>
                            <p>
                              <span className="text-muted-foreground">Status: </span>
                              {item.status_display}
                            </p>
                            {item.department_name ? (
                              <p>
                                <span className="text-muted-foreground">Department: </span>
                                {item.department_name}
                              </p>
                            ) : null}
                            <p>
                              <span className="text-muted-foreground">Booked for: </span>
                              {formatDate(item.booking_date)}
                            </p>
                            {formatDuration(item.total_time_minutes) ? (
                              <p>
                                <span className="text-muted-foreground">Duration: </span>
                                {formatDuration(item.total_time_minutes)}
                              </p>
                            ) : null}
                            <p>
                              <span className="text-muted-foreground">Results available: </span>
                              {formatDate(item.results_available_at, true)}
                            </p>
                            {item.atmosphere_sensitive_sample ? (
                              <p>
                                <span className="text-muted-foreground">Sample: </span>
                                Atmosphere sensitive
                              </p>
                            ) : null}
                          </div>
                          <p className="text-sm">
                            <span className="text-muted-foreground">Shared by: </span>
                            <span className="font-medium">{item.shared_by.name}</span>
                            {` (${item.shared_by.email}${item.shared_by.department ? `, ${item.shared_by.department}` : ""})`}
                            <span className="text-muted-foreground"> on {formatDate(item.shared_at, true)}</span>
                          </p>
                          {item.inputs.length > 0 ? (
                            <div className="rounded-md border bg-muted/30 px-3 py-2">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Booking inputs</p>
                              <dl className="grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
                                {item.inputs.map((input) => (
                                  <div key={input.key} className="flex gap-1 min-w-0">
                                    <dt className="text-muted-foreground shrink-0">{input.label}:</dt>
                                    <dd className="break-words">{input.value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          ) : null}
                          {!item.results_accessible ? (
                            <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                              <Lock className="h-3 w-3" />
                              Results are temporarily unavailable for this booking.
                            </p>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          className="gap-1 bg-green-600 hover:bg-green-700"
                          disabled={!item.results_accessible}
                          onClick={() => setDialogItem(item)}
                        >
                          <Download className="h-4 w-4" />
                          Download results
                        </Button>
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
