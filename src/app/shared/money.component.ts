import {
  ChangeDetectionStrategy, Component, HostBinding, Input, OnChanges, OnDestroy, SimpleChanges, signal,
} from '@angular/core';
import { Decimals, moneyParts } from '../core/format';

/**
 * An amount. Kopiykas render smaller, and the `money` host class lets privacy mode blur it.
 * With [animate] the number counts up/down to its new value.
 */
@Component({
  selector: 'app-money',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (parts(); as p) {<span class="s">{{ p.sign || (signed && value > 0 ? '+' : '') }}</span><span class="i">{{ p.int }}</span>@if (p.dec) {<span class="d">{{ p.dec }}</span>}<span class="c">&nbsp;{{ symbol }}</span>}`,
  styles: [
    `
      :host { white-space: nowrap; }
      .d, .c { font-size: .62em; font-weight: 600; opacity: .72; }
      :host(.hero) .d, :host(.hero) .c { font-size: .5em; }
      :host(.lg) { font-size: 1.5rem; font-weight: 700; }
      :host(.pos) { color: var(--pos); }
    `,
  ],
})
export class MoneyComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) value = 0;
  @Input() decimals: Decimals = 2;
  @Input() symbol = '₴';
  @Input() signed = false;
  @Input() animate = false;
  /** colour incoming money green */
  @Input() tone: 'none' | 'sign' = 'none';

  @HostBinding('class.money') readonly money = true;
  @HostBinding('class.pos') get pos(): boolean {
    return this.tone === 'sign' && this.value > 0;
  }

  protected readonly shown = signal(0);
  private raf = 0;
  private first = true;

  protected parts() {
    return moneyParts(this.shown(), this.decimals);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['value']) return;
    const target = this.value;
    const from = this.first ? 0 : this.shown();
    this.first = false;
    cancelAnimationFrame(this.raf);
    if (!this.animate || from === target || this.reducedMotion()) {
      this.shown.set(target);
      return;
    }
    const t0 = performance.now();
    const duration = 700;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      this.shown.set(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
  }

  private reducedMotion(): boolean {
    return (
      document.documentElement.dataset['motion'] === 'reduced' ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
