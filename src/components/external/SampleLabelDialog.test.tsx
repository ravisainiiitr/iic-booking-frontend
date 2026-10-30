// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ addresses: vi.fn(), downloadSampleLabel: vi.fn() }));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/externalBookingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/externalBookingApi")>();
  return { ...actual, externalBookingApi: { addresses: m.addresses, downloadSampleLabel: m.downloadSampleLabel } };
});

import { SampleLabelDialog } from "./SampleLabelDialog";

const HOME = { id: 1, label: "", recipient_name: "Dr Asha", organisation: "", line1: "12 Station Road", line2: "", city: "Pune", state: "Maharashtra", postal_code: "411001", country: "India", phone: "", is_default: true };
const LAB = { ...HOME, id: 2, recipient_name: "Asha Labs", line1: "4 Hill Road", is_default: false };

function show(onLegacy = vi.fn()) {
  render(<SampleLabelDialog bookingId={9} open onOpenChange={() => {}} onLegacy={onLegacy} />);
  return onLegacy;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("shipping label dialog", () => {
  it("offers the sender of the latest label first, before the default address", async () => {
    m.addresses.mockResolvedValue({ addresses: [HOME, LAB], last_label_address_id: 2, sample_labels_enabled: true });
    m.downloadSampleLabel.mockResolvedValue(undefined);
    show();
    expect(await screen.findByText(/4 Hill Road/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("download-label"));
    await waitFor(() => expect(m.downloadSampleLabel).toHaveBeenCalledWith(9, { sample_count: 1, description: "", address_id: 2 }));
  });

  it("switched off: says so and offers the plain label instead of asking for an address", async () => {
    m.addresses.mockResolvedValue({ addresses: [], last_label_address_id: null, sample_labels_enabled: false });
    const onLegacy = show();
    expect((await screen.findByTestId("labels-disabled")).textContent).toContain("switched off");
    expect(screen.queryByText("Number of samples in the parcel")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Download plain label" }));
    expect(onLegacy).toHaveBeenCalled();
    expect(m.downloadSampleLabel).not.toHaveBeenCalled();
  });
});
