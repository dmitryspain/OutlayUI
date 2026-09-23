import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BudgetLevel } from '../core/budget';

/**
 * Budget bar: fill = share of the limit used (capped at the end, the overflow shown as a red end),
 * tick = where an even pace would be today. Colour follows the level, and the level is always also
 * written next to it — colour is never the only signal.
 */
@Component({
  selector: 'app-meter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <span class="track" [style.height.px]="height" [attr.data-level]="level">
      <i class="fill" [style.width.%]="fill()"></i>
      @if (pace !== null) { <i class="tick" [style.left.%]="pace * 100"></i> }
    </span>
  `,
  styles: [
    `
      :host { display: block; }
      .track { position: relative; display: block; border-radius: 999px; background: var(--surface-2); }
      .fill {
        display: block; height: 100%; border-radius: inherit; background: var(--pos);
        transform-origin: left center; animation: grow var(--dur-3) var(--ease) both;
      }
      [data-level='warn'] .fill { background: var(--warn); }
      [data-level='over'] .fill { background: var(--neg); }
      .tick {
        position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px;
        border-radius: 2px; background: var(--ink-2); opacity: .7;
      }
      @keyframes grow { from { transform: scaleX(0); } }
    `,
  ],
})
export class MeterComponent {
  /** share of the limit used, 0..n */
  @Input({ required: true }) value = 0;
  @Input() level: BudgetLevel | null = 'ok';
  /** 0..1, or null for no pace tick */
  @Input() pace: number | null = null;
  @Input() height = 8;

  protected fill(): number {
    return Math.min(1, Math.max(0, this.value)) * 100;
  }
}
