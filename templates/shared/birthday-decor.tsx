"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

/**
 * Party decorations for the playful kids/birthday templates (Kids
 * Cartoon, Balloon Pop): a swaying "HAPPY BIRTHDAY" bunting across the
 * top of the page, balloons that drift up the left/right edges (tap one
 * to pop it), and a one-off confetti shower when the page opens.
 *
 * Purely decorative and kept out of the way of the content: everything
 * is aria-hidden, balloons stay in the outer page margins, the layer
 * ignores pointer events except on the balloons themselves, and with
 * prefers-reduced-motion only the bunting and two resting balloons show,
 * with no movement at all. Pure CSS animation (no GSAP/Framer), so it
 * costs nothing on the main thread once painted.
 */

export type BirthdayDecorVariant = "kids" | "pop";

const PALETTES: Record<BirthdayDecorVariant, string[]> = {
  kids: ["#ff6f61", "#2ec4b6", "#ffd166", "#b388eb", "#4cc9f0", "#ff8fab"],
  pop: ["#ffc107", "#ff4d8d", "#22d3ee", "#a855f7", "#fb923c", "#4ade80"],
};

interface BalloonSpec {
  id: number;
  side: "left" | "right";
  /** Offset into the side margin, in vw. */
  x: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  sway: number;
}

interface Burst {
  id: number;
  x: number;
  y: number;
  color: string;
}

/** Deterministic pseudo-random so server and client render the same balloons (no hydration mismatch). */
function seeded(n: number): number {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  // Rounded: Math.sin's last digits differ between Node and browsers, which would break hydration.
  return Math.round((x - Math.floor(x)) * 1000) / 1000;
}

function makeBalloons(count: number, palette: string[]): BalloonSpec[] {
  return Array.from({ length: count }, (_, i) => {
    const duration = Math.round((22 + seeded(i + 21) * 12) * 100) / 100;
    // Golden-ratio spacing puts each balloon at a different point of its
    // climb (negative delay = already mid-flight), so they never bunch up
    // or loop in lockstep, and the page never opens empty.
    const phase = (i * 0.618 + seeded(i + 31) * 0.15) % 1;
    return {
      id: i,
      side: i % 2 === 0 ? "left" : "right",
      x: Math.round((1 + seeded(i + 1) * 7) * 100) / 100,
      size: 46 + Math.round(seeded(i + 11) * 26),
      color: palette[i % palette.length]!,
      duration,
      delay: -Math.round(phase * duration * 100) / 100,
      sway: Math.round(10 + seeded(i + 41) * 16),
    };
  });
}

function Balloon({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size * 1.9}
      viewBox="0 0 60 114"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M30 74 C 26 84, 34 90, 29 98 S 31 108, 28 114"
        fill="none"
        stroke="rgba(71,85,105,0.55)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <ellipse cx="30" cy="35" rx="26" ry="32" fill={color} />
      <ellipse cx="30" cy="35" rx="26" ry="32" fill="url(#bd-shade)" />
      <ellipse
        cx="20"
        cy="22"
        rx="6"
        ry="10"
        fill="rgba(255,255,255,0.55)"
        transform="rotate(-24 20 22)"
      />
      <path d="M26 66 L34 66 L30 73 Z" fill={color} />
    </svg>
  );
}

