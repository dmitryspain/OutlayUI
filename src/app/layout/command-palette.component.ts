import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { categoryMeta } from '../core/category';
import { CardsService } from '../core/cards.service';
import { FeedService } from '../core/feed.service';
import { cardTag, formatMoney } from '../core/format';
import { PERIOD_PRESETS, PeriodService } from '../core/period.service';
import { PrefsService } from '../core/prefs.service';
import { SessionService } from '../core/session.service';
import { SyncService } from '../core/sync.service';
import { THEMES } from '../core/themes';
import { UiService } from '../core/ui.service';
import { TPipe } from '../i18n/pipes';
import { translate } from '../i18n/translate';
import { IconComponent } from '../shared/icon.component';
import { IconName } from '../shared/icons';

type Group = 'pal.group.go' | 'pal.group.actions' | 'pal.group.merchants' | 'pal.group.cards' | 'pal.group.period' | 'pal.group.theme';

interface Command {
  id: string;
  group: Group;
  label: string;
  hint?: string;
  icon: IconName;
  keywords?: string;
  run: () => void;
}

const GROUP_ORDER: Group[] = ['pal.group.go', 'pal.group.actions', 'pal.group.merchants', 'pal.group.cards', 'pal.group.period', 'pal.group.theme'];

/** Fuzzy score: substring beats subsequence; 0 = no match. */
function score(query: string, text: string): number {
  const t = text.toLowerCase();
  const at = t.indexOf(query);
  if (at >= 0) return 100 - Math.min(at, 60) + (at === 0 ? 20 : 0);
  let i = 0;
  for (const ch of t) if (ch === query[i] && ++i === query.length) return 25;
  return 0;
}

/** ⌘K / Ctrl+K: jump anywhere, run actions, switch theme or card, find a merchant. */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  host: { '(document:keydown)': 'onGlobalKey($event)' },
  template: `
    <dialog #dlg class="sheet palette" [attr.aria-label]="'top.searchAria' | t" (close)="ui.paletteOpen.set(false)" (click)="onBackdrop($event)">
      <div class="search">
        <app-icon name="search" [size]="20" />
        <input
          #input
          class="q"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="cmd-list"
          autocomplete="off"
          spellcheck="false"
          [attr.placeholder]="'pal.placeholder' | t"
          [attr.aria-activedescendant]="rows().length ? 'cmd-' + active() : null"
          [value]="q()"
          (input)="onInput($event)"
          (keydown)="onKey($event)"
        />
        <kbd class="kbd">Esc</kbd>
      </div>

      <ul id="cmd-list" role="listbox" [attr.aria-label]="'pal.results' | t">
        @for (r of rows(); track r.cmd.id) {
          @if (r.header) { <li class="gh" role="presentation">{{ r.header | t }}</li> }
          <li role="option" [id]="'cmd-' + r.i" [attr.aria-selected]="r.i === active()" [class.on]="r.i === active()" (mousemove)="active.set(r.i)" (click)="run(r.cmd)">
            <span class="ic"><app-icon [name]="r.cmd.icon" [size]="18" /></span>
            <span class="lb">{{ r.cmd.label }}</span>
            @if (r.cmd.hint) { <span class="hint">{{ r.cmd.hint }}</span> }
            @if (q()) { <span class="grp">{{ r.cmd.group | t }}</span> }
          </li>
        } @empty {
          <li class="none" role="presentation">{{ 'pal.none' | t: { q: q() } }}</li>
        }
      </ul>

      <footer>
        <span><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd> {{ 'pal.select' | t }}</span>
        <span><kbd class="kbd">↵</kbd> {{ 'pal.run' | t }}</span>
      </footer>
    </dialog>
  `,
  styles: [
    `
      dialog.palette { margin-top: 12vh; width: min(620px, calc(100vw - 24px)); }
      .search { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--line); color: var(--ink-3); }
      .q { flex: 1 1 auto; min-width: 0; height: 28px; border: 0; outline: 0; background: transparent; color: var(--ink); font-size: var(--fs-lg); }
      .q::placeholder { color: var(--ink-3); }
      ul { max-height: min(52vh, 440px); overflow: auto; padding: 6px; scroll-padding: 6px; }
      li { list-style: none; }
      .gh { padding: 10px 12px 4px; font-size: var(--fs-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
      li[role='option'] { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--radius-m); cursor: pointer; }
      li.on { background: var(--accent-soft); }
      .ic { display: grid; place-items: center; width: 30px; height: 30px; border-radius: var(--radius-s); background: var(--surface-2); color: var(--ink-2); }
      li.on .ic { color: var(--accent-text); }
      .lb { flex: 1 1 auto; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .hint, .grp { color: var(--ink-3); font-size: var(--fs-sm); white-space: nowrap; }
      .grp { padding: 1px 8px; border-radius: 999px; background: var(--surface-2); font-size: var(--fs-xs); }
      .none { padding: 28px 12px; text-align: center; color: var(--ink-3); }
      footer { display: flex; gap: 16px; padding: 10px 16px; border-top: 1px solid var(--line); color: var(--ink-3); font-size: var(--fs-xs); }
      footer span { display: inline-flex; align-items: center; gap: 4px; }
      @media (max-width: 719px) { dialog.palette { margin-top: 8vh; } footer { display: none; } }
    `,
  ],
})
export class CommandPaletteComponent {
  protected readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly prefs = inject(PrefsService);
  private readonly cards = inject(CardsService);
  private readonly session = inject(SessionService);
  private readonly sync = inject(SyncService);
  private readonly feed = inject(FeedService);
  private readonly period = inject(PeriodService);

