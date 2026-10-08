// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ModeAvailabilityMode, ModeAvailabilitySummary, ModeDayCell } from "@/lib/modeAvailability";

const api = vi.hoisted(() => ({ getEquipmentModeAvailability: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

import ModeAvailabilitySection from "./ModeAvailabilitySection";
import CardModeAvailability from "./CardModeAvailability";
import ModeAvailabilityHeaderLine from "./ModeAvailabilityHeaderLine";
import ModeWeekdayChips from "./ModeWeekdayChips";

const BASE = 1;
const DEPTH = 2;
const UPS = 3;

function mode(id: number, extra: Partial<ModeAvailabilityMode> = {}): ModeAvailabilityMode {
  return {
    equipment_id: id,
    code: { 1: "XPS", 2: "XPS-D", 3: "XPS-U" }[id] ?? `M${id}`,
    name: { 1: "XPS base", 2: "XPS Depth", 3: "XPS UPS" }[id] ?? `Mode ${id}`,
    role: id === BASE ? "base" : "mode",
    operational: true,
    weekdays: [0, 1, 2, 3],
    hours: [],
    state: "available",
    next_available: { date: "2030-01-09", free_slots: 2 },
    next_opening: null,
    ...extra,
  };
}

function summary(equipmentId: number): ModeAvailabilitySummary {
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(2030, 0, 7 + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const past = i === 0;
    const cell = (id: number): ModeDayCell => {
      if (past) return { equipment_id: id, status: "past", label: "" };
      if (iso === "2030-01-09" && id === BASE) return { equipment_id: id, status: "available", label: "2 free slots", free_slots: 2 };
      if (iso === "2030-01-09" && id === DEPTH) return { equipment_id: id, status: "not_running", label: "Mode not scheduled" };
      if (iso === "2030-01-09" && id === UPS) return { equipment_id: id, status: "full", label: "Fully booked" };
      return { equipment_id: id, status: "not_open", label: "Booking not open yet", opens_at: "2030-01-09T21:00:00" };
    };
    return {
      date: iso,
      weekday: i % 7,
      is_today: i === 1,
      is_past: past,
      holiday: null,
      weekend: i % 7 >= 5,
      modes: [cell(BASE), cell(DEPTH), cell(UPS)],
    };
  });
  return {
    multi_mode: true,
    equipment_id: equipmentId,
    parent_equipment_id: BASE,
    generated_at: "2030-01-08T10:00:00",
    today: "2030-01-08",
    start_date: "2030-01-07",
    end_date: "2030-02-03",
    modes: [mode(BASE), mode(DEPTH, { weekdays: [1, 3], state: "not_open", next_available: null }), mode(UPS, { state: "full", next_available: null })],
    days,
  };
}

const renderSection = (props: Partial<Parameters<typeof ModeAvailabilitySection>[0]> = {}) =>
  render(
    <MemoryRouter>
      <ModeAvailabilitySection equipmentId={BASE} {...props} />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  api.getEquipmentModeAvailability.mockReset();
});

describe("ModeWeekdayChips", () => {
  it("highlights the running days and describes them in text", () => {
    render(<ModeWeekdayChips weekdays={[1, 3]} color="#123456" />);
    const chips = screen.getByTestId("mode-weekday-chips");
    const active = chips.querySelectorAll('[data-active="true"]');
    expect(active).toHaveLength(2);
    expect(active[0].textContent).toBe("Tue");
    expect(screen.getByText("Runs Tue, Thu")).toBeTruthy();
  });
});

describe("ModeAvailabilitySection", () => {
  it("shows a loading state, then the mode legend and calendar for a base", async () => {
    api.getEquipmentModeAvailability.mockResolvedValue({ data: summary(BASE) });
    renderSection();
    expect(screen.getByTestId("mode-availability-loading")).toBeTruthy();
    await screen.findByTestId("mode-availability-section");
    const legend = screen.getAllByTestId("mode-legend-item");
    expect(legend.map((li) => li.textContent?.includes("XPS"))).toEqual([true, true, true]);
    expect(legend[0].getAttribute("data-current")).toBe("true");
    expect(within(legend[0]).getByText(/Next available: Wed, 9 Jan/)).toBeTruthy();
    const wed = screen.getByTestId("mode-day-2030-01-09");
    const entries = within(wed).getAllByTestId("mode-day-entry");
    expect(entries.map((e) => Number(e.getAttribute("data-mode")))).toEqual([BASE, UPS]);
    expect(within(wed).getByText("2 free")).toBeTruthy();
    expect(within(wed).getByText("Full")).toBeTruthy();
    expect(within(screen.getByTestId("mode-day-2030-01-14")).getAllByText("Opens 9 Jan")).toHaveLength(1);
    expect(screen.getByTestId("mode-day-2030-01-08").getAttribute("data-today")).toBe("true");
    expect((screen.getByTestId("mode-day-2030-01-07") as HTMLButtonElement).disabled).toBe(true);
  });

  it("on a mode page puts that mode first and mutes the others", async () => {
    api.getEquipmentModeAvailability.mockResolvedValue({ data: summary(DEPTH) });
    renderSection({ equipmentId: DEPTH });
    await screen.findByTestId("mode-availability-section");
    const legend = screen.getAllByTestId("mode-legend-item");
    expect(legend[0].textContent).toContain("XPS Depth");
    expect(legend[0].getAttribute("data-current")).toBe("true");
    const wed = screen.getByTestId("mode-day-2030-01-09");
    const entries = within(wed).getAllByTestId("mode-day-entry");
    expect(entries.map((e) => Number(e.getAttribute("data-mode")))).toEqual([DEPTH, BASE, UPS]);
    expect(entries[0].getAttribute("data-status")).toBe("not_running");
    expect(entries[0].className).not.toContain("opacity-50");
    expect(entries[1].className).toContain("opacity-50");
  });

  it("opens day details and books a mode with free slots at that date", async () => {
    api.getEquipmentModeAvailability.mockResolvedValue({ data: summary(BASE) });
    const onBook = vi.fn();
    renderSection({ onBook, canBook: true });
    await screen.findByTestId("mode-availability-section");
    fireEvent.click(screen.getByTestId("mode-day-2030-01-09"));
    const details = screen.getByTestId("mode-day-details");
    expect(within(details).getByText(/XPS Depth/)).toBeTruthy();
    expect(within(details).queryByRole("button", { name: "Book XPS-U" })).toBeNull();
    fireEvent.click(within(details).getByRole("button", { name: "Book XPS" }));
    expect(onBook).toHaveBeenCalledWith(BASE, "2030-01-09");
  });

  it("hides booking buttons when the viewer cannot book", async () => {
    api.getEquipmentModeAvailability.mockResolvedValue({ data: summary(BASE) });
    renderSection({ onBook: vi.fn(), canBook: false });
    await screen.findByTestId("mode-availability-section");
    fireEvent.click(screen.getByTestId("mode-day-2030-01-09"));
    expect(within(screen.getByTestId("mode-day-details")).queryAllByRole("button")).toHaveLength(0);
  });

  it("renders nothing for equipment that is not multi-mode and offers a retry on errors", async () => {
    api.getEquipmentModeAvailability.mockResolvedValue({ data: { multi_mode: false, equipment_id: 9 } });
    const { container } = renderSection({ equipmentId: 9 });
    await waitFor(() => expect(container.querySelector("section")).toBeNull());
    cleanup();
    api.getEquipmentModeAvailability.mockResolvedValue({ error: "boom" });
    renderSection();
    expect(await screen.findByText("Availability by mode could not be loaded.")).toBeTruthy();
  });
});

describe("CardModeAvailability", () => {
  const card = (modes: ModeAvailabilityMode[]) => ({
    parent_equipment_id: BASE,
    modes: modes.map((m) => ({ ...m, next_available: m.next_available ? { date: m.next_available.date, free_slots: m.next_available.free_slots } : null })),
  });

  it("puts every mode of a base card on one line with the base first", () => {
    const onOpen = vi.fn();
    const modes = [mode(BASE), mode(DEPTH, { weekdays: [], state: "not_running", next_available: null }), mode(UPS, { state: "full", next_available: null })];
    render(<CardModeAvailability availability={card(modes)} equipmentId={BASE} onOpen={onOpen} />);
    const strip = screen.getByTestId("card-mode-availability");
    expect(strip.textContent).toBe("XPS Mon–Thu · next Wed 9 Jan|XPS-D not scheduled|XPS-U Mon–Thu · full");
    expect(strip.getAttribute("aria-label")).toContain("XPS-D not scheduled");
    fireEvent.click(strip);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe("ModeAvailabilityHeaderLine", () => {
  it("summarises every mode on one line, leading with the current mode, and opens the calendar", async () => {
    const data = summary(DEPTH);
    data.modes[1] = mode(DEPTH, { weekdays: [1, 3], next_available: { date: "2030-01-15", free_slots: 1 } });
    data.modes[2] = mode(UPS, { weekdays: [0, 1, 2, 3, 4, 5, 6], state: "full", next_available: null, next_opening: { date: "2030-01-21", opens_at: "2030-01-15T21:00:00" } });
    api.getEquipmentModeAvailability.mockResolvedValue({ data });
    const onOpen = vi.fn();
    render(<ModeAvailabilityHeaderLine equipmentId={DEPTH} onOpen={onOpen} />);
    expect(screen.getByTestId("mode-header-line-loading")).toBeTruthy();
    const line = await screen.findByTestId("mode-header-line");
    expect(line.textContent).toBe(
      "XPS-D Tue/Thu · next Tue 15 Jan|XPS Mon–Thu · next Wed 9 Jan|XPS-U Daily · full until Mon 21 Jan",
    );
    expect(line.getAttribute("aria-label")).toContain("XPS-D Tue/Thu · next Tue 15 Jan | XPS Mon–Thu");
    fireEvent.click(line);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("renders nothing for equipment that is not multi-mode", async () => {
    api.getEquipmentModeAvailability.mockResolvedValue({ data: { multi_mode: false, equipment_id: 9 } });
    render(<ModeAvailabilityHeaderLine equipmentId={9} onOpen={() => {}} />);
    await waitFor(() => expect(screen.queryByTestId("mode-header-line-loading")).toBeNull());
    expect(screen.queryByTestId("mode-header-line")).toBeNull();
  });
});
