import { addDays, format, startOfWeek } from "date-fns";

// Week starts Monday
export function weekStart(d: Date = new Date()): Date {
  return startOfWeek(d, { weekStartsOn: 1 });
}
export function weekStartISO(d: Date = new Date()): string {
  return format(weekStart(d), "yyyy-MM-dd");
}
export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
export function fmtDate(d: Date | string): string {
  return format(typeof d === "string" ? new Date(d) : d, "MMM d, yyyy");
}
export function fmtHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
export function fmtHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}
