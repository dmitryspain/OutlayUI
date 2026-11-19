import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { MAX_IN_FLIGHT, apiQueueInterceptor } from './api-queue.interceptor';
import { API_BASE_URL } from './config';

describe('apiQueueInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  /** the backend address the interceptor itself sees (not a copy that could drift from the environment) */
  let BASE: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([apiQueueInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    BASE = TestBed.inject(API_BASE_URL);
  });

  afterEach(() => backend.verify());

  /** occupies every slot with a slow background call */
  const fillSlots = () => {
    for (let i = 0; i < MAX_IN_FLIGHT; i++) http.get(`${BASE}/transactions/latest?n=${i}`).subscribe();
    return backend.match(r => r.url.includes('/transactions/latest'));
  };

  it(`sends at most ${MAX_IN_FLIGHT} requests at a time`, () => {
    const busy = fillSlots();
    http.get(`${BASE}/clients/balance/refresh`).subscribe();
    http.get(`${BASE}/transactions/by-period`).subscribe();

    expect(busy.length).toBe(MAX_IN_FLIGHT);
    expect(backend.match(() => true).length).toBe(0); // the other two wait

    // drain: the queue is shared by the whole module, so leave it idle for the next test
    busy[0].flush({});
    backend.expectOne(`${BASE}/transactions/by-period`).flush([]);
    busy.slice(1).forEach(r => r.flush({}));
    backend.expectOne(`${BASE}/clients/balance/refresh`).flush({});
  });

  it('runs waiting requests in priority order', fakeAsync(() => {
    const order: string[] = [];
    const track = (name: string) => () => order.push(name);

    const busy = fillSlots();
    http.get(`${BASE}/clients/balance/refresh`).subscribe(track('balance'));
    http.get(`${BASE}/transactions/by-period`).subscribe(track('feed'));

    busy[0].flush({});
    backend.expectOne(`${BASE}/transactions/by-period`).flush([]); // jumps ahead of the balance refresh
    busy[1].flush({});
    backend.expectOne(`${BASE}/clients/balance/refresh`).flush({});
    busy.slice(2).forEach(r => r.flush({}));
    tick();

    expect(order).toEqual(['feed', 'balance']);
  }));

  it('retries a failed feed request (transient 5xx) and then succeeds', fakeAsync(() => {
    let result: unknown;
    let failed = false;
    http.get(`${BASE}/transactions/by-period`).subscribe({ next: v => (result = v), error: () => (failed = true) });

    backend.expectOne(`${BASE}/transactions/by-period`).flush('boom', { status: 500, statusText: 'Server Error' });
    tick(400); // first back-off
    backend.expectOne(`${BASE}/transactions/by-period`).flush([{ ok: true }]);

    expect(failed).toBeFalse();
    expect(result).toEqual([{ ok: true }]);
  }));

  it('does not retry background calls: a retry loop would hold the queue slot', fakeAsync(() => {
    let failed = false;
    http.get(`${BASE}/transactions/latest`).subscribe({ error: () => (failed = true) });

    backend.expectOne(`${BASE}/transactions/latest`).flush('boom', { status: 503, statusText: 'Unavailable' });
    tick(5000);

    backend.expectNone(`${BASE}/transactions/latest`);
    expect(failed).toBeTrue();
  }));

  it('leaves other hosts alone: they skip the queue even when it is full', () => {
    const busy = fillSlots();
    let got: unknown;
    const sub = http.get('https://example.com/x').subscribe(v => (got = v));
    try {
      backend.expectOne('https://example.com/x').flush({ ok: 1 }); // went out although every slot is taken
      expect(got).toEqual({ ok: 1 });
    } finally {
      sub.unsubscribe(); // had it been queued, it must not hold a slot in the next test
      busy.forEach(r => r.flush({}));
    }
  });
});

describe('apiQueueInterceptor with another backend address (mobile build)', () => {
  const MOBILE = 'https://mac.tailnet.ts.net/api';
  let http: HttpClient;
  let backend: HttpTestingController;
  const subs: Subscription[] = [];
  const get = (url: string) => subs.push(http.get(url).subscribe());

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiQueueInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: MOBILE },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      backend.verify();
    } finally {
      subs.splice(0).forEach(s => s.unsubscribe()); // a test that failed half-way must not leave the shared queue busy
    }
  });

  it('queues the calls to that address and lets the web address through', () => {
    for (let i = 0; i < MAX_IN_FLIGHT; i++) get(`${MOBILE}/transactions/latest?n=${i}`);
    get(`${MOBILE}/clients/balance/refresh`);
    get(`${environment.apiBaseUrl}/clients/balance/refresh`); // not this build's backend

    const busy = backend.match(r => r.url.startsWith(`${MOBILE}/transactions/latest`));
    expect(busy.length).toBe(MAX_IN_FLIGHT);
    backend.expectNone(`${MOBILE}/clients/balance/refresh`); // waits for a free slot
    backend.expectOne(`${environment.apiBaseUrl}/clients/balance/refresh`).flush({});

    // drain: the queue is shared by the whole module, so leave it idle for the next test
    busy[0].flush({});
    backend.expectOne(`${MOBILE}/clients/balance/refresh`).flush({});
    busy.slice(1).forEach(r => r.flush({}));
  });
});
