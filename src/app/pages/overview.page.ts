import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { foldTop } from '../core/aggregate';
import { assignSlots } from '../core/category';
import { BudgetService } from '../core/budget.service';
import { CardsService } from '../core/cards.service';
import { FeedService } from '../core/feed.service';
import { cardTag, currencySymbol, formatMoney } from '../core/format';
import { PeriodService } from '../core/period.service';
import { PrefsService } from '../core/prefs.service';
import { SessionService } from '../core/session.service';
import { SyncService } from '../core/sync.service';
import { errorText } from '../i18n/errors';
import { TPipe, TpPipe } from '../i18n/pipes';
import { translate, translatePlural } from '../i18n/translate';
import { BarChartComponent, BarDatum } from '../shared/bar-chart.component';
import { ConnectPanelComponent } from '../shared/connect-panel.component';
import { IconComponent } from '../shared/icon.component';
import { KpiComponent } from '../shared/kpi.component';
import { MeterComponent } from '../shared/meter.component';
import { MoneyComponent } from '../shared/money.component';
import { PeriodPickerComponent } from '../shared/period-picker.component';
import { RankedItem, RankedListComponent } from '../shared/ranked-list.component';
import { SegmentedComponent } from '../shared/segmented.component';
import { ShareBarComponent } from '../shared/share-bar.component';
import { SparklineComponent } from '../shared/sparkline.component';
import { EmptyStateComponent, ErrorStateComponent } from '../shared/states.component';
import { TxRowComponent } from '../shared/tx-row.component';
import { dailyBars, opsLabel, toRankedItems, toSegments } from '../shared/view-models';

