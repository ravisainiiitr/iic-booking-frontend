// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { errorMessage, payloadForm, PM_BASE, pmUrl, ProcurementApiError } from "@/lib/procurementApi";
import { blankInvoice, invoicePayload, invoiceTotal, invoiceValid } from "./InvoiceForm";
import { lineTotal, smallPurchaseHint } from "./RequestWizard";
import { humanize, money } from "./shared";

describe("procurement api helpers", () => {
  it("builds urls under the procurement base and drops empty params", () => {
    expect(pmUrl("/requests/", { department_id: 3, q: "", status: undefined, export: "csv" })).toBe(
      `${PM_BASE}/requests/?department_id=3&export=csv`,
    );
  });

  it("surfaces the server detail and field in error messages", () => {
    const e = new ProcurementApiError(400, { detail: "Too much.", code: "above_threshold", field: "amount" });
    expect(e.code).toBe("above_threshold");
    expect(errorMessage(e)).toBe("Too much. (amount)");
    expect(errorMessage(new ProcurementApiError(500, {}))).toBe("Request failed (500)");
  });

  it("packs a JSON payload with files for multipart uploads", () => {
    const form = payloadForm({ a: 1 }, [new File(["x"], "bill.pdf", { type: "application/pdf" })]);
    expect(JSON.parse(String(form.get("payload")))).toEqual({ a: 1 });
    expect(form.getAll("files")).toHaveLength(1);
  });
});

describe("request wizard maths", () => {
  it("adds GST to each line and rounds to paise", () => {
    expect(lineTotal({ quantity: "2", estimated_unit_price: "500", gst_rate: "18" })).toBe(1180);
    expect(lineTotal({ quantity: "3", estimated_unit_price: "333.33", gst_rate: "18" })).toBe(1179.99);
    expect(lineTotal({ quantity: "", estimated_unit_price: "10", gst_rate: "5" })).toBe(0);
  });

  it("explains the small-purchase decision from its reason code", () => {
    expect(smallPurchaseHint({ eligible: true, reason: "within_threshold", threshold: "2000.00" })).toContain("₹2,000.00");
    expect(smallPurchaseHint({ eligible: false, reason: "category_not_allowed", threshold: "2000.00" })).toMatch(/never bought/);
    expect(smallPurchaseHint({ eligible: false, reason: "above_threshold", threshold: "2000.00" })).toMatch(/^Above/);
  });
});

describe("invoice form", () => {
  it("totals intra-state bills with CGST + SGST and ignores IGST", () => {
    const s = { ...blankInvoice(), taxable_amount: "1000", cgst_amount: "90", sgst_amount: "90", igst_amount: "180", other_charges: "10.5" };
    expect(invoiceTotal(s)).toBe(1190.5);
    expect(invoicePayload(s).igst_amount).toBeNull();
  });

  it("totals inter-state bills with IGST only", () => {
    const s = { ...blankInvoice(), supply_type: "INTER_STATE" as const, taxable_amount: "1000", cgst_amount: "90", igst_amount: "180" };
    expect(invoiceTotal(s)).toBe(1180);
    const p = invoicePayload(s);
    expect(p.cgst_amount).toBeNull();
    expect(p.igst_amount).toBe("180");
  });

  it("needs a vendor, bill number, date and taxable value", () => {
    const s = { ...blankInvoice(), vendor_name: "Acme", invoice_number: "INV-1", taxable_amount: "10" };
    expect(invoiceValid(s)).toBe(true);
    expect(invoiceValid({ ...s, vendor_name: " " })).toBe(false);
    expect(invoiceValid({ ...s, taxable_amount: "0" })).toBe(false);
    expect(invoicePayload({ ...s, vendor_id: "7" })).toMatchObject({ vendor_id: 7, vendor_name: "" });
  });
});

describe("formatting", () => {
  it("formats rupees and status codes", () => {
    expect(money("2000")).toBe("₹2,000.00");
    expect(money(null)).toBe("—");
    expect(humanize("PENDING_OIC_APPROVAL")).toBe("Pending oic approval");
  });
});
