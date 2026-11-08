// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PaymentPurposeImage } from "./PaymentPurposeImage";

describe("PaymentPurposeImage", () => {
  afterEach(cleanup);

  it("shows the equipment's own photo with what is being paid for", () => {
    render(<PaymentPurposeImage src="/api/equipment/7/image/?v=abc" alt="Powder XRD" caption="You are paying for: Powder XRD" />);
    const img = screen.getByAltText("Powder XRD");
    expect(img.getAttribute("src")).toBe("/api/equipment/7/image/?v=abc");
    expect(screen.getByText("You are paying for: Powder XRD")).toBeTruthy();
  });

  it("falls back to the portal's laboratory photo when there is no photo or it fails to load", () => {
    const { rerender } = render(<PaymentPurposeImage src="" alt="Powder XRD" />);
    expect(screen.getByAltText("Research laboratory at IIT Roorkee")).toBeTruthy();
    rerender(<PaymentPurposeImage src="/broken.jpg" alt="Powder XRD" />);
    fireEvent.error(screen.getByAltText("Powder XRD"));
    expect(screen.getByAltText("Research laboratory at IIT Roorkee")).toBeTruthy();
  });
});
