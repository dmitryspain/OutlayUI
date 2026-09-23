import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardsService } from '../core/cards.service';
import { cardTypeLabel, currencySymbol } from '../core/format';
import { SessionService } from '../core/session.service';
import { UiService } from '../core/ui.service';
import { TPipe } from '../i18n/pipes';
import { IconComponent } from '../shared/icon.component';
import { MoneyComponent } from '../shared/money.component';

/** Quick "which card am I looking at" switcher — a native <dialog>, bottom sheet on phones. */
@Component({
  selector: 'app-card-switcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, MoneyComponent, RouterLink, TPipe],
  template: `
    <dialog #dlg class="sheet bottom" aria-labelledby="cs-title" (close)="ui.cardSwitcherOpen.set(false)" (click)="onBackdrop($event)">
      <div class="in">
        <header>
          <h2 id="cs-title">{{ 'cs.title' | t }}</h2>
          <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="close()" [attr.aria-label]="'common.close' | t"><app-icon name="x" [size]="18" /></button>
        </header>

        <ul>
          @for (c of cards.cards(); track c.id) {
            <li>
              <button type="button" class="opt" [class.on]="c.id === session.cardId()" (click)="choose(c.id)">
                <span class="dot" [attr.data-type]="c.type"></span>
                <span class="m"><b>{{ label(c.type) }}</b><span class="muted">{{ c.maskedNumber || ('cs.hidden' | t) }}</span></span>
                <app-money [value]="c.balance" [symbol]="sym(c.currencyCode)" [decimals]="0" />
                <span class="ck">@if (c.id === session.cardId()) { <app-icon name="check" [size]="18" /> }</span>
              </button>
            </li>
          } @empty {
            <li class="empty muted">{{ 'cs.empty' | t }}</li>
          }
        </ul>

        <footer><a class="btn btn-sm" routerLink="/cards" (click)="close()">{{ 'cs.all' | t }}</a></footer>
      </div>
    </dialog>
  `,
  styles: [
    `
      header { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 8px 20px; }
      h2 { font-size: var(--fs-lg); }
      ul { display: grid; gap: 4px; padding: 4px 12px; max-height: 50vh; overflow: auto; }
      .opt {
        display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px; text-align: left;
        border: var(--edge-w) solid transparent; border-radius: var(--radius-m); font-weight: 600;
      }
      .opt:hover { background: var(--surface-2); }
      .opt.on { background: var(--accent-softer); border-color: color-mix(in oklab, var(--accent) 45%, transparent); }
      .m { display: grid; flex: 1 1 auto; min-width: 0; }
      .m .muted { font-size: var(--fs-xs); font-weight: 500; }
      .ck { width: 18px; color: var(--accent-text); }
      .dot { flex: none; width: 40px; height: 28px; border-radius: 7px; background: linear-gradient(140deg, oklch(.5 .18 var(--accent-h)), oklch(.32 .12 calc(var(--accent-h) + 40))); box-shadow: inset 0 0 0 1px rgb(255 255 255 / .2); }
      .dot[data-type='black'] { background: linear-gradient(140deg, #2c2c36, #0a0a0d); }
      .dot[data-type='white'] { background: linear-gradient(140deg, #fff, #d9dce6); box-shadow: inset 0 0 0 1px rgb(0 0 0 / .18); }
      .dot[data-type='platinum'] { background: linear-gradient(140deg, #e0e4ed, #98a0b2); }
      .dot[data-type='iron'] { background: linear-gradient(140deg, #7d889c, #3a4252); }
      .dot[data-type='yellow'] { background: linear-gradient(140deg, #ffe066, #ffb300); }
      .empty { padding: 18px 12px; }
      footer { display: flex; justify-content: flex-end; padding: 8px 16px 16px; }
    `,
  ],
})
export class CardSwitcherComponent {
  protected readonly ui = inject(UiService);
  protected readonly cards = inject(CardsService);
  protected readonly session = inject(SessionService);

  @ViewChild('dlg', { static: true }) private dlg!: ElementRef<HTMLDialogElement>;

  constructor() {
    effect(() => {
      const open = this.ui.cardSwitcherOpen();
      const el = this.dlg.nativeElement;
      if (open && !el.open) el.showModal();
      else if (!open && el.open) el.close();
    });
  }

  protected choose(id: string): void {
    this.session.setCard(id);
    this.close();
  }

  protected close(): void {
    this.ui.cardSwitcherOpen.set(false);
  }

  protected onBackdrop(e: MouseEvent): void {
    if (e.target === this.dlg.nativeElement) this.close();
  }

  protected label(type: string): string {
    return cardTypeLabel(type);
  }
  protected sym(code: number): string {
    return currencySymbol(code);
  }
}
