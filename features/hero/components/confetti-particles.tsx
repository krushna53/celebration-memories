"use client";

import { useMemo } from "react";

interface ConfettiParticlesProps {
  colors: string[];
}

/**
 * Falling confetti pieces for the "festive"/"jubilant" hero backgrounds
 * — same dependency-free CSS-animation approach as GoldParticles, just
 * with small rotating rectangles instead of round dust motes, and a
 * caller-supplied palette so it can match each template's theme colors.
 */
export function ConfettiParticles({ colors }: ConfettiParticlesProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 6 + Math.random() * 6,
        duration: 6 + Math.random() * 6,
        delay: Math.random() * -12,
        rotate: Math.random() * 360,
        color: colors[i % colors.length]!,
      })),
    [colors],
  );

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute animate-[confetti-fall_linear_infinite]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            backgroundColor: p.color,
            top: "-5%",
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            ["--confetti-rotate" as string]: `${p.rotate}deg`,
          }}
        />
      ))}

      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          8% {
            opacity: 0.9;
          }
          92% {
            opacity: 0.7;
          }
          100% {
            transform: translateY(115vh) rotate(var(--confetti-rotate, 180deg));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
