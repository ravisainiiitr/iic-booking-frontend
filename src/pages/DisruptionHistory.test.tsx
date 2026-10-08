// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  api: {
    getDisruptions: vi.fn(),
    getDisruption: vi.fn(),
    updateDisruption: vi.fn(),
    uploadDisruptionServiceReport: vi.fn(),
    downloadDisruptionServiceReport: vi.fn(),
    deleteDisruption: vi.fn(),
    restoreDisruption: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: state.api }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/ExportMenu", () => ({ ExportMenu: () => <button type="button">Export</button> }));

import DisruptionHistory from "./DisruptionHistory";
import { DisruptionAttentionBanner } from "@/components/disruptions/DisruptionAttentionBanner";
import { disruptionFilterParams, EMPTY_DISRUPTION_FILTERS, filtersFromSearchParams } from "@/lib/disruptions";

const record = {
  id: 7,
  s_no: 1,
  equipment_id: 3,
  equipment_name: "FE-SEM",
  equipment_code: "SEM1",
  department_id: 2,
  department_name: "Physics",
  disruption_type: "UNDER_MAINTENANCE",
  disruption_type_display: "Under Maintenance",
  scope: "EQUIPMENT",
  scope_display: "Whole equipment",
  source: "EQUIPMENT_STATUS",
  source_display: "Equipment status",
  start_at: "2026-10-01T09:00:00+05:30",
  end_at: null,
  duration_hours: 30.5,
  slots_affected: null,
  bookings_affected: 2,
  reason: "",
  reason_category: "",
  reason_category_display: "",
  reason_missing: true,
  action_taken: "",
  action_missing: true,
  started_at: "2026-10-01T09:00:00+05:30",
  started_by_name: "OIC One",
  ended_at: null,
  ended_by_name: "",
  status: "OPEN",
  backfilled: false,
  service_reports: [],
};

const listResponse = {
  count: 1,
  page: 1,
  page_size: 25,
  results: [record],
  types: [{ value: "UNDER_MAINTENANCE", label: "Under Maintenance" }],
  sources: [{ value: "EQUIPMENT_STATUS", label: "Equipment status" }],
  reason_categories: {},
  can_filter_department: false,
  summary: {
    total: 1,
    total_hours: 30.5,
    open_now: 1,
    reason_missing: 1,
    by_type: [{ type: "UNDER_MAINTENANCE", label: "Under Maintenance", count: 1, hours: 30.5 }],
  },
  equipment_options: [{ id: 3, name: "FE-SEM", code: "SEM1", department_id: 2 }],
};

beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});

