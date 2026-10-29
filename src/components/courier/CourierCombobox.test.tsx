// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));

import { CourierCombobox } from "./CourierCombobox";
import { filterCouriers, resetCouriersCache, useCouriers } from "./courierHelpers";

const COURIERS = [
  { slug: "bluedart", name: "Blue Dart" },
  { slug: "delhivery", name: "Delhivery" },
  { slug: "dtdc", name: "DTDC" },
  { slug: "indiapost", name: "India Post" },
  { slug: "speedpost", name: "Speed Post" },
  { slug: "indiapostinternational", name: "India Post International" },
  { slug: "shreemaruti", name: "Shree Maruti" },
  { slug: "registeredpost", name: "Registered Post" },
  { slug: "xpressbees", name: "XpressBees" },
  { slug: "professional", name: "Professional Courier" },
];

beforeAll(() => {
  // jsdom lacks these browser APIs used by Radix Popover and cmdk.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  resetCouriersCache();
  vi.unstubAllGlobals();
});

function Harness(props: { couriers?: typeof COURIERS; loading?: boolean; error?: boolean; onRetry?: () => void; spy?: (s: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div>
      <span id="label">Courier</span>
      <CourierCombobox
        id="courier"
        labelId="label"
        value={value}
        onChange={(slug) => {
          props.spy?.(slug);
          setValue(slug);
        }}
        couriers={props.couriers ?? COURIERS}
        loading={props.loading}
        error={props.error}
        onRetry={props.onRetry}
      />
      <output data-testid="value">{value}</output>
    </div>
  );
}

const names = (list: { name: string }[]) => list.map((c) => c.name);

describe("filterCouriers", () => {
  it("matches partial names case-insensitively, best matches first", () => {
    expect(names(filterCouriers(COURIERS, "blue"))).toEqual(["Blue Dart"]);
    expect(names(filterCouriers(COURIERS, "BLUE"))).toEqual(["Blue Dart"]);
    expect(names(filterCouriers(COURIERS, "DTDC"))).toEqual(["DTDC"]);
    expect(names(filterCouriers(COURIERS, "speed"))).toEqual(["Speed Post"]);
    expect(names(filterCouriers(COURIERS, "international"))).toEqual(["India Post International"]);
    expect(names(filterCouriers(COURIERS, "maruti"))).toEqual(["Shree Maruti"]);
    expect(names(filterCouriers(COURIERS, "india"))).toEqual(["India Post", "India Post International"]);
  });

  it("matches API slugs and ignores spaces in compact searches", () => {
    expect(names(filterCouriers(COURIERS, "indiapostinternational"))).toEqual(["India Post International"]);
    expect(names(filterCouriers(COURIERS, "blue dart"))).toEqual(["Blue Dart"]);
    expect(names(filterCouriers(COURIERS, "shreemaruti"))).toEqual(["Shree Maruti"]);
  });

  it("returns nothing for unknown text and everything for an empty search", () => {
    expect(filterCouriers(COURIERS, "zzz")).toEqual([]);
    expect(filterCouriers(COURIERS, "  ")).toHaveLength(COURIERS.length);
  });
});

describe("CourierCombobox", () => {
  it("filters as the user types and selects with the mouse, storing the slug", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search courier name..."), "blue");
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Blue Dart"]);
    await user.click(options[0]);
    expect(spy).toHaveBeenCalledWith("bluedart");
    expect(screen.getByTestId("value").textContent).toBe("bluedart");
    expect(screen.getByRole("combobox").textContent).toContain("Blue Dart");
  });

  it("is keyboard operable: open, arrows, Enter selects, Escape closes", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await user.keyboard("india");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(spy).toHaveBeenCalledWith("indiapostinternational");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // While open, cmdk's search input is a combobox too: keep using the trigger reference.
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("combobox", { name: "Search courier name" })).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
  });

  it("supports touch selection", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await user.pointer({ keys: "[TouchA]", target: screen.getByRole("combobox") });
    const option = await screen.findByRole("option", { name: "DTDC" });
    await user.pointer({ keys: "[TouchA]", target: option });
    expect(spy).toHaveBeenCalledWith("dtdc");
  });

  it("shows a helpful message when nothing matches and never accepts free text", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search courier name..."), "my local courier");
    expect(screen.getByText("No matching courier found. Try a different name.")).toBeTruthy();
    await user.keyboard("{Enter}");
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByTestId("value").textContent).toBe("");
  });

  it("can clear the selection", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Delhivery" }));
    await user.click(screen.getByRole("button", { name: "Clear courier Delhivery" }));
    expect(screen.getByTestId("value").textContent).toBe("");
    expect(screen.getByRole("combobox").textContent).toContain("Select a courier");
  });

  it("shows loading and error states with a retry", async () => {
    const { rerender } = render(<Harness loading />);
    expect(screen.getByRole("combobox").textContent).toContain("Loading couriers");
    expect((screen.getByRole("combobox") as HTMLButtonElement).disabled).toBe(true);
    const retry = vi.fn();
    rerender(<Harness error onRetry={retry} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("could not be loaded");
    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }));
    expect(retry).toHaveBeenCalled();
  });

  it("stays usable with a long list and on narrow screens", async () => {
    const user = userEvent.setup();
    const many = [...COURIERS, ...Array.from({ length: 400 }, (_, i) => ({ slug: `c${i}`, name: `Regional Courier ${i}` }))];
    render(<Harness couriers={many} />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search courier name..."), "blue");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    const list = screen.getByRole("listbox");
    expect(list.className).toContain("max-h-");
    expect(list.className).toContain("overscroll-contain");
    const content = list.closest("[data-radix-popper-content-wrapper] > *") ?? list.parentElement?.parentElement;
    expect(content?.className ?? "").toContain("max-w-[calc(100vw-1.5rem)]");
  });
});

describe("useCouriers", () => {
  it("fetches the list once however often selectors render", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ couriers: COURIERS, count: COURIERS.length, fresh: true })));
    vi.stubGlobal("fetch", fetchMock);
    const first = renderHook(() => useCouriers());
    await waitFor(() => expect(first.result.current.couriers).toHaveLength(COURIERS.length));
    first.rerender();
    first.rerender();
    const second = renderHook(() => useCouriers());
    await waitFor(() => expect(second.result.current.couriers).toHaveLength(COURIERS.length));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("makes no request when disabled and reports a failed load for retry", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "down" }), { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const off = renderHook(() => useCouriers(false));
    expect(off.result.current.loading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    const on = renderHook(() => useCouriers());
    await waitFor(() => expect(on.result.current.error).toBe(true));
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ couriers: COURIERS, count: 10, fresh: true })));
    act(() => on.result.current.retry());
    await waitFor(() => expect(on.result.current.couriers).toHaveLength(COURIERS.length));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
