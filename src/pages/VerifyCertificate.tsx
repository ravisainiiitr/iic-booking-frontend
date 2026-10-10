import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BadgeCheck, Loader2, ShieldAlert, ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/components/training/trainingHelpers";
import { DetailRow } from "@/components/training/trainingUi";
import { trainingApi } from "@/lib/trainingApi";
import type { PublicCertificate } from "@/lib/trainingOpsTypes";
import { cn } from "@/lib/utils";

/** Public check behind the QR code / link printed on every certificate. */
export default function VerifyCertificate() {
  const { token = "" } = useParams<{ token: string }>();
  const [cert, setCert] = useState<PublicCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void trainingApi.verifyCertificate(token).then((res) => {
      if (res.error) setError(res.error);
      else setCert(res.data ?? null);
    });
  }, [token]);

  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Certificate verification</p>
          <CardTitle>Instrumentation facility — operator & user certification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!cert && !error ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking…
            </div>
          ) : null}
          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error || "No certificate matches this link."}</span>
            </div>
          ) : null}
          {cert ? (
            <>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3",
                  cert.valid
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                    : "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
                )}
              >
                {cert.valid ? <BadgeCheck className="h-6 w-6 shrink-0" aria-hidden /> : <ShieldX className="h-6 w-6 shrink-0" aria-hidden />}
                <div>
                  <p className="font-semibold">{cert.valid ? "Valid certificate" : `Not valid — ${cert.status_label}`}</p>
                  <p className="text-xs">Certificate no. {cert.certificate_no}</p>
                </div>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailRow label="Holder">{cert.holder}</DetailRow>
                <DetailRow label="Level">{cert.level.name}</DetailRow>
                <DetailRow label="Equipment">
                  {cert.equipment.name}
                  {cert.equipment.code ? ` (${cert.equipment.code})` : ""}
                </DetailRow>
                <DetailRow label="Issued by">{cert.issuer || "—"}</DetailRow>
                <DetailRow label="Awarded">{formatDate(cert.awarded_at)}</DetailRow>
                <DetailRow label="Valid until">{cert.valid_until ? formatDate(cert.valid_until) : "No expiry"}</DetailRow>
                {cert.scope ? (
                  <div className="sm:col-span-2">
                    <DetailRow label="Scope">{cert.scope}</DetailRow>
                  </div>
                ) : null}
              </dl>
            </>
          ) : null}
          <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
            This page shows the live record held by the facility; a printed certificate is only valid if this page says so.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
