// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import ClaimFacilityEvidencePanel, { type ClaimFacilityEvidence } from "./ClaimFacilityEvidence";

const row = (id: number, code: string, confidence: number): ClaimFacilityEvidence => ({
  equipment: { id, code, name: `${code} instrument` },
  confidence,
  matched_phrases: [code],
  rationale: `Acknowledgement names the equipment: "${code}" (code).`,
  source_url: "https://repo.example.org/paper.pdf",
  oa_status: "green",
  licence: "cc-by",
  acknowledgement_snippet: "The authors thank the Central Facility for FESEM and XRD.",
  detail: "Acknowledgement found by acknowledgement heading.",
  checked_at: "2026-11-05T10:00:00Z",
});

describe("ClaimFacilityEvidencePanel", () => {
  afterEach(() => cleanup());

  it("renders nothing for hand-made claims", () => {
    const { container } = render(<ClaimFacilityEvidencePanel evidence={[]} />);
    expect(container.innerHTML).toBe("");
    render(<ClaimFacilityEvidencePanel />);
    expect(screen.queryByTestId("claim-facility-evidence")).toBeNull();
  });

  it("shows the excerpt, the source and each instrument's match", () => {
    render(<ClaimFacilityEvidencePanel evidence={[row(1, "FESEM", 0.8), row(2, "XRD", 0.98)]} />);
    expect(screen.getByText(/thank the Central Facility for FESEM and XRD/)).toBeTruthy();
    const link = screen.getByRole("link", { name: /repo\.example\.org/ });
    expect(link.getAttribute("href")).toBe("https://repo.example.org/paper.pdf");
    expect(screen.getByText(/open access \(green\) · licence cc-by/)).toBeTruthy();
    expect(screen.getByText("80% match")).toBeTruthy();
    expect(screen.getByText("98% match")).toBeTruthy();
    expect(screen.getByText("FESEM (FESEM instrument)")).toBeTruthy();
  });
});
