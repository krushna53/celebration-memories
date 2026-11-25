// AI wedding video studio API: /api/ai-video/config, /quote, /generate, /status, /media, /history, /balance, /suggest-story.
// Secrets (server only): XAI_API_KEY; optional AI_VIDEO_ACCESS_CODE (16+ chars, lets a request carrying it skip the
// free-film limit), XAI_MANAGEMENT_API_KEY + XAI_TEAM_ID for the owner's remaining-credits readout,
// AI_VIDEO_FREE_FILMS (default 1) and AI_VIDEO_DAILY_LIMIT (default 20).
//
// No access code is asked for on the page. Instead each visitor — the logged-in account, otherwise a private
// per-browser cookie, and also their IP address — gets AI_VIDEO_FREE_FILMS paid generations (one clip holds every
// scene of the film), with at most AI_VIDEO_DAILY_LIMIT films a day across the whole site. The site owner's account
// is unlimited. See serveAiVideo() in features/ai-video/lib/ai-video-service.mjs.
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { serveAiVideo } from "@/features/ai-video/lib/ai-video-service.mjs";
import { aiVideoStore } from "@/features/ai-video/lib/ai-video-store.mjs";
import { getClientIp } from "@/lib/ip-hash";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VISITOR_COOKIE = "em_ai_visitor";

/** Who is asking: { id, ip, owner } — plus the cookie to set if this browser hasn't got one yet. */
async function currentVisitor(request) {
  const ip = getClientIp(request.headers);
  let userId = null;
  let owner = false;
  try {
    const {
      data: { user },
    } = await (await supabaseServer()).auth.getUser();
    if (user && !user.is_anonymous) {
      userId = user.id;
      const { data } = await supabaseAdmin().from("admins").select("role").eq("id", user.id).maybeSingle();
      owner = data?.role === "owner";
    }
  } catch {
    // no session / auth unavailable: treated as a guest
  }
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  const browserId = existing && /^[a-f0-9-]{36}$/.test(existing) ? existing : randomUUID();
  return {
    visitor: { id: userId ? `user:${userId}` : `browser:${browserId}`, ip: ip === "unknown" ? null : ip, owner },
    newCookie: existing === browserId ? null : browserId,
  };
}

const positive = (value, fallback) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

async function handle(request) {
  const { visitor, newCookie } = await currentVisitor(request);
  const response = await serveAiVideo(request, {
    store: await aiVideoStore(),
    apiKey: process.env.XAI_API_KEY ?? "",
    accessCode: process.env.AI_VIDEO_ACCESS_CODE ?? "",
    managementKey: process.env.XAI_MANAGEMENT_API_KEY ?? "",
    teamId: process.env.XAI_TEAM_ID ?? "",
    visitor,
    freeFilms: positive(process.env.AI_VIDEO_FREE_FILMS, 1),
    dailyFilmLimit: positive(process.env.AI_VIDEO_DAILY_LIMIT, 20),
  });
  if (newCookie) {
    (await cookies()).set(VISITOR_COOKIE, newCookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export { handle as GET, handle as POST };
