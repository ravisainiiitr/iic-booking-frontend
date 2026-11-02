/**
 * Watching a live instrument feed: one WebRTC connection per source, straight to the lab's Department Sync Agent.
 * The screen connection also carries two-way audio with the Lab Operator; the camera connection is video only.
 * Video only ever comes in: the viewer cannot control the instrument PC. Signalling goes through the portal without
 * trickle ICE (the offer is sent once gathering completes). Public STUN only, so it works on the campus network;
 * from outside it can fail, and the viewer is told so.
 */
import type { LiveFeedPeer, LiveFeedSession, LiveFeedSource } from "@/lib/api";

export type LiveFeedApi = {
  offerLiveFeed(sessionId: number, kind: LiveFeedSource, sdp: string): Promise<{ peer_id: number }>;
  getLiveFeedPeer(peerId: number): Promise<LiveFeedPeer>;
  closeLiveFeedPeer(peerId: number): Promise<unknown>;
};

export type LiveFeedDeps = {
  api: LiveFeedApi;
  createPeer: (config: RTCConfiguration) => RTCPeerConnection;
  getMicrophone: () => Promise<MediaStream>;
  sleep?: (ms: number) => Promise<void>;
};

export type SourceState = "connecting" | "live" | "failed" | "ended";

export type LiveFeedEvents = {
  onStream: (kind: LiveFeedSource, stream: MediaStream) => void;
  onState: (kind: LiveFeedSource, state: SourceState, message?: string) => void;
  onEnded: (reason: string) => void;
};

export const NETWORK_HINT =
  "Couldn't connect directly to the lab. Live feeds work on the campus network; from outside campus, connect to the campus VPN and try again.";

const ANSWER_WAIT_MS = 35_000;
const GATHER_WAIT_MS = 4_000;

type Source = { kind: LiveFeedSource; pc: RTCPeerConnection; peerId?: number };

export class LiveFeedViewer {
  private sources: Source[] = [];
  private mic: MediaStream | null = null;
  private stopped = false;
  private ended = false;

  constructor(
    private readonly deps: LiveFeedDeps,
    private readonly events: LiveFeedEvents,
  ) {}

  get micAvailable() {
    return this.mic !== null;
  }

  setMicMuted(muted: boolean) {
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  private sleep(ms: number) {
    return this.deps.sleep ? this.deps.sleep(ms) : new Promise<void>((r) => setTimeout(r, ms));
  }

  /** Opens every shared source. Resolves when each source is live or has failed. */
  async start(session: LiveFeedSession, iceServers: RTCIceServer[]) {
    if (session.audio && session.sources.includes("screen")) {
      try {
        this.mic = await this.deps.getMicrophone();
      } catch {
        this.mic = null; // watch and listen without talking
      }
    }
    await Promise.all(session.sources.map((kind) => this.open(session, kind, iceServers)));
  }

  private async open(session: LiveFeedSession, kind: LiveFeedSource, iceServers: RTCIceServer[]) {
    const pc = this.deps.createPeer({ iceServers });
    const source: Source = { kind, pc };
    this.sources.push(source);
    this.events.onState(kind, "connecting");
    pc.ontrack = (e) => this.events.onStream(kind, e.streams[0] ?? new MediaStream([e.track]));
    pc.onconnectionstatechange = () => {
      if (this.stopped || this.ended) return;
      if (pc.connectionState === "connected") this.events.onState(kind, "live");
      if (pc.connectionState === "failed") this.events.onState(kind, "failed", NETWORK_HINT);
    };

    pc.addTransceiver("video", { direction: "recvonly" });
    if (kind === "screen" && session.audio) {
      const track = this.mic?.getAudioTracks()[0];
      if (track && this.mic) pc.addTrack(track, this.mic);
      else pc.addTransceiver("audio", { direction: "recvonly" });
    }

    try {
      await pc.setLocalDescription(await pc.createOffer());
      await this.gathered(pc);
      const sdp = pc.localDescription?.sdp ?? "";
      const { peer_id } = await this.deps.api.offerLiveFeed(session.id, kind, sdp);
      source.peerId = peer_id;
      const answer = await this.waitForAnswer(peer_id);
      if (this.stopped) return;
      if (!answer) {
        this.events.onState(kind, "failed", "The lab did not answer. Try again in a moment.");
        return;
      }
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (e) {
      if (!this.stopped) this.events.onState(kind, "failed", e instanceof Error ? e.message : "Could not connect.");
    }
  }

  private async gathered(pc: RTCPeerConnection) {
    if (pc.iceGatheringState === "complete") return;
    await Promise.race([
      new Promise<void>((resolve) => {
        pc.onicegatheringstatechange = () => pc.iceGatheringState === "complete" && resolve();
      }),
      this.sleep(GATHER_WAIT_MS),
    ]);
  }

  private async waitForAnswer(peerId: number): Promise<string | null> {
    const until = Date.now() + ANSWER_WAIT_MS;
    while (!this.stopped && Date.now() < until) {
      const peer = await this.deps.api.getLiveFeedPeer(peerId);
      if (peer.session_status === "ended") {
        this.end(peer.end_reason || "The live feed ended.");
        return null;
      }
      if (peer.status === "answered" && peer.sdp) return peer.sdp;
      if (peer.status === "failed" || peer.status === "closed") {
        throw new Error(peer.error || "The lab could not set up the connection.");
      }
      await this.sleep(1000);
    }
    return null;
  }

  /** Called every few seconds while watching: notices when the operator stops or the slot ends. */
  async check() {
    const peerId = this.sources.find((s) => s.peerId)?.peerId;
    if (!peerId || this.stopped || this.ended) return;
    try {
      const peer = await this.deps.api.getLiveFeedPeer(peerId);
      if (peer.session_status === "ended") this.end(peer.end_reason || "The live feed ended.");
    } catch {
      // transient: try again on the next check
    }
  }

  private end(reason: string) {
    if (this.ended) return;
    this.ended = true;
    this.sources.forEach((s) => this.events.onState(s.kind, "ended"));
    this.events.onEnded(reason);
    this.close(false);
  }

  stop() {
    this.stopped = true;
    this.close(true);
  }

  private close(notify: boolean) {
    for (const s of this.sources) {
      s.pc.close();
      if (notify && s.peerId) void this.deps.api.closeLiveFeedPeer(s.peerId).catch(() => undefined);
    }
    this.sources = [];
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
  }
}
