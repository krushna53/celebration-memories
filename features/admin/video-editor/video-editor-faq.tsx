import { ChevronDown, HelpCircle } from "lucide-react";

/**
 * Static help copy for the Video Editor — explains both layers of
 * controls an admin sees: the native Shotstack Studio toolbar/timeline
 * (rendered by the SDK itself, not by us) and our own panels (Media in
 * the left sidebar; Shape/Text/Music/Your Edits stacked below the
 * canvas/timeline in the same column) and "Selected clip" shortcut
 * bar. Kept as a plain data array rather than scattered inline
 * comments so it's easy to add/reorder/edit an entry without touching
 * component structure.
 */
const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "How do I trim a clip?",
    answer:
      "In the timeline strip at the bottom, hover over the very left or right edge of a clip block until the cursor turns into a left-right resize arrow, then click and drag. Dragging the right edge left shortens the clip from the end. Dragging the left edge right trims the beginning — this cuts further into the source and shifts where the clip starts, without moving the out-point. Dragging the middle of the clip instead moves/repositions it rather than trimming it. You can't drag a clip shorter than 0 or longer than the original source footage.",
  },
  {
    question: "How do I reorder clips?",
    answer: "Drag a clip left or right along the timeline track to change when it plays relative to the others.",
  },
  {
    question: "How do I add a transition?",
    answer:
      "Select a clip, then use either the \"Transition\" dropdown in the Selected Clip bar (a shortlist: fade, wipe, slide, carousel, zoom) or the \"Transition\" button in the dark toolbar above the canvas, which offers the full native option list. Both control the same setting — the toolbar's version just has more choices. Transitions play as the clip enters; there's no transition-out, so clips end with a normal hard cut.",
  },
  {
    question: "How do I add a pan/zoom (motion) effect?",
    answer:
      "Select a clip, then use the \"Motion\" dropdown (Selected Clip bar) or the \"Effect\" button in the dark toolbar — both apply a slow pan/zoom (Ken Burns-style) over the clip's duration. Pick the blank option to remove it.",
  },
  {
    question: "What does the Filter dropdown do?",
    answer:
      "Applies a colour grade to the selected clip — Boost, Contrast, Darken, Greyscale, Lighten, Muted, Negative, or None. This one's only available in our Selected Clip bar; there's no equivalent in the native dark toolbar.",
  },
  {
    question: "What does \"Crop\" do?",
    answer:
      "Controls how footage fills its frame: Cover (fills the box, cropping any overflow), Contain (fits entirely inside, may show letterbox bars), Crop (manual crop), or None.",
  },
  {
    question: "How do I resize or reposition a clip on the canvas?",
    answer:
      "Either drag the clip directly on the canvas (its corner handles resize, the shape itself repositions, and there's a rotate handle for angle), or use the \"46%\"-style scale control in the dark toolbar — both change the same underlying size/position.",
  },
  {
    question: "How do I fade a clip in/out or make it semi-transparent?",
    answer: "Use the opacity control (shows as a percentage with a circular icon) in the dark toolbar above the canvas — drag or click to adjust.",
  },
  {
    question: "How do I mute or lower a clip's own audio?",
    answer:
      "Select the clip, then use the volume control (speaker icon) in the dark toolbar. This only affects that clip's original sound — it's separate from the background Music track in the left sidebar.",
  },
  {
    question: "How do I change playback speed?",
    answer: "Select a clip and use the speed control (shows as, e.g., \"2×\") in the dark toolbar — slows down to slow-motion or speeds up to fast-forward.",
  },
  {
    question: "How do I delete a clip?",
    answer: "Select it, then click the trash icon at the far right of the dark toolbar.",
  },
  {
    question: "How do I change the video's shape (vertical for Reels, square, widescreen)?",
    answer:
      "Use the \"Shape\" card below the canvas and timeline. This is a whole-video setting (not per-clip) — pick 9:16 for Reels/Stories, 1:1 for a square feed post, 4:5 for portrait feed, or 16:9/4:3 for a traditional widescreen Big Screen display.",
  },
  {
    question: "How do I add a text overlay or caption?",
    answer:
      "Use the \"Text\" card below the canvas and timeline — type your caption, choose Top/Center/Bottom placement, then click Add Text. It's added as its own clip on a dedicated top layer, so it always renders above the video/photo footage rather than being hidden behind it. You can add as many text clips as you like, reposition each one on the timeline like any other clip, and it's fully supported end to end (this isn't a mockup — addTextOverlay is wired up to the real Shotstack Edit and will appear in the rendered MP4).",
  },
  {
    question: "How do I add background music?",
    answer:
      "Use the \"Music\" card below the canvas and timeline to upload a track — it plays under the whole video with its own volume slider, separate from any individual clip's audio.",
  },
  {
    question: "How do I save my progress?",
    answer: "Click \"Save\" near the top — your edit also autosaves every 20 seconds once the editor is open, so a closed tab won't lose your work.",
  },
  {
    question: "How do I export the final video?",
    answer:
      "Click \"Render Video\" near the top — this saves your latest changes first, then renders a real MP4. Rendering can take a minute or two; once it's done you can view it or set it live on the Big Screen display from \"Your Edits.\"",
  },
];

export function VideoEditorFaq() {
  return (
    <div className="mt-6 rounded-xl border border-navy-950/10 bg-white p-4">
      <h2 className="flex items-center gap-1.5 font-display text-base text-navy-950">
        <HelpCircle size={15} /> Help & FAQ
      </h2>
      <p className="mt-1 text-xs text-navy-700/50">Common questions about using the editor&apos;s tools.</p>
      <div className="mt-3 divide-y divide-navy-950/8">
        {FAQ_ITEMS.map((item) => (
          <details key={item.question} className="group py-2.5 first:pt-0 last:pb-0">
            <summary className="tap-target flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-navy-950 marker:content-none">
              {item.question}
              <ChevronDown size={15} className="shrink-0 text-navy-700/40 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-1.5 text-xs leading-relaxed text-navy-700/70">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
