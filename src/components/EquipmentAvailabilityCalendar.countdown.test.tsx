// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { addDays, format, startOfWeek } from "date-fns";

const getEquipmentSlots = vi.fn();
const getSlotWindowOpening = vi.fn();
vi.mock("@/lib/api", () => ({
  apiClient: {
    getEquipmentSlots: (...args: unknown[]) => getEquipmentSlots(...args),
    getSlotWindowOpening: (...args: unknown[]) => getSlotWindowOpening(...args),
    getServerTime: async () => ({
      data: { server_time: "", epoch_ms: Date.now(), timezone: "Asia/Kolkata", utc_offset_minutes: 330 },
    }),
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

import EquipmentAvailabilityCalendar from "./EquipmentAvailabilityCalendar";
import { __resetSlotWindowScheduleCache } from "@/lib/slotWindowSchedule";

afterEach(() => {
  cleanup();
  getEquipmentSlots.mockReset();
  getSlotWindowOpening.mockReset();
  __resetSlotWindowScheduleCache();
});

function weekPayload() {
  const sunday = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6);
  const date = format(sunday, "yyyy-MM-dd");
  return {
    data: {
      slots: [
        {
          id: 1,
          date,
          status: "AVAILABLE",
          slot_open_time: "09:00:00",
          start_datetime: "2099-01-01T09:00:00+05:30",
          end_datetime: "2099-01-01T10:00:00+05:30",
        },
      ],
      slot_master_times: ["09:00:00"],
      slot_duration_minutes: 60,
    },
  };
}

function opening(applies: boolean) {
  return {
    data: {
      equipment_id: 5,
      applies,
      weekday: applies ? 2 : null,
      time: applies ? "21:00" : null,
      source: applies ? "global" : null,
      next_opens_at: null,
      server_time: "",
      utc_offset_minutes: 330,
    },
  };
}

describe("EquipmentAvailabilityCalendar next-week countdown", () => {
  it("shows when next week's slots open for the equipment on the public calendar", async () => {
    getEquipmentSlots.mockResolvedValue(weekPayload());
    getSlotWindowOpening.mockResolvedValue(opening(true));

    render(<EquipmentAvailabilityCalendar equipmentId={5} />);

    const el = await screen.findByTestId("slot-opening-countdown");
    expect(el.textContent).toMatch(/Next week's slots open Wed 9:00 pm/);
    expect(el.textContent).toMatch(/in \d/);
    expect(getSlotWindowOpening).toHaveBeenCalledWith("5");
  });

  it("shows nothing when the equipment has no weekly opening rule", async () => {
    getEquipmentSlots.mockResolvedValue(weekPayload());
    getSlotWindowOpening.mockResolvedValue(opening(false));

    render(<EquipmentAvailabilityCalendar equipmentId={5} />);

    await screen.findByText("Next Week");
    await vi.waitFor(() => expect(getSlotWindowOpening).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByTestId("slot-opening-countdown")).toBeNull();
  });
});
