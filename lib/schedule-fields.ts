export interface ScheduleDetails {
  dayLabel?: string | null;
  startLabel?: string;
  endLabel?: string | null;
  title?: string;
  description?: string | null;
}

export function normalizeScheduleDetails(input: ScheduleDetails): ScheduleDetails {
  const result: ScheduleDetails = {};
  for (const key of ["dayLabel", "startLabel", "endLabel", "title", "description"] as const) {
    if (input[key] === undefined) continue;
    const raw = input[key];
    if (raw !== null && typeof raw !== "string") throw new Error("Please enter valid schedule details.");
    const value = raw?.trim() ?? "";
    const required = key === "startLabel" || key === "title";
    if (required && !value) throw new Error("Start time and title are required.");
    const limit = key === "description" ? 2000 : key === "title" ? 200 : 120;
    if (value.length > limit) throw new Error(`${key === "dayLabel" ? "Day/date" : key} is too long (maximum ${limit} characters).`);
    if (key === "startLabel" || key === "title") result[key] = value;
    else result[key] = value || null;
  }
  return result;
}
