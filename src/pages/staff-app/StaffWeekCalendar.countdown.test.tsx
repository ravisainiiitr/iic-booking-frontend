// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getSlotWindowOpening = vi.fn();
vi.mock("@/lib/api", () => ({
  apiClient: {
    getEquipmentSlots: async () => ({
      data: { slots: [], slot_master_times: ["09:00:00"], slot_duration_minutes: 60, holidays: {} },
    }),
    getLabDashboardCalendarColors: async () => ({ data: { defaults: {}, by_equipment: {} } }),
    getSlotWindowOpening: (...args: unknown[]) => getSlotWindowOpening(...args),
    getServerTime: async () => ({
      data: { server_time: "", epoch_ms: Date.now(), timezone: "Asia/Kolkata", utc_offset_minutes: 330 },
    }),
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { user_type: "operator" } }) }));

import StaffWeekCalendar from "./StaffWeekCalendar";
import { __resetSlotWindowScheduleCache } from "@/lib/slotWindowSchedule";

afterEach(() => {
  cleanup();
  getSlotWindowOpening.mockReset();
  __resetSlotWindowScheduleCache();
});

describe("Lab Operator week calendar next-week countdown", () => {
  it("shows staff when next week's slots open for users", async () => {
    getSlotWindowOpening.mockResolvedValue({
      data: {
        equipment_id: 11,
        applies: true,
        weekday: 2,
        time: "21:00",
        source: "equipment",
        next_opens_at: null,
        server_time: "",
        utc_offset_minutes: 330,
      },
    });

    render(
      <MemoryRouter>
        <StaffWeekCalendar equipment={[{ equipment_id: 11, name: "FE-SEM", code: "FESEM" }] as never} />
      </MemoryRouter>,
    );

    const el = await screen.findByTestId("slot-opening-countdown");
    expect(el.textContent).toMatch(/Next week's slots open for users Wed 9:00 pm/);
    expect(el.textContent).toMatch(/in \d/);
    expect(getSlotWindowOpening).toHaveBeenCalledWith("11");
  });
});
