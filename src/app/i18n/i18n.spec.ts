import { formatDayHeading, formatMoney, relativeTime, weekdayLong, weekdayShort } from '../core/format';
import { categoryLabel } from './categories';
import { currentLang } from './lang';
import { en } from './messages/en';
import type { Message } from './messages/types';
import { uk } from './messages/uk';
import { richParts, translate, translatePlural } from './translate';

const plain = (s: string) => s.replace(/[  ]/g, ' ');

const placeholders = (m: Message): string[] => {
  const texts = typeof m === 'string' ? [m] : (Object.values(m).filter(Boolean) as string[]);
  return [...new Set(texts.flatMap(t => [...t.matchAll(/\{(\w+)\}/g)].map(x => x[1])))].sort();
};

describe('i18n', () => {
  afterEach(() => currentLang.set('uk'));

  it('both dictionaries have exactly the same keys and the same {placeholders}', () => {
    const ukAll = uk as Record<string, Message>;
    const enAll = en as Record<string, Message>;
    expect(Object.keys(enAll).sort()).toEqual(Object.keys(ukAll).sort());
    for (const key of Object.keys(ukAll)) {
      expect(placeholders(enAll[key])).withContext(key).toEqual(placeholders(ukAll[key]));
    }
  });

  it('no English text was left untranslated (identical to Ukrainian) by accident', () => {
    const same = Object.keys(uk).filter(k => {
      const a = (uk as Record<string, Message>)[k];
      const b = (en as Record<string, Message>)[k];
      return typeof a === 'string' && a === b;
    });
    // legitimate: brand names and the bilingual language heading
    expect(same).toEqual(jasmine.arrayContaining([]));
    expect(same.filter(k => !['st.lang.title'].includes(k))).toEqual([]);
  });

  it('translate fills parameters and follows the language', () => {
    expect(translate('nav.overview')).toBe('Огляд');
    currentLang.set('en');
    expect(translate('nav.overview')).toBe('Overview');
    expect(translate('top.syncUpdated', { when: '5 minutes ago' })).toBe('Updated 5 minutes ago');
    expect(translate('pal.none', { q: 'xyz' })).toBe('Nothing found for “xyz”');
  });

  it('plural forms: Ukrainian has one/few/many, English one/other', () => {
    const ops = (n: number) => translatePlural('plural.ops', n);
    expect([1, 2, 5, 11, 21, 22].map(ops)).toEqual(['1 операція', '2 операції', '5 операцій', '11 операцій', '21 операція', '22 операції']);
    currentLang.set('en');
    expect([1, 2, 5].map(ops)).toEqual(['1 transaction', '2 transactions', '5 transactions']);
  });

  it('richParts splits **bold** markup into parts (no innerHTML needed)', () => {
    currentLang.set('en');
    const parts = richParts('wk.insight', { peak: 'Friday', avg: '3,972 ₴', diff: '', low: 'Monday' });
    expect(parts.filter(p => p.bold).map(p => p.text)).toEqual(['Friday', 'Monday']);
    expect(parts.map(p => p.text).join('')).toBe('The most expensive day of the week is Friday: 3,972 ₴ on average. The quietest is Monday.');
  });

  it('categories are translated for the English UI only; unknown names and apostrophe variants are handled', () => {
    expect(categoryLabel('Продукти')).toBe('Продукти');
    currentLang.set('en');
    expect(categoryLabel('Продукти')).toBe('Groceries');
    expect(categoryLabel('Доставка їжі')).toBe('Food delivery');
    expect(categoryLabel('Мобільний зв’язок')).toBe('Mobile phone'); // typographic apostrophe folds to the bank’s
    expect(categoryLabel('Щось невідоме')).toBe('Щось невідоме');
  });

  it('numbers, dates and relative times follow the language', () => {
    currentLang.set('en');
    expect(plain(formatMoney(-1234.5))).toBe('−1,234.50 ₴');
    expect(formatDayHeading(new Date())).toBe('Today');
    expect(weekdayShort(0)).toBe('Mon');
    expect(weekdayLong(4)).toBe('Friday');
    expect(relativeTime(new Date(Date.now() - 5 * 60_000))).toBe('5 minutes ago');

    currentLang.set('uk');
    expect(plain(formatMoney(-1234.5))).toBe('−1 234,50 ₴');
    expect(formatDayHeading(new Date())).toBe('Сьогодні');
    expect(weekdayShort(0)).toBe('Пн');
  });
});
