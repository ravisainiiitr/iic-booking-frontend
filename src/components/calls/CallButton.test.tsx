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

  it("lets lab staff call the booking user, and says so plainly when the user cannot be reached", async () => {
    const engine = setup([{ role: "user", label: "Booking user", people: [{ id: 7, name: "Asha Rao", available: true }], fallback: "" }]);
    render(<MemoryRouter><CallButton context="booking" id={5} role="user" label="Call user" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Call user: Asha Rao" }));
    expect(engine.call).toHaveBeenCalledWith("booking", 5, "user", 7, "");
    cleanup();
    setup([{ role: "user", label: "Booking user", people: [{ id: 7, name: "Asha Rao", available: false }], fallback: "" }]);
    render(<MemoryRouter><CallButton context="booking" id={5} role="user" label="Call user" /></MemoryRouter>);
    expect(await screen.findByText(/Asha Rao is not on the portal or the app/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Raise a support ticket" })).toBeNull();
  });

  it("explains silent hours instead of offering a call", async () => {
    const engine = setup([role("operator", [{ id: 9, name: "A", available: true }])]);
    (ctx.value as { loadOptions: ReturnType<typeof vi.fn> }).loadOptions.mockResolvedValue({
      enabled: true,
      roles: [role("operator", [{ id: 9, name: "A", available: true }])],
      silent_hours: { active: true, until: null, message: "Calls to the lab are off until Mon 9 Nov at 9:00 AM." },
    });
    render(<MemoryRouter><CallButton context="booking" id={5} role="operator" label="Call Lab Operator" /></MemoryRouter>);
    expect(await screen.findByText(/Calls to the lab are off until Mon 9 Nov/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(engine.call).not.toHaveBeenCalled();
  });

  it("shows nothing to someone the server does not offer the booking user to", async () => {
    setup([role("operator", [{ id: 9, name: "A", available: true }])]);
    const { container } = render(<MemoryRouter><CallButton context="booking" id={5} role="user" label="Call user" /></MemoryRouter>);
    await waitFor(() => expect((ctx.value as { loadOptions: ReturnType<typeof vi.fn> }).loadOptions).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
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

  const incoming = (call: Record<string, unknown>) => ({ phase: "incoming", call, outcome: "", message: "", muted: false, speaker: false, connectedAt: null });

  it("shows who is calling and about which instrument", () => {
    const call = {
      ...callInfo,
      reason: "Sample question",
      other: { id: 3, name: "Asha Rao", photo_url: "https://portal.example/api/users/3/profile-picture/", user_type_label: "Student", designation: "PhD scholar", department: "Chemistry" },
      context: { equipment_id: 44, equipment_name: "X-Ray Fluorescence (XRF)", equipment_department: "Central Facility", booking_ref: "IICX1" },
    };
    render(<MemoryRouter><CallScreen engine={{} as never} state={incoming(call) as never} /></MemoryRouter>);
    expect((screen.getByRole("img", { name: "Photo of Asha Rao" }) as HTMLImageElement).src).toBe(call.other.photo_url);
    expect(screen.getByRole("heading", { name: "Asha Rao" })).toBeTruthy();
    expect(screen.getByText("PhD scholar · Chemistry")).toBeTruthy();
    expect(screen.getByText("For the Lab Operator")).toBeTruthy();
    expect(screen.getByText("X-Ray Fluorescence (XRF)")).toBeTruthy();
    expect(screen.getByText("Central Facility")).toBeTruthy();
    expect(screen.getByText("Booking IICX1")).toBeTruthy();
    expect(screen.getByText(/Sample question/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Answer" }));
  });

  it("falls back to initials when the photo is missing or broken, and to the label without an instrument", () => {
    const photo = { ...callInfo, other: { id: 3, name: "Asha Rao", photo_url: "https://portal.example/broken.jpg" } };
    render(<MemoryRouter><CallScreen engine={{} as never} state={incoming(photo) as never} /></MemoryRouter>);
    fireEvent.error(screen.getByRole("img", { name: "Photo of Asha Rao" }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("AR")).toBeTruthy();
    expect(screen.getByText("About")).toBeTruthy();
    expect(screen.getByText("Booking IICX1")).toBeTruthy();
  });

  it("names the instrument during the call", () => {
    const call = { ...callInfo, context: { equipment_id: 44, equipment_name: "XRF", equipment_department: "", booking_ref: "" } };
    render(<MemoryRouter><CallScreen engine={{} as never} state={{ phase: "connecting", call, outcome: "", message: "", muted: false, speaker: false, connectedAt: null } as never} /></MemoryRouter>);
    expect(screen.getByText("Lab Operator · XRF")).toBeTruthy();
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
