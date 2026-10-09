// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  api: {
    getFlashMessages: vi.fn(),
    createFlashMessage: vi.fn(),
    updateFlashMessage: vi.fn(),
    endFlashMessage: vi.fn(),
    extendFlashMessage: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: state.api }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/flashMessages/FlashMessageEditor", () => ({
  FlashMessageEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="Message" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import EquipmentFlashMessages from "./EquipmentFlashMessages";

const record = {
  id: 11,
  equipment_id: 3,
  equipment_name: "FE-SEM",
  equipment_code: "SEM1",
  equipment_has_modes: false,
  department_name: "Physics",
  message: "Sample submission closes at <strong>4 PM</strong>",
  message_plain: "Sample submission closes at 4 PM",
  tone: "NOTICE",
  tone_display: "Notice",
  start_at: "2026-10-09T09:00:00+05:30",
  end_at: "2026-10-10T09:00:00+05:30",
  is_active: true,
  status: "LIVE",
  status_display: "Live",
  audience: "ALL",
  audience_display: "Everyone (including signed-out visitors)",
  audience_user_types: [],
  show_on_modes: false,
  link_url: "",
  link_label: "",
  created_by_name: "OIC One",
  updated_by_name: "OIC One",
  created_at: "2026-10-09T09:00:00+05:30",
  updated_at: "2026-10-09T09:00:00+05:30",
};

const listResponse = {
  count: 1,
  page: 1,
  page_size: 25,
  results: [record],
  summary: { live: 1, scheduled: 2, expired: 3, off: 0 },
  equipment_options: [
    { id: 3, name: "FE-SEM", code: "SEM1", department_id: 2, department_name: "Physics", has_modes: false, is_mode: false },
    { id: 5, name: "XRD Base", code: "XRD", department_id: 2, department_name: "Physics", has_modes: true, is_mode: false },
  ],
  tones: [],
  audiences: [],
  user_types: [{ value: "student", label: "IITR Student" }],
  limits: { message_max_chars: 300, max_duration_days: 30, max_start_ahead_days: 90, link_label_max_chars: 40 },
};

beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  window.HTMLElement.prototype.scrollTo ??= () => {};
});

beforeEach(() => {
  state.api.getFlashMessages.mockResolvedValue({ data: listResponse });
  state.api.createFlashMessage.mockImplementation(async (p: Record<string, unknown>) => ({ data: { ...record, ...p, id: 99 } }));
  state.api.endFlashMessage.mockResolvedValue({ data: { ...record, status: "EXPIRED", history: [] } });
  state.api.extendFlashMessage.mockResolvedValue({ data: { ...record, history: [] } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage(url = "/equipment-flash-messages") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <EquipmentFlashMessages />
    </MemoryRouter>,
  );
}

async function openRowMenu() {
  const trigger = await screen.findByRole("button", { name: "Actions for flash message on FE-SEM" });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
  return screen.findByRole("menu");
}

describe("EquipmentFlashMessages", () => {
  it("lists messages with tone, status and counts, and filters by status", async () => {
    renderPage();
    const row = await screen.findByTestId("flash-row");
    expect(within(row).getByText("FE-SEM")).toBeTruthy();
    expect(within(row).getByText("Notice")).toBeTruthy();
    expect(within(row).getByText("Live")).toBeTruthy();
    expect(within(row).getByText("Everyone")).toBeTruthy();
    expect(state.api.getFlashMessages.mock.calls[0][0]).toMatchObject({ with_options: true, page: 1, page_size: 25 });
    expect(screen.getByRole("tab", { name: /All\s*6/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Scheduled\s*2/ }));
    await waitFor(() => expect(state.api.getFlashMessages).toHaveBeenCalledTimes(2));
    expect(state.api.getFlashMessages.mock.calls[1][0]).toMatchObject({ status: "scheduled", with_options: undefined });
  });

  it("ends a message now and extends it from the row menu", async () => {
    renderPage();
    const menu = await openRowMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: /End now/ }));
    await waitFor(() => expect(state.api.endFlashMessage).toHaveBeenCalledWith(11));

    const menu2 = await openRowMenu();
    fireEvent.click(within(menu2).getByRole("menuitem", { name: /3 days/ }));
    await waitFor(() => expect(state.api.extendFlashMessage).toHaveBeenCalledWith(11, 3));
  });

  it("opens the create dialog from the equipment page shortcut with a live preview", async () => {
    renderPage("/equipment-flash-messages?equipment=5&new=1");
    const dialog = await screen.findByTestId("flash-message-dialog");
    expect(within(dialog).getByText("New flash message")).toBeTruthy();
    expect(within(dialog).getByText("Type a message to see how it will look.")).toBeTruthy();
    expect(within(dialog).getByLabelText("Also show on all modes of this instrument")).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText("Message"), { target: { value: "Lab closed <strong>Friday</strong>" } });
    const preview = within(dialog).getByRole("status");
    expect(preview.textContent).toContain("Lab closed Friday");
    fireEvent.click(within(dialog).getByRole("radio", { name: /Important/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "1 week" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(state.api.createFlashMessage).toHaveBeenCalledTimes(1));
    const payload = state.api.createFlashMessage.mock.calls[0][0];
    expect(payload).toMatchObject({ equipment: 5, tone: "IMPORTANT", audience: "ALL", start_at: null, is_active: true });
    const days = (new Date(payload.end_at).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it("validates the message length and duplicates a row into a new message", async () => {
    renderPage();
    const menu = await openRowMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Duplicate/ }));
    const dialog = await screen.findByTestId("flash-message-dialog");
    expect((within(dialog).getByLabelText("Message") as HTMLTextAreaElement).value).toContain("4 PM");

    fireEvent.change(within(dialog).getByLabelText("Message"), { target: { value: "x".repeat(301) } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish" }));
    expect(await within(dialog).findByRole("alert")).toBeTruthy();
    expect(state.api.createFlashMessage).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Message"), { target: { value: "Copy of the notice" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(state.api.createFlashMessage).toHaveBeenCalledTimes(1));
    expect(state.api.createFlashMessage.mock.calls[0][0]).toMatchObject({ equipment: 3, duplicated_from: 11, tone: "NOTICE" });
  });
});
