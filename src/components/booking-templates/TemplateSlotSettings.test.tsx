// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TemplateSlotSettings } from "./TemplateSlotSettings";
import { draftToBody, emptyPreferredSlotDraft, type PreferredSlotDraft } from "@/lib/templatePreferredSlot";

afterEach(cleanup);

const ROWS = [
  { key: "09:00", start: 540, end: 630, label: "09:00 – 10:30", timeRange: "09:00 – 10:30" },
  { key: "10:30", start: 630, end: 720, label: "10:30 – 12:00", timeRange: "10:30 – 12:00" },
];

/** Mirrors the template editor: the same state, and the same fields it saves. */
function Harness({
  initialAuto = false,
  initialDraft = emptyPreferredSlotDraft(),
  allowAnySlots = true,
  onSave,
}: {
  initialAuto?: boolean;
  initialDraft?: PreferredSlotDraft;
  allowAnySlots?: boolean;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const [auto, setAuto] = useState(initialAuto);
  const [draft, setDraft] = useState(initialDraft);
  const [bookAny, setBookAny] = useState(false);
  const [single, setSingle] = useState(false);
  const [waitlist, setWaitlist] = useState(true);
  return (
    <>
      <TemplateSlotSettings
        autoSlotSelection={auto}
        onAutoSlotSelectionChange={setAuto}
        draft={draft}
        onDraftChange={setDraft}
        bookAny={bookAny}
        single={single}
        onFallbackFlagsChange={(f) => {
          setBookAny(f.bookAny);
          setSingle(f.single);
        }}
        allowAnySlots={allowAnySlots}
        alternate={{ show: false, checked: false, onChange: () => undefined }}
        waitlist={{ show: true, checked: waitlist, onChange: setWaitlist }}
        picker={{ slotRows: ROWS, slotsRequired: 1 }}
      />
      <button
        type="button"
        onClick={() =>
          onSave({
            auto_slot_selection: auto && !draft.enabled,
            book_any_available_slots: bookAny,
            book_even_if_single_slot_available: bookAny && single,
            waitlist_on_failure: waitlist,
            ...draftToBody(draft),
          })
        }
      >
        Save
      </button>
    </>
  );
}

const radio = (name: string) => screen.getByRole("radio", { name });
const checked = (name: string) => radio(name).getAttribute("aria-checked") === "true";

describe("TemplateSlotSettings", () => {
  it("shows each question once: how slots are chosen, and what happens if they are taken", () => {
    render(<Harness onSave={vi.fn()} />);
    expect(screen.getByRole("radiogroup", { name: "Choose slots:" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "If your slots are taken:" })).toBeTruthy();
    expect(screen.getAllByText("If your slots are taken:")).toHaveLength(1);
    expect(screen.queryByText("If this slot is already taken when I click Book")).toBeNull();
    expect(screen.queryByText("Auto-select all required slots")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Join the waitlist if nothing is booked" })).toBeTruthy();
  });

  it("makes auto-select and the preferred slot mutually exclusive", () => {
    const onSave = vi.fn();
    render(<Harness initialAuto onSave={onSave} />);
    expect(checked("Auto-select")).toBe(true);
    expect(screen.queryByTestId("template-preferred-slot")).toBeNull();

    fireEvent.click(radio("My preferred slot"));
    expect(checked("My preferred slot")).toBe(true);
    expect(checked("Auto-select")).toBe(false);
    expect(screen.getByTestId("template-preferred-slot")).toBeTruthy();

    fireEvent.click(radio("Auto-select"));
    expect(screen.queryByTestId("template-preferred-slot")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ auto_slot_selection: true, preferred_slot: null, if_slot_taken: "ask" }),
    );
  });

  it("offers the preferred-slot fallbacks only with a preferred slot, and asks for consent", () => {
    const onSave = vi.fn();
    render(
      <Harness initialDraft={{ ...emptyPreferredSlotDraft(), enabled: true, weekday: 3, startTime: "09:00" }} onSave={onSave} />,
    );
    expect(screen.getAllByRole("radio", { name: /Next free time/ })).toHaveLength(2);
    fireEvent.click(radio("Next free time, same day"));
    const consent = screen.getByRole("checkbox", { name: /I agree the portal may book the next free time later the same day/ });
    fireEvent.click(consent);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        book_any_available_slots: false,
        if_slot_taken: "next_available_same_day",
        auto_book_consent: true,
      }),
    );

    // Switching to "any free slots" replaces the preferred-slot fallback (never both).
    fireEvent.click(radio("Any free slots this week"));
    expect(checked("Next free time, same day")).toBe(false);
    expect(screen.queryByRole("checkbox", { name: /I agree/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ book_any_available_slots: true, if_slot_taken: "ask" }),
    );

    // Leaving the preferred slot drops its fallbacks.
    fireEvent.click(radio("Next free time, any day"));
    fireEvent.click(radio("I'll pick"));
    expect(screen.queryByRole("radio", { name: /Next free time/ })).toBeNull();
    expect(checked("Let me choose again")).toBe(true);
  });

  it("hides 'any free slots' where it does not apply (external users)", () => {
    render(<Harness allowAnySlots={false} onSave={vi.fn()} />);
    expect(screen.queryByRole("radiogroup", { name: "If your slots are taken:" })).toBeNull();
    fireEvent.click(radio("My preferred slot"));
    expect(screen.getAllByRole("radio", { name: /Next free time|Let me choose again/ })).toHaveLength(3);
    expect(screen.queryByRole("radio", { name: /Any free slots/ })).toBeNull();
  });
});
