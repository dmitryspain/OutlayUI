import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { dayKey, parseDayKey } from '../core/format';
import { PERIOD_PRESETS, PeriodService } from '../core/period.service';
import { PeriodPreset } from '../core/prefs.service';
import { TPipe } from '../i18n/pipes';
import { IconComponent } from './icon.component';

/**
 * The one date filter of the app: presets as rows (nobody fights a calendar for "last 30 days"),
 * a custom range tucked under a hairline. It scopes every chart and number below it.
 */
@Component({
  selector: 'app-period-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  host: { '(document:click)': 'onDocClick($event)', '(document:keydown.escape)': 'open.set(false)' },
  template: `
    <div class="pop">
      <button type="button" class="btn" aria-haspopup="menu" [attr.aria-expanded]="open()" (click)="toggle()">
        <app-icon name="calendar" [size]="18" />
        <span>{{ period.shortLabel() }}</span>
        <span class="muted dates-text">{{ period.rangeText() }}</span>
        <app-icon name="chevron-down" [size]="16" />
      </button>

      @if (open()) {
        <div class="pop-panel left" role="menu">
          @for (p of presets; track p.value) {
            <button type="button" class="menu-item" role="menuitemradio" [attr.aria-checked]="period.preset() === p.value" (click)="select(p.value)">
              {{ p.label | t }}
              @if (period.preset() === p.value) { <app-icon class="end" name="check" [size]="16" /> }
            </button>
          }
          <div class="menu-sep"></div>
          <form class="custom" (submit)="apply($event)">
            <span class="label">{{ 'pp.custom' | t }}</span>
            <div class="dates">
              <input class="input" type="date" [attr.aria-label]="'pp.from' | t" [value]="from" [max]="to" (input)="from = val($event)" />
              <input class="input" type="date" [attr.aria-label]="'pp.to' | t" [value]="to" [min]="from" [max]="today" (input)="to = val($event)" />
            </div>
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="!from || !to">{{ 'pp.apply' | t }}</button>
          </form>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .dates-text { font-weight: 500; }
      .custom { display: grid; gap: 8px; padding: 4px 6px 6px; }
      .dates { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .dates .input { height: 38px; padding-inline: 8px; font-size: var(--fs-sm); }
      @media (max-width: 719px) { .dates-text { display: none; } }
    `,
  ],
})
export class PeriodPickerComponent {
  protected readonly period = inject(PeriodService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly presets = PERIOD_PRESETS;
  protected readonly open = signal(false);
  protected readonly today = dayKey(new Date());
  protected from = '';
  protected to = '';

  protected toggle(): void {
    if (!this.open()) {
      const r = this.period.range();
      this.from = dayKey(r.from);
      this.to = dayKey(r.to);
    }
    this.open.update(v => !v);
  }

  protected select(p: PeriodPreset): void {
    if (p !== 'custom') this.period.select(p);
    this.open.set(false);
  }

  protected apply(e: Event): void {
    e.preventDefault();
    if (!this.from || !this.to) return;
    this.period.custom(parseDayKey(this.from), parseDayKey(this.to));
    this.open.set(false);
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected onDocClick(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
