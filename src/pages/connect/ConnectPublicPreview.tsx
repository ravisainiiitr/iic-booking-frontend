import { useEffect, useState } from "react";
import { Compass, Lock, MessagesSquare, PenSquare, Pin, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/PageShell";
import { connectApi, type PublicPreview } from "@/lib/connectApi";
import {
  CONNECT_TAGLINE,
  ConnectUnavailable,
  EmptyState,
  SectionTitle,
  ThreadListSkeleton,
  connectPaths,
  useSignInTo,
} from "@/components/connect/connectUi";
import { timeAgo, useNoIndex } from "@/components/connect/useConnect";

/**
 * IITR Connect for visitors who are not signed in: the community directory and recent General Discussions titles.
 * Opening a discussion, a community or the editor asks the visitor to sign in first, then continues there.
 */
export default function ConnectPublicPreview() {
  useNoIndex();
  const signInTo = useSignInTo();
  const [data, setData] = useState<PublicPreview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void connectApi.publicPreview().then((res) => {
      if (!alive) return;
      if (res.data?.enabled) setData(res.data);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (failed) return <ConnectUnavailable />;

  const general = data?.communities.filter((c) => c.kind === "general") ?? [];
  const groups = data?.communities.filter((c) => c.kind === "group") ?? [];

  return (
    <PageShell>
      <main className="container mx-auto max-w-5xl space-y-8 px-4 py-6">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary dark:text-sky-300">IITR Connect</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{CONNECT_TAGLINE}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Ask questions about instruments, share methods and learn from the people who run and use the equipment at
            IIT Roorkee. Sign in to read the discussions and take part.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => signInTo(connectPaths.home)}>
              <Lock className="mr-1.5 h-4 w-4" aria-hidden />
              Sign in to join
            </Button>
            <Button variant="outline" onClick={() => signInTo(connectPaths.newThread())}>
              <PenSquare className="mr-1.5 h-4 w-4" aria-hidden />
              Start a discussion
            </Button>
          </div>
        </section>

        {!data ? (
          <ThreadListSkeleton />
        ) : (
          <>
            <section className="space-y-3" aria-labelledby="connect-public-recent">
              <SectionTitle
                title="Recent in General Discussions"
                icon={<MessagesSquare className="h-5 w-5 text-primary dark:text-sky-300" aria-hidden />}
              />
              {data.general_threads.length ? (
                <ul className="divide-y rounded-xl border bg-card shadow-sm" id="connect-public-recent">
                  {data.general_threads.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => signInTo(connectPaths.thread(t.id))}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50"
                        aria-label={`${t.title} (sign in to read)`}
                      >
                        {t.is_pinned ? <Pin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 font-medium">{t.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {[t.category, `${t.reply_count} ${t.reply_count === 1 ? "reply" : "replies"}`, timeAgo(t.last_activity_at)]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No discussions yet">Sign in to start the first one.</EmptyState>
              )}
            </section>

            <section className="space-y-3">
              <SectionTitle title="Communities" icon={<Users className="h-5 w-5 text-primary dark:text-sky-300" aria-hidden />} />
              <p className="text-sm text-muted-foreground">
                General Discussions is open to IIT Roorkee users. Each equipment-group community is for the people who
                book or run those instruments.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...general, ...groups].map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => signInTo(connectPaths.community(c.slug))}
                    className="group flex flex-col rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40"
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary dark:text-sky-200" aria-hidden>
                        {c.kind === "general" ? <Compass className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold group-hover:text-primary">{c.name}</span>
                    </span>
                    <span className="mt-2 text-xs text-muted-foreground">
                      {c.thread_count} discussions
                      {c.member_count != null ? ` · ${c.member_count} members` : " · Open to IIT Roorkee users"}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </PageShell>
  );
}
