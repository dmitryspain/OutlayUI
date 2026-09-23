/**
 * Pure aggregation over the transaction feed. Every screen derives its numbers from here,
 * so totals always agree between pages. Expenses/income are gross sums of negative/positive
 * amounts — the same numbers the old "grouped" endpoint produced.
 */
import { DateRange, Txn } from './models';
import { addDays, dayKey, dowMon0, endOfDay, startOfDay } from './format';

export interface Totals {
  expenses: number;
  income: number;
  net: number;
  count: number;
  /** cashback earned on these transactions */
  cashback: number;
}

export function totals(txns: readonly Txn[]): Totals {
  let expenses = 0;
  let income = 0;
  let cashback = 0;
  for (const t of txns) {
    if (t.amount < 0) expenses += -t.amount;
    else income += t.amount;
    cashback += t.cashback ?? 0;
  }
  return { expenses, income, net: income - expenses, count: txns.length, cashback };
}

export interface DayBucket {
  day: string;
  date: Date;
  expenses: number;
  income: number;
  net: number;
  count: number;
}

/** One bucket per calendar day of the range, empty days included. */
export function dayBuckets(txns: readonly Txn[], range: DateRange): DayBucket[] {
  const map = new Map<string, DayBucket>();
  for (let d = startOfDay(range.from); d <= range.to; d = addDays(d, 1)) {
    const day = dayKey(d);
    map.set(day, { day, date: d, expenses: 0, income: 0, net: 0, count: 0 });
  }
  for (const t of txns) {
    const b = map.get(t.day);
    if (!b) continue;
    if (t.amount < 0) b.expenses += -t.amount;
    else b.income += t.amount;
    b.net += t.amount;
    b.count++;
  }
  return [...map.values()];
}

/**
 * Who a transaction is with: for a transfer the bank's own name of the other party (the description is
 * often just "Від: Ірина Ш."), otherwise the merchant as described.
 */
export const payeeOf = (t: Pick<Txn, 'counterName' | 'description'>): string => t.counterName || t.description;

export interface Ranked {
  key: string;
  label: string;
  amount: number;
  count: number;
  /** 0..1 share of the total for this kind */
  share: number;
  category: string;
  /** the first non-empty icon URL among the grouped transactions */
  icon: string;
}

export type Kind = 'expense' | 'income';

export function rank(txns: readonly Txn[], by: 'category' | 'merchant', kind: Kind): Ranked[] {
  const map = new Map<string, Ranked>();
  let total = 0;
  for (const t of txns) {
    if ((kind === 'expense') !== t.amount < 0) continue;
    const amount = Math.abs(t.amount);
    total += amount;
    const key = by === 'category' ? t.category : payeeOf(t);
    let r = map.get(key);
    if (!r) {
      r = { key, label: key, amount: 0, count: 0, share: 0, category: t.category, icon: '' };
      map.set(key, r);
    }
    if (!r.icon && t.icon) r.icon = t.icon;
    r.amount += amount;
    r.count++;
  }
  const list = [...map.values()].sort((a, b) => b.amount - a.amount);
  for (const r of list) r.share = total ? r.amount / total : 0;
  return list;
}

export const OTHER_KEY = '__other';

/** Keep the top `n` and fold the rest into one "Other" row. */
export function foldTop(list: readonly Ranked[], n: number, otherLabel = 'Інше'): Ranked[] {
  if (list.length <= n) return [...list];
  const rest = list.slice(n);
  return [
    ...list.slice(0, n),
    {
      key: OTHER_KEY,
      label: otherLabel,
      amount: rest.reduce((s, r) => s + r.amount, 0),
      count: rest.reduce((s, r) => s + r.count, 0),
      share: rest.reduce((s, r) => s + r.share, 0),
      category: '',
      icon: '',
    },
  ];
}

export interface DayGroup {
  day: string;
  date: Date;
  items: Txn[];
  expenses: number;
  income: number;
  net: number;
}

/** Input must be sorted newest-first (the API layer guarantees it). */
export function groupByDay(txns: readonly Txn[]): DayGroup[] {
  const out: DayGroup[] = [];
  let cur: DayGroup | undefined;
  for (const t of txns) {
    if (!cur || cur.day !== t.day) {
      cur = { day: t.day, date: startOfDay(t.date), items: [], expenses: 0, income: 0, net: 0 };
      out.push(cur);
    }
    cur.items.push(t);
    if (t.amount < 0) cur.expenses += -t.amount;
    else cur.income += t.amount;
    cur.net += t.amount;
  }
  return out;
}

export interface WeekdayStat {
  /** Monday = 0 */
  dow: number;
  total: number;
  /** how many such weekdays fall in the range (empty days count, so this is a fair average) */
  days: number;
  avg: number;
  max: number;
}

export function weekdayStats(buckets: readonly DayBucket[]): WeekdayStat[] {
  const stats: WeekdayStat[] = Array.from({ length: 7 }, (_, dow) => ({ dow, total: 0, days: 0, avg: 0, max: 0 }));
  for (const b of buckets) {
    const s = stats[dowMon0(b.date)];
    s.total += b.expenses;
    s.days++;
    s.max = Math.max(s.max, b.expenses);
  }
  for (const s of stats) s.avg = s.days ? s.total / s.days : 0;
  return stats;
}

export interface HeatWeek {
  start: Date;
  end: Date;
  /** Monday … Sunday; null where the day is outside the range */
  cells: (DayBucket | null)[];
}

export function heatWeeks(buckets: readonly DayBucket[]): HeatWeek[] {
  const weeks: HeatWeek[] = [];
  let cur: HeatWeek | undefined;
  for (const b of buckets) {
    const dow = dowMon0(b.date);
    if (!cur || dow === 0) {
      cur = { start: b.date, end: b.date, cells: Array<DayBucket | null>(7).fill(null) };
      weeks.push(cur);
    }
    cur.cells[dow] = b;
    cur.end = b.date;
  }
  return weeks;
}

/** The window of equal length that ends the day before `r` starts. */
export function previousRange(r: DateRange): DateRange {
  const days = Math.round((startOfDay(r.to).getTime() - startOfDay(r.from).getTime()) / 86_400_000) + 1;
  const from = startOfDay(r.from);
  return { from: addDays(from, -days), to: endOfDay(addDays(from, -1)) };
}

/** Relative change, or null when there is nothing to compare with. */
export const pctChange = (cur: number, prev: number): number | null => (prev > 0 ? (cur - prev) / prev : null);

export function cumulative(values: readonly number[]): number[] {
  let sum = 0;
  return values.map(v => (sum += v));
}
