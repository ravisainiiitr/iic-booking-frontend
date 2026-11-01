import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Award, EyeOff, Eye, Loader2, RefreshCw, UserRound } from "lucide-react";

import { apiClient, type ResearchRecognition, type ResearchRecognitionAdminView, type ResearcherOfTheMonthItem } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardHeader from "@/components/DashboardHeader";
import { StandaloneOnly } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

function monthLabel(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function Who({ person, extra }: { person: ResearchRecognition; extra?: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {person.photo_url ? (
        <img src={person.photo_url} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
          <UserRound className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="font-medium">{person.researcher_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[extra, person.affiliation, `${person.publication_count ?? 0} approved publication${person.publication_count === 1 ? "" : "s"}`, person.publication_title]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}

/**
 * Admin: Hall of Frames and Researcher of the Month are worked out from approved publications. Nothing is entered by
 * hand; the Main Administrator may take a researcher off the home page (and put them back in the Hall of Frames).
 */
export default function AdminResearchRecognition() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isMainAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";
  const [data, setData] = useState<ResearchRecognitionAdminView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (user && !apiClient.isAdminPanelUser(user.user_type)) navigate("/dashboard");
  }, [user, navigate]);

  const load = useCallback(async () => {
    const res = await apiClient.getResearchRecognitionAdmin();
    if (res.error) setError(res.error);
    else {
      setError("");
      setData(res.data ?? null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleHall = async (p: ResearchRecognition) => {
    const hide = !p.hidden;
    if (hide && !window.confirm(`Take ${p.researcher_name} off the Hall of Frames on the home page?`)) return;
    setBusy(`hall-${p.user_id}`);
    const res = await apiClient.setHallOfFramesHidden(Number(p.user_id), hide);
    setBusy(null);
    if (res.error) toast({ title: "Not changed", description: res.error, variant: "destructive" });
    else {
      toast({ title: hide ? "Taken off the Hall of Frames" : "Shown in the Hall of Frames again" });
      void load();
    }
  };

  const disable = async (row: ResearcherOfTheMonthItem) => {
    if (!window.confirm(`Take ${row.researcher_name} off as Researcher of the Month (${row.department_name})? The next eligible researcher is chosen automatically.`)) return;
    setBusy(`month-${row.id}`);
    const res = await apiClient.disableResearcherOfTheMonth(row.id);
    setBusy(null);
    if (res.error) toast({ title: "Not changed", description: res.error, variant: "destructive" });
    else {
      toast({
        title: "Researcher of the Month changed",
        description: res.data?.shown ? `Now showing ${res.data.researcher_name}.` : "Nobody else qualifies: the card is hidden this month.",
      });
      void load();
    }
  };

  return (
    <div className="page-shell">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        <StandaloneOnly>
          <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate("/content-management")}>
            <ArrowLeft className="h-4 w-4" /> Back to Content Management
          </Button>
        </StandaloneOnly>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-6 w-6" /> Researcher recognition
                </CardTitle>
                <CardDescription className="mt-1 max-w-3xl">
                  Worked out automatically from approved publications. Hall of Frames: everyone with an approved
                  publication, most publications first. Researcher of the Month: for the institute and each department,
                  the most publications approved in the last 12 months, rotating each month.
                  {isMainAdmin ? " You can take anyone off the home page." : " Only the Main Administrator can take anyone off the home page."}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <p role="alert" className="text-sm text-destructive">{error}</p>
            ) : !data ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
              </div>
            ) : (
              <Tabs defaultValue="month">
                <TabsList>
                  <TabsTrigger value="month">Researcher of the Month</TabsTrigger>
                  <TabsTrigger value="hall">Hall of Frames ({data.hall.length})</TabsTrigger>
                  <TabsTrigger value="history">Earlier months</TabsTrigger>
                </TabsList>

                <TabsContent value="month" className="pt-4">
                  <h3 className="mb-2 text-sm font-semibold">{monthLabel(data.month)}</h3>
                  {data.current.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No approved publications in the last 12 months yet.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {data.current.map((row) => (
                        <li key={row.id} className="flex flex-wrap items-center gap-3 p-3">
                          <Who person={row} extra={row.department_name} />
                          <Badge variant={row.shown ? "default" : "secondary"}>{row.shown ? "On the home page" : "Hidden"}</Badge>
                          {isMainAdmin && row.shown ? (
                            <Button size="sm" variant="outline" className="gap-1.5" disabled={busy === `month-${row.id}`} onClick={() => void disable(row)}>
                              <EyeOff className="h-4 w-4" /> Disable
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="hall" className="pt-4">
                  {data.hall.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No approved publications yet.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {data.hall.map((p) => (
                        <li key={p.user_id ?? p.id} className="flex flex-wrap items-center gap-3 p-3">
                          <Who person={p} />
                          <Badge variant={p.hidden ? "secondary" : "default"}>{p.hidden ? "Hidden" : "On the home page"}</Badge>
                          {isMainAdmin ? (
                            <Button size="sm" variant="outline" className="gap-1.5" disabled={busy === `hall-${p.user_id}`} onClick={() => void toggleHall(p)}>
                              {p.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                              {p.hidden ? "Show again" : "Hide"}
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="history" className="pt-4">
                  {data.history.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No earlier months yet.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {data.history.map((row) => (
                        <li key={row.id} className="flex flex-wrap items-center gap-3 p-3">
                          <Who person={row} extra={`${monthLabel(row.month)} · ${row.department_name}`} />
                          {!row.shown ? <Badge variant="secondary">Hidden</Badge> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
