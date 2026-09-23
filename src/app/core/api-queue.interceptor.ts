import { HttpErrorResponse, HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, Subscription, identity, retry, throwError, timer } from 'rxjs';
import { API_BASE_URL } from './config';

/**
 * Calls to the API go through a small queue: the data the screen is waiting on goes first, and
 * transient 5xx on reads are retried a couple of times. (It used to allow a single request at a time,
 * because the backend shared one non-thread-safe DbContext; that is fixed, so a few run in parallel.)
 */
export const MAX_IN_FLIGHT = 4;
const RETRIES = 3;

/** lower runs first: the feed the UI is waiting on, then cards, then background sync */
function priority(url: string): number {
  if (url.includes('/transactions/by-period')) return 0;
  if (url.includes('/clients/cards')) return 1;
  return 2;
}

interface Job {
  priority: number;
  seq: number;
  run: () => void;
}

const waiting: Job[] = [];
let active = 0;
let seq = 0;

function pump(): void {
  while (active < MAX_IN_FLIGHT && waiting.length) {
    waiting.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    waiting.shift()!.run();
  }
}

/**
 * 5xx — or status 0: the backend's 503s carry no CORS headers, so the browser hides them behind
 * a status-0 "network error" that is indistinguishable from the server being down for a moment.
 */
const isTransient = (e: unknown): boolean => e instanceof HttpErrorResponse && (e.status === 0 || e.status >= 500);

export const apiQueueInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(inject(API_BASE_URL))) return next(req);

  // only what the screen is waiting on is retried (both are pure reads).
  // Background sync is not: it talks to the bank, whose once-a-minute limit a retry would only hit again.
  const repeatable = req.url.includes('/transactions/by-period') || req.url.includes('/clients/cards');

  return new Observable<HttpEvent<unknown>>(subscriber => {
    let inner: Subscription | undefined;
    let running = false;

    const release = () => {
      if (!running) return;
      running = false;
      active--;
      pump();
    };

    const job: Job = {
      priority: priority(req.url),
      seq: ++seq,
      run: () => {
        running = true;
        active++;
        const source = next(req).pipe(
          repeatable
            ? retry({ count: RETRIES, delay: (err, n) => (isTransient(err) ? timer(400 * n) : throwError(() => err)) })
            : identity,
        );
        inner = source.subscribe({
          next: v => subscriber.next(v),
          error: e => {
            release();
            subscriber.error(e);
          },
          complete: () => {
            release();
            subscriber.complete();
          },
        });
      },
    };

    waiting.push(job);
    pump();

    // cancelled by the caller (e.g. the period changed again): leave the queue / abort the request
    return () => {
      const i = waiting.indexOf(job);
      if (i >= 0) waiting.splice(i, 1);
      inner?.unsubscribe();
      release();
    };
  });
};
