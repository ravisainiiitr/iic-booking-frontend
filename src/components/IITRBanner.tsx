type Props = {
  /** Controls compactness in headers. */
  size?: "sm" | "md";
  className?: string;
};

const IITRBanner = ({ size = "md", className }: Props) => {
  const logoSize = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const titleSize = size === "sm" ? "text-sm" : "text-base";
  const subtitleSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className ?? ""}`}>
      <img src="/IITR_Logo.svg" alt="IIT Roorkee" className={`${logoSize} shrink-0`} />
      <div className="min-w-0 leading-tight">
        <div className={`${titleSize} font-semibold text-foreground truncate`}>
          भारतीय प्रौद्योगिकी संस्थान रुड़की
        </div>
        <div className={`${subtitleSize} font-bold text-foreground/90 tracking-wide truncate`}>
          Indian Institute of Technology Roorkee
        </div>
      </div>
    </div>
  );
};

export default IITRBanner;

