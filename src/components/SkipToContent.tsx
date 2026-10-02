import type { MouseEvent } from "react";

const MAIN_ID = "main-content";

/** Pages without a <main id="main-content"> fall back to the first <main>, then to whatever follows the header. */
function findMainTarget(link: HTMLElement): HTMLElement | null {
  const byId = document.getElementById(MAIN_ID);
  if (byId) return byId;
  const main = document.querySelector<HTMLElement>("main");
  if (main) return main;
  const header = link.parentElement?.querySelector("header") ?? document.querySelector("header");
  return (header?.nextElementSibling as HTMLElement | null) ?? null;
}

export function SkipToContent() {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = findMainTarget(e.currentTarget);
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus();
    target.scrollIntoView({ block: "start" });
  };

  return (
    <a
      href={`#${MAIN_ID}`}
      onClick={onClick}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      Skip to main content
    </a>
  );
}

export default SkipToContent;
