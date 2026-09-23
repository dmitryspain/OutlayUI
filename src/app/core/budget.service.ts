import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { categoryLabel } from '../i18n/categories';
import { translate } from '../i18n/translate';
import { ApiService } from './api.service';
import { BudgetLevel, LEVEL_ORDER, budgetLevel, forecast, monthInfo, safePerDay, suggestLimit } from './budget';
import { TRANSFER_CATEGORY } from './config';
import { endOfDay, formatMoney } from './format';
import { Txn } from './models';
import { PrefsService } from './prefs.service';
import { query } from './query';
import { SessionService } from './session.service';
import { SyncService } from './sync.service';
import { ToastService } from './toast.service';

/** Limits of one card: a monthly total and/or per bank category (keys are the bank's category names). */
export interface CardBudgets {
  total: number | null;
  categories: Record<string, number>;
}

export interface BudgetRow {
  category: string;
  label: string;
  spent: number;
  limit: number | null;
  forecast: number;
  level: BudgetLevel | null;
  /** 0..1+ of the limit */
  used: number;
  /** average of the past full months, rounded (null without history) */
  suggestion: number | null;
}

export interface BudgetTotal {
  spent: number;
  limit: number | null;
  forecast: number;
  level: BudgetLevel | null;
  used: number;
  safePerDay: number;
  suggestion: number | null;
}

const KEY = 'outlay.budgets.v1';
const EMPTY: CardBudgets = { total: null, categories: {} };
/** full months looked back at for suggestions */
const HISTORY_MONTHS = 3;
/** a month still counts as covered when history starts within its first days */
const COVERAGE_SLACK_MS = 3 * 86_400_000;

function load(): Record<string, CardBudgets> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, CardBudgets>;
  } catch {
    return {};
  }
}

/**
 * Monthly budgets with a pace forecast. Limits live in this browser (like the other preferences), per card.
 * Month data is only fetched while a budget exists or a budget screen is open; when a live transaction
 * pushes a budget into warning or over the limit, a toast says so.
 */
