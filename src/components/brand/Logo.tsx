/**
 * The mark: a dashed terracotta ring, a solid bowl silhouette, two mustard
 * steam strokes. Used at 24 / 30 / 38 / 62.
 */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle
        cx="16"
        cy="16"
        r="14.4"
        stroke="#C04B2D"
        strokeWidth={size > 40 ? 1.1 : 1.3}
        strokeDasharray="3.4 2.2"
        opacity=".5"
      />
      <path
        d="M7.6 16.4c0 4.6 3.8 7.7 8.4 7.7s8.4-3.1 8.4-7.7c-2.7.5-5.6.8-8.4.8s-5.7-.3-8.4-.8Z"
        fill="#C04B2D"
      />
      <path
        d="M13 11.8c1.1-1 .3-2.3 1.4-3.3M16.7 11.4c1.1-1 .3-2.6 1.4-3.6"
        stroke="#E1A43C"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The tinted plate glyph that stands in for a dish photo until we have one. */
export function PlateGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M7.6 16.4c0 4.6 3.8 7.7 8.4 7.7s8.4-3.1 8.4-7.7c-2.7.5-5.6.8-8.4.8s-5.7-.3-8.4-.8Z"
        fill="#C04B2D"
        fillOpacity=".45"
      />
      <path
        d="M13 11.8c1.1-1 .3-2.3 1.4-3.3M16.7 11.4c1.1-1 .3-2.6 1.4-3.6"
        stroke="#C04B2D"
        strokeOpacity=".4"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
