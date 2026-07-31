#!/usr/bin/env node
/**
 * Seeds the Marketplace/Discovery module with categories, cities, a
 * handful of approved demo listings (so directory/listing pages have
 * real data to render), and the event-type -> category suggestion
 * mappings ("AI Features" from the module spec). Safe to re-run —
 * every insert checks for an existing row by slug/name first.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in
 * .env.local, same as scripts/seed-demo-client.mjs.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function upsertCategory(slug, name, parentSlug, description, icon, sortOrder) {
  const { data: existing } = await supabase.from("marketplace_categories").select("id").eq("slug", slug).maybeSingle();
  if (existing) return existing.id;

  let parentId = null;
  if (parentSlug) {
    const { data: parent } = await supabase.from("marketplace_categories").select("id").eq("slug", parentSlug).maybeSingle();
    parentId = parent?.id ?? null;
  }

  const { data, error } = await supabase
    .from("marketplace_categories")
    .insert({ slug, name, parent_id: parentId, description: description || null, icon: icon || null, sort_order: sortOrder ?? 0 })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create category ${slug}: ${error.message}`);
  console.log(`  + category ${slug}`);
  return data.id;
}

async function upsertCity(slug, name, state) {
  const { data: existing } = await supabase.from("marketplace_cities").select("id").eq("slug", slug).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase.from("marketplace_cities").insert({ slug, name, state, country: "India" }).select("id").single();
  if (error) throw new Error(`Failed to create city ${slug}: ${error.message}`);
  console.log(`  + city ${slug}`);
  return data.id;
}

async function ensureDemoAccount(email, name) {
  const { data: existingAccount } = await supabase.from("business_accounts").select("id").eq("email", email).maybeSingle();
  if (existingAccount) return existingAccount.id;

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: "MarketplaceDemo#2026",
    email_confirm: true,
    user_metadata: { name },
  });
  if (authError) throw new Error(`Failed to create auth user ${email}: ${authError.message}`);

  const { error } = await supabase.from("business_accounts").insert({ id: authUser.user.id, email, name });
  if (error) throw new Error(`Failed to create business account ${email}: ${error.message}`);
  console.log(`  + demo vendor account ${email}`);
  return authUser.user.id;
}

async function ensureListing(accountId, slug, fields, categoryIds) {
  const { data: existing } = await supabase.from("business_profiles").select("id").eq("slug", slug).maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("business_profiles")
    .insert({ account_id: accountId, slug, status: "approved", is_verified: true, ...fields })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create listing ${slug}: ${error.message}`);

  for (const categoryId of categoryIds) {
    await supabase.from("business_categories").upsert({ business_id: data.id, category_id: categoryId });
  }
  console.log(`  + listing ${slug}`);
  return data.id;
}

async function ensureSuggestion(eventCategory, categoryId, sortOrder) {
  const { data: existing } = await supabase
    .from("event_category_suggestions")
    .select("id")
    .eq("event_category", eventCategory)
    .eq("category_id", categoryId)
    .maybeSingle();
  if (existing) return;
  const { error } = await supabase
    .from("event_category_suggestions")
    .insert({ event_category: eventCategory, category_id: categoryId, sort_order: sortOrder ?? 0 });
  if (error) throw new Error(`Failed to add suggestion ${eventCategory}/${categoryId}: ${error.message}`);
}

async function main() {
  console.log("Categories...");
  const photography = await upsertCategory("photographers", "Photography", null, "Photographers for every kind of event.", "camera", 1);
  await upsertCategory("wedding-photographers", "Wedding Photographer", "photographers", null, null, 1);
  await upsertCategory("birthday-photographers", "Birthday Photographer", "photographers", null, null, 2);
  await upsertCategory("corporate-photographers", "Corporate Photographer", "photographers", null, null, 3);
  await upsertCategory("drone-photography", "Drone Photography", "photographers", null, null, 4);
  await upsertCategory("product-photography", "Product Photography", "photographers", null, null, 5);
  await upsertCategory("maternity-photography", "Maternity", "photographers", null, null, 6);
  await upsertCategory("kids-photography", "Kids", "photographers", null, null, 7);
  await upsertCategory("event-photography", "Event Photography", "photographers", null, null, 8);

  const videography = await upsertCategory("videographers", "Videography", null, "Film and video production for events.", "video", 2);
  await upsertCategory("wedding-films", "Wedding Films", "videographers", null, null, 1);
  await upsertCategory("corporate-films", "Corporate Films", "videographers", null, null, 2);
  await upsertCategory("workshop-videos", "Workshops", "videographers", null, null, 3);
  await upsertCategory("reels", "Reels", "videographers", null, null, 4);
  await upsertCategory("promotional-videos", "Promotional Videos", "videographers", null, null, 5);
  await upsertCategory("drone-videos", "Drone Videos", "videographers", null, null, 6);

  const venues = await upsertCategory("venues", "Venues", null, "Halls, resorts, lawns, and every kind of event space.", "building", 3);
  await upsertCategory("hotels", "Hotels", "venues", null, null, 1);
  await upsertCategory("resorts", "Resorts", "venues", null, null, 2);
  await upsertCategory("banquet-halls", "Banquet Hall", "venues", null, null, 3);
  await upsertCategory("convention-centers", "Convention Center", "venues", null, null, 4);
  await upsertCategory("farmhouses", "Farmhouse", "venues", null, null, 5);
  await upsertCategory("lawns", "Lawn", "venues", null, null, 6);
  await upsertCategory("villas", "Villa", "venues", null, null, 7);
  await upsertCategory("rooftops", "Rooftop", "venues", null, null, 8);
  await upsertCategory("cafes", "Cafe", "venues", null, null, 9);
  await upsertCategory("restaurants", "Restaurant", "venues", null, null, 10);
  await upsertCategory("beach-venues", "Beach Venue", "venues", null, null, 11);
  await upsertCategory("coworking-venues", "Coworking", "venues", null, null, 12);
  await upsertCategory("auditoriums", "Auditorium", "venues", null, null, 13);

  const entertainment = await upsertCategory("entertainment", "Entertainment", null, "Artists, musicians, and performers to bring your event to life.", "music", 4);
  await upsertCategory("celebrities", "Celebrity", "entertainment", null, null, 1);
  await upsertCategory("influencers", "Influencer", "entertainment", null, null, 2);
  await upsertCategory("comedians", "Comedian", "entertainment", null, null, 3);
  await upsertCategory("singers", "Singer", "entertainment", null, null, 4);
  await upsertCategory("bands", "Band", "entertainment", null, null, 5);
  const musicians = await upsertCategory("musicians", "Musician", "entertainment", null, null, 6);
  const djs = await upsertCategory("djs", "DJ", "entertainment", null, null, 7);
  await upsertCategory("anchors", "Anchor", "entertainment", null, null, 8);
  const mcs = await upsertCategory("mcs", "MC", "entertainment", null, null, 9);
  const dancers = await upsertCategory("dancers", "Dancer", "entertainment", null, null, 10);
  const magicians = await upsertCategory("magicians", "Magician", "entertainment", null, null, 11);
  const speakers = await upsertCategory("speakers", "Speaker", "entertainment", null, null, 12);

  console.log("Cities...");
  const mumbai = await upsertCity("mumbai", "Mumbai", "Maharashtra");
  const delhi = await upsertCity("delhi", "Delhi", "Delhi");
  const bangalore = await upsertCity("bangalore", "Bangalore", "Karnataka");
  const pune = await upsertCity("pune", "Pune", "Maharashtra");

  console.log("Demo vendors...");
  const photoAccount = await ensureDemoAccount("demo.photographer@example.com", "Aarav Mehta");
  const videoAccount = await ensureDemoAccount("demo.videographer@example.com", "Kavya Studios");
  const venueAccount = await ensureDemoAccount("demo.venue@example.com", "Sunrise Banquets");
  const djAccount = await ensureDemoAccount("demo.dj@example.com", "DJ Rohan Live");
  const magicianAccount = await ensureDemoAccount("demo.magician@example.com", "Magic by Kabir");

  console.log("Demo listings...");
  await ensureListing(
    photoAccount,
    "aarav-mehta-photography",
    {
      profile_type: "personal",
      display_name: "Aarav Mehta Photography",
      tagline: "Candid wedding & birthday photography across Mumbai",
      description:
        "10+ years photographing weddings, birthdays, and family milestones. Natural light, candid moments, same-week previews.",
      primary_category_id: photography,
      city_id: mumbai,
      cities_served: ["Mumbai", "Pune", "Thane"],
      languages: ["English", "Hindi", "Marathi"],
      tags: ["candid", "outdoor", "same-day-edit"],
      starting_price: 25000,
      price_unit: "per event",
      contact_email: "demo.photographer@example.com",
      contact_phone: "+919900000001",
      whatsapp_number: "+919900000001",
      instagram_url: "https://instagram.com/example",
      is_featured: true,
    },
    [photography],
  );

  await ensureListing(
    videoAccount,
    "kavya-studios-films",
    {
      profile_type: "business",
      display_name: "Kavya Studios",
      tagline: "Cinematic wedding & corporate films",
      description: "Full-service video production — cinematic wedding films, corporate event coverage, and drone footage.",
      primary_category_id: videography,
      city_id: delhi,
      cities_served: ["Delhi", "Gurugram", "Noida"],
      languages: ["English", "Hindi"],
      tags: ["cinematic", "drone", "same-day-highlight"],
      starting_price: 40000,
      price_unit: "per event",
      contact_email: "demo.videographer@example.com",
      contact_phone: "+919900000002",
      whatsapp_number: "+919900000002",
    },
    [videography],
  );

  await ensureListing(
    venueAccount,
    "sunrise-banquets-mumbai",
    {
      profile_type: "venue",
      display_name: "Sunrise Banquet Hall",
      tagline: "Elegant banquet hall for weddings & milestone birthdays",
      description: "A 400-seat air-conditioned banquet hall with in-house catering, valet parking, and decor partners on call.",
      primary_category_id: venues,
      city_id: mumbai,
      address: "142 MG Road, Andheri West, Mumbai",
      cities_served: ["Mumbai"],
      languages: ["English", "Hindi", "Marathi"],
      tags: ["ac-hall", "in-house-catering", "valet-parking"],
      starting_price: 150000,
      price_unit: "per event",
      contact_email: "demo.venue@example.com",
      contact_phone: "+919900000003",
      whatsapp_number: "+919900000003",
      is_featured: true,
    },
    [venues],
  );

  await ensureListing(
    djAccount,
    "dj-rohan-live",
    {
      profile_type: "personal",
      display_name: "DJ Rohan Live",
      tagline: "High-energy DJ for weddings, birthdays & corporate parties",
      description: "10+ years spinning at weddings, sangeets, birthdays, and corporate events across Bangalore.",
      primary_category_id: djs,
      city_id: bangalore,
      cities_served: ["Bangalore", "Mysore"],
      languages: ["English", "Hindi", "Kannada"],
      tags: ["bollywood", "edm", "sound-and-lighting-included"],
      starting_price: 20000,
      price_unit: "per event",
      contact_email: "demo.dj@example.com",
      contact_phone: "+919900000004",
      whatsapp_number: "+919900000004",
    },
    [entertainment, djs],
  );

  await ensureListing(
    magicianAccount,
    "magic-by-kabir",
    {
      profile_type: "personal",
      display_name: "Magic by Kabir",
      tagline: "Kids' birthday magic shows that steal the show",
      description: "Interactive magic shows built for kids' birthday parties — 45 minutes of tricks, balloon art, and games.",
      primary_category_id: magicians,
      city_id: pune,
      cities_served: ["Pune", "Mumbai"],
      languages: ["English", "Hindi", "Marathi"],
      tags: ["kids-party", "interactive", "balloon-art"],
      starting_price: 8000,
      price_unit: "per show",
      contact_email: "demo.magician@example.com",
      contact_phone: "+919900000005",
      whatsapp_number: "+919900000005",
    },
    [entertainment, magicians],
  );

  console.log("Event-type suggestions (AI Features)...");
  await ensureSuggestion("birthday", photography, 1);
  await ensureSuggestion("birthday", videography, 2);
  await ensureSuggestion("birthday", venues, 3);
  await ensureSuggestion("birthday", magicians, 4);
  await ensureSuggestion("birthday", djs, 5);

  await ensureSuggestion("wedding", photography, 1);
  await ensureSuggestion("wedding", videography, 2);
  await ensureSuggestion("wedding", venues, 3);
  await ensureSuggestion("wedding", musicians, 4);
  await ensureSuggestion("wedding", dancers, 5);

  await ensureSuggestion("corporate", videography, 1);
  await ensureSuggestion("corporate", venues, 2);
  await ensureSuggestion("corporate", speakers, 3);
  await ensureSuggestion("corporate", mcs, 4);
  await ensureSuggestion("corporate", photography, 5);

  await ensureSuggestion("workshop", venues, 1);
  await ensureSuggestion("workshop", speakers, 2);
  await ensureSuggestion("workshop", videography, 3);

  await ensureSuggestion("anniversary", photography, 1);
  await ensureSuggestion("anniversary", venues, 2);
  await ensureSuggestion("anniversary", musicians, 3);

  await ensureSuggestion("retirement", photography, 1);
  await ensureSuggestion("retirement", venues, 2);
  await ensureSuggestion("retirement", speakers, 3);

  await ensureSuggestion("baby_shower", photography, 1);
  await ensureSuggestion("baby_shower", venues, 2);
  await ensureSuggestion("baby_shower", djs, 3);

  console.log("\nDone. Demo vendor logins (all password: MarketplaceDemo#2026):");
  console.log("  demo.photographer@example.com");
  console.log("  demo.videographer@example.com");
  console.log("  demo.venue@example.com");
  console.log("  demo.dj@example.com");
  console.log("  demo.magician@example.com");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
