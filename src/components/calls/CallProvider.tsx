import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { apiClient, API_BASE_URL, type CallContextType, type CallOptions } from "@/lib/api";
import { CallEngine, callsSocketUrl, type CallState } from "@/lib/callEngine";
import { getCallPushToken, getNativeAppInfo, isNativeApp, nativePlatform, setNativeCallActive, setNativeCallAudio } from "@/lib/nativeApp";
import { useAuth } from "@/contexts/AuthContext";
import CallScreen from "./CallScreen";

type CallsContextValue = {
  enabled: boolean;
  state: CallState;
  engine: CallEngine | null;
  /** Whom the user may call about this item (cached for a minute). */
  loadOptions: (context: CallContextType, id: number) => Promise<CallOptions | null>;
};

const CallsContext = createContext<CallsContextValue | null>(null);
const IDLE_STATE: CallState = { phase: "idle", call: null, outcome: "", message: "", muted: false, speaker: false, connectedAt: null };

export function useCalls(): CallsContextValue {
  return useContext(CallsContext) ?? { enabled: false, state: IDLE_STATE, engine: null, loadOptions: async () => null };
}

function browserDeps(audio: HTMLAudioElement) {
  const platform = isNativeApp() ? nativePlatform() || "android" : "web";
  return {
    createSocket: (url: string) => new WebSocket(url),
    createPeer: (config: RTCConfiguration) => new RTCPeerConnection(config),
    getMicrophone: () =>
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }),
    playRemote: (stream: MediaStream | null) => {
      audio.srcObject = stream;
      if (stream) void audio.play().catch(() => undefined);
    },
    setSpeaker: (on: boolean) => (isNativeApp() ? setNativeCallAudio(on ? "speaker" : "earpiece") : undefined),
    now: () => Date.now(),
    setTimer: (fn: () => void, ms: number) => window.setTimeout(fn, ms),
    clearTimer: (id: number) => window.clearTimeout(id),
    platform,
  };
}

/** One call engine for the signed-in user: incoming calls anywhere in the portal, and the call screen. */
export function CallProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [engine, setEngine] = useState<CallEngine | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<CallState>(IDLE_STATE);
  const cache = useRef(new Map<string, { at: number; data: CallOptions | null }>());

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !audioRef.current) return;
    const token = apiClient.getToken();
    if (!token) return;
    const eng = new CallEngine(browserDeps(audioRef.current));
    let nativeActive = false;
    const unsubscribe = eng.subscribe((next) => {
      setState(next);
      // In the app: an ongoing-call notification keeps audio alive while connected; released when the call ends.
      const connected = next.phase === "in_call" || next.phase === "reconnecting";
      if (connected !== nativeActive) {
        nativeActive = connected;
        void setNativeCallActive(connected, next.call?.other.name ?? "");
      }
    });
    let cancelled = false;
    void eng.start(callsSocketUrl(API_BASE_URL, window.location.protocol, window.location.host), token).then(async (ok) => {
      if (cancelled) return;
      setEnabled(ok);
      setEngine(ok ? eng : null);
      if (ok && isNativeApp()) {
        // Let the app be rung while it is closed: register this install's push token.
        const [push, info] = await Promise.all([getCallPushToken(), getNativeAppInfo()]);
        if (push?.token && info?.deviceId) {
          await apiClient.registerCallDevice({ platform: push.platform, device_id: info.deviceId, token: push.token, app_version: info.appVersion });
        }
      }
    });
    // iPhone: End / Mute pressed on the system (CallKit) call screen.
    const onNativeEnd = () => void eng.hangUp();
    const onNativeMute = () => !eng.state.muted && eng.toggleMute();
    const onNativeUnmute = () => eng.state.muted && eng.toggleMute();
    window.addEventListener("iic-call-native-end", onNativeEnd);
    window.addEventListener("iic-call-native-mute", onNativeMute);
    window.addEventListener("iic-call-native-unmute", onNativeUnmute);
    return () => {
      window.removeEventListener("iic-call-native-end", onNativeEnd);
      window.removeEventListener("iic-call-native-mute", onNativeMute);
      window.removeEventListener("iic-call-native-unmute", onNativeUnmute);
      cancelled = true;
      unsubscribe();
      eng.stop();
      setEngine(null);
      setEnabled(false);
    };
  }, [isAuthenticated, user?.id]);

  const loadOptions = useCallback(async (context: CallContextType, id: number) => {
    const key = `${context}:${id}`;
    const hit = cache.current.get(key);
    if (hit && Date.now() - hit.at < 60_000) return hit.data;
    const res = await apiClient.getCallOptions(context, id);
    const data = res.data?.enabled ? res.data : null;
    cache.current.set(key, { at: Date.now(), data });
    return data;
  }, []);

  const value = useMemo(() => ({ enabled, state, engine, loadOptions }), [enabled, state, engine, loadOptions]);

  return (
    <CallsContext.Provider value={value}>
      {children}
      <audio ref={audioRef} autoPlay playsInline className="hidden" data-testid="call-remote-audio" />
      {engine ? <CallScreen state={state} engine={engine} /> : null}
    </CallsContext.Provider>
  );
}
