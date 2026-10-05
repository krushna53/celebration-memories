/**
 * Fields on an event that are plan limits — the storage quota and every
 * per-event AI generation cap. Only the platform owner sets these;
 * client hosts and wizard draft links must never be able to raise them
 * (the storage quota blocks uploads — services/storage-quota.ts).
 * Matched by name so a newly added "...GenerationLimit" is covered
 * automatically.
 */
function isPlanLimitField(key: string): boolean {
  return key === "storageQuotaGb" || key.endsWith("GenerationLimit");
}

/** A copy of `input` with every plan-limit field removed. */
export function withoutPlanLimits<T extends object>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([key]) => !isPlanLimitField(key))) as T;
}
