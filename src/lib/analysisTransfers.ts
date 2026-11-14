/**
 * Large-data transfers for Remote Analysis (contract: raa-large-data-contract.md, v1.2).
 *
 * Raw data is pre-loaded onto the reserved Analysis PC before the user joins, and results upload from an outbox
 * after the session ends. Every field is optional: older portals send none of them and the UI simply hides.
 */
import { formatBytes, plural } from "@/lib/analysisSync";

export type InputPreload = {
  state?: "queued" | "downloading" | "ready" | "failed" | string;
  files_done?: number;
  files_total?: number;
  bytes_done?: number;
  bytes_total?: number;
  eta_seconds?: number | null;
  detail?: string | null;
};

export type OutputUpload = {
  state?: "uploading" | "paused" | "done" | "failed" | string;
  bytes_done?: number;
  bytes_total?: number;
  files_done?: number;
  files_total?: number;
  eta_seconds?: number | null;
  paused_reason?: string | null;
  destination_label?: string | null;
  my_research_href?: string | null;
};

export type KeepRunning = {
  allowed?: boolean;
  active?: boolean;
  until?: string | null;
  reason?: string | null;
};

export type TransferEstimate = {
  size_limit_bytes?: number | null;
  input_bytes?: number | null;
  download_mbps?: number | null;
  upload_mbps?: number | null;
};

export type LinkSpeed = { upload_mbps?: number | null; download_mbps?: number | null; measured_at?: string | null };

/** "about 6 min", "about 1 h 20 min", "under a minute". */
export function formatEta(seconds?: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 60) return "under a minute";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `about ${h} h ${m} min` : `about ${h} h`;
}

export function transferPercent(done?: number | null, total?: number | null): number | null {
  const t = Number(total || 0);
  if (!(t > 0)) return null;
  return Math.max(0, Math.min(100, Math.floor((Number(done || 0) / t) * 100)));
}

/** Seconds to move `bytes` at `mbps` megabits per second. */
export function secondsFor(bytes?: number | null, mbps?: number | null): number | null {
  const b = Number(bytes || 0);
  const r = Number(mbps || 0);
  if (!(b > 0) || !(r > 0)) return null;
  return Math.ceil((b * 8) / (r * 1_000_000));
}

export type TransferView = {
  tone: "progress" | "done" | "paused" | "failed";
  title: string;
  detail: string;
  percent: number | null;
};

const sizeLine = (done?: number, total?: number) =>
  total ? `${formatBytes(done)} of ${formatBytes(total)}` : done ? formatBytes(done) : "";

export function describeInputPreload(p?: InputPreload | null): TransferView | null {
  if (!p || !p.state) return null;
  const files = p.files_total ? `${p.files_done ?? 0} of ${plural(p.files_total, "file")}` : "";
  const parts = [files, sizeLine(p.bytes_done, p.bytes_total), formatEta(p.eta_seconds)].filter(Boolean);
  if (p.state === "ready") {
    return {
      tone: "done",
      title: "Your data is ready on the Analysis PC",
      detail: p.files_total ? `${plural(p.files_total, "file")} · ${formatBytes(p.bytes_total)}` : "",
      percent: 100,
    };
  }
  if (p.state === "failed") {
    return {
      tone: "failed",
      title: "Your data could not be prepared in advance",
      detail: p.detail === "disk_full"
        ? "The Analysis PC is short of space. Lab staff have been told; your data is copied when you join."
        : "It is copied when you join instead.",
      percent: null,
    };
  }
  return {
    tone: "progress",
    title: p.state === "queued" ? "Your data will be prepared on the Analysis PC" : "Preparing your data on the Analysis PC",
    detail: parts.join(" · "),
    percent: transferPercent(p.bytes_done, p.bytes_total),
  };
}

export function describeOutputUpload(u?: OutputUpload | null): TransferView | null {
  if (!u || !u.state) return null;
  const where = u.destination_label || "My Research";
  if (u.state === "done") {
    return {
      tone: "done",
      title: `Your results are in ${where}`,
      detail: u.files_total ? `${plural(u.files_total, "file")} · ${formatBytes(u.bytes_total)} uploaded and checked` : "Uploaded and checked",
      percent: 100,
    };
  }
  if (u.state === "failed") {
    return {
      tone: "failed",
      title: "Uploading your results needs attention",
      detail: "Your files are kept safe on the Analysis PC. Lab staff have been told.",
      percent: transferPercent(u.bytes_done, u.bytes_total),
    };
  }
  const line = [sizeLine(u.bytes_done, u.bytes_total), formatEta(u.eta_seconds)].filter(Boolean).join(" · ");
  if (u.state === "paused") {
    return {
      tone: "paused",
      title: "Uploading your results is paused",
      detail: [u.paused_reason || "It continues by itself when the Analysis PC is back online.", line].filter(Boolean).join(" · "),
      percent: transferPercent(u.bytes_done, u.bytes_total),
    };
  }
  return {
    tone: "progress",
    title: `Uploading your results to ${where}`,
    detail: line ? `${line}. You can close this page; you will be told when it is done.` : "You can close this page; you will be told when it is done.",
    percent: transferPercent(u.bytes_done, u.bytes_total),
  };
}

/** Size warning + time estimate for the setup screen, or null when there is nothing worth saying. */
export function describeEstimate(t?: TransferEstimate | null): { warn: boolean; text: string } | null {
  if (!t) return null;
  const bytes = Number(t.input_bytes || 0);
  if (t.size_limit_bytes && bytes > t.size_limit_bytes) {
    return {
      warn: true,
      text: `Your input data (${formatBytes(bytes)}) is over this booking's limit of ${formatBytes(t.size_limit_bytes)}. Choose fewer files or ask the lab.`,
    };
  }
  const eta = formatEta(secondsFor(bytes, t.download_mbps));
  if (bytes >= 1024 ** 3 && eta) {
    return { warn: false, text: `${formatBytes(bytes)} of input data. Copying it to the Analysis PC takes ${eta}; it starts before you join.` };
  }
  return null;
}

export function formatLinkSpeed(s?: LinkSpeed | null): string | null {
  if (!s || (s.upload_mbps == null && s.download_mbps == null)) return null;
  const f = (v?: number | null) => (v == null ? "—" : `${Math.round(Number(v))}`);
  return `↑ ${f(s.upload_mbps)} / ↓ ${f(s.download_mbps)} Mbps`;
}

export function formatClock(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
