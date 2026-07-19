type Props = {
  /** Controls compactness in headers. */
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = {
  sm: {
    logo: "h-10 w-10 sm:h-11 sm:w-11",
    gap: "gap-3",
    hindi: "text-[0.95rem] sm:text-base font-semibold tracking-wide",
    english: "text-xs sm:text-sm font-semibold tracking-[0.02em]",
    leading: "leading-[1.2]",
    wrap: "truncate",
  },
  md: {
    logo: "h-12 w-12 sm:h-14 sm:w-14",
    gap: "gap-3.5",
    hindi: "text-base sm:text-lg font-semibold tracking-wide",
    english: "text-sm sm:text-[0.95rem] font-semibold tracking-[0.025em]",
    leading: "leading-[1.25]",
    wrap: "truncate",
  },
  lg: {
    logo: "h-14 w-14 sm:h-16 sm:w-16 md:h-[4.25rem] md:w-[4.25rem]",
    gap: "gap-3.5 sm:gap-4",
    hindi: "text-[1.05rem] sm:text-xl md:text-[1.35rem] font-semibold tracking-wide",
    english: "text-[0.8rem] sm:text-base md:text-[1.05rem] font-semibold tracking-[0.03em]",
    leading: "leading-[1.3]",
    wrap: "whitespace-normal",
  },
} as const;

const IITRBanner = ({ size = "md", className }: Props) => {
  const s = SIZE[size];

  return (
    <div className={`flex items-center ${s.gap} min-w-0 ${className ?? ""}`}>
      <img
        src="/IITR_Logo.svg"
        alt="IIT Roorkee"
        className={`${s.logo} shrink-0 object-contain drop-shadow-sm`}
      />
      <div className={`min-w-0 ${s.leading}`}>
        <div
          className={`${s.hindi} text-foreground ${s.wrap}`}
          lang="hi"
          style={{ fontFamily: '"Noto Sans Devanagari", "Mangal", "Kohinoor Devanagari", system-ui, sans-serif' }}
        >
          भारतीय प्रौद्योगिकी संस्थान रुड़की
        </div>
        <div className={`${s.english} text-foreground/95 ${s.wrap} mt-0.5`}>
          Indian Institute of Technology Roorkee
        </div>
      </div>
    </div>
  );
};

export default IITRBanner;
