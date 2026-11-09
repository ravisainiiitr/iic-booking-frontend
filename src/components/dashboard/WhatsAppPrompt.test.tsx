// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getWhatsAppOptIn: vi.fn(), setWhatsAppOptIn: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiClient: api }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: 5 } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import WhatsAppPrompt from "./WhatsAppPrompt";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

const status = (ask: boolean) => ({ data: { available: true, ask, opted_in: false, phone: "+919876543210", opted_in_at: null } });

describe("WhatsApp one-tap prompt", () => {
  it("asks with the masked number and opts in on Yes, as a prompt answer", async () => {
    api.getWhatsAppOptIn.mockResolvedValue(status(true));
    api.setWhatsAppOptIn.mockResolvedValue({ data: { ...status(false).data, opted_in: true } });
    render(<WhatsAppPrompt />);
    expect(await screen.findByText(/\+91 ••••••3210/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yes, send me updates" }));
    await waitFor(() => expect(api.setWhatsAppOptIn).toHaveBeenCalledWith({ opted_in: true, source: "prompt" }));
    await waitFor(() => expect(screen.queryByTestId("whatsapp-prompt")).toBeNull());
  });

  it("stays hidden when the server does not ask, and after Not now", async () => {
    api.getWhatsAppOptIn.mockResolvedValue(status(false));
    const { unmount } = render(<WhatsAppPrompt />);
    await waitFor(() => expect(api.getWhatsAppOptIn).toHaveBeenCalled());
    expect(screen.queryByTestId("whatsapp-prompt")).toBeNull();
    unmount();
    api.getWhatsAppOptIn.mockResolvedValue(status(true));
    render(<WhatsAppPrompt />);
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByTestId("whatsapp-prompt")).toBeNull();
    expect(api.setWhatsAppOptIn).not.toHaveBeenCalled();
    cleanup();
    render(<WhatsAppPrompt />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("whatsapp-prompt")).toBeNull();
  });
});