@Component({
  selector: 'app-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, IconComponent, MoneyComponent, KpiComponent, SparklineComponent, BarChartComponent, ShareBarComponent,
    RankedListComponent, TxRowComponent, PeriodPickerComponent, SegmentedComponent, EmptyStateComponent,
    ErrorStateComponent, ConnectPanelComponent, MeterComponent, TPipe, TpPipe,
  ],
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">{{ greeting() }}</p>
          <h1 class="page-title">{{ 'nav.overview' | t }}</h1>
          @if (session.hasCard() && feed.ready()) { <p class="page-sub">{{ period.rangeText() }} · {{ txCount() }}</p> }
        </div>
        @if (session.hasCard()) {
          <div class="row-wrap">
            <button
              type="button" class="chip" [attr.aria-pressed]="!prefs.transfers()"
              [attr.title]="'ov.noTransfersTip' | t"
              (click)="prefs.setTransfers(!prefs.transfers())"
            >
              <app-icon name="transfer" [size]="14" /> {{ 'ov.noTransfers' | t }}
            </button>
            <app-period-picker />
          </div>
        }
      </header>

      @if (!session.connected()) {
        <section class="card welcome">
          <div class="w-main">
            <p class="eyebrow">{{ 'ov.welcome.eyebrow' | t }}</p>
            <h2>{{ 'ov.welcome.title' | t }}</h2>
            <p class="muted">{{ 'ov.welcome.text' | t }}</p>
            <app-connect-panel />
          </div>
          <aside class="w-demo">
            <span class="ic"><app-icon name="sparkles" [size]="22" /></span>
            <h3>{{ 'ov.demo.title' | t }}</h3>
            <p class="muted">{{ 'ov.demo.text' | t }}</p>
            <button type="button" class="btn" (click)="prefs.setDemo(true)">{{ 'ov.demo.button' | t }}</button>
          </aside>
        </section>
      } @else if (!session.hasCard()) {
        <div class="card">
          <app-empty-state icon="card" [title]="'common.chooseCard' | t" [text]="'ov.pickCard.text' | t">
            <a class="btn btn-primary" routerLink="/cards">{{ 'ov.pickCard.button' | t }}</a>
          </app-empty-state>
        </div>
      } @else if (feed.error() && !feed.ready()) {
        <app-error-state [error]="feed.error()!" (retry)="feed.reload()" />
      } @else if (!feed.ready()) {
        <div class="bento" aria-busy="true" [attr.aria-label]="'common.loading' | t">
          <div class="card s-5"><div class="skeleton" style="height: 14px; width: 34%"></div><div class="skeleton" style="height: 52px; width: 72%; margin-top: 18px"></div><div class="skeleton" style="height: 70px; margin-top: 22px"></div></div>
          <div class="kpis s-7">
            @for (i of [1, 2, 3, 4]; track i) { <div class="card"><div class="skeleton" style="height: 12px; width: 50%"></div><div class="skeleton" style="height: 30px; width: 70%; margin-top: 14px"></div><div class="skeleton" style="height: 30px; margin-top: 12px"></div></div> }
          </div>
          <div class="card s-8"><div class="skeleton" style="height: 16px; width: 30%"></div><div class="skeleton" style="height: 240px; margin-top: 16px"></div></div>
          <div class="card s-4"><div class="skeleton" style="height: 16px; width: 50%"></div><div class="skeleton" style="height: 12px; margin-top: 18px"></div><div class="skeleton" style="height: 170px; margin-top: 18px"></div></div>
        </div>
      } @else {
        @if (feed.error()) {
          <div class="callout error" role="alert">
            <app-icon name="alert" [size]="20" />
            <p class="grow">{{ 'ov.stale' | t: { error: errorText(feed.error()!) } }}</p>
            <button type="button" class="btn btn-sm" (click)="feed.reload()">{{ 'common.refresh' | t }}</button>
          </div>
        }

        @if (feed.txns().length === 0) {
          <div class="card">
            <app-empty-state icon="search" [title]="'ov.empty.title' | t" [text]="'ov.empty.text' | t">
              <button type="button" class="btn" (click)="sync.refresh()">{{ 'ov.empty.button' | t }}</button>
            </app-empty-state>
          </div>
        } @else {
          <div class="bento busy-wrap" [class.busy]="feed.refreshing()">
            <section class="card hero-card s-5" aria-labelledby="bal-h">
              <div class="between">
                <h2 class="eyebrow" id="bal-h">{{ 'ov.balance' | t }}</h2>
                @if (cards.active(); as c) { <span class="pill">{{ tag(c.type, c.maskedNumber) }}</span> }
              </div>
              @if (cards.active(); as c) {
                <app-money class="hero glow" [value]="c.balance" [symbol]="sym(c.currencyCode)" [decimals]="2" [animate]="true" />
              } @else if (cards.loading()) {
                <div class="skeleton" style="height: 52px; width: 70%"></div>
              } @else {
                <p class="muted">{{ 'ov.balanceNA' | t }}</p>
              }
              <div class="net">
                <span class="muted">{{ 'ov.netFlow' | t }}</span>
                <app-money [value]="feed.totals().net" [signed]="true" tone="sign" [decimals]="0" />
              </div>
              <app-sparkline [values]="feed.cumulativeNet()" [height]="72" />
              <p class="cap muted">{{ 'ov.cumNote' | t: { days: (period.days() | tp: 'plural.days') } }}</p>
            </section>

            <div class="kpis s-7">
              <app-kpi [label]="'ov.kpi.expenses' | t" [value]="feed.totals().expenses" [delta]="feed.deltas().expenses" polarity="down-good" [series]="expenseSeries()" [caption]="vs()" />
              <app-kpi [label]="'ov.kpi.income' | t" [value]="feed.totals().income" [delta]="feed.deltas().income" polarity="up-good" [series]="incomeSeries()" [caption]="vs()" />
              <app-kpi [label]="'ov.kpi.net' | t" [value]="feed.totals().net" [signed]="true" [series]="feed.cumulativeNet()" />
              <app-kpi [label]="'ov.kpi.perDay' | t" [value]="feed.avgDaily()" [delta]="feed.deltas().avg" polarity="down-good" [series]="expenseSeries()" [caption]="vs()" />
            </div>

            @if (budgets.hasBudgets() && budgets.ready()) {
              <a class="card budget" routerLink="/budgets" aria-labelledby="bud-h">
                <div class="bud-top">
                  <h2 class="card-title" id="bud-h">{{ 'ov.bud.title' | t }}</h2>
                  @if (budgets.atRisk(); as n) {
                    <span class="pill warn"><app-icon name="alert" [size]="13" /> {{ n | tp: 'plural.atRisk' }}</span>
                  } @else {
                    <span class="pill pos"><app-icon name="check" [size]="13" /> {{ 'ov.bud.allOk' | t }}</span>
                  }
                  <app-icon class="go" name="chevron-right" [size]="18" />
                </div>
                @if (budgets.total(); as bt) {
                  @if (bt.limit !== null) {
                    <div class="bud-line">
                      <span><app-money [value]="bt.spent" [decimals]="0" /> <span class="muted">{{ 'bud.of' | t: { limit: money0(bt.limit) } }}</span></span>
                      <span class="muted">{{ 'bud.forecast' | t: { amount: money0(bt.forecast) } }}</span>
                    </div>
                    <app-meter [value]="bt.used" [level]="bt.level" [pace]="budgetPace()" />
                  }
                }
              </a>
            }

            <section class="card fill-card s-8" aria-labelledby="daily-h">
              <div class="card-head">
                <div>
                  <h2 class="card-title" id="daily-h">{{ 'ov.daily.title' | t }}</h2>
                  <p class="card-sub">
                    @if (peak(); as p) { {{ 'ov.daily.peak' | t: { day: p.label, amount: p.value } }} } @else { {{ 'ov.daily.none' | t }} }
                  </p>
                </div>
                <div class="card-actions">
                  <app-segmented [options]="viewOptions()" [value]="view()" [label]="'ov.chartView' | t" (valueChange)="setView($event)" />
                </div>
              </div>
              <app-bar-chart
                [data]="daily()" [avg]="feed.avgDaily()" [view]="view()" [height]="240" [fill]="true" [formatValue]="money0"
                [ariaLabel]="'ov.daily.title' | t" [columnLabel]="'chart.day' | t" [valueLabel]="'chart.spending' | t" (pick)="openDay($event)"
              />
            </section>

            <section class="card s-4" aria-labelledby="cat-h">
              <div class="card-head">
                <div><h2 class="card-title" id="cat-h">{{ 'ov.cat.title' | t }}</h2><p class="card-sub">{{ 'ov.cat.sub' | t }}</p></div>
              </div>
              @if (catItems().length) {
                <app-share-bar [segments]="catSegments()" [label]="'ov.cat.sub' | t" />
                <div class="gap"></div>
                <app-ranked-list [items]="catItems()" marker="dot" (pick)="openCategory($event)" />
              } @else {
                <p class="muted">{{ 'ov.cat.none' | t }}</p>
              }
            </section>

            <section class="card s-6" aria-labelledby="mer-h">
              <div class="card-head">
                <div><h2 class="card-title" id="mer-h">{{ 'ov.mer.title' | t }}</h2><p class="card-sub">{{ 'ov.mer.sub' | t }}</p></div>
              </div>
              <app-ranked-list [items]="merchantItems()" marker="avatar" (pick)="openMerchant($event)" />
            </section>

            <section class="card s-6" aria-labelledby="snd-h">
              <div class="card-head">
                <div><h2 class="card-title" id="snd-h">{{ 'ov.snd.title' | t }}</h2><p class="card-sub">{{ 'ov.snd.sub' | t }}</p></div>
              </div>
              @if (senderItems().length) {
                <app-ranked-list [items]="senderItems()" marker="avatar" tone="income" (pick)="openMerchant($event)" />
              } @else {
                <p class="muted">{{ 'ov.snd.none' | t }}</p>
              }
            </section>

            <section class="card" aria-labelledby="rec-h">
              <div class="card-head">
                <div><h2 class="card-title" id="rec-h">{{ 'ov.rec.title' | t }}</h2><p class="card-sub">{{ 'ov.rec.sub' | t: { n: recent().length } }}</p></div>
                <div class="card-actions"><a class="btn btn-ghost btn-sm" routerLink="/transactions">{{ 'common.all' | t }} <app-icon name="arrow-right" [size]="16" /></a></div>
              </div>
              <div class="recent">
                @for (t of recent(); track t.key) { <app-tx-row [tx]="t" dateMode="datetime" /> }
              </div>
            </section>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .fill-card { display: flex; flex-direction: column; }
      .between { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .gap { height: 14px; }
      .hero-card { display: grid; gap: 14px; align-content: start; }
      app-money.hero { font-size: var(--fs-hero); font-weight: 750; letter-spacing: -.035em; line-height: 1; }
      .net { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-weight: 650; }
      .cap { font-size: var(--fs-xs); }
      .kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gap); }
      @container page (max-width: 440px) { .kpis { grid-template-columns: minmax(0, 1fr); } }
      .recent { display: grid; }
      .budget { display: grid; gap: 10px; color: inherit; text-decoration: none; transition: border-color var(--dur-1) var(--ease); }
      .budget:hover { border-color: var(--edge-strong); }
      .bud-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
      .bud-top .go { margin-left: auto; color: var(--ink-3); }
      .bud-line { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 16px; font-weight: 650; }
      .bud-line .muted { font-weight: 500; }
      .welcome { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 28px; padding: clamp(20px, 4vw, 36px); }
      .w-main { display: grid; gap: 14px; align-content: start; }
      .w-main h2 { font-size: var(--fs-2xl); max-width: 22ch; }
      .w-demo {
        display: grid; gap: 10px; align-content: center; justify-items: start; padding: 24px;
        border: var(--edge-w) dashed var(--edge-strong); border-radius: var(--radius-l); background: var(--surface-2);
      }
      .w-demo .ic { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--accent-soft); color: var(--accent-text); }
      @container page (max-width: 760px) { .welcome { grid-template-columns: minmax(0, 1fr); } }
    `,
  ],
})
export class OverviewPage {
  protected readonly feed = inject(FeedService);
  protected readonly cards = inject(CardsService);
  protected readonly session = inject(SessionService);
  protected readonly period = inject(PeriodService);
  protected readonly prefs = inject(PrefsService);
  protected readonly sync = inject(SyncService);
  protected readonly budgets = inject(BudgetService);
  private readonly router = inject(Router);

  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    return translate(h < 5 ? 'ov.greet.night' : h < 12 ? 'ov.greet.morning' : h < 18 ? 'ov.greet.day' : 'ov.greet.evening');
  });
  protected readonly errorText = errorText;

  protected readonly viewOptions = computed(() => [
    { value: 'chart', label: translate('view.chart') },
    { value: 'table', label: translate('view.table') },
  ]);
  protected readonly view = signal<'chart' | 'table'>('chart');
  protected readonly budgetPace = computed(() => this.budgets.month().day / this.budgets.month().days);
  protected readonly money0 = (v: number): string => formatMoney(v, { decimals: 0 });

  protected readonly txCount = computed(() => opsLabel(this.feed.totals().count));
  protected readonly vs = computed(() => translate('ov.vs', { days: translatePlural('plural.days', this.period.days()) }));

  protected readonly expenseSeries = computed(() => this.feed.buckets().map(b => b.expenses));
  protected readonly incomeSeries = computed(() => this.feed.buckets().map(b => b.income));
  protected readonly daily = computed(() => dailyBars(this.feed.buckets()));

  protected readonly peak = computed(() => {
    const top = this.daily().reduce<BarDatum | null>((m, d) => (!m || d.value > m.value ? d : m), null);
    return top && top.value > 0 ? { label: top.label, value: formatMoney(top.value, { decimals: 0 }) } : null;
  });

  private readonly catFolded = computed(() => foldTop(this.feed.expensesByCategory(), 5));
  private readonly catSlots = computed(() => assignSlots(this.catFolded().filter(r => r.category).map(r => r.key)));
  protected readonly catSegments = computed(() => toSegments(this.catFolded(), this.catSlots()));
  protected readonly catItems = computed(() => toRankedItems(this.catFolded(), this.catSlots(), { categories: true }));
  protected readonly merchantItems = computed(() => toRankedItems(this.feed.expensesByMerchant().slice(0, 6)));
  protected readonly senderItems = computed(() => toRankedItems(this.feed.incomeByMerchant().slice(0, 6)));
  protected readonly recent = computed(() => this.feed.txns().slice(0, 8));

  protected setView(v: string): void {
    this.view.set(v === 'table' ? 'table' : 'chart');
  }

  protected tag(type: string, masked: string): string {
    return cardTag(type, masked);
  }
  protected sym(code: number): string {
    return currencySymbol(code);
  }

  protected openDay(d: BarDatum): void {
    void this.router.navigate(['/transactions'], { queryParams: { day: d.key } });
  }
  protected openCategory(it: RankedItem): void {
    void this.router.navigate(['/transactions'], { queryParams: { category: it.key, type: 'expense' } });
  }
  protected openMerchant(it: RankedItem): void {
    void this.router.navigate(['/merchant'], { queryParams: { name: it.label } });
  }
}
