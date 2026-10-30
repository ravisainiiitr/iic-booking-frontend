// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import NoticeGroup from "./NoticeGroup";

const Empty = () => null;

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("NoticeGroup", () => {
  it("starts collapsed with a count and opens on click, remembering the choice", () => {
    render(
      <NoticeGroup>
        <div>Equipment under maintenance</div>
        <Empty />
        <div>1 disruption needs a reason</div>
      </NoticeGroup>,
    );
    const toggle = screen.getByRole("button", { name: /Notices \(2\)/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Equipment under maintenance").closest("[hidden]")).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Equipment under maintenance").closest("[hidden]")).toBeNull();
    expect(localStorage.getItem("dashboard.noticeGroup.open")).toBe("1");
  });

  it("is hidden when no notice has anything to show", () => {
    render(
      <NoticeGroup>
        <Empty />
      </NoticeGroup>,
    );
    expect(screen.getByTestId("notice-group").className).toContain("hidden");
  });
});
