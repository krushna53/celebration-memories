"use client";

import { useMemo } from "react";

/**
 * Lightweight, dependency-free particle field used for the hero's
 * animated gold-dust background. Deliberately subtle and slow per the
 * "luxury, never overdone" motion guidance — pure CSS animation, no
 * canvas/JS animation loop, so it stays cheap on mobile.
 */
export function GoldParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 2 + Math.random() * 3,
        duration: 14 + Math.random() * 12,
        delay: Math.random() * -20,
        opacity: 0.25 + Math.random() * 0.45,
      })),
    [],
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full bg-gold-300 animate-[float-up_linear_infinite]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            bottom: "-5%",
          }}
        />
      ))}

      <style>{`
        @keyframes float-up {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(-110vh) translateX(20px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
