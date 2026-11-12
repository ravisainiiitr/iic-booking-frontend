/**
 * In-app internet voice calls (WebRTC, peer to peer). The server only authorises calls, keeps their state and relays
 * signalling over ws/calls/; audio goes directly between the two devices (or via TURN when configured). Nothing is
 * recorded. The microphone is opened only once the call is answered: the callee on Accept, the caller when told the
 * callee accepted.
 *
 * Browser APIs are injected so the engine can be tested without a real browser.
 */
import { apiClient, type CallConfig, type CallContextType, type CallInfo, type CallPerson, type CallRole } from "@/lib/api";

export type CallPhase =
  | "idle"
  | "calling" // asking the server
  | "ringing" // the other side is being rung
  | "incoming" // someone is calling us
  | "connecting" // answered; setting up audio
  | "in_call"
  | "reconnecting"
  | "ended"; // final: see outcome

export type CallOutcome = "completed" | "dropped" | "declined" | "missed" | "busy" | "cancelled" | "failed" | "unavailable" | "";

export interface CallState {
  phase: CallPhase;
  call: CallInfo | null;
  outcome: CallOutcome;
  message: string;
  muted: boolean;
  speaker: boolean;
  connectedAt: number | null;
  /** Who is being called while the server has not created the call yet (a call back knows the person already). */
  callingPerson?: CallPerson | null;
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
  /** The current sign-in token: app tokens last 24 hours, so a reconnecting socket must not reuse the first one. */
  getToken?: () => string | null;
}

const IDLE: CallState = { phase: "idle", call: null, outcome: "", message: "", muted: false, speaker: false, connectedAt: null };
const ICE_FAIL_MS = 20000;
/** A connected call that loses audio: ask for a new network path after this long (only the caller asks, so offers never cross). */
const ICE_RESTART_MS = 3000;
/** Second attempt, for a phone that has only just moved to another network. */
const ICE_RESTART_AGAIN_MS = 12000;
/** Give up and offer Call back. No new call is ever placed automatically: reconnecting stays inside the same call. */
const RECONNECT_GIVE_UP_MS = 25000;

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
  dropped: "Call disconnected",
  declined: "Declined",
  missed: "No answer",
  busy: "Busy on another call",
  cancelled: "Call cancelled",
  failed: "The call could not be connected",
  unavailable: "Calling is not available",
};

