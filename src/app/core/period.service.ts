import { Injectable, computed, inject, signal } from '@angular/core';
import { MessageKey, translate } from '../i18n/translate';
import { addDays, dayKey, endOfDay, formatRange, parseDayKey, startOfDay } from './format';
import { DateRange } from './models';
import { PeriodPref, PeriodPreset, PrefsService } from './prefs.service';

export const PERIOD_PRESETS: readonly { value: Exclude<PeriodPreset, 'custom'>; label: MessageKey; short: MessageKey }[] = [
  { value: '7d', label: 'period.7d', short: 'period.short.7d' },
  { value: '30d', label: 'period.30d', short: 'period.short.30d' },
  { value: '90d', label: 'period.90d', short: 'period.short.90d' },
  { value: 'month', label: 'period.month', short: 'period.short.month' },
  { value: 'prev-month', label: 'period.prev-month', short: 'period.short.prev-month' },
];

export function rangeFor(p: PeriodPref, today: Date): DateRange {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (p.preset) {
    case '7d': return { from: addDays(today, -6), to: endOfDay(today) };
    case '30d': return { from: addDays(today, -29), to: endOfDay(today) };
    case '90d': return { from: addDays(today, -89), to: endOfDay(today) };
    case 'month': return { from: new Date(y, m, 1), to: endOfDay(today) };
    case 'prev-month': return { from: new Date(y, m - 1, 1), to: endOfDay(new Date(y, m, 0)) };
    case 'custom': {
      let from = p.from ? parseDayKey(p.from) : addDays(today, -29);
      let to = p.to ? parseDayKey(p.to) : today;
      if (from > to) [from, to] = [to, from];
      return { from: startOfDay(from), to: endOfDay(to) };
    }
  }
}

/** The period filter shared by every screen, so all numbers always describe the same slice. */
@Injectable({ providedIn: 'root' })
export class PeriodService {
  private readonly prefs = inject(PrefsService);
  private readonly today = signal(startOfDay(new Date()));

  readonly preset = computed(() => this.prefs.period().preset);
  readonly range = computed(() => rangeFor(this.prefs.period(), this.today()));
  readonly days = computed(() => {
    const r = this.range();
    return Math.round((startOfDay(r.to).getTime() - startOfDay(r.from).getTime()) / 86_400_000) + 1;
  });
  readonly label = computed(() => {
    const p = this.preset();
    const preset = PERIOD_PRESETS.find(x => x.value === p);
    return preset ? translate(preset.label) : translate('pp.custom');
  });
  readonly shortLabel = computed(() => {
    const p = this.preset();
    const preset = PERIOD_PRESETS.find(x => x.value === p);
    return preset ? translate(preset.short) : translate('pp.customShort');
  });
  readonly rangeText = computed(() => formatRange(this.range().from, this.range().to));

  constructor() {
    // roll the "last N days" windows over when the app stays open past midnight
    setInterval(() => {
      const t = startOfDay(new Date());
      if (t.getTime() !== this.today().getTime()) this.today.set(t);
    }, 60_000);
  }

  select(preset: Exclude<PeriodPreset, 'custom'>): void {
    this.prefs.setPeriod({ preset });
  }

  custom(from: Date, to: Date): void {
    this.prefs.setPeriod({ preset: 'custom', from: dayKey(from), to: dayKey(to) });
  }
}
