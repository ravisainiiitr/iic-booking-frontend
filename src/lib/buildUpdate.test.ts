import { afterEach, describe, expect, it, vi } from "vitest";
import { entryScriptFromHtml, isNewBuildDeployed } from "./buildUpdate";

const html = (entry: string) =>
  `<!doctype html><html><head><script src="/config.js"></script>` +
  `<script type="module" crossorigin src="${entry}"></script></head><body></body></html>`;

describe("entryScriptFromHtml", () => {
  it("finds the hashed Vite entry script", () => {
    expect(entryScriptFromHtml(html("/assets/index-DvyoLwho.js"))).toBe("/assets/index-DvyoLwho.js");
  });

  it("returns null for the dev index.html", () => {
    expect(entryScriptFromHtml('<script type="module" src="/src/main.tsx"></script>')).toBeNull();
  });
});

describe("isNewBuildDeployed", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubFetch = (body: string, ok = true) =>
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, text: () => Promise.resolve(body) }));

  it("is true when index.html points at another build", async () => {
    stubFetch(html("/assets/index-NEW.js"));
    await expect(isNewBuildDeployed("/assets/index-OLD.js")).resolves.toBe(true);
  });

  it("is false for the same build, a failed request or an unrecognised page", async () => {
    stubFetch(html("/assets/index-OLD.js"));
    await expect(isNewBuildDeployed("/assets/index-OLD.js")).resolves.toBe(false);
    stubFetch(html("/assets/index-NEW.js"), false);
    await expect(isNewBuildDeployed("/assets/index-OLD.js")).resolves.toBe(false);
    stubFetch("<html>maintenance</html>");
    await expect(isNewBuildDeployed("/assets/index-OLD.js")).resolves.toBe(false);
  });
});
