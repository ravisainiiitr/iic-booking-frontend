import iitrLogo128 from "@/assets/iitr-logo-128.webp";
import iitrLogo256 from "@/assets/iitr-logo-256.webp";

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
    logo: "h-11 w-11 sm:h-14 sm:w-14",
    gap: "gap-2.5 sm:gap-3.5",
    hindi: "text-[0.95rem] sm:text-lg font-semibold tracking-normal sm:tracking-wide",
    english: "text-[0.78rem] sm:text-[0.95rem] font-semibold tracking-normal sm:tracking-[0.025em]",
    leading: "leading-[1.25]",
    wrap: "truncate",
  },
  lg: {
    // Phones keep the banner compact so the fixed header doesn't take a large share of the screen.
    logo: "h-12 w-12 sm:h-[4.5rem] sm:w-[4.5rem] md:h-20 md:w-20",
    gap: "gap-2.5 sm:gap-4",
    hindi: "text-[0.95rem] sm:text-xl md:text-[1.35rem] font-semibold tracking-wide",
    english: "text-[0.75rem] sm:text-base md:text-[1.05rem] font-semibold tracking-[0.02em] sm:tracking-[0.03em]",
    leading: "leading-[1.25] sm:leading-[1.3]",
    wrap: "whitespace-normal text-balance",
  },
} as const;

const IITRBanner = ({ size = "md", className }: Props) => {
  const s = SIZE[size];

  return (
    <div className={`flex items-center ${s.gap} min-w-0 ${className ?? ""}`}>
      <img
        src={iitrLogo128}
        srcSet={`${iitrLogo128} 1x, ${iitrLogo256} 2x`}
        width={128}
        height={128}
        decoding="async"
        alt="IIT Roorkee"
        // Navy emblem on transparency: in dark mode it sits on a white disc (like a seal) instead of being inverted.
        className={`${s.logo} shrink-0 object-contain drop-shadow-sm dark:rounded-full dark:bg-white dark:p-[2px]`}
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
