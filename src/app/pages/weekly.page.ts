import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { heatWeeks } from '../core/aggregate';
import { FeedService } from '../core/feed.service';
import { dowMon0, formatMoney, formatPercent, formatShortDate, weekdayLong, weekdayShort, weekdaysShort } from '../core/format';
import { PeriodService } from '../core/period.service';
import { SessionService } from '../core/session.service';
import { currentLang } from '../i18n/lang';
import { RichPipe, TPipe } from '../i18n/pipes';
import { translate, translatePlural } from '../i18n/translate';
import { BarChartComponent, BarDatum } from '../shared/bar-chart.component';
import { HeatmapComponent } from '../shared/heatmap.component';
import { IconComponent } from '../shared/icon.component';
import { PeriodPickerComponent } from '../shared/period-picker.component';
import { SegmentedComponent } from '../shared/segmented.component';
import { EmptyStateComponent, ErrorStateComponent } from '../shared/states.component';
import { TxRowComponent } from '../shared/tx-row.component';

@Component({
  selector: 'app-weekly',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, IconComponent, PeriodPickerComponent, SegmentedComponent, BarChartComponent, HeatmapComponent,
    TxRowComponent, EmptyStateComponent, ErrorStateComponent, TPipe, RichPipe,
  ],
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">{{ 'wk.eyebrow' | t }}</p>
          <h1 class="page-title">{{ 'nav.weekly' | t }}</h1>
          @if (feed.ready()) { <p class="page-sub">{{ 'wk.sub' | t: { range: period.rangeText() } }}</p> }
        </div>
        @if (session.hasCard()) { <app-period-picker /> }
      </header>

      @if (!session.hasCard()) {
        <div class="card">
          <app-empty-state icon="card" [title]="'common.chooseCard' | t" [text]="'wk.pickCard.text' | t">
            <a class="btn btn-primary" routerLink="/cards">{{ 'common.toCards' | t }}</a>
          </app-empty-state>
        </div>
      } @else if (feed.error() && !feed.ready()) {
        <app-error-state [error]="feed.error()!" (retry)="feed.reload()" />
      } @else if (!feed.ready()) {
        <div class="bento" aria-busy="true" [attr.aria-label]="'common.loading' | t">
          <div class="card s-5"><div class="skeleton" style="height: 250px"></div></div>
          <div class="card s-7"><div class="skeleton" style="height: 250px"></div></div>
        </div>
      } @else if (feed.totals().expenses === 0) {
        <div class="card"><app-empty-state icon="calendar" [title]="'wk.none.title' | t" [text]="'wk.none.text' | t" /></div>
      } @else {
        @if (insight(); as i) {
          <div class="callout">
            <app-icon name="sparkles" [size]="20" />
            <p>
              @for (part of ('wk.insight' | rich: { peak: i.peak, avg: i.avg, diff: i.diff, low: i.low }); track $index) {
                @if (part.bold) {<strong>{{ part.text }}</strong>} @else {<span>{{ part.text }}</span>}
              }
            </p>
          </div>
        }

        <div class="bento busy-wrap" [class.busy]="feed.refreshing()">
          <section class="card fill-card s-5" aria-labelledby="wd-h">
            <div class="card-head">
              <div><h2 class="card-title" id="wd-h">{{ 'wk.days.title' | t }}</h2><p class="card-sub">{{ 'wk.days.sub' | t }}</p></div>
              <div class="card-actions"><app-segmented [options]="viewOptions()" [value]="viewWd()" [label]="'view.label' | t" (valueChange)="viewWd.set($any($event))" /></div>
            </div>
            <app-bar-chart
              [data]="weekdayBars()" [view]="viewWd()" [height]="250" [fill]="true" [maxBar]="28" emphasis="max" [avg]="feed.avgDaily()"
              [formatValue]="money0" [ariaLabel]="'wk.days.aria' | t"
              [columnLabel]="'wk.days.column' | t" [valueLabel]="'wk.days.value' | t" (pick)="selectDow($event)"
            />
          </section>

          <section class="card s-7" aria-labelledby="hm-h">
            <div class="card-head">
              <div><h2 class="card-title" id="hm-h">{{ 'wk.cal.title' | t }}</h2><p class="card-sub">{{ 'wk.cal.sub' | t }}</p></div>
              <div class="card-actions"><app-segmented [options]="viewOptions()" [value]="viewHm()" [label]="'view.label' | t" (valueChange)="viewHm.set($any($event))" /></div>
            </div>
            @if (viewHm() === 'chart') {
              <app-heatmap [weeks]="weeks()" [formatValue]="money0" [ariaLabel]="'wk.cal.aria' | t" />
            } @else {
              <div class="tbl-scroll">
                <table class="tbl">
                  <thead><tr><th>{{ 'wk.cal.week' | t }}</th>@for (d of days(); track d) { <th class="r">{{ d }}</th> }</tr></thead>
                  <tbody>
                    @for (w of weeks(); track w.start) {
                      <tr>
                        <td>{{ short(w.start) }}</td>
                        @for (c of w.cells; track $index) { <td class="r num">{{ c ? money0(c.expenses) : '—' }}</td> }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>

          <section class="card" aria-labelledby="top-h">
            <div class="card-head">
              <div>
                <h2 class="card-title" id="top-h">{{ 'wk.top.title' | t: { day: longDay() } }}</h2>
                <p class="card-sub">{{ 'wk.top.sub' | t }}</p>
              </div>
              <div class="card-actions"><app-segmented [options]="dowOptions()" [value]="'' + selected()" [label]="'wk.days.column' | t" (valueChange)="dowSel.set(+$any($event))" /></div>
            </div>
            @if (dayList().length) {
              <div class="list">@for (t of dayList(); track t.key) { <app-tx-row [tx]="t" dateMode="datetime" /> }</div>
            } @else {
              <p class="muted">{{ 'wk.top.none' | t }}</p>
            }
          </section>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .fill-card { display: flex; flex-direction: column; }
      .list { display: grid; }
      .tbl-scroll { overflow-x: auto; }
      .tbl { width: 100%; font-size: var(--fs-sm); }
      .tbl th { text-align: left; color: var(--ink-3); font-weight: 600; padding: 6px 8px 8px; }
      .tbl td { padding: 7px 8px; border-top: 1px solid var(--line); white-space: nowrap; }
      .r { text-align: right !important; }
    `,
  ],
})
export class WeeklyPage {
  protected readonly feed = inject(FeedService);
  protected readonly period = inject(PeriodService);
  protected readonly session = inject(SessionService);

  protected days(): string[] {
    return weekdaysShort();
  }
  protected readonly viewOptions = computed(() => [
    { value: 'chart', label: translate('view.chart') },
    { value: 'table', label: translate('view.table') },
  ]);
  protected readonly dowOptions = computed(() => weekdaysShort().map((label, i) => ({ value: String(i), label })));
  protected readonly viewWd = signal<'chart' | 'table'>('chart');
  protected readonly viewHm = signal<'chart' | 'table'>('chart');
  protected readonly dowSel = signal<number | null>(null);
  protected readonly money0 = (v: number): string => formatMoney(v, { decimals: 0 });

  private readonly peakDow = computed(() => {
    const s = this.feed.weekdays();
    let best = -1;
    s.forEach((w, i) => { if (w.avg > 0 && (best < 0 || w.avg > s[best].avg)) best = i; });
    return best;
  });
  protected readonly selected = computed(() => this.dowSel() ?? Math.max(0, this.peakDow()));
  // Ukrainian weekdays are lower-case inside a sentence, English ones keep their capital
  protected readonly longDay = computed(() => {
    const name = weekdayLong(this.selected());
    return currentLang() === 'uk' ? name.toLowerCase() : name;
  });

  protected readonly weekdayBars = computed<BarDatum[]>(() =>
    this.feed.weekdays().map(w => ({
      key: String(w.dow),
      label: weekdayLong(w.dow),
      short: weekdayShort(w.dow),
      value: w.avg,
      sub: translate('wk.days.bar', { days: translatePlural('plural.days', w.days), total: formatMoney(w.total, { decimals: 0 }) }),
    })),
  );

  protected readonly weeks = computed(() => heatWeeks(this.feed.buckets()));

  protected readonly insight = computed(() => {
    const s = this.feed.weekdays();
    const peak = this.peakDow();
    if (peak < 0) return null;
    const active = s.filter(w => w.days > 0);
    const low = active.reduce((m, w) => (w.avg < m.avg ? w : m), active[0]);
    const mean = this.feed.avgDaily();
    const diff = mean ? s[peak].avg / mean - 1 : 0;
    return {
      peak: weekdayLong(peak),
      avg: formatMoney(s[peak].avg, { decimals: 0 }),
      diff: diff > 0.03 ? ` (${translate('wk.diffAbove', { pct: formatPercent(diff) })})` : '',
      low: weekdayLong(low.dow),
    };
  });

  protected readonly dayList = computed(() =>
    this.feed
      .txns()
      .filter(t => t.amount < 0 && dowMon0(t.date) === this.selected())
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 10),
  );

  protected short(d: Date): string {
    return formatShortDate(d);
  }

  protected selectDow(d: BarDatum): void {
    this.dowSel.set(Number(d.key));
  }
}
