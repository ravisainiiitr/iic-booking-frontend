import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pdfLetterhead", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pdfLetterhead")>()),
  // No network in tests: the form falls back to a text heading when the letterhead image cannot be loaded.
  loadPdfMastheadBytes: vi.fn(async () => {
    throw new Error("offline");
  }),
}));

import type { BookingDetailCardBooking } from "@/components/BookingDetailCard";
import { generateExternalEquipmentRequisitionFormPdf, pdfSafe, requisitionReference } from "./externalRequisitionFormPdf";

function booking(extra: Partial<BookingDetailCardBooking> = {}): BookingDetailCardBooking {
  return {
    booking_id: 4321,
    virtual_booking_id: "FESEM-4321",
    user: 7,
    user_email: "asha.verma@lab.example.org",
    user_name: "Dr. Asha Verma",
    user_phone: "9876543210",
    user_department: "Asha Labs Pvt. Ltd., Roorkee",
    equipment: 12,
    equipment_code: "FESEM",
    equipment_name: "Field Emission Scanning Electron Microscope",
    charge_profile: 1,
    user_type_snapshot: "industry",
    user_type_snapshot_display: "Industry",
    total_time_minutes: 120,
    total_hours: 2,
    total_charge: "5900.00",
    input_values: { magnification: "x50,000", coating: true, _sample_sets: [{ sample_type: "Powder", count: 2 }] },
    input_fields: [
      { field_key: "magnification", field_label: "Magnification", field_type: "text" },
      { field_key: "coating", field_label: "Gold coating", field_type: "checkbox" },
      { field_key: "sample_type", field_label: "Sample type", field_type: "select" },
    ],
    selected_parameters: null,
    charge_breakdown: [
      { description: "FESEM, 2 hours", amount: 5000 },
      { description: "GST 18%", amount: 900 },
    ],
    status: "BOOKED",
    status_display: "Booked",
    notes: "",
    start_time: "2026-11-12T10:00:00+05:30",
    end_time: "2026-11-12T12:00:00+05:30",
    daily_slots: [
      { id: 1, slot_master: 1, slot_number: 1, slot_name: "S1", equipment_code: "FESEM", date: "2026-11-12", start_datetime: "2026-11-12T10:00:00+05:30", end_datetime: "2026-11-12T11:00:00+05:30", status: "BOOKED", booking: 4321, booking_id: 4321 },
      { id: 2, slot_master: 2, slot_number: 2, slot_name: "S2", equipment_code: "FESEM", date: "2026-11-12", start_datetime: "2026-11-12T11:00:00+05:30", end_datetime: "2026-11-12T12:00:00+05:30", status: "BOOKED", booking: 4321, booking_id: 4321 },
    ],
    created_at: "2026-11-01T09:00:00+05:30",
    updated_at: "2026-11-01T09:00:00+05:30",
    lab_in_charge: { user_id: 3, name: "Mr. Op Kumar", email: "op@iitr.ac.in", phone: "01332-284000" },
    oic_contacts: [{ user_id: 4, name: "Prof. R. Sharma", email: "oic@iitr.ac.in", phone: null }],
    ...extra,
  } as unknown as BookingDetailCardBooking;
}

async function pages(blob: Blob): Promise<number> {
  const doc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
  const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()];
  expect([Math.round(w), Math.round(h)]).toEqual([595, 842]); // A4 portrait
  return doc.getPageCount();
}

describe("Equipment Requisition Form", () => {
  it("uses the booking id for the reference number", () => {
    expect(requisitionReference({ booking_id: 4321, created_at: "2026-11-01T09:00:00+05:30" })).toBe("IIC/REQ/2026/4321");
  });

  it("builds an A4 form for a normal booking", async () => {
    const blob = await generateExternalEquipmentRequisitionFormPdf(booking());
    expect(blob.type).toBe("application/pdf");
    expect(await pages(blob)).toBeGreaterThanOrEqual(1);
  });

  it("handles missing details without failing", async () => {
    const blob = await generateExternalEquipmentRequisitionFormPdf(
      booking({
        user_phone: null, user_department: null, user_type_snapshot_display: null, lab_in_charge: null, oic_contacts: [],
        input_values: {}, input_fields: [], charge_breakdown: [], total_charge: "0", daily_slots: [], start_time: "",
      } as unknown as Partial<BookingDetailCardBooking>),
    );
    expect(await pages(blob)).toBeGreaterThanOrEqual(1);
  });

  it("wraps very long text and moves to new pages instead of clipping", async () => {
    const short = await pages(await generateExternalEquipmentRequisitionFormPdf(booking()));
    const long = "Organisation with a remarkably long registered name and address ".repeat(60);
    const withLong = await pages(
      await generateExternalEquipmentRequisitionFormPdf(
        booking({ user_department: long, user_email: `a${"x".repeat(200)}@example.org` }),
      ),
    );
    expect(withLong).toBeGreaterThan(short);
  });

  it("puts many samples on following pages", async () => {
    const sets = Array.from({ length: 30 }, (_, i) => ({ sample_type: i % 2 ? "Powder" : "Thin film", count: i + 1 }));
    const few = await pages(await generateExternalEquipmentRequisitionFormPdf(booking()));
    const many = await pages(
      await generateExternalEquipmentRequisitionFormPdf(booking({ input_values: { ...booking().input_values, _sample_sets: sets } } as unknown as Partial<BookingDetailCardBooking>)),
    );
    expect(many).toBeGreaterThan(few);
  });

  it("does not fail on characters the PDF fonts cannot draw", async () => {
    const blob = await generateExternalEquipmentRequisitionFormPdf(
      booking({ user_name: "डॉ. आशा — Verma “QA” ₹ … 😀", user_department: "Café – Zürich" }),
    );
    expect(await pages(blob)).toBeGreaterThanOrEqual(1);
    expect(pdfSafe("₹ 5,000 — “ok” … ✓")).toBe("Rs.  5,000 - \"ok\" ... ?");
  });
});
