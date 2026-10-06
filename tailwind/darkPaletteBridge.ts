import fs from "node:fs";
import path from "node:path";
import plugin from "tailwindcss/plugin";
import colors from "tailwindcss/colors";

/**
 * Dark-mode bridge for legacy Tailwind palette classes.
 *
 * Older screens use light tints such as `bg-amber-50 text-amber-900 border-amber-200` without a
 * `dark:` partner, so they stay pale (or become unreadable) when the OS is in dark mode. Under
 * `prefers-color-scheme: dark` this plugin maps those classes to tinted dark surfaces / light text,
 * but only on elements that do not already declare their own `dark:` colour for that property.
 *
 * New code should use the semantic tokens (bg-card, text-muted-foreground, bg-warning-subtle, ...)
 * or explicit `dark:` variants. Rules are emitted only for classes found in `src`, so the CSS cost
 * stays proportional to the legacy usage.
 */

type Rgb = [number, number, number];

const HUES = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan",
  "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
] as const;
const NEUTRALS = ["slate", "gray", "zinc", "neutral", "stone"] as const;

/** Dark-theme card surface (keep in sync with --card under prefers-color-scheme: dark in index.css). */
const DARK_CARD = hslToRgb(217, 33, 12.5);

function hslToRgb(h: number, s: number, l: number): Rgb {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function mix(color: string, amount: number): string {
  const c = hexToRgb(color);
  const [r, g, b] = c.map((v, i) => Math.round(v * amount + DARK_CARD[i] * (1 - amount)));
  return `${r} ${g} ${b}`;
}

const palette = colors as unknown as Record<string, Record<string, string>>;

const TINT_AMOUNT: Record<string, number> = { "50": 0.14, "100": 0.2, "200": 0.3 };
const HOVER_TINT_AMOUNT: Record<string, number> = { "50": 0.24, "100": 0.28, "200": 0.38 };
const BORDER_AMOUNT: Record<string, number> = { "100": 0.3, "200": 0.4, "300": 0.5 };
const TEXT_SHADE: Record<string, string> = { "500": "400", "600": "400", "700": "300", "800": "200", "900": "200", "950": "100" };

const NEUTRAL_BG: Record<string, string> = {
  white: "var(--card)",
  "50": "var(--background)",
  "100": "var(--muted)",
  "200": "var(--secondary)",
};
const NEUTRAL_HOVER_BG: Record<string, string> = { white: "var(--muted)", "50": "var(--muted)", "100": "var(--muted)", "200": "var(--secondary)" };
const NEUTRAL_TEXT: Record<string, string> = {
  black: "var(--foreground)",
  "950": "var(--foreground)",
  "900": "var(--foreground)",
  "800": "var(--foreground)",
  "700": "var(--foreground) / 0.88",
  "600": "var(--muted-foreground)",
  "500": "var(--muted-foreground)",
};
const NEUTRAL_BORDER: Record<string, string> = { "100": "var(--border)", "200": "var(--border)", "300": "var(--input)" };

const CLASS_RE = new RegExp(
  String.raw`(?<![\w:/-])(hover:)?(bg|text|border|from|via|to)-(white|black|${[...HUES, ...NEUTRALS].join("|")})(?:-(\d{2,3}))?(\/\d{1,3})?(?![\w-])`,
  "g",
);

const STRING_RE = /(["'`])((?:(?!\1)[^\\\n]|\\.)*?)\1/g;
const DARK_GROUP_RE: Record<string, RegExp> = {
  bg: /dark:bg-/,
  text: /dark:text-/,
  border: /dark:border-/,
  gradient: /dark:(?:from|via|to|bg)-/,
};
const groupOf = (prop: string) => (prop === "from" || prop === "via" || prop === "to" ? "gradient" : prop);

/** Palette classes used in a class string that has no `dark:` colour for the same property. */
function collectSourceClasses(srcDir: string): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        for (const [, , literal] of fs.readFileSync(full, "utf8").matchAll(STRING_RE)) {
          for (const m of literal.matchAll(CLASS_RE)) {
            const darkRe = DARK_GROUP_RE[groupOf(m[2])];
            const scoped = m[1] ? new RegExp(darkRe.source.replace("dark:", "dark:hover:")) : darkRe;
            if (!scoped.test(literal)) found.add(m[0]);
          }
        }
      }
    }
  };
  if (fs.existsSync(srcDir)) walk(srcDir);
  return found;
}

const esc = (cls: string) => cls.replace(/[:/]/g, (c) => `\\${c}`);

function alphaOf(suffix: string | undefined): number | null {
  return suffix ? Number(suffix.slice(1)) / 100 : null;
}

function withAlpha(channels: string, alpha: number | null, isVar: boolean): string {
  if (isVar) {
    const [v, own] = channels.split(" / ");
    const a = alpha ?? (own ? Number(own) : null);
    return a == null ? `hsl(${v})` : `hsl(${v} / ${a})`;
  }
  return alpha == null ? `rgb(${channels})` : `rgb(${channels} / ${alpha})`;
}

