import { format } from "date-fns";

export function formatEventDate(iso: string): string {
  return format(new Date(iso), "EEEE, MMMM d, yyyy");
}

export function formatEventTime(iso: string): string {
  return format(new Date(iso), "h:mm a");
}
