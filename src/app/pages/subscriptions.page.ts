import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { addDays, endOfDay, formatMoney, formatShortDate, startOfDay } from '../core/format';
import { Recurring, detectRecurring } from '../core/recurring';
import { query } from '../core/query';
import { SessionService } from '../core/session.service';
import { SyncService } from '../core/sync.service';
import { TPipe, TpPipe } from '../i18n/pipes';
import { translate, translatePlural } from '../i18n/translate';
import { AvatarComponent } from '../shared/avatar.component';
import { HistoryLoaderComponent } from '../shared/history-loader.component';
import { IconComponent } from '../shared/icon.component';
import { MoneyComponent } from '../shared/money.component';
import { EmptyStateComponent, ErrorStateComponent } from '../shared/states.component';

/** how far back to look for recurring payments */
const LOOKBACK_DAYS = 400;
/** below this much stored history, suggest loading more */
const ENOUGH_HISTORY_DAYS = 80;
const UPCOMING_DAYS = 30;

@Component({
  selector: 'app-subscriptions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, IconComponent, AvatarComponent, MoneyComponent, HistoryLoaderComponent, EmptyStateComponent, ErrorStateComponent, TPipe, TpPipe],
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">{{ 'subs.count' | t }}: {{ active().length }}</p>
          <h1 class="page-title">{{ 'nav.subs' | t }}</h1>
          <p class="page-sub">{{ 'subs.sub' | t }}</p>
        </div>
      </header>

      @if (!session.hasCard()) {
        <div class="card">
          <app-empty-state icon="repeat" [title]="'common.chooseCard' | t">
            <a class="btn btn-primary" routerLink="/cards">{{ 'common.toCards' | t }}</a>
          </app-empty-state>
        </div>
      } @else if (q.error() && !q.data()) {
        <app-error-state [error]="q.error()!" (retry)="q.reload()" />
      } @else if (!q.data()) {
        <div class="card" aria-busy="true"><div class="skeleton" style="height: 120px"></div></div>
        <div class="card" aria-busy="true"><div class="skeleton" style="height: 280px"></div></div>
      } @else {
        @if (historyDays() < enough) {
          <div class="callout">
            <app-icon name="clock" [size]="20" />
            <div class="grow stack">
              <p><strong>{{ 'subs.short.title' | t }}</strong></p>
              <p class="muted">{{ 'subs.short.text' | t: { days: (historyDays() | tp: 'plural.days') } }}</p>
              <app-history-loader />
            </div>
          </div>
        }

        @if (!list().length) {
          <div class="card">
            <app-empty-state icon="repeat" [title]="'subs.empty.title' | t" [text]="'subs.empty.text' | t" />
          </div>
        } @else {
          <div class="bento busy-wrap" [class.busy]="q.loading()">
            <div class="card stat s-4"><span class="label">{{ 'subs.monthly' | t }}</span><app-money class="v" [value]="monthly()" [decimals]="0" [animate]="true" /></div>
            <div class="card stat s-4"><span class="label">{{ 'subs.yearly' | t }}</span><app-money class="v" [value]="monthly() * 12" [decimals]="0" /></div>
            <div class="card stat s-4"><span class="label">{{ 'subs.count' | t }}</span><span class="v">{{ active().length }}</span></div>

            <section class="card s-5" aria-labelledby="up-h">
              <div class="card-head"><div><h2 class="card-title" id="up-h">{{ 'subs.upcoming' | t }}</h2><p class="card-sub">{{ 'subs.upcoming.sub' | t }}</p></div></div>
              @if (upcoming().length) {
                <ol class="timeline">
                  @for (s of upcoming(); track s.key) {
                    <li>
                      <span class="when"><strong>{{ short(s.next) }}</strong><span class="muted">{{ inDays(s.next) }}</span></span>
                      <span class="trunc grow">{{ s.name }}</span>
                      <app-money [value]="-s.amount" [decimals]="0" />
                    </li>
                  }
                </ol>
              } @else {
                <p class="muted">{{ 'subs.upcoming.none' | t }}</p>
              }
            </section>

            <section class="card s-7" aria-labelledby="act-h">
              <div class="card-head"><div><h2 class="card-title" id="act-h">{{ 'subs.active' | t }}</h2><p class="card-sub">{{ 'subs.active.sub' | t }}</p></div></div>
              <ul class="rows">
                @for (s of active(); track s.key) { <ng-container *ngTemplateOutlet="row; context: { $implicit: s }" /> }
              </ul>
            </section>

            @if (inactive().length) {
              <section class="card" aria-labelledby="ina-h">
                <div class="card-head"><div><h2 class="card-title" id="ina-h">{{ 'subs.inactive' | t }}</h2><p class="card-sub">{{ 'subs.inactive.sub' | t }}</p></div></div>
                <ul class="rows dim">
                  @for (s of inactive(); track s.key) { <ng-container *ngTemplateOutlet="row; context: { $implicit: s }" /> }
                </ul>
              </section>
            }
          </div>
        }
      }
    </div>

    <ng-template #row let-s>
      <li>
        <button type="button" class="r" (click)="open(s)">
          <app-avatar [category]="s.category" [description]="s.name" [icon]="s.icon" [size]="40" />
          <span class="mid">
            <span class="l1">
              <span class="name trunc">{{ s.name }}</span>
              <app-money class="amt" [value]="-s.amount" [decimals]="s.amount < 1000 ? 2 : 0" />
            </span>
            <span class="l2">
              <span class="pill">{{ cadence(s) }}</span>
              @if (s.previousAmount !== null) {
                <span class="pill" [class.neg]="s.amount > s.previousAmount" [class.pos]="s.amount < s.previousAmount">
                  <app-icon [name]="s.amount > s.previousAmount ? 'trending-up' : 'trending-down'" [size]="13" />
                  {{ priceChange(s) }}
                </span>
              }
              <span class="muted">{{ s.active ? next(s) : last(s) }} · {{ charges(s) }}</span>
              <span class="muted yr">{{ 'subs.perYear' | t: { amount: money(s.yearly) } }}</span>
            </span>
          </span>
        </button>
      </li>
    </ng-template>
  `,
  styles: [
    `
      .stat { display: grid; gap: 6px; }
      .stat .v { font-size: var(--fs-2xl); font-weight: 750; letter-spacing: -.02em; }
      .timeline { display: grid; gap: 2px; }
      .timeline li { display: flex; align-items: center; gap: 12px; padding: 9px 0; }
      .timeline li + li { border-top: var(--edge-w) solid var(--line, var(--edge)); }
      .when { display: grid; min-width: 86px; font-size: var(--fs-sm); line-height: 1.25; }
      .rows { display: grid; gap: 2px; }
      .rows.dim { opacity: .75; }
      .r {
        display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 8px; margin: 0 -8px; text-align: left;
        border-radius: var(--radius-m); color: inherit; transition: background var(--dur-1) var(--ease);
      }
      .r:hover { background: var(--surface-2); }
      .mid { display: grid; gap: 6px; flex: 1 1 auto; min-width: 0; }
      .l1 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
      .name { font-weight: 600; }
      .amt { font-weight: 650; }
      .l2 { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: var(--fs-sm); }
      .yr { margin-left: auto; }
    `,
  ],
})
export class SubscriptionsPage {
  private readonly api = inject(ApiService);
  private readonly sync = inject(SyncService);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);
  protected readonly enough = ENOUGH_HISTORY_DAYS;

  protected readonly q = query(
    () => {
      const card = this.session.cardId();
      if (!card) return null;
      const now = new Date();
      return { card, from: startOfDay(addDays(now, -LOOKBACK_DAYS)), to: endOfDay(now), v: this.sync.version() };
    },
    p => this.api.transactions(p.card, { from: p.from, to: p.to }),
    { key: p => p.card },
  );

  protected readonly list = computed(() => detectRecurring(this.q.data() ?? []));
  protected readonly active = computed(() => this.list().filter(s => s.active));
  protected readonly inactive = computed(() => this.list().filter(s => !s.active));
  protected readonly monthly = computed(() => this.active().reduce((sum, s) => sum + s.monthly, 0));
  protected readonly upcoming = computed(() => {
    const limit = addDays(new Date(), UPCOMING_DAYS);
    return this.active()
      .filter(s => s.next <= limit)
      .sort((a, b) => a.next.getTime() - b.next.getTime());
  });
  /** days between the oldest stored transaction and now */
  protected readonly historyDays = computed(() => {
    const list = this.q.data() ?? [];
    if (!list.length) return 0;
    return Math.round((Date.now() - list[list.length - 1].date.getTime()) / 86_400_000);
  });

  protected money(v: number): string {
    return formatMoney(v, { decimals: 0 });
  }
  protected short(d: Date): string {
    return formatShortDate(d);
  }
  protected cadence(s: Recurring): string {
    return translate(`subs.cadence.${s.cadence}`);
  }
  protected charges(s: Recurring): string {
    return translatePlural('plural.charges', s.count);
  }
  protected next(s: Recurring): string {
    return translate('subs.next', { date: formatShortDate(s.next) });
  }
  protected last(s: Recurring): string {
    return translate('subs.last', { date: formatShortDate(s.last) });
  }
  protected priceChange(s: Recurring): string {
    const amount = formatMoney(s.previousAmount ?? 0, { decimals: 'auto' });
    return translate(s.amount > (s.previousAmount ?? 0) ? 'subs.priceUp' : 'subs.priceDown', { amount });
  }
  protected inDays(d: Date): string {
    const days = Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
    if (days <= 0) return translate('subs.today');
    if (days === 1) return translate('subs.tomorrow');
    return translate('subs.inDays', { days: translatePlural('plural.days', days) });
  }

  protected open(s: Recurring): void {
    void this.router.navigate(['/merchant'], { queryParams: { name: s.name } });
  }
}
