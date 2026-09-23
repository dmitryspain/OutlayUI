import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { API_BASE_URL } from '../core/config';
import { ApiError } from '../core/models';
import { errorText } from '../i18n/errors';
import { TPipe } from '../i18n/pipes';
import { IconComponent } from './icon.component';
import { IconName } from './icons';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="es">
      <span class="ic"><app-icon [name]="icon" [size]="26" /></span>
      <h3>{{ title }}</h3>
      @if (text) { <p>{{ text }}</p> }
      <ng-content />
    </div>
  `,
  styles: [
    `
      .es { display: grid; justify-items: center; gap: 10px; padding: 36px 16px; text-align: center; }
      .ic {
        display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%;
        background: var(--accent-soft); color: var(--accent-text); margin-bottom: 4px;
      }
      h3 { font-size: var(--fs-lg); }
      p { color: var(--ink-3); max-width: 44ch; text-wrap: pretty; }
    `,
  ],
})
export class EmptyStateComponent {
  @Input() icon: IconName = 'search';
  @Input({ required: true }) title = '';
  @Input() text = '';
}

/** Inline error with a retry — used whenever a request fails and there is nothing cached to show. */
@Component({
  selector: 'app-error-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  template: `
    <div class="callout error" role="alert">
      <app-icon [name]="error.offline ? 'wifi-off' : 'alert'" [size]="22" />
      <div class="grow">
        <p><strong>{{ text(error) }}</strong></p>
        @if (error.offline) {
          <p class="muted">{{ 'err.hint' | t: { api: api } }}</p>
        }
      </div>
      <button type="button" class="btn btn-sm" (click)="retry.emit()">{{ 'common.retry' | t }}</button>
    </div>
  `,
})
export class ErrorStateComponent {
  protected readonly api = inject(API_BASE_URL);
  protected readonly text = errorText;
  @Input({ required: true }) error!: ApiError;
  @Output() retry = new EventEmitter<void>();
}
