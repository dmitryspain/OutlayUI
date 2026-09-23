import { ChangeDetectionStrategy, Component, VERSION, computed, inject } from '@angular/core';
import { API_BASE_URL } from '../core/config';
import { relativeTime } from '../core/format';
import { errorText } from '../i18n/errors';
import { I18nService } from '../i18n/i18n.service';
import { LANGS } from '../i18n/lang';
import { TPipe } from '../i18n/pipes';
import { translate } from '../i18n/translate';
import { Density, Motion, PrefsService } from '../core/prefs.service';
import { LiveService } from '../core/live.service';
import { SessionService } from '../core/session.service';
import { SyncService } from '../core/sync.service';
import { ACCENT_PRESETS, DEFAULT_HUES, THEMES, ThemeChoice } from '../core/themes';
import { ToastService } from '../core/toast.service';
import { ConnectPanelComponent } from '../shared/connect-panel.component';
import { HistoryLoaderComponent } from '../shared/history-loader.component';
import { IconComponent } from '../shared/icon.component';
import { SegmentedComponent } from '../shared/segmented.component';
import { ThemePreviewComponent } from '../shared/theme-preview.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SegmentedComponent, ThemePreviewComponent, ConnectPanelComponent, TPipe, HistoryLoaderComponent],
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">{{ 'st.eyebrow' | t }}</p>
          <h1 class="page-title">{{ 'nav.settings' | t }}</h1>
        </div>
      </header>

      <section class="card" aria-labelledby="lg-h">
        <div class="setting">
          <div>
            <h2 class="card-title" id="lg-h">{{ 'st.lang.title' | t }}</h2>
            <p class="muted">{{ 'st.lang.text' | t }}</p>
          </div>
          <app-segmented [options]="langOptions" [value]="i18n.lang()" [label]="'st.lang.aria' | t" (valueChange)="i18n.setLang($any($event))" />
        </div>
      </section>

      <section class="card" aria-labelledby="th-h">
        <div class="card-head">
          <div>
            <h2 class="card-title" id="th-h">{{ 'st.theme.title' | t }}</h2>
            <p class="card-sub">{{ 'st.theme.text' | t }}</p>
          </div>
        </div>

        <div class="themes" role="radiogroup" [attr.aria-label]="'st.theme.title' | t">
          @for (t of themes; track t.id) {
            <button type="button" role="radio" class="theme" [attr.aria-checked]="prefs.theme() === t.id" (click)="pickTheme(t.id, $event)">
              <app-theme-preview [theme]="t.id" />
              <span class="tn"><strong>{{ t.name }}</strong><span class="muted">{{ t.tagline | t }}</span></span>
            </button>
          }
          <button type="button" role="radio" class="theme" [attr.aria-checked]="prefs.theme() === 'auto'" (click)="pickTheme('auto', $event)">
            <app-theme-preview theme="auto" />
            <span class="tn"><strong>{{ 'st.theme.auto' | t }}</strong><span class="muted">{{ 'st.theme.autoDesc' | t }}</span></span>
          </button>
        </div>

        <hr class="hr sep" />

        <div class="setting col">
          <div>
            <h3>{{ 'st.accent.title' | t }}</h3>
            <p class="muted">{{ 'st.accent.text' | t }}</p>
          </div>
          <div class="swatches" role="group" [attr.aria-label]="'st.accent.title' | t">
            <button type="button" class="sw reset" [attr.aria-pressed]="prefs.accent() === null" [attr.title]="'st.accent.reset' | t" [attr.aria-label]="'st.accent.resetAria' | t" (click)="prefs.setAccent(null)">
              <app-icon name="refresh" [size]="16" />
            </button>
            @for (a of accents; track a.hue) {
              <button type="button" class="sw" [style.--h]="a.hue" [attr.aria-pressed]="prefs.accent() === a.hue" [attr.title]="a.name | t" [attr.aria-label]="a.name | t" (click)="prefs.setAccent(a.hue)"></button>
            }
          </div>
          <input type="range" class="range hue" min="0" max="360" step="1" [attr.aria-label]="'st.accent.hueAria' | t" [value]="hue()" (input)="prefs.setAccent(+val($event))" />
        </div>

        <hr class="hr sep" />

        <div class="setting">
          <div><h3>{{ 'st.density.title' | t }}</h3><p class="muted">{{ 'st.density.text' | t }}</p></div>
          <app-segmented [options]="densityOptions()" [value]="prefs.density()" [label]="'st.density.title' | t" (valueChange)="prefs.setDensity($any($event))" />
        </div>
        <div class="setting">
          <div><h3>{{ 'st.motion.title' | t }}</h3><p class="muted">{{ 'st.motion.text' | t }}</p></div>
          <app-segmented [options]="motionOptions()" [value]="prefs.motion()" [label]="'st.motion.title' | t" (valueChange)="prefs.setMotion($any($event))" />
        </div>
        <div class="setting">
          <div><h3>{{ 'st.privacy.title' | t }}</h3><p class="muted">{{ 'st.privacy.text' | t }}</p></div>
          <input type="checkbox" class="switch" role="switch" [attr.aria-label]="'st.privacy.title' | t" [checked]="prefs.privacy()" (change)="prefs.setPrivacy(checked($event))" />
        </div>
      </section>

      <section class="card" aria-labelledby="mb-h">
        <div class="card-head"><div><h2 class="card-title" id="mb-h">Monobank</h2><p class="card-sub">{{ 'st.mono.sub' | t }}</p></div></div>

        @if (session.savedToken()) {
          <div class="callout">
            <app-icon name="shield" [size]="20" />
            <div class="grow">
              <p><strong>{{ 'st.mono.saved' | t }}</strong> · <code>{{ masked() }}</code></p>
              <p class="muted">{{ 'st.mono.savedNote' | t }}</p>
            </div>
            <button type="button" class="btn btn-sm btn-danger" (click)="disconnect()"><app-icon name="log-out" [size]="16" /> {{ 'st.mono.disconnect' | t }}</button>
          </div>
          <details class="replace">
            <summary>{{ 'st.mono.replace' | t }}</summary>
            <app-connect-panel />
          </details>
        } @else {
          <app-connect-panel />
        }
      </section>

      <section class="card" aria-labelledby="lv-h">
        <div class="card-head"><div><h2 class="card-title" id="lv-h">{{ 'st.live.title' | t }}</h2><p class="card-sub">{{ 'st.live.text' | t }}</p></div></div>

        <div class="setting">
          <div>
            <h3>Webhook</h3>
            <p class="muted">
              @if (session.demo() || !session.connected()) {
                {{ 'st.live.unavailable' | t }}
              } @else if (live.webhook()?.enabled) {
                {{ 'st.live.on' | t }} · {{ (live.connected() ? 'st.live.streamOn' : 'st.live.streamOff') | t }}
              } @else if (live.webhook() && !live.webhook()!.configured) {
                {{ 'st.live.notConfigured' | t }}
              } @else {
                {{ (live.connected() ? 'st.live.streamOn' : 'st.live.streamOff') | t }}
              }
            </p>
          </div>
          @if (live.webhook()?.enabled) {
            <span class="pill pos"><app-icon name="zap" [size]="14" /> {{ 'st.live.on' | t }}</span>
          } @else {
            <button
              type="button" class="btn btn-sm btn-primary" (click)="live.enableWebhook()"
              [disabled]="live.enabling() || session.demo() || !session.connected() || live.webhook()?.configured === false"
            >
              <app-icon name="zap" [size]="16" /> {{ 'st.live.enable' | t }}
            </button>
          }
        </div>
        <div class="setting col">
          <div>
            <h3>{{ 'st.hist.title' | t }}</h3>
            <p class="muted">{{ 'st.hist.text' | t }}</p>
          </div>
          <app-history-loader />
        </div>
      </section>

      <section class="card" aria-labelledby="dt-h">
        <div class="card-head"><div><h2 class="card-title" id="dt-h">{{ 'st.data.title' | t }}</h2></div></div>

        <div class="setting">
          <div>
            <h3>{{ 'st.demo.title' | t }}</h3>
            <p class="muted">{{ 'st.demo.text' | t }}</p>
          </div>
          <input type="checkbox" class="switch" role="switch" [attr.aria-label]="'st.demo.title' | t" [checked]="prefs.demo()" (change)="prefs.setDemo(checked($event))" />
        </div>
        <div class="setting">
          <div>
            <h3>{{ 'st.transfers.title' | t }}</h3>
            <p class="muted">{{ 'st.transfers.text' | t }}</p>
          </div>
          <input type="checkbox" class="switch" role="switch" [attr.aria-label]="'st.transfers.title' | t" [checked]="prefs.transfers()" (change)="prefs.setTransfers(checked($event))" />
        </div>
        <div class="setting">
          <div>
            <h3>{{ 'st.sync.title' | t }}</h3>
            <p class="muted">{{ syncText() }}</p>
          </div>
          <button type="button" class="btn btn-sm" (click)="sync.refresh()" [disabled]="sync.syncing() || !session.hasCard()">
            <app-icon name="refresh" [size]="16" /> {{ 'st.sync.now' | t }}
          </button>
        </div>
      </section>

      <section class="card" aria-labelledby="ab-h">
        <div class="card-head"><div><h2 class="card-title" id="ab-h">{{ 'st.about.title' | t }}</h2></div></div>
        <dl class="about">
          <dt>{{ 'st.about.keys' | t }}</dt>
          <dd><kbd class="kbd">{{ mod }}</kbd> <kbd class="kbd">K</kbd> {{ 'st.about.palette' | t }} · <kbd class="kbd">/</kbd> {{ 'st.about.search' | t }} · <kbd class="kbd">Esc</kbd> {{ 'st.about.close' | t }}</dd>
          <dt>{{ 'st.about.backend' | t }}</dt>
          <dd><code>{{ api }}</code></dd>
          <dt>{{ 'st.about.version' | t }}</dt>
          <dd>Angular {{ ng }}</dd>
        </dl>
      </section>
    </div>
  `,
  styles: [
    `
      .themes { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr)); gap: 16px; }
      .theme {
        display: grid; gap: 10px; padding: 10px; text-align: left;
        border: var(--edge-w) solid var(--edge); border-radius: var(--radius-l); background: var(--surface-2);
        transition: transform var(--dur-2) var(--ease), box-shadow var(--dur-2) var(--ease), border-color var(--dur-1) var(--ease);
      }
      .theme:hover { transform: translateY(-2px); border-color: var(--edge-strong); }
      .theme[aria-checked='true'] { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
      .tn { display: grid; gap: 2px; padding: 0 4px 4px; }
      .tn .muted { font-size: var(--fs-xs); }
      .sep { margin: 20px 0; }
      .setting { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 10px 0; }
      .setting.col { flex-direction: column; align-items: stretch; gap: 14px; }
      .setting h3 { font-size: var(--fs-md); }
      .setting p { margin-top: 2px; max-width: 62ch; font-size: var(--fs-sm); }
      .swatches { display: flex; flex-wrap: wrap; gap: 10px; }
      .sw {
        display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%;
        background: oklch(var(--accent-l) var(--accent-c) var(--h, 0)); box-shadow: 0 0 0 1px var(--line-strong);
        transition: transform var(--dur-1) var(--ease);
      }
      .sw:hover { transform: scale(1.1); }
      .sw[aria-pressed='true'] { outline: 2px solid var(--ink); outline-offset: 3px; }
      .sw.reset { background: var(--surface-3); color: var(--ink-2); }
      .hue {
        --range-track: linear-gradient(90deg, oklch(.78 .16 0), oklch(.78 .16 60), oklch(.78 .16 120), oklch(.78 .16 180), oklch(.78 .16 240), oklch(.78 .16 300), oklch(.78 .16 360));
      }
      .replace { margin-top: 14px; }
      .replace summary { cursor: pointer; font-weight: 600; color: var(--accent-text); padding: 6px 0; }
      .replace app-connect-panel { display: block; margin-top: 12px; }
      code { font: 600 .9em var(--font-mono); }
      .about { display: grid; grid-template-columns: max-content 1fr; gap: 10px 24px; }
      .about dt { color: var(--ink-3); }
      .about dd { margin: 0; overflow-wrap: anywhere; }
      @media (max-width: 719px) { .setting { flex-wrap: wrap; } .about { grid-template-columns: 1fr; gap: 2px; } .about dd { margin-bottom: 10px; } }
    `,
  ],
})
export class SettingsPage {
  protected readonly prefs = inject(PrefsService);
  protected readonly session = inject(SessionService);
  protected readonly sync = inject(SyncService);
  protected readonly live = inject(LiveService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  /** each language is written in its own language, whatever the current one is */
  protected readonly langOptions = LANGS.map(l => ({ value: l.id, label: l.name }));
  protected readonly themes = THEMES;
  protected readonly accents = ACCENT_PRESETS;
  protected readonly api = inject(API_BASE_URL);
  protected readonly ng = VERSION.full;
  protected readonly mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

  protected readonly densityOptions = computed<{ value: Density; label: string }[]>(() => [
    { value: 'comfortable', label: translate('st.density.comfortable') },
    { value: 'compact', label: translate('st.density.compact') },
  ]);
  protected readonly motionOptions = computed<{ value: Motion; label: string }[]>(() => [
    { value: 'system', label: translate('st.motion.system') },
    { value: 'reduced', label: translate('st.motion.reduced') },
  ]);

  protected readonly hue = computed(() => this.prefs.accent() ?? DEFAULT_HUES[this.prefs.resolvedTheme()]);
  protected readonly masked = computed(() => {
    const t = this.session.savedToken();
    return t.length > 8 ? `${t.slice(0, 2)}••••••••${t.slice(-3)}` : '••••••';
  });
  protected readonly syncText = computed(() => {
    if (this.sync.syncing()) return translate('top.syncing');
    const err = this.sync.lastError();
    if (err) return translate('st.sync.failed', { error: errorText(err) });
    const t = this.sync.lastSync();
    return t ? translate('st.sync.last', { when: relativeTime(t) }) : translate('st.sync.never');
  });

  protected pickTheme(choice: ThemeChoice, e: MouseEvent): void {
    // the theme grows out of the card you clicked
    this.prefs.setTheme(choice, { x: e.clientX, y: e.clientY });
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }
  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  protected disconnect(): void {
    this.session.disconnect();
    this.toast.show(translate('st.mono.removed'));
  }
}
