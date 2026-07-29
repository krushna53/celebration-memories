/**
 * Re-exported from lib/timezone.ts, which pins these to India Standard
 * Time explicitly instead of the ambient server timezone — see that
 * file's header comment for why. Kept as a separate module so existing
 * `@/lib/format` imports across the app don't need to change.
 */
export { formatEventDate, formatEventTime } from "@/lib/timezone";
