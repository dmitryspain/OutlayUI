/**
 * Pure budget maths: where the month stands, a pace-based forecast, and how worried to be.
 * Kept free of Angular so it is trivially testable.
 */

export interface MonthInfo {
  start: Date;
  /** days in the month */
  days: number;
  /** today's day of the month, 1-based */
  day: number;
  /** days still ahead, today included */
  left: number;
}

export function monthInfo(now = new Date()): MonthInfo {
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = now.getDate();
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), days, day, left: days - day + 1 };
}

/** Where the month ends if spending keeps today's average pace. */
export function forecast(spent: number, m: MonthInfo): number {
  return (spent / Math.max(1, m.day)) * m.days;
}

export type BudgetLevel = 'ok' | 'warn' | 'over';

/** Spent ≥ 80 % or heading past the limit → warn; already past it → over. */
export function budgetLevel(spent: number, limit: number, projected: number): BudgetLevel {
  if (spent > limit) return 'over';
  if (spent >= limit * 0.8 || projected > limit) return 'warn';
  return 'ok';
}

/** What can still be spent per day (today included) to stay within the limit. */
export function safePerDay(spent: number, limit: number, m: MonthInfo): number {
  return Math.max(0, limit - spent) / Math.max(1, m.left);
}

/** A round limit from past full months (their average), or null without history. */
export function suggestLimit(monthly: readonly number[]): number | null {
  const past = monthly.filter(v => v > 0);
  if (!past.length) return null;
  const avg = past.reduce((s, v) => s + v, 0) / past.length;
  const step = avg < 1_000 ? 50 : avg < 10_000 ? 100 : 500;
  return Math.ceil(avg / step) * step;
}

export const LEVEL_ORDER: Record<BudgetLevel, number> = { over: 0, warn: 1, ok: 2 };
