// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SimilarInstrumentsCard } from "./SimilarInstrumentsCard";
import { BookingStepIndicator } from "./BookingStepIndicator";

const api = vi.hoisted(() => ({ getSimilarAvailability: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

const row = (id: number, name: string, date: string | null) => ({
  id,
  name,
  code: `C${id}`,
  category: "X-ray diffraction",
  department: "IIC",
  location: "Lab 2",
  earliest: date ? { slot_id: id, date, start: `${date}T10:00:00+05:30`, end: `${date}T11:00:00+05:30` } : null,
});

afterEach(() => {
  cleanup();
  api.getSimilarAvailability.mockReset();
});

describe("SimilarInstrumentsCard", () => {
  it("offers the next week here and sooner similar instruments", async () => {
    api.getSimilarAvailability.mockResolvedValue({
      data: { equipment: row(1, "PXRD A", "2026-10-21"), alternatives: [row(2, "PXRD C", "2026-10-15")], basis: "category" },
    });
    const onGoToWeek = vi.fn();
    const onOpen = vi.fn();
    render(
      <SimilarInstrumentsCard equipmentId={1} weekKey="2026-10-12_2026-10-18" onGoToWeek={onGoToWeek} onOpenInstrument={onOpen} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Go to that week" }));
    expect(onGoToWeek).toHaveBeenCalledWith("2026-10-21");
    expect(screen.getByText("Other X-ray diffraction instruments")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Book this instead" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 2, name: "PXRD C" }));
  });

  it("stays hidden when there is nothing else to suggest", async () => {
    api.getSimilarAvailability.mockResolvedValue({
      data: { equipment: row(1, "PXRD A", null), alternatives: [], basis: "group" },
    });
    const { container } = render(
      <SimilarInstrumentsCard equipmentId={1} weekKey="2026-10-12_2026-10-18" onGoToWeek={vi.fn()} onOpenInstrument={vi.fn()} />,
    );
    await vi.waitFor(() => expect(api.getSimilarAvailability).toHaveBeenCalledWith(1));
    await Promise.resolve();
    expect(container.querySelector('[data-testid="similar-instruments"]')).toBeNull();
  });
});

describe("SimilarInstrumentsCard errors", () => {
  it("renders nothing when the request fails", async () => {
    api.getSimilarAvailability.mockResolvedValue({ error: "Equipment not found.", status: 404, data: { error: "Equipment not found." } });
    const { container } = render(
      <SimilarInstrumentsCard equipmentId={9} weekKey="2026-10-12_2026-10-18" onGoToWeek={vi.fn()} onOpenInstrument={vi.fn()} />,
    );
    await vi.waitFor(() => expect(api.getSimilarAvailability).toHaveBeenCalledWith(9));
    await Promise.resolve();
    expect(container.querySelector('[data-testid="similar-instruments"]')).toBeNull();
  });
});

describe("BookingStepIndicator", () => {
  it("lets the user jump back to reached steps only", () => {
    const onStepClick = vi.fn();
    render(<BookingStepIndicator current={2} onStepClick={onStepClick} />);
    fireEvent.click(screen.getByRole("button", { name: /Sample info/ }));
    expect(onStepClick).toHaveBeenCalledWith(0);
    expect(screen.getByRole("button", { name: /Slots/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
  });
});
