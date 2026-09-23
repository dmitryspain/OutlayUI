import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { CardsService } from '../core/cards.service';
import { cardTag, currencySymbol } from '../core/format';
import { UiService } from '../core/ui.service';
import { TPipe } from '../i18n/pipes';
import type { MessageKey } from '../i18n/messages/uk';
import { IconComponent } from '../shared/icon.component';
import { IconName } from '../shared/icons';
import { LogoComponent } from '../shared/logo.component';
import { MoneyComponent } from '../shared/money.component';

interface NavItem {
  path: string;
  label: MessageKey;
  icon: IconName;
}

const ITEMS: readonly NavItem[] = [
  { path: '/home', label: 'nav.overview', icon: 'dashboard' },
  { path: '/transactions', label: 'nav.transactions', icon: 'list' },
  { path: '/weekly', label: 'nav.weekly', icon: 'calendar' },
  { path: '/budgets', label: 'nav.budgets', icon: 'wallet' },
  { path: '/subscriptions', label: 'nav.subs', icon: 'repeat' },
  { path: '/cards', label: 'nav.cards', icon: 'card' },
  { path: '/settings', label: 'nav.settings', icon: 'sliders' },
];

/**
 * One navigation element, three layouts from CSS alone:
 * sidebar (desktop) → icon rail (tablet) → bottom tab bar (phone).
 */
