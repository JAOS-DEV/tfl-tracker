import { buildScheduledDate } from "@/lib/londonTime";

export function ibusScheduledSecondsToInstant(
  scheduledSeconds: number,
  reference: Date,
): Date {
  const hour = Math.floor(scheduledSeconds / 3600);
  const minute = Math.floor((scheduledSeconds % 3600) / 60);
  return buildScheduledDate(String(hour), String(minute), reference);
}