beforeEach(() => {
  state.api.getDisruptions.mockResolvedValue({ data: listResponse });
  state.api.getDisruption.mockResolvedValue({
    data: {
      ...record,
      slots: [],
      timeline: [{ kind: "created", field: "", old_value: "", new_value: "", note: "", by: "OIC One", at: record.start_at }],
      reason_categories: [{ value: "EQUIPMENT_FAULT", label: "Equipment fault" }],
    },
  });
  state.api.updateDisruption.mockImplementation(async (_id: number, body: Record<string, string>) => ({
    data: { ...record, ...body, reason_missing: false, slots: [], timeline: [], reason_categories: [] },
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage(url = "/disruptions") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <DisruptionHistory />
    </MemoryRouter>
  );
}

describe("DisruptionHistory", () => {
  it("loads with filters from the URL and shows the row and summary", async () => {
    renderPage("/disruptions?reason_missing=1");
    expect(await screen.findByText("FE-SEM")).toBeTruthy();
    const params = state.api.getDisruptions.mock.calls[0][0];
    expect(params).toMatchObject({ reason_missing: "1", with_options: true, page: 1, page_size: 25, ordering: "-start_at" });
    expect(screen.getAllByText("Not recorded")).toHaveLength(2);
    expect(screen.getByText("Ongoing")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Under Maintenance: 1/ })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Reason not recorded" }).getAttribute("aria-checked")).toBe("true");
  });

  it("sorts by a column and requests options only once", async () => {
    renderPage();
    await screen.findByText("FE-SEM");
    fireEvent.click(screen.getByRole("button", { name: /Bookings/ }));
    await waitFor(() => expect(state.api.getDisruptions).toHaveBeenCalledTimes(2));
    const second = state.api.getDisruptions.mock.calls[1][0];
    expect(second.ordering).toBe("-bookings_affected");
    expect(second.with_options).toBeUndefined();
  });

  it("opens the detail drawer and saves a reason", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("row", { name: /Open Under Maintenance on FE-SEM/ }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Recorded")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Details"), { target: { value: "Vacuum pump failed" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save reason" }));
    await waitFor(() => expect(state.api.updateDisruption).toHaveBeenCalledWith(7, { reason: "Vacuum pump failed", reason_category: "" }));
  });

  it("hides the delete action when the user cannot delete", async () => {
    renderPage();
    await screen.findByText("FE-SEM");
    expect(screen.queryByRole("button", { name: /Delete Under Maintenance/ })).toBeNull();
    expect(screen.queryByText("Show deleted entries")).toBeNull();
  });

  it("deletes a row after confirming with a reason, warns when ongoing, and refreshes the list", async () => {
    state.api.getDisruptions.mockResolvedValue({ data: { ...listResponse, can_delete: true } });
    state.api.deleteDisruption.mockResolvedValue({ data: { id: 7, deleted: true, was_open: true } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete Under Maintenance on FE-SEM" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(state.api.getDisruption).not.toHaveBeenCalled();
    expect(dialog.textContent).toContain(
      "Delete this disruption entry? It will be removed from disruption history and reports. Slot statuses and bookings are not changed."
    );
    expect(within(dialog).getByRole("note").textContent).toContain("still ongoing");
    fireEvent.change(within(dialog).getByLabelText("Reason (optional)"), { target: { value: " Duplicate " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete entry" }));
    await waitFor(() => expect(state.api.deleteDisruption).toHaveBeenCalledWith(7, "Duplicate"));
    await waitFor(() => expect(state.api.getDisruptions).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("deletes from the detail drawer and closes it", async () => {
    state.api.getDisruptions.mockResolvedValue({ data: { ...listResponse, can_delete: true } });
    state.api.deleteDisruption.mockResolvedValue({ data: { id: 7, deleted: true, was_open: false } });
    renderPage();
    fireEvent.click(await screen.findByRole("row", { name: /Open Under Maintenance on FE-SEM/ }));
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(await within(drawer).findByRole("button", { name: "Delete entry" }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete entry" }));
    await waitFor(() => expect(state.api.deleteDisruption).toHaveBeenCalledWith(7, ""));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("lets the Main Administrator show deleted entries and restore one", async () => {
    state.api.getDisruptions.mockResolvedValue({
      data: { ...listResponse, can_delete: true, can_view_deleted: true },
    });
    state.api.restoreDisruption.mockResolvedValue({ data: { id: 7, deleted: false } });
    renderPage();
    await screen.findByText("FE-SEM");
    state.api.getDisruptions.mockResolvedValue({
      data: {
        ...listResponse,
        can_delete: true,
        can_view_deleted: true,
        show_deleted: true,
        results: [{ ...record, is_deleted: true, deleted_at: record.start_at, deleted_by_name: "Admin", delete_reason: "Oops" }],
      },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Show deleted entries" }));
    await waitFor(() => expect(state.api.getDisruptions.mock.calls.at(-1)?.[0]).toMatchObject({ show_deleted: true }));
    expect(await screen.findByText("Oops")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Delete Under Maintenance/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restore Under Maintenance on FE-SEM" }));
    await waitFor(() => expect(state.api.restoreDisruption).toHaveBeenCalledWith(7));
  });

  it("shows an error with a retry", async () => {
    state.api.getDisruptions.mockResolvedValueOnce({ error: "Forbidden" });
    renderPage();
    expect(await screen.findByText("Forbidden")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("FE-SEM")).toBeTruthy();
  });
});

describe("DisruptionAttentionBanner", () => {
  it("shows the count and wires review and dismiss", () => {
    const onOpen = vi.fn();
    const onDismiss = vi.fn();
    render(<DisruptionAttentionBanner count={3} onOpen={onOpen} onDismiss={onDismiss} />);
    expect(screen.getByRole("status").textContent).toContain("3 disruptions need a reason");
    fireEvent.click(screen.getByRole("button", { name: /Review/ }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss for this session" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("disruption filter helpers", () => {
  it("drops empty values and encodes flags", () => {
    expect(
      disruptionFilterParams({ ...EMPTY_DISRUPTION_FILTERS, type: "OTHER", action_missing: true, search: " pump " }, "-end_at")
    ).toEqual({ type: "OTHER", action_missing: "1", search: "pump", ordering: "-end_at" });
    expect(filtersFromSearchParams(new URLSearchParams("status=open&reason_missing=true"))).toMatchObject({
      status: "open",
      reason_missing: true,
      action_missing: false,
    });
  });
});
