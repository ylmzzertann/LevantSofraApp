import Image from "next/image";

/**
 * Photography is the one deliberately unfinished part of the design. Until the
 * shoot happens these render as labelled placeholders; pass `src` and the same
 * component becomes a real optimised image.
 */
export function PhotoSlot({
  src,
  alt,
  label,
  height,
  radius = "var(--r-card)",
}: {
  src?: string;
  alt?: string;
  label: string;
  height?: number | string;
  radius?: string;
}) {
  if (src) {
    return (
      <div style={{ position: "relative", height, borderRadius: radius, overflow: "hidden" }}>
        <Image src={src} alt={alt ?? label} fill style={{ objectFit: "cover" }} />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={label}
      style={{
        height,
        borderRadius: radius,
        overflow: "hidden",
        background: "rgba(192,75,45,.07)",
        border: "1px dashed rgba(59,59,59,.22)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        textAlign: "center",
        font: "400 11.5px var(--font-ui), sans-serif",
        letterSpacing: ".14em",
        textTransform: "uppercase",
        color: "var(--ink-42)",
      }}
    >
      {label}
    </div>
  );
}
