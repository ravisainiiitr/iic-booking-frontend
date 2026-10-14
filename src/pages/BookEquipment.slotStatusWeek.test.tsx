// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { addDays, endOfMonth, format, getDaysInMonth, isLeapYear, startOfWeek } from "date-fns";
import BookEquipment from "./BookEquipment";

const equipment = {
  id: 11,
  equipment_id: 11,
  name: "Demo X-ray Diffractometer",
  code: "XRD",
  status: "ACTIVE",
  status_display: "Operational",
  department_id: 5,
  slot_duration_minutes: 120,
  slot_master_times: ["09:00", "14:00"],
  input_fields: [],
  is_bookable: true,
};

const slotsFor = (start: string, end: string) => {
  const slots: Record<string, unknown>[] = [];
  for (let d = new Date(`${start}T00:00:00`); d <= new Date(`${end}T00:00:00`); d = addDays(d, 1)) {
    const ds = format(d, "yyyy-MM-dd");
    ["09:00", "14:00"].forEach((t, i) => {
      slots.push({
        id: Number(ds.replace(/-/g, "")) * 10 + i,
        date: ds,
        start_datetime: `${ds}T${t}:00`,
        end_datetime: `${ds}T${t}:00`,
        slot_open_time: `${t}:00`,
        status: "AVAILABLE",
        status_display: "Available",
        is_available: true,
      });
    });
  }
  return slots;
};

const api = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {
    getToken: () => "token",
    getCurrentUser: async () => ({ data: { id: 3, user_type: "manager", department: 5 } }),
    getEquipmentImageProxyPath: () => "",
  };
  const client = new Proxy(handlers, {
    get: (target, prop: string) => target[prop] ?? (async () => ({ data: null })),
  });
  return { handlers, client };
});

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api.client,
}));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/slot-status/RecurringBlockRules", () => ({ default: () => null }));

window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;

const today = new Date();
const thisMonth = format(today, "MMM");
const otherDate = format(today.getDate() > 15 ? new Date(today.getFullYear(), today.getMonth(), 3) : endOfMonth(today), "yyyy-MM-dd");

const weekShown = () => screen.queryByRole("button", { name: /Previous Week/ }) != null;
const weekLabel = () =>
  Array.from(document.querySelectorAll("div.font-semibold"))
    .map((el) => el.textContent ?? "")
    .find((text) => /^\w{3} \d{2} - \w{3} \d{2}, \d{4}$/.test(text));
const slotsSelected = () => /\d+ slot\(s\) selected/.test(document.body.textContent ?? "");
const hintShown = () => screen.queryByTestId("status-week-hidden-hint") != null;
const applyLabel = () => screen.getByRole("button", { name: /^Apply to \d+ (date|slot)\(s\)$/ }).textContent;

