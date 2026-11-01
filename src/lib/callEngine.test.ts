// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getCallConfig: vi.fn(),
  startCall: vi.fn(),
  callAction: vi.fn(),
  getCall: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiClient: api }));

import { CallEngine, callsSocketUrl, type CallDeps } from "./callEngine";

class FakeSocket {
  readyState = 1;
  sent: Array<Record<string, unknown>> = [];
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onopen: (() => void) | null = null;
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {}
  push(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

class FakePeer {
  connectionState: RTCPeerConnectionState = "new";
  remoteDescription: RTCSessionDescriptionInit | null = null;
  tracks = 0;
  closed = false;
  candidates: RTCIceCandidateInit[] = [];
  onicecandidate: ((ev: { candidate: unknown }) => void) | null = null;
  ontrack: ((ev: { streams: unknown[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  addTrack() {
    this.tracks += 1;
  }
  async createOffer() {
    return { type: "offer", sdp: "offer-sdp" };
  }
  async createAnswer() {
    return { type: "answer", sdp: "answer-sdp" };
  }
  async setLocalDescription() {}
  async setRemoteDescription(d: RTCSessionDescriptionInit) {
    this.remoteDescription = d;
  }
  async addIceCandidate(c: RTCIceCandidateInit) {
    this.candidates.push(c);
  }
  close() {
    this.closed = true;
  }
  connect() {
    this.connectionState = "connected";
    this.onconnectionstatechange?.();
  }
}

const call = (over: Record<string, unknown> = {}) => ({
  id: "c1", status: "ringing", status_display: "Ringing", direction: "outgoing", role: "operator", role_label: "Lab Operator",
  other: { id: 9, name: "Devendra Sharma" }, context_type: "booking", context_id: 5, context_label: "Booking IICX1", reason: "",
  created_at: "", answered_at: null, ended_at: null, duration_seconds: 0, failure_code: "", ring_seconds: 45, ...over,
});

let socket: FakeSocket;
let peer: FakePeer;
let mic: { stopped: number; enabled: boolean };
let timers: Array<{ fn: () => void; ms: number; id: number }>;

function deps(over: Partial<CallDeps> = {}): CallDeps {
  return {
    createSocket: () => (socket = new FakeSocket()) as unknown as WebSocket,
    createPeer: () => (peer = new FakePeer()) as unknown as RTCPeerConnection,
    getMicrophone: vi.fn(async () => {
      const track = { stop: () => (mic.stopped += 1), set enabled(v: boolean) { mic.enabled = v; } };
      return { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
    }),
    playRemote: vi.fn(),
    setSpeaker: vi.fn(),
    now: () => 1000,
    setTimer: (fn, ms) => {
      const id = timers.length + 1;
      timers.push({ fn, ms, id });
      return id;
    },
    clearTimer: (id) => {
      timers = timers.filter((t) => t.id !== id);
    },
    platform: "web",
    ...over,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  timers = [];
  mic = { stopped: 0, enabled: true };
  api.getCallConfig.mockResolvedValue({ data: { enabled: true, ice_servers: [{ urls: ["stun:x"] }], turn: false, ring_seconds: 45 } });
});
afterEach(() => vi.clearAllMocks());

describe("callsSocketUrl", () => {
  it("builds the WebSocket address from the API base", () => {
    expect(callsSocketUrl("/api", "https:", "equip.iitr.ac.in")).toBe("wss://equip.iitr.ac.in/ws/calls/");
    expect(callsSocketUrl("http://127.0.0.1:8000/api", "http:", "x")).toBe("ws://127.0.0.1:8000/ws/calls/");
  });
});

describe("CallEngine", () => {
  it("stays off when calling is not open to the user", async () => {
    api.getCallConfig.mockResolvedValue({ data: { enabled: false, ice_servers: [], turn: false, ring_seconds: 45 } });
    const engine = new CallEngine(deps());
    expect(await engine.start("wss://h/ws/calls/", "tok")).toBe(false);
  });

  it("calls, rings, connects only after the answer, then ends", async () => {
    const d = deps();
    const engine = new CallEngine(d);
    await engine.start("wss://h/ws/calls/", "tok");
    api.startCall.mockResolvedValue({ data: call() });
    await engine.call("booking", 5, "operator");
    expect(engine.state.phase).toBe("ringing");
    expect(d.getMicrophone).not.toHaveBeenCalled(); // no microphone before the call is answered
    socket.push({ type: "call.update", call: call({ status: "accepted" }) });
    await flush();
    expect(engine.state.phase).toBe("connecting");
    expect(d.getMicrophone).toHaveBeenCalledTimes(1);
    expect(socket.sent.find((m) => m.type === "signal")).toEqual({ type: "signal", call_id: "c1", payload: { kind: "offer", sdp: "offer-sdp" } });
    socket.push({ type: "signal", call_id: "c1", payload: { kind: "answer", sdp: "answer-sdp" } });
    await flush();
    expect(peer.remoteDescription).toEqual({ type: "answer", sdp: "answer-sdp" });
    peer.connect();
    expect(engine.state.phase).toBe("in_call");
    engine.toggleMute();
    expect(engine.state.muted).toBe(true);
    expect(mic.enabled).toBe(false);
    api.callAction.mockResolvedValue({ data: call({ status: "ended" }) });
    await engine.hangUp();
    expect(api.callAction).toHaveBeenLastCalledWith("c1", "end");
    expect(engine.state.phase).toBe("ended");
    expect(engine.state.outcome).toBe("completed");
    expect(peer.closed).toBe(true);
    expect(mic.stopped).toBe(1);
  });

  it("answers an incoming call: microphone first, then accept, then answers the offer", async () => {
    const d = deps({ platform: "android" });
    const engine = new CallEngine(d);
    await engine.start("wss://h/ws/calls/", "tok");
    socket.push({ type: "call.incoming", call: call({ direction: "incoming" }) });
    expect(engine.state.phase).toBe("incoming");
    api.callAction.mockResolvedValue({ data: call({ direction: "incoming", status: "accepted" }) });
    await engine.accept();
    expect(api.callAction).toHaveBeenCalledWith("c1", "accept", { platform: "android" });
    socket.push({ type: "signal", call_id: "c1", payload: { kind: "candidate", candidate: { candidate: "c-early" } } });
    socket.push({ type: "signal", call_id: "c1", payload: { kind: "offer", sdp: "offer-sdp" } });
    await flush();
    await flush();
    expect(socket.sent.some((m) => (m.payload as { kind?: string })?.kind === "answer")).toBe(true);
    expect(peer.candidates).toEqual([{ candidate: "c-early" }]); // held until the remote description arrived
    socket.push({ type: "signal", call_id: "other", payload: { kind: "bye" } }); // another call's signal is ignored
    expect(engine.state.phase).toBe("connecting");
  });

  it("shows the outcome when declined, busy, or not answered in time", async () => {
    const engine = new CallEngine(deps());
    await engine.start("wss://h/ws/calls/", "tok");
    api.startCall.mockResolvedValue({ data: call() });
    await engine.call("booking", 5, "operator");
    socket.push({ type: "call.update", call: call({ status: "declined" }) });
    expect(engine.state).toMatchObject({ phase: "ended", outcome: "declined" });

    engine.dismiss();
    api.startCall.mockResolvedValue({ data: call({ id: "c2", status: "busy" }) });
    await engine.call("booking", 5, "operator");
    expect(engine.state).toMatchObject({ phase: "ended", outcome: "busy" });

    engine.dismiss();
    api.startCall.mockResolvedValue({ data: call({ id: "c3" }) });
    api.callAction.mockResolvedValue({ data: call({ id: "c3", status: "missed" }) });
    await engine.call("booking", 5, "operator");
    timers.find((t) => t.ms === 45000)!.fn();
    expect(api.callAction).toHaveBeenCalledWith("c3", "timeout");
    expect(engine.state).toMatchObject({ phase: "ended", outcome: "missed" });
  });

  it("reports a connection that cannot be made (no TURN) with a clear message", async () => {
    const engine = new CallEngine(deps());
    await engine.start("wss://h/ws/calls/", "tok");
    api.startCall.mockResolvedValue({ data: call() });
    api.callAction.mockResolvedValue({ data: call({ status: "failed" }) });
    await engine.call("booking", 5, "operator");
    socket.push({ type: "call.update", call: call({ status: "accepted" }) });
    await flush();
    peer.connectionState = "failed";
    peer.onconnectionstatechange?.();
    await flush();
    expect(api.callAction).toHaveBeenCalledWith("c1", "fail", { code: "ice_failed" });
    expect(engine.state.outcome).toBe("failed");
    expect(engine.state.message).toMatch(/network may block direct internet calls/);
  });

  it("declines when the microphone is refused, and when already in another call", async () => {
    const engine = new CallEngine(deps({ getMicrophone: vi.fn(async () => { throw new Error("denied"); }) }));
    await engine.start("wss://h/ws/calls/", "tok");
    socket.push({ type: "call.incoming", call: call({ direction: "incoming" }) });
    await engine.accept();
    expect(api.callAction).toHaveBeenCalledWith("c1", "decline");
    expect(engine.state.message).toMatch(/Microphone permission/);

    const busy = new CallEngine(deps());
    await busy.start("wss://h/ws/calls/", "tok");
    socket.push({ type: "call.incoming", call: call({ id: "a", direction: "incoming" }) });
    socket.push({ type: "call.incoming", call: call({ id: "b", direction: "incoming" }) });
    expect(busy.state.call?.id).toBe("a");
    expect(api.callAction).toHaveBeenCalledWith("b", "decline");
  });

  it("stops ringing on other devices once answered elsewhere", async () => {
    const engine = new CallEngine(deps());
    await engine.start("wss://h/ws/calls/", "tok");
    socket.push({ type: "call.incoming", call: call({ direction: "incoming" }) });
    socket.push({ type: "call.update", call: call({ direction: "incoming", status: "accepted" }) });
    expect(engine.state).toMatchObject({ phase: "ended", message: "Answered on another device" });
  });

  it("answers from the phone's incoming-call screen", async () => {
    const engine = new CallEngine(deps());
    await engine.start("wss://h/ws/calls/", "tok");
    api.getCall.mockResolvedValue({ data: call({ direction: "incoming" }) });
    api.callAction.mockResolvedValue({ data: call({ direction: "incoming", status: "accepted" }) });
    await engine.answerById("c1");
    expect(api.callAction).toHaveBeenCalledWith("c1", "accept", { platform: "web" });
  });
});
