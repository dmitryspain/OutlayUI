import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostBinding, Input, NgZone, OnDestroy,
  Output, ViewChild, computed, inject, signal,
} from '@angular/core';
import { formatCompact } from '../core/format';
import { TPipe } from '../i18n/pipes';

export interface BarDatum {
  key: string;
  /** full label for the tooltip / table */
  label: string;
  /** short label for the x axis */
  short: string;
  value: number;
  sub?: string;
}

const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceCeil(v: number): number {
  if (v <= 0) return 0;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (STEPS.find(s => s >= n - 1e-9) ?? 10) * p;
}

/** Column with a rounded data-end (top) and a square baseline. */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

const PAD = { l: 46, r: 8, t: 18, b: 26 };

/**
 * Column chart, drawn as SVG at the measured width (so text never distorts).
 * Marks follow the dataviz spec: ≤24px wide, 4px rounded data-end, 2px gaps, hairline solid grid.
 * Hover / arrow keys show a per-bar tooltip; a table view is the accessible twin.
 */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe],
  template: `
    <div
      #wrap
      class="wrap"
      role="group"
      [attr.aria-label]="ariaLabel || ('chart.aria' | t)"
      [attr.tabindex]="view === 'chart' ? 0 : null"
      [style.height.px]="view === 'chart' && !fillMode() ? height : null"
      (keydown)="onKey($event)"
      (focus)="onFocus()"
      (blur)="active.set(null)"
      (pointerleave)="active.set(null)"
    >
      @if (view === 'table') {
        <div class="tbl-scroll">
          <table class="tbl">
            <thead><tr><th>{{ columnLabel || ('chart.column' | t) }}</th><th class="r">{{ valueLabel || ('chart.value' | t) }}</th></tr></thead>
            <tbody>
              @for (d of items(); track d.key) {
                <tr><td>{{ d.label }}</td><td class="r num">{{ formatValue(d.value) }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (width() > 0) {
        <svg [attr.width]="width()" [attr.height]="chartH()" aria-hidden="true" focusable="false">
          @for (t of layout().ticks; track t.v) {
            <line class="grid" [attr.x1]="pad.l" [attr.x2]="width() - layout().padR" [attr.y1]="t.y" [attr.y2]="t.y" />
            <text class="tick" [attr.x]="pad.l - 8" [attr.y]="t.y" text-anchor="end" dominant-baseline="middle">{{ t.text }}</text>
          }
          @if (active() !== null) {
            <rect class="band" [attr.x]="layout().bars[active()!].bx" [attr.y]="pad.t" [attr.width]="layout().slot" [attr.height]="layout().plotH" rx="6" />
          }
          @for (b of layout().bars; track b.i) {
            @if (b.d) {
              <path
                class="bar"
                [class.mute]="b.mute"
                [class.dim]="active() !== null && active() !== b.i"
                [style.--k]="b.i"
                [attr.d]="b.d"
              />
            }
          }
          @if (layout().avgY !== null) {
            <line class="avg" [attr.x1]="pad.l" [attr.x2]="width() - layout().padR + 4" [attr.y1]="layout().avgY" [attr.y2]="layout().avgY" />
            @if (layout().sideLabel) {
              <!-- end label in the right margin, clear of the bars -->
              <text class="avg-l" [attr.x]="width() - layout().padR + 10" [attr.y]="layout().avgY! - 2">{{ avgLabel || ('chart.average' | t) }}</text>
              <text class="avg-l v" [attr.x]="width() - layout().padR + 10" [attr.y]="layout().avgY! + 12">{{ formatValue(avg ?? 0) }}</text>
            } @else {
              <text class="avg-l" [attr.x]="width() - layout().padR" y="9" text-anchor="end">{{ avgLabel || ('chart.average' | t) }} {{ formatValue(avg ?? 0) }}</text>
            }
          }
          @for (l of layout().xLabels; track l.i) {
            <text class="xl" [attr.x]="l.x" [attr.y]="chartH() - 7" text-anchor="middle">{{ l.text }}</text>
          }
          <rect
            class="hit"
            [attr.x]="pad.l" y="0" [attr.width]="layout().plotW" [attr.height]="chartH() - pad.b"
            (pointermove)="onMove($event)" (click)="onClick()"
          />
        </svg>
        @if (tip(); as t) {
          <div class="tip" [style.left.px]="t.x" [style.top.px]="t.y">
            <strong class="num">{{ t.value }}</strong>
            <span>{{ t.label }}</span>
            @if (t.sub) { <span class="sub">{{ t.sub }}</span> }
          </div>
        }
        <span class="sr-only" aria-live="polite">{{ tip()?.label }} {{ tip()?.value }}</span>
      }
    </div>
    @if (view === 'chart') {
      <table class="sr-only">
        <caption>{{ ariaLabel || ('chart.aria' | t) }}</caption>
        <tbody>
          @for (d of items(); track d.key) {
            <tr><th scope="row">{{ d.label }}</th><td>{{ formatValue(d.value) }}</td></tr>
          }
        </tbody>
      </table>
    }
  `,
  styles: [
    `
      :host { display: block; position: relative; min-width: 0; }
      /* fill mode: stretch to the space the parent gives (never below the requested height) */
      :host(.fill) { flex: 1 1 auto; min-height: var(--min-h, 240px); }
      :host(.fill) .wrap { position: absolute; inset: 0; }
      .wrap { position: relative; border-radius: var(--radius-s); outline-offset: 4px; }
      svg { display: block; overflow: visible; }
      .grid { stroke: var(--viz-grid); stroke-width: 1; }
      .avg { stroke: var(--viz-axis); stroke-width: 1; }
      .tick, .xl, .avg-l { fill: var(--viz-label); font: 11px/1 var(--font); font-variant-numeric: tabular-nums; }
      .avg-l.v { font-weight: 650; fill: var(--ink-2); }
      .avg-l { paint-order: stroke; stroke: var(--chart-surface, var(--surface-solid)); stroke-width: 4px; stroke-linejoin: round; }
      .band { fill: var(--surface-2); opacity: .85; }
      .bar {
        fill: var(--viz-accent);
        transform-box: fill-box; transform-origin: 50% 100%;
        transition: opacity var(--dur-1) var(--ease);
        animation: grow var(--dur-3) var(--ease) both;
        animation-delay: calc(var(--k, 0) * 6ms);
      }
      .bar.mute { opacity: .42; }
      .bar.dim { opacity: .3; }
      @keyframes grow { from { transform: scaleY(0); } }
      .hit { fill: transparent; cursor: default; }
      .tip {
        position: absolute; z-index: 5; pointer-events: none; transform: translate(-50%, calc(-100% - 10px));
        display: grid; gap: 1px; padding: 8px 12px; white-space: nowrap;
        background: var(--surface-solid); color: var(--ink);
        border: var(--edge-w) solid var(--edge); border-radius: var(--radius-m); box-shadow: var(--shadow-pop);
      }
      .tip strong { font-size: var(--fs-md); }
      .tip span { color: var(--ink-3); font-size: var(--fs-xs); }
      .tbl-scroll { max-height: 320px; overflow: auto; }
      .tbl { width: 100%; font-size: var(--fs-sm); }
      .tbl th { text-align: left; color: var(--ink-3); font-weight: 600; padding: 6px 8px 8px; position: sticky; top: 0; background: var(--surface-solid); }
      .tbl td { padding: 7px 8px; border-top: 1px solid var(--line); }
      .r { text-align: right !important; }
    `,
  ],
})
export class BarChartComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);
  private ro?: ResizeObserver;

  @ViewChild('wrap', { static: true }) private wrap!: ElementRef<HTMLElement>;

  protected readonly items = signal<readonly BarDatum[]>([]);
  protected readonly width = signal(0);
  protected readonly active = signal<number | null>(null);
  protected readonly pad = PAD;

  private readonly measuredH = signal(0);
  protected readonly fillMode = signal(false);
  private readonly h = signal(220);
  /** the height the SVG is actually drawn at */
  protected readonly chartH = computed(() => (this.fillMode() ? Math.max(this.h(), this.measuredH()) : this.h()));
  private readonly maxBarW = signal(24);
  private readonly emph = signal<'none' | 'max'>('none');
  private readonly avgV = signal<number | null>(null);

  @Input({ required: true }) set data(v: readonly BarDatum[]) {
    this.items.set(v ?? []);
    this.active.set(null);
  }
  /** height in px; with [fill] it is the minimum */
  @Input() set height(v: number) { this.h.set(v); }
  get height(): number { return this.h(); }
  /** grow to fill the parent (a flex column) instead of using a fixed height */
  @Input() set fill(v: boolean) { this.fillMode.set(v); }
  @HostBinding('class.fill') get isFill(): boolean { return this.fillMode(); }
  @HostBinding('style.--min-h.px') get minH(): number { return this.h(); }
  @Input() set maxBar(v: number) { this.maxBarW.set(v); }
  @Input() set emphasis(v: 'none' | 'max') { this.emph.set(v); }
  @Input() set avg(v: number | null) { this.avgV.set(v); }
  get avg(): number | null { return this.avgV(); }

  /** empty = the translated defaults */
  @Input() avgLabel = '';
  @Input() ariaLabel = '';
  @Input() view: 'chart' | 'table' = 'chart';
  @Input() columnLabel = '';
  @Input() valueLabel = '';
  @Input() formatValue: (v: number) => string = v => String(Math.round(v));
  @Output() pick = new EventEmitter<BarDatum>();

  protected readonly layout = computed(() => {
    const items = this.items();
    const w = this.width();
    const h = this.chartH();
    const avg = this.avgV();
    // a reference line gets its label in the right margin when there is room (never on top of the bars)
    const sideLabel = avg !== null && w >= 520;
    const padR = sideLabel ? 78 : PAD.r;
    const plotW = Math.max(0, w - PAD.l - padR);
    const plotH = Math.max(0, h - PAD.t - PAD.b);
    const top = niceCeil(Math.max(0, avg ?? 0, ...items.map(d => d.value)));
    const y = (v: number) => PAD.t + plotH - (top ? (v / top) * plotH : 0);

    const slot = items.length ? plotW / items.length : 0;
    const barW = Math.max(2, Math.min(this.maxBarW(), slot - 2));
    let maxIdx = -1;
    items.forEach((d, i) => { if (maxIdx < 0 || d.value > items[maxIdx].value) maxIdx = i; });

    const bars = items.map((d, i) => {
      const bx = PAD.l + slot * i;
      const x = bx + (slot - barW) / 2;
      const bh = d.value > 0 ? Math.max(2, PAD.t + plotH - y(d.value)) : 0;
      const by = PAD.t + plotH - bh;
      return {
        i, bx, x, y: by, w: barW,
        d: bh ? barPath(x, by, barW, bh, 4) : '',
        mute: this.emph() === 'max' && i !== maxIdx,
      };
    });

    const every = Math.max(1, Math.ceil(58 / Math.max(slot, 1)));
    const xLabels = items
      .map((d, i) => ({ i, x: PAD.l + slot * i + slot / 2, text: d.short }))
      .filter(l => l.i % every === 0);

    const ticks = (top ? [0, top / 2, top] : [0]).map(v => ({ v, y: y(v), text: v === 0 ? '0' : formatCompact(v) }));
    return { padR, sideLabel, plotW, plotH, slot, bars, xLabels, ticks, avgY: avg !== null && top ? y(avg) : null };
  });

  protected readonly tip = computed(() => {
    const i = this.active();
    if (i === null) return null;
    const b = this.layout().bars[i];
    const d = this.items()[i];
    if (!b || !d) return null;
    const cx = b.x + b.w / 2;
    return {
      x: Math.min(Math.max(cx, 72), Math.max(72, this.width() - 72)),
      y: Math.max(b.y, 58),
      label: d.label,
      value: this.formatValue(d.value),
      sub: d.sub ?? '',
    };
  });

  ngAfterViewInit(): void {
    const el = this.wrap.nativeElement;
    this.width.set(Math.floor(el.clientWidth));
    this.measuredH.set(Math.floor(el.clientHeight));
    this.ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      const w = Math.floor(width);
      const h = Math.floor(height);
      if (w !== this.width() || h !== this.measuredH()) {
        this.zone.run(() => {
          this.width.set(w);
          this.measuredH.set(h);
        });
      }
    });
    this.ro.observe(el);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }

  protected onMove(e: PointerEvent): void {
    const { slot } = this.layout();
    const n = this.items().length;
    if (!slot || !n) return;
    const x = e.clientX - this.wrap.nativeElement.getBoundingClientRect().left - PAD.l;
    this.active.set(Math.min(n - 1, Math.max(0, Math.floor(x / slot))));
  }

  protected onClick(): void {
    const i = this.active();
    if (i !== null) this.pick.emit(this.items()[i]);
  }

  protected onFocus(): void {
    // start on the newest column, that is what people usually want to read
    if (this.active() === null && this.items().length) this.active.set(this.items().length - 1);
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.items().length;
    if (!n) return;
    const cur = this.active();
    let next: number | null;
    switch (e.key) {
      case 'ArrowRight': next = cur === null ? 0 : Math.min(n - 1, cur + 1); break;
      case 'ArrowLeft': next = cur === null ? n - 1 : Math.max(0, cur - 1); break;
      case 'Home': next = 0; break;
      case 'End': next = n - 1; break;
      case 'Escape': next = null; break;
      case 'Enter':
      case ' ':
        if (cur !== null) this.pick.emit(this.items()[cur]);
        e.preventDefault();
        return;
      default:
        return;
    }
    e.preventDefault();
    this.active.set(next);
  }
}