@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly prefs = inject(PrefsService);
  private readonly sync = inject(SyncService);
  private readonly toast = inject(ToastService);

  private readonly store = signal<Record<string, CardBudgets>>(load());
  private readonly watchers = signal(0);

  readonly current = computed(() => this.store()[this.session.cardId()] ?? EMPTY);
  readonly hasBudgets = computed(() => this.current().total !== null || Object.keys(this.current().categories).length > 0);

  private readonly q = query(
    () => {
      const card = this.session.cardId();
      if (!card || (!this.hasBudgets() && this.watchers() === 0)) return null;
      const now = new Date();
      return { card, from: new Date(now.getFullYear(), now.getMonth() - HISTORY_MONTHS, 1), to: endOfDay(now), v: this.sync.version() };
    },
    p => this.api.transactions(p.card, { from: p.from, to: p.to }),
    { key: p => p.card },
  );

  readonly loading = this.q.loading;
  readonly error = this.q.error;
  readonly ready = computed(() => this.q.data() !== undefined);
  readonly month = computed(() => (this.q.data(), monthInfo()));

  private readonly expenses = computed(() =>
    (this.q.data() ?? []).filter(t => t.amount < 0 && (this.prefs.transfers() || t.category !== TRANSFER_CATEGORY)),
  );
  private readonly thisMonth = computed(() => this.expenses().filter(t => t.date >= this.month().start));

  /**
   * Which past months the stored history fully covers (oldest first). A month that starts before the
   * first stored transaction would read low, so it does not count towards suggestions.
   */
  private readonly fullMonths = computed(() => {
    const all = this.q.data() ?? [];
    const first = all.length ? all[all.length - 1].date : null;
    const start = this.month().start;
    return Array.from({ length: HISTORY_MONTHS }, (_, i) => {
      const monthStart = new Date(start.getFullYear(), start.getMonth() - HISTORY_MONTHS + i, 1);
      return !!first && first.getTime() <= monthStart.getTime() + COVERAGE_SLACK_MS;
    });
  });

  /** spending per category in each past month (oldest first) */
  private readonly history = computed(() => {
    const start = this.month().start;
    const byCat = new Map<string, number[]>();
    const totals = new Array<number>(HISTORY_MONTHS).fill(0);
    for (const t of this.expenses()) {
      if (t.date >= start) continue;
      const i = HISTORY_MONTHS - monthsBetween(t.date, start);
      if (i < 0) continue;
      const arr = byCat.get(t.category) ?? new Array<number>(HISTORY_MONTHS).fill(0);
      arr[i] += -t.amount;
      byCat.set(t.category, arr);
      totals[i] += -t.amount;
    }
    return { byCat, totals: this.fullMonthsOnly(totals) };
  });

  readonly total = computed<BudgetTotal>(() => {
    const m = this.month();
    const spent = sum(this.thisMonth());
    const limit = this.current().total;
    const f = forecast(spent, m);
    return {
      spent,
      limit,
      forecast: f,
      level: limit === null ? null : budgetLevel(spent, limit, f),
      used: limit ? spent / limit : 0,
      safePerDay: limit === null ? 0 : safePerDay(spent, limit, m),
      suggestion: suggestLimit(this.history().totals),
    };
  });

  /** every category with a limit or with spending this month: limited ones first, the most at risk on top */
  readonly rows = computed<BudgetRow[]>(() => {
    const m = this.month();
    const limits = this.current().categories;
    const spentBy = new Map<string, number>();
    for (const t of this.thisMonth()) spentBy.set(t.category, (spentBy.get(t.category) ?? 0) - t.amount);
    const hist = this.history().byCat;

    const rows = [...new Set([...Object.keys(limits), ...spentBy.keys()])].map<BudgetRow>(category => {
      const spent = spentBy.get(category) ?? 0;
      const limit = limits[category] ?? null;
      const f = forecast(spent, m);
      return {
        category,
        label: categoryLabel(category),
        spent,
        limit,
        forecast: f,
        level: limit === null ? null : budgetLevel(spent, limit, f),
        used: limit ? spent / limit : 0,
        suggestion: suggestLimit(this.fullMonthsOnly(hist.get(category) ?? [])),
      };
    });
    return rows.sort((a, b) => {
      if ((a.limit === null) !== (b.limit === null)) return a.limit === null ? 1 : -1;
      if (a.level && b.level && a.level !== b.level) return LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
      return b.spent - a.spent;
    });
  });

  readonly limited = computed(() => this.rows().filter(r => r.limit !== null));
  readonly unlimited = computed(() => this.rows().filter(r => r.limit === null));
  readonly atRisk = computed(() => this.limited().filter(r => r.level !== 'ok').length + (this.total().level && this.total().level !== 'ok' ? 1 : 0));

  private lastLevels: { card: string; levels: Map<string, BudgetLevel> } | null = null;

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.store()));
      } catch {
        /* storage unavailable — limits last until the tab closes */
      }
    });
    effect(() => {
      if (!this.ready() || this.loading()) return;
      const card = this.session.cardId();
      const levels = new Map<string, BudgetLevel>();
      const total = this.total();
      if (total.level) levels.set('', total.level);
      for (const r of this.limited()) levels.set(r.category, r.level!);
      untracked(() => this.alert(card, levels));
    });
  }

  /** Keeps the month data loaded while the calling component lives (call from an injection context). */
  watch(): void {
    this.watchers.update(n => n + 1);
    inject(DestroyRef).onDestroy(() => this.watchers.update(n => n - 1));
  }

  setTotal(limit: number | null): void {
    this.patch(b => ({ ...b, total: clean(limit) }));
  }

  setLimit(category: string, limit: number | null): void {
    this.patch(b => {
      const categories = { ...b.categories };
      const v = clean(limit);
      if (v === null) delete categories[category];
      else categories[category] = v;
      return { ...b, categories };
    });
  }

  private patch(fn: (b: CardBudgets) => CardBudgets): void {
    const card = this.session.cardId();
    if (!card) return;
    this.store.update(all => ({ ...all, [card]: fn(all[card] ?? EMPTY) }));
  }

  private fullMonthsOnly(values: readonly number[]): number[] {
    const full = this.fullMonths();
    return values.filter((_, i) => full[i]);
  }

  /** Toast when a limit gets worse after new data (not on the first load, not for a card switch). */
  private alert(card: string, levels: Map<string, BudgetLevel>): void {
    const prev = this.lastLevels?.card === card ? this.lastLevels.levels : null;
    this.lastLevels = { card, levels };
    if (!prev) return;
    for (const [category, level] of levels) {
      const before = prev.get(category);
      if (!before || LEVEL_ORDER[level] >= LEVEL_ORDER[before]) continue;
      const name = category ? categoryLabel(category) : translate('bud.total');
      const row = category ? this.limited().find(r => r.category === category) : this.total();
      const left = formatMoney(Math.max(0, (row?.limit ?? 0) - (row?.spent ?? 0)), { decimals: 0 });
      this.toast.show(
        translate(level === 'over' ? 'bud.alert.over' : 'bud.alert.warn', { name, left }),
        level === 'over' ? 'error' : 'info',
        8000,
      );
    }
  }
}

const sum = (list: readonly Txn[]): number => list.reduce((s, t) => s - t.amount, 0);
const clean = (v: number | null): number | null => (v !== null && Number.isFinite(v) && v > 0 ? Math.round(v) : null);

/** whole calendar months from `d`'s month to `start`'s month */
function monthsBetween(d: Date, start: Date): number {
  return (start.getFullYear() - d.getFullYear()) * 12 + start.getMonth() - d.getMonth();
}
