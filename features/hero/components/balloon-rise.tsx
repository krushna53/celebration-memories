"use client";

import { useMemo } from "react";

interface BalloonRiseProps {
  colors: string[];
}

/**
 * Slow-rising, gently swaying balloons (with a thin string) for
 * "jubilant" (full celebration mode) hero backgrounds — pairs with
 * ConfettiParticles. Fewer, larger shapes than confetti, so it reads as
 * a distinct decorative layer rather than visual noise.
 */
export function BalloonRise({ colors }: BalloonRiseProps) {
  const balloons = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        id: i,
        left: 5 + Math.random() * 90,
        size: 46 + Math.random() * 34,
        duration: 16 + Math.random() * 10,
        delay: Math.random() * -20,
        swayDuration: 3 + Math.random() * 2,
        color: colors[i % colors.length]!,
      })),
    [colors],
  );

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {balloons.map((b) => (
        <div
          key={b.id}
          className="absolute bottom-[-20%] animate-[balloon-rise_linear_infinite]"
          style={{
            left: `${b.left}%`,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        >
          <div
            className="animate-[balloon-sway_ease-in-out_infinite]"
            style={{ animationDuration: `${b.swayDuration}s` }}
          >
            <svg width={b.size} height={b.size * 1.3} viewBox="0 0 40 52" fill="none">
              <ellipse cx="20" cy="20" rx="20" ry="24" fill={b.color} opacity="0.85" />
              <path d="M20 44 L18 48 L22 48 Z" fill={b.color} opacity="0.85" />
              <line x1="20" y1="48" x2="20" y2="52" stroke={b.color} strokeWidth="1" opacity="0.6" />
            </svg>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes balloon-rise {
          0% { transform: translateY(0); opacity: 0; }
          8% { opacity: 0.9; }
          92% { opacity: 0.8; }
          100% { transform: translateY(-130vh); opacity: 0; }
        }
        @keyframes balloon-sway {
          0%, 100% { transform: translateX(0) rotate(-3deg); }
          50% { transform: translateX(14px) rotate(3deg); }
        }
      `}</style>
    </div>
  );
}
