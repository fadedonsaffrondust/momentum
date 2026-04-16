import { toLocalIsoDate } from '@momentum/shared';

export function todayIso(): string {
  return toLocalIsoDate(new Date());
}

export function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalIsoDate(d);
}

export function isPast(iso: string): boolean {
  return iso < todayIso();
}

export function isToday(iso: string | null): boolean {
  return iso === todayIso();
}
