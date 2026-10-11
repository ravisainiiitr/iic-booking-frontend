// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { UserCard } from "@/lib/adminInsights";

const state = vi.hoisted(() => ({ api: { getUserCard: vi.fn(), getAdminUserCard: vi.fn() } }));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: state.api }));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { UserIdCardLink } from "./UserIdCardLink";

const card: UserCard = {
  profile: {
    id: 5,
    name: "Asha Rao",
    email: "a@x",
    phone: "",
    profile_picture_url: null,
    user_type_display: "IITR Student",
    category: "iitr_student",
    category_display: "IITR Students",
    programme_display: "",
    employee_id: "",
    designation: "",
    degree_name: "",
    department: null,
    supervisor: null,
    is_active: true,
    is_test_account: false,
    date_joined: null,
    last_login: null,
  },
  wallet: null,
  linked_wallet: null,
  certifications: [],
  bookings: { total: 0, charged: 0, cancelled: 0, recent: [] },
  access: "scoped",
} as UserCard;

beforeAll(async () => {
  await import("@/components/admin-insights/UserCardDrawer");
}, 30_000);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UserIdCardLink", { timeout: 20_000 }, () => {
  it("opens the user's ID card from the name", async () => {
    state.api.getUserCard.mockResolvedValue({ data: card });
    render(
      <MemoryRouter>
        <UserIdCardLink userId={5} name="Asha Rao" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Asha Rao" }));
    await waitFor(() => expect(state.api.getUserCard).toHaveBeenCalledWith(5));
    const drawer = await screen.findByRole("dialog");
    expect((await within(drawer).findAllByText("Asha Rao")).length).toBeGreaterThan(0);
    expect(state.api.getAdminUserCard).not.toHaveBeenCalled();
  });

  it("renders plain text without a user id", () => {
    render(
      <MemoryRouter>
        <UserIdCardLink userId={null} name="Asha Rao" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Asha Rao")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
