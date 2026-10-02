// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ALTERNATE_ASK_HELP, ALTERNATE_AUTO_HELP, BookingFallbackOptions } from "./BookingFallbackOptions";
import { SLOT_FALLBACK_LABELS, flagsForFallback, slotFallbackFrom, type SlotFallback } from "@/lib/slotOptions";

afterEach(cleanup);

const ALL: SlotFallback[] = ["none", "any_slots", "any_slots_or_one"];

/** Mirrors the booking page: the same state, and the same fields it sends with the booking request. */
function Harness({
  alternate = true,
  choices = ALL,
  waitlist = false,
  onSubmit,
}: {
  alternate?: boolean;
  choices?: SlotFallback[];
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
        choices={choices}
        value={slotFallbackFrom({ bookAny, single })}
        onChange={(v) => {
          const f = flagsForFallback(v);
          setBookAny(f.bookAny);
          setSingle(f.single);
        }}
        alternate={{ show: alternate, checked: autoAllocate, onChange: setAutoAllocate }}
        waitlist={{ show: waitlist, checked: waitlistMode, onChange: setWaitlistMode }}
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

const radio = (name: string) => screen.getByRole("radio", { name });

describe("BookingFallbackOptions", () => {
  it("asks one question with mutually exclusive choices, defaulting to 'Let me choose again'", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const group = screen.getByRole("radiogroup", { name: "If your slots are taken:" });
    expect(group).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(radio("Let me choose again").getAttribute("aria-checked")).toBe("true");
    expect(radio("Any free slots this week").id).toBe("slot-fallback-any_slots");
    // The old overlapping labels are gone, and explanations sit behind the info buttons.
    expect(screen.queryByText("Pick any free slots in this window")).toBeNull();
    expect(screen.queryByText("Accept a single slot")).toBeNull();
    expect(screen.queryByText(SLOT_FALLBACK_LABELS.any_slots.help)).toBeNull();
    expect(screen.queryByText(ALTERNATE_ASK_HELP)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onSubmit).toHaveBeenLastCalledWith({
      auto_allocate_alternative: false,
      waitlist: false,
      book_any_available_slots: false,
      book_even_if_single_slot_available: false,
    });
  });

  it("maps each choice onto the booking flags, one at a time", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const confirm = () => fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    fireEvent.click(radio("Any free slots, or just one"));
    expect(radio("Any free slots, or just one").getAttribute("aria-checked")).toBe("true");
    expect(radio("Any free slots this week").getAttribute("aria-checked")).toBe("false");
    confirm();
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ book_any_available_slots: true, book_even_if_single_slot_available: true }),
    );

    fireEvent.click(radio("Any free slots this week"));
    confirm();
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ book_any_available_slots: true, book_even_if_single_slot_available: false }),
    );

    fireEvent.click(radio("Let me choose again"));
    confirm();
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ book_any_available_slots: false, book_even_if_single_slot_available: false }),
    );
  });

  it("keeps alternate equipment as an independent extra", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Try alternate equipment" }));
    fireEvent.click(radio("Any free slots this week"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onSubmit).toHaveBeenLastCalledWith({
      auto_allocate_alternative: true,
      waitlist: false,
      book_any_available_slots: true,
      book_even_if_single_slot_available: false,
    });
    expect(screen.getByRole("checkbox", { name: "Try alternate equipment" }).id).toBe("auto-allocate-alternative");
  });

  it("hides the question when nothing but 'Let me choose again' applies, and renders nothing when no extra applies", () => {
    const { rerender } = render(<Harness choices={["none"]} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Try alternate equipment" })).toBeTruthy();
    rerender(<Harness alternate={false} choices={["none"]} onSubmit={vi.fn()} />);
    expect(screen.queryByTestId("booking-fallback-options")).toBeNull();
    rerender(<Harness alternate={false} choices={["none"]} waitlist onSubmit={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: "Join the waitlist" })).toBeTruthy();
  });

  it("offers a template's preferred-slot fallback when it is passed in", () => {
    render(<Harness choices={["none", "same_day", "any_slots"]} onSubmit={vi.fn()} />);
    expect(radio("Next free time, same day")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Next free time, any day" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Any free slots, or just one" })).toBeNull();
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
