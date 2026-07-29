#!/usr/bin/env node
/**
 * Creates a fully-populated DEMO client event — for trying out the
 * platform, showing a prospective client what a finished event looks
 * like, or QA testing without touching real event data. Not wired into
 * any admin UI button; run manually with `node scripts/seed-demo-client.mjs`.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in
 * .env.local (same ones the app itself uses) — loaded manually below
 * rather than pulling in a dotenv dependency for a one-off script.
 *
 * Creates, end to end:
 * - One event ("Mahesh Mama" 75th birthday, all fields filled in)
 * - 6 gallery photos (one per category) + a share-image + a highlight
 *   reel video, all placeholder images/video generated locally (see
 *   scripts/seed-demo-client-assets/, produced by make_images.py + ffmpeg
 *   — NOT real photos, just colored placeholders with text captions)
 * - 6 timeline milestones
 * - 4 invitees with a spread of RSVP statuses, one of whom has an
 *   approved guest photo, video, and guestbook message so the Memory
 *   Wall / stats aren't empty
 * - One client-role admin login (email+password printed at the end)
 *   scoped to this event via admins.event_id
 *
 * Safe to re-run: uses a fixed, easily-recognizable slug/email and skips
 * creation if an event with that slug already exists.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, "seed-demo-client-assets");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const text = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

const env = loadEnvLocal();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_SLUG = "mahesh-mama-75th-demo";
const DEMO_ADMIN_EMAIL = "demo.maheshmama@example.com";
const DEMO_ADMIN_PASSWORD = "DemoClient#2026";

const TOKEN_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function generateInviteToken(length = 8) {
  let token = "";
  for (let i = 0; i < length; i++) {
    token += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)];
  }
  return token;
}

function buildMapsSearchUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
function buildMapsEmbedUrl(address) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}

async function uploadAsset(bucket, destPath, localFile, contentType) {
  const buffer = readFileSync(path.join(ASSETS_DIR, localFile));
  const { error } = await supabase.storage.from(bucket).upload(destPath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Upload failed for ${destPath}: ${error.message}`);
  return destPath;
}

async function main() {
  console.log("Checking for existing demo event...");
  const { data: existing } = await supabase.from("events").select("id, slug").eq("slug", DEMO_SLUG).maybeSingle();
  if (existing) {
    console.log(`Demo event already exists (slug: ${existing.slug}, id: ${existing.id}). Skipping creation.`);
    console.log(`Admin login: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
    return;
  }

  const venueAddress = "142 MG Road, Andheri West, Mumbai, Maharashtra 400058";

  console.log("Creating event...");
  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      slug: DEMO_SLUG,
      status: "active",
      category: "birthday",
      occasion: "75th Birthday Celebration",
      honoree_name: "Mahesh Mama",
      event_title: "75 Golden Years",
      hosted_by: "Rohan & Ankit",
      venue_name: "Sunrise Banquet Hall",
      venue_address: venueAddress,
      maps_url: buildMapsSearchUrl(venueAddress),
      maps_embed_url: buildMapsEmbedUrl(venueAddress),
      parking_info: "Complimentary valet parking available at the main entrance.",
      start_at: "2026-05-07T11:00:00+05:30",
      end_at: "2026-05-07T15:00:00+05:30",
      occasion_date: "1951-08-04",
      dress_code: "Festive Indian Traditional",
      template_slug: "royal-gold",
      visibility: "public",
      short_description: "Join us as we celebrate 75 wonderful years of Mahesh Mama's life.",
      public_rsvp_enabled: true,
      public_memories_enabled: true,
      additional_notes: "No gifts please, your presence is enough.\nValet parking available on-site.",
      wish_message: "Wishing you endless joy, good health, and many more milestones to celebrate together!",
    })
    .select("id, slug")
    .single();

  if (eventError || !event) throw new Error(`Failed to create event: ${eventError?.message}`);
  const eventId = event.id;
  console.log(`Event created: ${event.slug} (${eventId})`);

  console.log("Uploading placeholder media...");
  const galleryPhotos = [
    { file: "childhood.jpg", category: "childhood", caption: "Mahesh, age 6 - 1957" },
    { file: "wedding.jpg", category: "wedding", caption: "Wedding day - 1987" },
    { file: "family.jpg", category: "family", caption: "Family gathering - 2010" },
    { file: "friends.jpg", category: "friends", caption: "College friends reunion - 2018" },
    { file: "travel.jpg", category: "travel", caption: "Family trip to Goa - 2015" },
    { file: "grandchildren.jpg", category: "grandchildren", caption: "With the grandkids - 2023" },
  ];

  const galleryPaths = {};
  let sortOrder = 0;
  for (const photo of galleryPhotos) {
    const destPath = `${eventId}/gallery/demo-${photo.category}-${Date.now()}.jpg`;
    await uploadAsset("gallery", destPath, photo.file, "image/jpeg");
    galleryPaths[photo.category] = destPath;
    await supabase.from("gallery_photos").insert({
      event_id: eventId,
      category: photo.category,
      storage_path: destPath,
      caption: photo.caption,
      sort_order: sortOrder++,
    });
  }
  console.log(`  ${galleryPhotos.length} gallery photos uploaded.`);

  const shareImagePath = `${eventId}/share-image/demo-cover-${Date.now()}.jpg`;
  await uploadAsset("gallery", shareImagePath, "share-cover.jpg", "image/jpeg");

  const highlightReelPath = `${eventId}/highlight-reel/demo-reel-${Date.now()}.mp4`;
  await uploadAsset("gallery", highlightReelPath, "highlight-reel.mp4", "video/mp4");

  await supabase
    .from("events")
    .update({ share_image_path: shareImagePath, highlight_reel_path: highlightReelPath })
    .eq("id", eventId);
  console.log("  Share image + highlight reel set.");

  console.log("Adding timeline milestones...");
  const milestones = [
    { period: "1951", title: "Born in Mumbai", description: "Mahesh Mama was born on August 4th, 1951, the second of four siblings." },
    { period: "1987", title: "Marriage", description: "Mahesh Mama married the love of his life, beginning a beautiful journey together." },
    { period: "1990", title: "Welcomed Ankit", description: "Their younger son Ankit was born on January 6th, 1990." },
    { period: "1991", title: "Welcomed Rohan", description: "Their elder son Rohan was born on November 6th, 1991." },
    { period: "2015", title: "Retirement", description: "After decades of dedicated service, Mahesh Mama retired to spend more time with family." },
    { period: "2026", title: "75th Birthday Celebration", description: "Family and friends gather to celebrate Mahesh Mama's 75th birthday." },
  ];
  for (const [i, m] of milestones.entries()) {
    await supabase.from("timeline_milestones").insert({ event_id: eventId, ...m, sort_order: i });
  }
  console.log(`  ${milestones.length} milestones added.`);

  console.log("Adding invitees + RSVPs...");
  const invitees = [
    { name: "Rohan Mama", relationship: "Son", rsvp_status: "coming", invite_channel: "self_web" },
    { name: "Ankit Mama", relationship: "Son", rsvp_status: "coming", invite_channel: "self_web" },
    { name: "Priya Shah", relationship: "Niece", rsvp_status: "maybe", invite_channel: "whatsapp" },
    { name: "Suresh Patel", relationship: "Friend", rsvp_status: "pending", invite_channel: null },
  ];
  const inviteeIds = {};
  for (const inv of invitees) {
    const { data, error } = await supabase
      .from("invitees")
      .insert({
        event_id: eventId,
        token: generateInviteToken(),
        name: inv.name,
        relationship: inv.relationship,
        rsvp_status: inv.rsvp_status,
        invite_channel: inv.invite_channel,
        visit_count: inv.rsvp_status === "pending" ? 0 : Math.floor(Math.random() * 4) + 1,
        opened_at: inv.rsvp_status === "pending" ? null : new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to create invitee ${inv.name}: ${error.message}`);
    inviteeIds[inv.name] = data.id;

    if (inv.rsvp_status !== "pending") {
      await supabase.from("rsvps").insert({
        invitee_id: data.id,
        coming: inv.rsvp_status,
        adults: 2,
        children: inv.name === "Priya Shah" ? 1 : 0,
        meal_preference: "vegetarian",
        comments: inv.name === "Rohan Mama" ? "Looking forward to it, Dad!" : null,
      });
    }
  }
  console.log(`  ${invitees.length} invitees added.`);

  console.log("Adding an approved guest memory (photo, video, guestbook)...");
  const priyaId = inviteeIds["Priya Shah"];

  const guestPhotoPath = `${eventId}/${priyaId}/demo-guest-photo-${Date.now()}.jpg`;
  await uploadAsset("photos", guestPhotoPath, "guest-upload.jpg", "image/jpeg");
  await supabase.from("photos").insert({
    invitee_id: priyaId,
    event_id: eventId,
    caption: "So excited to celebrate with you, Mama!",
    storage_path: guestPhotoPath,
    approved: true,
  });

  const guestVideoPath = `${eventId}/${priyaId}/demo-guest-video-${Date.now()}.mp4`;
  await uploadAsset("videos", guestVideoPath, "guest-video.mp4", "video/mp4");
  await supabase.from("videos").insert({
    invitee_id: priyaId,
    event_id: eventId,
    caption: "A little birthday message for you!",
    storage_path: guestVideoPath,
    approved: true,
  });

  await supabase.from("guestbook").insert({
    invitee_id: priyaId,
    event_id: eventId,
    guest_name: "Priya Shah",
    message: "Happy 75th birthday, Mama! Wishing you health, happiness, and many more years ahead. Can't wait to celebrate with the whole family!",
    country: "India",
    approved: true,
  });
  console.log("  Guest photo, video, and guestbook message added.");

  console.log("Creating client admin login...");
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: DEMO_ADMIN_EMAIL,
    password: DEMO_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { name: "Rohan Mama (Demo)" },
  });
  if (authError) throw new Error(`Failed to create auth user: ${authError.message}`);

  const { error: adminError } = await supabase.from("admins").insert({
    id: authUser.user.id,
    email: DEMO_ADMIN_EMAIL,
    name: "Rohan Mama (Demo)",
    role: "client",
    event_id: eventId,
  });
  if (adminError) throw new Error(`Failed to create admins row: ${adminError.message}`);

  console.log("\nDone!");
  console.log(`Event: /events/${DEMO_SLUG}`);
  console.log(`Admin login: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
