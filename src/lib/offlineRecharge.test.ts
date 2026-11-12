import { describe, expect, it } from "vitest";

import {
  EMPTY_FORM,
  auditActionLabel,
  buildOfflineRechargeFormData,
  formatRupees,
  receiptProblem,
  validateOfflineRecharge,
  type OfflineRechargeForm,
} from "./offlineRecharge";

const filled: OfflineRechargeForm = {
  ...EMPTY_FORM,
  department_id: "3",
  amount: "5,000",
  payment_date: "2026-11-10",
  payment_mode: "NEFT",
  transaction_reference: "SBIN 1234 5678",
  payer_bank: "State Bank of India",
  payer_account_name: "Acme Labs",
};

const pdf = () => new File(["%PDF-1.4"], "receipt.pdf", { type: "application/pdf" });

describe("validateOfflineRecharge", () => {
  it("accepts a complete form", () => {
    expect(validateOfflineRecharge(filled, pdf(), { today: "2026-11-11" })).toEqual({});
  });

  it("flags each missing or wrong field", () => {
    const errors = validateOfflineRecharge(
      { ...EMPTY_FORM, amount: "12.345", payment_date: "2026-11-12", payment_mode: "OTHER", transaction_reference: "12" },
      null,
      { today: "2026-11-11" },
    );
    expect(Object.keys(errors).sort()).toEqual(
      [
        "amount",
        "department_id",
        "payer_account_name",
        "payer_bank",
        "payment_date",
        "payment_mode_other",
        "receipt_file",
        "transaction_reference",
      ].sort(),
    );
    expect(errors.payment_date).toMatch(/future/);
  });
});

describe("receiptProblem", () => {
  it("accepts camera photos and PDFs and refuses other files or large ones", () => {
    expect(receiptProblem(new File(["x"], "IMG_0001.HEIC", { type: "" }))).toBeNull();
    expect(receiptProblem(new File(["x"], "photo.jpg", { type: "image/jpeg" }))).toBeNull();
    expect(receiptProblem(pdf())).toBeNull();
    expect(receiptProblem(new File(["x"], "notes.docx", { type: "application/msword" }))).toMatch(/PDF or an image/);
    const big = new File([new Uint8Array(2 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });
    expect(receiptProblem(big, 1)).toMatch(/1 MB/);
  });
});

describe("buildOfflineRechargeFormData", () => {
  it("sends trimmed fields, the plain amount, the idempotency key and the file", () => {
    const fd = buildOfflineRechargeFormData({ ...filled, remarks: "  " }, pdf(), "key-1");
    expect(fd.get("amount")).toBe("5000");
    expect(fd.get("transaction_reference")).toBe("SBIN 1234 5678");
    expect(fd.get("client_request_id")).toBe("key-1");
    expect(fd.has("remarks")).toBe(false);
    expect((fd.get("receipt_file") as File).name).toBe("receipt.pdf");
  });
});

describe("labels", () => {
  it("formats rupees and audit actions", () => {
    expect(formatRupees("101775")).toBe("₹1,01,775.00");
    expect(auditActionLabel("offline_payment_reconciled")).toBe("Reconciled");
    expect(auditActionLabel("something_else")).toBe("something else");
  });
});
