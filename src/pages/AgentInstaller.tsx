import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SecureDownloadButton,
  SecureDownloadDialog,
  formatBytes,
  type SecureDownloadKind,
} from "@/components/downloads";
import { useSecureDownload } from "@/hooks/useSecureDownload";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  HardDrive,
  Loader2,
  Monitor,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

type Release = {
  id?: string;
  version?: string;
  channel?: string;
  release_date?: string;
  release_notes?: string;
  supported_windows?: string;
  min_ram_gb?: number;
  min_disk_gb?: number;
  download_size_bytes?: number;
  sha256?: string;
  signature_status?: string;
  signature_status_display?: string;
  has_file?: boolean;
  has_offline_file?: boolean;
  documentation_url?: string;
  installation_guide_url?: string;
  troubleshooting_guide_url?: string;
  is_latest?: boolean;
  original_name?: string;
  offline_original_name?: string;
};

export default function AgentInstallerPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type || "").toLowerCase();
  const canManage = ["admin", "dept_admin", "manager"].includes(userType) || Boolean(user?.is_superuser);

  const [loading, setLoading] = useState(true);
  const [latest, setLatest] = useState<Release | null>(null);
  const [previous, setPrevious] = useState<Release[]>([]);
  const [activeKind, setActiveKind] = useState<SecureDownloadKind>("online");

  const dl = useSecureDownload({
    downloadedBy: String(user?.email || user?.username || user?.name || ""),
  });

  const load = async () => {
    setLoading(true);
    const [latestRes, listRes] = await Promise.all([
      apiClient.getAgentInstallerLatest(),
      apiClient.getAgentInstallerReleases(true),
    ]);
    if (latestRes.error && !String(latestRes.error).includes("404")) {
      toast.error(latestRes.error);
    }
    setLatest((latestRes.data as Release) || null);
    const rows = ((listRes.data as any)?.results || []) as Release[];
    setPrevious(rows.filter((r) => r.id && r.id !== (latestRes.data as any)?.id).slice(0, 8));
    setLoading(false);
  };

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    void load();
  }, [canManage]);

  const startDownload = (kind: SecureDownloadKind) => {
    if (!latest) return;
    setActiveKind(kind);
    void dl.run({
      productKey: "remote-analysis-agent",
      productLabel: "Remote Analysis Agent",
      kind,
      meta: latest,
      startNativeDownload: async ({ signal }) => {
        const res = await apiClient.createAgentInstallerDownloadTicket({
          offline: kind === "offline",
          signal,
        });
        if (res.error || !res.data?.url) {
          throw Object.assign(new Error(res.error || "Could not authorize download"), {
            detail: `HTTP ${res.status || "?"} while creating download ticket.`,
          });
        }
        return {
          url: res.data.url,
          filename: res.data.filename || latest.original_name || "RemoteAnalysisAgentSetup.exe",
          sha256: res.data.sha256,
          sizeBytes: res.data.size_bytes || latest.download_size_bytes,
          version: res.data.version || latest.version,
        };
      },
      // Fallback if ticket endpoint is unavailable on older backends
      fetchArtifact: async ({ onProgress, signal }) => {
        const res = await apiClient.downloadAgentInstallerLatest({
          offline: kind === "offline",
          onProgress,
          signal,
        });
        if (res.error || !res.data) {
          throw Object.assign(new Error(res.error || "Download failed"), {
            detail: `HTTP ${res.status || "?"} while fetching Remote Analysis Agent installer.`,
          });
        }
        return res.data;
      },
    });
  };

  if (!canManage) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="container mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">Access restricted</h1>
          <p className="mt-2 text-muted-foreground">
            Only System Administrators, Department Administrators, and Officers In Charge can
            download the Agent Installer.
          </p>
          <Button className="mt-6" onClick={() => navigate("/remote-analysis")}>
            Back to Remote Analysis
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Administration · Remote Analysis
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <HardDrive className="h-6 w-6 text-primary" />
              Agent Installer
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Download the Remote Analysis Agent Setup for Analysis PCs. Copy the EXE to the lab
              machine and run as Administrator — no GitHub or developer tools required.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/remote-analysis")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Operations
            </Button>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
              Loading installer releases…
            </CardContent>
          </Card>
        ) : !latest ? (
          <Card>
            <CardHeader>
              <CardTitle>No installer published yet</CardTitle>
              <CardDescription>
                Publish a build with{" "}
                <code className="rounded bg-muted px-1 text-xs">
                  python manage.py publish_agent_installer path\to\RemoteAnalysisAgentSetup.exe --version 1.0.0
                </code>
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <Card className="border-primary/20 shadow-sm">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl">Current Agent Version {latest.version}</CardTitle>
                  {latest.is_latest ? <Badge>Latest</Badge> : null}
                  <Badge variant="secondary">{latest.channel || "stable"}</Badge>
                  <Badge variant="outline">{latest.signature_status_display || latest.signature_status}</Badge>
                </div>
                <CardDescription>
                  Released {latest.release_date || "—"} · Download size{" "}
                  {formatBytes(latest.download_size_bytes)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Supported Windows" value={latest.supported_windows || "—"} />
                  <Info
                    label="Minimum hardware"
                    value={`RAM ${latest.min_ram_gb ?? 8} GB · Disk ${latest.min_disk_gb ?? 20} GB`}
                  />
                  <Info label="Digital signature" value={latest.signature_status_display || "Unsigned"} />
                  <Info label="SHA256" value={latest.sha256 || "—"} mono />
                </div>

                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-sm font-semibold">Release notes</p>
                  <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {latest.release_notes || "No release notes."}
                  </pre>
                </div>

                <div className="flex flex-wrap gap-2">
                  <SecureDownloadButton
                    phase={activeKind === "online" ? dl.phase : "idle"}
                    busy={dl.isBusy && activeKind === "online"}
                    disabled={!latest.has_file}
                    idleLabel="Download Latest Installer"
                    onClick={() => startDownload("online")}
                  />
                  <SecureDownloadButton
                    phase={activeKind === "offline" ? dl.phase : "idle"}
                    busy={dl.isBusy && activeKind === "offline"}
                    disabled={!latest.has_offline_file}
                    variant="secondary"
                    idleLabel="Download Offline Installer"
                    onClick={() => startDownload("offline")}
                  />
                  <Button size="lg" variant="outline" asChild>
                    <a href="#release-notes">
                      <FileText className="mr-2 h-4 w-4" /> View Release Notes
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <a
                      href={latest.installation_guide_url || "#guide"}
                      target={latest.installation_guide_url?.startsWith("http") ? "_blank" : undefined}
                      rel="noreferrer"
                    >
                      <BookOpen className="mr-2 h-4 w-4" /> Installation Guide
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <SecureDownloadDialog
              open={dl.open}
              onOpenChange={(o) => (o ? dl.setOpen(true) : dl.close())}
              phase={dl.phase}
              steps={dl.steps}
              progress={dl.progress}
              bytesLoaded={dl.bytesLoaded}
              bytesTotal={dl.bytesTotal}
              meta={latest}
              productLabel="Remote Analysis Agent"
              filename={dl.resultFilename}
              sha256={dl.resultSha}
              sizeBytes={dl.resultSize}
              error={dl.error}
              errorDetail={dl.errorDetail}
              history={dl.history}
              onRetry={dl.retry}
              onDownloadAgain={dl.downloadAgain}
              onContactAdmin={() => navigate("/tickets")}
            />

            <div className="grid gap-4 md:grid-cols-2" id="guide">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Monitor className="h-4 w-4" /> Installation overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>1. Download the latest Setup EXE from this page.</p>
                  <p>2. Copy it to the Analysis PC (Windows 10/11 Pro or Server).</p>
                  <p>3. Run as Administrator — the wizard configures RDP, firewall, and the agent service.</p>
                  <p>4. Enter enrollment key + RDP password; select department/equipment and installed software.</p>
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
                    Enrollment key is <strong>not</strong> stored in Django Admin. Use the server
                    environment value <code className="text-xs">RA_AGENT_ENROLLMENT_KEY</code> from
                    production <code className="text-xs">.env</code> / Docker secrets (ask the
                    Main Admin / ops who deployed the portal).
                  </p>
                  <p>5. Confirm the workstation appears Online under Remote Analysis → Workstations.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> Verify installation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>· Local health: http://127.0.0.1:5088/api/health</p>
                  <p>· Service name: RemoteAnalysisAgent (Running)</p>
                  <p>· Portal: workstation status Online with recent heartbeat</p>
                  <p>· Equipment pool linked for Analyze Data allocation</p>
                  <Button className="mt-2" variant="outline" asChild>
                    <Link to="/remote-analysis">Open Operations Center</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card id="release-notes">
              <CardHeader>
                <CardTitle className="text-base">Previous versions</CardTitle>
                <CardDescription>Optional archive of earlier published builds</CardDescription>
              </CardHeader>
              <CardContent>
                {previous.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No previous versions published.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {previous.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                        <span className="font-medium">{r.version}</span>
                        <span className="text-muted-foreground">{r.release_date}</span>
                        <Badge variant="outline">{r.channel}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documentation</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 text-sm">
                <Button variant="link" className="h-auto px-0" asChild>
                  <a href={latest.documentation_url || "#guide"}>Documentation</a>
                </Button>
                <span className="text-muted-foreground">·</span>
                <Button variant="link" className="h-auto px-0" asChild>
                  <a href={latest.installation_guide_url || "#guide"}>Installation Guide</a>
                </Button>
                <span className="text-muted-foreground">·</span>
                <Button variant="link" className="h-auto px-0" asChild>
                  <a href={latest.troubleshooting_guide_url || "#guide"}>Troubleshooting Guide</a>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={mono ? "mt-0.5 break-all font-mono text-xs" : "mt-0.5 text-sm font-medium"}>{value}</p>
    </div>
  );
}
