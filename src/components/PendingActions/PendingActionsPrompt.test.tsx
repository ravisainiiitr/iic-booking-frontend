// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const api = vi.hoisted(() => ({ getPendingActions: vi.fn(), markNotificationAsRead: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 7, user_type: "manager" }, isAuthenticated: true }),
}));
vi.mock("@/components/UserGuide/UserGuideProvider", () => ({ useUserGuide: () => ({ postLoginBusy: false }) }));

import PendingActionsPrompt from "@/components/PendingActions/PendingActionsPrompt";

const urgent = {
  key: "urgent_requests",
  label: "Urgent booking requests",
  count: 3,
  link: "/urgent-requests",
  description: "Waiting for your decision.",
  entries: [
    { label: "#41 — XRD — Student — 2 h ago", link: "/urgent-requests?request=41" },
    { label: "#42 — SEM — Faculty — 1 day ago", link: "/urgent-requests?request=42" },
  ],
};
const messages = {
  key: "lab_messages_from_users",
  label: "Unread messages from users",
  count: 1,
  link: "/booking-management",
  description: "Booking users sent messages.",
  entries: [
    {
      label: "IICXRD12 — XRD: Can I add a sample? — 5 min ago",
      link: "/booking-management?expand=12&section=messages",
      notification_ids: [91, 92],
    },
  ],
};

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
}

function renderPrompt() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <PendingActionsPrompt />
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  api.markNotificationAsRead.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PendingActionsPrompt (sign-in list)", () => {
  it("lists urgent requests and user messages, each opening its own page", async () => {
    api.getPendingActions.mockResolvedValue({ data: { items: [urgent, messages] } });
    renderPrompt();
    fireEvent.click(await screen.findByText(/#41 — XRD/, {}, { timeout: 4000 }));
    expect(screen.getByTestId("where").textContent).toBe("/urgent-requests?request=41");
    expect(screen.queryByText(/#42 — SEM/)).toBeNull();
  });

  it("marks a message's notifications read and opens the booking's messages", async () => {
    api.getPendingActions.mockResolvedValue({ data: { items: [urgent, messages] } });
    renderPrompt();
    expect(await screen.findByText("and 1 more", {}, { timeout: 4000 })).toBeTruthy();
    fireEvent.click(screen.getByText(/Can I add a sample/));
    expect(api.markNotificationAsRead.mock.calls.map((c) => c[0])).toEqual([91, 92]);
    expect(screen.getByTestId("where").textContent).toBe("/booking-management?expand=12&section=messages");
  });

  it("has View all links for each list", async () => {
    api.getPendingActions.mockResolvedValue({ data: { items: [urgent, messages] } });
    renderPrompt();
    const viewAll = await screen.findAllByRole("button", { name: /View all/ }, { timeout: 4000 });
    expect(viewAll).toHaveLength(2);
    fireEvent.click(viewAll[1]);
    expect(screen.getByTestId("where").textContent).toBe("/booking-management");
  });

  it("opens only once per sign-in session", async () => {
    api.getPendingActions.mockResolvedValue({ data: { items: [urgent] } });
    const first = renderPrompt();
    await screen.findByText(/#41 — XRD/, {}, { timeout: 4000 });
    first.unmount();
    renderPrompt();
    await new Promise((r) => setTimeout(r, 1800));
    expect(api.getPendingActions).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/#41 — XRD/)).toBeNull();
  });

  it("shows nothing when there is nothing to act on", async () => {
    api.getPendingActions.mockResolvedValue({ data: { items: [] } });
    renderPrompt();
    await vi.waitFor(() => expect(api.getPendingActions).toHaveBeenCalled(), { timeout: 4000 });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
