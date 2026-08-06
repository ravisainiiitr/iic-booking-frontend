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
  HardDrive,
  Loader2,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from "lucide-react";

type Release = {
  product?: string;
  product_label?: string;
  id?: string;
  version?: string;
  build_number?: string;
  channel?: string;
  release_date?: string;
  release_notes?: string;
  supported_windows?: string;
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
  download_count?: number | null;
};

type ProductBlock = {
  key: string;
  label: string;
  guide_path?: string;
  ticket_product?: string;
  latest: Release | null;
  previous: Release[];
};

const PRODUCT_ICON: Record<string, typeof HardDrive> = {
  dsa: HardDrive,
  ra: Monitor,
  eq_wizard: Wrench,
};

export default function DeploymentCenterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type || "").toLowerCase();
  const canManage = userType === "admin" || Boolean(user?.is_superuser);

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductBlock[]>([]);
  const [activeKind, setActiveKind] = useState<SecureDownloadKind>("online");

  const dl = useSecureDownload({
    downloadedBy: String(user?.email || user?.username || user?.name || ""),
  });

  const load = async () => {
    setLoading(true);
    const res = await apiClient.getDeploymentCenter();
    if (res.error) {
      toast.error(res.error);
      setProducts([]);
    } else {
      setProducts(((res.data as any)?.products || []) as ProductBlock[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!canManage) {
      navigate("/dashboard");
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const startDownload = (product: ProductBlock, kind: SecureDownloadKind = "online") => {
    const latest = product.latest;
    if (!latest) {
      toast.error("No release published yet.");
      return;
    }
    setActiveKind(kind);
    const productKey = product.key;
    void dl.run({
      productKey,
      productLabel: product.label,
      kind,
      meta: latest,
      startNativeDownload: async ({ signal }) => {
        let ticketRes;
        if (productKey === "dsa") {
          ticketRes = await apiClient.createDsaInstallerDownloadTicket({
            offline: kind === "offline",
            signal,
          });
        } else if (productKey === "ra") {
          ticketRes = await apiClient.createAgentInstallerDownloadTicket({
            offline: kind === "offline",
            signal,
          });
        } else {
          ticketRes = await apiClient.createEquipmentWizardDownloadTicket({ signal });
        }
        if (ticketRes.error || !ticketRes.data) {
          throw new Error(ticketRes.error || "Failed to issue download ticket");
        }
        const t = ticketRes.data;
        return {
          url: t.url,
          filename: t.filename,
          sha256: t.sha256,
          sizeBytes: t.size_bytes,
          version: t.version,
        };
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Deployment Center</h1>
              <p className="text-sm text-muted-foreground">
                DSA, Remote Analysis Agent, and Equipment PC Wizard installers — Main Admin
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/device-provisioning">Device Provisioning</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading catalog…
          </div>
        ) : (
          <div className="grid gap-6">
            {products.map((product) => {
              const Icon = PRODUCT_ICON[product.key] || HardDrive;
              const latest = product.latest;
              return (
                <Card key={product.key} className="overflow-hidden border shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg">{product.label}</CardTitle>
                        <CardDescription className="mt-1">
                          {latest
                            ? `Latest ${latest.version}${latest.build_number ? ` (build ${latest.build_number})` : ""} · ${latest.channel || "stable"}`
                            : "No release published yet — use publish_* management commands."}
                        </CardDescription>
                      </div>
                      {latest?.is_latest ? <Badge>Latest</Badge> : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {latest ? (
                      <>
                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <span className="text-muted-foreground">Release date: </span>
                            {latest.release_date || "—"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Size: </span>
                            {formatBytes(latest.download_size_bytes || 0)}
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-muted-foreground">Windows: </span>
                            {latest.supported_windows || "—"}
                          </div>
                          <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-teal-600" />
                            <span>
                              {latest.signature_status_display || latest.signature_status || "Unsigned"}
                            </span>
                            {latest.sha256 ? (
                              <code className="truncate rounded bg-muted px-2 py-0.5 text-xs">
                                SHA-256 {latest.sha256.slice(0, 16)}…
                              </code>
                            ) : (
                              <span className="text-muted-foreground text-xs">SHA-256 not set</span>
                            )}
                          </div>
                          {(latest as any).compatibility &&
                          Object.keys((latest as any).compatibility || {}).length > 0 ? (
                            <div className="sm:col-span-2 text-xs text-muted-foreground">
                              Compatibility:{" "}
                              <code className="rounded bg-muted px-1">
                                {JSON.stringify((latest as any).compatibility)}
                              </code>
                            </div>
                          ) : null}
                          {(latest as any).has_repair_file || (latest as any).has_emergency_file ? (
                            <div className="sm:col-span-2 text-xs">
                              Packages:{" "}
                              {(latest as any).has_repair_file ? "Repair available · " : ""}
                              {(latest as any).has_emergency_file ? "Emergency available" : ""}
                            </div>
                          ) : null}
                          {(latest as any).rollback_of ? (
                            <div className="sm:col-span-2 text-xs text-muted-foreground">
                              Rollback of release {(latest as any).rollback_of}
                            </div>
                          ) : null}
                          {latest.release_notes ? (
                            <p className="sm:col-span-2 text-sm text-muted-foreground whitespace-pre-wrap">
                              {latest.release_notes}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <SecureDownloadButton
                            phase={activeKind === "online" ? dl.phase : "idle"}
                            busy={dl.isBusy && activeKind === "online"}
                            disabled={!latest.has_file}
                            idleLabel="Download Setup"
                            onClick={() => startDownload(product, "online")}
                          />
                          {latest.has_offline_file ? (
                            <SecureDownloadButton
                              phase={activeKind === "offline" ? dl.phase : "idle"}
                              busy={dl.isBusy && activeKind === "offline"}
                              variant="outline"
                              idleLabel="Offline package"
                              onClick={() => startDownload(product, "offline")}
                            />
                          ) : (
                            <Button variant="outline" disabled title="Offline package is not published for this product">
                              Offline package — Not available
                            </Button>
                          )}
                          {product.guide_path ? (
                            <Button variant="ghost" asChild>
                              <Link to={product.guide_path}>
                                <BookOpen className="mr-2 h-4 w-4" />
                                Guide
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Publish with{" "}
                        <code className="rounded bg-muted px-1">
                          {product.key === "dsa"
                            ? "publish_dsa_installer"
                            : product.key === "ra"
                              ? "publish_ra_installer"
                              : "publish_equipment_wizard"}
                        </code>
                        .
                      </p>
                    )}

                    {product.previous?.length ? (
                      <div>
                        <h3 className="mb-2 text-sm font-medium">Previous versions</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {product.previous.map((r) => (
                            <li key={r.id} className="flex flex-wrap gap-2">
                              <span className="font-medium text-foreground">{r.version}</span>
                              <span>{r.release_date}</span>
                              <span>{r.channel}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <SecureDownloadDialog
        open={dl.open}
        onOpenChange={(o) => (o ? dl.setOpen(true) : dl.close())}
        phase={dl.phase}
        steps={dl.steps}
        progress={dl.progress}
        bytesLoaded={dl.bytesLoaded}
        bytesTotal={dl.bytesTotal}
        meta={products.find((p) => p.latest)?.latest || {}}
        productLabel="Deployment Center"
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
    </div>
  );
}
