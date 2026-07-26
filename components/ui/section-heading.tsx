import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  /** "light" = dark text for light backgrounds, "dark" = light text for dark/navy backgrounds. */
  tone?: "light" | "dark";
  className?: string;
}

/**
 * Consistent eyebrow / title / gold-divider / description treatment
 * reused across every homepage section (Countdown, Invitation, Event
 * Details, Gallery, Timeline, RSVP) to keep the luxury design language
 * uniform without duplicating markup per section.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  tone = "light",
  className,
}: SectionHeadingProps) {
  const isDark = tone === "dark";

  return (
    <div
      className={cn(
        "flex flex-col",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow ? (
        <p
          className={cn(
            "text-xs uppercase tracking-[0.35em]",
            isDark ? "text-gold-300" : "text-gold-500",
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          "mt-3 text-3xl sm:text-4xl",
          isDark ? "text-ivory-50" : "text-navy-950",
        )}
      >
        {title}
      </h2>
      <div
        className={cn(
          "divider-gold mt-5 w-20",
          align === "center" ? "mx-auto" : "",
        )}
      />
      {description ? (
        <p
          className={cn(
            "mt-5 max-w-xl text-sm leading-relaxed sm:text-base",
            isDark ? "text-ivory-100/75" : "text-navy-700/80",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
