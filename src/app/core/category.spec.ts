import { assignSlots, categoryMeta, hueOf, initials, isPerson } from './category';

describe('category', () => {
  it('maps bank categories to icons, with a fallback', () => {
    expect(categoryMeta('Продукти').icon).toBe('cart');
    expect(categoryMeta('Таксі').icon).toBe('car');
    expect(categoryMeta('Доставка їжі').icon).toBe('bag');
    expect(categoryMeta('СТО').icon).toBe('wrench');
    expect(categoryMeta('Щось невідоме').icon).toBe('tag');
  });

  it('the payment description can override the category (loans, fees)', () => {
    expect(categoryMeta('Переказ коштів', 'Іван').icon).toBe('transfer');
    expect(categoryMeta('Переказ коштів', 'Погашення Кредит До завтра на 8 днів').icon).toBe('landmark');
  });

  it('isPerson: people get initials, organisations and loan payments do not', () => {
    expect(isPerson('Переказ коштів', 'Марина Нікітіна')).toBeTrue();
    expect(isPerson('Переказ коштів', 'Від: Plakhutin Ivan')).toBeTrue();
    expect(isPerson('Переказ коштів', 'ТОВ Лідер')).toBeFalse();
    expect(isPerson('Переказ коштів', 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "ЛІЛО"')).toBeFalse();
    expect(isPerson('Переказ коштів', 'Штраф за порушення погашення заборгованості')).toBeFalse();
    expect(isPerson('Продукти', 'Марина Нікітіна')).toBeFalse();
  });

  it('initials and hue are deterministic', () => {
    expect(initials('Від: Марина Нікітіна')).toBe('МН');
    expect(initials('Glovo')).toBe('G');
    expect(initials('   ')).toBe('?');
    expect(hueOf('Glovo')).toBe(hueOf('Glovo'));
    expect(hueOf('Glovo')).toBeGreaterThanOrEqual(0);
    expect(hueOf('Glovo')).toBeLessThan(360);
  });

  it('assignSlots: a category keeps its colour while it stays on screen', () => {
    const first = assignSlots(['spec-a', 'spec-b', 'spec-c']);
    expect([first.get('spec-a'), first.get('spec-b'), first.get('spec-c')]).toEqual([1, 2, 3]);

    // the filter changes: ranking is reshuffled and a newcomer appears — survivors are not repainted
    const second = assignSlots(['spec-c', 'spec-d', 'spec-a']);
    expect(second.get('spec-c')).toBe(3);
    expect(second.get('spec-a')).toBe(1);
    expect(second.get('spec-d')).toBe(2); // the lowest free slot
  });
});
