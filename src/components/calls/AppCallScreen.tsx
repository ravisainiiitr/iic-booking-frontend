import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LifeBuoy, Mic, MicOff, PhoneCall, PhoneOff, Volume2, WifiOff, X } from "lucide-react";
import type { CallEngine, CallOutcome, CallState } from "@/lib/callEngine";
import { OUTCOME_TEXT } from "@/lib/callEngine";
import { cn } from "@/lib/utils";
import { CallAvatar, formatDuration } from "./CallScreen";

const CALLING_TEXT: Record<string, string> = {
  calling: "Calling…",
  ringing: "Ringing…",
  connecting: "Connecting…",
};

/** Outcomes where trying again makes sense, and what the button says. */
const RETRY_LABEL: Partial<Record<Exclude<CallOutcome, "">, string>> = {
  dropped: "Call back",
  missed: "Call again",
  declined: "Call again",
  busy: "Call again",
  failed: "Try again",
};

function RoundControl({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active} aria-label={label} className="flex flex-col items-center gap-2 text-xs font-medium text-white/90 disabled:opacity-40">
      <span className={cn("flex h-16 w-16 items-center justify-center rounded-full transition-colors", active ? "bg-white text-slate-900" : "bg-white/10 active:bg-white/20")}>{children}</span>
      {label}
    </button>
  );
}

/** The call in the app: the whole screen, large controls, and a clear way back when a call drops. */
export default function AppCallScreen({ state, engine }: { state: CallState; engine: CallEngine }) {
  const [now, setNow] = useState(() => Date.now());
  const [minimized, setMinimized] = useState(false);
  const lastSeconds = useRef(0);

  const live = state.phase === "in_call" || state.phase === "reconnecting";
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  const ended = state.phase === "ended";
  // A call that ended normally clears itself; anything the person might act on stays until they close it.
  useEffect(() => {
    if (!ended || state.outcome !== "completed") return;
    const id = window.setTimeout(() => engine.dismiss(), 2500);
    return () => window.clearTimeout(id);
  }, [ended, state.outcome, engine]);

  useEffect(() => {
    if (ended) setMinimized(false);
  }, [ended]);

  const call = state.call;
  const person = call?.other ?? state.callingPerson ?? null;
  const name = person?.name ?? "";
  if (live && state.connectedAt) lastSeconds.current = Math.max(0, Math.floor((now - state.connectedAt) / 1000));
  const seconds = lastSeconds.current;

  if (minimized && !ended) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className={cn("fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-sm font-semibold text-white", state.phase === "reconnecting" ? "bg-amber-600" : "bg-emerald-600")}
      >
        <PhoneCall className="h-4 w-4" aria-hidden />
        <span className="truncate">{name}</span>
        <span className="tabular-nums">{state.phase === "reconnecting" ? "Reconnecting…" : live ? formatDuration(seconds) : CALLING_TEXT[state.phase]}</span>
      </button>
    );
  }

  const about = [call?.role_label, call?.context?.equipment_name || call?.context_label].filter(Boolean).join(" · ");
  const retry = ended && state.outcome ? RETRY_LABEL[state.outcome] : undefined;
  const headline = ended
    ? state.outcome === "dropped"
      ? "Call disconnected"
      : state.outcome
        ? OUTCOME_TEXT[state.outcome]
        : "Call ended"
    : state.phase === "in_call"
      ? formatDuration(seconds)
      : state.phase === "reconnecting"
        ? "Reconnecting…"
        : CALLING_TEXT[state.phase] ?? "";
  const detail = ended
    ? state.outcome === "dropped"
      ? `The connection was lost${seconds ? ` after ${formatDuration(seconds)}` : ""}. Tap Call back to reach ${name || "them"} again.`
      : state.message
    : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name ? `Call with ${name}` : "Call"}
      data-testid="call-screen"
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-white"
    >
      <div className="flex h-11 items-center justify-between">
        {!ended ? (
          <button type="button" onClick={() => setMinimized(true)} aria-label="Minimise call" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
            <ChevronDown className="h-6 w-6" aria-hidden />
          </button>
        ) : (
          <button type="button" onClick={() => engine.dismiss()} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
            <X className="h-6 w-6" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto text-center">
        <CallAvatar
          name={name}
          photoUrl={person?.photo_url}
          pulse={state.phase === "ringing" || state.phase === "calling"}
          className={cn("h-36 w-36 text-4xl", state.phase === "reconnecting" && "opacity-60")}
        />
        <h2 className="mt-6 max-w-full break-words text-2xl font-semibold leading-tight">{name || "Call"}</h2>
        {about ? <p className="mt-1 max-w-full break-words text-sm text-white/70">{about}</p> : null}
        <p role="status" aria-live="polite" className={cn("mt-4 text-lg font-medium tabular-nums", ended && state.outcome !== "completed" ? "text-amber-300" : "text-emerald-300")}>
          {headline}
        </p>
        {detail ? <p className="mt-2 max-w-xs text-sm text-white/80">{detail}</p> : null}
        {state.phase === "reconnecting" ? (
          <p className="mt-3 flex max-w-xs items-center gap-2 rounded-full bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden /> The connection is weak. Stay on the line.
          </p>
        ) : null}
      </div>

      {ended ? (
        <div className="mx-auto mt-6 w-full max-w-sm space-y-3">
          {retry && call ? (
            <button
              type="button"
              onClick={() => void engine.callBack()}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 text-base font-semibold active:bg-emerald-700"
            >
              <PhoneCall className="h-5 w-5" aria-hidden /> {retry}
            </button>
          ) : null}
          {state.outcome === "failed" || state.outcome === "unavailable" ? (
            <Link to="/tickets" onClick={() => engine.dismiss()} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/10 text-sm font-medium active:bg-white/20">
              <LifeBuoy className="h-5 w-5" aria-hidden /> Raise a support ticket
            </Link>
          ) : null}
          <button type="button" onClick={() => engine.dismiss()} className="flex h-12 w-full items-center justify-center rounded-full text-sm font-medium text-white/80 active:bg-white/10">
            Close
          </button>
        </div>
      ) : (
        <div className="mx-auto mt-6 w-full max-w-sm">
          <div className="flex items-start justify-center gap-10">
            <RoundControl label={state.muted ? "Unmute" : "Mute"} active={state.muted} disabled={!live} onClick={() => engine.toggleMute()}>
              {state.muted ? <MicOff className="h-6 w-6" aria-hidden /> : <Mic className="h-6 w-6" aria-hidden />}
            </RoundControl>
            <RoundControl label="Speaker" active={state.speaker} disabled={!live} onClick={() => void engine.toggleSpeaker()}>
              <Volume2 className="h-6 w-6" aria-hidden />
            </RoundControl>
          </div>
          <button
            type="button"
            onClick={() => void engine.hangUp()}
            aria-label={live ? "End call" : "Cancel call"}
            className="mx-auto mt-8 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-rose-600 shadow-lg active:bg-rose-700"
          >
            <PhoneOff className="h-8 w-8" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
