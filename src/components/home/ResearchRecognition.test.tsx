// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getHallOfFrames: vi.fn(), getResearchersOfTheMonth: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));

import HallOfFrames from "./HallOfFrames";
import ResearcherOfTheMonth from "./ResearcherOfTheMonth";

beforeAll(() => {
  // jsdom lacks these; embla needs them to lay out the carousel.
  window.matchMedia ??= ((query: string) =>
    ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false }) as unknown as MediaQueryList);
  window.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
    root = null; rootMargin = ""; thresholds = [];
  } as unknown as typeof IntersectionObserver;
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const person = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  researcher_name: `Researcher ${id}`,
  photo_url: id === 1 ? "https://example.org/p1.jpg" : null,
  affiliation: "Chemistry, IIT Roorkee",
  publication_title: `Paper ${id}`,
  research_summary: "Catalysts for green hydrogen.",
  journal: "Nature Materials",
  year: 2026,
  publication_url: id === 1 ? "https://doi.org/10.1/x" : "",
  facility: "FE-SEM · IIC Electron Microscopy",
  equipment_id: null,
  ...extra,
});

describe("Hall of Frames", () => {
  it("shows each approved researcher with publication, venue and acknowledged facility", async () => {
    api.getHallOfFrames.mockResolvedValue({ data: { results: [person(1), person(2)] } });
    render(<HallOfFrames />);
    const section = await screen.findByTestId("hall-of-frames");
    const first = within(section).getByRole("group", { name: "1 of 2: Researcher 1" });
    expect(within(first).getByRole("img", { name: "Portrait of Researcher 1" }).getAttribute("width")).toBe("160");
    expect(within(first).getByRole("link", { name: /Paper 1/ }).getAttribute("href")).toBe("https://doi.org/10.1/x");
    expect(within(first).getByText("Nature Materials, 2026")).toBeTruthy();
    expect(within(first).getByText(/Acknowledged: FE-SEM/)).toBeTruthy();
    expect(within(section).getByRole("button", { name: "Next researcher" })).toBeTruthy();
    // Keyboard focus inside pauses rotation without errors.
    fireEvent.focus(within(section).getByRole("button", { name: "Next researcher" }));
  });

  it("is hidden when there are no approved entries", async () => {
    api.getHallOfFrames.mockResolvedValue({ data: { results: [] } });
    const { container } = render(<HallOfFrames />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
  });
});

describe("Researcher of the Month", () => {
  it("shows this month's researchers, institute-wide first, with their department", async () => {
    api.getResearchersOfTheMonth.mockResolvedValue({
      data: {
        month: "2026-11-01",
        history: false,
        results: [
          { ...person(3), month: "2026-11-01", department_id: 7, department_name: "Physics" },
          { ...person(4), month: "2026-11-01", department_id: null, department_name: "Institute-wide" },
        ],
      },
    });
    render(<ResearcherOfTheMonth />);
    const section = await screen.findByTestId("researcher-of-the-month");
    expect(within(section).getByRole("heading", { name: "November 2026" })).toBeTruthy();
    const cards = within(section).getAllByRole("article");
    expect(within(cards[0]).getByText("Institute-wide")).toBeTruthy();
    expect(within(cards[1]).getByText("Physics")).toBeTruthy();
  });

  it("is hidden when no researcher is set for the month", async () => {
    api.getResearchersOfTheMonth.mockResolvedValue({ data: { month: "2026-11-01", history: false, results: [] } });
    const { container } = render(<ResearcherOfTheMonth />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
  });
});
