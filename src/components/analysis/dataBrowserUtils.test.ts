import { describe, expect, it } from "vitest";
import {
  datasetBookingLabel,
  formatBytes,
  isInternalNumericId,
  type DataBrowserDataset,
} from "./dataBrowserUtils";

function row(partial: Partial<DataBrowserDataset>): DataBrowserDataset {
  return {
    booking_id: "",
    booking_pk: 1,
    folders: [],
    ...partial,
  };
}

describe("datasetBookingLabel", () => {
  it("prefers virtual booking id over numeric sample or pk", () => {
    expect(
      datasetBookingLabel(
        row({
          virtual_booking_id: "IICAPREO202600005",
          sample_name: "1",
          booking_pk: 397,
          booking_id: "397",
        })
      )
    ).toBe("IICAPREO202600005");
  });

  it("does not use a bare numeric id as the heading when a virtual id exists", () => {
    const label = datasetBookingLabel(
      row({ virtual_booking_id: "IICAPREO202600005", booking_pk: 1, booking_id: "1" })
    );
    expect(label).not.toBe("1");
    expect(isInternalNumericId(label)).toBe(false);
  });
});

describe("formatBytes", () => {
  it("formats megabytes", () => {
    expect(formatBytes(245 * 1024 * 1024)).toContain("MB");
  });
});
