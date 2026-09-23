/**
 * Formatting helpers. Everything goes through Intl with the locale of the active language, and reads the
 * language signal — so numbers, dates and relative times re-render by themselves when the language changes.
 */
import { currentLocale } from '../i18n/lang';
import { translate } from '../i18n/translate';

const CURRENCY_SYMBOLS: Record<number, string> = { 980: '₴', 840: '$', 978: '€', 826: '£', 985: 'zł' };
export const currencySymbol = (code: number | undefined): string => CURRENCY_SYMBOLS[code ?? 980] ?? '₴';

const cache = new Map<string, unknown>();
function memo<T>(key: string, make: () => T): T {
  let v = cache.get(key) as T | undefined;
  if (v === undefined) {
    v = make();
    cache.set(key, v);
  }
  return v;
}

const numberFormat = (digits: number): Intl.NumberFormat =>
  memo(`nf:${digits}:${currentLocale()}`, () => new Intl.NumberFormat(currentLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }));

const dateFormat = (name: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
  memo(`dtf:${name}:${currentLocale()}`, () => new Intl.DateTimeFormat(currentLocale(), options));

export type Decimals = 0 | 2 | 'auto';

/** 'auto': whole units for big numbers, kopiykas for small ones. */
function digitsFor(v: number, d: Decimals): 0 | 2 {
  return d === 'auto' ? (Math.abs(v) >= 10_000 ? 0 : 2) : d;
}

function signOf(v: number, digits: number): '' | '−' {
  // "-0,00" is never useful: only show a sign when something non-zero is left after rounding
  return v < 0 && Math.round(Math.abs(v) * 10 ** digits) > 0 ? '−' : '';
}

export function formatNumber(v: number, decimals: Decimals = 'auto'): string {
  return numberFormat(digitsFor(v, decimals)).format(Math.abs(v));
}

export interface MoneyOptions {
  symbol?: string;
  signed?: boolean;
  decimals?: Decimals;
}

export function formatMoney(v: number, o: MoneyOptions = {}): string {
  const digits = digitsFor(v, o.decimals ?? 'auto');
  const sign = signOf(v, digits) || (o.signed && v > 0 ? '+' : '');
  return `${sign}${formatNumber(v, digits)} ${o.symbol ?? '₴'}`;
}

/** Split into pieces, so the hero balance can render kopiykas smaller. */
export function moneyParts(v: number, decimals: Decimals = 2): { sign: string; int: string; dec: string } {
  const digits = digitsFor(v, decimals);
  let int = '';
  let dec = '';
  for (const p of numberFormat(digits).formatToParts(Math.abs(v))) {
    if (p.type === 'integer' || p.type === 'group') int += p.value;
    else if (p.type === 'decimal' || p.type === 'fraction') dec += p.value;
  }
  return { sign: signOf(v, digits), int, dec };
}

export const formatCompact = (v: number): string =>
  memo(`compact:${currentLocale()}`, () => new Intl.NumberFormat(currentLocale(), { notation: 'compact', maximumFractionDigits: 1 })).format(v);

export const formatPercent = (ratio: number): string =>
  `${memo(`pct:${currentLocale()}`, () => new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 0 })).format(Math.abs(ratio) * 100)}%`;

export const capitalize = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ---- cards ------------------------------------------------------------- */

export function cardTypeLabel(type: string): string {
  switch (type) {
    case 'black': return 'Black';
    case 'white': return 'White';
    case 'platinum': return 'Platinum';
    case 'iron': return 'Iron';
    case 'yellow': return 'Yellow';
    case 'fop': return translate('card.fop');
    case 'eaid': return translate('card.eaid');
    default: return type ? capitalize(type) : translate('card.default');
  }
}

/** Last four digits of a masked number, or '' when the bank did not send any. */
export const last4 = (masked: string): string => masked.match(/(\d{4})\D*$/)?.[1] ?? '';

export const cardTag = (type: string, masked: string): string => {
  const d = last4(masked);
  return d ? `${cardTypeLabel(type)} · ••${d}` : cardTypeLabel(type);
};

/* ---- dates ------------------------------------------------------------- */

const pad = (n: number) => String(n).padStart(2, '0');

export const dayKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDayKey = (k: string): Date => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const endOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
export const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Monday = 0 … Sunday = 6 */
export const dowMon0 = (d: Date): number => (d.getDay() + 6) % 7;

/** The backend stores local time without a zone, so dates travel as naive ISO strings. */
export const toApiDate = (d: Date): string =>
  `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/** Weekday names in the active language; index 0 = Monday. (1 Jan 2024 was a Monday.) */
const aMonday = (dow: number): Date => new Date(2024, 0, 1 + dow);
export const weekdayShort = (dow: number): string => capitalize(dateFormat('wd-short', { weekday: 'short' }).format(aMonday(dow)));
export const weekdayLong = (dow: number): string => capitalize(dateFormat('wd-long', { weekday: 'long' }).format(aMonday(dow)));
export const weekdaysShort = (): string[] => Array.from({ length: 7 }, (_, i) => weekdayShort(i));

export function formatDayHeading(d: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000);
  if (diff === 0) return translate('date.today');
  if (diff === 1) return translate('date.yesterday');
  const thisYear = d.getFullYear() === now.getFullYear();
  const f = thisYear
    ? dateFormat('day', { weekday: 'long', day: 'numeric', month: 'long' })
    : dateFormat('day-y', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return capitalize(f.format(d));
}

export const formatShortDate = (d: Date): string =>
  dateFormat('short', { day: 'numeric', month: 'short' }).format(d).replace(/\./g, '');
export const formatDateFull = (d: Date): string =>
  dateFormat('short-y', { day: 'numeric', month: 'short', year: 'numeric' }).format(d).replace(/\s?р\.$/, '').replace(/\./g, '');
export const formatTime = (d: Date): string => dateFormat('time', { hour: '2-digit', minute: '2-digit' }).format(d);

export function formatRange(from: Date, to: Date): string {
  const sameYear = from.getFullYear() === to.getFullYear();
  const a = sameYear ? formatShortDate(from) : formatDateFull(from);
  const b = sameYear && to.getFullYear() === new Date().getFullYear() ? formatShortDate(to) : formatDateFull(to);
  return dayKey(from) === dayKey(to) ? b : `${a} – ${b}`;
}

export function relativeTime(from: Date, now = new Date()): string {
  const rtf = memo(`rtf:${currentLocale()}`, () => new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' }));
  const s = Math.round((now.getTime() - from.getTime()) / 1000);
  if (s < 45) return translate('time.now');
  const m = Math.round(s / 60);
  if (m < 60) return rtf.format(-m, 'minute');
  const h = Math.round(m / 60);
  if (h < 24) return rtf.format(-h, 'hour');
  return rtf.format(-Math.round(h / 24), 'day');
}
