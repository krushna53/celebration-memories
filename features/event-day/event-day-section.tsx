import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import type { MenuDietaryTag, MenuItemRecord, MenuStyle, ScheduleItemRecord } from "@/types/content";

interface EventDaySectionProps {
  scheduleItems: ScheduleItemRecord[];
  menuItems: MenuItemRecord[];
  menuStyle: MenuStyle;
  /** Dark navy background + section id, matching the homepage stack — set to false on the standalone private /event-day/[token] page, which supplies its own page chrome instead. */
  asHomepageSection?: boolean;
}

const DIETARY_LABELS: Record<MenuDietaryTag, string> = {
  veg: "Veg",
  non_veg: "Non-Veg",
  vegan: "Vegan",
  jain: "Jain",
};

const DIETARY_DOT: Record<MenuDietaryTag, string> = {
  veg: "bg-emerald-400",
  non_veg: "bg-rose-400",
  vegan: "bg-lime-300",
  jain: "bg-amber-300",
};

function groupByCategory(items: MenuItemRecord[]): Array<[string, MenuItemRecord[]]> {
  const groups = new Map<string, MenuItemRecord[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return Array.from(groups.entries());
}

/**
 * The event-day run-of-show + menu — managed from /admin/event-day (see
 * services/event-day.ts). Rendered two ways depending on
 * `events.event_day_mode`: as a homepage section when "public" (see
 * event-sections.tsx), or as the sole content of the phone-verified
 * /event-day/[token] page when "private" (see event-day-gate.tsx).
 * Renders nothing if the host hasn't added a schedule or menu yet.
 */
export function EventDaySection({ scheduleItems, menuItems, menuStyle, asHomepageSection = true }: EventDaySectionProps) {
  if (scheduleItems.length === 0 && menuItems.length === 0) return null;

  const menuGroups = groupByCategory(menuItems);

  const body = (
    <div className="mx-auto max-w-3xl px-6">
      {scheduleItems.length > 0 ? (
        <Reveal>
          <SectionHeading
            tone="dark"
            eyebrow="How The Day Unfolds"
            title="Event Schedule"
            description="A run-of-show for the celebration — times are approximate, join whenever you can."
          />
        </Reveal>
      ) : null}

      {scheduleItems.length > 0 ? (
        <ol className="relative mt-16 border-s border-gold-500/25 ps-8 sm:ps-10">
          {scheduleItems.map((item, index) => (
            <Reveal key={item.id} delay={index * 0.06}>
              <li className="relative pb-10 last:pb-0">
                <span className="absolute -start-[calc(2rem+5px)] top-1 h-2.5 w-2.5 rounded-full bg-gold-400 ring-4 ring-navy-950 sm:-start-[calc(2.5rem+5px)]" />
                <p className="text-xs uppercase tracking-[0.3em] text-gold-300/90">
                  {item.startLabel}
                  {item.endLabel ? ` – ${item.endLabel}` : ""}
                </p>
                <h3 className="mt-2 font-display text-xl text-ivory-50 sm:text-2xl">{item.title}</h3>
                {item.description ? (
                  <p className="mt-2 text-sm leading-relaxed text-ivory-100/70 sm:text-base">{item.description}</p>
                ) : null}
              </li>
            </Reveal>
          ))}
        </ol>
      ) : null}

      {menuGroups.length > 0 ? (
        <div className={scheduleItems.length > 0 ? "mt-24" : ""}>
          <Reveal>
            <SectionHeading
              tone="dark"
              eyebrow={menuStyle === "buffet" ? "Buffet Style" : "À La Carte"}
              title="Menu"
              description={
                menuStyle === "buffet"
                  ? "Help yourself — everything below will be laid out for the table."
                  : "Dishes will be served individually through the celebration."
              }
            />
          </Reveal>

          <div className="mt-12 grid gap-10 sm:grid-cols-2">
            {menuGroups.map(([category, items]) => (
              <div key={category}>
                <h4 className="font-display text-lg text-gold-300">{category}</h4>
                <ul className="mt-4 space-y-4 border-t border-gold-500/15 pt-4">
                  {items.map((item) => (
                    <li key={item.id}>
                      <div className="flex items-center gap-2">
                        {item.dietaryTag ? (
                          <span className={`h-2 w-2 shrink-0 rounded-full ${DIETARY_DOT[item.dietaryTag]}`} aria-hidden />
                        ) : null}
                        <p className="text-sm font-medium text-ivory-50 sm:text-base">{item.name}</p>
                        {item.dietaryTag ? (
                          <span className="text-[10px] uppercase tracking-wide text-ivory-100/40">
                            {DIETARY_LABELS[item.dietaryTag]}
                          </span>
                        ) : null}
                      </div>
                      {item.description ? (
                        <p className="mt-1 text-xs leading-relaxed text-ivory-100/60 sm:text-sm">{item.description}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  if (!asHomepageSection) return body;

  return (
    <section id="event-day" className="bg-navy-950 py-20 sm:py-28">
      {body}
    </section>
  );
}
