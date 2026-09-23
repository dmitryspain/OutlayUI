/**
 * Finds recurring payments — subscriptions, utilities, rent — in a transaction history.
 * A series is the same payee charged at a steady interval (weekly / monthly / quarterly / yearly)
 * for a stable amount. Pure and deterministic, so it is easy to test.
 */
import { addDays, startOfDay } from './format';
import { Txn } from './models';

export type Cadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface CadenceSpec {
  id: Cadence;
  days: number;
  /** accepted interval range, days */
  min: number;
  max: number;
  /** charges needed before it counts */
  minCount: number;
  /** multiply one charge by this for a monthly equivalent */
  perMonth: number;
}

const CADENCES: readonly CadenceSpec[] = [
  { id: 'weekly', days: 7, min: 5, max: 9, minCount: 4, perMonth: 30.44 / 7 },
  { id: 'monthly', days: 30.44, min: 25, max: 36, minCount: 2, perMonth: 1 },
  { id: 'quarterly', days: 91.3, min: 80, max: 102, minCount: 2, perMonth: 1 / 3 },
  { id: 'yearly', days: 365.25, min: 340, max: 390, minCount: 2, perMonth: 1 / 12 },
];

/** share of intervals / amounts that must fit, so one skipped or odd month does not hide a series */
const FIT_SHARE = 0.75;
/** amounts within ±12 % of the typical one count as "the same price" */
const AMOUNT_TOLERANCE = 0.12;
/** with only two charges nothing else confirms the pattern, so the price must be (nearly) identical */
const PAIR_TOLERANCE = 0.02;
/** a series with no charge for this many intervals is treated as cancelled */
const STALE_INTERVALS = 1.6;

export interface Recurring {
  key: string;
  name: string;
  category: string;
  icon: string;
  cadence: Cadence;
  /** latest charge, positive */
  amount: number;
  /** the previous charge when the price changed by ≥ 1 %, else null */
  previousAmount: number | null;
  monthly: number;
  yearly: number;
  count: number;
  first: Date;
  last: Date;
  /** expected date of the next charge */
  next: Date;
  active: boolean;
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** One key per payee: bank prefixes and casing differ between charges of the same subscription. */
export const payeeKey = (description: string): string =>
  description.replace(/^Скасування\.\s*/i, '').trim().toLowerCase().replace(/\s+/g, ' ');

const DAY_MS = 86_400_000;

/** Same day of month `months` later, clamped to the month's length (31 Jan + 1 → 28/29 Feb). */
function addMonthsClamped(d: Date, months: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
}

function nextCharge(last: Date, spec: CadenceSpec, interval: number): Date {
  const day = startOfDay(last);
  switch (spec.id) {
    case 'monthly': return addMonthsClamped(day, 1);
    case 'quarterly': return addMonthsClamped(day, 3);
    case 'yearly': return addMonthsClamped(day, 12);
    default: return addDays(day, Math.round(interval));
  }
}

export function detectRecurring(txns: readonly Txn[], now = new Date()): Recurring[] {
  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    if (t.amount >= 0) continue;
    const key = payeeKey(t.description);
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.push(t);
    else groups.set(key, [t]);
  }

  const out: Recurring[] = [];
  for (const [key, list] of groups) {
    // one charge per day: a split or a retry on the same day is not a new period
    const byDay = new Map<string, Txn>();
    for (const t of list) if (!byDay.has(t.day) || byDay.get(t.day)!.date < t.date) byDay.set(t.day, t);
    const charges = [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
    if (charges.length < 2) continue;

    const intervals = charges.slice(1).map((t, i) => (t.date.getTime() - charges[i].date.getTime()) / DAY_MS);
    const typical = median(intervals);
    const spec = CADENCES.find(c => typical >= c.min && typical <= c.max);
    if (!spec || charges.length < spec.minCount) continue;
    if (intervals.filter(d => d >= spec.min && d <= spec.max).length < intervals.length * FIT_SHARE) continue;

    const amounts = charges.map(t => -t.amount);
    const usual = median(amounts);
    if (amounts.filter(a => Math.abs(a - usual) <= usual * AMOUNT_TOLERANCE).length < amounts.length * FIT_SHARE) continue;
    if (charges.length === 2 && Math.abs(amounts[0] - amounts[1]) > Math.max(amounts[0], amounts[1]) * PAIR_TOLERANCE) continue;

    const last = charges[charges.length - 1];
    const amount = -last.amount;
    const prev = -charges[charges.length - 2].amount;
    const next = nextCharge(last.date, spec, typical);
    const newest = [...list].sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    out.push({
      key,
      name: newest.description.replace(/^Скасування\.\s*/i, ''),
      category: newest.category,
      icon: list.find(t => t.icon)?.icon ?? '',
      cadence: spec.id,
      amount,
      previousAmount: Math.abs(amount - prev) >= prev * 0.01 ? prev : null,
      monthly: amount * spec.perMonth,
      yearly: amount * spec.perMonth * 12,
      count: charges.length,
      first: charges[0].date,
      last: last.date,
      next,
      active: now.getTime() - last.date.getTime() <= typical * STALE_INTERVALS * DAY_MS,
    });
  }
  return out.sort((a, b) => Number(b.active) - Number(a.active) || b.monthly - a.monthly);
}
