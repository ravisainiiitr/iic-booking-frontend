import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The pages Razorpay's website review asks for. They are plain files served by nginx: no sign-in, no JavaScript.
 * These tests read them exactly as published.
 */
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const PAGES = [
  { slug: "about-us", title: "About Us" },
  { slug: "contact-us", title: "Contact Us" },
  { slug: "pricing", title: "Pricing" },
  { slug: "terms-and-conditions", title: "Terms and Conditions" },
  { slug: "cancellation-refund-policy", title: "Cancellation and Refund Policy" },
  { slug: "service-delivery-policy", title: "Service Delivery Policy" },
];

// Routes of the React app a static page may link to (everything else must be a file in public/).
const APP_ROUTES = new Set(["/", "/analysis-charges"]);

const links = (html: string) => [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);

describe("Razorpay website review pages", () => {
  for (const { slug, title } of PAGES) {
    describe(slug, () => {
      const html = read(`public/${slug}/index.html`);

      it("names the page, the portal and the institution, with the official logo", () => {
        expect(html).toContain(`<title>${title} | IIT Roorkee Equipment Booking Portal</title>`);
        expect(html).toContain(`<link rel="canonical" href="https://equip.iitr.ac.in/${slug}/">`);
        expect(html).toContain("Indian Institute of Technology Roorkee");
        expect(html).toContain('<img src="/iitr-logo-64.png"');
        expect(html).toContain('name="viewport" content="width=device-width, initial-scale=1"');
      });

      it("has no placeholder text and needs no script", () => {
        expect(html).not.toMatch(/lorem|TODO|TBD|placeholder|\[insert|xxx/i);
        expect(html).not.toMatch(/<script/i);
      });

      it("links only to pages that exist", () => {
        for (const href of links(html)) {
          if (/^(https?:|mailto:|tel:|#)/.test(href)) continue;
          const path = href.split("#")[0];
          if (APP_ROUTES.has(path)) continue;
          const file = path.endsWith("/") ? `public${path}index.html` : `public${path}`;
          expect(existsSync(resolve(process.cwd(), file)), `${slug} links to ${href}`).toBe(true);
        }
      });

      it("links every other policy page from its footer", () => {
        for (const other of PAGES) expect(html).toContain(`href="/${other.slug}/"`);
        expect(html).toContain('href="/privacy-policy/"');
      });
    });
  }

  it("states the refund routes the portal actually has, and never promises a refund to the original payment method", () => {
    const html = read("public/cancellation-refund-policy/index.html");
    expect(html).toContain("<strong>portal wallet</strong>");
    expect(html).toMatch(/Refunds are <strong>not<\/strong> sent back automatically to the card, UPI account or bank account/);
    expect(html).toContain("More than 48 hours before the first slot</td><td>Full refund");
    expect(html).toContain("Between 48 and 24 hours before</td><td>50% refund");
    expect(html).toContain("Less than 24 hours before</td><td>No refund");
  });

  it("explains pricing without copying rates that live in the database", () => {
    const html = read("public/pricing/index.html");
    expect(html).toContain('href="/analysis-charges"');
    expect(html).toContain("GST at 18% applies to external users");
    expect(html).not.toMatch(/₹\s?\d/);
  });

  it("the privacy policy says the portal never stores card, CVV or UPI PIN details", () => {
    expect(read("public/privacy-policy/index.html")).toContain("full card number, CVV or UPI PIN, and never asks for them");
  });
});
