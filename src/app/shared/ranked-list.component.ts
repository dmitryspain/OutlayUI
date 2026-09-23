import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { formatPercent } from '../core/format';
import { AvatarComponent } from './avatar.component';
import { MoneyComponent } from './money.component';

export interface RankedItem {
  key: string;
  label: string;
  amount: number;
  /** bar length, 0..1, relative to the largest row */
  rel: number;
  share: number;
  sub: string;
  category: string;
  description?: string;
  icon?: string;
  /** categorical colour slot 1..7 (dot marker) */
  slot?: number;
  other?: boolean;
}

/**
 * Ranked horizontal bars — the right form for "who/what takes the most": length carries the
 * amount, every bar is one hue (nominal categories never get a value ramp).
 */
@Component({
  selector: 'app-ranked-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, MoneyComponent],
  template: `
    <ul>
      @for (it of items; track it.key) {
        <li>
          <button type="button" class="r" [disabled]="!!it.other" (click)="pick.emit(it)">
            @if (marker === 'avatar') {
              <app-avatar [category]="it.category" [description]="it.description ?? it.label" [icon]="it.icon" [size]="38" />
            } @else {
              <i class="dot" [style.--c]="colour(it)"></i>
            }
            <span class="mid">
              <span class="l1">
                <span class="name trunc">{{ it.label }}</span>
                <app-money class="val" [value]="it.amount" [decimals]="0" />
              </span>
              <span class="track"><i class="fill" [style.width.%]="it.rel * 100" [style.--c]="marker === 'dot' ? colour(it) : tone === 'income' ? 'var(--pos)' : null"></i></span>
              <span class="l2">{{ pct(it.share) }} · {{ it.sub }}</span>
            </span>
          </button>
        </li>
      }
    </ul>
  `,
  styles: [
    `
      ul { display: grid; gap: 2px; }
      .r {
        display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px; margin: 0 -8px; text-align: left;
        border-radius: var(--radius-m); color: inherit; transition: background var(--dur-1) var(--ease);
      }
      .r:not(:disabled):hover { background: var(--surface-2); }
      .r:disabled { cursor: default; }
      .mid { display: grid; gap: 5px; flex: 1 1 auto; min-width: 0; }
      .l1 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
      .name { font-weight: 600; }
      .val { font-weight: 650; font-variant-numeric: tabular-nums; }
      .track { display: block; height: 6px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
      .fill {
        display: block; height: 100%; border-radius: 999px; background: var(--c, var(--viz-accent));
        transform-origin: left center; animation: fill-in var(--dur-3) var(--ease) both;
      }
      @keyframes fill-in { from { transform: scaleX(0); } }
      .l2 { font-size: var(--fs-xs); color: var(--ink-3); }
      .dot { flex: none; width: 12px; height: 12px; border-radius: 4px; background: var(--c); margin: 0 13px 0 13px; }
    `,
  ],
})
export class RankedListComponent {
  @Input({ required: true }) items: readonly RankedItem[] = [];
  @Input() marker: 'avatar' | 'dot' = 'avatar';
  /** `income`: bars take the positive-money colour */
  @Input() tone: 'default' | 'income' = 'default';
  @Output() pick = new EventEmitter<RankedItem>();

  protected pct(share: number): string {
    return formatPercent(share);
  }

  protected colour(it: RankedItem): string {
    return it.other || !it.slot ? 'var(--viz-other)' : `var(--viz-${it.slot})`;
  }
}
