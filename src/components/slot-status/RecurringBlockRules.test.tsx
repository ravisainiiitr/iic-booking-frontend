// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { slotBlockRulesApi, type RulePlanSummary, type SlotBlockRule } from "@/lib/slotBlockRulesApi";

import RecurringBlockRules from "./RecurringBlockRules";

const summary: RulePlanSummary = {
  matched_count: 6,
  to_block_count: 5,
  skipped_booked_count: 1,
  skipped_booked: [
    {
      slot_id: 9,
      date: "2026-10-08",
      weekday: "Thu",
      start_time: "10:00",
      end_time: "11:00",
      booking_id: 4,
      booking_reference: "IICXRD0042",
      booking_status: "BOOKED",
      user_name: "Asha Rao",
    },
  ],
  skipped_other_count: 0,
  skipped_other: [],
  already_blocked_by_rule_count: 0,
  future_slots_count: 12,
  slots_exist_until: "2026-10-16",
  list_limit: 500,
};

const rule: SlotBlockRule = {
  id: 7,
  equipment_id: 12,
  weekdays: [0, 3],
  weekday_labels: ["Mon", "Thu"],
  slot_times: ["10:00"],
  start_date: "2026-10-05",
  end_date: "2026-10-31",
  label: "Calibration",
  is_active: true,
  created_at: "2026-10-05T07:00:00Z",
  created_by_name: "OIC One",
  removed_at: null,
  removed_by_name: "",
  summary: { ...summary, blocked_count: 5 },
  removal_preview: { will_unblock_count: 5, kept_by_other_rule_count: 0, unchanged_count: 0 },
  removal_summary: {},
  blocked_now_count: 5,
  generated_count: 0,
};

const slotTimes = [
  { time: "10:00", end_time: "11:00", name: "Slot 1" },
  { time: "14:00", end_time: "15:00", name: "Slot 2" },
];

describe("RecurringBlockRules", () => {
  beforeEach(() => {
    vi.spyOn(slotBlockRulesApi, "list").mockResolvedValue({
      equipment: { id: 12, code: "XRD", name: "XRD" },
      slot_times: slotTimes,
      rules: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("previews, then confirms and refreshes the calendar", async () => {
    const preview = vi.spyOn(slotBlockRulesApi, "preview").mockResolvedValue({ preview: summary });
    const create = vi
      .spyOn(slotBlockRulesApi, "create")
      .mockResolvedValue({ rule, result: { ...summary, blocked_count: 5 } });
    const onChanged = vi.fn();
    render(<RecurringBlockRules equipmentId={12} onChanged={onChanged} />);

    await screen.findByText("No repeat blocks on this equipment.");
    fireEvent.click(screen.getByRole("button", { name: "Repeat block…" }));
    const previewButton = screen.getByRole("button", { name: "Preview" });
    expect(previewButton).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "Mon" }));
    fireEvent.click(screen.getByRole("button", { name: "Thu" }));
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.change(screen.getByLabelText("Other Reasons label (optional)"), { target: { value: " Calibration " } });
    expect(previewButton).toHaveProperty("disabled", false);
    fireEvent.click(previewButton);

    await screen.findByText(/will be blocked now/);
    expect(preview.mock.calls[0][1]).toMatchObject({ weekdays: [0, 3], slot_times: ["10:00", "14:00"], label: "Calibration" });
    expect(screen.getByText("IICXRD0042")).toBeTruthy();
    expect(screen.getByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText(/12 future slots/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirm and block" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Repeat block saved")).toBeTruthy();
  });

  it("asks before removing and shows how many future slots open up", async () => {
    vi.spyOn(slotBlockRulesApi, "list").mockResolvedValue({
      equipment: { id: 12, code: "XRD", name: "XRD" },
      slot_times: slotTimes,
      rules: [rule],
    });
    vi.spyOn(slotBlockRulesApi, "get").mockResolvedValue({
      rule: { ...rule, removal_preview: { will_unblock_count: 4, kept_by_other_rule_count: 1, unchanged_count: 0 } },
    });
    const remove = vi.spyOn(slotBlockRulesApi, "remove").mockResolvedValue({
      rule: { ...rule, is_active: false },
      result: { unblocked_count: 4, kept_by_other_rule_count: 1, unchanged_count: 0, restored_status: "AVAILABLE" },
    });
    const onChanged = vi.fn();
    render(<RecurringBlockRules equipmentId={12} onChanged={onChanged} />);

    fireEvent.click(await screen.findByRole("button", { name: /Remove repeat block: Every Mon & Thu/ }));
    expect(await screen.findByText("Remove this repeat block?")).toBeTruthy();
    await screen.findByText("4 future slots");
    expect(screen.getByText(/stay blocked because another repeat block/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove repeat block" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(12, 7));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });
});
