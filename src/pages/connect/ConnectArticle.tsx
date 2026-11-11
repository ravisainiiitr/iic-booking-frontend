import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Archive, BadgeCheck, BookOpen, CheckCircle2, History, Lock, Pencil, RotateCcw, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ARTICLE_STATUS_LABEL, connectApi, type ArticleDetail, type AttachmentRef } from "@/lib/connectApi";
import { ConnectShell, ConnectUnavailable, EmptyState, SideCard, ThreadListSkeleton, connectPaths } from "@/components/connect/connectUi";
import { ConnectEditor } from "@/components/connect/ConnectEditor";
import { PostBody } from "@/components/connect/PostBody";
import { timeAgo, useConnectAvailability } from "@/components/connect/useConnect";
import { GuidanceBadge } from "./ConnectKnowledge";

const STEPS: Array<{ key: ArticleDetail["status"]; label: string }> = [
  { key: "draft", label: "Draft" },
  { key: "under_review", label: "Under Review" },
  { key: "published", label: "Published" },
];

function Steps({ status }: { status: ArticleDetail["status"] }) {
  if (status === "archived") return <p className="text-xs text-muted-foreground">Archived: kept for reference, not listed.</p>;
  const current = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Article status">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            aria-current={i === current ? "step" : undefined}
            className={
              i < current
                ? "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : i === current
                  ? "rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground"
                  : "rounded-full border px-2 py-0.5 text-muted-foreground"
            }
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 ? <span className="h-px w-4 bg-border" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

export default function ConnectArticle() {
  const { id = "" } = useParams();
  const articleId = Number(id);
  const { available, loading } = useConnectAvailability();
  const [a, setA] = useState<ArticleDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<AttachmentRef[]>([]);
  const [comment, setComment] = useState("");
  const [institutional, setInstitutional] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revisions, setRevisions] = useState<Awaited<ReturnType<typeof connectApi.articleRevisions>>["data"] | null>(null);

  const load = useCallback(async () => {
    const res = await connectApi.article(articleId);
    if (!res.data) {
      setMissing(true);
      return;
    }
    setA(res.data);
    setTitle(res.data.title);
    setSummary(res.data.summary);
    setBody(res.data.body_html);
  }, [articleId]);

  useEffect(() => {
    if (available && articleId) void load();
  }, [available, articleId, load]);

  if (loading) return <ConnectShell><ThreadListSkeleton /></ConnectShell>;
  if (!available) return <ConnectUnavailable />;
  if (missing) {
    return (
      <ConnectShell>
        <EmptyState icon={<Lock className="h-5 w-5" />} title="This article is not available to you">
          Articles follow the access of the discussion they came from.
          <div className="mt-3">
            <Link to="/connect/knowledge" className="text-primary hover:underline">
              Back to the Knowledge Hub
            </Link>
          </div>
        </EmptyState>
      </ConnectShell>
    );
  }
  if (!a) return <ConnectShell><ThreadListSkeleton /></ConnectShell>;

  const run = async (fn: () => Promise<{ data?: ArticleDetail; error?: string }>, ok: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.data) {
      toast.error(res.error || "That did not work.");
      return false;
    }
    setA(res.data);
    toast.success(ok);
    return true;
  };

  const save = async () => {
    const ok = await run(() => connectApi.editArticle(a.id, { title, summary, body, note }), "Changes saved as a new version.");
    if (ok) {
      setEditing(false);
      setNote("");
    }
  };

  const aside = (
    <>
      <SideCard title="Article details" icon={<BookOpen className="h-4 w-4 text-primary" aria-hidden />}>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Community</dt>
            <dd>
              <Link to={connectPaths.community(a.community.slug)} className="hover:underline">
                {a.community.name}
              </Link>
            </dd>
          </div>
          {a.equipment?.name ? (
            <div>
              <dt className="text-xs text-muted-foreground">Equipment</dt>
              <dd>
                <Link to={`/equipment/${a.equipment.id}`} className="hover:underline">
                  {a.equipment.name}
                </Link>
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-muted-foreground">Author</dt>
            <dd>{a.author.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Reviewer</dt>
            <dd>{a.reviewer ? `${a.reviewer.name}${a.last_reviewed_at ? ` · ${timeAgo(a.last_reviewed_at)}` : ""}` : "Not reviewed yet"}</dd>
          </div>
          <div className="flex gap-6">
            <div>
              <dt className="text-xs text-muted-foreground">Version</dt>
              <dd className="tabular-nums">{a.version}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Views</dt>
              <dd className="tabular-nums">{a.view_count}</dd>
            </div>
          </div>
        </dl>
      </SideCard>
      {a.source.thread_id ? (
        <SideCard title="Source discussion">
          <Link to={connectPaths.thread(a.source.thread_id)} className="text-sm text-primary hover:underline">
            Open the original discussion
          </Link>
          {a.source.post ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Based on a reply by {a.source.post.author}
              {a.source.post.is_verified_response ? ` (${a.source.post.badge})` : " (community member)"}
            </p>
          ) : null}
        </SideCard>
      ) : null}
      {a.reviews?.length ? (
        <SideCard title="Reviews">
          <ul className="space-y-2 text-xs">
            {a.reviews.map((r, i) => (
              <li key={i}>
                <span className="font-medium">{r.reviewer}</span>: {r.decision.replace("_", " ")} (v{r.version}) · {timeAgo(r.created_at)}
                {r.comment ? <p className="mt-0.5 text-muted-foreground">{r.comment}</p> : null}
              </li>
            ))}
          </ul>
        </SideCard>
      ) : null}
    </>
  );

  return (
    <ConnectShell aside={aside}>
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/connect/knowledge" className="hover:underline">
          Knowledge Hub
        </Link>{" "}
        / {a.community.name}
      </nav>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {a.is_institutional_guidance ? <GuidanceBadge /> : null}
          <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{ARTICLE_STATUS_LABEL[a.status]}</span>
        </div>
        <Steps status={a.status} />
        {editing ? (
          <div className="space-y-2">
            <label htmlFor="connect-article-title" className="text-sm font-medium">
              Title
            </label>
            <Input id="connect-article-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            <label htmlFor="connect-article-summary" className="text-sm font-medium">
              Summary
            </label>
            <Textarea id="connect-article-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={600} rows={2} />
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{a.title}</h1>
            {a.summary ? <p className="text-base text-muted-foreground">{a.summary}</p> : null}
          </>
        )}
        {!a.is_institutional_guidance ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {a.status === "published" && a.needs_review
              ? "This article changed after its last review. Check the equipment SOP before relying on it."
              : "This article is not reviewed institutional guidance. Follow the equipment SOP and check with facility staff."}
          </p>
        ) : null}
      </header>

      {editing ? (
        <div className="space-y-2">
          <ConnectEditor value={body} onChange={setBody} community={a.community.slug} attachments={attachments} onAttachmentsChange={setAttachments} ariaLabel="Article" />
          <label htmlFor="connect-article-note" className="text-sm font-medium">
            What changed
          </label>
          <Input id="connect-article-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Updated after the new SOP" maxLength={300} />
          {a.status === "published" ? (
            <p className="text-xs text-muted-foreground">Saving a published article keeps it published but removes the reviewed label until it is reviewed again.</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              Save new version
            </Button>
          </div>
        </div>
      ) : (
        <article className="rounded-xl border bg-card p-5 shadow-sm">
          <PostBody html={a.body_html} />
        </article>
      )}

      {!editing ? (
        <section aria-label="Article actions" className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <div className="flex flex-wrap gap-2">
            {a.permissions.can_edit ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" aria-hidden /> Edit
              </Button>
            ) : null}
            {a.permissions.can_submit ? (
              <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => run(() => connectApi.articleAction(a.id, "submit"), "Sent for review.")}>
                <Send className="h-4 w-4" aria-hidden /> Send for review
              </Button>
            ) : null}
            {a.permissions.can_publish ? (
              <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => run(() => connectApi.articleAction(a.id, "publish"), "Published to the Knowledge Hub.")}>
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Publish
              </Button>
            ) : null}
            {a.permissions.can_archive ? (
              <Button variant="ghost" size="sm" className="gap-1.5" disabled={busy} onClick={() => run(() => connectApi.articleAction(a.id, "archive"), "Archived.")}>
                <Archive className="h-4 w-4" aria-hidden /> Archive
              </Button>
            ) : null}
            {a.permissions.can_restore ? (
              <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => run(() => connectApi.articleAction(a.id, "restore"), "Restored as a draft.")}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Restore
              </Button>
            ) : null}
            {a.permissions.can_edit ? (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={async () => {
                  if (revisions) return setRevisions(null);
                  const res = await connectApi.articleRevisions(a.id);
                  setRevisions(res.data ?? { results: [] });
                }}
              >
                <History className="h-4 w-4" aria-hidden /> History
              </Button>
            ) : null}
          </div>
          {a.permissions.can_review ? (
            <div className="space-y-2 border-t pt-3">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <BadgeCheck className="h-4 w-4 text-primary" aria-hidden /> Review version {a.version}
              </p>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comments for the author (required to request changes)" rows={2} aria-label="Review comment" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={institutional} onChange={(e) => setInstitutional(e.target.checked)} />
                Mark as reviewed institutional guidance
              </label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => run(() => connectApi.articleAction(a.id, "review", { decision: "approved", comment, institutional }), "Approved.")}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => run(() => connectApi.articleAction(a.id, "review", { decision: "changes_requested", comment }), "Changes requested.")}
                >
                  Request changes
                </Button>
              </div>
            </div>
          ) : null}
          {revisions ? (
            <div className="space-y-2 border-t pt-3 text-xs">
              {revisions.results.map((r) => (
                <details key={r.version}>
                  <summary className="cursor-pointer">
                    Version {r.version} · {r.editor} · {new Date(r.created_at).toLocaleString()}
                    {r.note ? ` · ${r.note}` : ""}
                  </summary>
                  <PostBody html={r.body_html} className="mt-2 text-xs" />
                </details>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </ConnectShell>
  );
}
