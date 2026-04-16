import type { Priority } from './schemas.js';

export interface ParsedQuickAdd {
  title: string;
  estimateMinutes: number | null;
  roleTag: string | null;
  priority: Priority | null;
  dateToken: string | null;
}

const TIME_RE = /(^|\s)~(\d+)(m|h)(?=\s|$)/i;
const ROLE_RE = /(^|\s)#([a-z0-9_-]+)(?=\s|$)/i;
const PRIO_RE = /(^|\s)!([hml])(?=\s|$)/i;
const DATE_RE = /(^|\s)\+([a-z]+)(?=\s|$)/i;

/**
 * Parse the quick-add input bar syntax.
 * All modifiers are optional and order-agnostic. Unknown tokens are kept in the title.
 *
 * Examples:
 *   "Buy domain ~30m #product !h +tomorrow"
 *   "Write pitch deck #strategy ~2h"
 */
export function parseQuickAdd(input: string): ParsedQuickAdd {
  let rest = ` ${input.trim()} `;

  let estimateMinutes: number | null = null;
  const timeMatch = rest.match(TIME_RE);
  if (timeMatch) {
    const amount = Number(timeMatch[2]);
    const unit = timeMatch[3]!.toLowerCase();
    estimateMinutes = unit === 'h' ? amount * 60 : amount;
    rest = rest.replace(TIME_RE, ' ');
  }

  let roleTag: string | null = null;
  const roleMatch = rest.match(ROLE_RE);
  if (roleMatch) {
    roleTag = roleMatch[2]!.toLowerCase();
    rest = rest.replace(ROLE_RE, ' ');
  }

  let priority: Priority | null = null;
  const prioMatch = rest.match(PRIO_RE);
  if (prioMatch) {
    const code = prioMatch[2]!.toLowerCase();
    priority = code === 'h' ? 'high' : code === 'm' ? 'medium' : 'low';
    rest = rest.replace(PRIO_RE, ' ');
  }

  let dateToken: string | null = null;
  const dateMatch = rest.match(DATE_RE);
  if (dateMatch) {
    dateToken = dateMatch[2]!.toLowerCase();
    rest = rest.replace(DATE_RE, ' ');
  }

  const title = rest.replace(/\s+/g, ' ').trim();

  return { title, estimateMinutes, roleTag, priority, dateToken };
}

/**
 * Resolve a `+date` token (e.g. "today", "tomorrow", "mon") to an ISO date string
 * (YYYY-MM-DD) in the user's local timezone. Returns null for unknown tokens.
 *
 * Weekday tokens resolve to the NEXT occurrence of that weekday (today counts only
 * if no match otherwise — the next same-day instance is 7 days away).
 */
export function resolveDateToken(token: string | null, now: Date = new Date()): string | null {
  if (!token) return null;
  const t = token.toLowerCase();

  const addDays = (base: Date, days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return toLocalIsoDate(d);
  };

  if (t === 'today') return toLocalIsoDate(now);
  if (t === 'tomorrow' || t === 'tmrw' || t === 'tom') return addDays(now, 1);
  if (t === 'yesterday') return addDays(now, -1);

  const weekdayMap: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    weds: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };

  const target = weekdayMap[t];
  if (target === undefined) return null;

  const currentDow = now.getDay();
  let delta = target - currentDow;
  if (delta <= 0) delta += 7;
  return addDays(now, delta);
}

/** Format a Date as a local YYYY-MM-DD string. */
export function toLocalIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
