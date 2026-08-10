/**
 * Every icon in the product. Inline SVG, 1.3–1.7px strokes, round caps.
 * No icon font, no third-party set.
 */

interface IconProps {
  size?: number;
  color?: string;
}

export function ArrowOut({ size = 12, color = "#FFF6E5", width = 1.7 }: IconProps & { width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3 11 11 3M5 3h6v6"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronLeft({ size = 17, color = "#3B3B3B" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m10 3-5 5 5 5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRight({ size = 16, color = "rgba(59,59,59,.45)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m6 3 5 5-5 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Plus({ size = 12, color = "#C04B2D" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.6v10.8M2.6 8h10.8" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function PlusSmall({ size = 13, color = "#3B3B3B" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Minus({ size = 13, color = "#3B3B3B" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Heart({ size = 17, color = "rgba(59,59,59,.55)", fill = "transparent", width = 1.3 }: IconProps & { fill?: string; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M9 15.2C4.8 12.4 2 10 2 6.9 2 4.7 3.7 3 5.8 3 7.1 3 8.3 3.7 9 4.8 9.7 3.7 10.9 3 12.2 3 14.3 3 16 4.7 16 6.9c0 3.1-2.8 5.5-7 8.3Z"
        stroke={color}
        strokeWidth={width}
        strokeLinejoin="round"
        fill={fill}
      />
    </svg>
  );
}

export function Clock({ size = 17, color = "rgba(59,59,59,.55)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6.6" stroke={color} strokeWidth="1.3" />
      <path d="M9 5.4V9l2.4 1.6" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function Shield({ size = 13, color = "#6B8A4A" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.6 2.6 4v4c0 3.2 2.3 5.6 5.4 6.4 3.1-.8 5.4-3.2 5.4-6.4V4L8 1.6Z"
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Ticket({ size = 16, color = "#E1A43C" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.5 7.5V4.2c0-.9.7-1.6 1.6-1.6h9.8c.9 0 1.6.7 1.6 1.6v3.3a1.5 1.5 0 0 0 0 3v3.3c0 .9-.7 1.6-1.6 1.6H4.1c-.9 0-1.6-.7-1.6-1.6v-3.3a1.5 1.5 0 0 0 0-3Z"
        stroke={color}
        strokeWidth="1.3"
      />
    </svg>
  );
}

export function QrGlyph({ size = 30, color = "#3B3B3B" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="11" height="11" rx="1.5" stroke={color} strokeWidth="1.5" />
      <rect x="19" y="2" width="11" height="11" rx="1.5" stroke={color} strokeWidth="1.5" />
      <rect x="2" y="19" width="11" height="11" rx="1.5" stroke={color} strokeWidth="1.5" />
      <path d="M19 19h5v5h-5zM27 19h3M19 27h3M26 26h4v4h-4z" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function Check({ size = 13, color = "#3B3B3B", width = 1.8 }: IconProps & { width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2.5 7.4 5.6 10.5 11.5 4"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckBig({ size = 38, color = "#6B8A4A" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M6 17.2 12.6 23.8 26 9.4"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppleMark({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size * (17 / 14)} viewBox="0 0 14 17" fill="none" aria-hidden="true">
      <path
        d="M11.2 9c0-2 1.6-3 1.7-3-.9-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7C3.1 4.4 1.8 5.2 1 6.6c-1.3 2.3-.3 5.8 1 7.7.6.9 1.4 2 2.4 2 1 0 1.3-.6 2.5-.6s1.5.6 2.5.6c1 0 1.7-.9 2.3-1.9.7-1.1 1-2.2 1-2.2s-2-.8-2-3.2Z"
        fill="currentColor"
      />
      <path
        d="M9.4 3.2c.5-.7.9-1.6.8-2.5-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.4-1.2Z"
        fill="currentColor"
      />
    </svg>
  );
}
