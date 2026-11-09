// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IstemAutomaticStatus, istemAutomaticOf, type IstemAutomatic } from "./IstemAutomaticStatus";
import { IstemFbrSeal } from "./IstemFbrSeal";

function status(over: Partial<IstemAutomatic> = {}): IstemAutomatic {
  return { automatic: true, step: "confirmed", label: "", fbr_no: "1976095568", request_id: "95568", confirmation_id: "71990", payment_id: "", ...over };
}

describe("Automatic I-STEM status", () => {
  afterEach(cleanup);

  it("shows the steps reached with the I-STEM identifiers and no FBR entry", () => {
    render(<IstemAutomaticStatus status={status()} />);
    expect(screen.getByText("I-STEM: handled by the portal")).toBeTruthy();
    expect(screen.getByText(/There is no FBR number to enter/)).toBeTruthy();
    expect(screen.getByText("FBR 1976095568")).toBeTruthy();
    expect(screen.getByText("Confirmation 71990")).toBeTruthy();
    const states = [...document.querySelectorAll("li")].map((li) => li.getAttribute("data-state"));
    expect(states).toEqual(["done", "done", "current"]);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("shows the executed FBR with its payment record", () => {
    render(<IstemAutomaticStatus status={status({ step: "executed", payment_id: "49803" })} />);
    expect(screen.getByText(/record 49803/)).toBeTruthy();
    expect([...document.querySelectorAll("li")].every((li) => li.getAttribute("data-state") === "done")).toBe(true);
  });

  it("tells the user nothing is needed when the IIT Roorkee Equipment Booking team is completing the record", () => {
    render(<IstemAutomaticStatus status={status({ step: "attention" })} />);
    expect(screen.getByText(/Nothing is needed from you/)).toBeTruthy();
  });

  it("says why a queued booking is not on I-STEM yet, with the exact fields for staff only", () => {
    const queued = status({
      step: "queued",
      fbr_no: "",
      waiting_reasons: ["Your portal account is not linked to an I-STEM account yet."],
      waiting_detail: ["public_user_id: missing"],
    });
    const { rerender } = render(<IstemAutomaticStatus status={queued} compact />);
    expect(screen.getByText("Why it is not on I-STEM yet")).toBeTruthy();
    expect(screen.getByText(/not linked to an I-STEM account/)).toBeTruthy();
    expect(screen.queryByTestId("istem-waiting-detail")).toBeNull();
    rerender(<IstemAutomaticStatus status={queued} compact showDetail />);
    expect(screen.getByText("public_user_id: missing")).toBeTruthy();
    rerender(<IstemAutomaticStatus status={{ ...queued, step: "registered" }} compact showDetail />);
    expect(screen.queryByTestId("istem-waiting")).toBeNull();
  });

  it("reads the record from a booking only when automatic", () => {
    expect(istemAutomaticOf({ istem_automatic: status() })?.fbr_no).toBe("1976095568");
    expect(istemAutomaticOf({ istem_automatic: null })).toBeNull();
    expect(istemAutomaticOf({})).toBeNull();
  });

  it("the seal shows no Unverified warning for automatic bookings until the FBR is executed", () => {
    const { rerender } = render(<IstemFbrSeal requireIstemFbr istemFbrStatus="PENDING_FBR" automatic showLabel />);
    expect(screen.queryByText("Unverified")).toBeNull();
    rerender(<IstemFbrSeal requireIstemFbr istemFbrStatus="EXECUTED" automatic showLabel />);
    expect(screen.getByText("Verified")).toBeTruthy();
    rerender(<IstemFbrSeal requireIstemFbr istemFbrStatus="PENDING_FBR" showLabel />);
    expect(screen.getByText("Unverified")).toBeTruthy();
  });
});
