import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { groupByDay, totals } from '../core/aggregate';
import { FeedService } from '../core/feed.service';
import { dayKey, formatDayHeading, formatTime, parseDayKey } from '../core/format';
import { PeriodService } from '../core/period.service';
import { SessionService } from '../core/session.service';
import { CatPipe, TPipe } from '../i18n/pipes';
import { translate } from '../i18n/translate';
import { IconComponent } from '../shared/icon.component';
import { MoneyComponent } from '../shared/money.component';
import { PeriodPickerComponent } from '../shared/period-picker.component';
import { SegmentedComponent } from '../shared/segmented.component';
import { EmptyStateComponent, ErrorStateComponent } from '../shared/states.component';
import { TxRowComponent } from '../shared/tx-row.component';
import { opsLabel } from '../shared/view-models';

type TypeFilter = 'all' | 'expense' | 'income';

@Component({
  selector: 'app-transactions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, IconComponent, MoneyComponent, PeriodPickerComponent, SegmentedComponent, TxRowComponent,
    EmptyStateComponent, ErrorStateComponent, TPipe, CatPipe,
  ],
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">{{ 'tx.eyebrow' | t }}</p>
          <h1 class="page-title">{{ 'nav.transactions' | t }}</h1>
          @if (feed.ready()) { <p class="page-sub">{{ period.rangeText() }}</p> }
        </div>
        @if (session.hasCard()) { <app-period-picker /> }
      </header>

      @if (!session.hasCard()) {
        <div class="card">
          <app-empty-state icon="card" [title]="'common.chooseCard' | t" [text]="'tx.pickCard.text' | t">
            <a class="btn btn-primary" routerLink="/cards">{{ 'common.toCards' | t }}</a>
          </app-empty-state>
        </div>
      } @else if (feed.error() && !feed.ready()) {
        <app-error-state [error]="feed.error()!" (retry)="feed.reload()" />
      } @else if (!feed.ready()) {
        <div class="card" aria-busy="true" [attr.aria-label]="'common.loading' | t">
          @for (i of [1, 2, 3, 4, 5, 6, 7]; track i) {
            <div class="sk-row"><div class="skeleton" style="width: 40px; height: 40px"></div><div class="skeleton" style="height: 14px; width: 42%"></div></div>
          }
        </div>
      } @else {
        <section class="card toolbar" [attr.aria-label]="'tx.filters' | t">
          <div class="row-wrap">
            <label class="searchbox">
              <app-icon name="search" [size]="18" />
              <input type="search" class="q" [attr.placeholder]="'tx.search.placeholder' | t" [attr.aria-label]="'tx.search.aria' | t" [value]="q()" (input)="q.set(val($event))" />
            </label>
            <app-segmented [options]="typeOptions()" [value]="typeFilter()" [label]="'tx.typeLabel' | t" (valueChange)="setType($event)" />
            <app-segmented [options]="sortOptions()" [value]="sort()" [label]="'tx.sortLabel' | t" (valueChange)="setSort($event)" />
            <button type="button" class="btn btn-sm" (click)="exportCsv()" [disabled]="!filtered().length">
              <app-icon name="download" [size]="16" /> CSV
            </button>
          </div>

          <div class="chips" role="group" [attr.aria-label]="'tx.categories' | t">
            @if (dayFilter(); as d) {
              <button type="button" class="chip" aria-pressed="true" (click)="nav({ day: null })">
                <app-icon name="calendar" [size]="14" /> {{ dayLabel() }} <app-icon name="x" [size]="14" />
              </button>
            }
            <button type="button" class="chip" [attr.aria-pressed]="!catFilter()" (click)="nav({ category: null })">{{ 'tx.allCategories' | t }}</button>
            @for (c of topCategories(); track c) {
              <button type="button" class="chip" [attr.aria-pressed]="catFilter() === c" (click)="nav({ category: catFilter() === c ? null : c })">{{ c | cat }}</button>
            }
          </div>
        </section>

        <section class="card list" [class.busy]="feed.refreshing()" [attr.aria-label]="'tx.listAria' | t">
          <div class="summary">
            <span><strong>{{ count() }}</strong></span>
            <span class="muted">{{ 'tx.sumExpenses' | t }} <app-money [value]="-sum().expenses" [decimals]="0" /></span>
            <span class="muted">{{ 'tx.sumIncome' | t }} <app-money [value]="sum().income" [signed]="true" tone="sign" [decimals]="0" /></span>
          </div>

          @if (!filtered().length) {
            <app-empty-state icon="search" [title]="'tx.none.title' | t" [text]="'tx.none.text' | t">
              <button type="button" class="btn" (click)="reset()">{{ 'tx.reset' | t }}</button>
            </app-empty-state>
          } @else if (sort() === 'date') {
            @for (g of groups(); track g.day) {
              <section class="day">
                <header class="dh">
                  <h2>{{ heading(g.date) }}</h2>
                  <app-money [value]="g.net" [signed]="true" tone="sign" [decimals]="0" />
                </header>
                @for (t of g.items; track t.key) { <app-tx-row [tx]="t" /> }
              </section>
            }
          } @else {
            @for (t of byAmount(); track t.key) { <app-tx-row [tx]="t" dateMode="datetime" /> }
          }
        </section>
      }
    </div>
  `,
  styles: [
    `
      .toolbar { display: grid; gap: 14px; padding: 14px 16px; }
      .searchbox {
        display: flex; align-items: center; gap: 8px; flex: 1 1 240px; min-width: 200px; height: 40px; padding: 0 12px;
        border: var(--edge-w) solid var(--edge-strong); border-radius: var(--radius-m); background: var(--surface-2); color: var(--ink-3);
      }
      .searchbox:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
      .q { flex: 1 1 auto; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink); }
      .chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
      .chips::-webkit-scrollbar { display: none; }
      .chips .chip { flex: none; }
      .list { padding-top: 6px; }
      .summary {
        display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 22px; padding: 10px 0 12px;
        border-bottom: 1px solid var(--line); font-size: var(--fs-sm);
      }
      .day { content-visibility: auto; contain-intrinsic-size: auto 300px; }
      .dh {
        position: sticky; top: var(--bar-h); z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 12px 0 6px; background: color-mix(in srgb, var(--surface-solid) 92%, transparent);
      }
      .dh h2 { font-size: var(--fs-sm); font-weight: 650; letter-spacing: 0; color: var(--ink-3); }
      .dh app-money { font-size: var(--fs-sm); font-weight: 650; color: var(--ink-2); }
      .dh app-money.pos { color: var(--pos); }
      .sk-row { display: flex; align-items: center; gap: 14px; padding: 10px 0; }
    `,
  ],
})
export class TransactionsPage {
  protected readonly feed = inject(FeedService);
  protected readonly period = inject(PeriodService);
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);

  /* filters that live in the URL, so a filtered view can be linked to (bound from query params) */
  protected readonly dayFilter = signal<string | null>(null);
  protected readonly catFilter = signal<string | null>(null);
  protected readonly typeFilter = signal<TypeFilter>('all');
  @Input() set day(v: string | undefined) { this.dayFilter.set(v || null); }
  @Input() set category(v: string | undefined) { this.catFilter.set(v || null); }
  @Input() set type(v: string | undefined) { this.typeFilter.set(v === 'expense' || v === 'income' ? v : 'all'); }

  /* local-only filters */
  protected readonly q = signal('');
  protected readonly sort = signal<'date' | 'amount'>('date');

  protected readonly typeOptions = computed(() => [
    { value: 'all', label: translate('tx.type.all') },
    { value: 'expense', label: translate('tx.type.expense') },
    { value: 'income', label: translate('tx.type.income') },
  ]);
  protected readonly sortOptions = computed(() => [
    { value: 'date', label: translate('tx.sort.date') },
    { value: 'amount', label: translate('tx.sort.amount') },
  ]);

  protected readonly filtered = computed(() => {
    const day = this.dayFilter();
    const cat = this.catFilter();
    const type = this.typeFilter();
    const q = this.q().trim().toLowerCase();
    return this.feed.txns().filter(
      t =>
        (!day || t.day === day) &&
        (!cat || t.category === cat) &&
        (type === 'all' || (type === 'expense' ? t.amount < 0 : t.amount > 0)) &&
        (!q || [t.description, t.counterName, t.comment, t.category].some(f => f.toLowerCase().includes(q))),
    );
  });

  protected readonly sum = computed(() => totals(this.filtered()));
  protected readonly count = computed(() => opsLabel(this.filtered().length));
  protected readonly groups = computed(() => groupByDay(this.filtered()));
  protected readonly byAmount = computed(() => [...this.filtered()].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)));

  protected readonly topCategories = computed(() => {
    const counts = new Map<string, number>();
    for (const t of this.feed.txns()) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c);
    const sel = this.catFilter();
    return sel && !top.includes(sel) ? [sel, ...top] : top;
  });

  protected readonly dayLabel = computed(() => {
    const d = this.dayFilter();
    return d ? formatDayHeading(parseDayKey(d)) : '';
  });

  protected heading(d: Date): string {
    return formatDayHeading(d);
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected setType(v: string): void {
    this.nav({ type: v === 'all' ? null : v });
  }
  protected setSort(v: string): void {
    this.sort.set(v === 'amount' ? 'amount' : 'date');
  }

  protected nav(params: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected reset(): void {
    this.q.set('');
    this.nav({ day: null, category: null, type: null });
  }

  protected exportCsv(): void {
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const rows = [
      [translate('csv.date'), translate('csv.time'), translate('csv.description'), translate('csv.category'), translate('csv.amount')],
      ...this.filtered().map(t => [dayKey(t.date), formatTime(t.date), t.description, t.category, t.amount.toFixed(2)]),
    ];
    // BOM so Excel opens the Cyrillic as UTF-8
    const csv = '﻿' + rows.map(r => r.map(esc).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `outlay-${dayKey(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
