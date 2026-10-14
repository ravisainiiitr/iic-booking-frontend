// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AccountLifecycleBanner, { AccountLifecycleNotice } from "./AccountLifecycleBanner";
import { SuspendedBookingGate } from "./SuspendedGate";
import type { AccountLifecycleCompact } from "@/lib/accountLifecycle";

const auth = vi.hoisted(() => ({ value: { user: null as unknown, isAuthenticated: true, refreshUser: async () => {} } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));

const status = (over: Partial<AccountLifecycleCompact>): AccountLifecycleCompact => ({
  category: "iitr_student",
  category_label: "IITR Students",
  programme_end_date: "2026-09-30",
  end_date_source: "derived_from_joining",
  state: "active",
  suspended: false,
  enforcement_enabled: true,
  days_left: 100,
  end_date_required: false,
  ...over,
});

const signIn = (lifecycle: AccountLifecycleCompact | null) => {
  auth.value = { user: { id: 1, account_lifecycle: lifecycle }, isAuthenticated: true, refreshUser: async () => {} };
};

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("Account lifecycle banner", () => {
  it("shows a non-dismissible suspension notice with Request extension", () => {
    signIn(status({ suspended: true, state: "suspended", days_left: -3 }));
    render(
      <MemoryRouter>
        <AccountLifecycleBanner />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/Your account is suspended/);
    expect(screen.getByRole("button", { name: "Request extension" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Dismiss notice" })).toBeNull();
  });

  it("asks for a missing end date and can be dismissed", () => {
    signIn(status({ category: "iitr_postdoc", programme_end_date: null, end_date_source: "missing", state: "end_date_missing", end_date_required: true }));
    render(
      <MemoryRouter>
        <AccountLifecycleBanner />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Add end date" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notice" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("leaves the dashboard to show the notice under its search bar", () => {
    signIn(status({ suspended: true, state: "suspended", days_left: -3 }));
    const { container } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AccountLifecycleBanner />
      </MemoryRouter>,
    );
    expect(container.textContent).toBe("");
    cleanup();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AccountLifecycleNotice inline />
      </MemoryRouter>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Your account is suspended/);
    expect(alert.className).not.toMatch(/sticky/);
    expect(alert.className).toMatch(/rounded-xl/);
  });

  it("stays hidden while enforcement is off and the account is in good standing", () => {
    signIn(status({ enforcement_enabled: false, state: "ending_soon", days_left: 5 }));
    const { container } = render(
      <MemoryRouter>
        <AccountLifecycleBanner />
      </MemoryRouter>,
    );
    expect(container.textContent).toBe("");
  });
});

describe("Suspended booking gate", () => {
  const renderGate = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <SuspendedBookingGate>
          <p>Booking form</p>
        </SuspendedBookingGate>
      </MemoryRouter>,
    );

  it("replaces the booking form for a suspended account", () => {
    signIn(status({ suspended: true, state: "suspended" }));
    renderGate("/book/5");
    expect(screen.queryByText("Booking form")).toBeNull();
    expect(screen.getByText("Your account is suspended")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Request extension" }).getAttribute("href")).toBe("/programme-extension");
  });

  it("still allows charge estimates while suspended", () => {
    signIn(status({ suspended: true, state: "suspended" }));
    renderGate("/book/5?mode=calculate");
    expect(screen.getByText("Booking form")).toBeTruthy();
  });

  it("shows the form for accounts that are not suspended", () => {
    signIn(status({}));
    renderGate("/book/5");
    expect(screen.getByText("Booking form")).toBeTruthy();
  });
});
