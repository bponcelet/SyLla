import { describe, expect, it } from 'vitest';
import type { Book, PageRead } from '../library/db';
import { finishedPerMonth, perBook, perDay, perWeek, streak, wordsPerMinute } from './stats';

const NOW = new Date(2026, 8, 26, 18, 0).getTime(); // Saturday 26 Sept 2026, 18:00
const at = (daysAgo: number, hour = 17) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};
const read = (daysAgo: number, words: number, seconds: number, bookId = 'a'): PageRead => ({
  bookId,
  at: at(daysAgo),
  ms: seconds * 1000,
  words,
});

describe('reading statistics', () => {
  it('computes words per minute as total words over total time', () => {
    expect(wordsPerMinute([read(0, 60, 60), read(0, 120, 60)])).toBe(90);
  });

  it('ignores skimmed, abandoned and almost empty pages for speed', () => {
    const reads = [
      read(0, 60, 60),
      read(0, 80, 3), // flipped through
      read(0, 80, 20 * 60), // left open
      read(0, 5, 30), // title page
      read(0, 200, 10), // 1200 wpm: skimming
    ];
    expect(wordsPerMinute(reads)).toBe(60);
    expect(wordsPerMinute([read(0, 5, 30)])).toBeUndefined();
  });

  it('counts pages and minutes per day, with empty days', () => {
    const days = perDay([read(0, 50, 60), read(0, 50, 120), read(2, 50, 30 * 60)], 3, NOW);
    expect(days.map((d) => d.pages)).toEqual([1, 0, 2]);
    expect(days[2].minutes).toBe(3);
    expect(days[0].minutes).toBe(5); // capped at 5 minutes per page
  });

  it('groups reading speed by week (Monday start)', () => {
    const weeks = perWeek([read(0, 100, 60), read(7, 50, 60)], 3, NOW);
    expect(weeks.map((w) => w.wpm)).toEqual([undefined, 50, 100]);
  });

  it('counts the reading streak ending today or yesterday', () => {
    expect(streak([read(0, 50, 60), read(1, 50, 60), read(2, 50, 60), read(4, 50, 60)], NOW)).toBe(3);
    expect(streak([read(1, 50, 60), read(2, 50, 60)], NOW)).toBe(2);
    expect(streak([read(3, 50, 60)], NOW)).toBe(0);
  });

  it('counts finished books per month', () => {
    const book = (id: string, finishedAt?: number) => ({ id, title: id, author: '', size: 0, addedAt: 0, finishedAt }) as Book;
    const months = finishedPerMonth([book('a', at(0)), book('b', at(40)), book('c')], 3, NOW);
    expect(months.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(months.map((m) => m.books.length)).toEqual([0, 1, 1]);
  });

  it('summarises each book, most recent first', () => {
    const books = perBook([read(3, 60, 60, 'a'), read(1, 60, 60, 'b'), read(0, 60, 60, 'a')]);
    expect(books.map((b) => [b.bookId, b.pages])).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
  });
});
