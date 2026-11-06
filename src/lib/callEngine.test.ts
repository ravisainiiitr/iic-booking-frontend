// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getCallConfig: vi.fn(),
  startCall: vi.fn(),
  callAction: vi.fn(),
  getCall: vi.fn(),
  getCallOptions: vi.fn(),
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
  signalingState: RTCSignalingState = "stable";
  offers: Array<RTCOfferOptions | undefined> = [];
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
  async createOffer(options?: RTCOfferOptions) {
    this.offers.push(options);
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
    this.setState("connected");
  }
  setState(state: RTCPeerConnectionState) {
    this.connectionState = state;
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

  describe("after a connected call loses its connection", () => {
    async function connected(direction: "outgoing" | "incoming" = "outgoing") {
      const engine = new CallEngine(deps());
      await engine.start("wss://h/ws/calls/", "tok");
      api.callAction.mockResolvedValue({ data: call({ status: "failed" }) });
      if (direction === "outgoing") {
        api.startCall.mockResolvedValue({ data: call() });
        await engine.call("booking", 5, "operator");
        socket.push({ type: "call.update", call: call({ status: "accepted" }) });
      } else {
        socket.push({ type: "call.incoming", call: call({ direction: "incoming", role: "user" }) });
        api.callAction.mockResolvedValueOnce({ data: call({ direction: "incoming", status: "accepted" }) });
        await engine.accept();
      }
      await flush();
      peer.connect();
      return engine;
    }
    const fire = (ms: number) => timers.find((t) => t.ms === ms)!.fn();

    it("recovers silently inside the same call when the network comes back", async () => {
      const engine = await connected();
      peer.setState("disconnected");
      expect(engine.state.phase).toBe("reconnecting");
      fire(3000);
      await flush();
      expect(peer.offers.at(-1)).toEqual({ iceRestart: true });
      expect(api.startCall).toHaveBeenCalledTimes(1); // no second call session
      peer.connect();
      expect(engine.state.phase).toBe("in_call");
      expect(timers.some((t) => t.ms === 25000)).toBe(false); // nothing left to fire
    });

    it("gives up after the limit and offers Call back; only the caller restarts", async () => {
      const callee = await connected("incoming");
      peer.setState("failed");
      expect(callee.state.phase).toBe("reconnecting");
      fire(3000);
      await flush();
      expect(peer.offers).toHaveLength(0); // the callee waits for the caller's offer, so offers never cross

      fire(25000);
      await flush();
      expect(callee.state).toMatchObject({ phase: "ended", outcome: "dropped" });
      expect(api.callAction).toHaveBeenCalledWith("c1", "fail", { code: "connection_lost" });
    });

    it("treats the other phone giving up as a drop, not a failed call", async () => {
      const engine = await connected();
      socket.push({ type: "call.update", call: call({ status: "failed" }) });
      expect(engine.state).toMatchObject({ phase: "ended", outcome: "dropped" });
    });

    it("keeps a connected call when only the signalling socket is lost", async () => {
      const engine = await connected();
      socket.onclose?.();
      expect(engine.state.phase).toBe("in_call");
    });

    it("notices the call ended while the socket was away", async () => {
      const engine = await connected();
      api.getCall.mockResolvedValue({ data: call({ status: "ended" }) });
      await engine.resync();
      expect(engine.state).toMatchObject({ phase: "ended", outcome: "completed" });
    });

    it("tells the server about a drop later if it could not reach it at the time", async () => {
      const engine = await connected();
      api.callAction.mockResolvedValueOnce({ error: "offline" });
      peer.setState("failed");
      fire(25000);
      await flush();
      expect(engine.state.outcome).toBe("dropped");
      api.callAction.mockClear();
      api.callAction.mockResolvedValue({ data: call({ status: "failed" }) });
      engine.networkBack();
      await flush();
      expect(api.callAction).toHaveBeenCalledWith("c1", "fail", { code: "connection_lost" });
    });

    it("calls the same person back with the same context, once", async () => {
      const engine = await connected();
      peer.setState("failed");
      fire(25000);
      await flush();
      api.startCall.mockClear();
      api.startCall.mockResolvedValue({ data: call({ id: "c2" }) });
      await Promise.all([engine.callBack(), engine.callBack()]);
      expect(api.startCall).toHaveBeenCalledTimes(1);
      expect(api.startCall).toHaveBeenCalledWith(expect.objectContaining({ context: "booking", id: 5, role: "operator", callee_id: 9 }));
      expect(engine.state.phase).toBe("ringing");
    });

    it("finds the role of someone who rang us, and says so when they cannot be called back", async () => {
      const engine = await connected("incoming");
      peer.setState("failed");
      fire(25000);
      await flush();
      api.getCallOptions.mockResolvedValue({ data: { enabled: true, roles: [{ role: "oic", label: "OIC", people: [{ id: 9, name: "D", available: true }], fallback: "" }] } });
      api.startCall.mockResolvedValue({ data: call({ id: "c2" }) });
      await engine.callBack();
      expect(api.startCall).toHaveBeenCalledWith(expect.objectContaining({ role: "oic", callee_id: 9 }));

      api.callAction.mockResolvedValue({ data: call({ id: "c2", status: "cancelled" }) });
      await engine.hangUp();
      engine.dismiss();
      api.getCallOptions.mockResolvedValue({ data: { enabled: true, roles: [] } });
      api.startCall.mockClear();
      await engine.callBack(call({ direction: "incoming", role: "user" }) as never);
      expect(api.startCall).not.toHaveBeenCalled();
      expect(engine.state.message).toMatch(/cannot be called back/);
    });

    it("answers when the other person rings first, instead of calling over them", async () => {
      const engine = await connected();
      peer.setState("failed");
      fire(25000);
      await flush();
      socket.push({ type: "call.incoming", call: call({ id: "c9", direction: "incoming" }) });
      expect(engine.state).toMatchObject({ phase: "incoming" });
      expect(engine.state.call?.id).toBe("c9");
    });
  });

  describe("when both people call each other at once", () => {
    async function ringing(ourId: string) {
      const engine = new CallEngine(deps());
      await engine.start("wss://h/ws/calls/", "tok");
      api.startCall.mockResolvedValue({ data: call({ id: ourId }) });
      await engine.call("booking", 5, "operator", 9);
      return engine;
    }

    it("the phone with the higher call id gives way and answers", async () => {
      const engine = await ringing("c5");
      api.callAction.mockResolvedValue({ data: call({ id: "c2", direction: "incoming", status: "accepted" }) });
      socket.push({ type: "call.incoming", call: call({ id: "c2", direction: "incoming" }) });
      await flush();
      expect(api.callAction).toHaveBeenCalledWith("c5", "cancel");
      expect(api.callAction).toHaveBeenCalledWith("c2", "accept", { platform: "web" });
      expect(engine.state.call?.id).toBe("c2");
    });

    it("the phone with the lower call id keeps ringing and declines nothing", async () => {
      const engine = await ringing("c2");
      socket.push({ type: "call.incoming", call: call({ id: "c5", direction: "incoming" }) });
      await flush();
      expect(api.callAction).not.toHaveBeenCalled();
      expect(engine.state).toMatchObject({ phase: "ringing" });
    });

    it("still declines a call from someone else while ringing", async () => {
      await ringing("c2");
      socket.push({ type: "call.incoming", call: call({ id: "c7", direction: "incoming", other: { id: 12, name: "Other" } }) });
      expect(api.callAction).toHaveBeenCalledWith("c7", "decline");
    });
  });

  it("cancels the call if the person hangs up while it is still being created", async () => {
    const engine = new CallEngine(deps());
    await engine.start("wss://h/ws/calls/", "tok");
    let reply: (v: unknown) => void = () => undefined;
    api.startCall.mockReturnValue(new Promise((r) => (reply = r)));
    const started = engine.call("booking", 5, "operator");
    await flush();
    await engine.hangUp();
    expect(engine.state).toMatchObject({ phase: "ended", outcome: "cancelled" });
    api.callAction.mockResolvedValue({ data: call({ status: "cancelled" }) });
    reply({ data: call() });
    await started;
    expect(api.callAction).toHaveBeenCalledWith("c1", "cancel");
    expect(engine.state.outcome).toBe("cancelled"); // it does not start ringing behind the person's back
  });

  it("reconnects the socket with the current sign-in token", async () => {
    const urls: string[] = [];
    let token = "first";
    const engine = new CallEngine(deps({
      getToken: () => token,
      createSocket: (url) => {
        urls.push(url);
        return (socket = new FakeSocket()) as unknown as WebSocket;
      },
    }));
    await engine.start("wss://h/ws/calls/", "first");
    token = "second";
    socket.onclose?.();
    timers.find((t) => t.ms === 3000)!.fn();
    expect(urls[1]).toContain("token=second");
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