@Component({
  selector: 'app-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, LogoComponent, MoneyComponent, TPipe],
  template: `
    <nav class="nav" [attr.aria-label]="'nav.aria' | t">
      <a class="brand" routerLink="/home" [attr.aria-label]="'nav.homeAria' | t">
        <app-logo [size]="32" />
        <span class="bt">Outlay</span>
      </a>

      <ul class="items">
        @for (i of items; track i.path) {
          <li>
            <a class="it" [routerLink]="i.path" [class.on]="isActive(i.path)" [attr.aria-current]="isActive(i.path) ? 'page' : null">
              <span class="ic"><app-icon [name]="i.icon" [size]="22" /></span>
              <span class="lb">{{ i.label | t }}</span>
            </a>
          </li>
        }
      </ul>

      <div class="foot">
        <button type="button" class="chip-card" (click)="ui.openCardSwitcher()" [attr.aria-label]="'nav.cardChange' | t">
          <span class="dot" [attr.data-type]="cards.active()?.type ?? ''"></span>
          <span class="meta">
            @if (cards.active(); as c) {
              <span class="t">{{ tag(c.type, c.maskedNumber) }}</span>
              <app-money class="b" [value]="c.balance" [symbol]="sym(c.currencyCode)" [decimals]="0" />
            } @else {
              <span class="t">{{ 'common.chooseCard' | t }}</span>
              <span class="b muted">{{ 'nav.cardNone' | t }}</span>
            }
          </span>
          <app-icon class="chev" name="chevron-right" [size]="16" />
        </button>
      </div>
    </nav>
  `,
  styles: [
    `
      :host { display: block; }
      .nav {
        position: sticky; top: 0; height: 100dvh; display: flex; flex-direction: column; gap: 18px; padding: 18px 14px;
        background: var(--surface); border-right: var(--edge-w) solid var(--edge);
        -webkit-backdrop-filter: var(--card-backdrop, none); backdrop-filter: var(--card-backdrop, none);
      }
      .brand { display: flex; align-items: center; gap: 12px; padding: 4px 8px; color: var(--ink); text-decoration: none; }
      .bt { font-size: 1.25rem; font-weight: 800; letter-spacing: -.02em; }
      .items { display: grid; gap: 4px; }
      .it {
        position: relative; display: flex; align-items: center; gap: 12px; height: 46px; padding: 0 12px;
        border: var(--edge-w) solid transparent; border-radius: var(--radius-m);
        color: var(--ink-2); font-weight: 600; text-decoration: none;
        transition: background var(--dur-1) var(--ease), color var(--dur-1) var(--ease);
      }
      .it:hover { background: var(--surface-2); color: var(--ink); }
      .it.on { background: var(--accent-soft); color: var(--ink); }
      .it.on .ic { color: var(--accent-text); }
      .ic { display: grid; place-items: center; }
      .foot { margin-top: auto; }

      .chip-card {
        display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; text-align: left;
        border: var(--edge-w) solid var(--edge); border-radius: var(--radius-m); background: var(--surface-2);
        transition: background var(--dur-1) var(--ease);
      }
      .chip-card:hover { background: var(--surface-3); }
      .dot {
        flex: none; width: 34px; height: 24px; border-radius: 6px;
        background: linear-gradient(140deg, oklch(.5 .18 var(--accent-h)), oklch(.32 .12 calc(var(--accent-h) + 40)));
        box-shadow: inset 0 0 0 1px rgb(255 255 255 / .2);
      }
      .dot[data-type='black'] { background: linear-gradient(140deg, #2c2c36, #0a0a0d); }
      .dot[data-type='white'] { background: linear-gradient(140deg, #fff, #d9dce6); box-shadow: inset 0 0 0 1px rgb(0 0 0 / .18); }
      .dot[data-type='platinum'] { background: linear-gradient(140deg, #e0e4ed, #98a0b2); }
      .dot[data-type='iron'] { background: linear-gradient(140deg, #7d889c, #3a4252); }
      .dot[data-type='yellow'] { background: linear-gradient(140deg, #ffe066, #ffb300); }
      .meta { display: grid; flex: 1 1 auto; min-width: 0; }
      .t { font-size: var(--fs-xs); color: var(--ink-3); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .b { font-weight: 700; }
      .chev { color: var(--ink-3); }

      :host-context([data-theme='brutal']) .it.on { background: var(--accent); border-color: var(--edge); box-shadow: 3px 3px 0 var(--edge); color: #111; }
      :host-context([data-theme='brutal']) .it.on .ic { color: #111; }
      :host-context([data-theme='terminal']) .it.on::before { content: '>'; position: absolute; left: -2px; color: var(--accent); }

      /* tablet: icon rail */
      @media (max-width: 1023px) {
        .nav { padding: 14px 10px; align-items: center; }
        .bt, .lb, .meta, .chev { display: none; }
        .brand { padding: 0; }
        .it { width: 48px; height: 48px; justify-content: center; padding: 0; }
        .chip-card { width: auto; padding: 8px; }
      }

      /* phone: bottom tab bar */
      @media (max-width: 719px) {
        /* the host has a view-transition-name, i.e. its own stacking context: lift the host itself above the page */
        :host { position: relative; z-index: 30; }
        .nav {
          position: fixed; inset: auto 0 0 0; z-index: 30; height: auto; flex-direction: row; justify-content: center;
          padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
          border-right: 0; border-top: var(--edge-w) solid var(--edge); background: var(--surface-solid);
          -webkit-backdrop-filter: none; backdrop-filter: none;
        }
        .brand, .foot { display: none; }
        .items { grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); width: 100%; max-width: 620px; gap: 2px; }
        .it {
          flex-direction: column; justify-content: center; gap: 3px; width: auto; height: 56px; padding: 0;
          font-size: 11px; border-radius: var(--radius-m);
        }
        .lb { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lb { display: block; }
        :host-context([data-theme='terminal']) .it.on::before { display: none; }
      }
    `,
  ],
})
export class NavComponent {
  protected readonly ui = inject(UiService);
  protected readonly cards = inject(CardsService);
  private readonly router = inject(Router);

  protected readonly items = ITEMS;
  private readonly url = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected isActive(path: string): boolean {
    const url = this.url().split('?')[0];
    // a merchant page is part of "Транзакції"
    return url.startsWith(path) || (path === '/transactions' && url.startsWith('/merchant'));
  }

  protected tag(type: string, masked: string): string {
    return cardTag(type, masked);
  }
  protected sym(code: number): string {
    return currencySymbol(code);
  }
}
