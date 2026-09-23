import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Subscription, interval, switchMap } from 'rxjs';
import { errorText } from '../i18n/errors';
import { translate } from '../i18n/translate';
import { ApiService, BackfillDto, toBackfill } from './api.service';
import { formatMoney } from './format';
import { BackfillStatus, LiveTxn, WebhookStatus } from './models';
import { toApiError } from './query';
import { SessionService } from './session.service';
import { SyncService } from './sync.service';
import { ToastService } from './toast.service';

const IDLE: BackfillStatus = { state: 'idle', progress: 0, imported: 0, oldestLoaded: null, etaSeconds: null, error: null };
const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;
/** status polling while a backfill runs and the event stream is down */
const POLL_MS = 15_000;

/**
 * Live link to the backend for the active card:
 *  - listens to server-sent events — a transaction the bank just pushed (webhook) and history-backfill progress;
 *  - knows whether the bank's webhook is on, and can turn it on;
 *  - starts loading older history.
 * Without a live stream everything still works through the regular sync; this only makes it instant.
 */
@Injectable({ providedIn: 'root' })
export class LiveService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly sync = inject(SyncService);
  private readonly toast = inject(ToastService);

  /** the event stream is open */
  readonly connected = signal(false);
  readonly webhook = signal<WebhookStatus | null>(null);
  readonly enabling = signal(false);
  readonly backfill = signal<BackfillStatus>(IDLE);
  /** the latest transaction pushed by the bank (budgets react to it) */
  readonly lastTxn = signal<LiveTxn | null>(null);

  private source?: EventSource;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private retryMs = RETRY_MIN_MS;
  private poll?: Subscription;

  constructor() {
    effect(() => {
      const card = this.session.demo() ? '' : this.session.cardId();
      untracked(() => this.open(card));
    });

    effect(() => {
      const token = this.session.demo() ? '' : this.session.token();
      untracked(() => {
        this.webhook.set(null);
        if (token) this.api.webhookStatus(token).subscribe({ next: s => this.webhook.set(s), error: () => undefined });
      });
    });

    // the balance poll is only redundant when the bank really pushes to us and we are listening
    effect(() => this.sync.setLive(this.connected() && !!this.webhook()?.enabled));

    // no stream → follow a running backfill by polling
    effect(() => {
      const follow = this.backfill().state === 'running' && !this.connected();
      untracked(() => (follow ? this.startPolling() : this.stopPolling()));
    });

    inject(DestroyRef).onDestroy(() => {
      this.close();
      this.stopPolling();
    });
  }

  /** Ask Monobank to push transactions to the backend as they happen. */
  enableWebhook(): void {
    const token = this.session.token();
    if (!token || this.enabling()) return;
    this.enabling.set(true);
    this.api.registerWebhook(token).subscribe({
      next: () => {
        this.enabling.set(false);
        this.webhook.set({ configured: true, enabled: true });
        this.toast.show(translate('live.enabled'), 'success');
      },
      error: e => {
        this.enabling.set(false);
        this.toast.show(translate('live.enableFail', { error: errorText(toApiError(e)) }), 'error', 8000);
      },
    });
  }

  /** Load `months` of older history for the active card (runs on the server, about a minute per month). */
  startBackfill(months: number): void {
    const card = this.session.cardId();
    if (!card) return;
    this.api.startBackfill(card, months).subscribe({
      next: s => this.setBackfill(s),
      error: e => this.toast.show(translate('hist.fail', { error: errorText(toApiError(e)) }), 'error'),
    });
  }

  private open(card: string): void {
    this.close();
    this.backfill.set(IDLE);
    if (!card) return;

    this.api.backfillStatus(card).subscribe({ next: s => this.backfill.set(s), error: () => undefined });

    const es = new EventSource(this.api.eventsUrl(card));
    this.source = es;
    es.onopen = () => {
      this.connected.set(true);
      this.retryMs = RETRY_MIN_MS;
    };
    es.addEventListener('transaction', e => this.onTransaction((e as MessageEvent<string>).data));
    es.addEventListener('backfill', e => this.setBackfill(toBackfill(this.parse<BackfillDto>((e as MessageEvent<string>).data))));
    es.onerror = () => {
      // the browser's own retry does not back off, and gives up for good on an HTTP error — do it ourselves
      this.close();
      this.retryTimer = setTimeout(() => this.open(card), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, RETRY_MAX_MS);
    };
  }

  private close(): void {
    clearTimeout(this.retryTimer);
    this.source?.close();
    this.source = undefined;
    this.connected.set(false);
  }

  private onTransaction(data: string): void {
    const d = this.parse<{ description?: string; amount?: number; dateOccured?: string }>(data);
    if (!d) return;
    const txn: LiveTxn = { description: d.description ?? '', amount: d.amount ?? 0, date: new Date(d.dateOccured ?? Date.now()) };
    this.lastTxn.set(txn);
    this.toast.show(translate('live.txn', { amount: formatMoney(txn.amount, { signed: true }), name: txn.description }), 'info', 6000);
    this.sync.bump();
  }

  private setBackfill(next: BackfillStatus): void {
    const prev = this.backfill();
    this.backfill.set(next);
    // newly imported history → refetch what is on screen
    if (next.imported > prev.imported || (next.state === 'done' && prev.state === 'running')) this.sync.bump();
    if (next.state === 'done' && prev.state === 'running') this.toast.show(translate('hist.done', { n: next.imported }), 'success');
    if (next.state === 'failed' && prev.state === 'running') this.toast.show(translate('hist.fail', { error: next.error ?? '' }), 'error');
  }

  private startPolling(): void {
    if (this.poll) return;
    const card = this.session.cardId();
    this.poll = interval(POLL_MS)
      .pipe(switchMap(() => this.api.backfillStatus(card)))
      .subscribe({ next: s => this.setBackfill(s), error: () => this.stopPolling() });
  }

  private stopPolling(): void {
    this.poll?.unsubscribe();
    this.poll = undefined;
  }

  private parse<T>(data: string): T | null {
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }
}
