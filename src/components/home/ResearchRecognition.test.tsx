// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getHallOfFrames: vi.fn(), getResearchersOfTheMonth: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));

import HallOfFrames from "./HallOfFrames";
import { MemoryRouter } from "react-router-dom";
import ResearcherSpotlight from "./ResearcherSpotlight";

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

describe("Researcher of the Month spotlight", () => {
  const month = (results: unknown[]) => ({ data: { month: "2026-11-01", history: false, results } });

  it("shows one card per researcher with every title, the count and the latest publication", async () => {
    api.getResearchersOfTheMonth.mockResolvedValue(
      month([{ ...person(3, { publication_count: 4 }), month: "2026-11-01", department_id: null, department_name: "Institute-wide",
               titles: ["Institute-wide", "Physics"] }]),
    );
    render(<MemoryRouter><ResearcherSpotlight /></MemoryRouter>);
    const card = await screen.findByTestId("researcher-spotlight");
    expect(within(card).getByText("November 2026")).toBeTruthy();
    expect(within(card).getAllByText("Researcher 3")).toHaveLength(1);
    expect(within(card).getByText("Institute-wide")).toBeTruthy();
    expect(within(card).getByText("Physics")).toBeTruthy();
    expect(within(card).getByText(/acknowledging IIC/).textContent).toContain("4 publications");
    expect(within(card).getByText("Paper 3")).toBeTruthy();
    expect(within(card).queryByRole("button", { name: "Next researcher" })).toBeNull();
  });

  it("steps through several researchers", async () => {
    api.getResearchersOfTheMonth.mockResolvedValue(
      month([
        { ...person(3), month: "2026-11-01", department_id: null, department_name: "Institute-wide" },
        { ...person(4), month: "2026-11-01", department_id: 7, department_name: "Chemistry" },
      ]),
    );
    render(<MemoryRouter><ResearcherSpotlight /></MemoryRouter>);
    const card = await screen.findByTestId("researcher-spotlight");
    expect(within(card).getByRole("heading", { name: "Researcher 3" })).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Next researcher" }));
    expect(within(card).getByRole("heading", { name: "Researcher 4" })).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Show Researcher 3" }));
    expect(within(card).getByRole("heading", { name: "Researcher 3" })).toBeTruthy();
  });

  it("has a compact version for small screens", async () => {
    api.getResearchersOfTheMonth.mockResolvedValue(
      month([{ ...person(5), month: "2026-11-01", department_id: 7, department_name: "Physics" }]),
    );
    render(<MemoryRouter><ResearcherSpotlight variant="compact" /></MemoryRouter>);
    const strip = await screen.findByTestId("researcher-spotlight-compact");
    expect(within(strip).getByText("Researcher 5")).toBeTruthy();
    expect(within(strip).getByText(/Physics/)).toBeTruthy();
  });

  it("is hidden when no researcher is chosen for the month", async () => {
    api.getResearchersOfTheMonth.mockResolvedValue(month([]));
    const { container } = render(<MemoryRouter><ResearcherSpotlight /></MemoryRouter>);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
  });
});

describe("Hall of Frames details", () => {
  it("shows how many approved publications a researcher has, and an icon when the photo cannot load", async () => {
    api.getHallOfFrames.mockResolvedValue({ data: { results: [person(1, { publication_count: 9 })] } });
    render(<HallOfFrames />);
    const section = await screen.findByTestId("hall-of-frames");
    expect(within(section).getByText("9 publications acknowledging IIC")).toBeTruthy();
    fireEvent.error(within(section).getByRole("img", { name: "Portrait of Researcher 1" }));
    expect(within(section).queryByRole("img", { name: "Portrait of Researcher 1" })).toBeNull();
  });
});
