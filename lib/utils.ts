import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names conditionally, resolving conflicting
 * utility classes in favour of the last one supplied.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
