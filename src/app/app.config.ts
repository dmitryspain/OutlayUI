import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { PreloadAllModules, TitleStrategy, provideRouter, withComponentInputBinding, withPreloading, withViewTransitions } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { apiQueueInterceptor } from './core/api-queue.interceptor';
import { demoInterceptor } from './core/demo/demo.interceptor';
import { AppTitleStrategy } from './core/title.strategy';
import { loadState } from './localStorage/local-storage';
import { metaReducers } from './localStorage/local-storage-meta-reducer';
import { routes } from './app.routes';
import { cardReducer } from './store/reducers/card.reducer';
import { tokenReducer } from './store/reducers/token-reducer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withComponentInputBinding(), // query params arrive as @Input()s
      // animated page changes (View Transitions API). The browser aborts a transition when the tab is hidden and
      // rejects its promises — that is expected, so the rejections are swallowed instead of logged as errors.
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition }) => {
          for (const p of [transition.ready, transition.finished, transition.updateCallbackDone]) p.catch(() => undefined);
        },
      }),
      withPreloading(PreloadAllModules), // lazy pages are fetched right after start, so navigation is instant
    ),
    // demo answers locally first; everything that still goes to the backend is queued (see the interceptor)
    provideHttpClient(withInterceptors([demoInterceptor, apiQueueInterceptor])),
    // the same store + persistence as before, so an already-saved token and card keep working
    provideStore({ card: cardReducer, token: tokenReducer }, { metaReducers, initialState: loadState() }),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
  ],
};
