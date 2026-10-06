# Theme and responsive UI

How the portal handles light/dark mode and different screen sizes (Android and iOS phones, Android
tablets, iPads, desktops), and the rules to follow when adding or changing UI.

## 1. Light and dark mode

**The operating system decides.** The portal follows `prefers-color-scheme` and nothing else:

- There is no theme toggle, theme selector, theme provider or stored preference (no localStorage,
  cookie, database or profile field). Do not add one.
- Changing the OS / browser appearance switches the open page immediately (it is pure CSS; no reload
  and no JavaScript involved).
- `src/main.tsx` removes the `theme` localStorage key that the former `next-themes` setup stored.
- `index.html` declares `<meta name="color-scheme" content="light dark">` and two `theme-color` metas
  (light `#ffffff`, dark `#151d2a`) so the browser chrome, scrollbars, form controls and the Android /
  iOS status bar match the theme. The boot splash in `index.html` also has a dark variant, so there is
  no white flash before React mounts.

**Tailwind `dark:` means "OS is dark".** `tailwind.config.ts` sets

```ts
darkMode: ["variant", "@media screen and (prefers-color-scheme: dark) { & }"]
```

so every `dark:` utility is a media query. There is no `.dark` class anywhere; do not add one.
The `screen` qualifier keeps printed pages light.

### Semantic tokens

Colours live as HSL channels in `src/index.css` (`:root` for light, an
`@media screen and (prefers-color-scheme: dark)` block for dark) and are mapped in
`tailwind.config.ts`. Use these instead of raw palette classes:

| Purpose | Classes |
|---|---|
| Page / surfaces | `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-secondary` |
| Text | `text-foreground`, `text-muted-foreground`, `text-card-foreground` |
| Lines / inputs | `border-border`, `border-input`, `ring-ring` |
| Interactive | `bg-primary text-primary-foreground`, `bg-accent text-accent-foreground` |
| Navy brand surfaces with white text | `bg-brand text-brand-foreground`, `bg-brand-accent` |
| Status (solid) | `bg-success`, `bg-warning`, `bg-info`, `bg-destructive` + matching `-foreground` |
| Status (soft panels / badges) | `bg-success-subtle text-success-subtle-foreground border-success-border` (same for `warning`, `info`, `destructive`) |
| Modal backdrop | `bg-overlay/70` |
| Charts | `hsl(var(--chart-1))` … `hsl(var(--chart-6))` |
| Sidebar | `bg-sidebar`, `text-sidebar-foreground`, … |

Important differences between the themes:

- `primary` is navy in light mode and a light blue in dark mode, and `primary-foreground` flips
  accordingly (white / dark navy). **Never put `text-white` on `bg-primary`**. Use
  `text-primary-foreground`, or use `bg-brand` when the design needs a navy surface with white text
  in both themes (heroes, selected slots, "booked" states, primary CTAs on accent cards).
- Dark surfaces are navy/slate, not black: background `220 36% 7.5%`, cards `217 33% 12.5%`,
  popovers slightly lighter. Elevation is shown with lighter surfaces and borders rather than
  shadows.
- A solid coloured fill with white text must have at least 4.5:1 contrast: use the 700 shade
  (`bg-green-700`, `bg-emerald-700`, `bg-red-700`, …) and pin `text-white`. The `Badge`/`Button`
  default variants use `primary-foreground`, which is dark navy in dark mode. Amber/yellow fills take
  dark text (`text-amber-950 dark:text-amber-950`).

### Legacy palette classes (dark bridge)

Older screens use light tints such as `bg-amber-50 text-amber-900 border-amber-200` without a `dark:`
partner. `tailwind/darkPaletteBridge.ts` is a Tailwind plugin that, at build time:

1. scans the string literals in `src` for palette classes (`bg|text|border|from|via|to` with
   `white`, `black`, the neutral scales and the hue scales) whose class string has **no `dark:`
   colour for the same property**;
2. emits, inside the dark media query, a rule per class that maps pale backgrounds to tinted dark
   surfaces, dark text to light text and pale borders to muted tinted borders;
3. guards each rule with `:not([class*="dark:bg-"])` (or `text`/`border`/gradient) so an element that
   declares its own `dark:` colour always wins.

Translucent fills (`bg-white/15` on a navy hero, `bg-amber-50/20`) are left alone. The bridge keeps
old pages readable; it is not the design system. **New code should use the semantic tokens or explicit
`dark:` variants**, and the bridge output shrinks as legacy classes go away (it is about 12 KB of CSS
before gzip today).

If a legacy class must stay light in dark mode on purpose (e.g. a printed-paper preview), give the
element an explicit `dark:` class for that property.

### Things that keep their colours

- **Admin-configured slot-calendar legend colours** (`/calendar-colors`) are applied as inline
  styles. In dark mode `.calendar-color-cell` dims them (`filter: brightness(0.7) saturate(1.2)`) so the
  cells still match the legend (which has the same class) without pastel glare.
- Images, equipment photos, logos and SVG illustrations are not inverted.
- Toasts (`sonner`) read the OS scheme through `theme="system"`.

## 2. Viewport, safe areas and dynamic height

- `index.html` uses `viewport-fit=cover`, so content may extend under the notch / home indicator.
  Anything fixed or sticky must pad itself with `env(safe-area-inset-*)`:
  the header pads the top, bottom bars and sheets pad the bottom, side sheets pad their side.
