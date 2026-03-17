import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import type { EquipmentNomination } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DashboardHeader from "@/components/DashboardHeader";
import { ArrowLeft, Loader2, FileUp, Download, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function MyNominationRequests() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isStudent = userTypeStr === "student" || userTypeStr === "individual_student";

  const [nominations, setNominations] = useState<EquipmentNomination[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const fetchNominations = () => {
    apiClient
      .listMyNominationsAsStudent()
      .then((res) => {
        if (res.data?.nominations) setNominations(res.data.nominations);
        else setNominations([]);
      })
      .catch(() => setNominations([]));
  };

  useEffect(() => {
    if (!isStudent) {
      navigate("/dashboard");
      return;
    }
    setLoading(true);
    apiClient
      .listMyNominationsAsStudent()
      .then((res) => {
        if (res.data?.nominations) setNominations(res.data.nominations);
        else setNominations([]);
      })
      .catch(() => setNominations([]))
      .finally(() => setLoading(false));
  }, [isStudent, navigate]);

  const handleFileSelect = (nominationId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(nominationId);
    apiClient
      .submitNominationResume(nominationId, file)
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Resume submitted successfully.");
        fetchNominations();
      })
      .catch(() => toast.error("Failed to submit resume."))
      .finally(() => {
        setUploadingId(null);
        e.target.value = "";
      });
  };

  const handleDownloadResume = async (nominationId: number) => {
    setDownloadingId(nominationId);
    try {
      const res = await apiClient.getNominationResumeBlob(nominationId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.blob) {
        const url = URL.createObjectURL(res.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "resume";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      toast.error("Failed to download resume.");
    } finally {
      setDownloadingId(null);
    }
  };

  if (!isStudent) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>

          <Card className="overflow-hidden border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-teal-500/10 to-cyan-500/10">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">Nomination requests</CardTitle>
                  <CardDescription className="mt-0.5">
                    Manage equipment operating nominations. Upload your resume for each request so OIC/Admin can review.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : nominations.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>You have no nomination requests.</p>
                  <p className="text-sm mt-1">Your supervisor will nominate you for equipment operation when a call is open.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {nominations.map((n) => (
                    <li key={n.id} className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-foreground">{n.equipment_name}</p>
                          <p className="text-sm text-muted-foreground">{n.equipment_code} · {n.semester_name}</p>
                          <p className="text-sm text-muted-foreground mt-1">Nominated by {n.supervisor_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Nominated at {n.nominated_at ? format(new Date(n.nominated_at), "dd MMM yyyy, HH:mm") : "—"}
                          </p>
                          <Badge
                            variant={
                              n.status === "APPROVED"
                                ? "default"
                                : n.status === "REJECTED"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="mt-2"
                          >
                            {n.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {n.status === "PENDING" && (
                            <>
                              <input
                                ref={(el) => { fileInputRefs.current[n.id] = el; }}
                                type="file"
                                accept=".pdf,.doc,.docx,image/*"
                                className="hidden"
                                onChange={(e) => handleFileSelect(n.id, e)}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                disabled={uploadingId !== null}
                                onClick={() => fileInputRefs.current[n.id]?.click()}
                              >
                                {uploadingId === n.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <FileUp className="h-3.5 w-3.5" />
                                )}
                                {n.has_resume ? "Replace resume" : "Upload resume"}
                              </Button>
                            </>
                          )}
                          {n.has_resume && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1.5"
                              disabled={downloadingId !== null}
                              onClick={() => handleDownloadResume(n.id)}
                            >
                              {downloadingId === n.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              Download
                            </Button>
                          )}
                        </div>
                      </div>
                      {n.resume_submitted_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Resume submitted on {format(new Date(n.resume_submitted_at), "dd MMM yyyy, HH:mm")}
                          {n.resume_filename && ` · ${n.resume_filename}`}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
