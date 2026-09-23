import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardsService } from '../core/cards.service';
import { relativeTime } from '../core/format';
import { PrefsService } from '../core/prefs.service';
import { SessionService } from '../core/session.service';
import { SyncService } from '../core/sync.service';
import { THEMES, ThemeChoice } from '../core/themes';
import { UiService } from '../core/ui.service';
import { TPipe } from '../i18n/pipes';
import { translate } from '../i18n/translate';
import { ClickOutsideDirective } from '../shared/click-outside.directive';
import { IconComponent } from '../shared/icon.component';
import { LogoComponent } from '../shared/logo.component';

/** Utility bar: search / command palette, sync status, privacy, theme. */
@Component({
  selector: 'app-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LogoComponent, RouterLink, ClickOutsideDirective, TPipe],
  template: `
    <header class="bar">
      <a class="mini-brand" routerLink="/home" aria-label="Outlay"><app-logo [size]="30" /></a>

      <button type="button" class="search" (click)="ui.openPalette()" [attr.aria-label]="'top.searchAria' | t">
        <app-icon name="search" [size]="18" />
        <span class="ph">{{ 'top.searchPlaceholder' | t }}</span>
        <span class="keys"><kbd class="kbd">{{ mod }}</kbd><kbd class="kbd">K</kbd></span>
      </button>

      <div class="actions">
        <button type="button" class="btn btn-ghost btn-sm sync" (click)="sync.refresh()" [disabled]="sync.syncing() || !session.hasCard()" [attr.aria-label]="'top.syncAria' | t: { status: syncText() }">
          <app-icon name="refresh" [size]="17" [class.spin]="sync.syncing()" />
          <span class="st" [class.err]="!!sync.lastError()">{{ syncText() }}</span>
        </button>

        <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="prefs.togglePrivacy()" [attr.aria-pressed]="prefs.privacy()" [attr.title]="(prefs.privacy() ? 'top.privacyShow' : 'top.privacyHide') | t" [attr.aria-label]="(prefs.privacy() ? 'top.privacyShow' : 'top.privacyHide') | t">
          <app-icon [name]="prefs.privacy() ? 'eye-off' : 'eye'" [size]="18" />
        </button>

        <div class="pop" (appClickOutside)="menu.set(false)">
          <button type="button" class="btn btn-ghost btn-icon btn-sm" aria-haspopup="menu" [attr.aria-expanded]="menu()" [attr.aria-label]="'top.theme' | t" [attr.title]="'top.theme' | t" (click)="toggleMenu()">
            <app-icon name="palette" [size]="18" />
          </button>
          @if (menu()) {
            <div class="pop-panel" role="menu" [attr.aria-label]="'top.theme' | t">
              @for (t of themes; track t.id) {
                <button type="button" class="menu-item" role="menuitemradio" [attr.aria-checked]="prefs.theme() === t.id" (click)="pick(t.id, $event)">
                  <i class="sw" [attr.data-theme]="t.id"></i>{{ t.name }}
                  @if (prefs.theme() === t.id) { <app-icon class="end" name="check" [size]="16" /> }
                </button>
              }
              <div class="menu-sep"></div>
              <button type="button" class="menu-item" role="menuitemradio" [attr.aria-checked]="prefs.theme() === 'auto'" (click)="pick('auto', $event)">
                <app-icon name="contrast" [size]="18" />{{ 'top.themeAuto' | t }}
                @if (prefs.theme() === 'auto') { <app-icon class="end" name="check" [size]="16" /> }
              </button>
              <div class="menu-sep"></div>
              <a class="menu-item" routerLink="/settings" (click)="menu.set(false)"><app-icon name="sliders" [size]="18" />{{ 'top.themeAll' | t }}</a>
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      :host { display: block; position: sticky; top: 0; z-index: 25; }
      .bar {
        display: flex; align-items: center; gap: 12px; height: var(--bar-h);
        padding: 0 clamp(16px, 3vw, 32px);
        background: color-mix(in srgb, var(--bg) 72%, transparent);
        -webkit-backdrop-filter: blur(14px) saturate(140%); backdrop-filter: blur(14px) saturate(140%);
      }
      .mini-brand { display: none; }
      .search {
        display: flex; align-items: center; gap: 10px; flex: 0 1 380px; min-width: 0; height: 40px; padding: 0 12px;
        border: var(--edge-w) solid var(--edge); border-radius: var(--radius-m); background: var(--surface);
        color: var(--ink-3); text-align: left; transition: background var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease);
      }
      .search:hover { background: var(--surface-2); border-color: var(--edge-strong); }
      .ph { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .keys { display: flex; gap: 4px; }
      .actions { display: flex; align-items: center; gap: 4px; margin-left: auto; }
      .st { font-size: var(--fs-xs); color: var(--ink-3); font-weight: 600; }
      .st.err { color: var(--neg); }
      .sync { gap: 6px; }
      .spin { animation: spin 900ms linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .sw {
        display: inline-block; width: 18px; height: 18px; border-radius: 50%;
        background: conic-gradient(var(--accent) 0 50%, var(--bg) 50% 100%); box-shadow: 0 0 0 1px var(--line-strong);
      }
      @media (max-width: 719px) {
        .mini-brand { display: inline-flex; }
        .search { flex: 1 1 auto; }
        .keys, .st { display: none; }
        .sync { padding: 0; width: 32px; }
      }
    `,
  ],
})
export class TopbarComponent {
  protected readonly ui = inject(UiService);
  protected readonly prefs = inject(PrefsService);
  protected readonly sync = inject(SyncService);
  protected readonly session = inject(SessionService);
  protected readonly cards = inject(CardsService);

  protected readonly themes = THEMES;
  protected readonly menu = signal(false);
  protected readonly mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

  private readonly now = signal(new Date());
  protected readonly syncText = computed(() => {
    if (this.sync.syncing()) return translate('top.syncing');
    if (this.sync.lastError()) return translate('top.syncError');
    const t = this.sync.lastSync();
    return t ? translate('top.syncUpdated', { when: relativeTime(t, this.now()) }) : translate('top.syncIdle');
  });

  constructor() {
    setInterval(() => this.now.set(new Date()), 30_000);
  }

  protected toggleMenu(): void {
    this.menu.update(open => !open);
  }

  protected pick(choice: ThemeChoice, e: MouseEvent): void {
    // the new theme grows out of the clicked item
    this.prefs.setTheme(choice, { x: e.clientX, y: e.clientY });
    this.menu.set(false);
  }
}
