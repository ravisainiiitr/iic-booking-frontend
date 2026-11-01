/**
 * In-app internet voice calls (WebRTC, peer to peer). The server only authorises calls, keeps their state and relays
 * signalling over ws/calls/; audio goes directly between the two devices (or via TURN when configured). Nothing is
 * recorded. The microphone is opened only once the call is answered: the callee on Accept, the caller when told the
 * callee accepted.
 *
 * Browser APIs are injected so the engine can be tested without a real browser.
 */
import { apiClient, type CallConfig, type CallContextType, type CallInfo, type CallRole } from "@/lib/api";

export type CallPhase =
  | "idle"
  | "calling" // asking the server
  | "ringing" // the other side is being rung
  | "incoming" // someone is calling us
  | "connecting" // answered; setting up audio
  | "in_call"
  | "reconnecting"
  | "ended"; // final: see outcome

export type CallOutcome = "completed" | "declined" | "missed" | "busy" | "cancelled" | "failed" | "unavailable" | "";

export interface CallState {
  phase: CallPhase;
  call: CallInfo | null;
  outcome: CallOutcome;
  message: string;
  muted: boolean;
  speaker: boolean;
  connectedAt: number | null;
}

export interface CallDeps {
  createSocket: (url: string) => WebSocket;
  createPeer: (config: RTCConfiguration) => RTCPeerConnection;
  getMicrophone: () => Promise<MediaStream>;
  playRemote: (stream: MediaStream | null) => void;
  setSpeaker?: (on: boolean) => Promise<void> | void;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => number;
  clearTimer: (id: number) => void;
  platform: string;
}

const IDLE: CallState = { phase: "idle", call: null, outcome: "", message: "", muted: false, speaker: false, connectedAt: null };
const ICE_FAIL_MS = 20000;

const OUTCOME_BY_STATUS: Partial<Record<CallInfo["status"], CallOutcome>> = {
  ended: "completed",
  declined: "declined",
  missed: "missed",
  busy: "busy",
  cancelled: "cancelled",
  failed: "failed",
};

export const OUTCOME_TEXT: Record<Exclude<CallOutcome, "">, string> = {
  completed: "Call ended",
  declined: "Declined",
  missed: "No answer",
  busy: "Busy on another call",
  cancelled: "Call cancelled",
  failed: "The call could not be connected",
  unavailable: "Calling is not available",
};

export function callsSocketUrl(apiBase: string, pageProtocol: string, pageHost: string): string {
  if (apiBase.startsWith("/")) return `${pageProtocol === "https:" ? "wss" : "ws"}://${pageHost}/ws/calls/`;
  const base = apiBase.replace(/\/api\/?$/, "");
  return `${base.startsWith("https") ? "wss" : "ws"}://${base.replace(/^https?:\/\//, "")}/ws/calls/`;
}

export class CallEngine {
  state: CallState = IDLE;
  private listeners = new Set<(s: CallState) => void>();
  private socket: WebSocket | null = null;
  private socketUrl = "";
  private token = "";
  private config: CallConfig | null = null;
  private peer: RTCPeerConnection | null = null;
  private mic: MediaStream | null = null;
  private pendingSignals: Array<Record<string, unknown>> = [];
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private ringTimer: number | null = null;
  private iceTimer: number | null = null;
  private pingTimer: number | null = null;
  private retryTimer: number | null = null;
  private closed = false;

  constructor(private deps: CallDeps) {}

  subscribe(fn: (s: CallState) => void): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  /** Connect the calls socket (only when calling is open to this user). */
  async start(socketUrl: string, token: string) {
    const res = await apiClient.getCallConfig();
    if (res.error || !res.data?.enabled) return false;
    this.config = res.data;
    this.socketUrl = socketUrl;
    this.token = token;
    this.closed = false;
    this.connectSocket();
    return true;
  }

  stop() {
    this.closed = true;
    this.socket?.close();
    this.socket = null;
    [this.pingTimer, this.retryTimer].forEach((t) => t != null && this.deps.clearTimer(t));
  }

  get enabled() {
    return this.config?.enabled === true;
  }

  private connectSocket() {
    if (this.closed || !this.token) return;
    const ws = this.deps.createSocket(`${this.socketUrl}?token=${encodeURIComponent(this.token)}`);
    this.socket = ws;
    ws.onmessage = (ev) => {
      try {
        this.onMessage(JSON.parse(String(ev.data)));
      } catch {
        /* ignore malformed */
      }
    };
    ws.onclose = () => {
      if (this.socket !== ws || this.closed) return;
      if (this.state.phase === "in_call") this.set({ phase: "reconnecting" });
      this.retryTimer = this.deps.setTimer(() => this.connectSocket(), 3000);
    };
    ws.onopen = () => {
      if (this.state.phase === "reconnecting" && this.peer?.connectionState === "connected") this.set({ phase: "in_call" });
    };
    if (this.pingTimer == null) {
      const ping = () => {
        if (this.socket?.readyState === 1) this.socket.send(JSON.stringify({ type: "ping" }));
        this.pingTimer = this.deps.setTimer(ping, 30000);
      };
      this.pingTimer = this.deps.setTimer(ping, 30000);
    }
  }

