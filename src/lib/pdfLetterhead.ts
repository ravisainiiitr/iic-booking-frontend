/**
 * Standard IIT Roorkee letterhead for every portal-generated PDF.
 * Layout (all centered): crest + English name → department (larger, brand color) → document title.
 */
import type { jsPDF } from "jspdf";

export const ORG_ENGLISH = "Indian Institute of Technology Roorkee";
export const DEFAULT_DEPARTMENT_NAME = "Institute Instrumentation Centre (IIC)";

/** Navy Ocean primary — matches portal / email branding (#153f79). */
export const PDF_BRAND_RGB: [number, number, number] = [21, 63, 121];
export const PDF_INK_RGB: [number, number, number] = [30, 41, 59];

export type PdfLetterheadOptions = {
  /** Department / centre line under the institute name. */
  departmentName?: string;
  /** Document title, e.g. "Analysis Charges". */
  documentTitle?: string;
  topY?: number;
  /** Max width of the masthead image (pt). */
  mastheadMaxWidth?: number;
};

let mastheadDataUrlPromise: Promise<string> | null = null;
let mastheadBytesPromise: Promise<ArrayBuffer> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function loadPdfMastheadBytes(): Promise<ArrayBuffer> {
  if (!mastheadBytesPromise) {
    mastheadBytesPromise = (async () => {
      const res = await fetch("/iitr-pdf-masthead.png?v=6");
      if (!res.ok) throw new Error("Failed to load IITR PDF masthead");
      return res.arrayBuffer();
    })();
  }
  return mastheadBytesPromise;
}

async function loadMastheadDataUrl(): Promise<string> {
  if (!mastheadDataUrlPromise) {
    mastheadDataUrlPromise = (async () => {
      const buf = await loadPdfMastheadBytes();
      return `data:image/png;base64,${arrayBufferToBase64(buf)}`;
    })();
  }
  return mastheadDataUrlPromise;
}

/**
 * Draw the standard centered letterhead. Returns the Y (pt) where body content should start.
 */
export async function drawPdfLetterhead(
  doc: jsPDF,
  options: PdfLetterheadOptions = {}
): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth();
  const cx = pageW / 2;
  let y = options.topY ?? 20;
  const maxW = options.mastheadMaxWidth ?? Math.min(320, pageW - 64);

  const dataUrl = await loadMastheadDataUrl();
  const props = doc.getImageProperties(dataUrl);
  const aspect = props.height / props.width;
  const imgW = maxW;
  const imgH = imgW * aspect;
  doc.addImage(dataUrl, "PNG", cx - imgW / 2, y, imgW, imgH);
  // Masthead PNG already includes "Indian Institute of Technology Roorkee" — do not redraw it.
  y += imgH + 10;

  const dept =
    String(options.departmentName || "").trim() || DEFAULT_DEPARTMENT_NAME;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...PDF_BRAND_RGB);
  const deptLines = doc.splitTextToSize(dept, pageW - 64);
  doc.text(deptLines, cx, y, { align: "center" });
  y += deptLines.length * 17 + 2;

  const title = String(options.documentTitle || "").trim();
  if (title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...PDF_INK_RGB);
    const titleLines = doc.splitTextToSize(title, pageW - 64);
    doc.text(titleLines, cx, y, { align: "center" });
    y += titleLines.length * 14 + 4;
  }

  return y + 6;
}