import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { payeeOf } from '../core/aggregate';
import { formatMoney, formatShortDate, formatTime } from '../core/format';
import { Txn } from '../core/models';
import { CatPipe, TPipe } from '../i18n/pipes';
import { AvatarComponent } from './avatar.component';
import { MoneyComponent } from './money.component';

/** One transaction. The whole row is a link to that merchant's history. */
@Component({
  selector: 'app-tx-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, MoneyComponent, RouterLink, CatPipe, TPipe],
  template: `
    <a class="tx" [routerLink]="['/merchant']" [queryParams]="{ name: payee }">
      <app-avatar [category]="tx.category" [description]="payee" [icon]="tx.icon" [size]="40" />
      <span class="main">
        <span class="d trunc">{{ payee }}</span>
        <span class="s trunc">
          @if (tx.hold) { <span class="hold">{{ 'tx.hold' | t }}</span> }
          {{ tx.category | cat }} · {{ when }}@if (tx.comment) { · «{{ tx.comment }}» }
        </span>
      </span>
      <span class="end">
        <app-money class="amt" [value]="tx.amount" [signed]="true" tone="sign" [decimals]="2" />
        @if (tx.cashback > 0) { <span class="cb">+{{ cashback }} {{ 'tx.cashback' | t }}</span> }
      </span>
    </a>
  `,
  styles: [
    `
      :host { display: block; }
      .tx {
        display: flex; align-items: center; gap: 14px; min-height: var(--row-h);
        padding: 8px 10px; margin: 0 -10px; border-radius: var(--radius-m);
        color: inherit; text-decoration: none; transition: background var(--dur-1) var(--ease);
      }
      .tx:hover { background: var(--surface-2); }
      .main { display: grid; flex: 1 1 auto; min-width: 0; }
      .d { font-weight: 600; }
      .s { color: var(--ink-3); font-size: var(--fs-sm); }
      .amt { font-weight: 650; font-variant-numeric: tabular-nums; }
      .end { display: grid; justify-items: end; }
      .cb { font-size: var(--fs-xs); color: var(--pos); }
      .hold {
        display: inline-block; margin-right: 4px; padding: 0 6px; border-radius: 999px;
        background: var(--warn-soft); color: var(--warn); font-size: var(--fs-xs); font-weight: 650;
      }
    `,
  ],
})
export class TxRowComponent {
  @Input({ required: true }) tx!: Txn;
  /** 'time' for lists already grouped by day; 'datetime' for mixed lists */
  @Input() dateMode: 'time' | 'datetime' = 'time';

  /** for a transfer, the other party's name as the bank has it */
  protected get payee(): string {
    return payeeOf(this.tx);
  }

  protected get cashback(): string {
    return formatMoney(this.tx.cashback, { decimals: 2 });
  }

  protected get when(): string {
    const time = formatTime(this.tx.date);
    return this.dateMode === 'datetime' ? `${formatShortDate(this.tx.date)}, ${time}` : time;
  }
}
