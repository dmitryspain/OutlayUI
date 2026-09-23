import { InjectionToken } from '@angular/core';

/** The one place that knows where the backend lives (it used to be hard-coded in nine spots). */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'https://localhost:7016/api',
});

/** How often the balance is refreshed in the background. */
export const BALANCE_REFRESH_MS = 5 * 60 * 1000;

/** Placeholder token/card used while demo mode is on. */
export const DEMO_TOKEN = 'demo';

/** Category the bank assigns to person-to-person transfers, loan repayments, etc. */
export const TRANSFER_CATEGORY = 'Переказ коштів';
