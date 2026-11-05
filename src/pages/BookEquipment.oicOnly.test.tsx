// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { addDays, format } from "date-fns";
import BookEquipment from "./BookEquipment";

const equipment = {
  id: 344,
  equipment_id: 344,
  name: "Repair Lab",
  code: "RL",
  status: "ACTIVE",
  status_display: "Operational",
  department_id: 5,
  profile_type: "SAMPLE",
  slot_duration_minutes: 210,
  slot_master_times: ["09:00"],
  input_fields: [],
  is_bookable: true,
  oic_requests_only: true,
  oic_request_registration_enabled: true,
};

const slotsFor = (start: string, end: string) => {
  const slots: Record<string, unknown>[] = [];
  for (let d = new Date(`${start}T00:00:00`); d <= new Date(`${end}T00:00:00`); d = addDays(d, 1)) {
    const ds = format(d, "yyyy-MM-dd");
    slots.push({
      id: Number(ds.replace(/-/g, "")),
      date: ds,
      start_datetime: `${ds}T09:00:00`,
      end_datetime: `${ds}T12:30:00`,
      slot_open_time: "09:00:00",
      status: "AVAILABLE",
      status_display: "Available",
      is_available: true,
    });
  }
  return slots;
};

const api = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {
    getToken: () => "token",
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
vi.mock("@/components/my-research/ResearchWorkspacePicker", () => ({ default: () => null, ResearchWorkspacePicker: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

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

const as = (user_type: string) => {
  api.handlers.getCurrentUser = async () => ({ data: { id: 3, user_type, department: 5 } });
};

const renderBook = () =>
  render(
    <MemoryRouter initialEntries={["/book-equipment?equipment_id=344&mode=book"]}>
      <Routes>
        <Route path="*" element={<BookEquipment />} />
      </Routes>
    </MemoryRouter>,
  );

const pickerHidden = () => screen.getByText("Book slots for user").closest(".hidden") != null;

beforeEach(() => {
  api.handlers.getEquipmentDetailById = async () => ({ data: equipment });
  api.handlers.getEquipmentSlots = async (_id: unknown, start: unknown, end: unknown) => ({
    data: { slots: slotsFor(String(start), String(end)), slot_master_times: ["09:00"], holidays: {} },
  });
  api.handlers.getOicRegisteredRequests = async () => ({ data: { allowed: true, equipment_id: 344, results: [] } });
});
afterEach(() => cleanup());

describe("booking equipment that takes OIC requests only", () => {
  it("lets an OIC reach the slots with no user selected, and sends an OIC request", async () => {
    as("manager");
    const book = vi.fn(async (..._args: unknown[]) => ({ data: { booking_id: 9, virtual_booking_id: "RL1", status: "BOOKED", total_charge: "0.00" } }));
    api.handlers.bookEquipment = book;
    renderBook();

    expect(await screen.findByText("Raise an OIC request", {}, { timeout: 5000 })).toBeTruthy();
    expect(pickerHidden()).toBe(true);
    expect(screen.queryByRole("switch", { name: /OIC request/ })).toBeNull();
    expect(await screen.findByText("Step 3: Select Time Slots", {}, { timeout: 5000 })).toBeTruthy();

    const slot = await waitFor(() => {
      const free = Array.from(document.querySelectorAll<HTMLElement>("button[aria-pressed='false']")).filter(
        (el) => /available/i.test(el.getAttribute("aria-label") ?? "") && !el.hasAttribute("aria-disabled"),
      );
      expect(free.length).toBeGreaterThan(0);
      return free[free.length - 1];
    });
    fireEvent.click(slot);
    const submit = await waitFor(() => {
      const button = screen.getAllByRole("button").find((b) => /^Confirm/.test(b.textContent?.trim() ?? "") && !b.hasAttribute("disabled"));
      expect(button).toBeTruthy();
      return button as HTMLElement;
    });
    fireEvent.click(submit);

    await waitFor(() => expect(book).toHaveBeenCalled());
    const [equipmentId, body] = book.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(Number(equipmentId)).toBe(344);
    expect(body.oic_registration).toBe(true);
    expect(body.user_id).toBeUndefined();
  }, 20000);

  it("tells the Main Administrator only an OIC can raise a request, and offers no slots", async () => {
    as("admin");
    renderBook();
    expect((await screen.findByTestId("oic-only-notice", {}, { timeout: 5000 })).textContent).toContain("Officer In-charge");
    expect(pickerHidden()).toBe(true);
    expect(screen.queryByText("Step 3: Select Time Slots")).toBeNull();
  }, 15000);
});
