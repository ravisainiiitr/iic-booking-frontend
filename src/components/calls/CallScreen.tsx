import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Microscope, Mic, MicOff, Phone, PhoneCall, PhoneOff, Volume2, X } from "lucide-react";

import type { CallInfo } from "@/lib/api";
import type { CallEngine, CallState } from "@/lib/callEngine";
import { OUTCOME_TEXT } from "@/lib/callEngine";
import { isNativeApp } from "@/lib/nativeApp";
import { cn } from "@/lib/utils";
import AppCallScreen from "./AppCallScreen";

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

/** The person's photo, or their initials when there is none or it does not load. */
export function CallAvatar({ name, photoUrl, className, pulse = false }: { name: string; photoUrl?: string; className: string; pulse?: boolean }) {
  const [failedUrl, setFailedUrl] = useState("");
  const showPhoto = Boolean(photoUrl) && failedUrl !== photoUrl;
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 font-semibold",
      pulse && "ring-4 ring-emerald-400/70 motion-safe:animate-pulse", className)}>
      {showPhoto ? (
        <img src={photoUrl} alt={`Photo of ${name}`} className="h-full w-full object-cover" onError={() => setFailedUrl(photoUrl ?? "")} />
      ) : (
        initials(name) || <Phone className="h-1/2 w-1/2" aria-hidden />
      )}
    </span>
  );
}

function personLine(person: CallInfo["other"] | undefined) {
  return [person?.designation || person?.user_type_label, person?.department].filter(Boolean).join(" · ");
}

/** What the call is about, as one line: the instrument when known, else the server's label. */
function aboutLine(call: CallInfo | null) {
  return call?.context?.equipment_name || call?.context_label || "";
}

/** Someone is calling: full screen on phones (including inside the app), a larger card on desktop. */
function IncomingCall({ call, name, engine }: { call: CallInfo | null; name: string; engine: CallEngine }) {
  const answerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    answerRef.current?.focus();
  }, []);
  const instrument = call?.context?.equipment_name || "";
  const about = instrument || call?.context_label || "";
  const facts = [call?.context?.equipment_department, call?.context?.booking_ref ? `Booking ${call.context.booking_ref}` : ""].filter(Boolean);
  return (
    <div
      role="alertdialog"
      aria-live="polite"
      aria-label={`Incoming call from ${name}`}
      data-testid="call-screen"
      className="fixed inset-0 z-[70] sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[24rem]"
    >
      <div className="flex h-full flex-col overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-900 to-sky-950 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] text-white shadow-2xl sm:h-auto sm:rounded-2xl sm:border sm:border-white/10 sm:p-5">
        <div className="flex flex-1 flex-col items-center justify-center text-center sm:flex-none">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Incoming call</p>
          {call?.role_label ? <p className="mt-1 text-sm text-white/70">For the {call.role_label}</p> : null}
          <CallAvatar name={name} photoUrl={call?.other.photo_url} pulse className="mt-6 h-36 w-36 text-4xl sm:mt-4 sm:h-20 sm:w-20 sm:text-2xl" />
          <h2 className="mt-5 max-w-full break-words text-2xl font-semibold leading-tight sm:mt-3 sm:text-lg">{name || "Portal user"}</h2>
          {personLine(call?.other) ? <p className="mt-1 max-w-full break-words text-sm text-white/80">{personLine(call?.other)}</p> : null}
          {about ? (
            <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left sm:mt-4 sm:p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-white/60">
                <Microscope className="h-3.5 w-3.5" aria-hidden /> {instrument ? "Instrument" : "About"}
              </p>
              <p className="mt-1 break-words font-semibold leading-snug">{about}</p>
              {facts.map((fact) => <p key={fact} className="mt-0.5 break-words text-sm text-white/70">{fact}</p>)}
            </div>
          ) : null}
          {call?.reason ? <p className="mt-3 w-full break-words text-left text-sm text-white/80">“{call.reason}”</p> : null}
        </div>
        <div className="mt-8 grid grid-cols-2 gap-6 sm:mt-5 sm:gap-3">
          <button type="button" onClick={() => void engine.decline()} className="flex flex-col items-center gap-2 text-sm font-medium focus-visible:outline-none">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 shadow-lg transition-colors hover:bg-rose-500 sm:h-12 sm:w-12">
              <PhoneOff className="h-7 w-7 sm:h-5 sm:w-5" aria-hidden />
            </span>
            Decline
          </button>
          <button ref={answerRef} type="button" onClick={() => void engine.accept()} className="group flex flex-col items-center gap-2 text-sm font-medium focus-visible:outline-none">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 shadow-lg transition-colors group-focus-visible:ring-4 group-focus-visible:ring-white/60 hover:bg-emerald-500 sm:h-12 sm:w-12">
              <Phone className="h-7 w-7 sm:h-5 sm:w-5" aria-hidden />
            </span>
            Answer
          </button>
        </div>
      </div>
    </div>
  );
}

/** The call card: bottom-right on desktop, a bottom sheet on phones. Shown only while a call exists. */
export default function CallScreen({ state, engine }: { state: CallState; engine: CallEngine }) {
  const [now, setNow] = useState(() => Date.now());
  useRingtone(state.phase === "incoming");

  useEffect(() => {
    if (state.phase !== "in_call" && state.phase !== "reconnecting") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.phase]);

  if (state.phase === "idle") return null;
  const call = state.call;
  const name = call?.other.name ?? state.callingPerson?.name ?? "";
  if (state.phase === "incoming") return <IncomingCall call={call} name={name} engine={engine} />;
  if (isNativeApp()) return <AppCallScreen state={state} engine={engine} />;
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
      role="dialog"
      aria-live="polite"
      aria-label={`Call with ${name}`}
      data-testid="call-screen"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[22rem] sm:p-0"
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-white shadow-2xl">
        <div className="flex items-center gap-3 p-4">
          <CallAvatar name={name} photoUrl={call?.other.photo_url} className="h-12 w-12 text-base" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{name || "Call"}</p>
            <p className="truncate text-xs text-white/70">{[call?.role_label, aboutLine(call)].filter(Boolean).join(" · ")}</p>
            <p className={cn("mt-0.5 text-sm", ended && state.outcome !== "completed" ? "text-amber-200" : "text-emerald-200")} role="status">
              {status}
            </p>
          </div>
          {ended ? (
            <button type="button" onClick={() => engine.dismiss()} className="rounded-full p-1.5 text-white/70 hover:bg-white/10" aria-label="Close">
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>

        {ended ? (
          <div className="flex flex-wrap gap-2 border-t border-white/10 p-3 text-sm">
            {call && ["dropped", "missed", "declined", "busy", "failed"].includes(state.outcome) ? (
              <button type="button" onClick={() => void engine.callBack()} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-medium hover:bg-emerald-500">
                <PhoneCall className="h-4 w-4" aria-hidden /> {state.outcome === "dropped" ? "Call back" : "Call again"}
              </button>
            ) : null}
            <Link to={backTo} onClick={() => engine.dismiss()} className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">
              {call?.context_type === "equipment" ? "Back to the instrument" : "Back to bookings"}
            </Link>
            {state.outcome !== "completed" && state.outcome !== "dropped" ? (
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