/** A call that rang here and nobody answered, including one the caller gave up on while it rang. */
export function isMissedCall(c: Pick<CallInfo, "direction" | "status">): boolean {
  return c.direction === "incoming" && (c.status === "missed" || c.status === "cancelled");
}

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
  private reconnectTimers: number[] = [];
  /** The person hung up while the server was still creating the call: cancel it as soon as it exists. */
  private abortStart = false;
  /** The other person's call that arrived while ours was still being created. */
  private crossedCall: CallInfo | null = null;
  /** A dropped call the server could not be told about yet (no network): told before the next call or when back online. */
  private unreportedDrop: string | null = null;
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
    const token = this.deps.getToken?.() || this.token;
    if (this.closed || !token) return;
    this.token = token;
    const ws = this.deps.createSocket(`${this.socketUrl}?token=${encodeURIComponent(token)}`);
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
      // Audio goes directly between the phones: losing the signalling socket alone does not interrupt the call.
      this.retryTimer = this.deps.setTimer(() => this.connectSocket(), 3000);
    };
    ws.onopen = () => {
      if (this.state.phase === "reconnecting") void this.restartIce();
      void this.resync();
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
      if (this.isCrossedCall(msg.call)) {
        if (this.state.phase === "calling") this.crossedCall = msg.call;
        else void this.resolveCrossedCalls(msg.call);
        return;
      }
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
    // The other phone gave up on a call that had been connected: that is a drop to call back from, not a failed call.
    if (outcome === "failed" && this.state.connectedAt != null) this.finish("dropped", "", call);
    else if (outcome) this.finish(outcome, "", call);
    else this.set({ call });
  }

  /** Call someone about a booking / instrument / invoice. */
  async call(context: CallContextType, id: number, role: CallRole, calleeId?: number, reason = "", person: CallPerson | null = null) {
    if (this.state.phase !== "idle" && this.state.phase !== "ended") return;
    this.set({ ...IDLE, phase: "calling", callingPerson: person });
    this.abortStart = false;
    this.crossedCall = null;
    await this.reportDrop();
    const res = await apiClient.startCall({ context, id, role, callee_id: calleeId, reason, platform: this.deps.platform });
    if (this.abortStart) {
      if (res.data?.status === "ringing") void apiClient.callAction(res.data.id, "cancel");
      return;
    }
    const crossed = this.crossedCall as CallInfo | null;
    this.crossedCall = null;
    if (res.error || !res.data) {
      if (crossed) {
        this.set({ ...IDLE, phase: "incoming", call: crossed });
        return;
      }
      this.set({ phase: "ended", outcome: "unavailable", message: res.error || OUTCOME_TEXT.unavailable });
      return;
    }
    if (res.data.status === "busy") {
      if (crossed) {
        this.set({ ...IDLE, phase: "incoming", call: crossed });
        return;
      }
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
    if (crossed) void this.resolveCrossedCalls(crossed);
  }

  /**
   * Call the same person back with the same context. A person who rang us is reached through whichever role the
   * server lists them under for this item; the server decides, so a call it would refuse is never attempted.
   */
  async callBack(previous: CallInfo | null = this.state.call): Promise<void> {
    if (!previous || (this.state.phase !== "idle" && this.state.phase !== "ended")) return;
    this.abortStart = false;
    let role: CallRole | undefined = previous.direction === "outgoing" ? previous.role : undefined;
    if (!role) {
      this.set({ ...IDLE, phase: "calling", callingPerson: previous.other });
      const options = await apiClient.getCallOptions(previous.context_type, previous.context_id);
      if (this.abortStart) {
        this.abortStart = false;
        return;
      }
      role = options.data?.roles?.find((r) => r.people.some((p) => p.id === previous.other.id))?.role;
      if (!role) {
        this.set({
          ...IDLE,
          phase: "ended",
          outcome: "unavailable",
          call: previous,
          message: options.error || `${previous.other.name} cannot be called back from here. They can call you again.`,
        });
        return;
      }
      this.set({ phase: "ended" });
    }
    await this.call(previous.context_type, previous.context_id, role, previous.other.id, "", previous.other);
  }

  /** Our call and theirs crossed: both of us rang the other at the same moment. */
  private isCrossedCall(incoming: CallInfo): boolean {
    if (this.state.phase === "calling") return this.state.callingPerson?.id === incoming.other.id;
    return this.state.phase === "ringing" && this.state.call?.other.id === incoming.other.id;
  }

  /** Both phones apply the same rule, so exactly one call survives: the one with the lower id. */
  private async resolveCrossedCalls(incoming: CallInfo) {
    const ours = this.state.call;
    if (!ours || this.state.phase !== "ringing" || incoming.id > ours.id) return;
    this.clearRing();
    void apiClient.callAction(ours.id, "cancel");
    this.set({ ...IDLE, phase: "incoming", call: incoming });
    await this.accept();
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
    if (this.state.phase === "calling" && !this.state.call) {
      this.abortStart = true;
      this.finish("cancelled");
      return;
    }
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

  /** The phone is back on a network: try again straight away instead of waiting for a timer. */
  networkBack() {
    void this.reportDrop();
    if (this.state.phase === "reconnecting") void this.restartIce();
    if (this.socket?.readyState !== 1 && !this.closed) {
      if (this.retryTimer != null) this.deps.clearTimer(this.retryTimer);
      this.connectSocket();
    }
  }

  /** After a gap (socket lost, app in the background) the call may have been decided without us. */
  async resync() {
    const call = this.state.call;
    if (!call || this.state.phase === "idle" || this.state.phase === "ended") return;
    const res = await apiClient.getCall(call.id);
    if (res.data && res.data.status !== call.status) this.onUpdate(res.data);
  }

  private async reportDrop() {
    const id = this.unreportedDrop;
    if (!id) return;
    const res = await apiClient.callAction(id, "fail", { code: "connection_lost" });
    if (!res.error && this.unreportedDrop === id) this.unreportedDrop = null;
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
      this.clearReconnect();
      if (this.iceTimer != null) this.deps.clearTimer(this.iceTimer);
      this.set({ phase: "in_call", connectedAt: this.state.connectedAt ?? this.deps.now(), message: "" });
    } else if ((state === "disconnected" || state === "failed") && this.state.connectedAt != null) {
      this.beginReconnect();
    } else if (state === "failed") {
      void this.failConnection("ice_failed");
    }
  }

  /** Audio was lost on a connected call: repair it inside the same call for a short while, then offer Call back. */
  private beginReconnect() {
    if (this.state.phase === "reconnecting") return;
    this.set({ phase: "reconnecting" });
    this.reconnectTimers = [
      this.deps.setTimer(() => void this.restartIce(), ICE_RESTART_MS),
      this.deps.setTimer(() => void this.restartIce(), ICE_RESTART_AGAIN_MS),
      this.deps.setTimer(() => this.dropCall(), RECONNECT_GIVE_UP_MS),
    ];
  }

  private clearReconnect() {
    this.reconnectTimers.forEach((t) => this.deps.clearTimer(t));
    this.reconnectTimers = [];
  }

  private async restartIce() {
    const peer = this.peer;
    if (!peer || this.state.call?.direction !== "outgoing" || this.socket?.readyState !== 1) return;
    if (peer.signalingState !== "stable") return;
    try {
      const offer = await peer.createOffer({ iceRestart: true });
      await peer.setLocalDescription(offer);
      this.sendSignal({ kind: "offer", sdp: offer.sdp });
    } catch {
      /* the next attempt, or giving up, deals with it */
    }
  }

  private dropCall() {
    const call = this.state.call;
    // The screen must not wait on a network that has just gone: tell the server afterwards.
    this.unreportedDrop = call?.id ?? null;
    this.finish("dropped");
    void this.reportDrop();
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
    this.clearReconnect();
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
