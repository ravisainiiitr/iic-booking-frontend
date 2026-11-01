// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const getPolicyPages = vi.fn();
vi.mock("@/lib/api", () => ({ apiClient: { getPolicyPages: () => getPolicyPages() } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock("@/components/UserGuide/UserGuideProvider", () => ({ useUserGuide: () => ({ openGuide: () => undefined }) }));
vi.mock("@/contexts/EmbeddedModeContext", () => ({ useEmbeddedMode: () => false }));

import Footer from "@/components/Footer";
import { sanitizeCmsHtml } from "@/lib/cmsHtml";
import { resetPolicyPagesCache } from "@/lib/policyPages";

describe("footer policy links", () => {
  afterEach(() => {
    cleanup();
    resetPolicyPagesCache();
    getPolicyPages.mockReset();
  });

  it("links each published policy page, plus pricing and the postal address", async () => {
    getPolicyPages.mockResolvedValue({
      data: { pages: [{ slug: "terms-and-conditions", title: "Terms and Conditions" }, { slug: "refund-policy", title: "Refund and Cancellation Policy" }] },
    });
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect((await screen.findByText("Terms and Conditions")).closest("a")?.getAttribute("href")).toBe("/page/terms-and-conditions");
    expect(screen.getByText("Refund and Cancellation Policy").closest("a")?.getAttribute("href")).toBe("/page/refund-policy");
    expect(screen.getByText("Pricing (Analysis Charges)").closest("a")?.getAttribute("href")).toBe("/analysis-charges");
    expect(screen.getByText(/Roorkee 247667/)).toBeTruthy();
    expect(screen.queryByText("Privacy Policy")).toBeNull();
  });

  it("shows no policy links when none is published or the request fails", async () => {
    getPolicyPages.mockRejectedValue(new Error("offline"));
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(await screen.findByText("Pricing (Analysis Charges)")).toBeTruthy();
    expect(screen.queryByText("Terms and Conditions")).toBeNull();
  });
});

describe("CMS HTML blocks", () => {
  it("keep formatting and drop scripts, handlers, javascript links and frames", () => {
    const clean = sanitizeCmsHtml(
      '<p style="color:red"><b>Hi</b></p><img src=x onerror="alert(1)"><a href="javascript:alert(1)">x</a>' +
        "<script>alert(2)</script><iframe src=//evil></iframe><svg><script>alert(3)</script></svg>" +
        '<IMG SRC=x ONERROR=alert(4)><scr<script>ipt>alert(5)</script>',
    );
    expect(clean).toContain('<p style="color:red"><b>Hi</b></p>');
    expect(clean).not.toMatch(/onerror|<script|javascript:|<iframe/i);
  });
});
