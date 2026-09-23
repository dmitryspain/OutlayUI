import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { Connection, ApiService } from './api.service';
import { DEMO_TOKEN } from './config';
import { DEMO_CARD_ID } from './demo/demo-data';
import { PrefsService } from './prefs.service';
import { setCardId } from '../store/actions/card.actions';
import { setTokenId } from '../store/actions/token.actions';
import { selectCardId } from '../store/selectors/card.selector';
import { selectTokenId } from '../store/selectors/token.selector';

/** Session tokens issued by the backend start with this; anything else stored is an old Monobank token. */
export const SESSION_PREFIX = 'ots_';

/**
 * Who is connected and which card is active.
 * The browser keeps only a session token from the backend (in the NgRx store, persisted as before) — the
 * Monobank token is sent once, when connecting, and never stored here. A Monobank token saved by an older
 * version is exchanged for a session on start and then forgotten. In demo mode placeholders are used and
 * the real values are left untouched.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly store = inject(Store);
  private readonly prefs = inject(PrefsService);
  private readonly api = inject(ApiService);

  private readonly stored = this.store.selectSignal(selectTokenId);
  private readonly realCard = this.store.selectSignal(selectCardId);
  /** exchanging a saved Monobank token for a session */
  readonly upgrading = signal(false);

  readonly demo = this.prefs.demo;
  /** the backend session of this browser ('' when not connected) */
  readonly accessToken = computed(() => {
    const t = this.stored() || '';
    return t.startsWith(SESSION_PREFIX) ? t : '';
  });
  readonly token = computed(() => (this.prefs.demo() ? DEMO_TOKEN : this.accessToken()));
  readonly cardId = computed(() => (this.prefs.demo() ? this.prefs.demoCard() || DEMO_CARD_ID : this.realCard() || ''));
  readonly connected = computed(() => !!this.token());
  readonly hasCard = computed(() => !!this.cardId());
  /** a real session exists, even while demo mode hides it (for the Settings screen) */
  readonly hasSession = computed(() => !!this.accessToken());

  constructor() {
    const saved = this.stored() || '';
    if (saved && !saved.startsWith(SESSION_PREFIX)) this.upgrade(saved);
  }

  /** A fresh connection: keep its session, and start on its card unless one is already chosen. */
  setSession(c: Connection): void {
    this.store.dispatch(setTokenId({ id: c.accessToken }));
    if (c.cardId && !this.realCard()) this.store.dispatch(setCardId({ id: c.cardId }));
  }

  setCard(id: string): void {
    if (this.prefs.demo()) this.prefs.setDemoCard(id);
    else this.store.dispatch(setCardId({ id }));
  }

  /** Signs this browser out on the server too. */
  disconnect(): void {
    if (this.accessToken()) this.api.signOut().subscribe({ error: () => undefined });
    this.clear();
  }

  /** The server no longer knows the session (expired or revoked). */
  expire(): void {
    this.clear();
  }

  private clear(): void {
    this.store.dispatch(setTokenId({ id: '' }));
    this.store.dispatch(setCardId({ id: '' }));
  }

  /** One-time: an older version saved the Monobank token itself. */
  private upgrade(monobankToken: string): void {
    this.upgrading.set(true);
    this.api.connect(monobankToken).subscribe({
      next: c => {
        this.upgrading.set(false);
        this.setSession(c);
      },
      error: (e: unknown) => {
        this.upgrading.set(false);
        // a rejected token is useless; if the server is just unreachable, try again next time
        if (e instanceof HttpErrorResponse && e.status >= 400 && e.status < 500) this.clear();
      },
    });
  }
}