  private sendSignal(payload: Record<string, unknown>) {
    const call = this.state.call;
    if (!call || this.socket?.readyState !== 1) return;
    this.socket.send(JSON.stringify({ type: "signal", call_id: call.id, payload }));
  }

  private onMessage(msg: { type?: string; call?: CallInfo; call_id?: string; payload?: Record<string, unknown> }) {
    if (msg.type === "call.incoming" && msg.call) {
      if (this.state.phase !== "idle" && this.state.phase !== "ended") {
        void apiClient.callAction(msg.call.id, "decline"); // already in a call on this device
        return;
      }
      this.set({ ...IDLE, phase: "incoming", call: msg.call });
      return;
    }
    if (msg.type === "call.update" && msg.call) this.onUpdate(msg.call);
    else if (msg.type === "signal" && msg.payload && msg.call_id === this.state.call?.id) void this.onSignal(msg.payload);
  }

  private onUpdate(call: CallInfo) {
    if (call.id !== this.state.call?.id) return;
    if (call.status === "accepted") {
      if (call.direction === "outgoing" && this.state.phase === "ringing") {
        this.clearRing();
        this.set({ call, phase: "connecting", message: "" });
        void this.beginAudio(true);
      } else if (call.direction === "incoming" && this.state.phase === "incoming") {
        this.finish("cancelled", "Answered on another device"); // accepted elsewhere
      } else {
        this.set({ call });
      }
      return;
    }
    const outcome = OUTCOME_BY_STATUS[call.status];
    if (outcome) this.finish(outcome, "", call);
    else this.set({ call });
  }

  /** Call someone about a booking / instrument / invoice. */
  async call(context: CallContextType, id: number, role: CallRole, calleeId?: number, reason = "") {
    if (this.state.phase !== "idle" && this.state.phase !== "ended") return;
    this.set({ ...IDLE, phase: "calling" });
    const res = await apiClient.startCall({ context, id, role, callee_id: calleeId, reason, platform: this.deps.platform });
    if (res.error || !res.data) {
      this.set({ phase: "ended", outcome: "unavailable", message: res.error || OUTCOME_TEXT.unavailable });
      return;
    }
    if (res.data.status === "busy") {
      this.finish("busy", "", res.data);
      return;
    }
    this.set({ phase: "ringing", call: res.data });
    const ringMs = (res.data.ring_seconds || this.config?.ring_seconds || 45) * 1000;
    this.ringTimer = this.deps.setTimer(() => {
      if (this.state.phase === "ringing" && this.state.call) {
        void apiClient.callAction(this.state.call.id, "timeout");
        this.finish("missed");
      }
    }, ringMs);
  }

  async accept() {
    const call = this.state.call;
    if (this.state.phase !== "incoming" || !call) return;
    this.set({ phase: "connecting" });
    try {
      await this.preparePeer(); // microphone opens only now, after the user chose to answer
    } catch {
      void apiClient.callAction(call.id, "decline");
      this.finish("failed", "Microphone permission is needed to answer calls.");
      return;
    }
    const res = await apiClient.callAction(call.id, "accept", { platform: this.deps.platform });
    if (res.error || res.data?.status !== "accepted") {
      this.finish(OUTCOME_BY_STATUS[res.data?.status as CallInfo["status"]] || "failed", res.error || "", res.data);
      return;
    }
    this.set({ call: res.data });
    this.flushSignals();
  }

  /** The phone's own incoming-call screen was answered (native app opens /calls/answer/<id>). */
  async answerById(callId: string) {
    const res = await apiClient.getCall(callId);
    const call = res.data;
    if (!call) return;
    if (call.status === "ringing" && call.direction === "incoming") {
      this.set({ ...IDLE, phase: "incoming", call });
      await this.accept();
    } else if (this.state.call?.id !== call.id) {
      this.finish(OUTCOME_BY_STATUS[call.status] || "missed", "", call);
    }
  }

  async decline() {
    const call = this.state.call;
    if (this.state.phase !== "incoming" || !call) return;
    await apiClient.callAction(call.id, "decline");
    this.finish("declined");
  }

