import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { formatPercent } from '../core/format';
import { translate } from '../i18n/translate';

export interface ShareSegment {
  key: string;
  label: string;
  share: number;
  slot?: number;
  other?: boolean;
}

/** Part-to-whole as one stacked bar (≤ 6 segments, 2px surface gaps). The list below it is the legend. */
@Component({
  selector: 'app-share-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sb" role="img" [attr.aria-label]="summary()">
      @for (s of segments; track s.key) {
        <span class="part" [style.flex-grow]="s.share" [style.--c]="colour(s)" [attr.title]="s.label + ' · ' + pct(s.share)"></span>
      }
    </div>
  `,
  styles: [
    `
      .sb { display: flex; gap: 2px; height: 12px; }
      .part {
        flex: 1 1 0; min-width: 4px; background: var(--c); border-radius: 3px;
        transform-origin: left center; animation: seg-in var(--dur-3) var(--ease) both;
        transition: opacity var(--dur-1) var(--ease);
      }
      .part:first-child { border-radius: 999px 3px 3px 999px; }
      .part:last-child { border-radius: 3px 999px 999px 3px; }
      .part:only-child { border-radius: 999px; }
      .sb:hover .part:not(:hover) { opacity: .45; }
      @keyframes seg-in { from { transform: scaleX(0); opacity: 0; } }
    `,
  ],
})
export class ShareBarComponent {
  @Input({ required: true }) segments: readonly ShareSegment[] = [];
  /** empty = the translated default */
  @Input() label = '';

  protected pct(share: number): string {
    return formatPercent(share);
  }

  protected colour(s: ShareSegment): string {
    return s.other || !s.slot ? 'var(--viz-other)' : `var(--viz-${s.slot})`;
  }

  protected summary(): string {
    return `${this.label || translate('chart.breakdown')}: ${this.segments.map(s => `${s.label} ${this.pct(s.share)}`).join(', ')}`;
  }
}
