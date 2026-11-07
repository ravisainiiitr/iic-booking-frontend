// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({
  getWhatsAppOptIn: vi.fn(),
  setWhatsAppOptIn: vi.fn(),
  sendWhatsAppVerifyCode: vi.fn(),
  confirmWhatsAppVerifyCode: vi.fn(),
}));
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

  const optedIn = { available: true, opted_in: true, phone: "+919876543210", opted_in_at: null };

  it("offers no code until WhatsApp codes are available", async () => {
    api.getWhatsAppOptIn.mockResolvedValue({ data: { ...optedIn, codes_available: false, phone_verified: false } });
    render(<WhatsAppCard />);
    await screen.findByText("WhatsApp notifications are on");
    expect(screen.queryByRole("button", { name: "Send a code on WhatsApp" })).toBeNull();
  });

  it("proves the number with a code", async () => {
    api.getWhatsAppOptIn.mockResolvedValue({ data: { ...optedIn, codes_available: true, phone_verified: false } });
    api.sendWhatsAppVerifyCode.mockResolvedValue({ data: { sent_to: "number ending 10", expires_in: 600 } });
    api.confirmWhatsAppVerifyCode.mockResolvedValue({ data: { ...optedIn, codes_available: true, phone_verified: true } });
    render(<WhatsAppCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Send a code on WhatsApp" }));
    const code = await screen.findByLabelText("Code from WhatsApp");
    fireEvent.change(code, { target: { value: "482913" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm number" }));
    await waitFor(() => expect(api.confirmWhatsAppVerifyCode).toHaveBeenCalledWith("482913"));
    expect(await screen.findByText(/This number is confirmed/)).toBeTruthy();
  });

  it("shows a refused code and keeps the number unconfirmed", async () => {
    api.getWhatsAppOptIn.mockResolvedValue({ data: { ...optedIn, codes_available: true, phone_verified: false } });
    api.sendWhatsAppVerifyCode.mockResolvedValue({ data: { sent_to: "number ending 10", expires_in: 600 } });
    api.confirmWhatsAppVerifyCode.mockResolvedValue({ error: "Incorrect code. 4 attempt(s) left." });
    const { toast } = await import("sonner");
    render(<WhatsAppCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Send a code on WhatsApp" }));
    fireEvent.change(await screen.findByLabelText("Code from WhatsApp"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm number" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Incorrect code. 4 attempt(s) left."));
    expect(screen.queryByText(/This number is confirmed/)).toBeNull();
  });
});
