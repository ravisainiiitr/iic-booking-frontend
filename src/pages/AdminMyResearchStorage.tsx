import { useEffect, useState } from "react";
import { Database, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, type MyResearchQuotas } from "@/lib/api";

const gbText = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(bytes >= 1024 ** 3 ? 1 : 2)} GB`;

/** /admin-settings/my-research-storage: Main Administrator sets My Research storage quotas (0 = no limit). */
export default function AdminMyResearchStorage() {
  const [data, setData] = useState<MyResearchQuotas | null>(null);
  const [error, setError] = useState("");
  const [userGb, setUserGb] = useState("");
  const [workspaceGb, setWorkspaceGb] = useState("");
  const [email, setEmail] = useState("");
  const [ownGb, setOwnGb] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = (d: MyResearchQuotas) => {
    setData(d);
    setUserGb(String(d.user_quota_gb));
    setWorkspaceGb(String(d.workspace_quota_gb));
  };

  useEffect(() => {
    void apiClient.getMyResearchQuotas().then((r) => (r.data ? apply(r.data) : setError(r.error || "Could not load the quotas.")));
  }, []);

  const run = async (call: () => Promise<{ data?: MyResearchQuotas; error?: string }>, done: string) => {
    setBusy(true);
    const r = await call();
    setBusy(false);
    if (r.error || !r.data) {
      toast.error(r.error || "Not saved.");
      return false;
    }
    apply(r.data);
    toast.success(done);
    return true;
  };

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto max-w-3xl px-4 py-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Database className="h-6 w-6" aria-hidden /> My Research storage
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How much each user may store across their workspaces. 0 means no limit. Uploads that would go over are refused
          with a clear message; files already stored are never removed.
        </p>
        {error ? <p className="mt-6 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
        {!data && !error ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : null}
        {data ? (
          <>
            <section className="mt-6 rounded-xl border p-4">
              <h2 className="font-semibold">Default quotas</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="quota-user">Per user (GB)</Label>
                  <Input id="quota-user" type="number" min={0} value={userGb} onChange={(e) => setUserGb(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quota-workspace">Per workspace (GB)</Label>
                  <Input id="quota-workspace" type="number" min={0} value={workspaceGb} onChange={(e) => setWorkspaceGb(e.target.value)} />
                </div>
              </div>
              <Button
                className="mt-4"
                disabled={busy}
                onClick={() => void run(() => apiClient.saveMyResearchQuotas({ user_quota_gb: Number(userGb), workspace_quota_gb: Number(workspaceGb) }), "Quotas saved.")}
              >
                Save quotas
              </Button>
            </section>

            <section className="mt-6 rounded-xl border p-4">
              <h2 className="font-semibold">Users with their own quota</h2>
              <p className="mt-1 text-sm text-muted-foreground">For a project that needs more (or less) than the default.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem]">
                <div className="space-y-1.5">
                  <Label htmlFor="own-email">User email</Label>
                  <Input id="own-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="own-gb">Quota (GB)</Label>
                  <Input id="own-gb" type="number" min={0} value={ownGb} onChange={(e) => setOwnGb(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="own-note">Reason (optional)</Label>
                  <Input id="own-note" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>
              <Button
                className="mt-3"
                variant="outline"
                disabled={busy || !email.trim() || ownGb === ""}
                onClick={async () => {
                  const ok = await run(() => apiClient.setMyResearchUserQuota({ email: email.trim(), quota_gb: Number(ownGb), note }), "Quota set.");
                  if (ok) {
                    setEmail("");
                    setOwnGb("");
                    setNote("");
                  }
                }}
              >
                Set quota for this user
              </Button>
              {data.users.length ? (
                <ul className="mt-4 divide-y rounded-md border text-sm">
                  {data.users.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{u.name || u.email}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {u.email} · {u.quota_gb === 0 ? "no limit" : `${u.quota_gb} GB`} · uses {gbText(u.used_bytes)}
                          {u.note ? ` · ${u.note}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Back to the default quota for ${u.email}`}
                        disabled={busy}
                        onClick={() => void run(() => apiClient.clearMyResearchUserQuota(u.id), "Back to the default quota.")}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Everyone uses the default quota.</p>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
