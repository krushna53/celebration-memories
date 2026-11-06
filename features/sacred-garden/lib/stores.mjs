// Where the Sacred Garden pages keep their data: Netlify Blobs on Netlify, plain folders on a local machine.
// - "wedding-websites": websites published from /wedding-websites/create (one JSON text per link)
// - "envelope-films": Grok's re-lettered envelope films (MP4 bytes); jobs for those films live beside them
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const onNetlify = () => Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT || globalThis.Netlify);
const missing = (error) => { if (error.code === "ENOENT") return null; throw error; };
const folder = (name) => path.resolve(".local-sacred-garden", name);
const blobs = async (name) => (await import("@netlify/blobs")).getStore({ name, consistency: "strong" });

/** { get(slug) → string | null, set(slug, string) } */
export async function websiteStore() {
  if (onNetlify()) return blobs("wedding-websites");
  const dir = folder("websites");
  return {
    get: (slug) => readFile(path.join(dir, `${slug}.json`), "utf8").catch(missing),
    set: async (slug, text) => { await mkdir(dir, { recursive: true }); await writeFile(path.join(dir, `${slug}.json`), text); },
  };
}

/** The film store and job store used by serveEnvelopeVideo(). */
export async function envelopeStores() {
  if (onNetlify()) {
    const films = await blobs("envelope-films"), jobs = await blobs(`envelope-video-jobs-${process.env.CONTEXT || "production"}`);
    return {
      films: { get: (id) => films.get(id, { type: "arrayBuffer" }), set: (id, bytes) => films.set(id, bytes) },
      store: { get: (k) => jobs.get(k, { type: "json" }), set: (k, v) => jobs.setJSON(k, v), claim: async (k, v) => (await jobs.setJSON(k, v, { onlyIfNew: true })).modified },
    };
  }
  const dir = folder("envelope"), filmDir = path.join(dir, "films");
  const file = (k) => path.join(dir, `${k}.json`);
  return {
    films: {
      get: (id) => readFile(path.join(filmDir, `${id}.mp4`)).catch(missing),
      set: async (id, bytes) => { await mkdir(filmDir, { recursive: true }); await writeFile(path.join(filmDir, `${id}.mp4`), bytes); },
    },
    store: {
      get: async (k) => { const t = await readFile(file(k), "utf8").catch(missing); return t ? JSON.parse(t) : null; },
      set: async (k, v) => { await mkdir(dir, { recursive: true }); await writeFile(file(k), JSON.stringify(v)); },
      claim: async (k, v) => { await mkdir(dir, { recursive: true }); try { await writeFile(file(k), JSON.stringify(v), { flag: "wx" }); return true; } catch (e) { if (e.code === "EEXIST") return false; throw e; } },
    },
  };
}
