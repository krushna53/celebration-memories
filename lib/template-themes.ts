import type { TemplateTheme } from "@/lib/template-catalog";
import { balloonPopTheme } from "@/templates/BalloonPop/theme";
import { boardroomIvoryTheme } from "@/templates/BoardroomIvory/theme";
import { brightBeginningsTheme } from "@/templates/BrightBeginnings/theme";
import { candlelightTributeTheme } from "@/templates/CandlelightTribute/theme";
import { corporateSlateTheme } from "@/templates/CorporateSlate/theme";
import { emeraldVowTheme } from "@/templates/EmeraldVow/theme";
import { eternalRestTheme } from "@/templates/EternalRest/theme";
import { floralPastelTheme } from "@/templates/FloralPastel/theme";
import { goldenConfettiTheme } from "@/templates/GoldenConfetti/theme";
import { goldenFarewellTheme } from "@/templates/GoldenFarewell/theme";
import { inLovingMemoryTheme } from "@/templates/InLovingMemory/theme";
import { ivoryBlushTheme } from "@/templates/IvoryBlush/theme";
import { kidsCartoonTheme } from "@/templates/KidsCartoon/theme";
import { littleBlessingsTheme } from "@/templates/LittleBlessings/theme";
import { liveSignalTheme } from "@/templates/LiveSignal/theme";
import { milestoneElegantTheme } from "@/templates/MilestoneElegant/theme";
import { minimalWhiteTheme } from "@/templates/MinimalWhite/theme";
import { momentumTheme } from "@/templates/Momentum/theme";
import { neonPartyTheme } from "@/templates/NeonParty/theme";
import { retroDiscoTheme } from "@/templates/RetroDisco/theme";
import { royalGoldTheme } from "@/templates/RoyalGold/theme";
import { vintageKeepsakeTheme } from "@/templates/VintageKeepsake/theme";
import { whiteCoatReunionTheme } from "@/templates/WhiteCoatReunion/theme";

/**
 * Slug → palette for every built-in template, without pulling in any
 * template's section tree — so client components (the colour customiser
 * in features/templates/theme-color-customizer.tsx) can preview a
 * template's colours. lib/templates.ts stays the registry for the actual
 * rendering components; keep the two in step when adding a template.
 */
export const TEMPLATE_THEMES: Record<string, TemplateTheme> = {
  "royal-gold": royalGoldTheme,
  "floral-pastel": floralPastelTheme,
  "minimal-white": minimalWhiteTheme,
  "kids-cartoon": kidsCartoonTheme,
  "neon-party": neonPartyTheme,
  "golden-confetti": goldenConfettiTheme,
  "balloon-pop": balloonPopTheme,
  "milestone-elegant": milestoneElegantTheme,
  "retro-disco": retroDiscoTheme,
  "vintage-keepsake": vintageKeepsakeTheme,
  "ivory-blush": ivoryBlushTheme,
  "emerald-vow": emeraldVowTheme,
  "little-blessings": littleBlessingsTheme,
  "corporate-slate": corporateSlateTheme,
  "golden-farewell": goldenFarewellTheme,
  "in-loving-memory": inLovingMemoryTheme,
  "bright-beginnings": brightBeginningsTheme,
  "live-signal": liveSignalTheme,
  "eternal-rest": eternalRestTheme,
  "candlelight-tribute": candlelightTributeTheme,
  "boardroom-ivory": boardroomIvoryTheme,
  "momentum": momentumTheme,
  "white-coat-reunion": whiteCoatReunionTheme,
};
