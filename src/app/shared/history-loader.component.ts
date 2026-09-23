import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { formatDateFull, formatPercent } from '../core/format';
import { LiveService } from '../core/live.service';
import { SessionService } from '../core/session.service';
import { TPipe } from '../i18n/pipes';
import { IconComponent } from './icon.component';

/** "Load 6 / 12 months" buttons, and the progress of a running history backfill. */
@Component({
  selector: 'app-history-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  template: `
    @if (live.backfill(); as s) {
      @if (s.state === 'running') {
        <div class="run" role="status">
          <span class="lbl"><app-icon name="download" [size]="16" /> {{ 'hist.running' | t: { pct: pct(), eta: eta() } }}</span>
          <span class="bar"><i [style.width.%]="s.progress * 100"></i></span>
        </div>
      } @else {
        <div class="row-wrap">
          @for (m of months; track m) {
            <button type="button" class="btn btn-sm" [disabled]="!available()" (click)="live.startBackfill(m)">
              <app-icon name="download" [size]="16" /> {{ 'hist.months' | t: { n: m } }}
            </button>
          }
          @if (s.oldestLoaded && s.state === 'done') { <span class="muted small">{{ 'hist.reach' | t: { date: date(s.oldestLoaded) } }}</span> }
        </div>
      }
    }
  `,
  styles: [
    `
      .run { display: grid; gap: 8px; }
      .lbl { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: var(--fs-sm); }
      .bar { display: block; height: 6px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
      .bar i { display: block; height: 100%; background: var(--accent); transition: width var(--dur-3) var(--ease); }
      .small { font-size: var(--fs-sm); }
    `,
  ],
})
export class HistoryLoaderComponent {
  protected readonly live = inject(LiveService);
  private readonly session = inject(SessionService);

  protected readonly months = [6, 12];
  protected readonly available = computed(() => this.session.hasCard() && !this.session.demo());
  protected readonly pct = computed(() => formatPercent(this.live.backfill().progress));
  protected readonly eta = computed(() => Math.max(1, Math.round((this.live.backfill().etaSeconds ?? 60) / 60)));

  protected date(d: Date): string {
    return formatDateFull(d);
  }
}
