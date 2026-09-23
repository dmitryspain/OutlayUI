import { cardTag, dayKey, formatMoney, formatNumber, last4, moneyParts, parseDayKey, toApiDate } from './format';

/** Intl uses non-breaking / narrow spaces as group separators; compare with plain spaces. */
const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('format', () => {
  it('formatMoney: true minus sign, grouping, symbol', () => {
    expect(plain(formatMoney(-1234.5))).toBe('−1 234,50 ₴');
    expect(plain(formatMoney(50, { signed: true }))).toBe('+50,00 ₴');
    expect(plain(formatMoney(1234.5, { symbol: '$' }))).toBe('1 234,50 $');
  });

  it('formatMoney: big numbers drop the kopiykas, and "-0,00" never appears', () => {
    expect(plain(formatMoney(-219133.47))).toBe('−219 133 ₴');
    expect(plain(formatMoney(-0.001))).toBe('0,00 ₴');
    expect(plain(formatMoney(-12.5, { decimals: 0 }))).toBe('−13 ₴');
  });

  it('moneyParts: integer and fraction are split for the hero figure', () => {
    const p = moneyParts(2469.1);
    expect(plain(p.int)).toBe('2 469');
    expect(p.dec).toBe(',10');
    expect(p.sign).toBe('');
    expect(moneyParts(-5).sign).toBe('−');
    expect(plain(formatNumber(1234567.891, 2))).toBe('1 234 567,89');
  });

  it('dates: local day keys round-trip and the API format is a naive local timestamp', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    const back = parseDayKey('2026-01-05');
    expect([back.getFullYear(), back.getMonth(), back.getDate(), back.getHours()]).toEqual([2026, 0, 5, 0]);
    expect(toApiDate(new Date(2026, 8, 21, 23, 59, 59))).toBe('2026-09-21T23:59:59');
  });

  it('card labels: last four digits, and a graceful fallback when the bank sends none', () => {
    expect(last4('5375 41** **** 4821')).toBe('4821');
    expect(last4('')).toBe('');
    expect(last4('**** **** **** ****')).toBe('');
    expect(cardTag('black', '5375 41** **** 4821')).toBe('Black · ••4821');
    expect(cardTag('platinum', '')).toBe('Platinum');
    expect(cardTag('', '')).toBe('Картка');
  });
});
