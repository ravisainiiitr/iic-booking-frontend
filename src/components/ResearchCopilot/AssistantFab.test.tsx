// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 7 }, isAuthenticated: true, loading: false }),
}));
vi.mock("sonner", () => ({ toast: vi.fn() }));

import { toast } from "sonner";
import { AssistantFab } from "./AssistantFab";
import {
  FAB_STORAGE_PREFIX,
  clampFabPosition,
  panelBottomFor,
  resetAssistantFabStore,
  showAssistantFab,
  snapFabPosition,
} from "./assistantFabStore";
import { FLOATING_CLEARANCE_ATTR, measureFloatingClearance } from "./floatingLayout";

const KEY = `${FAB_STORAGE_PREFIX}u7`;
const LABEL = "Open Booking Assistant";

const setViewport = (w: number, h: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: h });
};

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;

beforeAll(() => {
  if (typeof window.PointerEvent !== "function") {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "mouse";
      }
    }
    window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
  }
});

beforeEach(() => {
  localStorage.clear();
  resetAssistantFabStore();
  setViewport(1280, 800);
  vi.mocked(toast).mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Renders the button resting at the default spot (right edge, 24px up) on a 1280×800 viewport. */
function renderFab(props: Partial<Parameters<typeof AssistantFab>[0]> = {}) {
  const onActivate = vi.fn();
  render(<AssistantFab label={LABEL} icon={<span>*</span>} onActivate={onActivate} {...props} />);
  const button = screen.getByRole("button", { name: props.label ?? LABEL });
  const wrap = button.closest(".assistant-fab") as HTMLElement;
  vi.spyOn(wrap, "getBoundingClientRect").mockReturnValue(rect(1280 - 24 - 48, 800 - 24 - 48, 48, 48));
  return { button, wrap, onActivate };
}

const down = (el: Element, x: number, y: number, pointerType = "mouse") =>
  fireEvent.pointerDown(el, { pointerId: 1, pointerType, button: 0, clientX: x, clientY: y });
const move = (x: number, y: number) => fireEvent.pointerMove(window, { pointerId: 1, clientX: x, clientY: y });
const up = (x: number, y: number) => fireEvent.pointerUp(window, { pointerId: 1, clientX: x, clientY: y });

describe("AssistantFab click vs drag", () => {
  it("a click (or a tiny wobble) opens the assistant; keyboard activation works too", () => {
    const { button, wrap, onActivate } = renderFab();
    expect(wrap.dataset.fabSide).toBe("right");
    expect(wrap.style.getPropertyValue("--fab-bottom")).toBe("24px");

    down(button, 1232, 752);
    move(1234, 753);
    up(1234, 753);
    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledTimes(1);

    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("dragging moves the button, snaps it to the nearest edge, remembers the spot and does not open", async () => {
    const { button, wrap, onActivate } = renderFab();

    down(button, 1232, 752);
    move(100, 400);
    expect(wrap.hasAttribute("data-dragging")).toBe(true);
    expect(wrap.style.left).toBe("76px");
    expect(wrap.style.top).toBe("376px");

    up(100, 400);
    fireEvent.click(button);
    expect(onActivate).not.toHaveBeenCalled();
    expect(wrap.hasAttribute("data-dragging")).toBe(false);
    expect(wrap.dataset.fabSide).toBe("left");
    expect(wrap.style.getPropertyValue("--fab-bottom")).toBe("376px");
    expect(JSON.parse(localStorage.getItem(KEY) || "null")).toEqual({ side: "left", bottom: 376 });

    // The next real click opens again.
    await act(() => new Promise((r) => setTimeout(r, 0)));
    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("a long press on touch reveals the hide control instead of opening", () => {
    vi.useFakeTimers();
    const { button, wrap, onActivate } = renderFab();
    down(button, 1232, 752, "touch");
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(wrap.hasAttribute("data-reveal")).toBe(true);
    up(1232, 752);
    fireEvent.click(button);
    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe("AssistantFab position memory", () => {
  it("restores the saved side and height for this user", () => {
    localStorage.setItem(KEY, JSON.stringify({ side: "left", bottom: 300 }));
    const { wrap } = renderFab();
    expect(wrap.dataset.fabSide).toBe("left");
    expect(wrap.style.getPropertyValue("--fab-bottom")).toBe("300px");
  });

  it("ignores a corrupt saved value", () => {
    localStorage.setItem(KEY, "{not json");
    const { wrap } = renderFab();
    expect(wrap.dataset.fabSide).toBe("right");
    expect(wrap.style.getPropertyValue("--fab-bottom")).toBe("24px");
  });

  it("keeps the button inside the viewport and clamps again on resize without losing the saved spot", () => {
    localStorage.setItem(KEY, JSON.stringify({ side: "right", bottom: 5000 }));
    const { wrap } = renderFab();
    expect(wrap.style.getPropertyValue("--fab-bottom")).toBe(`${800 - 48 - 88}px`);
    act(() => {
      setViewport(1280, 500);
      window.dispatchEvent(new Event("resize"));
    });
    expect(wrap.style.getPropertyValue("--fab-bottom")).toBe(`${500 - 48 - 88}px`);
    expect(JSON.parse(localStorage.getItem(KEY) || "null")).toEqual({ side: "right", bottom: 5000 });
  });

  it("clamp / snap / panel placement rules", () => {
    expect(clampFabPosition({ side: "right", bottom: -40 }, 1280, 800)).toEqual({ side: "right", bottom: 16 });
    // Bottom-left is reserved for the floating Back button.
    expect(clampFabPosition({ side: "left", bottom: 0 }, 1280, 800)).toEqual({ side: "left", bottom: 64 });
    expect(clampFabPosition({ side: "right", bottom: 9999 }, 375, 700)).toEqual({ side: "right", bottom: 700 - 44 - 88 });
    expect(snapFabPosition(639, 200, 1280, 800).side).toBe("left");
    expect(snapFabPosition(641, 200, 1280, 800).side).toBe("right");
    expect(panelBottomFor({ side: "right", bottom: 24 }, 1280, 800)).toBe(80);
    expect(panelBottomFor({ side: "right", bottom: 200 }, 1280, 800)).toBe(256);
    // No room above a high button: the panel falls back to the default spot (it has its own Close button).
    expect(panelBottomFor({ side: "right", bottom: 600 }, 1280, 800)).toBe(80);
  });
});

describe("AssistantFab visibility", () => {
  it("steps aside while a modal dialog is open, but not for popovers", async () => {
    renderFab();
    const popover = document.createElement("div");
    popover.setAttribute("role", "dialog");
    popover.setAttribute("data-state", "open");
    popover.setAttribute("data-side", "bottom");
    document.body.appendChild(popover);
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(screen.queryByRole("button", { name: LABEL })).not.toBeNull();

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);
    await waitFor(() => expect(screen.queryByRole("button", { name: LABEL })).toBeNull());

    dialog.setAttribute("data-state", "closed");
    await waitFor(() => expect(screen.queryByRole("button", { name: LABEL })).not.toBeNull());
    dialog.remove();
    popover.remove();
  });

  it("can be hidden until reload, with Undo in the toast", () => {
    renderFab();
    fireEvent.click(screen.getByRole("button", { name: "Hide Booking Assistant" }));
    expect(screen.queryByRole("button", { name: LABEL })).toBeNull();
    expect(toast).toHaveBeenCalledWith("Booking Assistant hidden", expect.objectContaining({ description: expect.stringMatching(/reload/) }));
    act(() => showAssistantFab());
    expect(screen.getByRole("button", { name: LABEL })).toBeTruthy();
  });

  it("offers no hide control while the chat panel is open", () => {
    renderFab({ expanded: true, label: "Close Booking Assistant" });
    expect(screen.getByRole("button", { name: "Close Booking Assistant" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("button", { name: "Hide Booking Assistant" })).toBeNull();
  });
});

describe("floating clearance", () => {
  it("measures marked sticky bars in the lower half of the screen", () => {
    const bar = document.createElement("div");
    bar.setAttribute(FLOATING_CLEARANCE_ATTR, "");
    document.body.appendChild(bar);
    const spy = vi.spyOn(bar, "getBoundingClientRect");
    spy.mockReturnValue(rect(0, 800 - 8 - 60, 1280, 60));
    expect(measureFloatingClearance(document, 800)).toBe(68);
    spy.mockReturnValue(rect(0, 100, 1280, 60));
    expect(measureFloatingClearance(document, 800)).toBe(0);
    bar.remove();
  });
});