- **Height:** do not use `100vh` / `h-screen` for full-height layouts on mobile; mobile browser
  toolbars make `vh` taller than the visible area. Use the variables from `src/index.css`:
  - `--viewport-h`: `100dvh` (falls back to `100vh` where `dvh` is unsupported), for things that
    must fit exactly (dialogs, drawers);
  - `--viewport-min-h`: `100svh` (fallback `100vh`), for `min-height` of page shells so content
    never jumps when the toolbar collapses.
  Example: `min-h-[var(--viewport-min-h,100vh)]`, `max-h-[calc(var(--viewport-h,100vh)-2rem)]`.
  Arbitrary values that use `dvh` directly have no fallback on very old browsers, which is why the
  primitives go through the variables.
- **Fixed header offset:** `Header.tsx` measures its real height with a `ResizeObserver` and
  publishes it as `--site-header-h` (the CSS default covers first paint). Pages under the fixed
  header use `pt-[calc(var(--site-header-h)+…)]`, never a hard-coded `pt-24`.

## 3. Primitives (src/components/ui)

These already handle phones, tablets and safe areas. Prefer them to hand-rolled overlays.

- **Dialog / AlertDialog:** width `calc(100% - 1.5rem)` on phones; `max-height` is the dynamic
  viewport minus the safe areas, and the content scrolls inside (`overflow-y-auto overscroll-contain`).
  The close button is a 40px target. Overlay `bg-overlay/70`. Long forms: keep the footer inside the
  scrolling content, or split into steps.
- **Sheet:** safe-area padding on the edge it attaches to, scrolls internally, close button offset
  by the safe area.
- **Drawer (vaul):** max height `var(--viewport-h) - safe-area-top - 1rem`, bottom padding
  `env(safe-area-inset-bottom)`.
- **Select / DropdownMenu / Popover:** content is limited to the viewport width and to
  `--radix-popper-available-height` (menus scroll instead of running off-screen).
- **Button / Input / Select trigger:** on touch screens (`pointer: coarse`) default, `lg` and icon
  sizes get `min-height: 44px` (`COARSE_MIN_H` in `src/lib/utils.ts`). The minimum is skipped when the
  caller passes an explicit `h-*`, `size-*` or `min-h-*`, or for `variant="link"`.
- **Checkbox / Radio / Switch** keep their visual size but get an invisible hit area of 44px on
  coarse pointers (`::after` in `src/index.css`). Menu items and options get 44px rows, tabs 40px.
- **Tables:** the `Table` primitive wraps the table in an `overflow-auto` container so a wide table
  scrolls inside its card and the page itself never scrolls sideways. Hand-built `<table>`s need the
  same wrapper; on phones consider a stacked card layout for key screens.

## 4. Layout rules

- **No page-level horizontal scroll at any width from 320px up.** Typical causes: fixed widths
  (`w-[600px]`), long unbroken strings (use `break-words` / `min-w-0` on flex children), button rows
  without `flex-wrap`, and absolutely positioned elements (including `sr-only` text) inside a
  scroller that is not `relative`.
- Breakpoints are Tailwind's defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536).
  iPad portrait (768–834) uses `md`; iPad landscape / Android tablets in landscape (1024–1366) use
  `lg`/`xl`. Do not assume `md` means a mouse; check `pointer: coarse` for touch-only behaviour.
- Touch targets: 44×44 for primary actions; at least 24×24 everywhere (WCAG 2.2 AA). Inline text links
  inside sentences are exempt.
- Don't rely on hover alone: anything revealed on hover must also be reachable by tap / focus.

## 5. Accessibility and motion

- Text contrast meets WCAG AA (4.5:1, or 3:1 for large text) in both themes. Avoid
  `text-muted-foreground/70`-style opacity on small text; use `text-muted-foreground`.
- Focus rings use `ring-ring`, which is visible in both themes.
- `prefers-reduced-motion: reduce` shortens transitions and animations to effectively zero globally
  (`src/index.css`); loading spinners (`animate-spin`) keep turning so progress stays visible.
- Status is never shown by colour alone: badges carry text, calendar cells carry a label or an
  `aria-label`.

## 6. Verifying a change

Automated checks (all must stay green): `npx tsc --noEmit -p tsconfig.app.json` (do not increase the
error count), ESLint on changed files, `npm test`, `npm run check:guides`, `npm run build`.

Manual check for UI changes:

1. In Chrome DevTools, open the Rendering panel and set **Emulate CSS media feature
   prefers-color-scheme** to light and to dark. In Playwright, use
   `page.emulateMedia({ colorScheme: "dark" })` or the context option `colorScheme`.
2. Check widths 320, 375, 390, 430 (phones), 768, 820, 1024 (tablets) and 1280, 1440, 1920 (desktop),
   including iPad landscape. Look for horizontal scroll, clipped dialogs, unreadable text, and pale
   panels in dark mode.
3. On a real phone, check that the header clears the notch, that bottom actions clear the home
   indicator, and that dialogs with the keyboard open still scroll.

The release that introduced this system was audited with a Playwright matrix (chromium, webkit and
firefox; 18 viewports plus Pixel 7, Galaxy Tab S4, iPhone 15, iPhone SE, iPad Pro 11 and iPad Mini
device profiles; light and dark) that checks horizontal overflow, pale surfaces in dark mode, text
contrast, touch-target size and that the theme follows `emulateMedia` live without a reload.
