import { Injectable, computed, inject } from '@angular/core';
import { ApiService } from './api.service';
import { cumulative, dayBuckets, pctChange, previousRange, rank, totals, weekdayStats } from './aggregate';
import { TRANSFER_CATEGORY } from './config';
import { Txn } from './models';
import { PeriodService } from './period.service';
import { PrefsService } from './prefs.service';
import { query } from './query';
import { SessionService } from './session.service';
import { SyncService } from './sync.service';

/**
 * The single source of truth for all analytics: the active card's transactions for the selected
 * period (plus the equally long period before it, for comparisons). Every screen derives from
 * these signals, so numbers always agree and page switches are instant.
 */
@Injectable({ providedIn: 'root' })
export class FeedService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly period = inject(PeriodService);
  private readonly prefs = inject(PrefsService);
  private readonly sync = inject(SyncService);

  readonly range = this.period.range;
  readonly prevRange = computed(() => previousRange(this.range()));

  private readonly current = query(
    () => {
      const card = this.session.cardId();
      return card ? { card, range: this.range(), v: this.sync.version() } : null;
    },
    p => this.api.transactions(p.card, p.range),
    { key: p => p.card },
  );

  private readonly previous = query(
    () => {
      const card = this.session.cardId();
      return card ? { card, range: this.prevRange(), v: this.sync.version() } : null;
    },
    p => this.api.transactions(p.card, p.range),
    { key: p => p.card },
  );

  readonly loading = this.current.loading;
  readonly error = this.current.error;
  /** the first response has arrived */
  readonly ready = computed(() => this.current.data() !== undefined);
  /** reloading with data already on screen → dim it instead of showing a skeleton */
  readonly refreshing = computed(() => this.current.loading() && this.ready());

  private readonly withTransfers = (list: readonly Txn[]): Txn[] =>
    this.prefs.transfers() ? [...list] : list.filter(t => t.category !== TRANSFER_CATEGORY);

  /** everything in the period, regardless of the "without transfers" switch */
  readonly allTxns = computed(() => this.current.data() ?? []);
  readonly txns = computed(() => this.withTransfers(this.allTxns()));
  readonly prevTxns = computed(() => this.withTransfers(this.previous.data() ?? []));

  readonly totals = computed(() => totals(this.txns()));
  readonly prevTotals = computed(() => totals(this.prevTxns()));
  readonly hasPrev = computed(() => this.prevTxns().length > 0);

  readonly buckets = computed(() => dayBuckets(this.txns(), this.range()));
  readonly prevBuckets = computed(() => dayBuckets(this.prevTxns(), this.prevRange()));
  readonly weekdays = computed(() => weekdayStats(this.buckets()));

  readonly expensesByCategory = computed(() => rank(this.txns(), 'category', 'expense'));
  readonly expensesByMerchant = computed(() => rank(this.txns(), 'merchant', 'expense'));
  readonly incomeByMerchant = computed(() => rank(this.txns(), 'merchant', 'income'));

  readonly avgDaily = computed(() => this.totals().expenses / Math.max(1, this.buckets().length));
  readonly prevAvgDaily = computed(() => this.prevTotals().expenses / Math.max(1, this.prevBuckets().length));

  readonly cumulativeNet = computed(() => cumulative(this.buckets().map(b => b.net)));

  /** change vs. the previous period (null when there is nothing to compare with) */
  readonly deltas = computed(() => {
    if (!this.hasPrev()) return { expenses: null, income: null, net: null, avg: null };
    const c = this.totals();
    const p = this.prevTotals();
    return {
      expenses: pctChange(c.expenses, p.expenses),
      income: pctChange(c.income, p.income),
      net: null,
      avg: pctChange(this.avgDaily(), this.prevAvgDaily()),
    };
  });

  reload(): void {
    this.current.reload();
    this.previous.reload();
  }
}
