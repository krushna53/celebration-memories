import { NextResponse, type NextRequest } from "next/server";
import { verifyMediaLink } from "@/lib/media-url";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authorizeMedia } from "@/services/media-access";
import { recordSupportMediaOutcome } from "@/services/support-media";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store", "Vary": "Cookie, Authorization", "X-Robots-Tag": "noindex" };
export async function GET(request: NextRequest, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path: segments } = await params;
  const path = segments.join("/");
  const q = request.nextUrl.searchParams;
  const signature = verifyMediaLink(bucket, path, q.get("e"), q.get("s"));
  if (!signature.ok) return new NextResponse(null, { status: 404, headers });
  const permission = await authorizeMedia(bucket, path, q.get("support") === "1");
  if (!permission) return new NextResponse(null, { status: 404, headers });
  const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUrl(path, permission.ttl);
  if (error || !data) return new NextResponse(null, { status: 404, headers });
  if (permission.support && !await recordSupportMediaOutcome(permission.eventId, `${bucket}/${path}`)) return new NextResponse(null, { status: 404, headers });
  return NextResponse.redirect(data.signedUrl, { status: 302, headers });
}
