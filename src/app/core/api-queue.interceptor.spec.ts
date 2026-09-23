import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { apiQueueInterceptor } from './api-queue.interceptor';

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

  it('sends one request at a time', () => {
    http.get(`${BASE}/transactions/latest`).subscribe(); // takes the free slot
    http.get(`${BASE}/clients/update-balance`).subscribe();
    http.get(`${BASE}/transactions/by-period`).subscribe();

    const inFlight = backend.match(() => true);
    expect(inFlight.length).toBe(1);
    expect(inFlight[0].request.url).toContain('/transactions/latest');
    expect(backend.match(() => true).length).toBe(0); // the other two are queued, not sent

    // drain: the queue is shared by the whole module, so leave it idle for the next test
    inFlight[0].flush({});
    backend.expectOne(`${BASE}/transactions/by-period`).flush([]);
    backend.expectOne(`${BASE}/clients/update-balance`).flush({});
  });

  it('runs waiting requests in priority order', fakeAsync(() => {
    const order: string[] = [];
    const track = (name: string) => () => order.push(name);

    http.get(`${BASE}/transactions/latest`).subscribe(track('latest'));
    http.get(`${BASE}/clients/update-balance`).subscribe(track('balance'));
    http.get(`${BASE}/transactions/by-period`).subscribe(track('feed'));

    backend.expectOne(`${BASE}/transactions/latest`).flush({});
    backend.expectOne(`${BASE}/transactions/by-period`).flush([]); // jumps ahead of the balance refresh
    backend.expectOne(`${BASE}/clients/update-balance`).flush({});
    tick();

    expect(order).toEqual(['latest', 'feed', 'balance']);
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
