import { currentLang } from '../../i18n/lang';
import { TRANSFER_CATEGORY } from '../config';
import { addDays, dowMon0, startOfDay, toApiDate } from '../format';

/** Deterministic sample data for demo mode — same shape as the real API, generated locally. */

export const DEMO_CARDS = [
  { id: 'demo-black-0001', balance: 4123655, currencyCode: 980, type: 'black', maskedCardNumber: '5375 41** **** 4821' },
  { id: 'demo-white-0002', balance: 812000, currencyCode: 980, type: 'white', maskedCardNumber: '4441 11** **** 0937' },
  { id: 'demo-platinum-0003', balance: 15020, currencyCode: 980, type: 'platinum', maskedCardNumber: '5168 74** **** 6650' },
];

export const DEMO_CARD_ID = DEMO_CARDS[0].id;

interface Spec { name: string; /** Latin spelling for the English UI */ en?: string; category: string; weight: number; min: number; max: number }

const SPENDING: Spec[] = [
  { name: 'Сільпо', en: 'Silpo', category: 'Продукти', weight: 10, min: 140, max: 1500 },
  { name: 'АТБ', en: 'ATB', category: 'Продукти', weight: 9, min: 80, max: 950 },
  { name: 'Novus', category: 'Продукти', weight: 4, min: 260, max: 2300 },
  { name: 'Glovo', category: 'Доставка їжі', weight: 8, min: 230, max: 980 },
  { name: 'Bolt Food', category: 'Доставка їжі', weight: 4, min: 210, max: 720 },
  { name: 'McDonald’s', category: 'Фаст-фуд', weight: 5, min: 140, max: 560 },
  { name: 'KFC', category: 'Фаст-фуд', weight: 3, min: 180, max: 640 },
  { name: 'Aroma Kava', category: 'Кафе. Ресторани', weight: 5, min: 75, max: 320 },
  { name: 'Starbucks', category: 'Кафе. Ресторани', weight: 3, min: 120, max: 380 },
  { name: 'Uklon', category: 'Таксі', weight: 5, min: 90, max: 420 },
  { name: 'Bolt', category: 'Таксі', weight: 4, min: 85, max: 380 },
  { name: 'WOG', category: 'Паливо', weight: 3, min: 700, max: 2300 },
  { name: 'Аптека Доброго Дня', en: 'Good Day Pharmacy', category: 'Аптеки', weight: 3, min: 90, max: 780 },
  { name: 'Rozetka', category: 'Маркетплейси', weight: 2, min: 250, max: 3800 },
  { name: 'Nova Poshta', category: "Кур'єрська служба", weight: 2, min: 60, max: 240 },
  { name: 'Zara', category: 'Одяг', weight: 1, min: 900, max: 4200 },
  { name: 'Steam', category: 'Ігри', weight: 1, min: 120, max: 1600 },
];
const TOTAL_WEIGHT = SPENDING.reduce((s, x) => s + x.weight, 0);

const MONTHLY = [
  { day: 3, name: 'Київстар', en: 'Kyivstar', category: "Мобільний зв'язок", amount: 250 },
  { day: 5, name: 'Netflix', category: 'Цифрові товари', amount: 379 },
  { day: 9, name: 'Spotify', category: 'Цифрові товари', amount: 99 },
  { day: 12, name: 'ОСББ «Затишок»', en: 'Zatyshok HOA', category: 'Комунальні послуги', amount: 3150 },
  { day: 15, name: 'Iron Gym', category: 'Спортклуби', amount: 1100 },
];

/** Texts that are not brands: they follow the interface language, like real data would for its owner. */
const TEXT = {
  uk: {
    salary: 'Зарплата · ТОВ «Нова Ера»', advance: 'Аванс · ТОВ «Нова Ера»', rent: 'Іван Петренко', from: 'Від',
    people: ['Олена Коваль', 'Максим Бондаренко', 'Ірина Шевченко', 'Андрій Мельник'],
  },
  en: {
    salary: 'Salary · New Era LLC', advance: 'Advance · New Era LLC', rent: 'Ivan Petrenko', from: 'From',
    people: ['Olena Koval', 'Maksym Bondarenko', 'Iryna Shevchenko', 'Andrii Melnyk'],
  },
} as const;

/** mulberry32 — tiny seeded PRNG */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoTxnDto {
  id: string;
  dateOccured: string;
  description: string;
  category: string;
  icon: string;
  amount: number;
  balanceAfter: number;
}

const HISTORY_DAYS = 180;
const cache = new Map<string, DemoTxnDto[]>();

function generate(cardId: string): DemoTxnDto[] {
  const cardIdx = Math.max(0, DEMO_CARDS.findIndex(c => c.id === cardId));
  const intensity = [1, 0.35, 0.08][cardIdx] ?? 0.1;
  const lang = currentLang();
  const L = TEXT[lang];
  const nameOf = (o: { name: string; en?: string }) => (lang === 'en' && o.en ? o.en : o.name);
  const rand = rng(1000 + cardIdx * 7919);
  const now = new Date();
  const out: DemoTxnDto[] = [];

  const money = (x: number) => (rand() < 0.55 ? Math.round(x) : Math.round(x * 100) / 100);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];

  for (let day = addDays(startOfDay(now), -HISTORY_DAYS); day <= now; day = addDays(day, 1)) {
    const dom = day.getDate();
    const weekend = dowMon0(day) >= 5;

    const push = (description: string, category: string, amount: number, hour?: number) => {
      const at = new Date(
        day.getFullYear(), day.getMonth(), day.getDate(),
        hour ?? 8 + Math.floor(rand() * 14), Math.floor(rand() * 60), Math.floor(rand() * 60),
      );
      if (at > now) return;
      out.push({
        id: '00000000-0000-0000-0000-000000000000',
        dateOccured: toApiDate(at),
        description,
        category,
        icon: '',
        amount,
        balanceAfter: 0,
      });
    };

    if (cardIdx === 0) {
      for (const m of MONTHLY) if (m.day === dom) push(nameOf(m), m.category, -m.amount, 9 + (m.day % 4));
      if (dom === 5) push(L.salary, TRANSFER_CATEGORY, 46500, 11);
      if (dom === 20) push(L.advance, TRANSFER_CATEGORY, 21800, 11);
      if (dom === 2) push(L.rent, TRANSFER_CATEGORY, -14000, 10);
    }

    const purchases = Math.floor(rand() * (weekend ? 4.2 : 3.2) * intensity + rand() * intensity);
    for (let i = 0; i < purchases; i++) {
      let roll = rand() * TOTAL_WEIGHT;
      const spec = SPENDING.find(s => (roll -= s.weight) < 0) ?? SPENDING[0];
      push(nameOf(spec), spec.category, -money(spec.min + (spec.max - spec.min) * rand() ** 1.8));
    }

    if (rand() < 0.07 * intensity) push(`${L.from}: ${pick(L.people)}`, TRANSFER_CATEGORY, money(300 + rand() * 2700));
    if (rand() < 0.06 * intensity) push(pick(L.people), TRANSFER_CATEGORY, -money(200 + rand() * 1800));
  }

  return out.sort((a, b) => (a.dateOccured < b.dateOccured ? 1 : -1));
}

export function demoTransactions(cardId: string, from: Date, to: Date): DemoTxnDto[] {
  const cacheKey = `${currentLang()}:${cardId}`;
  let all = cache.get(cacheKey);
  if (!all) {
    all = generate(cardId);
    cache.set(cacheKey, all);
  }
  const a = toApiDate(from);
  const b = toApiDate(to);
  return all.filter(t => t.dateOccured >= a && t.dateOccured <= b);
}