  @ViewChild('dlg', { static: true }) private dlg!: ElementRef<HTMLDialogElement>;
  @ViewChild('input', { static: true }) private input!: ElementRef<HTMLInputElement>;

  protected readonly q = signal('');
  protected readonly active = signal(0);

  private readonly go = (path: string) => () => void this.router.navigateByUrl(path);

  private readonly base = computed<Command[]>(() => {
    const cmds: Command[] = [
      { id: 'go-home', group: 'pal.group.go', label: translate('nav.overview'), icon: 'dashboard', keywords: 'home головна dashboard', run: this.go('/home') },
      { id: 'go-tx', group: 'pal.group.go', label: translate('nav.transactions'), icon: 'list', keywords: 'transactions операції', run: this.go('/transactions') },
      { id: 'go-weekly', group: 'pal.group.go', label: translate('nav.weekly'), icon: 'calendar', keywords: 'weekly дні тижня календар', run: this.go('/weekly') },
      { id: 'go-budgets', group: 'pal.group.go', label: translate('nav.budgets'), icon: 'wallet', keywords: 'budgets бюджет ліміт limit', run: this.go('/budgets') },
      { id: 'go-subs', group: 'pal.group.go', label: translate('nav.subs'), icon: 'repeat', keywords: 'subscriptions підписки регулярні recurring', run: this.go('/subscriptions') },
      { id: 'go-cards', group: 'pal.group.go', label: translate('nav.cards'), icon: 'card', keywords: 'cards обрати карту', run: this.go('/cards') },
      { id: 'go-settings', group: 'pal.group.go', label: translate('nav.settings'), icon: 'sliders', keywords: 'settings токен тема вигляд', run: this.go('/settings') },
      { id: 'sync', group: 'pal.group.actions', label: translate('pal.sync'), icon: 'refresh', keywords: 'оновити refresh sync', run: () => this.sync.refresh() },
      {
        id: 'privacy', group: 'pal.group.actions', icon: this.prefs.privacy() ? 'eye' : 'eye-off', keywords: 'privacy приватність сховати суми blur',
        label: translate(this.prefs.privacy() ? 'top.privacyShow' : 'top.privacyHide'), run: () => this.prefs.togglePrivacy(),
      },
      {
        id: 'transfers', group: 'pal.group.actions', icon: 'transfer', keywords: 'перекази transfers кредит',
        label: translate(this.prefs.transfers() ? 'pal.transfersOff' : 'pal.transfersOn'),
        run: () => this.prefs.setTransfers(!this.prefs.transfers()),
      },
    ];
    for (const t of THEMES) {
      cmds.push({ id: `theme-${t.id}`, group: 'pal.group.theme', label: translate('pal.theme', { name: t.name }), hint: translate(t.scheme === 'dark' ? 'pal.dark' : 'pal.light'), icon: t.scheme === 'dark' ? 'moon' : 'sun', keywords: 'theme тема вигляд', run: () => this.prefs.setTheme(t.id) });
    }
    cmds.push({ id: 'theme-auto', group: 'pal.group.theme', label: translate('pal.themeAuto'), hint: translate('pal.followsSystem'), icon: 'contrast', keywords: 'theme тема система', run: () => this.prefs.setTheme('auto') });
    for (const p of PERIOD_PRESETS) {
      cmds.push({ id: `period-${p.value}`, group: 'pal.group.period', label: translate('pal.period', { name: translate(p.label) }), icon: 'calendar', keywords: 'period період діапазон дата', run: () => this.period.select(p.value) });
    }
    for (const c of this.cards.cards()) {
      cmds.push({
        id: `card-${c.id}`, group: 'pal.group.cards', icon: 'card', keywords: 'card картка',
        label: translate('pal.card', { name: cardTag(c.type, c.maskedNumber) }),
        hint: c.id === this.session.cardId() ? translate('pal.active') : '', run: () => this.session.setCard(c.id),
      });
    }
    return cmds;
  });

