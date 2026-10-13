// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Unsubscribe from "./Unsubscribe";

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const api = vi.hoisted(() => ({ notificationUnsubscribe: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

const INFO = { category: "reminders", label: "Reminders", description: "Slot and sample reminders.", email_enabled: true };

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Unsubscribe />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  api.notificationUnsubscribe.mockReset();
});

describe("Unsubscribe page", () => {
  it("asks first, then switches the emails off", async () => {
    api.notificationUnsubscribe.mockImplementation(async (_t: string, confirm: boolean) => ({
      data: { ...INFO, email_enabled: !confirm },
    }));
    renderAt("/unsubscribe?t=abc");

    fireEvent.click(await screen.findByRole("button", { name: "Unsubscribe" }));
    expect(await screen.findByText("You are unsubscribed")).toBeTruthy();
    expect(api.notificationUnsubscribe).toHaveBeenLastCalledWith("abc", true);
  });

  it("reports a rejected link even though the client returns the error body as data", async () => {
    const message = "This unsubscribe link is not valid. Manage your emails from Notification settings.";
    api.notificationUnsubscribe.mockResolvedValue({ error: message, status: 400, data: { error: message } });
    renderAt("/unsubscribe?t=forged");

    expect(await screen.findByText("Link not valid")).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByText("You are unsubscribed")).toBeNull();
  });
});
