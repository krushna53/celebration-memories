"use client";

import { motion } from "framer-motion";

import { ACTIVE_EVENT } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { CountdownBadge } from "@/features/hero/components/countdown-badge";
import { GoldParticles } from "@/features/hero/components/gold-particles";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] },
  }),
};

/**
 * Hero / landing section. Background video is optional and progressively
 * enhanced — if no video is supplied at /public/hero/family.mp4 the
 * gradient + particle background stands on its own.
 */
export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-navy-950"
    >
      {/* Background layer */}
      <div className="absolute inset-0">
        <video
          className="h-full w-full object-cover opacity-40"
          autoPlay
          muted
          loop
          playsInline
          poster="/hero/poster.jpg"
        >
          <source src="/hero/family.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/70 via-navy-950/60 to-navy-950" />
      </div>

      <GoldParticles />

      {/* Foreground content */}
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-32 text-center">
        <motion.div
          initial="hidden"
          animate="show"
          custom={0}
          variants={fadeUp}
          className="glass-card w-full rounded-3xl px-6 py-10 sm:px-10 sm:py-14"
        >
          <motion.p
            custom={0.1}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="text-xs uppercase tracking-[0.35em] text-gold-300/90"
          >
            Hosted by {ACTIVE_EVENT.hostedBy}
          </motion.p>

          <motion.h1
            custom={0.2}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-4 text-4xl text-ivory-50 sm:text-5xl md:text-6xl"
          >
            {ACTIVE_EVENT.honoreeName}
          </motion.h1>

          <motion.p
            custom={0.3}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-3 font-display text-xl italic text-gold-200 sm:text-2xl"
          >
            {ACTIVE_EVENT.eventTitle}
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
            {ACTIVE_EVENT.dayOfWeek}, {ACTIVE_EVENT.date}
            <br />
            {ACTIVE_EVENT.startTime} &ndash; {ACTIVE_EVENT.endTime}
          </motion.p>

          <motion.div
            custom={0.55}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-8"
          >
            <CountdownBadge />
          </motion.div>

          <motion.div
            custom={0.7}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button asChild size="lg">
              <a href="#rsvp">RSVP Now</a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#details">View Details</a>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
