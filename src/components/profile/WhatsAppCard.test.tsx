// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ getWhatsAppOptIn: vi.fn(), setWhatsAppOptIn: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import WhatsAppCard from "./WhatsAppCard";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WhatsApp notifications card", () => {
  it("is hidden while the portal's WhatsApp is off", async () => {
    api.getWhatsAppOptIn.mockResolvedValue({ data: { available: false, opted_in: false, phone: "", opted_in_at: null } });
    const { container } = render(<WhatsAppCard />);
    await waitFor(() => expect(api.getWhatsAppOptIn).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });

  it("opts in with the number shown", async () => {
    api.getWhatsAppOptIn.mockResolvedValue({ data: { available: true, opted_in: false, phone: "+919876543210", opted_in_at: null } });
    api.setWhatsAppOptIn.mockResolvedValue({ data: { available: true, opted_in: true, phone: "+919876543210", opted_in_at: "2026-11-03" } });
    render(<WhatsAppCard />);
    expect((await screen.findByLabelText("WhatsApp number") as HTMLInputElement).value).toBe("+919876543210");
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(api.setWhatsAppOptIn).toHaveBeenCalledWith({ opted_in: true, phone: "+919876543210" }));
    expect(await screen.findByText("WhatsApp notifications are on")).toBeTruthy();
  });
});
