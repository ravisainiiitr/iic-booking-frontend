// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  SLOT_HOVER_CONTENT_CLASS,
  SLOT_HOVER_CONTENT_PROPS,
  SLOT_HOVER_OPEN_DELAY_MS,
  SlotHoverCard,
} from "./SlotHoverCard";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const LINES = [
  "Booking ID: IICPXRD [A]202600001",
  "User: Saurabh Kumar",
  "Department: Hydrology Department",
  "Status: Completed",
  "Slot: 10:00 – 10:30",
  "Equipment: Powder X-Ray Diffractometer (PXRD) [A]",
];

function renderInScrollBox(onClick = vi.fn()) {
  render(
    <div data-testid="scroll-box" style={{ overflow: "auto" }}>
      <SlotHoverCard lines={LINES}>
        <button type="button" onClick={onClick}>
          Completed
        </button>
      </SlotHoverCard>
    </div>,
  );
  return onClick;
}

function hoverCard(): HTMLElement | null {
  return document.body.querySelector("[data-slot-hover-card]");
}

describe("SlotHoverCard", () => {
  it("renders the card outside the calendar's scroll box so it can't be clipped", () => {
    renderInScrollBox();
    fireEvent.focus(screen.getByRole("button", { name: "Completed" }));
    const card = hoverCard();
    expect(card).not.toBeNull();
    expect(screen.getByTestId("scroll-box").contains(card)).toBe(false);
    for (const line of LINES) expect(card?.textContent).toContain(line);
  });

  it("keeps the card inside the screen and above headers, wrapping long names", () => {
    expect(SLOT_HOVER_CONTENT_PROPS).toMatchObject({
      avoidCollisions: true,
      collisionPadding: 8,
      sticky: "always",
      hideWhenDetached: true,
    });
    expect(SLOT_HOVER_CONTENT_CLASS).toContain("z-[120]");
    expect(SLOT_HOVER_CONTENT_CLASS).toContain("max-w-[min(20rem,calc(100vw-1rem))]");
    expect(SLOT_HOVER_CONTENT_CLASS).toContain("whitespace-normal");
    expect(SLOT_HOVER_CONTENT_CLASS).toContain("bg-popover");
    expect(SLOT_HOVER_CONTENT_CLASS).toContain("text-popover-foreground");
    expect(SLOT_HOVER_CONTENT_CLASS).not.toContain("whitespace-nowrap");
  });

  it("opens after a short hover delay and closes when the pointer leaves", () => {
    vi.useFakeTimers();
    renderInScrollBox();
    const cell = screen.getByRole("button", { name: "Completed" });
    fireEvent.pointerMove(cell, { pointerType: "mouse" });
    expect(hoverCard()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(SLOT_HOVER_OPEN_DELAY_MS + 10);
    });
    expect(hoverCard()).not.toBeNull();
    fireEvent.pointerLeave(cell, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(hoverCard()).toBeNull();
  });

  it("does not open on touch and still lets a tap reach the cell", () => {
    vi.useFakeTimers();
    const onClick = renderInScrollBox();
    const cell = screen.getByRole("button", { name: "Completed" });
    fireEvent.pointerMove(cell, { pointerType: "touch" });
    fireEvent.pointerDown(cell, { pointerType: "touch" });
    fireEvent.click(cell);
    act(() => {
      vi.advanceTimersByTime(SLOT_HOVER_OPEN_DELAY_MS + 10);
    });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(hoverCard()).toBeNull();
  });

  it("renders the cell alone when there is nothing to show", () => {
    render(
      <SlotHoverCard lines={[]}>
        <button type="button">Available</button>
      </SlotHoverCard>,
    );
    fireEvent.focus(screen.getByRole("button", { name: "Available" }));
    expect(hoverCard()).toBeNull();
  });
});
