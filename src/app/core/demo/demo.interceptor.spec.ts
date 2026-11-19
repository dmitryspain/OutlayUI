import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { API_BASE_URL } from '../config';
import { PrefsService } from '../prefs.service';
import { DEMO_CARDS } from './demo-data';
import { demoInterceptor } from './demo.interceptor';

/** a backend address a mobile build may have: anything other than the web one */
const MOBILE = 'https://mac.tailnet.ts.net/api';

describe('demoInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  const setup = (demo: boolean, base?: string): string => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([demoInterceptor])),
        provideHttpClientTesting(),
        // only the demo switch is read; the real service would write to <html> and localStorage
        { provide: PrefsService, useValue: { demo: signal(demo) } },
        ...(base ? [{ provide: API_BASE_URL, useValue: base }] : []),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    return TestBed.inject(API_BASE_URL);
  };

  afterEach(() => backend.verify());

  it('in demo mode answers backend calls itself', fakeAsync(() => {
    const base = setup(true);
    let cards: unknown;
    http.get(`${base}/clients/cards`).subscribe(v => (cards = v));
    tick(500); // the artificial latency
    backend.expectNone(() => true);
    expect(cards).toEqual(DEMO_CARDS);
  }));

  it('recognises the backend by API_BASE_URL: with another address (mobile build) that one is answered, the web one is not', fakeAsync(() => {
    setup(true, MOBILE);
    let cards: unknown;
    http.get(`${MOBILE}/clients/cards`).subscribe(v => (cards = v));
    http.get(`${environment.apiBaseUrl}/clients/cards`).subscribe();
    tick(500);
    expect(cards).toEqual(DEMO_CARDS);
    backend.expectOne(`${environment.apiBaseUrl}/clients/cards`).flush([]);
  }));

  it('does nothing when demo mode is off', () => {
    const base = setup(false);
    let cards: unknown;
    http.get(`${base}/clients/cards`).subscribe(v => (cards = v));
    backend.expectOne(`${base}/clients/cards`).flush([{ id: 'real' }]);
    expect(cards).toEqual([{ id: 'real' }]);
  });
});
