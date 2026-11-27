// Job records for the AI wedding video studio (/ai-video).
// Netlify Blobs on Netlify (one store per deploy context), plain JSON files in .local-ai-video/ on a local machine.
// Shape expected by serveAiVideo(): { list(), get(key), set(key, job), claim(key, job) → true if it was new }.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const onNetlify = () => Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT || globalThis.Netlify);
const missing = (error) => { if (error.code === "ENOENT") return null; throw error; };

export async function aiVideoStore() {
  if (onNetlify()) {
    const { getStore } = await import("@netlify/blobs");
    const jobs = getStore({ name: `ai-video-jobs-${process.env.CONTEXT || "production"}`, consistency: "strong" });
    return {
      list: async () => {
        const { blobs } = await jobs.list({ prefix: "job-" });
        return Promise.all(blobs.map(async (entry) => ({ key: entry.key, job: await jobs.get(entry.key, { type: "json" }) })));
      },
      get: (key) => jobs.get(key, { type: "json" }),
      set: (key, job) => jobs.setJSON(key, job),
      claim: async (key, job) => (await jobs.setJSON(key, job, { onlyIfNew: true })).modified,
    };
  }
  const dir = path.resolve(".local-ai-video"), file = (key) => path.join(dir, `${key}.json`);
  const get = async (key) => { const text = await readFile(file(key), "utf8").catch(missing); return text ? JSON.parse(text) : null; };
  return {
    list: async () => {
      const names = await readdir(dir).catch((e) => (e.code === "ENOENT" ? [] : Promise.reject(e)));
      const keys = names.filter((n) => n.startsWith("job-") && n.endsWith(".json")).map((n) => n.slice(0, -5));
      return Promise.all(keys.map(async (key) => ({ key, job: await get(key) })));
    },
    get,
    set: async (key, job) => { await mkdir(dir, { recursive: true }); await writeFile(file(key), JSON.stringify(job)); },
    claim: async (key, job) => {
      await mkdir(dir, { recursive: true });
      try { await writeFile(file(key), JSON.stringify(job), { flag: "wx" }); return true; }
      catch (error) { if (error.code === "EEXIST") return false; throw error; }
    },
  };
}
