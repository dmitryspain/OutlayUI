import { budgetLevel, forecast, monthInfo, safePerDay, suggestLimit } from './budget';

describe('budget', () => {
  const sept10 = monthInfo(new Date(2026, 8, 10, 15, 0));

  it('describes the month', () => {
    expect(sept10.days).toBe(30);
    expect(sept10.day).toBe(10);
    expect(sept10.left).toBe(21);
    expect(sept10.start).toEqual(new Date(2026, 8, 1));
    expect(monthInfo(new Date(2028, 1, 29)).days).toBe(29);
  });

  it('projects the month from the current pace', () => {
    expect(forecast(3000, sept10)).toBe(9000);
    expect(forecast(0, sept10)).toBe(0);
  });

  it('grades the risk', () => {
    expect(budgetLevel(3000, 10000, 9000)).toBe('ok');
    expect(budgetLevel(3000, 10000, 12000)).toBe('warn'); // heading past it
    expect(budgetLevel(8000, 10000, 9000)).toBe('warn'); // 80 % used
    expect(budgetLevel(10500, 10000, 12000)).toBe('over');
  });

  it('spreads what is left over the remaining days', () => {
    expect(safePerDay(3000, 10000, sept10)).toBeCloseTo(7000 / 21);
    expect(safePerDay(12000, 10000, sept10)).toBe(0);
  });

  it('suggests a round limit from past months', () => {
    expect(suggestLimit([])).toBeNull();
    expect(suggestLimit([0, 0])).toBeNull();
    expect(suggestLimit([420, 380])).toBe(400);
    expect(suggestLimit([4210, 3990, 0])).toBe(4100);
    expect(suggestLimit([31200, 29100])).toBe(30500);
  });
});
