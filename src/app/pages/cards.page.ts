import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CardsService } from '../core/cards.service';
import { currencySymbol } from '../core/format';
import { Card } from '../core/models';
import { PrefsService } from '../core/prefs.service';
import { SessionService } from '../core/session.service';
import { ToastService } from '../core/toast.service';
import { TPipe } from '../i18n/pipes';
import { translate } from '../i18n/translate';
import { CardVisualComponent } from '../shared/card-visual.component';
import { ConnectPanelComponent } from '../shared/connect-panel.component';
import { IconComponent } from '../shared/icon.component';
import { MoneyComponent } from '../shared/money.component';
import { EmptyStateComponent, ErrorStateComponent } from '../shared/states.component';

@Component({
  selector: 'app-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardVisualComponent, ConnectPanelComponent, IconComponent, MoneyComponent, EmptyStateComponent, ErrorStateComponent, TPipe],
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">{{ 'cd.eyebrow' | t }}</p>
          <h1 class="page-title">{{ 'nav.cards' | t }}</h1>
          <p class="page-sub">{{ 'cd.sub' | t }}</p>
        </div>
        @if (session.connected()) {
          <button type="button" class="btn btn-sm" (click)="cards.reload()" [disabled]="cards.loading()">
            <app-icon name="refresh" [size]="16" /> {{ 'cd.refresh' | t }}
          </button>
        }
      </header>

      @if (!session.connected()) {
        <section class="card connect">
          <h2 class="card-title">{{ 'cd.connect.title' | t }}</h2>
          <p class="muted">{{ 'cd.connect.text' | t }}</p>
          <app-connect-panel />
          <p class="muted or">{{ 'cd.or' | t }} <button type="button" class="link" (click)="prefs.setDemo(true)">{{ 'cd.orDemo' | t }}</button>.</p>
        </section>
      } @else if (cards.error() && !cards.loaded()) {
        <app-error-state [error]="cards.error()!" (retry)="cards.reload()" />
      } @else if (!cards.loaded()) {
        <div class="grid" aria-busy="true" [attr.aria-label]="'common.loading' | t">
          @for (i of [1, 2, 3]; track i) { <div class="skeleton" style="aspect-ratio: 1.586; border-radius: 20px"></div> }
        </div>
      } @else if (!cards.cards().length) {
        <div class="card"><app-empty-state icon="card" [title]="'cd.none.title' | t" [text]="'cd.none.text' | t" /></div>
      } @else {
        <div class="grid busy-wrap" [class.busy]="cards.loading()" role="radiogroup" [attr.aria-label]="'cs.title' | t">
          @for (c of sorted(); track c.id) {
            <button type="button" role="radio" class="pick" [class.empty]="c.balance <= 0" [attr.aria-checked]="c.id === session.cardId()" (click)="choose(c)">
              <app-card-visual [card]="c" [active]="c.id === session.cardId()" />
              <span class="info">
                <span class="muted">{{ 'cd.balance' | t }}</span>
                <app-money class="bal" [value]="c.balance" [symbol]="sym(c.currencyCode)" />
              </span>
            </button>
          }
        </div>
        <p class="muted note">{{ 'cd.note' | t }}</p>
      }
    </div>
  `,
  styles: [
    `
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 28px 24px; }
      .pick { display: grid; gap: 12px; padding: 0; text-align: left; border-radius: 22px; transition: opacity var(--dur-2) var(--ease), transform var(--dur-2) var(--ease); }
      .pick.empty { opacity: .55; }
      .pick:hover { opacity: 1; }
      .pick:focus-visible { outline-offset: 6px; border-radius: 24px; }
      .info { display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px; }
      .bal { font-size: 1.35rem; font-weight: 700; letter-spacing: -.02em; }
      .note { font-size: var(--fs-sm); }
      .connect { display: grid; gap: 14px; max-width: 640px; }
      .or { font-size: var(--fs-sm); }
      .link { color: var(--accent-text); text-decoration: underline; text-underline-offset: .18em; font-weight: 600; }
    `,
  ],
})
export class CardsPage {
  protected readonly cards = inject(CardsService);
  protected readonly session = inject(SessionService);
  protected readonly prefs = inject(PrefsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly sorted = computed(() => {
    const active = this.session.cardId();
    return [...this.cards.cards()].sort((a, b) => Number(b.id === active) - Number(a.id === active) || b.balance - a.balance);
  });

  protected sym(code: number): string {
    return currencySymbol(code);
  }

  protected choose(c: Card): void {
    this.session.setCard(c.id);
    this.toast.show(translate('cd.chosen'), 'success');
    void this.router.navigateByUrl('/home');
  }
}
