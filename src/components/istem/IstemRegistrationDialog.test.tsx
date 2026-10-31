// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => null } }));

import IstemRegistrationDialog from "./IstemRegistrationDialog";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
document.elementFromPoint ??= () => null;

afterEach(() => cleanup());

describe("IstemRegistrationDialog", () => {
  it("looks the account up by the mobile number alone, then verifies the OTP and fills from the I-STEM profile", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const body = url.endsWith("/lookup/")
        ? { token: "t1", email_masked: "a***@lab.example.com", expires_in: 600, message: "sent" }
        : { profile: { first_name: "Asha", last_name: "Verma", state: "Uttarakhand", email: "asha@lab.example.com", mobile: "9876543210" }, link_token: "signed", message: "ok" };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const onVerified = vi.fn();
    render(<IstemRegistrationDialog open onOpenChange={() => undefined} onVerified={onVerified} />);

    fireEvent.click(screen.getByRole("button", { name: "Yes, use my I-STEM account" }));
    fireEvent.change(screen.getByLabelText("Email or mobile number registered on I-STEM"), { target: { value: "98765 43210" } });
    fireEvent.click(screen.getByRole("button", { name: "Find my account" }));
    expect(await screen.findByText(/Enter the 6-digit OTP sent to a\*\*\*@lab\.example\.com/)).toBeTruthy();
    expect(calls[0].body).toEqual({ email: "", mobile: "9876543210" });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and fill the form" }));
    await waitFor(() => expect(onVerified).toHaveBeenCalled());
    expect(onVerified.mock.calls[0][0]).toMatchObject({ linkToken: "signed", email: "asha@lab.example.com", mobile: "9876543210" });
    expect(calls[1].body).toEqual({ token: "t1", otp: "123456" });
  });

  it("lets the user register without I-STEM", () => {
    const onOpenChange = vi.fn();
    render(<IstemRegistrationDialog open onOpenChange={onOpenChange} onVerified={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "No, register normally" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("an email alone is enough", async () => {
    const calls: Array<{ body: unknown }> = [];
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      calls.push({ body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify({ token: "t2", email_masked: "a***@lab.example.com", expires_in: 600, message: "sent" }), { status: 200 });
    }) as unknown as typeof fetch;
    render(<IstemRegistrationDialog open onOpenChange={() => undefined} onVerified={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Yes, use my I-STEM account" }));
    fireEvent.change(screen.getByLabelText("Email or mobile number registered on I-STEM"), { target: { value: "Asha@Lab.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Find my account" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({ email: "asha@lab.example.com", mobile: "" });
  });
});
