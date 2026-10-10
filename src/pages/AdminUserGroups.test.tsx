// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const auth = vi.hoisted(() => ({ user: { id: 1, user_type: "admin", email: "admin@iitr.ac.in" } as Record<string, unknown> }));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: auth.user, loading: false, isAuthenticated: true }) }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/components/RichTextEditor", () => ({
  RichTextEditor: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import AdminUserGroups from "./AdminUserGroups";

const group = (id: number, name: string, kind: string, kind_label: string, member_count: number) => ({
  id,
  name,
  kind,
  kind_label,
  description: "",
  is_automatic: kind !== "custom",
  is_archived: false,
  scope: { type: kind },
  member_count,
  supervisor_count: 0,
  last_booked_at: "2026-10-01T05:00:00Z",
  created_by: null,
  created_at: null,
  updated_at: null,
});

const groups = [group(1, "All booking users", "all", "All booking users", 40), group(2, "FESEM", "equipment", "Equipment", 12)];

const options = {
  departments: [{ id: 33, name: "Physics", code: "PH", department_type: "internal" }],
  user_types: [{ value: "student", label: "Student" }],
  all_user_types: [{ value: "student", label: "Student" }],
  kinds: [],
  cc_modes: [],
  limits: {
    max_recipients: 5000,
    each_mode_max_recipients: 200,
    max_cc: 20,
    max_attachments: 5,
    max_attachment_mb: 5,
    max_total_attachment_mb: 10,
  },
};

const preview = {
  total: 12,
  without_email: 0,
  internal: 10,
  external: 2,
  departments: [{ department_id: 33, department_name: "Physics", total: 10, internal: 10, external: 0 }],
  recipients: [],
  groups: [{ id: 2, name: "FESEM", kind: "equipment" }],
  max_recipients: 5000,
};

let fetchMock: ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  auth.user = { id: 1, user_type: "admin", email: "admin@iitr.ac.in" };
  fetchMock = vi.fn(async (url: string) => {
    if (url.includes("/options/")) return json(options);
    if (url.includes("/email/preview/")) return json(preview);
    if (url.includes("/email/campaigns/")) return json({ count: 0, page: 1, page_size: 25, results: [] });
    if (/\/facility-groups\/(\?.*)?$/.test(url)) return json({ results: groups, kinds: [] });
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage(path = "/admin-settings/user-groups") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminUserGroups />
    </MemoryRouter>,
  );
}

describe("AdminUserGroups", () => {
  it("is only for the Main Administrator", () => {
    auth.user = { id: 2, user_type: "staff" };
    renderPage();
    expect(screen.getByText("Only the Main Administrator can manage user groups.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists groups with member counts", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "FESEM" })).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("opens compose with the group chosen and shows the recipient count", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Email FESEM" }));
    await waitFor(() => expect(screen.getByTestId("fg-recipient-count").textContent).toBe("12"));
    expect(screen.getByText(/10 internal · 2 external/)).toBeTruthy();
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes("/email/preview/"));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ group_ids: [2], filters: {} });
  });
});
