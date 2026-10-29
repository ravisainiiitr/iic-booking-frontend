// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import IstemLinkCard from "./IstemLinkCard";

// input-otp measures itself; jsdom has neither ResizeObserver nor elementFromPoint.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
document.elementFromPoint ??= () => null;

type Reply = { status?: number; body: Record<string, unknown> };

function mockFetch(routes: Record<string, Reply | Reply[]>) {
  const calls: { url: string; body?: unknown }[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const key = Object.keys(routes).find((k) => url.endsWith(k)) ?? "";
    const entry = routes[key];
    const reply = Array.isArray(entry) ? (entry.length > 1 ? entry.shift()! : entry[0]) : entry;
    return new Response(JSON.stringify(reply?.body ?? {}), { status: reply?.status ?? 200 });
  }) as unknown as typeof fetch;
  return calls;
}

afterEach(() => cleanup());

describe("IstemLinkCard", () => {
  it("is hidden when linking is not available to the user", async () => {
    mockFetch({ "/istem/link/": { body: { state: null, otp_required: false, linking_available: false } } });
    const { container } = render(<IstemLinkCard />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("finds the account by mobile number and sends the OTP to the I-STEM email", async () => {
    const calls = mockFetch({
      "/istem/link/": [
        { body: { state: null, otp_required: false, linking_available: true } },
        { body: { state: "AWAITING_OTP", otp_required: true, linking_available: true, email_masked: "p***@ic.iitr.ac.in" } },
      ],
      "/find-account/": { body: { message: "found", email_masked: "p***@ic.iitr.ac.in" } },
      "/send-otp/": { body: { message: "sent", email_masked: "p***@ic.iitr.ac.in", expires_at: "2026-10-30T10:00:00+05:30", attempts_left: 5 } },
    });
    render(<IstemLinkCard />);
    fireEvent.click(await screen.findByRole("radio", { name: "Mobile number" }));
    fireEvent.change(screen.getByLabelText("Mobile number registered on I-STEM"), { target: { value: "98765 43210" } });
    fireEvent.click(screen.getByRole("button", { name: "Find my I-STEM account" }));
    expect(await screen.findByText(/Enter the 6-digit OTP sent to/)).toBeTruthy();
    expect(calls.find((c) => c.url.endsWith("/find-account/"))?.body).toEqual({ mobile: "9876543210" });
    expect(calls.some((c) => c.url.endsWith("/send-otp/"))).toBe(true);
  });

  it("shows the linked I-STEM account", async () => {
    mockFetch({
      "/istem/link/": {
        body: {
          state: "LINKED", otp_required: false, linking_available: false, public_user_id: "22001",
          istem_profile: { first_name: "Asha", last_name: "Verma", email: "asha@example.com", organisation: "Asha Labs" },
        },
      },
    });
    render(<IstemLinkCard />);
    expect(await screen.findByText("Linked to I-STEM")).toBeTruthy();
    expect(screen.getByText("Asha Verma · asha@example.com")).toBeTruthy();
  });
});
