/**
 * `tz-lookup` ships no bundled types and its `@types/tz-lookup` package
 * couldn't be installed in this environment (unrelated npm/filesystem
 * issue) — this is a minimal ambient declaration for the one function
 * this project actually calls (see lib/timezone-lookup.ts).
 */
declare module "tz-lookup" {
  function tzlookup(latitude: number, longitude: number): string;
  export default tzlookup;
}
