import { TRANSFER_CATEGORY } from './config';
import type { IconName } from '../shared/icons';

/**
 * The backend only sends a category name (from the bank's MCC list) and never an icon,
 * so icon and tint are derived here from keywords. Unknown categories fall back to a tag.
 * NB: JS `\b` does not understand Cyrillic, hence the explicit patterns.
 */
interface Rule {
  test: RegExp;
  icon: IconName;
  hue: number;
}

/** Looked at first: what the payment *description* says (loans, fees, …). */
const DESCRIPTION_RULES: Rule[] = [
  { test: /кредит|погашення|відсотк|штраф|заборгован|комісі/i, icon: 'landmark', hue: 245 },
];

const CATEGORY_RULES: Rule[] = [
  { test: /переказ/i, icon: 'transfer', hue: 225 },
  { test: /продукт|супермаркет|бакал|гастроном|ринки/i, icon: 'cart', hue: 150 },
  { test: /доставка/i, icon: 'bag', hue: 32 },
  { test: /фаст|піц|бургер|їдальн/i, icon: 'utensils', hue: 42 },
  { test: /кафе|ресторан|кав['’ʼ]|бари|нічні клуби/i, icon: 'coffee', hue: 60 },
  { test: /таксі|транспорт|метро|потяг|залізн|автобус|каршерин|парков|перевезенн/i, icon: 'car', hue: 255 },
  { test: /паливо|заправ|азс|пальне/i, icon: 'fuel', hue: 22 },
  { test: /^сто$|авто|запчаст|шиномонтаж|мийк|ремонт/i, icon: 'wrench', hue: 232 },
  { test: /мобільн|зв['’ʼ]язок|телеком|інтернет|провайдер/i, icon: 'phone', hue: 200 },
  { test: /програмув|програмне|комп['’ʼ]ютер/i, icon: 'code', hue: 268 },
  { test: /цифров|хмар|підписк|стрим/i, icon: 'cloud', hue: 215 },
  { test: /готел|курорт|проживання|оренда житла/i, icon: 'bed', hue: 300 },
  { test: /авіа|подорож|турист|авіаквитк/i, icon: 'plane', hue: 232 },
  { test: /ігри|гра$|ігров|гейм/i, icon: 'gamepad', hue: 288 },
  { test: /аптек|лікар|медичн|стомат|здоров|лікарн|оптик/i, icon: 'pill', hue: 12 },
  { test: /кіно|розваг|театр|музик|концерт|відео/i, icon: 'film', hue: 330 },
  { test: /комунал|електро|газ|водопостач|житлов|опалення|енерг/i, icon: 'zap', hue: 85 },
  { test: /освіт|курси|школ|університет|книг|навчан/i, icon: 'book', hue: 250 },
  { test: /краса|салон|перукар|косметик|манікюр/i, icon: 'scissors', hue: 340 },
  { test: /спорт|фітнес|тренажер|басейн/i, icon: 'dumbbell', hue: 20 },
  { test: /ветерин|тварин|зоо/i, icon: 'paw', hue: 45 },
  { test: /кур['’ʼ]єр|пошт|вантаж|логістик/i, icon: 'package', hue: 55 },
  { test: /банк|кредит|позик|фінанс|страхув|інвест/i, icon: 'landmark', hue: 240 },
  { test: /подарунк|благодій|квіти|сувенір/i, icon: 'gift', hue: 350 },
  { test: /одяг|взутт|аксесуар|білизн/i, icon: 'shirt', hue: 320 },
  { test: /маркетплейс|магазин|універмаг|роздрібн|електроніка/i, icon: 'bag', hue: 315 },
  { test: /інформац/i, icon: 'info', hue: 210 },
];

export interface CategoryMeta {
  icon: IconName;
  hue: number;
}

const cache = new Map<string, CategoryMeta>();

export function categoryMeta(category: string, description = ''): CategoryMeta {
  const cacheKey = `${category}\u0000${description}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const found =
    DESCRIPTION_RULES.find(r => r.test.test(description)) ??
    CATEGORY_RULES.find(r => r.test.test(category));
  const meta: CategoryMeta = found ? { icon: found.icon, hue: found.hue } : { icon: 'tag', hue: hueOf(category) };

  if (cache.size > 800) cache.clear();
  cache.set(cacheKey, meta);
  return meta;
}

/** Deterministic hue 0–359 from any string, so the same name always gets the same colour. */
export function hueOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return Math.abs(h) % 360;
}

// NB: no \b — it does not understand Cyrillic, so short words are matched between spaces explicitly
const ORG = /(^|\s)(тов|фоп|ооо|тзов|пп)(\s|$)|ltd|llc|банк|кредит|погашення|відсотк|штраф|комісі|оплата|(^|\s)за\s|\d{3,}|[«"]/i;

/** "Від: Ім'я" (bank) / "From: Name" — the prefix incoming transfers carry. */
export const FROM_PREFIX = /^(від|from):\s*/i;

/** A person-to-person transfer — shown with initials instead of a category icon. */
export function isPerson(category: string, description: string): boolean {
  return category === TRANSFER_CATEGORY && !ORG.test(description.replace(FROM_PREFIX, ''));
}

export function initials(name: string): string {
  const words = name
    .replace(FROM_PREFIX, '')
    .split(/[\s.]+/)
    .filter(w => /\p{L}/u.test(w));
  const letters = words.slice(0, 2).map(w => Array.from(w)[0]);
  return (letters.join('') || '?').toUpperCase();
}

/* ---- stable colour slots for the categorical chart palette ------------------
   "Colour follows the entity, never its rank": a category keeps its slot while it stays
   on screen, whatever the filter does to the ranking. */
const slotMemory = new Map<string, number>();
export const CATEGORICAL_SLOTS = 7;

export function assignSlots(keys: readonly string[]): Map<string, number> {
  const used = new Set<number>();
  const out = new Map<string, number>();
  for (const k of keys) {
    const prev = slotMemory.get(k);
    if (prev && !used.has(prev)) {
      out.set(k, prev);
      used.add(prev);
    }
  }
  for (const k of keys) {
    if (out.has(k)) continue;
    let s = 1;
    while (used.has(s) && s < CATEGORICAL_SLOTS) s++;
    out.set(k, s);
    used.add(s);
    slotMemory.set(k, s);
  }
  return out;
}
