import type { ReactNode } from "react";
import iitrLogo128 from "@/assets/iitr-logo-128.webp";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

/** Compact header for the app's staff pages: IITR mark, page title, optional actions. */
export default function StaffTopBar({ title, subtitle, actions }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-card/95 backdrop-blur pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        <img src={iitrLogo128} width={32} height={32} alt="IIT Roorkee" className="h-8 w-8 shrink-0 object-contain" />
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </header>
  );
}
