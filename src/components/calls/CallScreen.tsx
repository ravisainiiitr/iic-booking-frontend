import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Mic, MicOff, Phone, PhoneIncoming, PhoneOff, Volume2, X } from "lucide-react";

import type { CallEngine, CallState } from "@/lib/callEngine";
import { OUTCOME_TEXT } from "@/lib/callEngine";
import { cn } from "@/lib/utils";

const PHASE_TEXT: Record<string, string> = {
  calling: "Calling…",
  ringing: "Ringing…",
  incoming: "Incoming call",
  connecting: "Connecting…",
  in_call: "In call",
  reconnecting: "Reconnecting…",
};

function initials(name: string) {
  return name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(dr|prof|mr|mrs|ms)\.?$/i.test(w)).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** A gentle repeating two-tone ring while a call is coming in (Web Audio; silent where the browser blocks it). */
function useRingtone(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === "undefined" || !("AudioContext" in window)) return;
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    const beep = () => {
      if (!ctx) return;
      const now = ctx.currentTime;
      [0, 0.25].forEach((offset, i) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.frequency.value = i ? 480 : 440;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.08, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.22);
        osc.connect(gain).connect(ctx!.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.24);
      });
    };
    beep();
    const id = window.setInterval(beep, 2000);
    return () => {
      window.clearInterval(id);
      void ctx?.close();
    };
  }, [active]);
}

/** The call card: bottom-right on desktop, a bottom sheet on phones. Shown only while a call exists. */
export default function CallScreen({ state, engine }: { state: CallState; engine: CallEngine }) {
  const [now, setNow] = useState(() => Date.now());
  const answerRef = useRef<HTMLButtonElement | null>(null);
  useRingtone(state.phase === "incoming");

  useEffect(() => {
    if (state.phase !== "in_call" && state.phase !== "reconnecting") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "incoming") answerRef.current?.focus();
  }, [state.phase]);

  if (state.phase === "idle") return null;
  const call = state.call;
  const name = call?.other.name ?? "";
  const ended = state.phase === "ended";
  const live = state.phase === "in_call" || state.phase === "reconnecting";
  const seconds = live && state.connectedAt ? Math.max(0, Math.floor((now - state.connectedAt) / 1000)) : 0;
  const status = ended
    ? state.message || (state.outcome ? OUTCOME_TEXT[state.outcome] : "Call ended")
    : live
      ? `${PHASE_TEXT[state.phase]} · ${formatDuration(seconds)}`
      : PHASE_TEXT[state.phase] ?? "";
  const backTo = call?.context_type === "equipment" ? `/equipment/${call.context_id}` : call ? "/my-bookings" : "/dashboard";

  return (
    <div
      role={state.phase === "incoming" ? "alertdialog" : "dialog"}
      aria-live="polite"
      aria-label={state.phase === "incoming" ? `Incoming call from ${name}` : `Call with ${name}`}
      data-testid="call-screen"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[22rem] sm:p-0"
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-white shadow-2xl">
        <div className="flex items-center gap-3 p-4">
          <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-base font-semibold",
            state.phase === "incoming" && "animate-pulse ring-2 ring-emerald-400/70")}>
            {initials(name) || <Phone className="h-5 w-5" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{name || "Call"}</p>
            <p className="truncate text-xs text-white/70">{[call?.role_label, call?.context_label].filter(Boolean).join(" · ")}</p>
            <p className={cn("mt-0.5 text-sm", ended && state.outcome !== "completed" ? "text-amber-200" : "text-emerald-200")} role="status">
              {state.phase === "incoming" ? <PhoneIncoming className="mr-1 inline h-3.5 w-3.5" aria-hidden /> : null}
              {status}
            </p>
          </div>
          {ended ? (
            <button type="button" onClick={() => engine.dismiss()} className="rounded-full p-1.5 text-white/70 hover:bg-white/10" aria-label="Close">
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>

        {state.phase === "incoming" ? (
          <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-3">
            <button type="button" onClick={() => void engine.decline()} className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold hover:bg-rose-500">
              <PhoneOff className="h-4 w-4" aria-hidden /> Decline
            </button>
            <button ref={answerRef} type="button" onClick={() => void engine.accept()} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold hover:bg-emerald-500">
              <Phone className="h-4 w-4" aria-hidden /> Answer
            </button>
          </div>
        ) : ended ? (
          <div className="flex flex-wrap gap-2 border-t border-white/10 p-3 text-sm">
            <Link to={backTo} onClick={() => engine.dismiss()} className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">
              {call?.context_type === "equipment" ? "Back to the instrument" : "Back to bookings"}
            </Link>
            {state.outcome !== "completed" ? (
              <Link to="/tickets" onClick={() => engine.dismiss()} className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">
                Raise a support ticket
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 border-t border-white/10 p-3">
            <button type="button" onClick={() => engine.toggleMute()} disabled={!live} aria-pressed={state.muted}
              className={cn("flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-40", state.muted ? "bg-white text-slate-900" : "bg-white/10 hover:bg-white/20")}
              aria-label={state.muted ? "Unmute" : "Mute"}>
              {state.muted ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
            </button>
            <button type="button" onClick={() => void engine.toggleSpeaker()} disabled={!live} aria-pressed={state.speaker}
              className={cn("flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-40", state.speaker ? "bg-white text-slate-900" : "bg-white/10 hover:bg-white/20")}
              aria-label={state.speaker ? "Speaker off" : "Speaker on"}>
              <Volume2 className="h-5 w-5" aria-hidden />
            </button>
            <button type="button" onClick={() => void engine.hangUp()} className="flex h-11 items-center gap-2 rounded-full bg-rose-600 px-5 text-sm font-semibold hover:bg-rose-500">
              <PhoneOff className="h-5 w-5" aria-hidden /> {state.phase === "ringing" || state.phase === "calling" ? "Cancel" : "End"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