function Bunting({
  text,
  palette,
}: {
  text: string | null;
  palette: string[];
}) {
  // A row of pennants — one letter each when there's a banner, otherwise plain flags.
  const letters = text
    ? Array.from(text)
    : Array.from({ length: 14 }, () => "");
  return (
    <div className="bd-bunting" aria-hidden="true">
      <svg
        className="bd-rope"
        viewBox="0 0 1000 40"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 6 Q 500 46 1000 6"
          fill="none"
          stroke="rgba(71,85,105,0.45)"
          strokeWidth="2"
        />
      </svg>
      <div className="bd-flags">
        {letters.map((ch, i) => {
          // Follow the rope's sag: flags in the middle hang lower.
          const t = letters.length > 1 ? i / (letters.length - 1) : 0.5;
          const drop = Math.sin(t * Math.PI) * 22;
          const style = {
            "--bd-drop": `${drop}px`,
            "--bd-flag": palette[i % palette.length],
            animationDelay: `${(i % 5) * -0.6}s`,
          } as CSSProperties;
          return ch === " " ? (
            <span key={i} className="bd-gap" />
          ) : (
            <span key={i} className="bd-flag" style={style}>
              <span className="bd-letter">{ch}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

const CONFETTI_COUNT = 42;

export function BirthdayDecor({
  variant = "kids",
  bannerText = "HAPPY BIRTHDAY",
}: {
  variant?: BirthdayDecorVariant;
  /** Letters on the bunting; null for plain flags (non-birthday kids events). */
  bannerText?: string | null;
}) {
  const palette = PALETTES[variant];
  const [balloons] = useState(() => makeBalloons(8, palette));
  const [popped, setPopped] = useState<Record<number, number>>({});
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowConfetti(false), 7000);
    return () => window.clearTimeout(timer);
  }, []);

  const pop = useCallback((balloon: BalloonSpec, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const id = Date.now() + balloon.id;
    setBursts((b) => [
      ...b,
      {
        id,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.width / 2,
        color: balloon.color,
      },
    ]);
    // Bumping the key restarts this balloon from the bottom after the pop.
    setPopped((p) => ({ ...p, [balloon.id]: (p[balloon.id] ?? 0) + 1 }));
    window.setTimeout(
      () => setBursts((b) => b.filter((x) => x.id !== id)),
      900,
    );
  }, []);

  return (
    <>
      <style>{DECOR_CSS}</style>
      <svg
        width="0"
        height="0"
        className="absolute"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id="bd-shade" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
          </radialGradient>
        </defs>
      </svg>

      <Bunting text={bannerText} palette={palette} />

      <div className="bd-sky" aria-hidden="true">
        {balloons.map((b, i) => {
          const style = {
            [b.side]: `${b.x}vw`,
            "--bd-dur": `${b.duration}s`,
            "--bd-sway": `${b.sway}px`,
            animationDelay: popped[b.id] ? "0s" : `${b.delay}s`,
          } as CSSProperties;
          return (
            <button
              key={`${b.id}-${popped[b.id] ?? 0}`}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className={i >= 4 ? "bd-balloon bd-desktop-only" : "bd-balloon"}
              style={style}
              onClick={(e) => pop(b, e.currentTarget)}
            >
              <span className="bd-sway">
                <Balloon color={b.color} size={b.size} />
              </span>
            </button>
          );
        })}
        {/* Reduced-motion stand-ins: two balloons resting in the top corners. */}
        <span className="bd-still bd-still-left">
          <Balloon color={palette[0]!} size={54} />
        </span>
        <span className="bd-still bd-still-right">
          <Balloon color={palette[1]!} size={48} />
        </span>
        {bursts.map((burst) => (
          <span
            key={burst.id}
            className="bd-burst"
            style={{ left: burst.x, top: burst.y }}
          >
            {Array.from({ length: 10 }, (_, k) => (
              <span
                key={k}
                className="bd-shard"
                style={
                  {
                    "--bd-angle": `${k * 36}deg`,
                    background:
                      k % 2 ? burst.color : palette[(k + 2) % palette.length],
                  } as CSSProperties
                }
              />
            ))}
          </span>
        ))}
      </div>

      {showConfetti ? (
        <div className="bd-confetti" aria-hidden="true">
          {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
            <span
              key={i}
              className="bd-piece"
              style={{
                left: `${seeded(i + 101) * 100}%`,
                background: palette[i % palette.length],
                animationDelay: `${seeded(i + 201) * 1.6}s`,
                animationDuration: `${3.2 + seeded(i + 301) * 2.4}s`,
                width: i % 3 === 0 ? 7 : 9,
                height: i % 3 === 0 ? 7 : 14,
                borderRadius: i % 3 === 0 ? "50%" : 2,
              }}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

const DECOR_CSS = `
.bd-bunting{position:absolute;left:0;right:0;top:64px;height:92px;z-index:20;pointer-events:none;overflow:hidden}
@media (min-width:640px){.bd-bunting{top:76px}}
.bd-rope{position:absolute;inset:0 0 auto 0;width:100%;height:40px}
.bd-flags{position:absolute;left:2%;right:2%;top:2px;display:flex;justify-content:space-between}
.bd-flag{position:relative;display:flex;justify-content:center;width:clamp(20px,5.4vw,46px);height:clamp(28px,7vw,58px);margin-top:var(--bd-drop);background:var(--bd-flag);clip-path:polygon(0 0,100% 0,50% 100%);transform-origin:50% 0;animation:bd-flutter 3.2s ease-in-out infinite;filter:drop-shadow(0 2px 2px rgba(0,0,0,.12))}
.bd-gap{width:clamp(4px,1.6vw,18px)}
.bd-letter{margin-top:clamp(2px,.8vw,7px);font-family:var(--font-display);font-weight:800;font-size:clamp(11px,2.6vw,22px);line-height:1;color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.25)}
@keyframes bd-flutter{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}

.bd-sky{position:fixed;inset:0;z-index:30;pointer-events:none;overflow:hidden}
.bd-balloon{position:absolute;bottom:0;padding:0;border:0;background:none;cursor:pointer;pointer-events:auto;transform:translateY(110%);animation:bd-rise var(--bd-dur) linear infinite;-webkit-tap-highlight-color:transparent;opacity:.92}
.bd-balloon:active{transform:scale(.95)}
.bd-sway{display:block;animation:bd-sway 4.5s ease-in-out infinite alternate}
@keyframes bd-rise{from{transform:translateY(115%)}to{transform:translateY(-110vh)}}
@keyframes bd-sway{from{transform:translateX(calc(var(--bd-sway) * -1)) rotate(-5deg)}to{transform:translateX(var(--bd-sway)) rotate(5deg)}}
@media (max-width:767px){.bd-desktop-only{display:none}.bd-balloon{margin:0 -3vw;opacity:.8}.bd-balloon svg{width:38px;height:72px}}
/* Touch screens: content runs edge to edge, so a balloon must never swallow a tap meant for a button. Pop-to-play is for mouse users. */
@media (hover:none){.bd-balloon{pointer-events:none}}

.bd-still{display:none;position:absolute;top:150px}
.bd-still-left{left:2vw}.bd-still-right{right:2vw}

.bd-burst{position:fixed;width:0;height:0;pointer-events:none}
.bd-shard{position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:2px;animation:bd-shard .8s cubic-bezier(.2,.7,.3,1) forwards;transform:rotate(var(--bd-angle)) translateY(0)}
@keyframes bd-shard{to{transform:rotate(var(--bd-angle)) translateY(-56px) scale(.4);opacity:0}}

.bd-confetti{position:fixed;inset:0;z-index:31;pointer-events:none;overflow:hidden}
.bd-piece{position:absolute;top:-20px;opacity:0;animation-name:bd-fall;animation-timing-function:cubic-bezier(.25,.4,.5,1);animation-fill-mode:forwards}
@keyframes bd-fall{0%{opacity:1;transform:translateY(0) rotate(0)}85%{opacity:1}100%{opacity:0;transform:translateY(105vh) rotate(720deg)}}

@media (prefers-reduced-motion:reduce){
  .bd-flag,.bd-sway{animation:none}
  .bd-balloon,.bd-confetti{display:none}
  .bd-still{display:block}
}
`;
