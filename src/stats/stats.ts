import type { Book, PageRead } from '../library/db';

/** Longer than this on one page, the child probably stopped reading: time is capped, speed ignored. */
export const IDLE_MS = 5 * 60_000;
/** Pages shown less than this were just flipped through. */
export const MIN_READ_MS = 2_000;
const SPEED_MIN_MS = 5_000;
const SPEED_MIN_WORDS = 15;
const SPEED_MAX_WPM = 400;

const DAY = 86_400_000;

/** Local calendar day key, e.g. "2026-09-26". */
export function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthKey(ts: number) {
  return dayKey(ts).slice(0, 7);
}

/** Monday 00:00 (local time) of the week containing `ts`. */
export function weekStart(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export const readingMs = (r: PageRead) => Math.min(r.ms, IDLE_MS);

/** Whether a page gives a trustworthy reading speed (enough words, not skimmed, not left open). */
export const usableForSpeed = (r: PageRead) =>
  r.words >= SPEED_MIN_WORDS &&
  r.ms >= SPEED_MIN_MS &&
  r.ms <= IDLE_MS &&
  r.words / (r.ms / 60_000) <= SPEED_MAX_WPM;

/** Words per minute over a set of pages (total words / total minutes), or undefined without usable pages. */
export function wordsPerMinute(reads: PageRead[]): number | undefined {
  let words = 0;
  let ms = 0;
  for (const r of reads) {
    if (!usableForSpeed(r)) continue;
    words += r.words;
    ms += r.ms;
  }
  return ms ? Math.round(words / (ms / 60_000)) : undefined;
}

export interface DayStat {
  day: string;
  date: number;
  pages: number;
  minutes: number;
}

/** One entry per day for the last `days` days (oldest first), including days without reading. */
export function perDay(reads: PageRead[], days: number, now = Date.now()): DayStat[] {
  const out: DayStat[] = [];
  const index = new Map<string, DayStat>();
  const today = new Date(now);
  today.setHours(12, 0, 0, 0); // noon avoids DST edge cases when stepping by 24h
  for (let i = days - 1; i >= 0; i--) {
    const date = today.getTime() - i * DAY;
    const s = { day: dayKey(date), date, pages: 0, minutes: 0 };
    out.push(s);
    index.set(s.day, s);
  }
  for (const r of reads) {
    const s = index.get(dayKey(r.at));
    if (!s) continue;
    s.pages++;
    s.minutes += readingMs(r) / 60_000;
  }
  return out;
}

export interface WeekStat {
  start: number;
  wpm?: number;
  minutes: number;
}

/** Reading speed and time per week for the last `weeks` weeks (oldest first). */
export function perWeek(reads: PageRead[], weeks: number, now = Date.now()): WeekStat[] {
  const current = weekStart(now);
  const out: WeekStat[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(current);
    d.setDate(d.getDate() - 7 * i);
    const start = d.getTime();
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const inWeek = reads.filter((r) => r.at >= start && r.at < end.getTime());
    out.push({
      start,
      wpm: wordsPerMinute(inWeek),
      minutes: inWeek.reduce((a, r) => a + readingMs(r), 0) / 60_000,
    });
  }
  return out;
}

export interface MonthStat {
  month: string;
  date: number;
  books: Book[];
}

/** Books finished per month for the last `months` months (oldest first). */
export function finishedPerMonth(books: Book[], months: number, now = Date.now()): MonthStat[] {
  const out: MonthStat[] = [];
  const d = new Date(now);
  d.setDate(1);
  d.setHours(12, 0, 0, 0);
  d.setMonth(d.getMonth() - (months - 1));
  for (let i = 0; i < months; i++) {
    const date = d.getTime();
    const month = monthKey(date);
    out.push({ month, date, books: books.filter((b) => b.finishedAt && monthKey(b.finishedAt) === month) });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/** Consecutive days with reading, ending today (or yesterday, if today has no reading yet). */
export function streak(reads: PageRead[], now = Date.now()): number {
  const days = new Set(reads.map((r) => dayKey(r.at)));
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d.getTime()))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export interface BookStat {
  bookId: string;
  pages: number;
  minutes: number;
  wpm?: number;
  lastAt: number;
}

export function perBook(reads: PageRead[]): BookStat[] {
  const groups = new Map<string, PageRead[]>();
  for (const r of reads) {
    const list = groups.get(r.bookId) ?? [];
    list.push(r);
    groups.set(r.bookId, list);
  }
  return [...groups.entries()]
    .map(([bookId, list]) => ({
      bookId,
      pages: list.length,
      minutes: list.reduce((a, r) => a + readingMs(r), 0) / 60_000,
      wpm: wordsPerMinute(list),
      lastAt: Math.max(...list.map((r) => r.at)),
    }))
    .sort((a, b) => b.lastAt - a.lastAt);
}

/** Reads between two timestamps. */
export const between = (reads: PageRead[], from: number, to: number) => reads.filter((r) => r.at >= from && r.at < to);
