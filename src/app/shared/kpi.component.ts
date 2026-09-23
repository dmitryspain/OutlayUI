import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { formatPercent } from '../core/format';
import { IconComponent } from './icon.component';
import { MoneyComponent } from './money.component';
import { SparklineComponent } from './sparkline.component';

/** Stat tile: label · value · change vs. the previous period (icon + sign + %, never colour alone) · trend. */
@Component({
  selector: 'app-kpi',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, MoneyComponent, SparklineComponent],
  host: { class: 'card' },
  template: `
    <div class="top">
      <span class="label">{{ label }}</span>
      @if (delta !== null) {
        <span class="pill" [class.pos]="verdict === 'good'" [class.neg]="verdict === 'bad'">
          <app-icon [name]="delta >= 0 ? 'trending-up' : 'trending-down'" [size]="13" />
          {{ delta >= 0 ? '+' : '−' }}{{ pct }}
        </span>
      }
    </div>
    <app-money class="val" [value]="value" [decimals]="0" [signed]="signed" [animate]="true" />
    <app-sparkline [values]="series" [height]="30" />
    @if (delta !== null && caption) { <span class="cap">{{ caption }}</span> }
  `,
  styles: [
    `
      :host { display: grid; gap: 10px; align-content: start; }
      .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 22px; }
      .label { color: var(--ink-2); font-size: var(--fs-sm); font-weight: 600; }
      .val { font-size: 1.85rem; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
      .cap { color: var(--ink-3); font-size: var(--fs-xs); }
    `,
  ],
})
export class KpiComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value = 0;
  /** change vs. previous period as a ratio, or null when unknown */
  @Input() delta: number | null = null;
  /** which direction is good news */
  @Input() polarity: 'up-good' | 'down-good' | 'neutral' = 'neutral';
  @Input() series: readonly number[] = [];
  @Input() signed = false;
  @Input() caption = '';

  protected get pct(): string {
    return formatPercent(this.delta ?? 0);
  }

  protected get verdict(): 'good' | 'bad' | 'flat' {
    if (this.delta === null || Math.abs(this.delta) < 0.005 || this.polarity === 'neutral') return 'flat';
    return this.delta > 0 === (this.polarity === 'up-good') ? 'good' : 'bad';
  }
}
