import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from './config';
import { dayKey } from './format';
import { BackfillStatus, Card, DateRange, Txn, WebhookStatus } from './models';

interface CardDto {
  id?: string;
  /** whole currency units */
  balance?: number;
  creditLimit?: number;
  currencyCode?: number;
  type?: string;
  maskedCardNumber?: string | null;
}

interface TxnDto {
  id?: string;
  /** UTC, ISO 8601 */
  dateOccured?: string;
  description?: string;
  category?: string;
  amount?: number;
  icon?: string;
  counterName?: string | null;
  comment?: string | null;
  cashback?: number;
  hold?: boolean;
}

/** What POST /auth/session answers: this browser's session, and the card to start with. */
export interface Connection {
  accessToken: string;
  cardId: string | null;
  name: string;
}

export interface BackfillDto {
  state?: BackfillStatus['state'];
  progress?: number;
  imported?: number;
  oldestLoaded?: string | null;
  etaSeconds?: number | null;
  error?: string | null;
}

export const toBackfill = (d: BackfillDto | null | undefined): BackfillStatus => ({
  state: d?.state ?? 'idle',
  progress: d?.progress ?? 0,
  imported: d?.imported ?? 0,
  oldestLoaded: d?.oldestLoaded ? new Date(d.oldestLoaded) : null,
  etaSeconds: d?.etaSeconds ?? null,
  error: d?.error ?? null,
});

const toCard = (c: CardDto): Card => ({
  id: c.id ?? '',
  balance: c.balance ?? 0,
  creditLimit: c.creditLimit ?? 0,
  currencyCode: c.currencyCode ?? 980,
  type: (c.type ?? '').toLowerCase(),
  maskedNumber: c.maskedCardNumber ?? '',
});

const ZERO_ID = '00000000-0000-0000-0000-000000000000';

export function toTxns(list: readonly TxnDto[] | null | undefined): Txn[] {
  const seen = new Map<string, number>();
  const out: Txn[] = [];
  for (const d of list ?? []) {
    const date = new Date(d.dateOccured ?? '');
    if (Number.isNaN(date.getTime())) continue;
    const description = (d.description ?? '').trim() || 'Без назви';
    const amount = d.amount ?? 0;
    // older backends sent a zero GUID for every id → then a stable key is built from the content
    let key = d.id && d.id !== ZERO_ID ? d.id : '';
    if (!key) {
      const base = `${d.dateOccured}|${description}|${amount}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      key = `${base}#${n}`;
    }
    out.push({
      key,
      date,
      day: dayKey(date),
      description,
      category: d.category?.trim() || 'Інше',
      amount,
      icon: (d.icon ?? '').trim(),
      counterName: d.counterName?.trim() || '',
      comment: d.comment?.trim() || '',
      cashback: d.cashback ?? 0,
      hold: !!d.hold,
    });
  }
  return out.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Typed client for the Outlay backend. Same endpoints as before; two fixes vs. the old service:
 * POST calls no longer send the HTTP options object as the request *body*, and `dateTo`
 * goes out as end-of-day (a bare date silently dropped today's transactions).
 */
/**
 * Typed client for the Outlay backend. The Monobank token is sent exactly once (to open a session);
 * every other call is authorised by the session (see authInterceptor). Dates go out with their
 * offset and come back in UTC.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  /** Exchanges a Monobank token for a session of this browser. */
  connect(monobankToken: string): Observable<Connection> {
    return this.http.post<Connection>(`${this.base}/auth/session`, { token: monobankToken });
  }

  signOut(): Observable<unknown> {
    return this.http.delete(`${this.base}/auth/session`);
  }

  cards(): Observable<Card[]> {
    return this.http.get<CardDto[]>(`${this.base}/clients/cards`).pipe(map(list => (list ?? []).map(toCard)));
  }

  /** Re-reads balances (and any new account) from the bank. */
  updateBalance(): Observable<unknown> {
    return this.http.post(`${this.base}/clients/balance/refresh`, null);
  }

  /** Asks the backend to pull the newest statement from the bank. */
  syncLatest(cardId: string): Observable<unknown> {
    return this.http.post(`${this.base}/transactions/latest`, null, { params: { cardId } });
  }

  /** Asks Monobank to push new transactions to the backend as they happen. */
  registerWebhook(): Observable<unknown> {
    return this.http.post(`${this.base}/clients/webhook`, null);
  }

  webhookStatus(): Observable<WebhookStatus> {
    return this.http
      .get<Partial<WebhookStatus>>(`${this.base}/clients/webhook`)
      .pipe(map(s => ({ configured: !!s?.configured, enabled: !!s?.enabled })));
  }

  /** Starts loading `months` of older history in the background. */
  startBackfill(cardId: string, months: number): Observable<BackfillStatus> {
    return this.http
      .post<BackfillDto>(`${this.base}/transactions/backfill`, null, { params: { cardId, months } })
      .pipe(map(toBackfill));
  }

  backfillStatus(cardId: string): Observable<BackfillStatus> {
    return this.http
      .get<BackfillDto>(`${this.base}/transactions/backfill`, { params: { cardId } })
      .pipe(map(toBackfill));
  }

  /** Server-sent events of one card. EventSource cannot send headers, so the session goes in the URL. */
  eventsUrl(cardId: string, accessToken: string): string {
    return `${this.base}/events?cardId=${encodeURIComponent(cardId)}&access_token=${encodeURIComponent(accessToken)}`;
  }

  transactions(cardId: string, range: DateRange): Observable<Txn[]> {
    return this.http
      .get<TxnDto[]>(`${this.base}/transactions/by-period`, {
        params: { clientCardId: cardId, dateFrom: range.from.toISOString(), dateTo: range.to.toISOString() },
      })
      .pipe(map(toTxns));
  }
}
