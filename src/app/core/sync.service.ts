import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, catchError, finalize, interval, of, switchMap, timer } from 'rxjs';
import { ApiService } from './api.service';
import { CardsService } from './cards.service';
import { BALANCE_REFRESH_MS } from './config';
import { errorText } from '../i18n/errors';
import { translate } from '../i18n/translate';
import { ApiError } from './models';
import { toApiError } from './query';
import { SessionService } from './session.service';
import { ToastService } from './toast.service';

/** Automatic syncs are spaced out: the bank rate-limits statements and the backend is slow to serve them. */
const AUTO_SYNC_GAP_MS = 2 * 60_000;
const STAMPS_KEY = 'outlay.lastSync.v1';

/**
 * Keeps data fresh:
 *  - pulls the latest statement when the active card changes or the app opens — at most once per
 *    couple of minutes per card, however often the page is reloaded (a manual refresh always works);
 *  - refreshes balances every few minutes. This replaces BackgroundTaskService, which sent a
 *    token that was hard-coded in the source instead of the connected user's own.
 * Bumping `version` tells the data layer to refetch.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly cards = inject(CardsService);
  private readonly toast = inject(ToastService);

  readonly version = signal(0);
  readonly syncing = signal(false);
  readonly lastSync = signal<Date | null>(null);
  readonly lastError = signal<ApiError | null>(null);

  private sub?: Subscription;
  /** the bank pushes transactions (and balances) live, so the periodic balance poll is not needed */
  private live = false;

  constructor() {
    effect(
      () => {
        const id = this.session.cardId();
        if (!id) return;
        untracked(() => {
          const last = this.stamps()[id];
          this.lastSync.set(last ? new Date(last) : null);
          if (!last || Date.now() - last > AUTO_SYNC_GAP_MS) this.run(id, false);
        });
      },
      { allowSignalWrites: true },
    );

    interval(BALANCE_REFRESH_MS)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.refreshBalance());
  }

  setLive(on: boolean): void {
    this.live = on;
  }

  /** New data arrived from elsewhere (a live event): refetch without asking the bank. */
  bump(): void {
    this.version.update(v => v + 1);
    this.cards.reload();
  }

  /** Manual refresh (top-bar button, command palette). */
  refresh(): void {
    const id = this.session.cardId();
    if (id) this.run(id, true);
  }

  private run(cardId: string, manual: boolean): void {
    this.sub?.unsubscribe();
    this.syncing.set(true);
    const token = this.session.token();
    // an automatic sync waits a beat so the screen's own data request goes to the server first
    this.sub = (manual ? of(0) : timer(800))
      .pipe(
        switchMap(() => this.api.syncLatest(cardId)),
        // a balance hiccup must not fail the whole sync
        switchMap(() => this.api.updateBalance(token).pipe(catchError(() => of(null)))),
        finalize(() => this.syncing.set(false)),
      )
      .subscribe({
        next: () => {
          const now = new Date();
          this.lastSync.set(now);
          this.setStamp(cardId, now.getTime());
          this.lastError.set(null);
          this.version.update(v => v + 1);
          this.cards.reload();
          if (manual) this.toast.show(translate('sync.done'), 'success');
        },
        error: e => {
          const error = toApiError(e);
          this.lastError.set(error);
          if (manual) this.toast.show(translate('sync.fail', { error: errorText(error) }), 'error');
        },
      });
  }

  private stamps(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(STAMPS_KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  private setStamp(cardId: string, time: number): void {
    try {
      localStorage.setItem(STAMPS_KEY, JSON.stringify({ ...this.stamps(), [cardId]: time }));
    } catch {
      /* storage unavailable: the throttle just won't survive a reload */
    }
  }

  private refreshBalance(): void {
    const token = this.session.token();
    if (!token || document.hidden || this.live) return;
    this.api
      .updateBalance(token)
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.cards.reload());
  }
}
