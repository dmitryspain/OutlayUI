import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

/**
 * Compact trend line: 2px stroke, ~10% area wash, and an end dot with a surface ring.
 * Decorative (the number next to it carries the value), so it is hidden from assistive tech.
 */
@Component({
  selector: 'app-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shape(); as s) {
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path class="area" [attr.d]="s.area" />
        <path class="line" [attr.d]="s.line" vector-effect="non-scaling-stroke" />
      </svg>
      <span class="dot" [style.left.%]="s.x" [style.top.%]="s.y"></span>
    }
  `,
  styles: [
    `
      :host { position: relative; display: block; height: var(--h, 36px); }
      svg { width: 100%; height: 100%; overflow: visible; }
      .line { fill: none; stroke: var(--viz-accent); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      .area { fill: var(--viz-accent); opacity: .1; }
      .dot {
        position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%;
        background: var(--viz-accent); box-shadow: 0 0 0 2px var(--chart-surface, var(--surface-solid));
      }
    `,
  ],
  host: { '[style.--h.px]': 'height', 'aria-hidden': 'true' },
})
export class SparklineComponent {
  @Input() height = 36;

  private readonly vals = signal<readonly number[]>([]);
  @Input({ required: true }) set values(v: readonly number[]) {
    this.vals.set(v ?? []);
  }

  protected readonly shape = computed(() => {
    const v = this.vals();
    if (v.length < 2) return null;
    const min = Math.min(...v);
    const max = Math.max(...v);
    const span = max - min || 1;
    const padY = 5;
    const pts = v.map((n, i) => ({
      x: (i / (v.length - 1)) * 100,
      y: padY + (1 - (n - min) / span) * (40 - padY * 2),
    }));
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('');
    const last = pts[pts.length - 1];
    return { line, area: `${line}L100,40L0,40Z`, x: last.x, y: (last.y / 40) * 100 };
  });
}
