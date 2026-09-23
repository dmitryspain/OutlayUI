import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { HeatWeek } from '../core/aggregate';
import { formatShortDate, weekdayShort, weekdaysShort } from '../core/format';
import { TPipe } from '../i18n/pipes';
import { translate } from '../i18n/translate';

interface Cell {
  tip: string;
  level: number;
  zero: boolean;
}

interface Row {
  key: string;
  label: string;
  cells: (Cell | null)[];
}

function weekLabel(a: Date, b: Date): string {
  if (a.getTime() === b.getTime()) return formatShortDate(a);
  const from = formatShortDate(a);
  const to = formatShortDate(b);
  const [d1, m1] = from.split(' ');
  const [d2, m2] = to.split(' ');
  return m1 === m2 ? `${d1}–${d2} ${m2}` : `${from} – ${to}`;
}

/**
 * Calendar heatmap: weeks as rows, Monday–Sunday as columns, one hue that deepens with spend
 * (sequential encoding — colour never carries identity here). Cells are described in their
 * aria-label; the "table" view on the parent card is the full accessible equivalent.
 */
@Component({
  selector: 'app-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe],
  template: `
    <div class="hm" role="group" [attr.aria-label]="ariaLabel || ('wk.cal.title' | t)">
      <div class="head">
        <span></span>
        @for (d of days(); track d) { <span>{{ d }}</span> }
      </div>
      @for (r of rows(); track r.key) {
        <div class="row">
          <span class="wl">{{ r.label }}</span>
          @for (c of r.cells; track $index) {
            @if (c) {
              <span class="c" role="img" [class.zero]="c.zero" [style.--l]="c.level" [attr.data-tip]="c.tip" [attr.aria-label]="c.tip"></span>
            } @else {
              <span class="c off"></span>
            }
          }
        </div>
      }
      <div class="legend"><span>{{ 'chart.less' | t }}</span><i class="ramp"></i><span>{{ 'chart.more' | t }}</span></div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .hm { display: grid; gap: 2px; }
      .head, .row { display: grid; grid-template-columns: 78px repeat(7, minmax(0, 1fr)); gap: 2px; align-items: center; }
      .head span { text-align: center; font-size: var(--fs-xs); color: var(--ink-3); font-weight: 600; padding-bottom: 4px; }
      .wl { font-size: var(--fs-xs); color: var(--ink-3); padding-right: 8px; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .c {
        position: relative; aspect-ratio: 1; max-height: 44px; width: 100%; border-radius: calc(var(--radius-s) * .7);
        background: color-mix(in oklab, var(--viz-accent) calc(var(--l, 0) * 100%), var(--surface-2));
      }
      .c.zero { background: var(--surface-2); }
      .c.off { background: transparent; }
      .c:not(.off):hover { outline: 2px solid var(--ink-2); outline-offset: 1px; z-index: 2; }
      .c:not(.off)::after {
        content: attr(data-tip); position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%);
        padding: 6px 10px; border-radius: var(--radius-s); white-space: nowrap; pointer-events: none; opacity: 0;
        background: var(--surface-solid); color: var(--ink); border: var(--edge-w) solid var(--edge);
        font-size: var(--fs-xs); box-shadow: var(--shadow-pop); transition: opacity var(--dur-1) var(--ease);
      }
      .c:not(.off):hover::after { opacity: 1; z-index: 3; }
      .legend { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 10px; font-size: var(--fs-xs); color: var(--ink-3); }
      .ramp {
        width: 96px; height: 8px; border-radius: 999px;
        background: linear-gradient(90deg,
          color-mix(in oklab, var(--viz-accent) 18%, var(--surface-2)),
          var(--viz-accent));
      }
    `,
  ],
})
export class HeatmapComponent {
  protected days(): string[] {
    return weekdaysShort();
  }
  private readonly w = signal<readonly HeatWeek[]>([]);
  private readonly fmt = signal<(v: number) => string>(v => String(Math.round(v)));

  @Input() ariaLabel = '';
  @Input({ required: true }) set weeks(v: readonly HeatWeek[]) { this.w.set(v ?? []); }
  @Input() set formatValue(f: (v: number) => string) { this.fmt.set(f); }

  protected readonly rows = computed<Row[]>(() => {
    const weeks = this.w();
    const fmt = this.fmt();
    const max = Math.max(0, ...weeks.flatMap(w => w.cells.map(c => c?.expenses ?? 0)));
    return weeks.map(w => ({
      key: w.start.toISOString(),
      label: weekLabel(w.start, w.end),
      cells: w.cells.map((c, dow) =>
        c
          ? {
              zero: c.expenses === 0,
              // square-root scale, so one huge day does not wash out all the others
              level: c.expenses > 0 && max ? 0.18 + 0.82 * Math.sqrt(c.expenses / max) : 0,
              tip: `${weekdayShort(dow)}, ${formatShortDate(c.date)} · ${c.expenses ? fmt(c.expenses) : translate('chart.noSpend')}`,
            }
          : null,
      ),
    }));
  });
}
