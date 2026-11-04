// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import qrcode from "qrcode-generator";
import QrCode from "./QrCode";

function expectedPath(value: string): string {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  let path = "";
  for (let r = 0; r < qr.getModuleCount(); r += 1) {
    for (let c = 0; c < qr.getModuleCount(); c += 1) if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
  }
  return path;
}

describe("QrCode", () => {
  afterEach(() => cleanup());

  it("draws the symbol for exactly the given URL, with a 4-module quiet zone when asked", async () => {
    const url = "https://equip.iitr.ac.in/equipment/38";
    const { container } = render(<QrCode value={url} quiet={4} fill="#000000" label="QR" />);
    await waitFor(() => expect(container.querySelector("path")).toBeTruthy());
    const path = container.querySelector("path")!;
    expect(path.getAttribute("d")).toBe(expectedPath(url));
    expect(path.getAttribute("d")).not.toBe(expectedPath("https://equip.iitr.ac.in/equipment/39"));
    expect(path.getAttribute("fill")).toBe("#000000");
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")?.startsWith("-4 -4")).toBe(true);
    expect(svg.getAttribute("data-qr-value")).toBe(url);
  });

  it("keeps the staff app's defaults", async () => {
    const { container } = render(<QrCode value="x" label="QR" />);
    await waitFor(() => expect(container.querySelector("path")).toBeTruthy());
    expect(container.querySelector("svg")!.getAttribute("viewBox")?.startsWith("-2 -2")).toBe(true);
    expect(container.querySelector("path")!.getAttribute("fill")).toBe("#0f172a");
  });
});