  /** Cancel a ringing call or end a connected one. */
  async hangUp() {
    const call = this.state.call;
    if (!call || this.state.phase === "idle" || this.state.phase === "ended") return;
    if (this.state.phase === "incoming") return this.decline();
    const ringing = this.state.phase === "ringing" || this.state.phase === "calling";
    this.sendSignal({ kind: "bye" });
    await apiClient.callAction(call.id, ringing ? "cancel" : "end");
    this.finish(ringing ? "cancelled" : "completed");
  }

  toggleMute() {
    const muted = !this.state.muted;
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.set({ muted });
  }

  async toggleSpeaker() {
    const speaker = !this.state.speaker;
    await this.deps.setSpeaker?.(speaker);
    this.set({ speaker });
  }

  dismiss() {
    if (this.state.phase === "ended") this.set(IDLE);
  }

  private async preparePeer() {
    if (this.peer) return;
    this.mic = await this.deps.getMicrophone();
    const peer = this.deps.createPeer({ iceServers: this.config?.ice_servers ?? [] });
    this.peer = peer;
    this.mic.getTracks().forEach((t) => peer.addTrack(t, this.mic!));
    peer.onicecandidate = (ev) => {
      if (ev.candidate) this.sendSignal({ kind: "candidate", candidate: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate });
    };
    peer.ontrack = (ev) => this.deps.playRemote(ev.streams[0] ?? null);
    peer.onconnectionstatechange = () => this.onPeerState(peer.connectionState);
    this.iceTimer = this.deps.setTimer(() => {
      if (this.state.phase === "connecting") void this.failConnection("ice_timeout");
    }, ICE_FAIL_MS);
  }

  private onPeerState(state: RTCPeerConnectionState) {
    if (state === "connected") {
      if (this.iceTimer != null) this.deps.clearTimer(this.iceTimer);
      this.set({ phase: "in_call", connectedAt: this.state.connectedAt ?? this.deps.now(), message: "" });
    } else if (state === "disconnected" && this.state.phase === "in_call") {
      this.set({ phase: "reconnecting" });
    } else if (state === "failed") {
      void this.failConnection("ice_failed");
    }
  }

  private async failConnection(code: string) {
    const call = this.state.call;
    if (call) await apiClient.callAction(call.id, "fail", { code });
    this.finish("failed", this.config?.turn
      ? "The call could not be connected. Please try again."
      : "The call could not be connected. Your network may block direct internet calls; try another network, or raise a support ticket.");
  }

  private async beginAudio(asCaller: boolean) {
    try {
      await this.preparePeer();
    } catch {
      const call = this.state.call;
      if (call) await apiClient.callAction(call.id, "fail", { code: "microphone_denied" });
      this.finish("failed", "Microphone permission is needed for calls.");
      return;
    }
    if (asCaller && this.peer) {
      const offer = await this.peer.createOffer({ offerToReceiveAudio: true });
      await this.peer.setLocalDescription(offer);
      this.sendSignal({ kind: "offer", sdp: offer.sdp });
    }
  }

  private async onSignal(payload: Record<string, unknown>) {
    if (!this.peer) {
      this.pendingSignals.push(payload);
      return;
    }
    const peer = this.peer;
    if (payload.kind === "offer") {
      await peer.setRemoteDescription({ type: "offer", sdp: String(payload.sdp) });
      this.flushCandidates();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      this.sendSignal({ kind: "answer", sdp: answer.sdp });
    } else if (payload.kind === "answer") {
      await peer.setRemoteDescription({ type: "answer", sdp: String(payload.sdp) });
      this.flushCandidates();
    } else if (payload.kind === "candidate" && payload.candidate) {
      const cand = payload.candidate as RTCIceCandidateInit;
      if (peer.remoteDescription) await peer.addIceCandidate(cand).catch(() => undefined);
      else this.pendingCandidates.push(cand);
    } else if (payload.kind === "bye") {
      this.finish("completed");
    }
  }

  private flushSignals() {
    const queued = this.pendingSignals;
    this.pendingSignals = [];
    queued.forEach((p) => void this.onSignal(p));
  }

  private flushCandidates() {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    queued.forEach((c) => void this.peer?.addIceCandidate(c).catch(() => undefined));
  }

  private clearRing() {
    if (this.ringTimer != null) this.deps.clearTimer(this.ringTimer);
    this.ringTimer = null;
  }

  private finish(outcome: CallOutcome, message = "", call?: CallInfo | null) {
    this.clearRing();
    if (this.iceTimer != null) this.deps.clearTimer(this.iceTimer);
    this.peer?.close();
    this.peer = null;
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
    this.pendingSignals = [];
    this.pendingCandidates = [];
    this.deps.playRemote(null);
    void this.deps.setSpeaker?.(false);
    this.set({ phase: "ended", outcome, message, call: call ?? this.state.call, muted: false, speaker: false });
  }
}
