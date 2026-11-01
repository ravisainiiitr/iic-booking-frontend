// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("./CallProvider", () => ({ useCalls: () => ctx.value }));

import CallButton from "./CallButton";
import CallScreen from "./CallScreen";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => cleanup());

function setup(roles: unknown[], enabled = true) {
  const engine = { call: vi.fn() };
  ctx.value = {
    enabled,
    engine,
    state: { phase: "idle" },
    loadOptions: vi.fn(async () => ({ enabled: true, roles })),
  };
  return engine;
}

const role = (r: string, people: unknown[], fallback = "") => ({ role: r, label: r === "operator" ? "Lab Operator" : "Officer In Charge", people, fallback });

describe("CallButton", () => {
  it("calls the one configured person with a clear label", async () => {
    const engine = setup([role("operator", [{ id: 9, name: "Devendra Sharma", available: true }])]);
    render(<MemoryRouter><CallButton context="booking" id={5} role="operator" label="Call Lab Operator" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Call Lab Operator: Devendra Sharma" }));
    expect(engine.call).toHaveBeenCalledWith("booking", 5, "operator", 9, "");
  });

  it("offers a labelled choice when several people qualify", async () => {
    setup([role("operator", [{ id: 9, name: "A Operator", available: true }, { id: 10, name: "B Operator", available: false }])]);
    render(<MemoryRouter><CallButton context="booking" id={5} role="operator" /></MemoryRouter>);
    const trigger = await screen.findByRole("button", { name: "Call Lab Operator" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    expect(await screen.findByText("Choose whom to call")).toBeTruthy();
    expect(screen.getByText("not reachable")).toBeTruthy();
  });

  it("points to the OIC, or a ticket, when nobody can be reached", async () => {
    const engine = setup([role("operator", [{ id: 9, name: "A", available: false }], "oic")]);
    render(<MemoryRouter><CallButton context="booking" id={5} role="operator" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Call the Officer In Charge instead" }));
    expect(engine.call).toHaveBeenCalledWith("booking", 5, "oic", undefined, "");
    cleanup();
    setup([role("operator", [{ id: 9, name: "A", available: false }], "ticket")]);
    render(<MemoryRouter><CallButton context="booking" id={5} role="operator" /></MemoryRouter>);
    expect((await screen.findByRole("link", { name: "Raise a support ticket" })).getAttribute("href")).toBe("/tickets");
  });

  it("shows nothing when calling is off or nobody is configured", async () => {
    setup([role("operator", [])]);
    const { container } = render(<MemoryRouter><CallButton context="booking" id={5} role="operator" /></MemoryRouter>);
    await waitFor(() => expect((ctx.value as { loadOptions: ReturnType<typeof vi.fn> }).loadOptions).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
    cleanup();
    setup([role("operator", [{ id: 9, name: "A", available: true }])], false);
    const off = render(<MemoryRouter><CallButton context="booking" id={5} role="operator" /></MemoryRouter>);
    expect(off.container.innerHTML).toBe("");
  });
});

describe("CallScreen", () => {
  const callInfo = { id: "c1", other: { name: "Devendra Sharma" }, role_label: "Lab Operator", context_label: "Booking IICX1", context_type: "booking", context_id: 5 };

  it("lets the user answer or decline an incoming call", () => {
    const engine = { accept: vi.fn(), decline: vi.fn(), dismiss: vi.fn() };
    render(<MemoryRouter><CallScreen engine={engine as never} state={{ phase: "incoming", call: callInfo, outcome: "", message: "", muted: false, speaker: false, connectedAt: null } as never} /></MemoryRouter>);
    expect(screen.getByRole("alertdialog", { name: "Incoming call from Devendra Sharma" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(engine.accept).toHaveBeenCalled();
    expect(engine.decline).toHaveBeenCalled();
  });

  it("in a call: mute, speaker and end", () => {
    const engine = { toggleMute: vi.fn(), toggleSpeaker: vi.fn(), hangUp: vi.fn() };
    render(<MemoryRouter><CallScreen engine={engine as never} state={{ phase: "in_call", call: callInfo, outcome: "", message: "", muted: false, speaker: false, connectedAt: Date.now() } as never} /></MemoryRouter>);
    expect(screen.getByRole("status").textContent).toMatch(/In call · 0:0\d/);
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    fireEvent.click(screen.getByRole("button", { name: "Speaker on" }));
    fireEvent.click(screen.getByRole("button", { name: /End/ }));
    expect(engine.toggleMute).toHaveBeenCalled();
    expect(engine.toggleSpeaker).toHaveBeenCalled();
    expect(engine.hangUp).toHaveBeenCalled();
  });

  it("after a failed call offers a support ticket", () => {
    render(<MemoryRouter><CallScreen engine={{ dismiss: vi.fn() } as never} state={{ phase: "ended", call: callInfo, outcome: "failed", message: "The call could not be connected.", muted: false, speaker: false, connectedAt: null } as never} /></MemoryRouter>);
    expect(screen.getByText("The call could not be connected.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Raise a support ticket" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to bookings" })).toBeTruthy();
  });
});
