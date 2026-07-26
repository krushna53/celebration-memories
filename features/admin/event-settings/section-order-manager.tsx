"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Eye, EyeOff, GripVertical, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SECTION_LABELS, normalizeSectionConfig, type SectionConfigItem } from "@/lib/section-registry";
import { updateSectionConfigAction } from "@/features/admin/event-settings/actions";

interface SectionOrderManagerProps {
  eventId: string;
  initialConfig: SectionConfigItem[] | null;
}

function SortableRow({
  item,
  onToggleVisible,
}: {
  item: SectionConfigItem;
  onToggleVisible: (key: SectionConfigItem["key"]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-navy-950/10 bg-white px-3 py-2.5",
        isDragging && "opacity-50 shadow-md",
        !item.visible && "bg-navy-950/[0.02]",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="tap-target flex cursor-grab items-center justify-center text-navy-700/40 hover:text-navy-700 active:cursor-grabbing"
        aria-label={`Drag to reorder ${SECTION_LABELS[item.key]}`}
      >
        <GripVertical size={18} />
      </button>
      <span className={cn("flex-1 text-sm font-medium", item.visible ? "text-navy-950" : "text-navy-700/40")}>
        {SECTION_LABELS[item.key]}
      </span>
      <button
        type="button"
        onClick={() => onToggleVisible(item.key)}
        className={cn(
          "tap-target flex items-center justify-center rounded-full px-2 py-1 text-xs",
          item.visible ? "text-gold-600 hover:bg-gold-500/10" : "text-navy-700/40 hover:bg-navy-950/5",
        )}
      >
        {item.visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
    </li>
  );
}

/**
 * Drag-and-drop reorder + show/hide for homepage sections, backed by
 * events.section_config. Hero is deliberately not included here — see
 * lib/section-registry.ts for why it always renders first and can't be
 * hidden. Built on @dnd-kit (touch-friendly, unlike raw HTML5 drag
 * events) rather than a heavier page-builder library, since the only
 * things that vary are order and visibility, not section content.
 */
export function SectionOrderManager({ eventId, initialConfig }: SectionOrderManagerProps) {
  const [items, setItems] = useState<SectionConfigItem[]>(() => normalizeSectionConfig(initialConfig));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.key === active.id);
      const newIndex = prev.findIndex((i) => i.key === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setSaved(false);
  }

  function toggleVisible(key: SectionConfigItem["key"]) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, visible: !i.visible } : i)));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateSectionConfigAction(eventId, items);
    setSaving(false);
    if (result.success) {
      setSaved(true);
    } else {
      setError(result.error);
    }
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
          <ul className="grid gap-2">
            {items.map((item) => (
              <SortableRow key={item.key} item={item} onToggleVisible={toggleVisible} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <p className="mt-3 text-xs text-navy-700/50">
        Hero always shows first and can&rsquo;t be hidden. Drag the handle to
        reorder the rest, or tap the eye icon to hide a section entirely
        (e.g. hide Timeline until you&rsquo;ve added milestones).
      </p>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={16} /> : "Save Section Order"}
        </Button>
        {saved ? (
          <span className="flex items-center gap-1 text-sm text-green-700">
            <Check size={14} /> Saved.
          </span>
        ) : null}
      </div>
    </div>
  );
}
