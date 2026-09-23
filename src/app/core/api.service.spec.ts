import { toTxns } from './api.service';

describe('toTxns (API → model)', () => {
  const dto = (dateOccured: string, amount: number, description = 'Glovo', category = 'Доставка їжі') => ({
    dateOccured, amount, description, category,
  });

  it('sorts newest-first and builds a stable day key from the local date', () => {
    const list = toTxns([dto('2026-09-20T10:00:00', -1), dto('2026-09-21T23:12:19', -2)]);
    expect(list.map(t => t.amount)).toEqual([-2, -1]);
    expect(list[0].day).toBe('2026-09-21');
  });

  it('the backend sends identical ids, so keys come from the content and stay unique for duplicates', () => {
    const list = toTxns([dto('2026-09-21T12:00:00', -10), dto('2026-09-21T12:00:00', -10)]);
    expect(new Set(list.map(t => t.key)).size).toBe(2);
    // …and are the same again on the next fetch, so lists do not re-render
    expect(toTxns([dto('2026-09-21T12:00:00', -10), dto('2026-09-21T12:00:00', -10)]).map(t => t.key)).toEqual(list.map(t => t.key));
  });

  it('keeps the icon URL the backend sends (empty when there is none)', () => {
    const [withIcon, without] = toTxns([
      { ...dto('2026-09-21T12:00:00', -1), icon: ' https://cdn/x.png ' },
      dto('2026-09-20T12:00:00', -1),
    ]);
    expect(withIcon.icon).toBe('https://cdn/x.png');
    expect(without.icon).toBe('');
  });

  it('drops rows with an unusable date and fills in missing text', () => {
    const list = toTxns([dto('not-a-date', -1), { dateOccured: '2026-09-21T12:00:00', amount: 5 }]);
    expect(list.length).toBe(1);
    expect(list[0].description).toBe('Без назви');
    expect(list[0].category).toBe('Інше');
    expect(toTxns(null)).toEqual([]);
  });
});
