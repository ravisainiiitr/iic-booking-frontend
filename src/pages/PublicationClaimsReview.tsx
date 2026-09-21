import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, BookOpenCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type ReviewClaim = {
  id: number;
  title: string;
  authors: string;
  journal: string;
  year: number | null;
  doi: string;
  url: string;
  citation: string;
  facility_note: string;
  status: string;
  created_at: string | null;
  equipments: Array<{ id: number; code: string; name: string }>;
  submitted_by: { id: number; name: string; email: string; department?: string | null } | null;
};

export default function PublicationClaimsReview() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [claims, setClaims] = useState<ReviewClaim[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    void load();
  }, [authLoading, isAuthenticated, navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.listPublicationClaimsForReview({ status: "pending" });
      if (res.error) throw new Error(res.error);
      setClaims((res.data?.results as ReviewClaim[]) || []);
      setPendingCount(res.data?.pending_count ?? 0);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id: number) => {
    setActingId(id);
    try {
      const res = await apiClient.approvePublicationClaim(id);
      if (res.error) throw new Error(res.error);
      toast.success("Approved — now visible on Publications");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Approve failed");
    } finally {
      setActingId(null);
    }
  };

  const reject = async (id: number) => {
    setActingId(id);
    try {
      const res = await apiClient.rejectPublicationClaim(id, rejectReasons[id] || "");
      if (res.error) throw new Error(res.error);
      toast.success("Claim rejected");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Reject failed");
    } finally {
      setActingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <BookOpenCheck className="h-6 w-6 text-primary" />
              Publication claims
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review facility acknowledgment submissions for your instruments.
              {pendingCount > 0 ? ` ${pendingCount} pending.` : ""}
            </p>
          </div>
        </div>

        {claims.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No pending publication claims.
            </CardContent>
          </Card>
        ) : (
          claims.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg leading-snug">{c.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {c.submitted_by?.name || "Unknown"}
                      {c.submitted_by?.department ? ` · ${c.submitted_by.department}` : ""}
                      {c.created_at
                        ? ` · ${format(new Date(c.created_at), "dd MMM yyyy")}`
                        : ""}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {c.authors}
                  {c.journal ? ` · ${c.journal}` : ""}
                  {c.year ? ` (${c.year})` : ""}
                </p>
                {c.doi ? (
                  <p className="text-sm">
                    DOI:{" "}
                    <a
                      className="text-primary hover:underline"
                      href={`https://doi.org/${c.doi}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {c.doi}
                    </a>
                  </p>
                ) : null}
                {c.citation ? (
                  <p className="text-sm whitespace-pre-line border-l-2 pl-3 text-foreground/90">
                    {c.citation}
                  </p>
                ) : null}
                {c.facility_note ? (
                  <p className="text-sm">
                    <span className="font-medium">Facility note: </span>
                    {c.facility_note}
                  </p>
                ) : null}
                <p className="text-sm">
                  <span className="font-medium">Instruments: </span>
                  {c.equipments.map((e) => `${e.code} (${e.name})`).join("; ")}
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor={`reject-${c.id}`}>Rejection reason (if rejecting)</Label>
                  <Textarea
                    id={`reject-${c.id}`}
                    rows={2}
                    value={rejectReasons[c.id] || ""}
                    onChange={(e) =>
                      setRejectReasons((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => approve(c.id)}
                    disabled={actingId === c.id}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {actingId === c.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => reject(c.id)}
                    disabled={actingId === c.id}
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}