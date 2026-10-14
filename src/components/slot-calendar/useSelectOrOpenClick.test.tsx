// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SELECT_CLICK_DELAY_MS, useSelectOrOpenClick } from "./useSelectOrOpenClick";

const onSelect = vi.fn();
const onOpen = vi.fn();
const onPress = vi.fn();
let ignore = false;

function Dates() {
  const bind = useSelectOrOpenClick<string>({ onSelect, onOpen, onPress, shouldIgnoreClick: () => ignore });
  return (
    <>
      {["2026-10-21", "2026-10-22"].map((d) => (
        <button key={d} type="button" {...bind(d)}>
          {d}
        </button>
      ))}
    </>
  );
}

const date = (d: string) => screen.getByRole("button", { name: d });
const wait = () => act(() => vi.advanceTimersByTime(SELECT_CLICK_DELAY_MS + 10));

beforeEach(() => {
  vi.useFakeTimers();
  onSelect.mockReset();
  onOpen.mockReset();
  onPress.mockReset();
  ignore = false;
  render(<Dates />);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useSelectOrOpenClick", () => {
  it("selects on a single click without opening", () => {
    fireEvent.click(date("2026-10-21"), { detail: 1 });
    expect(onSelect).not.toHaveBeenCalled();
    wait();
    expect(onSelect).toHaveBeenCalledWith("2026-10-21");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("opens on a double click and does not select", () => {
    fireEvent.click(date("2026-10-21"), { detail: 1 });
    fireEvent.click(date("2026-10-21"), { detail: 2 });
    fireEvent.doubleClick(date("2026-10-21"), { detail: 2 });
    wait();
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("2026-10-21");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("opens on a double tap that the browser reports as two single clicks", () => {
    fireEvent.click(date("2026-10-22"), { detail: 1 });
    fireEvent.click(date("2026-10-22"), { detail: 1 });
    wait();
    expect(onOpen).toHaveBeenCalledWith("2026-10-22");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps the first date when another date is clicked quickly", () => {
    fireEvent.click(date("2026-10-21"), { detail: 1 });
    fireEvent.click(date("2026-10-22"), { detail: 1 });
    wait();
    expect(onSelect.mock.calls).toEqual([["2026-10-21"], ["2026-10-22"]]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("opens with Enter and selects with keyboard activation", () => {
    fireEvent.keyDown(date("2026-10-21"), { key: "Enter" });
    expect(onOpen).toHaveBeenCalledWith("2026-10-21");
    fireEvent.click(date("2026-10-22"), { detail: 0 });
    expect(onSelect).toHaveBeenCalledWith("2026-10-22");
  });

  it("ignores the click that ends a drag", () => {
    ignore = true;
    fireEvent.click(date("2026-10-21"), { detail: 1 });
    wait();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it("runs onPress at once on the first click, before the select pause", () => {
    fireEvent.click(date("2026-10-21"), { detail: 1 });
    expect(onPress).toHaveBeenCalledWith("2026-10-21");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("runs onPress before onOpen on a double click or double tap, and only once", () => {
    const order: string[] = [];
    onPress.mockImplementation(() => order.push("press"));
    onOpen.mockImplementation(() => order.push("open"));
    fireEvent.click(date("2026-10-21"), { detail: 1 });
    fireEvent.click(date("2026-10-21"), { detail: 2 });
    fireEvent.click(date("2026-10-22"), { detail: 1 });
    fireEvent.click(date("2026-10-22"), { detail: 1 });
    wait();
    expect(order).toEqual(["press", "open", "press", "open"]);
  });

  it("runs onPress on Space but not on Enter", () => {
    fireEvent.keyDown(date("2026-10-21"), { key: "Enter" });
    expect(onPress).not.toHaveBeenCalled();
    fireEvent.click(date("2026-10-22"), { detail: 0 });
    expect(onPress).toHaveBeenCalledWith("2026-10-22");
  });
});
