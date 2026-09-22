import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, Loader2, Upload, ExternalLink } from "lucide-react";

const DOC_KEY = "analysis_charges";

export default function AdminAnalysisCharges() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("Analysis Charges");
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const check = async () => {
      const token = apiClient.getToken();
      if (!token) {
        navigate("/auth");
        return;
      }
      const userRes = await apiClient.getCurrentUser();
      if (userRes.error || !userRes.data) {
        navigate("/auth");
        return;
      }
      if (String(userRes.data.user_type ?? "").toLowerCase() !== "admin") {
        toast({ title: "Access Denied", description: "Only Main Admin can update this document.", variant: "destructive" });
        navigate("/dashboard");
        return;
      }
      setAuthChecked(true);
    };
    void check();
  }, [navigate, toast]);

  useEffect(() => {
    if (!authChecked) return;
    const load = async () => {
      setLoading(true);
      const res = await apiClient.adminGetSiteDocumentByKey(DOC_KEY);
      if (res.error) {
        // Row may not exist yet — that is fine; upload will create it.
        setDocumentUrl(null);
        setUpdatedAt(null);
      } else if (res.data) {
        setTitle(res.data.title || "Analysis Charges");
        setDocumentUrl(res.data.document_url || null);
        setUpdatedAt(res.data.updated_at || null);
      }
      setLoading(false);
    };
    void load();
  }, [authChecked]);

  const handleUpload = async () => {
    if (!file) {
      toast({ title: "PDF required", description: "Choose a PDF file to upload.", variant: "destructive" });
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast({ title: "Invalid file", description: "Only PDF files are allowed.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await apiClient.adminUploadSiteDocument(DOC_KEY, file, title);
    setSaving(false);
    if (res.error) {
      toast({ title: "Upload failed", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Saved", description: "Analysis Charges PDF updated." });
    setFile(null);
    setDocumentUrl(res.data?.document_url || null);
    setUpdatedAt(res.data?.updated_at || null);
    if (res.data?.title) setTitle(res.data.title);
  };

  if (!authChecked) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate("/content-management")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Content Management
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Analysis Charges PDF
            </CardTitle>
            <CardDescription>
              This PDF opens when visitors click <strong>Analysis Charges</strong> on the home page.
              Upload a new file anytime to replace the current document.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <div className="text-sm font-medium">Current document</div>
                  {documentUrl ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="outline" size="sm" className="gap-2" asChild>
                        <a href={documentUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          Open current PDF
                        </a>
                      </Button>
                      {updatedAt && (
                        <span className="text-sm text-muted-foreground">
                          Updated {new Date(updatedAt).toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No PDF uploaded yet.</p>
                  )}
                </div>

                <div className="space-y-2 max-w-md">
                  <Label htmlFor="doc-title">Display title</Label>
                  <Input
                    id="doc-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Analysis Charges"
                  />
                </div>

                <div className="space-y-2 max-w-md">
                  <Label htmlFor="doc-file">New PDF</Label>
                  <Input
                    id="doc-file"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {file && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                    </p>
                  )}
                </div>

                <Button onClick={() => void handleUpload()} disabled={saving || !file} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {documentUrl ? "Replace PDF" : "Upload PDF"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
