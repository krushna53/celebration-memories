import { useId } from "react";

/*
 * Original, purely decorative line art for the White Coat Reunion hero.
 * Paths carry pathLength="1" so white-coat-reunion.css can draw them in
 * once on load (and skip that entirely under prefers-reduced-motion).
 * All of it is hidden from assistive technology and never intercepts
 * pointer events.
 */

/** A single static pulse line along the bottom edge and a few gold dots top-right — kept clear of the copy. */
export function ReunionBackdrop() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="wcr-backdrop pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      {/* Static pulse line along the bottom edge. */}
      <path
        className="wcr-draw"
        pathLength="1"
        d="M0 728 H520 L548 728 L566 690 L588 772 L610 664 L632 742 L650 728 H1200"
        stroke="var(--wcr-gold)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.38"
      />

      {/* Small warm-gold dots, top-right. */}
      <g fill="var(--wcr-gold)" opacity="0.4">
        <circle cx="1040" cy="96" r="3" />
        <circle cx="1088" cy="140" r="2" />
        <circle cx="1132" cy="86" r="2.5" />
        <circle cx="996" cy="150" r="1.6" />
        <circle cx="1150" cy="190" r="1.8" />
      </g>
    </svg>
  );
}

/** Fine stethoscope outline, drawn to sit partly behind the featured photo print so it never runs under text. */
export function StethoscopeAccent({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 220 300"
      fill="none"
      className={`pointer-events-none ${className ?? ""}`}
    >
      <g className="wcr-draw" stroke="var(--wcr-gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path pathLength="1" d="M40 22 C40 82 58 120 80 132 C102 120 120 82 120 22" />
        <path pathLength="1" d="M80 132 C80 204 102 252 150 258 C190 262 202 232 202 200 V172" />
        <circle pathLength="1" cx="202" cy="150" r="21" />
        <circle pathLength="1" cx="202" cy="150" r="9" />
        <circle pathLength="1" cx="40" cy="16" r="5" />
        <circle pathLength="1" cx="120" cy="16" r="5" />
      </g>
    </svg>
  );
}

/** Leaves on a radius-58 arc: 6 per side from just off the bottom (90°) up each side, tilted along the branch. */
const LAUREL_LEAVES = [-1, 1].flatMap((side) =>
  Array.from({ length: 6 }, (_, i) => {
    const deg = 90 + side * (12 + i * 12);
    const rad = (deg * Math.PI) / 180;
    return {
      x: Number((80 + 58 * Math.cos(rad)).toFixed(2)),
      y: Number((80 + 58 * Math.sin(rad)).toFixed(2)),
      // Tangent to the ring, leaning outward toward the branch tip.
      rotate: deg + side * 25,
    };
  }),
);

interface BatchMedallionProps {
  /** Verified event text set around the ring, e.g. the event's occasion ("53rd Reunion - Batch 73"). */
  label: string;
  className?: string;
}

/**
 * Decorative batch medallion: a laurel ring with the event's own label
 * set along the top arc and a heart-and-pulse mark in the middle. Not an
 * institutional seal — the event title always stays real HTML text
 * elsewhere, so this is aria-hidden.
 */
export function BatchMedallion({ label, className }: BatchMedallionProps) {
  const arcId = `wcr-arc-${useId().replace(/:/g, "")}`;
  // Long labels shrink to stay on the arc instead of wrapping round the ring.
  const fontSize = label.length > 26 ? 9 : label.length > 20 ? 10.5 : 12;

  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 160 160" className={className}>
      <circle cx="80" cy="80" r="78" fill="#fffdf9" />
      <circle cx="80" cy="80" r="74" fill="none" stroke="var(--wcr-gold)" strokeWidth="1.5" />
      <circle cx="80" cy="80" r="68" fill="none" stroke="var(--wcr-gold)" strokeWidth="0.75" opacity="0.6" />

      <defs>
        <path id={arcId} d="M24 80 A56 56 0 0 1 136 80" />
      </defs>
      <text
        fill="var(--color-navy-950)"
        fontFamily="var(--font-poppins), Arial, sans-serif"
        fontSize={fontSize}
        fontWeight={600}
        letterSpacing="1.6"
      >
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
          {label.toUpperCase()}
        </textPath>
      </text>

      {/* Laurel branches along the lower arc, meeting at the bottom. */}
      <g fill="var(--wcr-gold)" opacity="0.85">
        {LAUREL_LEAVES.map((leaf, i) => (
          <ellipse
            key={i}
            cx={leaf.x}
            cy={leaf.y}
            rx="2.6"
            ry="6.5"
            transform={`rotate(${leaf.rotate} ${leaf.x} ${leaf.y})`}
          />
        ))}
      </g>

      {/* Heart + pulse mark. */}
      <path
        d="M80 104 C64 92 56 84 56 74 C56 66 62 61 68.5 61 C73.5 61 77.5 64 80 68 C82.5 64 86.5 61 91.5 61 C98 61 104 66 104 74 C104 84 96 92 80 104 Z"
        fill="none"
        stroke="var(--color-gold-500)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M58 81 H68 L72 74 L77 89 L82 70 L86 84 L88 81 H102"
        fill="none"
        stroke="var(--wcr-gold)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
