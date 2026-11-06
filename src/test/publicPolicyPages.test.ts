import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The privacy and data deletion pages are plain files served by nginx, so they need no sign-in and no JavaScript
 * (Meta's reviewers read them directly). These tests read the files exactly as they are published.
 */
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const PAGES = [
  {
    file: "public/privacy-policy/index.html",
    url: "https://equip.iitr.ac.in/privacy-policy/",
    title: "Privacy Policy | IIT Roorkee Equipment Booking Portal",
    other: "/data-deletion/",
    sections: [
      "Introduction and scope", "Who we are", "Information we collect", "Why we collect it",
      "How it is processed and used", "Booking and administrative workflows", "WhatsApp notifications",
      "Payment processing and transaction information", "File storage and document handling",
      "Sharing and third-party service providers", "Data retention and deletion", "Data security measures",
      "Your choices and how to raise a privacy request", "Cookies and technical information",
      "Changes to this policy", "Contact information",
    ],
  },
  {
    file: "public/data-deletion/index.html",
    url: "https://equip.iitr.ac.in/data-deletion/",
    title: "Data Deletion Instructions | IIT Roorkee Equipment Booking Portal",
    other: "/privacy-policy/",
    sections: [
      "Introduction", "What you can ask us to delete", "How to make a request", "Where to send it", "What to include",
      "Verifying your identity", "How requests are reviewed and processed", "Information that may be retained",
      "Uploaded files and AWS S3 objects", "WhatsApp notification records", "Backups and audit logs",
      "Expected acknowledgement and processing timelines",
    ],
  },
];

const hrefs = (html: string) => [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);

describe.each(PAGES)("$file", ({ file, url, title, other, sections }) => {
  const html = read(file);
  const visible = html.replace(/<style>[\s\S]*?<\/style>/, "");

  it("has the title, description, canonical address and stays open to crawlers", () => {
    expect(html).toContain(`<title>${title}</title>`);
    expect(html).toMatch(/<meta name="description" content="[^"]{50,}">/);
    expect(html).toContain(`<link rel="canonical" href="${url}">`);
    expect(html).toContain('<meta name="robots" content="index, follow">');
    expect(html).not.toMatch(/noindex|nofollow/i);
  });

  it("shows its content without JavaScript, and loads nothing from other sites", () => {
    expect(html).not.toMatch(/<script|<iframe|\son[a-z]+=/i);
    expect(html).not.toContain('id="root"');
    expect(html.match(/<link [^>]*rel="stylesheet"/)).toBeNull();
    const headAssets = [...html.matchAll(/(?:<img[^>]+src|<link rel="icon"[^>]+href)="([^"]+)"/g)].map((m) => m[1]);
    expect(headAssets.length).toBeGreaterThan(0);
    for (const asset of headAssets) expect(asset.startsWith("/")).toBe(true);
    expect(html).not.toMatch(/url\(/);
  });

  it("has every required section, in order, each listed in the contents", () => {
    const headings = [...html.matchAll(/<h2>(\d+)\. ([^<]+)<\/h2>/g)];
    expect(headings.map((m) => m[2].replace(/&amp;/g, "&"))).toEqual(sections);
    headings.forEach((m, i) => expect(Number(m[1])).toBe(i + 1));
    const tocLinks = [...html.matchAll(/<li><a href="#([a-z-]+)">/g)].map((m) => m[1]);
    expect(tocLinks).toHaveLength(sections.length);
  });

  it("has no broken links within the page", () => {
    for (const href of hrefs(html).filter((h) => h.startsWith("#"))) {
      expect(html, href).toContain(`id="${href.slice(1)}"`);
    }
  });

  it("names the institute only, with the official email and a visible date", () => {
    expect(visible).toContain("Indian Institute of Technology Roorkee");
    expect(visible).toContain("IIT Roorkee Equipment Booking Portal");
    expect(visible).toMatch(/Last updated: \d{1,2} [A-Z][a-z]+ \d{4}/);
    expect(visible).toContain('href="mailto:equip@iitr.ac.in');
    const emails = new Set(visible.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g));
    expect([...emails]).toEqual(["equip@iitr.ac.in"]);
    expect(visible).not.toMatch(/\bIIC\b|Instrumentation Cent|\bSRIC\b|iic@|tel:|\+91|01332|\b\d{10}\b/i);
  });

  it("links to the other policy page and back to the portal", () => {
    expect(hrefs(html)).toContain(other);
    expect(hrefs(html)).toContain("/");
  });

  it("gives away no internal configuration", () => {
    const forbidden =
      /\/api\/|\/admin|DATABASE_URL|postgres|\bRDS\b|\bEC2\b|docker|nginx|apache|iic-booking|amazonaws|s3:\/\/|AKIA[0-9A-Z]{16}|ap-south-1|SECRET|ACCESS_KEY|WHATSAPP_|RAZORPAY_|localhost|127\.0\.0\.1|\bwamid\b|phone_number_id/i;
    expect(visible).not.toMatch(forbidden);
  });

  it("makes no compliance or absolute promises", () => {
    expect(visible).not.toMatch(
      /GDPR|DPDP|ISO ?27001|complian(t|ce) with|fully secure|100%|immediately delete|permanently delete all|never shared|do(es)? not share|no third part(y|ies)/i,
    );
  });
});

describe("what the pages must say", () => {
  const privacy = read("public/privacy-policy/index.html");
  const deletion = read("public/data-deletion/index.html");

  it("names the providers that really handle data", () => {
    for (const name of ["Amazon Web Services", "Razorpay", "Meta", "Firebase", "OpenAI", "I-STEM"]) {
      expect(privacy).toContain(name);
    }
  });

  it("explains WhatsApp consent and the STOP reply on both pages", () => {
    for (const html of [privacy, deletion]) {
      expect(html).toContain("STOP");
      expect(html).toContain("WhatsApp notifications");
    }
    expect(privacy).toContain("START");
  });

  it("does not hide the limits of deletion", () => {
    expect(deletion).toContain("does not have a button that deletes your account");
    expect(deletion).toContain("the stored copy stays in S3");
    expect(privacy).toContain("does not by itself erase the stored copy");
    expect(deletion).toContain("may be retained");
    expect(deletion).toMatch(/not guarantees/);
  });

  it("keeps both pages' styles the same", () => {
    const style = (html: string) => html.match(/<style>[\s\S]*?<\/style>/)?.[0];
    expect(style(privacy)).toBeTruthy();
    expect(style(deletion)).toBe(style(privacy));
  });

  it("relies on nginx serving a folder's index.html ahead of the app", () => {
    expect(read("compose/production/nginx.conf")).toContain("try_files $uri $uri/ /index.html;");
  });
});
