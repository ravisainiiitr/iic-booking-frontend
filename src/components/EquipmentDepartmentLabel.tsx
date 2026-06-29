import { cn } from "@/lib/utils";

type Props = {
  name?: string | null;
  code?: string | null;
  size?: "default" | "compact";
  accentBarClassName?: string;
  className?: string;
};

export default function EquipmentDepartmentLabel({
  name,
  code,
  size = "default",
  accentBarClassName = "from-primary/70 to-primary",
  className,
}: Props) {
  if (!name && !code) return null;

  const isCompact = size === "compact";

  return (
    <div
      className={cn("flex min-w-0 items-start gap-3", className)}
      title={[name, code].filter(Boolean).join(" · ")}
    >
      <span
        className={cn(
          "inline-block shrink-0 rounded-full bg-gradient-to-b",
          accentBarClassName,
          isCompact ? "mt-1 h-4 w-0.5" : "mt-1.5 h-5 w-0.5",
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p
          className={cn(
            "font-medium uppercase tracking-[0.14em] text-muted-foreground/75",
            isCompact ? "text-[10px]" : "text-[11px]",
          )}
        >
          Department
        </p>
        <p
          className={cn(
            "mt-0.5 font-medium leading-snug text-foreground/90",
            isCompact ? "truncate text-sm" : "text-base md:text-[17px]",
          )}
        >
          {name || "—"}
          {code ? <span className="ml-2 font-normal text-muted-foreground">{code}</span> : null}
        </p>
      </div>
    </div>
  );
}
