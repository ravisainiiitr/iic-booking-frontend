// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ANY_SLOTS_HELP, ALTERNATE_ASK_HELP, ALTERNATE_AUTO_HELP, BookingFallbackOptions } from "./BookingFallbackOptions";

afterEach(cleanup);

/** Mirrors the booking page: same state, and the same fields it sends with the booking request. */
function Harness({ alternate = true, anySlots = true, waitlist = false, onSubmit }: {
  alternate?: boolean;
  anySlots?: boolean;
  waitlist?: boolean;
  onSubmit: (payload: Record<string, boolean>) => void;
}) {
  const [autoAllocate, setAutoAllocate] = useState(false);
  const [waitlistMode, setWaitlistMode] = useState(false);
  const [bookAny, setBookAny] = useState(false);
  const [single, setSingle] = useState(false);
  return (
    <>
      <BookingFallbackOptions
        alternate={{ show: alternate, checked: autoAllocate, onChange: setAutoAllocate }}
        waitlist={{ show: waitlist, checked: waitlistMode, onChange: setWaitlistMode }}
        anySlots={{ show: anySlots, checked: bookAny, onChange: setBookAny }}
        singleSlot={{ show: true, checked: single, onChange: setSingle }}
      />
      <button
        type="button"
        onClick={() =>
          onSubmit({
            auto_allocate_alternative: autoAllocate,
            waitlist: waitlistMode,
            book_any_available_slots: bookAny,
            book_even_if_single_slot_available: single,
          })
        }
      >
        Confirm
      </button>
    </>
  );
}

describe("BookingFallbackOptions", () => {
  it("shows one compact row with short labels and both options off by default", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    expect(screen.getByRole("group", { name: "If your slots aren't free:" })).toBeTruthy();
    const alt = screen.getByRole("checkbox", { name: "Try alternate equipment" });
    const any = screen.getByRole("checkbox", { name: "Pick any free slots in this window" });
    expect(alt.getAttribute("aria-checked")).toBe("false");
    expect(any.getAttribute("aria-checked")).toBe("false");
    expect(alt.id).toBe("auto-allocate-alternative");
    expect(any.id).toBe("book-any-available-slots");
    // Long explanations are behind the info buttons, not on the page.
    expect(screen.queryByText(ANY_SLOTS_HELP)).toBeNull();
    expect(screen.queryByText(ALTERNATE_ASK_HELP)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onSubmit).toHaveBeenLastCalledWith({
      auto_allocate_alternative: false,
      waitlist: false,
      book_any_available_slots: false,
      book_even_if_single_slot_available: false,
    });
  });

  it("keeps the options independent and submits the chosen values", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Try alternate equipment" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Pick any free slots in this window" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Accept a single slot" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onSubmit).toHaveBeenLastCalledWith({
      auto_allocate_alternative: true,
      waitlist: false,
      book_any_available_slots: true,
      book_even_if_single_slot_available: true,
    });
  });

  it("offers the single-slot fallback only with 'any free slots', and clears it when that is unticked", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    expect(screen.queryByRole("checkbox", { name: "Accept a single slot" })).toBeNull();
    const any = screen.getByRole("checkbox", { name: "Pick any free slots in this window" });
    fireEvent.click(any);
    fireEvent.click(screen.getByRole("checkbox", { name: "Accept a single slot" }));
    fireEvent.click(any);
    expect(screen.queryByRole("checkbox", { name: "Accept a single slot" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ book_any_available_slots: false, book_even_if_single_slot_available: false }),
    );
  });

  it("hides options that do not apply and renders nothing when none apply", () => {
    const { rerender } = render(<Harness alternate={false} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("checkbox", { name: "Try alternate equipment" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Pick any free slots in this window" })).toBeTruthy();
    rerender(<Harness alternate={false} anySlots={false} onSubmit={vi.fn()} />);
    expect(screen.queryByTestId("booking-fallback-options")).toBeNull();
    rerender(<Harness alternate={false} anySlots={false} waitlist onSubmit={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: "Waitlisted booking" })).toBeTruthy();
  });

  it("opens the explanation from the info button, matching the alternate-equipment setting", () => {
    render(<Harness onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "About alternate equipment" }));
    expect(screen.getByText(ALTERNATE_ASK_HELP)).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Try alternate equipment" }));
    fireEvent.click(screen.getByRole("button", { name: "About alternate equipment" }));
    expect(screen.getByText(ALTERNATE_AUTO_HELP)).toBeTruthy();
  });
});
