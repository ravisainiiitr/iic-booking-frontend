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

describe("IstemRegistrationDialog, direct sign-up", () => {
  it("creates the account after the OTP and signs the user in", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const body = url.endsWith("/lookup/")
        ? { token: "t1", email_masked: "a***@lab.example.com", expires_in: 600, message: "sent" }
        : url.endsWith("/verify/")
          ? { profile: { email: "asha@lab.example.com" }, link_token: "signed", message: "ok" }
          : { token: "auth-token", user: { id: 7, email: "asha@lab.example.com" }, onboarding: { required: true, steps: ["programme", "password"] } };
      return new Response(JSON.stringify(body), { status: url.endsWith("/complete/") ? 201 : 200 });
    }) as unknown as typeof fetch;
    const onSignedIn = vi.fn();
    const onVerified = vi.fn();
    render(<IstemRegistrationDialog open onOpenChange={() => undefined} onVerified={onVerified} userType="external" onSignedIn={onSignedIn} />);
    expect(screen.getByText(/create your account from it: no form to fill/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yes, use my I-STEM account" }));
    fireEvent.change(screen.getByLabelText("Email or mobile number registered on I-STEM"), { target: { value: "asha@lab.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Find my account" }));
    await screen.findByText(/Enter the 6-digit OTP/);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and create my account" }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith("auth-token", { id: 7, email: "asha@lab.example.com" }));
    expect(calls[2]).toEqual({ url: "/api/istem/register/complete/", body: { link_token: "signed", user_type: "external" } });
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("says so when an account already exists", async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/complete/")) {
        return new Response(JSON.stringify({ error: "An account with this email already exists. Sign in instead.", code: "exists" }), { status: 409 });
      }
      const body = url.endsWith("/lookup/")
        ? { token: "t1", email_masked: "a***@lab.example.com", expires_in: 600, message: "sent" }
        : { profile: { email: "asha@lab.example.com" }, link_token: "signed", message: "ok" };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const onSignedIn = vi.fn();
    render(<IstemRegistrationDialog open onOpenChange={() => undefined} onVerified={vi.fn()} userType="external" onSignedIn={onSignedIn} />);
    fireEvent.click(screen.getByRole("button", { name: "Yes, use my I-STEM account" }));
    fireEvent.change(screen.getByLabelText("Email or mobile number registered on I-STEM"), { target: { value: "asha@lab.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Find my account" }));
    await screen.findByText(/Enter the 6-digit OTP/);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and create my account" }));
    expect(await screen.findByText("An account with this email already exists. Sign in instead.")).toBeTruthy();
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
