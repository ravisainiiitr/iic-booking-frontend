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

  it("with one researcher, the arrows page through their publications", async () => {
    const pubs = [1, 2, 3].map((n) => ({ title: `Work ${n}`, journal: "J", year: 2026, url: "", facility: "" }));
    api.getResearchersOfTheMonth.mockResolvedValue(
      month([{ ...person(3, { publication_count: 3 }), month: "2026-11-01", department_id: null, department_name: "Institute-wide",
               publications: pubs }]),
    );
    render(<MemoryRouter><ResearcherSpotlight /></MemoryRouter>);
    const card = await screen.findByTestId("researcher-spotlight");
    expect(within(card).getByText("Work 1")).toBeTruthy();
    expect(within(card).getByText("Publication 1 of 3")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Next publication" }));
    expect(within(card).getByText("Work 2")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Previous publication" }));
    fireEvent.click(within(card).getByRole("button", { name: "Previous publication" }));
    expect(within(card).getByText("Work 3")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Show publication 1 of 3" }));
    expect(within(card).getByText("Work 1")).toBeTruthy();
    expect(within(card).queryByRole("button", { name: "Next researcher" })).toBeNull();
  });

  it("moves on by itself after a pause, and not while hovered", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      api.getResearchersOfTheMonth.mockResolvedValue(
        month([
          { ...person(3), month: "2026-11-01", department_id: null, department_name: "Institute-wide" },
          { ...person(4), month: "2026-11-01", department_id: 7, department_name: "Chemistry" },
        ]),
      );
      render(<MemoryRouter><ResearcherSpotlight /></MemoryRouter>);
      const card = await screen.findByTestId("researcher-spotlight");
      expect(within(card).getByRole("heading", { name: "Researcher 3" })).toBeTruthy();
      await act(async () => { vi.advanceTimersByTime(7100); });
      expect(within(card).getByRole("heading", { name: "Researcher 4" })).toBeTruthy();
      fireEvent.mouseEnter(card);
      await act(async () => { vi.advanceTimersByTime(15000); });
      expect(within(card).getByRole("heading", { name: "Researcher 4" })).toBeTruthy();
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

  it("lists everyone approved under the Researcher of the Month, without repeating them, and steps manually", async () => {
    api.getResearchersOfTheMonth.mockResolvedValue({ data: { month: "2026-11-01", results: [month(3)] } });
    api.getAcknowledgers.mockResolvedValue({ data: { results: [
      person(3, { user_id: 3, publication_count: 4 }), person(7, { user_id: 7, publication_count: 2 }), person(8, { user_id: 8, publication_count: 1 })] } });
    render(<MemoryRouter><ResearcherSpotlight /></MemoryRouter>);
    const list = await screen.findByRole("region", { name: "Researchers acknowledging IIC" });
    const rows = within(list).getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("Researcher 7");
    expect(rows[0]).toContain("2 publications");
    expect(rows[1]).toContain("1 publication");
    expect(screen.getByRole("heading", { name: "Researcher 3" })).toBeTruthy();  // the month's card stays on top
    const track = screen.getByTestId("acknowledgers-track");
    expect(track.className).toContain("flex");  // one horizontal row, never a growing column
    fireEvent.click(screen.getByRole("button", { name: "Next name in the list" }));
    expect(track.getAttribute("data-index")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Previous name in the list" }));
    expect(track.getAttribute("data-index")).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Previous name in the list" }));
    expect(track.getAttribute("data-index")).toBe("1");  // from the first, back to the last
  });

  it("slides one name along each second-long move, holds two seconds, and loops", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      api.getResearchersOfTheMonth.mockResolvedValue({ data: { month: "2026-11-01", results: [month(3)] } });
      api.getAcknowledgers.mockResolvedValue({ data: { results: [
        person(7, { user_id: 7 }), person(8, { user_id: 8 })] } });
      render(<MemoryRouter><ResearcherSpotlight /></MemoryRouter>);
      const track = await screen.findByTestId("acknowledgers-track");
      expect(track.getAttribute("data-index")).toBe("0");
      expect(track.style.transition).toContain("1000ms");
      await act(async () => { vi.advanceTimersByTime(3050); });
      expect(track.getAttribute("data-index")).toBe("1");
      await act(async () => { vi.advanceTimersByTime(3050); });
      expect(track.getAttribute("data-index")).toBe("2");  // onto the copy of the first name...
      await act(async () => { vi.advanceTimersByTime(1100); });
      expect(track.getAttribute("data-index")).toBe("0");  // ...then back to the real first one, unseen
      fireEvent.mouseEnter(track.parentElement as HTMLElement);
      await act(async () => { vi.advanceTimersByTime(9000); });
      expect(track.getAttribute("data-index")).toBe("0");  // paused while hovered
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
