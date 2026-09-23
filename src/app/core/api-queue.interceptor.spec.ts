import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MAX_IN_FLIGHT, apiQueueInterceptor } from './api-queue.interceptor';

const BASE = 'https://localhost:7016/api';

describe('apiQueueInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([apiQueueInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
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

  it('leaves other hosts alone', () => {
    let got: unknown;
    http.get('https://example.com/x').subscribe(v => (got = v));
    backend.expectOne('https://example.com/x').flush({ ok: 1 });
    expect(got).toEqual({ ok: 1 });
  });
});
