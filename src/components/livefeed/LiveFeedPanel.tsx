import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Radio, Video, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiClient, type LiveFeedSession, type LiveFeedSource } from "@/lib/api";
import { LiveFeedViewer, type LiveFeedApi, type SourceState } from "@/lib/liveFeed";

const LABELS: Record<LiveFeedSource, string> = { screen: "Instrument PC screen", camera: "Lab camera" };
const REFRESH_MS = 20_000;

function unwrap<T>(res: { data?: T; error?: string }): T {
  if (res.error || res.data === undefined) throw new Error(res.error || "The portal did not answer.");
  return res.data;
}

const api: LiveFeedApi = {
  offerLiveFeed: async (sessionId, kind, sdp) => unwrap(await apiClient.offerLiveFeed(sessionId, kind, sdp)),
  getLiveFeedPeer: async (peerId) => unwrap(await apiClient.getLiveFeedPeer(peerId)),
  closeLiveFeedPeer: (peerId) => apiClient.closeLiveFeedPeer(peerId),
};

/**
 * "Watch live" for the booking owner while their slot is running and the Lab Operator has started a live feed at the
 * instrument PC. Shows nothing otherwise. Video is view-only; with audio on, the owner and the operator can talk.
 */
export default function LiveFeedPanel({ bookingId }: { bookingId: number }) {
  const [session, setSession] = useState<LiveFeedSession | null>(null);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [watching, setWatching] = useState(false);
  const [states, setStates] = useState<Partial<Record<LiveFeedSource, { state: SourceState; message?: string }>>>({});
  const [ended, setEnded] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [micAvailable, setMicAvailable] = useState(false);
  const viewer = useRef<LiveFeedViewer | null>(null);
  const videos = useRef<Partial<Record<LiveFeedSource, HTMLVideoElement | null>>>({});
  const streams = useRef<Partial<Record<LiveFeedSource, MediaStream>>>({});

  const refresh = useCallback(async () => {
    try {
      const { data } = await apiClient.getLiveFeeds(bookingId);
      setSession(data?.results?.[0] ?? null);
      setIceServers(data?.ice_servers ?? []);
    } catch {
      // not available: show nothing
    }
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;
    void refresh();
    const timer = window.setInterval(() => !viewer.current && void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [bookingId, refresh]);

  useEffect(() => {
    if (!watching) return;
    const timer = window.setInterval(() => void viewer.current?.check(), 5000);
    return () => window.clearInterval(timer);
  }, [watching]);

  useEffect(() => () => viewer.current?.stop(), []);

  const attach = (kind: LiveFeedSource, el: HTMLVideoElement | null) => {
    videos.current[kind] = el;
    const stream = streams.current[kind];
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
      void el.play().catch(() => undefined);
    }
  };

  const watch = async () => {
    if (!session) return;
    setEnded(null);
    setStates({});
    setWatching(true);
    const v = new LiveFeedViewer(
      {
        api,
        createPeer: (config) => new RTCPeerConnection(config),
        getMicrophone: () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }),
      },
      {
        onStream: (kind, stream) => {
          streams.current[kind] = stream;
          attach(kind, videos.current[kind] ?? null);
        },
        onState: (kind, state, message) => setStates((s) => ({ ...s, [kind]: { state, message } })),
        onEnded: (reason) => {
          setEnded(reason);
          setWatching(false);
          viewer.current = null;
          void refresh();
        },
      },
    );
    viewer.current = v;
    await v.start(session, iceServers);
    setMicAvailable(v.micAvailable);
  };

  const stop = () => {
    viewer.current?.stop();
    viewer.current = null;
    streams.current = {};
    setWatching(false);
    setStates({});
  };

  const toggleMute = () => {
    const next = !muted;
    viewer.current?.setMicMuted(next);
    setMuted(next);
  };

  if (!session && !ended) return null;

  return (
    <div className="mt-4 rounded-md border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <Radio className="h-4 w-4 text-rose-600" aria-hidden />
            {session ? `Live from the lab: ${session.equipment.name}` : "Live feed"}
          </p>
          <p className="text-sm text-muted-foreground">
            {ended
              ? ended
              : session?.audio
                ? "The Lab Operator is sharing the instrument. You can watch and talk with them; you cannot control the PC."
                : "The Lab Operator is sharing the instrument. You can watch; you cannot control the PC."}
          </p>
        </div>
        {session && !watching ? (
          <Button onClick={() => void watch()} className="gap-2">
            <Video className="h-4 w-4" aria-hidden /> Watch live
          </Button>
        ) : null}
        {watching ? (
          <div className="flex gap-2">
            {micAvailable ? (
              <Button variant="outline" onClick={toggleMute} className="gap-2" aria-pressed={muted}>
                {muted ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
                {muted ? "Unmute" : "Mute"}
              </Button>
            ) : null}
            <Button variant="outline" onClick={stop} className="gap-2">
              <X className="h-4 w-4" aria-hidden /> Stop watching
            </Button>
          </div>
        ) : null}
      </div>

      {watching && session ? (
        <div className={`mt-3 grid gap-3 ${session.sources.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {session.sources.map((kind) => {
            const s = states[kind];
            return (
              <figure key={kind} className="min-w-0">
                <div className="relative overflow-hidden rounded-md bg-black aspect-video">
                  <video
                    ref={(el) => attach(kind, el)}
                    autoPlay
                    playsInline
                    muted={kind === "camera"}
                    className="h-full w-full object-contain"
                    aria-label={LABELS[kind]}
                  />
                  {s?.state !== "live" ? (
                    <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white/90">
                      {s?.state === "failed" ? s.message : s?.state === "ended" ? "Ended" : "Connecting…"}
                    </div>
                  ) : null}
                </div>
                <figcaption className="mt-1 text-xs text-muted-foreground">
                  {LABELS[kind]}
                  {kind === "screen" && session.audio && !micAvailable ? " · microphone not available, you can listen only" : ""}
                </figcaption>
              </figure>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
