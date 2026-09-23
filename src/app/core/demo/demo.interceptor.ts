import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { delay, of } from 'rxjs';
import { API_BASE_URL } from '../config';
import { PrefsService } from '../prefs.service';
import { DEMO_CARDS, demoTransactions } from './demo-data';

/**
 * While demo mode is on, backend calls are answered locally with generated data
 * (with a little artificial latency, so loading states are visible). Otherwise it does nothing.
 */
export const demoInterceptor: HttpInterceptorFn = (req, next) => {
  const prefs = inject(PrefsService);
  const base = inject(API_BASE_URL);
  if (!prefs.demo() || !req.url.startsWith(base)) return next(req);

  const path = req.url.slice(base.length);
  const reply = (body: unknown) =>
    of(new HttpResponse({ status: 200, body })).pipe(delay(160 + Math.random() * 300));

  switch (path) {
    case '/clients/cards':
      return reply(DEMO_CARDS);
    case '/clients/balance/refresh':
    case '/transactions/latest':
    case '/auth/session':
      return reply({});
    case '/clients/webhook':
      return reply({ configured: false, enabled: false });
    case '/transactions/backfill':
      // the demo feed already holds half a year
      return reply({ state: 'done', progress: 1, imported: 0, oldestLoaded: null, etaSeconds: null, error: null });
    case '/transactions/by-period': {
      const card = req.params.get('clientCardId') ?? DEMO_CARDS[0].id;
      const from = new Date(req.params.get('dateFrom') ?? 0);
      const to = new Date(req.params.get('dateTo') ?? Date.now());
      return reply(demoTransactions(card, from, to));
    }
    default:
      return next(req);
  }
};
