// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EquipmentFlashBanner } from "./EquipmentFlashBanner";
import type { PublicFlashMessage } from "@/lib/flashMessages";

const msg = (id: number, message: string, extra: Partial<PublicFlashMessage> = {}): PublicFlashMessage => ({
  id,
  message,
  tone: "NOTICE",
  end_at: "2026-10-12T10:00:00+05:30",
  link_url: "",
  link_label: "",
  ...extra,
});

const widths = { scroll: 0, client: 0 };
let restore: (() => void) | null = null;

function mockLayout() {
  const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");
  const client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get() {
      return (this as HTMLElement).dataset.testid === "equipment-flash-text" ? widths.scroll : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return widths.client;
    },
  });
  restore = () => {
    if (scroll) Object.defineProperty(HTMLElement.prototype, "scrollWidth", scroll);
    if (client) Object.defineProperty(HTMLElement.prototype, "clientWidth", client);
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
  widths.scroll = 200;
  widths.client = 600;
  mockLayout();
});

afterEach(() => {
  cleanup();
  restore?.();
  vi.useRealTimers();
});

describe("EquipmentFlashBanner", () => {
  it("renders an accessible polite status with sanitised bold, italic and links only", () => {
    render(
      <EquipmentFlashBanner
        messages={[
          msg(1, '<strong>Closed</strong> <em>today</em><script>alert(1)</script><img src=x onerror="x()"> <a href="javascript:x()">bad</a> <a href="https://iitr.ac.in">form</a>', {
            link_url: "https://iitr.ac.in/more",
            link_label: "Details",
          }),
        ]}
      />,
    );
    const banner = screen.getByRole("status");
    expect(banner.getAttribute("aria-live")).toBe("polite");
    const text = screen.getByTestId("equipment-flash-text");
    expect(text.innerHTML).toContain("<strong>Closed</strong>");
    expect(text.innerHTML).toContain("<em>today</em>");
    expect(text.innerHTML).not.toMatch(/script|onerror|javascript|<img/);
    expect(screen.getByRole("link", { name: /Details/ }).getAttribute("rel")).toContain("noopener");
    expect(screen.getByRole("link", { name: "form" }).getAttribute("target")).toBe("_blank");
    expect(banner.textContent).toContain("Notice");
  });

  it("rotates several messages every ~6 s, pauses on hover and lets users pick with the dots", () => {
    vi.useFakeTimers();
    render(<EquipmentFlashBanner messages={[msg(1, "First"), msg(2, "Second"), msg(3, "Third")]} />);
    const text = () => screen.getByTestId("equipment-flash-text").textContent;
    expect(text()).toBe("First");
    expect(screen.getAllByRole("button", { name: /Announcement \d of 3/ })).toHaveLength(3);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(text()).toBe("Second");

    fireEvent.mouseEnter(screen.getByRole("status"));
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(text()).toBe("Second");
    fireEvent.mouseLeave(screen.getByRole("status"));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(text()).toBe("Third");

    fireEvent.click(screen.getByRole("button", { name: "Announcement 1 of 3" }));
    expect(text()).toBe("First");
    expect(screen.getByRole("button", { name: "Announcement 1 of 3" }).getAttribute("aria-current")).toBe("true");
  });

  it("scrolls as a ticker only when the text does not fit", () => {
    const { unmount } = render(<EquipmentFlashBanner messages={[msg(1, "Short")]} />);
    expect(screen.getByRole("status").getAttribute("data-ticker")).toBe("off");
    unmount();

    widths.scroll = 900;
    widths.client = 400;
    render(<EquipmentFlashBanner messages={[msg(2, "A very long message ".repeat(10))]} />);
    expect(screen.getByRole("status").getAttribute("data-ticker")).toBe("on");
    const text = screen.getByTestId("equipment-flash-text");
    expect(text.className).toContain("flash-ticker");
    expect(text.style.getPropertyValue("--flash-ticker-shift")).toBe("-524px");
  });

  it("is static with reduced motion: no sheen, pulse, ticker or auto-rotation; long text can be expanded", () => {
    vi.useFakeTimers();
    widths.scroll = 900;
    widths.client = 400;
    const { container } = render(
      <EquipmentFlashBanner reducedMotion messages={[msg(1, "Long first ".repeat(10)), msg(2, "Second")]} />,
    );
    const banner = screen.getByRole("status");
    expect(banner.getAttribute("data-reduced-motion")).toBe("true");
    expect(banner.getAttribute("data-ticker")).toBe("off");
    expect(banner.className).not.toContain("flash-banner-enter");
    expect(container.querySelector(".flash-sheen")).toBeNull();
    expect(container.querySelector(".flash-pulse-ring")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(screen.getByTestId("equipment-flash-text").textContent).toContain("Long first");

    const expand = screen.getByRole("button", { name: "Show the full message" });
    fireEvent.click(expand);
    expect(screen.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("equipment-flash-text").className).toContain("whitespace-normal");
  });

  it("dismisses a message for the session", () => {
    const { unmount } = render(<EquipmentFlashBanner messages={[msg(1, "First"), msg(2, "Second")]} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss this announcement" }));
    expect(screen.getByTestId("equipment-flash-text").textContent).toBe("Second");
    expect(screen.queryByRole("button", { name: /Announcement \d of/ })).toBeNull();
    unmount();

    render(<EquipmentFlashBanner messages={[msg(1, "First"), msg(2, "Second")]} />);
    expect(screen.getByTestId("equipment-flash-text").textContent).toBe("Second");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss this announcement" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("preview mode has no dismiss and remembers nothing", () => {
    render(<EquipmentFlashBanner preview messages={[msg(5, "Preview")]} />);
    expect(screen.queryByRole("button", { name: "Dismiss this announcement" })).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });
});
