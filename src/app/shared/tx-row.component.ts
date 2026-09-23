import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatShortDate, formatTime } from '../core/format';
import { Txn } from '../core/models';
import { CatPipe } from '../i18n/pipes';
import { AvatarComponent } from './avatar.component';
import { MoneyComponent } from './money.component';

/** One transaction. The whole row is a link to that merchant's history. */
@Component({
  selector: 'app-tx-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, MoneyComponent, RouterLink, CatPipe],
  template: `
    <a class="tx" [routerLink]="['/merchant']" [queryParams]="{ name: tx.description }">
      <app-avatar [category]="tx.category" [description]="tx.description" [icon]="tx.icon" [size]="40" />
      <span class="main">
        <span class="d trunc">{{ tx.description }}</span>
        <span class="s trunc">{{ tx.category | cat }} · {{ when }}</span>
      </span>
      <app-money class="amt" [value]="tx.amount" [signed]="true" tone="sign" [decimals]="2" />
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
    `,
  ],
})
export class TxRowComponent {
  @Input({ required: true }) tx!: Txn;
  /** 'time' for lists already grouped by day; 'datetime' for mixed lists */
  @Input() dateMode: 'time' | 'datetime' = 'time';

  protected get when(): string {
    const time = formatTime(this.tx.date);
    return this.dateMode === 'datetime' ? `${formatShortDate(this.tx.date)}, ${time}` : time;
  }
}
