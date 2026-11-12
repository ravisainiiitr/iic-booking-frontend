// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getHallOfFrames: vi.fn(), getResearchersOfTheMonth: vi.fn(), getAcknowledgers: vi.fn(async () => ({ data: { results: [] } })) }));
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
  api.getAcknowledgers.mockResolvedValue({ data: { results: [] } });
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

  it("in the hero shows only the strip: the month, the Researcher of the Month first, and no publication block", async () => {
    api.getResearchersOfTheMonth.mockResolvedValue(
      month([{ ...person(3, { publication_count: 4, user_id: 3 }), month: "2026-11-01", department_id: null, department_name: "Institute-wide",
               titles: ["Institute-wide", "Physics"] }]),
    );
    api.getAcknowledgers.mockResolvedValue({ data: { results: [person(7, { user_id: 7 })] } });
    render(<MemoryRouter><ResearcherSpotlight /></MemoryRouter>);
    const card = await screen.findByTestId("researcher-spotlight");
    expect(await within(card).findByTestId("spotlight-month")).toBeTruthy();
    expect(within(card).getByTestId("spotlight-month").textContent).toBe("November 2026");
    const rows = within(card).getAllByRole("listitem").map((li) => li.textContent);
    expect(rows[0]).toContain("Researcher of the Month");
    expect(rows[0]).toContain("Researcher 3");
    expect(within(card).queryByRole("heading")).toBeNull();  // the large Researcher of the Month block is gone
    expect(within(card).queryByText("Paper 3")).toBeNull();
    expect(within(card).queryByRole("button", { name: "Next researcher" })).toBeNull();
    expect(within(card).getByRole("link", { name: /All publications/ })).toBeTruthy();
  });

  it("the compact card steps through several researchers by itself, not while hovered", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      api.getResearchersOfTheMonth.mockResolvedValue(
        month([
          { ...person(3), month: "2026-11-01", department_id: null, department_name: "Institute-wide" },
          { ...person(4), month: "2026-11-01", department_id: 7, department_name: "Chemistry" },
        ]),
      );
      render(<MemoryRouter><ResearcherSpotlight variant="compact" /></MemoryRouter>);
      const card = await screen.findByTestId("researcher-spotlight-compact");
      expect(within(card).getByText("Researcher 3")).toBeTruthy();
      fireEvent.click(within(card).getByRole("button", { name: "Next researcher" }));
      expect(within(card).getByText("Researcher 4")).toBeTruthy();
      await act(async () => { vi.advanceTimersByTime(7100); });
      expect(within(card).getByText("Researcher 3")).toBeTruthy();
      fireEvent.mouseEnter(card);
      await act(async () => { vi.advanceTimersByTime(15000); });
      expect(within(card).getByText("Researcher 3")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
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

describe("Acknowledgement list in the hero", () => {
  const month = (id: number) => ({ ...person(id, { user_id: id }), month: "2026-11-01", department_id: null, department_name: "Institute-wide", titles: ["Institute-wide"], publication_count: 4 });

  it("starts the strip with the Researcher of the Month, then everyone else once, and steps manually", async () => {
    api.getResearchersOfTheMonth.mockResolvedValue({ data: { month: "2026-11-01", results: [month(3)] } });
    api.getAcknowledgers.mockResolvedValue({ data: { results: [
      person(3, { user_id: 3, publication_count: 4 }), person(7, { user_id: 7, publication_count: 2 }), person(8, { user_id: 8, publication_count: 1 })] } });
    render(<MemoryRouter><ResearcherSpotlight /></MemoryRouter>);
    const list = await screen.findByRole("region", { name: "Researchers acknowledging IIC" });
    const rows = within(list).getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain("Researcher of the Month");
    expect(rows[0]).toContain("Researcher 3");
    expect(rows[1]).toContain("Researcher 7");
    expect(rows[1]).toContain("2 publications");
    expect(rows[2]).toContain("1 publication");
    const track = screen.getByTestId("acknowledgers-track");
    expect(track.className).toContain("flex");  // one horizontal row, never a growing column
    fireEvent.click(screen.getByRole("button", { name: "Next name in the list" }));
    expect(track.getAttribute("data-index")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Previous name in the list" }));
    expect(track.getAttribute("data-index")).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Previous name in the list" }));
    expect(track.getAttribute("data-index")).toBe("2");  // from the first, back to the last
  });

  it("moves on about once a second, pauses 2 s on the Researcher of the Month, and loops even with one other name", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      api.getResearchersOfTheMonth.mockResolvedValue({ data: { month: "2026-11-01", results: [month(3)] } });
      api.getAcknowledgers.mockResolvedValue({ data: { results: [person(3, { user_id: 3 }), person(7, { user_id: 7 })] } });
      render(<MemoryRouter><ResearcherSpotlight /></MemoryRouter>);
      const track = await screen.findByTestId("acknowledgers-track");
      expect(track.getAttribute("data-index")).toBe("0");  // Researcher of the Month at the front
      await act(async () => { vi.advanceTimersByTime(2500); });
      expect(track.getAttribute("data-index")).toBe("0");  // still holding on them
      await act(async () => { vi.advanceTimersByTime(300); });
      expect(track.getAttribute("data-index")).toBe("1");  // after ~2.7 s: next name
      await act(async () => { vi.advanceTimersByTime(1050); });
      expect(track.getAttribute("data-index")).toBe("2");  // ~1 s later: onto the copy of the first...
      await act(async () => { vi.advanceTimersByTime(750); });
      expect(track.getAttribute("data-index")).toBe("0");  // ...back to the real first one, unseen
      await act(async () => { vi.advanceTimersByTime(1500); });
      expect(track.getAttribute("data-index")).toBe("0");  // pausing 2 s on the Researcher of the Month again
      await act(async () => { vi.advanceTimersByTime(600); });
      expect(track.getAttribute("data-index")).toBe("1");
      fireEvent.mouseEnter(track.parentElement as HTMLElement);
      await act(async () => { vi.advanceTimersByTime(9000); });
      expect(track.getAttribute("data-index")).toBe("1");  // paused while hovered
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the list alone when nobody is chosen this month", async () => {
    api.getResearchersOfTheMonth.mockResolvedValue({ data: { month: "2026-11-01", results: [] } });
    api.getAcknowledgers.mockResolvedValue({ data: { results: [person(9, { user_id: 9, publication_count: 1 })] } });
    render(<MemoryRouter><ResearcherSpotlight /></MemoryRouter>);
    expect(await screen.findByTestId("acknowledgers-only")).toBeTruthy();
    expect(screen.getByText("Researcher 9")).toBeTruthy();
  });
});
