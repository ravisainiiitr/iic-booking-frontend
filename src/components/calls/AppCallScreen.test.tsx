// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { CallEngine, CallState } from "@/lib/callEngine";

vi.mock("@/lib/nativeApp", () => ({ isNativeApp: () => true }));

import CallScreen from "./CallScreen";

const call = { id: "c1", status: "failed", direction: "outgoing", role: "operator", role_label: "Lab Operator", other: { id: 9, name: "Sample Operator" }, context_type: "booking", context_id: 5, context_label: "Booking X" };
const base: CallState = { phase: "ended", call: call as never, outcome: "dropped", message: "", muted: false, speaker: false, connectedAt: null };

function engine() {
  return { callBack: vi.fn(), dismiss: vi.fn(), hangUp: vi.fn(), toggleMute: vi.fn(), toggleSpeaker: vi.fn(), decline: vi.fn(), accept: vi.fn() };
}

function show(state: Partial<CallState>) {
  const eng = engine();
  render(<MemoryRouter><CallScreen state={{ ...base, ...state }} engine={eng as unknown as CallEngine} /></MemoryRouter>);
  return eng;
}

afterEach(cleanup);

describe("the call screen in the app", () => {
  it("explains a drop and calls back with one tap", () => {
    const eng = show({});
    expect(screen.getByText("Call disconnected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Call back" }));
    expect(eng.callBack).toHaveBeenCalledTimes(1);
  });

  it("offers Call again when not answered, and no call back on a finished call", () => {
    show({ outcome: "missed" });
    expect(screen.getByRole("button", { name: "Call again" })).toBeTruthy();
    cleanup();
    show({ outcome: "completed" });
    expect(screen.queryByRole("button", { name: /Call (back|again)/ })).toBeNull();
  });

  it("keeps the person's name while a call back is being set up", () => {
    show({ phase: "calling", call: null, outcome: "", callingPerson: { id: 9, name: "Sample Operator" } });
    expect(screen.getByRole("heading", { name: "Sample Operator" })).toBeTruthy();
    expect(screen.getByText("Calling…")).toBeTruthy();
  });

  it("says it is reconnecting and keeps End within reach", () => {
    const eng = show({ phase: "reconnecting", outcome: "", connectedAt: Date.now() });
    expect(screen.getByText("Reconnecting…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "End call" }));
    expect(eng.hangUp).toHaveBeenCalled();
  });

  it("can be minimised to use the app during a call, and reopened", () => {
    show({ phase: "in_call", outcome: "", connectedAt: Date.now() });
    fireEvent.click(screen.getByRole("button", { name: "Minimise call" }));
    expect(screen.queryByTestId("call-screen")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Sample Operator/ }));
    expect(screen.getByTestId("call-screen")).toBeTruthy();
  });

  it("explains an unavailable person and points to a ticket when calling fails", () => {
    show({ outcome: "unavailable", message: "Sample Operator cannot be called back from here." });
    expect(screen.getByText(/cannot be called back/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /support ticket/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Call (back|again)/ })).toBeNull();
  });

  it("keeps Answer and Decline on an incoming call", () => {
    const eng = show({ phase: "incoming", outcome: "" });
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    expect(eng.accept).toHaveBeenCalled();
  });
});
