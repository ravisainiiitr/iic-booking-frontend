import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, MailX, TriangleAlert } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { apiClient, type NotificationUnsubscribeInfo } from "@/lib/api";

type State =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "ready" | "working" | "done"; info: NotificationUnsubscribeInfo };

/** Landing page for the unsubscribe link in optional emails; nothing changes until the person confirms. */
const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", message: "This unsubscribe link is incomplete." });
      return;
    }
    apiClient.notificationUnsubscribe(token, false).then((res) => {
      if (res.error || !res.data) setState({ kind: "invalid", message: res.error || "This unsubscribe link is not valid." });
      else setState({ kind: res.data.email_enabled ? "ready" : "done", info: res.data });
    });
  }, [token]);

  const confirm = async () => {
    if (state.kind !== "ready") return;
    setState({ kind: "working", info: state.info });
    const res = await apiClient.notificationUnsubscribe(token, true);
    if (res.error || !res.data) setState({ kind: "invalid", message: res.error || "Something went wrong. Please try again." });
    else setState({ kind: "done", info: res.data });
  };

  return (
    <PageShell>
      <main id="main-content" className="container mx-auto flex max-w-lg flex-1 items-center px-4 py-12">
        <div className="w-full rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
          {state.kind === "loading" ? (
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
          ) : state.kind === "invalid" ? (
            <>
              <TriangleAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" aria-hidden />
              <h1 className="text-xl font-semibold">Link not valid</h1>
              <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
              <Button asChild className="mt-6">
                <Link to="/notifications?tab=settings">Open notification settings</Link>
              </Button>
            </>
          ) : state.kind === "done" ? (
            <>
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" aria-hidden />
              <h1 className="text-xl font-semibold">You are unsubscribed</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                You will no longer get <span className="font-medium text-foreground">{state.info.label}</span> emails.
                They still appear in your portal notifications. Booking, results, payment and account emails are not
                affected.
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/notifications?tab=settings">Manage all notification settings</Link>
              </Button>
            </>
          ) : (
            <>
              <MailX className="mx-auto mb-3 h-10 w-10 text-primary dark:text-sky-300" aria-hidden />
              <h1 className="text-xl font-semibold">Stop {state.info.label} emails?</h1>
              <p className="mt-2 text-sm text-muted-foreground">{state.info.description}</p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button onClick={() => void confirm()} disabled={state.kind === "working"}>
                  {state.kind === "working" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                  Unsubscribe
                </Button>
                <Button asChild variant="outline">
                  <Link to="/notifications?tab=settings">Choose in settings instead</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </PageShell>
  );
};

export default Unsubscribe;
