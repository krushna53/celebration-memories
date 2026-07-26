"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import type { EventDisplayData } from "@/lib/event-display";
import { Button } from "@/components/ui/button";
import { CountdownBadge } from "@/features/hero/components/countdown-badge";
import { GoldParticles } from "@/features/hero/components/gold-particles";
import { ConfettiParticles } from "@/features/hero/components/confetti-particles";
import { BalloonRise } from "@/features/hero/components/balloon-rise";
import { useTemplateAnimation } from "@/templates/shared/template-animation-context";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] },
  }),
};

interface HeroSectionProps {
  data: EventDisplayData;
}

// CSS custom properties, not hex literals, so the particle colors
// automatically follow whichever template's palette is active (see
// templates/shared/template-theme-wrapper.tsx) instead of needing their
// own theme prop threaded through.
const THEME_PARTICLE_COLORS = [
  "var(--color-gold-300)",
  "var(--color-gold-500)",
  "var(--color-ivory-100)",
  "var(--color-navy-600)",
];

/**
 * Hero / landing section. Background video is optional and progressively
 * enhanced — if no video is supplied at /public/hero/family.mp4 the
 * gradient + particle background stands on its own.
 *
 * The particle layer itself varies by template animation personality
 * (see templates/shared/template-animation-context.tsx): "festive" and
 * "jubilant" (the birthday-specific templates) get confetti and/or
 * rising balloons instead of the original gold-dust drift, so a
 * birthday event actually reads as a celebration at a glance.
 */
export function HeroSection({ data }: HeroSectionProps) {
  const personality = useTemplateAnimation();
  // No real family video has been uploaded to /public/hero/family.mp4 yet,
  // so this renders a static ornamental background (/hero/poster.jpg)
  // instead of trying (and failing) to play a video. Once a real family
  // video is added, swap this block back to a <video> tag with poster and
  // a <source src="/hero/family.mp4">.
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-navy-950"
    >
      {/* Background layer */}
      <div className="absolute inset-0">
        {!imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/hero/poster.jpg"
            alt=""
            className="h-full w-full object-cover opacity-40"
            onError={() => setImageFailed(true)}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/70 via-navy-950/60 to-navy-950" />
      </div>

      {personality === "jubilant" ? (
        <>
          <ConfettiParticles colors={THEME_PARTICLE_COLORS} />
          <BalloonRise colors={THEME_PARTICLE_COLORS} />
        </>
      ) : personality === "festive" ? (
        <ConfettiParticles colors={THEME_PARTICLE_COLORS} />
      ) : (
        <GoldParticles />
      )}

      {/* Foreground content */}
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6 sm:py-32">
        <motion.div
          initial="hidden"
          animate="show"
          custom={0}
          variants={fadeUp}
          className="glass-card w-full rounded-3xl px-5 py-8 sm:px-10 sm:py-14"
        >
          <motion.p
            custom={0.1}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="text-xs uppercase tracking-[0.35em] text-gold-300/90"
          >
            {data.occasion ? `${data.occasion} · ` : ""}Hosted by {data.hostedBy}
          </motion.p>

          <motion.h1
            custom={0.2}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-4 text-4xl text-ivory-50 sm:text-5xl md:text-6xl"
          >
            {data.honoreeName}
          </motion.h1>

          <motion.p
            custom={0.3}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-3 font-display text-xl italic text-gold-200 sm:text-2xl"
          >
            {data.eventTitle}
          </motion.p>

          <motion.div
            custom={0.4}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="divider-gold mx-auto mt-6 w-24"
          />

          <motion.p
            custom={0.45}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-6 text-sm tracking-wide text-ivory-100/80 sm:text-base"
          >
            {data.dayOfWeek}, {data.date}
            <br />
            {data.startTime} &ndash; {data.endTime}
          </motion.p>

          <motion.div
            custom={0.55}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-8"
          >
            <CountdownBadge isoStart={data.isoStart} />
          </motion.div>

          <motion.div
            custom={0.7}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
          >
            <Button asChild size="lg" className="w-full sm:w-auto">
              <a href="#rsvp">RSVP Now</a>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <a href="#details">View Details</a>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
