import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from './config';
import { dayKey, toApiDate } from './format';
import { BackfillStatus, Card, DateRange, Txn, WebhookStatus } from './models';

interface CardDto {
  id?: string;
  /** minor units (kopiykas) */
  balance?: number;
  currencyCode?: number;
  type?: string;
  maskedCardNumber?: string;
}

interface TxnDto {
  dateOccured?: string;
  description?: string;
  category?: string;
  amount?: number;
  icon?: string;
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
  balance: (c.balance ?? 0) / 100,
  currencyCode: c.currencyCode ?? 980,
  type: (c.type ?? '').toLowerCase(),
  maskedNumber: c.maskedCardNumber ?? '',
});

export function toTxns(list: readonly TxnDto[] | null | undefined): Txn[] {
  const seen = new Map<string, number>();
  const out: Txn[] = [];
  for (const d of list ?? []) {
    const date = new Date(d.dateOccured ?? '');
    if (Number.isNaN(date.getTime())) continue;
    const description = (d.description ?? '').trim() || 'Без назви';
    const amount = d.amount ?? 0;
    // the API sends a zero GUID for every id → build a stable key from the content
    const base = `${d.dateOccured}|${description}|${amount}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    out.push({
      key: `${base}#${n}`,
      date,
      day: dayKey(date),
      description,
      category: d.category?.trim() || 'Інше',
      amount,
      icon: (d.icon ?? '').trim(),
    });
  }
  return out.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Typed client for the Outlay backend. Same endpoints as before; two fixes vs. the old service:
 * POST calls no longer send the HTTP options object as the request *body*, and `dateTo`
 * goes out as end-of-day (a bare date silently dropped today's transactions).
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  cards(token: string): Observable<Card[]> {
    return this.http
      .post<CardDto[]>(`${this.base}/clients/cards`, null, { params: { clientToken: token } })
      .pipe(map(list => (list ?? []).map(toCard)));
  }

  register(token: string): Observable<unknown> {
    return this.http.post(`${this.base}/clients/register`, null, { params: { clientToken: token } });
  }

  updateBalance(token: string): Observable<unknown> {
    return this.http.get(`${this.base}/clients/update-balance`, { params: { clientToken: token } });
  }

  /** Asks the backend to pull the newest statement from the bank. */
  syncLatest(cardId: string): Observable<unknown> {
    return this.http.get(`${this.base}/transactions/latest`, { params: { cardId } });
  }

  /** Asks Monobank to push new transactions to the backend as they happen. */
  registerWebhook(token: string): Observable<unknown> {
    return this.http.post(`${this.base}/clients/webhook`, null, { params: { clientToken: token } });
  }

  webhookStatus(token: string): Observable<WebhookStatus> {
    return this.http
      .get<Partial<WebhookStatus>>(`${this.base}/clients/webhook`, { params: { clientToken: token } })
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

  /** Server-sent events of one card: `transaction` (pushed by the bank) and `backfill` (progress). */
  eventsUrl(cardId: string): string {
    return `${this.base}/events?cardId=${encodeURIComponent(cardId)}`;
  }

  transactions(cardId: string, range: DateRange): Observable<Txn[]> {
    return this.http
      .get<TxnDto[]>(`${this.base}/transactions/by-period`, {
        params: { clientCardId: cardId, dateFrom: toApiDate(range.from), dateTo: toApiDate(range.to) },
      })
      .pipe(map(toTxns));
  }
}
