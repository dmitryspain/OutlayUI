import { dayKey } from './format';
import { Txn } from './models';
import { detectRecurring, payeeKey } from './recurring';

let seq = 0;
const tx = (description: string, amount: number, date: Date, category = 'Цифрові товари'): Txn => ({
  key: `${++seq}`,
  date,
  day: dayKey(date),
  description,
  category,
  amount,
  icon: '',
});
const d = (y: number, m: number, day: number, h = 10) => new Date(y, m - 1, day, h);
const now = d(2026, 9, 23, 12);

describe('detectRecurring', () => {
  it('finds a monthly subscription and predicts the next charge', () => {
    const list = [4, 5, 6, 7, 8, 9].map(m => tx('Netflix', -379, d(2026, m, 5)));
    const [r, ...rest] = detectRecurring(list, now);
    expect(rest.length).toBe(0);
    expect(r.cadence).toBe('monthly');
    expect(r.amount).toBe(379);
    expect(r.yearly).toBeCloseTo(379 * 12);
    expect(r.count).toBe(6);
    expect(r.next).toEqual(d(2026, 10, 5, 0));
    expect(r.active).toBeTrue();
    expect(r.previousAmount).toBeNull();
  });

  it('reports a price change', () => {
    const list = [...[5, 6, 7, 8].map(m => tx('Spotify', -99, d(2026, m, 9))), tx('Spotify', -109, d(2026, 9, 9))];
    const [r] = detectRecurring(list, now);
    expect(r.amount).toBe(109);
    expect(r.previousAmount).toBe(99);
  });

  it('ignores frequent irregular spending', () => {
    const list = Array.from({ length: 40 }, (_, i) => tx('Glovo', -(200 + ((i * 97) % 500)), d(2026, 8, 1 + (i % 28), 8 + (i % 12))));
    expect(detectRecurring(list, now)).toEqual([]);
  });

  it('ignores a weekly shop with a different bill every time', () => {
    const amounts = [640, 1320, 410, 2250, 880, 1510];
    const list = amounts.map((a, i) => tx('Сільпо', -a, d(2026, 8, 1 + i * 7), 'Продукти'));
    expect(detectRecurring(list, now)).toEqual([]);
  });

  it('needs four charges for a weekly series', () => {
    const three = [1, 8, 15].map(day => tx('Iron Gym', -250, d(2026, 9, day)));
    expect(detectRecurring(three, now)).toEqual([]);
    const [r] = detectRecurring([...three, tx('Iron Gym', -250, d(2026, 9, 22))], now);
    expect(r.cadence).toBe('weekly');
    expect(r.monthly).toBeCloseTo(250 * 30.44 / 7);
  });

  it('marks a series without recent charges as inactive', () => {
    const list = [3, 4, 5, 6].map(m => tx('Megogo', -199, d(2026, m, 12)));
    const [r] = detectRecurring(list, now);
    expect(r.active).toBeFalse();
  });

  it('treats several charges on one day as one', () => {
    const list = [6, 7, 8, 9].flatMap(m => [tx('iCloud', -49, d(2026, m, 2, 9)), ...(m === 8 ? [tx('iCloud', -49, d(2026, m, 2, 9))] : [])]);
    const [r] = detectRecurring(list, now);
    expect(r.count).toBe(4);
  });

  it('clamps the next charge to the end of a short month', () => {
    const list = [tx('Hosting', -500, d(2026, 7, 31)), tx('Hosting', -500, d(2026, 8, 31))];
    const [r] = detectRecurring(list, d(2026, 9, 5));
    expect(r.next).toEqual(d(2026, 9, 30, 0));
  });

  it('does not trust two charges with different amounts', () => {
    const pair = [tx('Ірина Шевченко', -749, d(2026, 8, 24)), tx('Ірина Шевченко', -666, d(2026, 9, 21))];
    expect(detectRecurring(pair, now)).toEqual([]);
    const third = [...pair, tx('Ірина Шевченко', -700, d(2026, 7, 25))];
    expect(detectRecurring(third, now).length).toBe(1);
  });

  it('skips income', () => {
    const list = [5, 6, 7].map(m => tx('Зарплата', 46500, d(2026, m, 5)));
    expect(detectRecurring(list, now)).toEqual([]);
  });

  it('normalises payee names', () => {
    expect(payeeKey('Скасування. Netflix  Com')).toBe('netflix com');
  });
});
