// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { usePeakWindow } from "@/hooks/use-peak-window";
import { ResearchWorkspacePicker } from "@/components/my-research/ResearchWorkspacePicker";
import { PeakCollapsible } from "./PeakCollapsible";
import { ClampedNote } from "./ClampedNote";
import { ACTION_BAR_OFFSET_VAR, BookingActionBar } from "./BookingActionBar";

const state = vi.hoisted(() => ({
  peak: { loaded: true, active: false, externalPaused: false, externalNotice: false, window: null, message: "" },
  options: [{ id: "p1", name: "Thin films", booking_linked: false }],
}));

vi.mock("@/hooks/use-peak-window", () => ({ usePeakWindow: () => state.peak }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: 7 } }) }));
vi.mock("@/components/my-research/useMyResearchAvailability", () => ({
  useMyResearchAvailability: () => ({ available: true, bootstrap: { can_create: false } }),
}));
vi.mock("@/lib/api", () => ({
  API_BASE_URL: "/api",
  apiClient: {
    myResearchWorkspaceOptions: vi.fn(async () => ({ data: { results: state.options } })),
    createResearchWorkspace: vi.fn(),
  },
}));

/** The booking page passes `usePeakWindow().active` as `collapsible` to its optional panels. */
function PeakPanel() {
  const active = usePeakWindow().active;
  return (
    <PeakCollapsible id="template" collapsible={active} title="Booking template" summary="2 saved">
      <p>Template picker</p>
    </PeakCollapsible>
  );
}

function PeakProject({ value = null }: { value?: string | null }) {
  const active = usePeakWindow().active;
  return <ResearchWorkspacePicker value={value} onChange={() => {}} collapsible={active} />;
}

beforeEach(() => {
  state.peak = { ...state.peak, active: false };
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  document.documentElement.style.removeProperty(ACTION_BAR_OFFSET_VAR);
});

describe("optional panels in the peak window", () => {
  it("render as-is outside the peak window", () => {
    render(<PeakPanel />);
    expect(screen.getByText("Template picker")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Booking template/ })).toBeNull();
  });

  it("start collapsed during the window, expand on click, and remember the choice for the session", () => {
    state.peak = { ...state.peak, active: true };
    const { unmount } = render(<PeakPanel />);
    const toggle = screen.getByRole("button", { name: /Booking template/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("2 saved");
    expect(screen.queryByText("Template picker")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Template picker")).toBeTruthy();
    unmount();
    render(<PeakPanel />);
    expect(screen.getByText("Template picker")).toBeTruthy();
  });
});

describe("Project (optional) picker", () => {
  it("is a compact one-line select with the helper behind an info button outside the window", async () => {
    render(<PeakProject />);
    const select = await screen.findByRole("combobox", { name: /Project/ });
    expect(select.textContent).toContain("None");
    expect(screen.queryByText(/added to this private project/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "About adding the booking to a project" }));
    expect(screen.getByText(/added to this private project/)).toBeTruthy();
    expect(screen.queryByTestId("project-picker-collapsed")).toBeNull();
  });

  it("is collapsed during the window and expands on click; the choice is kept for the session", async () => {
    state.peak = { ...state.peak, active: true };
    const { unmount } = render(<PeakProject />);
    const row = await screen.findByTestId("project-picker-collapsed");
    expect(row.getAttribute("aria-expanded")).toBe("false");
    expect(row.textContent).toContain("Project (optional):");
    expect(row.textContent).toContain("None");
    expect(row.textContent).toContain("Add to project");
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(row);
    expect(await screen.findByRole("combobox", { name: /Project/ })).toBeTruthy();
    unmount();
    render(<PeakProject />);
    expect(await screen.findByRole("combobox", { name: /Project/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide project picker" }));
    expect(await screen.findByTestId("project-picker-collapsed")).toBeTruthy();
  });

  it("shows the chosen project on the collapsed row", async () => {
    state.peak = { ...state.peak, active: true };
    render(<PeakProject value="p1" />);
    const row = await screen.findByTestId("project-picker-collapsed");
    expect(row.textContent).toContain("Thin films");
    expect(row.textContent).toContain("Change");
  });
});

describe("ClampedNote (important instruction)", () => {
  const sizes = (scrollHeight: number, clientHeight: number) => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(scrollHeight);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(clientHeight);
  };
  afterEach(() => vi.restoreAllMocks());

  it("shows the full note outside the window", () => {
    sizes(200, 200);
    render(<ClampedNote clamp={false}>Bring samples 30 minutes early.</ClampedNote>);
    expect(screen.getByText("Bring samples 30 minutes early.").closest("[data-clamped]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("keeps the first lines visible during the window with Show more / Show less", () => {
    sizes(200, 44);
    render(<ClampedNote clamp>Long important instruction</ClampedNote>);
    const text = screen.getByText("Long important instruction");
    expect(text.getAttribute("data-clamped")).toBe("true");
    const more = screen.getByRole("button", { name: "Show more" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(text.getAttribute("data-clamped")).toBeNull();
    expect(screen.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("does not offer Show more when a short note already fits", () => {
    sizes(40, 44);
    render(<ClampedNote clamp>Short note</ClampedNote>);
    expect(screen.getByText("Short note")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
});

describe("BookingActionBar", () => {
  it("shows the summary and actions and lifts the assistant launcher while mounted", () => {
    const vh = window.innerHeight;
    const rect = { top: vh - 72, bottom: vh };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ ...rect, left: 0, right: 0, width: 0, height: rect.bottom - rect.top, x: 0, y: rect.top, toJSON: () => ({}) }) as DOMRect,
    );
    // Run frames synchronously; returning 0 marks no frame as pending once the callback has run.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    const moveBar = (top: number, bottom: number) => {
      rect.top = top;
      rect.bottom = bottom;
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
    };
    const { unmount } = render(
      <BookingActionBar summary="3 slots selected · Total ₹1,200">
        <button type="button">Confirm Booking (3 slots)</button>
      </BookingActionBar>,
    );
    const bar = screen.getByTestId("booking-action-bar");
    expect(bar.className).toContain("sticky");
    expect(bar.className).toContain("bottom-0");
    expect(screen.getByText("3 slots selected · Total ₹1,200")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm Booking (3 slots)" })).toBeTruthy();
    const offset = () => document.documentElement.style.getPropertyValue(ACTION_BAR_OFFSET_VAR);
    // Pinned to the viewport bottom.
    expect(offset()).toBe("72px");
    // Page end: the bar rides up with the content, so the launcher must clear the space below it too.
    moveBar(vh - 140, vh - 68);
    expect(offset()).toBe("140px");
    // Bar in the upper half or scrolled off screen: the launcher's default spot is already clear.
    moveBar(100, 172);
    expect(offset()).toBe("0px");
    moveBar(-200, -128);
    expect(offset()).toBe("0px");
    act(() => unmount());
    expect(document.documentElement.style.getPropertyValue(ACTION_BAR_OFFSET_VAR)).toBe("");
    vi.restoreAllMocks();
  });
});
