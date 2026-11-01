import { describe, expect, it, vi } from "vitest";

import type { LiveFeedPeer, LiveFeedSession } from "@/lib/api";
import { LiveFeedViewer, NETWORK_HINT, type LiveFeedApi } from "@/lib/liveFeed";

class FakePeer {
  transceivers: Array<{ kind: string; direction: string }> = [];
  tracks: unknown[] = [];
  localDescription: { sdp: string } | null = null;
  remote: { type: string; sdp?: string } | null = null;
  iceGatheringState = "complete";
  connectionState = "new";
  closed = false;
  ontrack: ((e: unknown) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  onicegatheringstatechange: (() => void) | null = null;
  addTransceiver(kind: string, init: { direction: string }) {
    this.transceivers.push({ kind, direction: init.direction });
  }
  addTrack(track: unknown) {
    this.tracks.push(track);
  }
  async createOffer() {
    return { type: "offer", sdp: `v=0 offer ${this.transceivers.map((t) => t.kind).join(",")}` };
  }
  async setLocalDescription(d: { sdp: string }) {
    this.localDescription = d;
  }
  async setRemoteDescription(d: { type: string; sdp?: string }) {
    this.remote = d;
  }
  close() {
    this.closed = true;
  }
  connect(state: string) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

const session = (over: Partial<LiveFeedSession> = {}): LiveFeedSession => ({
  id: 7,
  equipment: { id: 1, name: "FE-SEM" },
  booking_id: 3,
  sources: ["screen", "camera"],
  audio: true,
  status: "active",
  started_at: "",
  slot_end: "",
  end_reason: "",
  ...over,
});

const peer = (over: Partial<LiveFeedPeer>): LiveFeedPeer => ({
  peer_id: 1, status: "offered", error: "", sdp: null, session_status: "active", end_reason: "", ...over,
});

function setup(opts: { answers?: (id: number) => LiveFeedPeer; mic?: boolean } = {}) {
  const peers: FakePeer[] = [];
  let next = 0;
  const api: LiveFeedApi & { offers: Array<{ kind: string; sdp: string }>; closed: number[] } = {
    offers: [],
    closed: [],
    offerLiveFeed: vi.fn(async (_s, kind, sdp) => {
      api.offers.push({ kind, sdp });
      return { peer_id: ++next };
    }),
    getLiveFeedPeer: vi.fn(async (id: number) =>
      opts.answers ? opts.answers(id) : peer({ peer_id: id, status: "answered", sdp: `v=0 answer ${id}` })),
    closeLiveFeedPeer: vi.fn(async (id: number) => api.closed.push(id)),
  };
  const micTrack = { enabled: true, stop: vi.fn() };
  const mic = { getAudioTracks: () => [micTrack], getTracks: () => [micTrack] } as unknown as MediaStream;
  const events = { onStream: vi.fn(), onState: vi.fn(), onEnded: vi.fn() };
  const viewer = new LiveFeedViewer(
    {
      api,
      createPeer: () => {
        const p = new FakePeer();
        peers.push(p);
        return p as unknown as RTCPeerConnection;
      },
      getMicrophone: async () => {
        if (opts.mic === false) throw new Error("denied");
        return mic;
      },
      sleep: async () => undefined,
    },
    events,
  );
  return { viewer, api, peers, events, micTrack };
}

describe("LiveFeedViewer", () => {
  it("opens the screen with two-way audio and the camera as video only, then applies the answers", async () => {
    const { viewer, api, peers, events, micTrack } = setup();
    await viewer.start(session(), [{ urls: "stun:stun.l.google.com:19302" }]);

    expect(api.offers.map((o) => o.kind)).toEqual(["screen", "camera"]);
    expect(peers[0].transceivers).toEqual([{ kind: "video", direction: "recvonly" }]);
    expect(peers[0].tracks).toEqual([micTrack]);
    expect(peers[1].transceivers).toEqual([{ kind: "video", direction: "recvonly" }]);
    expect(peers[1].tracks).toEqual([]);
    expect(peers.map((p) => p.remote?.sdp)).toEqual(["v=0 answer 1", "v=0 answer 2"]);

    peers[0].connect("connected");
    expect(events.onState).toHaveBeenCalledWith("screen", "live");
    viewer.setMicMuted(true);
    expect(micTrack.enabled).toBe(false);

    viewer.stop();
    expect(peers.every((p) => p.closed)).toBe(true);
    expect(api.closed.sort()).toEqual([1, 2]);
    expect(micTrack.stop).toHaveBeenCalled();
  });

  it("listens only when the microphone is refused", async () => {
    const { viewer, peers } = setup({ mic: false });
    await viewer.start(session({ sources: ["screen"] }), []);
    expect(viewer.micAvailable).toBe(false);
    expect(peers[0].transceivers).toEqual([
      { kind: "video", direction: "recvonly" },
      { kind: "audio", direction: "recvonly" },
    ]);
  });

  it("explains a failed direct connection and a refused answer", async () => {
    const { viewer, peers, events } = setup({
      answers: (id) => (id === 2 ? peer({ peer_id: 2, status: "failed", error: "Camera not reachable" })
        : peer({ peer_id: id, status: "answered", sdp: "v=0 a" })),
    });
    await viewer.start(session(), []);
    expect(events.onState).toHaveBeenCalledWith("camera", "failed", "Camera not reachable");
    peers[0].connect("failed");
    expect(events.onState).toHaveBeenCalledWith("screen", "failed", NETWORK_HINT);
  });

  it("stops when the operator ends the feed or the slot ends", async () => {
    let ended = false;
    const { viewer, peers, events } = setup({
      answers: (id) => (ended ? peer({ peer_id: id, session_status: "ended", end_reason: "The booking slot ended." })
        : peer({ peer_id: id, status: "answered", sdp: "v=0 a" })),
    });
    await viewer.start(session({ sources: ["screen"] }), []);
    ended = true;
    await viewer.check();
    expect(events.onEnded).toHaveBeenCalledWith("The booking slot ended.");
    expect(peers[0].closed).toBe(true);
  });
});
