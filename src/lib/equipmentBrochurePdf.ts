/**
 * Export an equipment brochure as a letterheaded PDF.
 */
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { apiClient } from "@/lib/api";
import {
  DEFAULT_DEPARTMENT_NAME,
  drawPdfLetterhead,
  PDF_BRAND_RGB,
  PDF_INK_RGB,
} from "@/lib/pdfLetterhead";

export type BrochureSpec = {
  spec_key: string;
  spec_value: string;
};

export type BrochureContact = {
  role: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

export type BrochureChargeRow = {
  category: string;
  primary?: string | null;
  secondary?: string | null;
};

export type EquipmentBrochurePdfInput = {
  equipmentId: number;
  name: string;
  code?: string | null;
  description?: string | null;
  importantInstruction?: string | null;
  location?: string | null;
  departmentName?: string | null;
  generalSpecs: BrochureSpec[];
  sampleSpecs: BrochureSpec[];
  chargeRows: BrochureChargeRow[];
  contacts: BrochureContact[];
};

/** Helvetica (WinAnsi) cannot render Greek/math Unicode; map to ASCII so PDF text stays readable. */
function pdfSafe(text: string): string {
  let s = String(text || "");
  try {
    s = s.normalize("NFKC");
  } catch {
    /* ignore */
  }
  const greek: Record<string, string> = {
    α: "alpha",
    Α: "A",
    β: "beta",
    Β: "B",
    γ: "gamma",
    Γ: "Gamma",
    δ: "delta",
    Δ: "Delta",
    ε: "epsilon",
    Ε: "E",
    ζ: "zeta",
    η: "eta",
    θ: "theta",
    Θ: "Theta",
    ι: "iota",
    κ: "kappa",
    λ: "lambda",
    Λ: "Lambda",
    μ: "mu",
    Μ: "M",
    ν: "nu",
    ξ: "xi",
    π: "pi",
    Π: "Pi",
    ρ: "rho",
    σ: "sigma",
    Σ: "Sigma",
    τ: "tau",
    υ: "upsilon",
    φ: "phi",
    Φ: "Phi",
    χ: "chi",
    ψ: "psi",
    ω: "omega",
    Ω: "Omega",
    "µ": "mu", // micro sign U+00B5
  };
  s = s.replace(/[\u0370-\u03FF\u00B5]/g, (ch) => greek[ch] || ch);
  s = s
    .replace(/\u20B9/g, "Rs.")
    .replace(/₹/g, "Rs.")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00D7/g, "x")
    .replace(/\u00F7/g, "/")
    .replace(/\u2212/g, "-")
    .replace(/\u00B1/g, "+/-")
    .replace(/\u2248/g, "~")
    .replace(/\u2260/g, "!=")
    .replace(/\u2264/g, "<=")
    .replace(/\u2265/g, ">=")
    .replace(/\u221E/g, "inf")
    .replace(/\u2192/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/\u00B0/g, " deg")
    .replace(/\u212B/g, "A") // Angstrom
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
    .replace(/[\u0300-\u036F]/g, ""); // combining marks after NFKC
  // Drop remaining non-WinAnsi-safe chars (keeps latin-1 printable + tab/newline)
  s = s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code > 0xff) return " ";
    return ch;
  });
  return s.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function defaultFilename(code: string | null | undefined, name: string): string {
  const slug = (code || name || "equipment")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `equipment-brochure-${slug}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
}

async function loadEquipmentImageDataUrl(equipmentId: number): Promise<{
  dataUrl: string;
  format: "JPEG" | "PNG" | "WEBP";
} | null> {
  try {
    const url = apiClient.getEquipmentImageProxyPath(equipmentId);
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") || blob.size < 32) return null;
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const mime = blob.type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${btoa(binary)}`;
    let format: "JPEG" | "PNG" | "WEBP" = "JPEG";
    if (mime.includes("png")) format = "PNG";
    else if (mime.includes("webp")) format = "WEBP";
    return { dataUrl, format };
  } catch {
    return null;
  }
}

function ensureSpace(doc: jsPDF, y: number, need: number, marginBottom = 48): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + need > pageH - marginBottom) {
    doc.addPage();
    return 48;
  }
  return y;
}

function writeSectionTitle(doc: jsPDF, title: string, y: number, marginX: number): number {
  y = ensureSpace(doc, y, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_BRAND_RGB);
  doc.text(title, marginX, y);
  y += 6;
  doc.setDrawColor(...PDF_BRAND_RGB);
  doc.setLineWidth(0.6);
  const pageW = doc.internal.pageSize.getWidth();
  doc.line(marginX, y, pageW - marginX, y);
  return y + 14;
}

function writeParagraph(
  doc: jsPDF,
  text: string,
  y: number,
  marginX: number,
  opts?: { bold?: boolean; size?: number; color?: [number, number, number] }
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - marginX * 2;
  const size = opts?.size ?? 10;
  const lineH = size + 3;
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...(opts?.color ?? PDF_INK_RGB));
  const lines = doc.splitTextToSize(pdfSafe(text), maxW) as string[];
  for (const line of lines) {
    y = ensureSpace(doc, y, lineH);
    // Explicit left align — avoid any justify stretch that spaces characters oddly.
    doc.text(String(line), marginX, y, { align: "left", baseline: "alphabetic" });
    y += lineH;
  }
  return y;
}