  protected readonly rows = computed(() => {
    const q = this.q().trim().toLowerCase();
    let list: Command[];
    if (!q) {
      list = [...this.base()].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
    } else {
      const merchants: Command[] = this.feed
        .expensesByMerchant()
        .filter(m => m.label.toLowerCase().includes(q))
        .slice(0, 5)
        .map(m => ({
          id: `m-${m.key}`, group: 'pal.group.merchants' as const, label: m.label, hint: formatMoney(m.amount, { decimals: 0 }),
          icon: categoryMeta(m.category, m.label).icon,
          run: () => void this.router.navigate(['/merchant'], { queryParams: { name: m.label } }),
        }));
      list = [...this.base(), ...merchants]
        .map(c => ({ c, s: score(q, `${c.label} ${c.keywords ?? ''}`) }))
        .filter(x => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 12)
        .map(x => x.c);
    }
    return list.map((cmd, i) => ({
      cmd, i, header: !q && (i === 0 || list[i - 1].group !== cmd.group) ? cmd.group : null,
    }));
  });

  constructor() {
    effect(
      () => {
        const open = this.ui.paletteOpen();
        const el = this.dlg.nativeElement;
        if (open && !el.open) {
          // start every session with a clean query (this effect writes signals, hence allowSignalWrites)
          this.q.set('');
          this.active.set(0);
          el.showModal();
          this.input.nativeElement.focus();
        } else if (!open && el.open) {
          el.close();
        }
      },
      { allowSignalWrites: true },
    );
  }

  protected onGlobalKey(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.ui.togglePalette();
      return;
    }
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (e.key === '/' && !typing && !this.ui.paletteOpen()) {
      e.preventDefault();
      this.ui.openPalette();
    }
  }

  protected onInput(e: Event): void {
    this.q.set((e.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.rows().length;
    if (!n) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.active.update(i => (i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
      queueMicrotask(() => this.dlg.nativeElement.querySelector('li.on')?.scrollIntoView({ block: 'nearest' }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = this.rows()[this.active()];
      if (r) this.run(r.cmd);
    }
  }

  protected run(cmd: Command): void {
    this.ui.paletteOpen.set(false);
    cmd.run();
  }

  protected onBackdrop(e: MouseEvent): void {
    if (e.target === this.dlg.nativeElement) this.ui.paletteOpen.set(false);
  }
}
