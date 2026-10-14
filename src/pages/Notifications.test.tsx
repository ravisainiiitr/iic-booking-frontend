// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Notifications from "./Notifications";

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StandaloneOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PageHero: ({ title }: { title: string }) => <h1>{title}</h1>,
  heroButtonClass: { secondary: "" },
}));
vi.mock("@/contexts/NotificationContext", () => ({ useNotifications: () => ({ refreshNotifications: async () => {} }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const api = vi.hoisted(() => ({
  getNotificationInbox: vi.fn(),
  getNotificationPreferences: vi.fn(),
  saveNotificationPreferences: vi.fn(),
  markNotificationAsRead: vi.fn(async () => ({ data: {} })),
  markAllNotificationsAsRead: vi.fn(async () => ({ data: {} })),
  deleteNotification: vi.fn(async () => ({ data: {} })),
}));
vi.mock("@/lib/api", () => ({ apiClient: api }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const prefs = {
  channels: ["email", "in_app"],
  categories: [
    { key: "bookings", label: "Booking updates", description: "d", locked: true, email: true, in_app: true },
    { key: "reminders", label: "Reminders", description: "d", locked: false, email: true, in_app: true },
  ],
};

beforeEach(() => {
  api.getNotificationInbox.mockResolvedValue({
    data: {
      results: [
        { id: 1, title: "Results ready", message: "Download", type: "info", read: false, created_at: new Date().toISOString(), link: "/my-results", category: "results" },
      ],
      count: 1,
      page: 1,
      page_size: 20,
      unread_count: 1,
      category_counts: { results: 1 },
    },
  });
  api.getNotificationPreferences.mockResolvedValue({ data: prefs });
  api.saveNotificationPreferences.mockImplementation(async (rows: Array<{ key: string; email?: boolean }>) => ({
    data: {
      ...prefs,
      categories: prefs.categories.map((c) => (c.key === rows[0].key ? { ...c, ...rows[0] } : c)),
    },
  }));
});

afterEach(() => cleanup());

describe("Notifications page", () => {
  it("lists notifications grouped by day with category filters", async () => {
    render(
      <MemoryRouter initialEntries={["/notifications"]}>
        <Notifications />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Results ready")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Results (1)", pressed: false }));
    await waitFor(() =>
      expect(api.getNotificationInbox).toHaveBeenLastCalledWith(expect.objectContaining({ category: "results" })),
    );
  });

  it("locks essential categories and saves a switched-off reminder email", async () => {
    render(
      <MemoryRouter initialEntries={["/notifications?tab=settings"]}>
        <Notifications />
      </MemoryRouter>,
    );
    const locked = await screen.findByRole("switch", { name: "Booking updates: email on" });
    expect((locked as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("switch", { name: "Reminders: email on" }));
    await waitFor(() => expect(api.saveNotificationPreferences).toHaveBeenCalledWith([{ key: "reminders", email: false }], undefined));
    expect(await screen.findByRole("switch", { name: "Reminders: email off" })).toBeTruthy();
  });

  it("shows monthly reports as an email-only category that can be switched off", async () => {
    const monthly = {
      key: "monthly_reports", label: "Monthly reports", description: "d", locked: false, email: true, in_app: false,
      digest: false, email_only: true,
    };
    const withMonthly = { ...prefs, categories: [...prefs.categories, monthly] };
    api.getNotificationPreferences.mockResolvedValue({ data: withMonthly });
    api.saveNotificationPreferences.mockResolvedValue({
      data: { ...withMonthly, categories: [...prefs.categories, { ...monthly, email: false }] },
    });
    render(
      <MemoryRouter initialEntries={["/notifications?tab=settings"]}>
        <Notifications />
      </MemoryRouter>,
    );
    const email = await screen.findByRole("switch", { name: "Monthly reports: email on" });
    expect(screen.queryByRole("switch", { name: /Monthly reports: in-app/ })).toBeNull();
    expect(screen.queryByRole("switch", { name: /Monthly reports: daily digest/ })).toBeNull();
    expect(screen.getByText("Monthly")).toBeTruthy();
    fireEvent.click(email);
    await waitFor(() =>
      expect(api.saveNotificationPreferences).toHaveBeenCalledWith([{ key: "monthly_reports", email: false }], undefined),
    );
  });
});
