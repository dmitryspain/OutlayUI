import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dayBuckets, groupByDay, totals } from '../core/aggregate';
import { TRANSFER_CATEGORY } from '../core/config';
import { FeedService } from '../core/feed.service';
import { formatDayHeading, formatMoney, relativeTime } from '../core/format';
import { PeriodService } from '../core/period.service';
import { SessionService } from '../core/session.service';
import { CatPipe, TPipe } from '../i18n/pipes';
import { AvatarComponent } from '../shared/avatar.component';
import { BarChartComponent } from '../shared/bar-chart.component';
import { IconComponent } from '../shared/icon.component';
import { MoneyComponent } from '../shared/money.component';
import { PeriodPickerComponent } from '../shared/period-picker.component';
import { EmptyStateComponent, ErrorStateComponent } from '../shared/states.component';
import { TxRowComponent } from '../shared/tx-row.component';
import { dailyBars } from '../shared/view-models';

/** Everything paid to (or received from) one merchant or person — replaces the old "stats by description" screen. */
@Component({
  selector: 'app-merchant',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, IconComponent, AvatarComponent, MoneyComponent, BarChartComponent, TxRowComponent, PeriodPickerComponent,
    EmptyStateComponent, ErrorStateComponent, TPipe, CatPipe,
  ],
  template: `
    <div class="page">
      <a class="back" routerLink="/transactions"><app-icon name="chevron-left" [size]="18" /> {{ 'nav.transactions' | t }}</a>

      @if (!who()) {
        <div class="card">
          <app-empty-state icon="search" [title]="'mr.none.title' | t" [text]="'mr.none.text' | t">
            <a class="btn btn-primary" routerLink="/transactions">{{ 'mr.toTx' | t }}</a>
          </app-empty-state>
        </div>
      } @else {
        <header class="page-head">
          <div class="who">
            <app-avatar [category]="category()" [description]="who()" [icon]="icon()" [size]="56" />
            <div>
              <h1 class="page-title">{{ who() }}</h1>
              <p class="page-sub"><span class="pill">{{ category() ? (category() | cat) : ('mr.noCategory' | t) }}</span></p>
            </div>
          </div>
          <app-period-picker />
        </header>

        @if (feed.error() && !feed.ready()) {
          <app-error-state [error]="feed.error()!" (retry)="feed.reload()" />
        } @else if (!feed.ready()) {
          <div class="card" aria-busy="true"><div class="skeleton" style="height: 220px"></div></div>
        } @else if (!txns().length) {
          <div class="card"><app-empty-state icon="search" [title]="'mr.empty.title' | t" [text]="'mr.empty.text' | t"></app-empty-state></div>
        } @else {
          <div class="stats busy-wrap" [class.busy]="feed.refreshing()">
            <div class="card stat"><span class="label">{{ 'mr.spent' | t }}</span><app-money class="v" [value]="-t().expenses" [decimals]="0" /></div>
            @if (t().income > 0) {
              <div class="card stat"><span class="label">{{ 'mr.received' | t }}</span><app-money class="v" [value]="t().income" [signed]="true" tone="sign" [decimals]="0" /></div>
            }
            <div class="card stat"><span class="label">{{ 'mr.count' | t }}</span><span class="v">{{ t().count }}</span></div>
            <div class="card stat"><span class="label">{{ 'mr.avg' | t }}</span><app-money class="v" [value]="avgCheck()" [decimals]="0" /></div>
            <div class="card stat"><span class="label">{{ 'mr.last' | t }}</span><span class="v small">{{ last() }}</span></div>
          </div>

          <section class="card" aria-labelledby="mh">
            <div class="card-head"><div><h2 class="card-title" id="mh">{{ 'ov.daily.title' | t }}</h2><p class="card-sub">{{ 'mr.daily.sub' | t }}</p></div></div>
            <app-bar-chart [data]="daily()" [height]="200" [formatValue]="money0" [ariaLabel]="'ov.daily.title' | t" [columnLabel]="'chart.day' | t" [valueLabel]="'chart.spending' | t" />
          </section>

          <section class="card" [attr.aria-label]="'mr.list' | t">
            @for (g of groups(); track g.day) {
              <section class="day">
                <h2 class="dh">{{ heading(g.date) }}</h2>
                @for (x of g.items; track x.key) { <app-tx-row [tx]="x" /> }
              </section>
            }
          </section>
        }
      }
    </div>
  `,
  styles: [
    `
      .back { display: inline-flex; align-items: center; gap: 4px; width: fit-content; color: var(--ink-2); text-decoration: none; font-weight: 600; }
      .back:hover { color: var(--ink); }
      .who { display: flex; align-items: center; gap: 16px; min-width: 0; }
      .who h1 { overflow-wrap: anywhere; }
      .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: var(--gap); }
      .stat { display: grid; gap: 6px; padding: 16px; }
      .stat .label { color: var(--ink-3); font-size: var(--fs-sm); font-weight: 600; }
      .stat .v { font-size: 1.5rem; font-weight: 700; letter-spacing: -.02em; }
      .stat .v.small { font-size: var(--fs-lg); }
      .day { content-visibility: auto; contain-intrinsic-size: auto 240px; }
      .dh { padding: 12px 0 6px; font-size: var(--fs-sm); font-weight: 650; letter-spacing: 0; color: var(--ink-3); }
    `,
  ],
})
export class MerchantPage {
  protected readonly feed = inject(FeedService);
  protected readonly period = inject(PeriodService);
  protected readonly session = inject(SessionService);

  /** the merchant / person, bound from the ?name= query parameter */
  protected readonly who = signal('');
  @Input() set name(v: string | undefined) { this.who.set(v ?? ''); }

  protected readonly money0 = (v: number): string => formatMoney(v, { decimals: 0 });

  // independent of the "without transfers" switch: a person is a transfer by definition
  protected readonly txns = computed(() => this.feed.allTxns().filter(x => x.description === this.who()));
  protected readonly category = computed(() => this.txns()[0]?.category ?? '');
  // as before: a transfer always wears the transfer picture, whatever icon the backend attached
  protected readonly icon = computed(() => (this.category() === TRANSFER_CATEGORY ? '' : (this.txns().find(x => x.icon)?.icon ?? '')));
  protected readonly t = computed(() => totals(this.txns()));
  protected readonly avgCheck = computed(() => {
    const n = this.txns().filter(x => x.amount < 0).length;
    return n ? this.t().expenses / n : 0;
  });
  protected readonly last = computed(() => (this.txns()[0] ? relativeTime(this.txns()[0].date) : '—'));
  protected readonly daily = computed(() => dailyBars(dayBuckets(this.txns(), this.feed.range())));
  protected readonly groups = computed(() => groupByDay(this.txns()));

  protected heading(d: Date): string {
    return formatDayHeading(d);
  }
}
