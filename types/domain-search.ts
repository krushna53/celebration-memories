/**
 * Client-safe type for GoDaddy domain availability results — split out
 * from lib/godaddy.ts (which has `import "server-only"` and pulls in
 * fetch calls with API credentials) so the client-side search form can
 * import the shape without pulling in server-only code. Same pattern as
 * lib/template-catalog.ts vs lib/templates.ts.
 */
export interface DomainAvailabilityResult {
  domain: string;
  available: boolean;
  price: number | null;
  currency: string | null;
}
