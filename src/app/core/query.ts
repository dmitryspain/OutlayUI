import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Signal, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { ApiError } from './models';

export interface Query<T> {
  data: Signal<T | undefined>;
  loading: Signal<boolean>;
  error: Signal<ApiError | null>;
  reload(): void;
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return { status: 0, kind: 'offline', offline: true };
    // only a structured body ({ code, message }) is shown: 5xx bodies are stack traces, never for people
    const body = typeof e.error === 'object' && e.error ? (e.error as { code?: string; message?: string }) : null;
    return {
      status: e.status,
      code: body?.code,
      serverMessage: body?.message || undefined,
      kind: e.status >= 500 ? 'server' : 'request',
      offline: false,
    };
  }
  return { status: -1, kind: 'unknown', offline: false, serverMessage: e instanceof Error ? e.message : undefined };
}

/**
 * A signal-driven async loader (stale-while-revalidate).
 * - re-runs whenever `source()` changes; return null/undefined to stay idle
 * - keeps the previous `data` while the next request is in flight, so charts dim instead of flashing a skeleton
 * - `key` decides when data belongs to a *different* entity (e.g. another card) and must be dropped
 * Call it from an injection context (a field initialiser or constructor).
 */
export function query<P, T>(
  source: () => P | null | undefined,
  fetcher: (params: P) => Observable<T>,
  opts: { key?: (params: P) => unknown } = {},
): Query<T> {
  const data = signal<T | undefined>(undefined);
  const loading = signal(false);
  const error = signal<ApiError | null>(null);
  const tick = signal(0);
  let sub: Subscription | undefined;
  let lastKey: unknown;

  effect(
    () => {
      const params = source();
      tick();
      sub?.unsubscribe();
      if (params == null) {
        data.set(undefined);
        error.set(null);
        loading.set(false);
        lastKey = undefined;
        return;
      }
      const key = opts.key?.(params);
      if (opts.key && key !== lastKey) data.set(undefined);
      lastKey = key;
      loading.set(true);
      error.set(null);
      sub = untracked(() => fetcher(params)).subscribe({
        next: v => data.set(v),
        error: e => {
          error.set(toApiError(e));
          loading.set(false);
        },
        complete: () => loading.set(false),
      });
    },
    { allowSignalWrites: true },
  );

  inject(DestroyRef).onDestroy(() => sub?.unsubscribe());

  return {
    data: data.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    reload: () => tick.update(n => n + 1),
  };
}
