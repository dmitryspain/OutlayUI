import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { API_BASE_URL } from './config';
import { SessionService } from './session.service';
import { ToastService } from './toast.service';

/** a backend address a mobile build may have: anything other than the web one */
const MOBILE = 'https://mac.tailnet.ts.net/api';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: { accessToken: () => string; expire: jasmine.Spy };
  let toast: { show: jasmine.Spy };

  const setup = (base?: string): string => {
    session = { accessToken: signal('ots_test'), expire: jasmine.createSpy('expire') };
    toast = { show: jasmine.createSpy('show') };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: session },
        { provide: ToastService, useValue: toast },
        ...(base ? [{ provide: API_BASE_URL, useValue: base }] : []),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    return TestBed.inject(API_BASE_URL);
  };

  /** the Authorization header the request to `url` went out with */
  const authOf = (url: string): string | null => {
    const req = backend.expectOne(url);
    req.flush({});
    return req.request.headers.get('Authorization');
  };

  afterEach(() => backend.verify());

  it('sends the session to the backend and never to other hosts', () => {
    const base = setup();
    http.get(`${base}/clients/cards`).subscribe();
    http.get('https://cdn.example.com/logo.png').subscribe();
    expect(authOf(`${base}/clients/cards`)).toBe('Bearer ots_test');
    expect(authOf('https://cdn.example.com/logo.png')).toBeNull();
  });

  it('follows API_BASE_URL: with another backend address (mobile build) the session goes there, not to the web address', () => {
    setup(MOBILE);
    http.get(`${MOBILE}/clients/cards`).subscribe();
    http.get(`${environment.apiBaseUrl}/clients/cards`).subscribe();
    expect(authOf(`${MOBILE}/clients/cards`)).toBe('Bearer ots_test');
    expect(authOf(`${environment.apiBaseUrl}/clients/cards`)).toBeNull();
  });

  it('a 401 from the backend ends the session; a 401 from another host does not', () => {
    const base = setup();
    http.get('https://other.example.com/x').subscribe({ error: () => undefined });
    backend.expectOne('https://other.example.com/x').flush('', { status: 401, statusText: 'Unauthorized' });
    expect(session.expire).not.toHaveBeenCalled();

    http.get(`${base}/clients/cards`).subscribe({ error: () => undefined });
    backend.expectOne(`${base}/clients/cards`).flush('', { status: 401, statusText: 'Unauthorized' });
    expect(session.expire).toHaveBeenCalledTimes(1);
    expect(toast.show).toHaveBeenCalledTimes(1);
  });
});