interface Bridge {
  /** Tailwind property group used by the `dark:` opt-out check. */
  group: string;
  decl: Record<string, string>;
}

function resolve(token: string): Bridge | null {
  CLASS_RE.lastIndex = 0;
  const m = CLASS_RE.exec(token);
  if (!m) return null;
  const [, hover, prop, name, shade, alphaSuffix] = m;
  const alpha = alphaOf(alphaSuffix);
  const isNeutral = (NEUTRALS as readonly string[]).includes(name) || name === "white" || name === "black";
  const isHue = (HUES as readonly string[]).includes(name);
  const key = name === "white" || name === "black" ? name : shade;
  if (!key) return null;

  if (prop === "bg") {
    // Translucent fills (bg-white/15 on a navy hero, bg-amber-50/20 overlays) already read as dark.
    if (alpha != null && alpha < (name === "white" ? 0.7 : 0.4)) return null;
    if (isNeutral) {
      const v = (hover ? NEUTRAL_HOVER_BG : NEUTRAL_BG)[key];
      if (!v || name === "black") return null;
      return { group: "bg", decl: { "background-color": withAlpha(v, alpha, true) } };
    }
    const amount = (hover ? HOVER_TINT_AMOUNT : TINT_AMOUNT)[key];
    if (!isHue || amount == null) return null;
    return { group: "bg", decl: { "background-color": withAlpha(mix(palette[name]["600"], amount), alpha, false) } };
  }

  if (prop === "text") {
    if (isNeutral) {
      const v = NEUTRAL_TEXT[key];
      if (!v || name === "white") return null;
      return { group: "text", decl: { color: withAlpha(v, alpha, true) } };
    }
    const target = TEXT_SHADE[key];
    if (!isHue || !target) return null;
    const [r, g, b] = hexToRgb(palette[name][target]);
    return { group: "text", decl: { color: withAlpha(`${r} ${g} ${b}`, alpha, false) } };
  }

  if (prop === "border") {
    if (hover) return null;
    if (isNeutral) {
      const v = NEUTRAL_BORDER[key];
      if (!v) return null;
      return { group: "border", decl: { "border-color": withAlpha(v, alpha, true) } };
    }
    const amount = BORDER_AMOUNT[key];
    if (!isHue || amount == null) return null;
    return { group: "border", decl: { "border-color": withAlpha(mix(palette[name]["500"], amount), alpha, false) } };
  }

  // Gradient stops: only pale stops need a dark counterpart.
  if (hover) return null;
  let stop: string | null = null;
  if (isNeutral) {
    const v = NEUTRAL_BG[key];
    if (v && name !== "black") stop = withAlpha(v, alpha, true);
  } else if (isHue && TINT_AMOUNT[key] != null) {
    stop = withAlpha(mix(palette[name]["600"], TINT_AMOUNT[key]), alpha, false);
  }
  if (!stop) return null;
  const transparent = stop.replace(/(rgb|hsl)\((.*?)(?: \/ [\d.]+)?\)$/, "$1($2 / 0)");
  if (prop === "from") {
    return {
      group: "gradient",
      decl: {
        "--tw-gradient-from": `${stop} var(--tw-gradient-from-position)`,
        "--tw-gradient-to": `${transparent} var(--tw-gradient-to-position)`,
        "--tw-gradient-stops": "var(--tw-gradient-from), var(--tw-gradient-to)",
      },
    };
  }
  if (prop === "via") {
    return {
      group: "gradient",
      decl: {
        "--tw-gradient-to": `${transparent} var(--tw-gradient-to-position)`,
        "--tw-gradient-stops": `var(--tw-gradient-from), ${stop} var(--tw-gradient-via-position), var(--tw-gradient-to)`,
      },
    };
  }
  return { group: "gradient", decl: { "--tw-gradient-to": `${stop} var(--tw-gradient-to-position)` } };
}

const OPT_OUT: Record<string, string> = {
  bg: `:not([class*="dark:bg-"])`,
  text: `:not([class*="dark:text-"])`,
  border: `:not([class*="dark:border-"])`,
  gradient: `:not([class*="dark:from-"]):not([class*="dark:via-"]):not([class*="dark:to-"]):not([class*="dark:bg-"])`,
};

export default function darkPaletteBridge(srcDir: string) {
  return plugin(({ addBase }) => {
    const groups = new Map<string, string[]>();
    for (const token of [...collectSourceClasses(srcDir)].sort()) {
      const bridge = resolve(token);
      if (!bridge) continue;
      const hover = token.startsWith("hover:");
      const optOut = hover ? OPT_OUT[bridge.group].replace(/dark:/g, "dark:hover:") : OPT_OUT[bridge.group];
      const selector = `.${esc(token)}${optOut}${hover ? ":hover" : ""}`;
      const body = JSON.stringify(bridge.decl);
      groups.set(body, [...(groups.get(body) ?? []), selector]);
    }
    if (!groups.size) return;
    const rules: Record<string, Record<string, string>> = {};
    for (const [body, selectors] of groups) rules[selectors.join(",\n")] = JSON.parse(body);
    addBase({ "@media screen and (prefers-color-scheme: dark)": rules });
  });
}
