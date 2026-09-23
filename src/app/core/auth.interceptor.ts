import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { API_BASE_URL } from './config';
import { SessionService } from './session.service';
import { ToastService } from './toast.service';
import { translate } from '../i18n/translate';

/** Adds this browser's session to backend calls; a 401 means it is gone, so the user is asked to reconnect. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(inject(API_BASE_URL))) return next(req);
  const session = inject(SessionService);
  const toast = inject(ToastService);
  const token = session.accessToken();
  const connecting = req.url.endsWith('/auth/session') && req.method === 'POST';
  const authed = token && !connecting ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    tap({
      error: (e: unknown) => {
        if (e instanceof HttpErrorResponse && e.status === 401 && token && !connecting && session.accessToken() === token) {
          session.expire();
          toast.show(translate('auth.expired'), 'error', 8000);
        }
      },
    }),
  );
};
