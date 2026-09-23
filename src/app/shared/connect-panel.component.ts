import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { PrefsService } from '../core/prefs.service';
import { toApiError } from '../core/query';
import { errorText } from '../i18n/errors';
import { SessionService } from '../core/session.service';
import { ToastService } from '../core/toast.service';
import { TPipe } from '../i18n/pipes';
import { MessageKey, translate } from '../i18n/translate';
import { IconComponent } from './icon.component';

/**
 * Connect a Monobank token. It is sent once, in the request body; the backend checks it with the bank
 * and answers with a session for this browser. The token itself is never stored in the browser.
 */
@Component({
  selector: 'app-connect-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  template: `
    <div class="cp">
      <ol class="steps">
        <li>{{ 'conn.step1a' | t }} <a href="https://api.monobank.ua/" target="_blank" rel="noopener noreferrer">api.monobank.ua</a> {{ 'conn.step1b' | t }}</li>
        <li>{{ 'conn.step2' | t }}</li>
        <li>{{ 'conn.step3' | t }}</li>
      </ol>

      <form (submit)="connect($event)">
        <div class="field">
          <label for="mono-token">{{ 'conn.label' | t }}</label>
          <input
            id="mono-token" class="input" type="password" name="token" autocomplete="off" spellcheck="false"
            [attr.placeholder]="'conn.placeholder' | t" [value]="token()" (input)="token.set(val($event))"
          />
        </div>
        <button type="submit" class="btn btn-primary" [disabled]="!token().trim() || busy()">
          <app-icon name="key" [size]="18" />
          {{ (busy() ? 'conn.checking' : 'conn.submit') | t }}
        </button>
      </form>

      @if (error()) {
        <div class="callout error" role="alert">
          <app-icon name="alert" [size]="20" />
          <div>
            <p><strong>{{ error()! | t }}</strong></p>
            <p class="muted">{{ serverError() || ('conn.hint' | t) }}</p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .cp { display: grid; gap: 16px; }
      .steps { display: grid; gap: 6px; padding-left: 1.2em; list-style: decimal; color: var(--ink-2); }
      .steps li::marker { color: var(--accent-text); font-weight: 700; }
      form { display: grid; gap: 12px; justify-items: start; }
      form .field { width: 100%; }
    `,
  ],
})
export class ConnectPanelComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly prefs = inject(PrefsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  @Output() connected = new EventEmitter<void>();

  protected readonly token = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<MessageKey | null>(null);
  /** what the server said (e.g. "Монобанк не прийняв токен"), when it said something */
  protected readonly serverError = signal('');

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected connect(e: Event): void {
    e.preventDefault();
    const token = this.token().trim();
    if (!token || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.serverError.set('');
    // the backend checks the token with the bank and answers with a session; the token itself is not kept here
    this.api.connect(token).subscribe({
      next: c => {
        this.busy.set(false);
        this.prefs.setDemo(false);
        this.session.setSession(c);
        this.token.set('');
        this.toast.show(translate(c.cardId ? 'conn.ok' : 'conn.okNoCards'), 'success');
        this.connected.emit();
        void this.router.navigateByUrl('/cards');
      },
      error: err => {
        this.busy.set(false);
        const apiError = toApiError(err);
        this.error.set(apiError.offline ? 'conn.offline' : 'conn.fail');
        this.serverError.set(apiError.offline ? '' : apiError.code || apiError.serverMessage ? errorText(apiError) : '');
      },
    });
  }
}
