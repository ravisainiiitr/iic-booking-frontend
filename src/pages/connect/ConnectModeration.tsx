import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EyeOff, Flag, History, Lock, Settings2, ShieldCheck, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { connectApi, type ConnectSettingsData, type ModerationLogRow, type ModerationPostRow } from "@/lib/connectApi";
import { cn } from "@/lib/utils";
import { ConnectShell, ConnectUnavailable, EmptyState, SideCard, ThreadListSkeleton, connectPaths } from "@/components/connect/connectUi";
import { timeAgo, useConnectAvailability } from "@/components/connect/useConnect";

type Tab = "reported" | "hidden" | "log";

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function PostRow({ row, onAction }: { row: ModerationPostRow; onAction: (row: ModerationPostRow, action: "hide" | "remove" | "restore" | "dismiss_reports", reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <li className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`${connectPaths.thread(row.thread_id)}#post-${row.post_id}`} className="font-medium hover:underline">
            {row.thread_title}
          </Link>
          <p className="text-xs text-muted-foreground">
            {row.community.name} · {row.author.name} · {timeAgo(row.created_at)}
            {row.is_opening ? " · opening post" : ""}
          </p>
        </div>
        {row.open_reports ? (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800 dark:bg-rose-950 dark:text-rose-200">
            {row.open_reports} {row.open_reports === 1 ? "report" : "reports"}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.visibility}</span>
        )}
      </div>
      <p className="rounded-md bg-muted/40 px-3 py-2 text-sm">{row.excerpt || "(no text)"}</p>
      {row.reports?.length ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {row.reports.map((r, i) => (
            <li key={i}>
              <span className="font-medium text-foreground">{r.reason.replace("_", " ")}</span> · {r.reporter}
              {r.details ? `: ${r.details}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown to the author)" className="h-9 max-w-sm" aria-label="Moderation reason" />
        {row.visibility === "visible" ? (
          <>
            <Button size="sm" variant="outline" disabled={!reason.trim()} onClick={() => onAction(row, "hide", reason)}>
              Hide
            </Button>
            <Button size="sm" variant="destructive" disabled={!reason.trim()} onClick={() => onAction(row, "remove", reason)}>
              Remove
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onAction(row, "dismiss_reports", reason)}>
              Dismiss reports
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => onAction(row, "restore", reason)}>
            Restore
          </Button>
        )}
      </div>
    </li>
  );
}

export default function ConnectModeration() {
  const { available, loading, bootstrap } = useConnectAvailability();
  const [tab, setTab] = useState<Tab>("reported");
  const [queue, setQueue] = useState<{ reported: ModerationPostRow[]; hidden: ModerationPostRow[] } | null>(null);
  const [dash, setDash] = useState<Awaited<ReturnType<typeof connectApi.moderationDashboard>>["data"] | null>(null);
  const [log, setLog] = useState<ModerationLogRow[] | null>(null);
  const [admins, setAdmins] = useState<Array<{ user_id: number; name: string; email: string }> | null>(null);
  const [newAdmin, setNewAdmin] = useState("");
  const [settings, setSettings] = useState<ConnectSettingsData | null>(null);
  const [denied, setDenied] = useState(false);
  const portalAdmin = Boolean(bootstrap?.is_portal_admin);

  const load = useCallback(async () => {
    const [q, d, l] = await Promise.all([connectApi.moderationQueue(), connectApi.moderationDashboard(), connectApi.moderationLog()]);
    if (q.status === 404) {
      setDenied(true);
      return;
    }
    setQueue(q.data ?? { reported: [], hidden: [] });
    setDash(d.data ?? null);
    setLog(l.data?.results ?? []);
  }, []);

  useEffect(() => {
    if (!available) return;
    void load();
  }, [available, load]);

  useEffect(() => {
    if (!available || !portalAdmin) return;
    void connectApi.communityAdmins().then((res) => setAdmins(res.data?.results ?? []));
    void connectApi.settings().then((res) => setSettings(res.data ?? null));
  }, [available, portalAdmin]);

  if (loading) return <ConnectShell><ThreadListSkeleton /></ConnectShell>;
  if (!available) return <ConnectUnavailable />;
  if (denied) {
    return (
      <ConnectShell>
        <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="Moderation is for facility staff and moderators">
          Officers-in-Charge, Lab Operators and appointed moderators review reports for their communities here.
        </EmptyState>
      </ConnectShell>
    );
  }

  const act = async (row: ModerationPostRow, action: "hide" | "remove" | "restore" | "dismiss_reports", reason: string) => {
    const res = await connectApi.moderatePost(row.post_id, action, reason);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Done. The action is recorded in the log.");
      void load();
    }
  };

  const saveSetting = async (change: Partial<ConnectSettingsData>) => {
    const res = await connectApi.saveSettings(change);
    if (res.data) {
      setSettings(res.data);
      toast.success("Settings saved.");
    } else toast.error(res.error || "Could not save.");
  };

  const aside = portalAdmin ? (
    <>
      <SideCard title="Community Admins" icon={<UserPlus className="h-4 w-4 text-primary" aria-hidden />}>
        <p className="text-xs text-muted-foreground">Community Admins moderate every community. Only the Portal Admin appoints them.</p>
        <ul className="mt-2 space-y-1.5">
          {(admins ?? []).map((a) => (
            <li key={a.user_id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate" title={a.email}>
                {a.name}
              </span>
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                onClick={async () => {
                  const res = await connectApi.removeCommunityAdmin(a.user_id);
                  if (res.data) setAdmins(res.data.results);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await connectApi.addCommunityAdmin(newAdmin.trim());
            if (!res.data) toast.error(res.error || "Could not add.");
            else {
              setAdmins(res.data.results);
              setNewAdmin("");
            }
          }}
        >
          <Input value={newAdmin} onChange={(e) => setNewAdmin(e.target.value)} placeholder="name@iitr.ac.in" aria-label="Community Admin e-mail" className="h-9" />
          <Button size="sm" type="submit" disabled={!newAdmin.trim()}>
            Add
          </Button>
        </form>
      </SideCard>
      {settings ? (
        <SideCard title="Module settings" icon={<Settings2 className="h-4 w-4 text-primary" aria-hidden />}>
          <div className="space-y-3 text-sm">
            <label className="flex items-center justify-between gap-2">
              Recognition badges
              <Switch checked={settings.recognition_enabled} onCheckedChange={(v) => saveSetting({ recognition_enabled: v })} aria-label="Recognition badges" />
            </label>
            {(
              [
                ["edit_window_minutes", "Authors can edit for (minutes, 0 = always)"],
                ["delete_window_minutes", "Authors can delete for (minutes)"],
                ["max_attachment_mb", "Largest attachment (MB)"],
                ["max_attachments_per_post", "Attachments per post"],
                ["min_account_age_hours_to_post", "New accounts wait before posting (hours)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block space-y-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Input
                  type="number"
                  defaultValue={settings[key]}
                  className="h-9"
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (value !== settings[key]) void saveSetting({ [key]: value });
                  }}
                />
              </label>
            ))}
          </div>
        </SideCard>
      ) : null}
    </>
  ) : undefined;

  return (
    <ConnectShell
      aside={aside}
      header={
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden /> Moderation
          </h1>
          <p className="text-sm text-muted-foreground">Reports and hidden posts in the communities you moderate. Every action is recorded.</p>
        </div>
      }
    >
      {dash ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Open reports" value={dash.totals.open_reports ?? 0} icon={<Flag className="h-3.5 w-3.5" aria-hidden />} />
          <Stat label="Hidden posts" value={dash.totals.hidden_posts ?? 0} icon={<EyeOff className="h-3.5 w-3.5" aria-hidden />} />
          <Stat label="Locked threads" value={dash.totals.locked_threads ?? 0} icon={<Lock className="h-3.5 w-3.5" aria-hidden />} />
          <Stat label="Communities" value={dash.totals.communities_moderated ?? 0} icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />} />
        </div>
      ) : null}

      <div role="tablist" aria-label="Moderation" className="inline-flex rounded-lg border p-0.5">
        {(
          [
            ["reported", `Reported (${queue?.reported.length ?? 0})`],
            ["hidden", `Hidden (${queue?.hidden.length ?? 0})`],
            ["log", "Audit log"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn("rounded-md px-3 py-1.5 text-sm", tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {queue === null ? (
        <ThreadListSkeleton />
      ) : tab === "log" ? (
        log && log.length ? (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {log.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                <span>
                  <span className="font-medium">{r.actor}</span> · {r.action.replace(/_/g, " ")} · {r.target_type} {r.target_id}
                  {r.reason ? <span className="text-muted-foreground"> · {r.reason}</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.community} · {timeAgo(r.created_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<History className="h-5 w-5" />} title="No moderation actions yet" />
        )
      ) : queue[tab].length ? (
        <ul className="space-y-3">
          {queue[tab].map((row) => (
            <PostRow key={row.post_id} row={row} onAction={act} />
          ))}
        </ul>
      ) : (
        <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title={tab === "reported" ? "No open reports" : "No hidden posts"}>
          Nothing needs your attention right now.
        </EmptyState>
      )}
    </ConnectShell>
  );
}