const renderPage = async () => {
  render(
    <MemoryRouter initialEntries={["/change-slot-status?equipment_id=11"]}>
      <Routes>
        <Route path="*" element={<BookEquipment slotStatusFilters={<div />} />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(weekShown()).toBe(true), { timeout: 5000 });
  await waitFor(() => expect(document.querySelectorAll("[data-status-slot-cell]").length).toBeGreaterThan(0));
};

const pickFirstSlot = async () => {
  const cells = document.querySelectorAll<HTMLElement>("[data-status-slot-cell] button");
  fireEvent.click(cells[cells.length - 1]);
  await waitFor(() => expect(slotsSelected()).toBe(true));
};

const expectHiddenWithoutSlots = () => {
  expect(weekShown()).toBe(false);
  expect(hintShown()).toBe(true);
  expect(slotsSelected()).toBe(false);
};

beforeEach(() => {
  api.handlers.getEquipmentDetailById = async () => ({ data: equipment });
  api.handlers.getEquipmentSlots = async (_id: unknown, start: unknown, end: unknown) => ({
    data: { slots: slotsFor(String(start), String(end)), slot_master_times: ["09:00", "14:00"], holidays: {} },
  });
});
afterEach(() => cleanup());

describe("Change slot status week view", () => {
  it("opens on the current week", async () => {
    await renderPage();
    expect(weekLabel()?.startsWith(format(startOfWeek(today, { weekStartsOn: 1 }), "MMM dd"))).toBe(true);
    expect(hintShown()).toBe(false);
  });

  it("hides the week and drops its slots when a month is clicked, and applies to the whole month", async () => {
    await renderPage();
    await pickFirstSlot();
    fireEvent.click(screen.getByRole("button", { name: thisMonth }));
    expectHiddenWithoutSlots();
    expect(applyLabel()).toBe(`Apply to ${getDaysInMonth(today)} date(s)`);
  });

  it("keeps the week hidden when a month is double-clicked to open it", async () => {
    await renderPage();
    const month = screen.getByRole("button", { name: thisMonth });
    fireEvent.click(month);
    fireEvent.click(month);
    fireEvent.doubleClick(month);
    expect(weekShown()).toBe(false);
    expect(hintShown()).toBe(true);
  });

  it("hides the week on Select entire year and applies to every date of the year", async () => {
    await renderPage();
    await pickFirstSlot();
    fireEvent.click(screen.getByRole("button", { name: "Select entire year" }));
    expectHiddenWithoutSlots();
    expect(applyLabel()).toBe(`Apply to ${isLeapYear(today) ? 366 : 365} date(s)`);
  });

  it.each([
    ["Select entire month"],
    ["Previous year"],
    ["Next year"],
    ["Previous month"],
    ["Next month"],
  ])("hides the week and drops its slots on %s", async (name) => {
    await renderPage();
    await pickFirstSlot();
    fireEvent.click(screen.getByRole("button", { name }));
    expectHiddenWithoutSlots();
  });

  it("keeps the week hidden on Select selected week and applies to that week's dates", async () => {
    await renderPage();
    // Opening a week clears the date selection, so Select selected week is only usable once the week is hidden.
    expect(screen.getByRole("button", { name: "Select selected week" }).hasAttribute("disabled")).toBe(true);
    const cell = document.querySelector(`[data-status-date="${otherDate}"]`) as HTMLElement;
    fireEvent.click(cell, { detail: 0 });
    expect(weekShown()).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Select selected week" }));
    expect(weekShown()).toBe(false);
    expect(hintShown()).toBe(true);
    expect(applyLabel()).toBe("Apply to 7 date(s)");
  });

  it("hides the week and drops its slots on Clear selection and Clear all selection", async () => {
    await renderPage();
    await pickFirstSlot();
    const clear = screen.getAllByRole("button", { name: "Clear selection" }).find((b) => !b.hasAttribute("disabled"));
    fireEvent.click(clear!);
    expectHiddenWithoutSlots();

    fireEvent.keyDown(document.querySelector(`[data-status-date="${otherDate}"]`) as HTMLElement, { key: "Enter" });
    await waitFor(() => expect(weekShown()).toBe(true));
    await waitFor(() => expect(document.querySelectorAll("[data-status-slot-cell] button").length).toBeGreaterThan(0));
    await pickFirstSlot();
    fireEvent.click(screen.getByRole("button", { name: "Clear all selection" }));
    expectHiddenWithoutSlots();
  });

  it("shows the week again only after a date is double-clicked, then the week arrows move it", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: thisMonth }));
    expect(weekShown()).toBe(false);
    const cell = document.querySelector(`[data-status-date="${otherDate}"]`) as HTMLElement;
    fireEvent.click(cell, { detail: 1 });
    fireEvent.click(cell, { detail: 2 });
    await waitFor(() => expect(weekShown()).toBe(true));
    const weekOf = startOfWeek(new Date(`${otherDate}T00:00:00`), { weekStartsOn: 1 });
    expect(weekLabel()?.startsWith(format(weekOf, "MMM dd"))).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Next Week/ }));
    });
    expect(weekLabel()?.startsWith(format(addDays(weekOf, 7), "MMM dd"))).toBe(true);
  });

  it("starts with the week hidden after the user switched equipment", async () => {
    render(
      <MemoryRouter initialEntries={["/change-slot-status?equipment_id=11"]}>
        <Routes>
          <Route path="*" element={<BookEquipment slotStatusFilters={<div />} slotStatusWeekStartsHidden />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(hintShown()).toBe(true), { timeout: 5000 });
    expect(weekShown()).toBe(false);
  });
});
