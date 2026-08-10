import { TAG_COLOR, TAG_LABEL, type Tag } from "@/data/menu";

/** VEG olive, HOT terracotta, CHEF'S PICK mustard. */
export function TagChip({ tag, size = "sm" }: { tag: Tag; size?: "sm" | "lg" }) {
  const color = TAG_COLOR[tag];
  return (
    <span
      style={{
        font: `600 ${size === "sm" ? "8.5px" : "9px"} var(--font-ui), sans-serif`,
        letterSpacing: size === "sm" ? "0.1em" : "0.14em",
        color,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
        borderRadius: size === "sm" ? "var(--r-tag)" : "var(--r-thumb)",
        padding: size === "sm" ? "2px 4px" : "5px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {TAG_LABEL[tag]}
    </span>
  );
}
