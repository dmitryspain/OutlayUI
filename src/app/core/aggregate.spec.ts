import {
  OTHER_KEY, cumulative, dayBuckets, foldTop, groupByDay, heatWeeks, pctChange, previousRange, rank, totals, weekdayStats,
} from './aggregate';
import { dayKey } from './format';
import { Txn } from './models';

const tx = (iso: string, amount: number, description = 'Shop', category = 'Cat', icon = ''): Txn => {
  const date = new Date(iso);
  return { key: `${iso}|${description}|${amount}`, date, day: dayKey(date), description, category, amount, icon };
};

// Mon 21 Sep 2026 is the newest day; the feed is sorted newest-first, like the API layer guarantees
const feed: Txn[] = [
  tx('2026-09-21T12:00:00', -100, 'Glovo', 'Food'),
  tx('2026-09-21T09:00:00', -50, 'Silpo', 'Groceries'),
  tx('2026-09-20T10:00:00', 300, 'Salary', 'Transfer'),
  tx('2026-09-19T10:00:00', -25, 'Glovo', 'Food'),
];
const range = { from: new Date(2026, 8, 18), to: new Date(2026, 8, 21, 23, 59, 59) };

describe('aggregate', () => {
  it('totals: gross expenses, gross income, net', () => {
    expect(totals(feed)).toEqual({ expenses: 175, income: 300, net: 125, count: 4 });
  });

  it('dayBuckets: one bucket per day of the range, empty days included', () => {
    const buckets = dayBuckets(feed, range);
    expect(buckets.map(b => b.day)).toEqual(['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21']);
    expect(buckets.map(b => b.expenses)).toEqual([0, 25, 0, 150]);
    expect(buckets.map(b => b.income)).toEqual([0, 0, 300, 0]);
  });

  it('rank: sorts by amount and computes shares of the total', () => {
    const byMerchant = rank(feed, 'merchant', 'expense');
    expect(byMerchant.map(r => r.label)).toEqual(['Glovo', 'Silpo']);
    expect(byMerchant[0]).toEqual(jasmine.objectContaining({ amount: 125, count: 2 }));
    expect(byMerchant[0].share).toBeCloseTo(125 / 175);
    expect(rank(feed, 'category', 'income').map(r => r.label)).toEqual(['Transfer']);
  });

  it('rank: a merchant keeps the first icon any of its transactions carries', () => {
    const list = rank(
      [tx('2026-09-21T12:00:00', -10, 'Glovo', 'Food'), tx('2026-09-20T12:00:00', -5, 'Glovo', 'Food', 'https://x/g.png')],
      'merchant',
      'expense',
    );
    expect(list[0].icon).toBe('https://x/g.png');
  });

  it('foldTop: keeps the top n and folds the rest into one "other" row', () => {
    const list = rank(feed, 'merchant', 'expense');
    expect(foldTop(list, 5)).toEqual(list);
    const folded = foldTop(list, 1);
    expect(folded.length).toBe(2);
    expect(folded[1]).toEqual(jasmine.objectContaining({ key: OTHER_KEY, amount: 50, count: 1 }));
  });

  it('groupByDay: groups a newest-first feed and totals each day', () => {
    const groups = groupByDay(feed);
    expect(groups.map(g => g.day)).toEqual(['2026-09-21', '2026-09-20', '2026-09-19']);
    expect(groups[0]).toEqual(jasmine.objectContaining({ expenses: 150, income: 0, net: -150 }));
    expect(groups[0].items.length).toBe(2);
  });

  it('weekdayStats: averages over every such weekday in the range, Monday first', () => {
    const stats = weekdayStats(dayBuckets(feed, range));
    expect(stats.length).toBe(7);
    expect(stats[0]).toEqual(jasmine.objectContaining({ dow: 0, total: 150, days: 1, avg: 150, max: 150 })); // Mon 21
    expect(stats[4]).toEqual(jasmine.objectContaining({ dow: 4, total: 0, days: 1, avg: 0 })); // Fri 18
    expect(stats[1].days).toBe(0); // no Tuesdays in the range
  });

  it('heatWeeks: Monday-based rows, days outside the range are null', () => {
    const weeks = heatWeeks(dayBuckets(feed, range));
    expect(weeks.length).toBe(2);
    expect(weeks[0].cells.map(c => c?.day ?? null)).toEqual([null, null, null, null, '2026-09-18', '2026-09-19', '2026-09-20']);
    expect(weeks[1].cells[0]?.day).toBe('2026-09-21');
  });

  it('previousRange: the window of equal length right before', () => {
    const prev = previousRange({ from: new Date(2026, 8, 15), to: new Date(2026, 8, 21, 23, 59, 59) });
    expect(dayKey(prev.from)).toBe('2026-09-08');
    expect(dayKey(prev.to)).toBe('2026-09-14');
    expect(prev.to.getHours()).toBe(23);
  });

  it('pctChange / cumulative', () => {
    expect(pctChange(150, 100)).toBeCloseTo(0.5);
    expect(pctChange(50, 100)).toBeCloseTo(-0.5);
    expect(pctChange(10, 0)).toBeNull();
    expect(cumulative([1, -3, 5])).toEqual([1, -2, 3]);
  });
});
