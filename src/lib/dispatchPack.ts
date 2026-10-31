/**
 * External users send their sample with two documents: the shipping label (page 1) and the filled equipment
 * requisition form. They are downloaded together as one PDF (31 Oct 2026 committee) so neither is forgotten.
 */
export async function mergePdfs(parts: Array<ArrayBuffer | Blob>): Promise<Blob> {
  // pdf-lib (~350 KB) loads only when a pack is built, not with every booking card.
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  for (const part of parts) {
    const bytes = part instanceof Blob ? await part.arrayBuffer() : part;
    const doc = await PDFDocument.load(bytes);
    const pages = await out.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  out.setTitle("Shipping label and equipment requisition form");
  const saved = await out.save();
  return new Blob([saved], { type: "application/pdf" });
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File name for the pack, from the booking ID shown to the user. */
export function dispatchPackName(bookingReference: string | number): string {
  return `label_and_requisition_${String(bookingReference).replace(/[^A-Za-z0-9_-]+/g, "_")}.pdf`;
}
