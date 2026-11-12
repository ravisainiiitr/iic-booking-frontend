// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ portalActionEquipment: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

import { ASSISTANT_CARD_TYPES, AssistantCard } from "./AssistantCards";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const card = { type: "ba_equipment_picker", action: "slot_exchange", title: "Search for the instrument", placeholder: "Name, code or model" };

describe("IITR Equipment Booking Assistant equipment picker", () => {
  it("searches the instruments allowed for the action and picks one", async () => {
    api.portalActionEquipment.mockResolvedValue({ data: { equipment: [{ id: 7, name: "Powder X-Ray Diffractometer", code: "XRD-1", on: false }] } });
    const onAction = vi.fn();
    expect(ASSISTANT_CARD_TYPES.has("ba_equipment_picker")).toBe(true);
    render(<AssistantCard card={card} onAction={onAction} onNavigate={vi.fn()} onHandoff={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Search for the instrument"), { target: { value: "xrd" } });
    const option = await screen.findByRole("listitem");
    expect(option.textContent).toContain("Powder X-Ray Diffractometer");
    expect(option.textContent).toContain("Off");
    expect(api.portalActionEquipment).toHaveBeenCalledWith("slot_exchange", "xrd", expect.anything());
    fireEvent.click(option);
    expect(onAction).toHaveBeenCalledWith("Powder X-Ray Diffractometer", "ba_portal", { action: "slot_exchange", equipment_id: 7 });
  });

  it("says when nothing matches and waits for two characters", async () => {
    api.portalActionEquipment.mockResolvedValue({ data: { equipment: [] } });
    render(<AssistantCard card={card} onAction={vi.fn()} onNavigate={vi.fn()} onHandoff={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Search for the instrument"), { target: { value: "x" } });
    await new Promise((r) => setTimeout(r, 300));
    expect(api.portalActionEquipment).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Search for the instrument"), { target: { value: "zzz" } });
    await waitFor(() => expect(screen.getByText(/No instrument you can choose matches/)).toBeTruthy());
  });
});
