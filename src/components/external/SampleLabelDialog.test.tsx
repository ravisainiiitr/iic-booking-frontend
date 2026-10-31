// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  addresses: vi.fn(),
  sampleLabelBytes: vi.fn(),
  mergePdfs: vi.fn(),
  saveBlob: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/externalBookingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/externalBookingApi")>();
  return { ...actual, externalBookingApi: { addresses: m.addresses, sampleLabelBytes: m.sampleLabelBytes } };
});
vi.mock("@/lib/dispatchPack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dispatchPack")>();
  return { ...actual, mergePdfs: m.mergePdfs, saveBlob: m.saveBlob };
});

import { SampleLabelDialog } from "./SampleLabelDialog";

const HOME = { id: 1, label: "", recipient_name: "Dr Asha", organisation: "", line1: "12 Station Road", line2: "", city: "Pune", state: "Maharashtra", postal_code: "411001", country: "India", phone: "", is_default: true };
const LAB = { ...HOME, id: 2, recipient_name: "Asha Labs", line1: "4 Hill Road", is_default: false };
const LABEL = new ArrayBuffer(4);
const FORM = new Blob(["form"], { type: "application/pdf" });
const PACK = new Blob(["pack"], { type: "application/pdf" });

function show() {
  const requisitionPdf = vi.fn().mockResolvedValue(FORM);
  const legacyLabelPdf = vi.fn().mockResolvedValue(new Blob(["old"], { type: "application/pdf" }));
  render(
    <SampleLabelDialog
      bookingId={9}
      bookingReference="IICX/9"
      open
      onOpenChange={() => {}}
      requisitionPdf={requisitionPdf}
      legacyLabelPdf={legacyLabelPdf}
    />,
  );
  return { requisitionPdf, legacyLabelPdf };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.mergePdfs.mockResolvedValue(PACK);
});
afterEach(() => cleanup());

describe("shipping label and requisition form dialog", () => {
  it("offers the sender of the latest label first and downloads label + form as one PDF", async () => {
    m.addresses.mockResolvedValue({ addresses: [HOME, LAB], last_label_address_id: 2, sample_labels_enabled: true });
    m.sampleLabelBytes.mockResolvedValue(LABEL);
    const { requisitionPdf } = show();
    expect(await screen.findByText(/4 Hill Road/)).toBeTruthy();
    expect(screen.queryByText(/QR/)).toBeNull(); // no QR code since 31 Oct 2026
    fireEvent.click(screen.getByTestId("download-label"));
    await waitFor(() => expect(m.saveBlob).toHaveBeenCalledWith(PACK, "label_and_requisition_IICX_9.pdf"));
    expect(m.sampleLabelBytes).toHaveBeenCalledWith(9, { sample_count: 1, description: "", address_id: 2 });
    expect(requisitionPdf).toHaveBeenCalled();
    expect(m.mergePdfs).toHaveBeenCalledWith([LABEL, FORM]); // label first, then the form
  });

  it("switched off: the plain label still comes with the requisition form", async () => {
    m.addresses.mockResolvedValue({ addresses: [], last_label_address_id: null, sample_labels_enabled: false });
    const { legacyLabelPdf, requisitionPdf } = show();
    expect((await screen.findByTestId("labels-disabled")).textContent).toContain("switched off");
    expect(screen.queryByText("Number of samples in the parcel")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Download label and form" }));
    await waitFor(() => expect(m.saveBlob).toHaveBeenCalled());
    expect(legacyLabelPdf).toHaveBeenCalled();
    expect(requisitionPdf).toHaveBeenCalled();
    expect(m.sampleLabelBytes).not.toHaveBeenCalled();
  });
});
