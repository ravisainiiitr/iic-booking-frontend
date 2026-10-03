import { useEffect, useState } from "react";

type Props = {
  value: string;
  size?: number;
  className?: string;
  label: string;
};

/** QR code drawn as SVG; the encoder is loaded only when a code is shown. */
export default function QrCode({ value, size = 128, className, label }: Props) {
  const [matrix, setMatrix] = useState<{ count: number; path: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("qrcode-generator").then(({ default: qrcode }) => {
      if (cancelled) return;
      const qr = qrcode(0, "M");
      qr.addData(value);
      qr.make();
      const count = qr.getModuleCount();
      let path = "";
      for (let r = 0; r < count; r += 1) {
        for (let c = 0; c < count; c += 1) {
          if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
        }
      }
      setMatrix({ count, path });
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!matrix) return <div className={className} style={{ width: size, height: size }} aria-hidden />;
  const quiet = 2;
  const box = matrix.count + quiet * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`${-quiet} ${-quiet} ${box} ${box}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect x={-quiet} y={-quiet} width={box} height={box} fill="#fff" />
      <path d={matrix.path} fill="#0f172a" />
    </svg>
  );
}
