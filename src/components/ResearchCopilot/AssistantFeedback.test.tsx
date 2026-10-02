// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axeViolations } from "@/test/axe";
import { AssistantFeedback } from "./AssistantFeedback";

function setup(overrides: Partial<Parameters<typeof AssistantFeedback>[0]> = {}) {
  const onRate = vi.fn(async () => "fb-1" as string | null);
  const onComment = vi.fn(async () => true);
  const onEscalate = vi.fn();
  const view = render(
    <AssistantFeedback onRate={onRate} onComment={onComment} onEscalate={onEscalate} {...overrides} />,
  );
  return { onRate, onComment, onEscalate, user: userEvent.setup(), ...view };
}

describe("AssistantFeedback", () => {
  afterEach(cleanup);

  it("asks 'Was this helpful?' with labelled thumbs", async () => {
    const { container } = setup();
    expect(screen.getByRole("group", { name: "Was this helpful?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Yes, this was helpful" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "No, this was not helpful" })).toBeTruthy();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("thumbs up saves the rating and thanks the user", async () => {
    const { onRate, onComment, user } = setup();
    await user.click(screen.getByRole("button", { name: "Yes, this was helpful" }));
    expect(onRate).toHaveBeenCalledWith("up");
    expect(onComment).not.toHaveBeenCalled();
    expect(screen.getByText("Thanks for the feedback.")).toBeTruthy();
  });

  it("thumbs down saves right away, then offers an optional note sent with the feedback id", async () => {
    const { onRate, onComment, user, container } = setup();
    await user.click(screen.getByRole("button", { name: "No, this was not helpful" }));
    expect(onRate).toHaveBeenCalledWith("down");
    const input = screen.getByLabelText(/What were you looking for\?/);
    expect(await axeViolations(container)).toEqual([]);
    await user.type(input, "Scherrer equation example{Enter}");
    expect(onComment).toHaveBeenCalledWith("fb-1", "Scherrer equation example");
    expect(screen.getByText(/this helps us improve/)).toBeTruthy();
  });

  it("the note can be skipped", async () => {
    const { onComment, user } = setup();
    await user.click(screen.getByRole("button", { name: "No, this was not helpful" }));
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(onComment).not.toHaveBeenCalled();
    expect(screen.getByText(/this helps us improve/)).toBeTruthy();
  });

  it("offers the IIC team only when escalation is available", async () => {
    const { onEscalate, user } = setup({ canEscalate: true });
    await user.click(screen.getByRole("button", { name: "No, this was not helpful" }));
    await user.type(screen.getByLabelText(/What were you looking for\?/), "PI pricing");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(screen.getByRole("button", { name: "Ask the IIC team" }));
    expect(onEscalate).toHaveBeenCalledWith("PI pricing");
  });

  it("shows an error and keeps the thumbs when saving fails", async () => {
    const { user } = setup({ onRate: vi.fn(async () => null) });
    await user.click(screen.getByRole("button", { name: "Yes, this was helpful" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Couldn.t save/);
    expect(screen.getByRole("button", { name: "Yes, this was helpful" })).toBeTruthy();
  });
});
