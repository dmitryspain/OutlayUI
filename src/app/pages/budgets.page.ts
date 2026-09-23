import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BudgetRow, BudgetService } from '../core/budget.service';
import { capitalize, formatMoney } from '../core/format';
import { SessionService } from '../core/session.service';
import { currentLang, localeOf } from '../i18n/lang';
import { TPipe, TpPipe } from '../i18n/pipes';
import { translate } from '../i18n/translate';
import { AvatarComponent } from '../shared/avatar.component';
import { IconComponent } from '../shared/icon.component';
import { MeterComponent } from '../shared/meter.component';
import { MoneyComponent } from '../shared/money.component';
import { EmptyStateComponent, ErrorStateComponent } from '../shared/states.component';

/** '' = the total budget, otherwise a bank category */
type EditKey = string;

@Component({
  selector: 'app-budgets',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, IconComponent, AvatarComponent, MoneyComponent, MeterComponent, EmptyStateComponent, ErrorStateComponent, TPipe, TpPipe],
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">{{ monthName() }}</p>
          <h1 class="page-title">{{ 'nav.budgets' | t }}</h1>
          @if (session.hasCard()) { <p class="page-sub">{{ 'bud.left' | t: { days: (b.month().left | tp: 'plural.days') } }}</p> }
        </div>
      </header>

      @if (!session.hasCard()) {
        <div class="card">
          <app-empty-state icon="wallet" [title]="'common.chooseCard' | t" [text]="'bud.pickCard' | t">
            <a class="btn btn-primary" routerLink="/cards">{{ 'common.toCards' | t }}</a>
          </app-empty-state>
        </div>
      } @else if (b.error() && !b.ready()) {
        <app-error-state [error]="b.error()!" />
      } @else if (!b.ready()) {
        <div class="card" aria-busy="true"><div class="skeleton" style="height: 150px"></div></div>
        <div class="card" aria-busy="true"><div class="skeleton" style="height: 260px"></div></div>
      } @else {
        <section class="card total busy-wrap" [class.busy]="b.loading()" aria-labelledby="tot-h">
          @if (b.total(); as t) {
            <div class="card-head">
              <div><h2 class="card-title" id="tot-h">{{ 'bud.total' | t }}</h2><p class="card-sub">{{ 'bud.total.sub' | t }}</p></div>
              @if (t.limit !== null && editing() !== '') {
                <div class="card-actions">
                  <span class="pill" [class]="pillClass(t.level)">{{ levelText(t.level) }}</span>
                  <button type="button" class="btn btn-ghost btn-icon btn-sm" [attr.aria-label]="'bud.edit' | t" [attr.title]="'bud.edit' | t" (click)="edit('', t.limit)">
                    <app-icon name="sliders" [size]="16" />
                  </button>
                </div>
              }
            </div>

            @if (editing() === '') {
              <ng-container *ngTemplateOutlet="editor; context: { key: '', name: ('bud.total' | t), suggestion: t.suggestion, has: t.limit !== null }" />
            } @else if (t.limit === null) {
              <p class="muted intro">{{ 'bud.intro' | t }}</p>
              <div class="row-wrap">
                <button type="button" class="btn btn-primary" (click)="edit('', t.suggestion)"><app-icon name="plus" [size]="16" /> {{ 'bud.set' | t }}</button>
                @if (t.suggestion) { <span class="muted small">{{ 'bud.suggest' | t: { amount: money(t.suggestion) } }}</span> }
              </div>
            } @else {
              <div class="big">
                <app-money class="spent" [value]="t.spent" [decimals]="0" [animate]="true" />
                <span class="muted">{{ 'bud.of' | t: { limit: money(t.limit) } }}</span>
              </div>
              <app-meter [value]="t.used" [level]="t.level" [pace]="pace()" [height]="12" />
              <div class="facts">
                <span>{{ 'bud.forecast' | t: { amount: money(t.forecast) } }}</span>
                @if (t.spent > t.limit) {
                  <span class="neg">{{ 'bud.overBy' | t: { amount: money(t.spent - t.limit) } }}</span>
                } @else {
                  <span>{{ 'bud.safe' | t: { amount: money(t.safePerDay) } }}</span>
                }
              </div>
              <p class="note">{{ 'bud.paceNote' | t }}</p>
            }
          }
        </section>

        <section class="card busy-wrap" [class.busy]="b.loading()" aria-labelledby="cat-h">
          <div class="card-head">
            <div><h2 class="card-title" id="cat-h">{{ 'bud.cats' | t }}</h2><p class="card-sub">{{ 'bud.cats.sub' | t }}</p></div>
          </div>
          @if (b.limited().length) {
            <ul class="rows">
              @for (r of b.limited(); track r.category) {
                <li class="r">
                  <app-avatar [category]="r.category" [description]="r.label" [size]="40" />
                  <div class="mid">
                    <div class="l1">
                      <span class="name trunc">{{ r.label }}</span>
                      <span class="amt"><app-money [value]="r.spent" [decimals]="0" /> <span class="muted">/ {{ money(r.limit!) }}</span></span>
                    </div>
                    @if (editing() === r.category) {
                      <ng-container *ngTemplateOutlet="editor; context: { key: r.category, name: r.label, suggestion: r.suggestion, has: true }" />
                    } @else {
                      <app-meter [value]="r.used" [level]="r.level" [pace]="pace()" />
                      <div class="l2">
                        <span class="pill" [class]="pillClass(r.level)">{{ levelText(r.level) }}</span>
                        <span class="muted">{{ 'bud.forecast' | t: { amount: money(r.forecast) } }}</span>
                        <button type="button" class="link" (click)="edit(r.category, r.limit)">{{ 'bud.edit' | t }}</button>
                      </div>
                    }
                  </div>
                </li>
              }
            </ul>
          } @else {
            <p class="muted">{{ 'bud.cats.none' | t }}</p>
          }
        </section>

        <section class="card busy-wrap" [class.busy]="b.loading()" aria-labelledby="free-h">
          <div class="card-head">
            <div><h2 class="card-title" id="free-h">{{ 'bud.free' | t }}</h2><p class="card-sub">{{ 'bud.free.sub' | t }}</p></div>
          </div>
          @if (b.unlimited().length) {
            <ul class="rows">
              @for (r of b.unlimited(); track r.category) {
                <li class="r">
                  <app-avatar [category]="r.category" [description]="r.label" [size]="40" />
                  <div class="mid">
                    <div class="l1">
                      <span class="name trunc">{{ r.label }}</span>
                      <app-money class="amt" [value]="r.spent" [decimals]="0" />
                    </div>
                    @if (editing() === r.category) {
                      <ng-container *ngTemplateOutlet="editor; context: { key: r.category, name: r.label, suggestion: r.suggestion, has: false }" />
                    } @else {
                      <div class="l2">
                        @if (r.suggestion) { <span class="muted">{{ 'bud.suggest' | t: { amount: money(r.suggestion) } }}</span> }
                        <button type="button" class="link" (click)="edit(r.category, suggestFor(r))"><app-icon name="plus" [size]="14" /> {{ 'bud.add' | t }}</button>
                      </div>
                    }
                  </div>
                </li>
              }
            </ul>
          } @else {
            <p class="muted">{{ 'bud.free.none' | t }}</p>
          }
        </section>
      }
    </div>

    <ng-template #editor let-key="key" let-name="name" let-suggestion="suggestion" let-has="has">
      <form class="editor" (submit)="save(key, $event)">
        <label class="sr-only" [for]="'lim-' + key">{{ 'bud.limitAria' | t: { name: name } }}</label>
        <div class="in">
          <input
            #inp class="input" type="number" inputmode="numeric" min="1" step="any" [id]="'lim-' + key"
            [value]="draft()" (input)="draft.set(inp.value)" (keydown.escape)="cancel()"
          />
          <span class="cur">₴</span>
        </div>
        <button type="submit" class="btn btn-primary btn-sm">{{ 'bud.save' | t }}</button>
        <button type="button" class="btn btn-ghost btn-sm" (click)="cancel()">{{ 'bud.cancel' | t }}</button>
        @if (suggestion && +draft() !== suggestion) {
          <button type="button" class="btn btn-ghost btn-sm" (click)="draft.set('' + suggestion)">{{ 'bud.useSuggest' | t: { amount: money(suggestion) } }}</button>
        }
        @if (has) {
          <button type="button" class="btn btn-ghost btn-sm danger" (click)="remove(key)">{{ 'bud.remove' | t }}</button>
        }
      </form>
    </ng-template>
  `,
  styles: [
    `
      .total { display: grid; gap: 14px; }
      .intro { max-width: 60ch; }
      .small { font-size: var(--fs-sm); }
      .big { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; }
      .spent { font-size: var(--fs-hero); font-weight: 750; letter-spacing: -.035em; line-height: 1; }
      .facts { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 16px; font-weight: 600; }
      .facts .neg { color: var(--neg); }
      .note { font-size: var(--fs-xs); color: var(--ink-3); }

      .rows { display: grid; gap: 4px; }
      .r { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; }
      .r + .r { border-top: var(--edge-w) solid var(--line, var(--edge)); }
      .mid { display: grid; gap: 8px; flex: 1 1 auto; min-width: 0; }
      .l1 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
      .name { font-weight: 600; }
      .amt { font-weight: 650; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .l2 { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; font-size: var(--fs-sm); }
      .link {
        display: inline-flex; align-items: center; gap: 4px; margin-left: auto; padding: 0;
        color: var(--accent-text); font-weight: 600; font-size: var(--fs-sm);
      }
      .link:hover { text-decoration: underline; }

      .editor { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
      .in { position: relative; flex: 0 1 180px; }
      .in .input { height: 36px; padding-right: 30px; font-variant-numeric: tabular-nums; }
      .cur { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--ink-3); pointer-events: none; }
      .danger { color: var(--neg); }
      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    `,
  ],
})
export class BudgetsPage {
  protected readonly b = inject(BudgetService);
  protected readonly session = inject(SessionService);

  protected readonly editing = signal<EditKey | null>(null);
  protected readonly draft = signal('');

  protected readonly monthName = computed(() =>
    capitalize(new Intl.DateTimeFormat(localeOf(currentLang()), { month: 'long', year: 'numeric' }).format(new Date())),
  );
  protected readonly pace = computed(() => {
    const m = this.b.month();
    return m.day / m.days;
  });

  constructor() {
    this.b.watch();
  }

  protected money(v: number): string {
    return formatMoney(v, { decimals: 0 });
  }

  protected levelText(level: BudgetRow['level']): string {
    return level ? translate(`bud.level.${level}`) : '';
  }
  protected pillClass(level: BudgetRow['level']): string {
    return level === 'over' ? 'pill neg' : level === 'warn' ? 'pill warn' : 'pill pos';
  }

  /** a limit for a category without one: its average, or at least this month's spending */
  protected suggestFor(r: BudgetRow): number | null {
    return r.suggestion ?? (r.spent > 0 ? Math.ceil(r.spent / 100) * 100 : null);
  }

  protected edit(key: EditKey, value: number | null): void {
    this.draft.set(value ? String(value) : '');
    this.editing.set(key);
    // the field appears on the next render
    setTimeout(() => (document.getElementById(`lim-${key}`) as HTMLInputElement | null)?.select());
  }

  protected cancel(): void {
    this.editing.set(null);
  }

  protected save(key: EditKey, e: Event): void {
    e.preventDefault();
    const v = Number(this.draft());
    if (!Number.isFinite(v) || v <= 0) return;
    if (key === '') this.b.setTotal(v);
    else this.b.setLimit(key, v);
    this.editing.set(null);
  }

  protected remove(key: EditKey): void {
    if (key === '') this.b.setTotal(null);
    else this.b.setLimit(key, null);
    this.editing.set(null);
  }
}