export async function exportEquipmentBrochurePdf(
  input: EquipmentBrochurePdfInput,
  options?: { filename?: string }
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 48;
  const dept =
    String(input.departmentName || "").trim() || DEFAULT_DEPARTMENT_NAME;
  const titleBits = [input.name, input.code ? `(${input.code})` : ""]
    .filter(Boolean)
    .join(" ");

  let y = await drawPdfLetterhead(doc, {
    departmentName: dept,
    documentTitle: "Equipment Brochure",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PDF_INK_RGB);
  const nameLines = doc.splitTextToSize(pdfSafe(titleBits), pageW - marginX * 2);
  doc.text(nameLines, pageW / 2, y, { align: "center" });
  y += nameLines.length * 16 + 12;

  const image = await loadEquipmentImageDataUrl(input.equipmentId);
  if (image) {
    try {
      const props = doc.getImageProperties(image.dataUrl);
      const maxW = Math.min(280, pageW - marginX * 2);
      const aspect = props.height / props.width;
      let imgW = maxW;
      let imgH = imgW * aspect;
      if (imgH > 200) {
        imgH = 200;
        imgW = imgH / aspect;
      }
      y = ensureSpace(doc, y, imgH + 16);
      doc.addImage(image.dataUrl, image.format, (pageW - imgW) / 2, y, imgW, imgH);
      y += imgH + 18;
    } catch {
      // skip broken images
    }
  }

  y = writeSectionTitle(doc, "General information", y, marginX);
  if (input.importantInstruction) {
    y = writeParagraph(doc, "Important instruction", y, marginX, {
      bold: true,
      size: 10,
      color: [146, 64, 14],
    });
    y = writeParagraph(doc, input.importantInstruction, y, marginX, { size: 9 });
    y += 6;
  }
  if (input.description) {
    y = writeParagraph(doc, input.description, y, marginX);
  } else {
    y = writeParagraph(doc, "No general description published yet.", y, marginX, {
      size: 9,
      color: [100, 116, 139],
    });
  }
  if (input.location) {
    y += 4;
    y = writeParagraph(doc, `Location: ${input.location}`, y, marginX, { size: 9 });
  }
  y += 10;

  y = writeSectionTitle(doc, "Technical specifications", y, marginX);
  if (input.generalSpecs.length === 0) {
    y = writeParagraph(doc, "Specifications have not been published yet.", y, marginX, {
      size: 9,
      color: [100, 116, 139],
    });
  } else {
    for (const spec of input.generalSpecs) {
      y = writeParagraph(doc, spec.spec_key || "Specification", y, marginX, {
        bold: true,
        size: 10,
      });
      y = writeParagraph(doc, spec.spec_value || "—", y, marginX, { size: 9 });
      y += 6;
    }
  }
  y += 6;

  y = writeSectionTitle(doc, "Sample requirements", y, marginX);
  if (input.sampleSpecs.length === 0) {
    y = writeParagraph(doc, "Sample requirements have not been published yet.", y, marginX, {
      size: 9,
      color: [100, 116, 139],
    });
  } else {
    for (const spec of input.sampleSpecs) {
      y = writeParagraph(doc, spec.spec_key || "Requirement", y, marginX, {
        bold: true,
        size: 10,
      });
      y = writeParagraph(doc, spec.spec_value || "—", y, marginX, { size: 9 });
      y += 6;
    }
  }
  y += 6;

  y = writeSectionTitle(doc, "Charges", y, marginX);
  if (input.chargeRows.length === 0) {
    y = writeParagraph(doc, "Rate card is not available for this equipment yet.", y, marginX, {
      size: 9,
      color: [100, 116, 139],
    });
  } else {
    for (const row of input.chargeRows) {
      const parts = [row.category];
      if (row.primary) parts.push(pdfSafe(row.primary));
      if (row.secondary) parts.push(`Additional: ${pdfSafe(row.secondary)}`);
      y = writeParagraph(doc, parts.filter(Boolean).join(" — "), y, marginX, { size: 9 });
    }
  }
  y += 10;

  y = writeSectionTitle(doc, "Contact us", y, marginX);
  if (input.contacts.length === 0) {
    y = writeParagraph(doc, "No contacts have been published for this instrument yet.", y, marginX, {
      size: 9,
      color: [100, 116, 139],
    });
  } else {
    let lastRole = "";
    for (const c of input.contacts) {
      if (c.role !== lastRole) {
        y += 4;
        y = writeParagraph(doc, c.role, y, marginX, { bold: true, size: 10 });
        lastRole = c.role;
      }
      const lines = [c.name];
      if (c.email) lines.push(c.email);
      if (c.phone) lines.push(c.phone);
      y = writeParagraph(doc, lines.join(" · "), y, marginX, { size: 9 });
    }
  }

  const filename = options?.filename || defaultFilename(input.code, input.name);
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
