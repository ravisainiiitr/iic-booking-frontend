// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const api = vi.hoisted(() => ({
  modules: vi.fn(),
  createModule: vi.fn(),
  module: vi.fn(),
  updateModule: vi.fn(),
  uploadDocument: vi.fn(),
  addQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  viewed: vi.fn(),
  acknowledge: vi.fn(),
  attempt: vi.fn(),
  saveSetting: vi.fn(),
  logbook: vi.fn(),
  addLogbookEntry: vi.fn(),
}));

vi.mock("@/lib/learningApi", () => ({ learningApi: api }));
vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/training/trainingUi", async (orig) => {
  const actual = await orig<typeof import("@/components/training/trainingUi")>();
  return {
    ...actual,
    TrainingPageFrame: ({ title, children }: { title: string; children: React.ReactNode }) => (
      <div>
        <h1>{title}</h1>
        {children}
      </div>
    ),
  };
});

import LearningCentre from "./LearningCentre";
import { BookingLogbook } from "@/components/learning/BookingLogbook";

const progress = { viewed_at: null, acknowledged_at: null, attempts: 0, best_score_pct: null, passed_at: null, complete: false };
const mod = {
  id: 5, equipment_id: 7, title: "XRD safety and SOP", summary: "Radiation basics", video_url: "https://video.example/xrd",
  document_url: "/media/learning/sop.pdf", order: 0, is_required: true, requires_acknowledgement: true,
  acknowledgement_text: "I have read and understood this material.", pass_mark_pct: 50, max_attempts_per_day: 3,
  is_published: true, question_count: 2, progress, can_edit: false,
};
const detail = {
  ...mod,
  body: "Never open the enclosure while the shutter is open.",
  questions: [
    { id: 1, text: "Shutter before opening the door?", options: ["Open", "Closed"], order: 1, multiple: false },
    { id: 2, text: "Which are PPE?", options: ["Lab coat", "Sandals", "Badge"], order: 2, multiple: true },
  ],
};
const listing = (overrides = {}) => ({
  equipment: { equipment_id: 7, name: "XRD", code: "XRD1" },
  results: [mod],
  required_incomplete: ["XRD safety and SOP"],
  modules_before_training_request: true,
  can_edit: false,
  can_configure: false,
  ...overrides,
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/learning/7"]}>
      <Routes>
        <Route path="/learning/:equipmentId" element={<LearningCentre />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.modules.mockResolvedValue({ data: listing() });
  api.module.mockResolvedValue({ data: detail });
  api.viewed.mockResolvedValue({ data: progress });
});
afterEach(() => cleanup());

describe("Online learning", () => {
  it("shows what is pending, the material, sign-off and the quiz with feedback", async () => {
    api.acknowledge.mockResolvedValue({ data: { ...progress, acknowledged_at: "2026-11-04T05:00:00Z" } });
    api.attempt.mockResolvedValue({
      data: { score_pct: 50, passed: true, pass_mark_pct: 50, complete: false,
        results: [{ question_id: 1, correct: true, correct_options: [1], explanation: "Close it first." },
          { question_id: 2, correct: false, correct_options: [0, 2], explanation: "Coat and badge." }] },
    });
    renderPage();
    expect((await screen.findByTestId("learning-pending")).textContent).toContain("You can request training once these are done");
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByText(/Never open the enclosure/)).toBeTruthy();
    expect(api.viewed).toHaveBeenCalledWith(5);
    expect(screen.getByRole("link", { name: /Open the SOP/ }).getAttribute("href")).toBe("/media/learning/sop.pdf");
    expect(screen.getByRole("link", { name: /Watch the video/ }).getAttribute("rel")).toContain("noopener");

    const signOff = screen.getByRole("button", { name: "Sign off" }) as HTMLButtonElement;
    expect(signOff.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Confirm you have read the material" }));
    fireEvent.click(signOff);
    await waitFor(() => expect(api.acknowledge).toHaveBeenCalledWith(5));

    fireEvent.click(screen.getByLabelText("Closed"));
    fireEvent.click(screen.getByLabelText("Lab coat"));
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));
    await waitFor(() => expect(api.attempt).toHaveBeenCalledWith(5, { "1": [1], "2": [0] }));
    expect((await screen.findByTestId("quiz-score")).textContent).toContain("50% · Passed");
    expect(screen.getByText(/Coat and badge/)).toBeTruthy();
  });

  it("lets staff add a module and require modules before a training request", async () => {
    api.modules.mockResolvedValue({ data: listing({ can_edit: true, can_configure: true, modules_before_training_request: false, results: [] }) });
    api.createModule.mockResolvedValue({ data: { ...mod, id: 9 } });
    api.saveSetting.mockResolvedValue({ data: { modules_before_training_request: true } });
    renderPage();
    fireEvent.click(await screen.findByRole("switch", { name: "Require modules before a training request" }));
    await waitFor(() => expect(api.saveSetting).toHaveBeenCalledWith(7, true));
    fireEvent.click(screen.getByRole("switch", { name: "Edit content" }));
    fireEvent.change(screen.getByLabelText("New module title"), { target: { value: "Sample preparation" } });
    fireEvent.click(screen.getByRole("button", { name: /Add module/ }));
    await waitFor(() => expect(api.createModule).toHaveBeenCalledWith(7, { title: "Sample preparation" }));
  });

  it("hides editing from learners", async () => {
    renderPage();
    await screen.findByTestId("learning-pending");
    expect(screen.queryByRole("switch", { name: "Edit content" })).toBeNull();
  });
});

describe("Booking logbook", () => {
  it("lists entries and records a problem", async () => {
    api.logbook.mockResolvedValue({
      data: { results: [{ id: 1, booking_id: 99, kind: "PARAMETERS", kind_label: "Run parameters", text: "2θ 10-80°", author: { id: 3, name: "Student One" }, created_at: "2026-11-04T05:00:00Z" }],
        kinds: [{ value: "NOTE", label: "Note" }, { value: "ISSUE", label: "Problem with the equipment" }] },
    });
    api.addLogbookEntry.mockResolvedValue({ data: { id: 2 } });
    render(<BookingLogbook bookingId={99} />);
    expect(await screen.findByText("2θ 10-80°")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Text"), { target: { value: "Tube current dropped" } });
    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
    await waitFor(() => expect(api.addLogbookEntry).toHaveBeenCalledWith(99, "NOTE", "Tube current dropped"));
  });

  it("shows nothing to people who cannot see the logbook", async () => {
    api.logbook.mockResolvedValue({ error: "Forbidden", status: 403 });
    const { container } = render(<BookingLogbook bookingId={99} />);
    await waitFor(() => expect(api.logbook).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
