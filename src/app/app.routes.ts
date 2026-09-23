import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { SessionService } from './core/session.service';

/** Old deep link /choose/:id keeps working: select that card and go home. */
const chooseCard: CanActivateFn = route => {
  const id = route.paramMap.get('id');
  if (id) inject(SessionService).setCard(id);
  return inject(Router).createUrlTree(['/home']);
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', title: 'nav.overview', loadComponent: () => import('./pages/overview.page').then(m => m.OverviewPage) },
  { path: 'transactions', title: 'nav.transactions', loadComponent: () => import('./pages/transactions.page').then(m => m.TransactionsPage) },
  { path: 'weekly', title: 'nav.weekly', loadComponent: () => import('./pages/weekly.page').then(m => m.WeeklyPage) },
  { path: 'merchant', title: 'route.merchant', loadComponent: () => import('./pages/merchant.page').then(m => m.MerchantPage) },
  { path: 'cards', title: 'nav.cards', loadComponent: () => import('./pages/cards.page').then(m => m.CardsPage) },
  { path: 'settings', title: 'nav.settings', loadComponent: () => import('./pages/settings.page').then(m => m.SettingsPage) },

  // URLs from the previous version
  { path: 'raw', redirectTo: 'transactions' },
  { path: 'stats', redirectTo: 'transactions' },
  { path: 'choose', redirectTo: 'cards' },
  { path: 'choose/:id', canActivate: [chooseCard], children: [] },

  { path: '**', title: 'route.notFound', loadComponent: () => import('./pages/not-found.page').then(m => m.NotFoundPage) },
];
