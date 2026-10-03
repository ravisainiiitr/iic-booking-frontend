// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LabQuestionBadge } from "./LabQuestionBadge";

afterEach(cleanup);

describe("LabQuestionBadge", () => {
  it("renders nothing without open questions", () => {
    const { container } = render(<LabQuestionBadge count={0} variant="staff" />);
    expect(container.textContent).toBe("");
    render(<LabQuestionBadge variant="user" />);
    expect(screen.queryByText(/reply/i)).toBeNull();
  });

  it("tells staff the lab is waiting and users that a reply is needed", () => {
    render(<LabQuestionBadge count={1} variant="staff" />);
    expect(screen.getByText("Awaiting reply")).toBeTruthy();
    cleanup();
    render(<LabQuestionBadge count={2} variant="user" />);
    expect(screen.getByText("2 replies needed")).toBeTruthy();
  });
});
