// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ requestResearchZip: vi.fn(), getResearchFileUrl: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: api }));
vi.mock("sonner", () => ({ toast }));

import { downloadResearchZip, researchZipUrl } from "./downloadResearchFile";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("researchZipUrl", () => {
  it("joins the link onto relative and absolute API bases", () => {
    expect(researchZipUrl("/v1/my-research/downloads/t1/", "/api", "https://equip.iitr.ac.in")).toBe(
      "https://equip.iitr.ac.in/api/v1/my-research/downloads/t1/",
    );
    expect(researchZipUrl("/v1/my-research/downloads/t1/", "https://api.example.org/api/", "https://equip.iitr.ac.in")).toBe(
      "https://api.example.org/api/v1/my-research/downloads/t1/",
    );
  });
});

describe("downloadResearchZip", () => {
  it("requests a project zip and starts the browser download", async () => {
    api.requestResearchZip.mockResolvedValue({
      data: { path: "/v1/my-research/downloads/abc/", filename: "Polymer study.zip", file_count: 3, total_bytes: 2048, expires_in: 300 },
      status: 200,
    });
    const clicked: string[] = [];
    const spy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.href);
    });
    expect(await downloadResearchZip("ws1", null)).toBe(true);
    expect(api.requestResearchZip).toHaveBeenCalledWith("ws1", null);
    expect(clicked).toEqual([`${window.location.origin}/api/v1/my-research/downloads/abc/`]);
    expect(toast.success).toHaveBeenCalledWith("Downloading Polymer study.zip", expect.anything());
    spy.mockRestore();
  });

  it("shows the server's reason when the zip can't be made", async () => {
    api.requestResearchZip.mockResolvedValue({ error: "There are no files to download here yet.", status: 400 });
    expect(await downloadResearchZip("ws1", "f1")).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("There are no files to download here yet.");
  });
});
