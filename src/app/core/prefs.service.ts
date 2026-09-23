import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Lang, currentLang, isLang } from '../i18n/lang';
import { AUTO_DARK, AUTO_LIGHT, THEMES, ThemeChoice, ThemeId } from './themes';

export type Density = 'comfortable' | 'compact';
export type Motion = 'system' | 'reduced';
export type PeriodPreset = '7d' | '30d' | '90d' | 'month' | 'prev-month' | 'custom';

export interface PeriodPref {
  preset: PeriodPreset;
  /** yyyy-MM-dd, only for `custom` */
  from?: string;
  to?: string;
}

interface Stored {
  /** interface language */
  lang: Lang;
  theme: ThemeChoice;
  /** OKLCH hue override, null = the theme's own accent */
  accent: number | null;
  density: Density;
  privacy: boolean;
  motion: Motion;
  demo: boolean;
  demoCard: string;
  /** count person-to-person transfers & loan payments in the numbers */
  transfers: boolean;
  period: PeriodPref;
}

const KEY = 'outlay.prefs.v1';
const DEFAULTS: Stored = {
  lang: 'uk',
  theme: 'auto',
  accent: null,
  density: 'comfortable',
  privacy: false,
  motion: 'system',
  demo: false,
  demoCard: '',
  transfers: true,
  period: { preset: '30d' },
};

type ViewTransitionLike = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> };
type DocWithVT = Document & { startViewTransition?: (update: () => void) => ViewTransitionLike };

function load(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Stored>;
    const s = { ...DEFAULTS, ...raw };
    if (s.theme !== 'auto' && !THEMES.some(t => t.id === s.theme)) s.theme = 'auto';
    if (typeof s.accent !== 'number') s.accent = null;
    if (!isLang(s.lang)) s.lang = 'uk';
    return s;
  } catch {
    return { ...DEFAULTS };
  }
}

/** User preferences. Persisted, and mirrored onto <html> as data-attributes that the CSS reads. */
@Injectable({ providedIn: 'root' })
export class PrefsService {
  private readonly doc = inject(DOCUMENT);
  private readonly win = this.doc.defaultView as Window;
  private readonly init = load();

  /** The interface language — the shared signal that the formatters and the `t` pipe read. */
  readonly lang = currentLang.asReadonly();
  readonly theme = signal<ThemeChoice>(this.init.theme);
  readonly accent = signal<number | null>(this.init.accent);
  readonly density = signal<Density>(this.init.density);
  readonly privacy = signal(this.init.privacy);
  readonly motion = signal<Motion>(this.init.motion);
  readonly demo = signal(this.init.demo);
  readonly demoCard = signal(this.init.demoCard);
  readonly transfers = signal(this.init.transfers);
  readonly period = signal<PeriodPref>(this.init.period);

  private readonly systemDark = signal(this.win.matchMedia('(prefers-color-scheme: dark)').matches);
  /** The theme actually on screen ("auto" follows the operating system). */
  readonly resolvedTheme = computed<ThemeId>(() => {
    const t = this.theme();
    return t === 'auto' ? (this.systemDark() ? AUTO_DARK : AUTO_LIGHT) : t;
  });

  constructor() {
    currentLang.set(this.init.lang);
    this.win.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => this.systemDark.set(e.matches));
    effect(() => {
      this.applyDom();
      this.save();
    });
  }

  /** Switch theme; with View Transitions the new theme is revealed as a circle growing from `origin`. */
  setTheme(choice: ThemeChoice, origin?: { x: number; y: number }): void {
    if (choice === this.theme()) return;
    this.transition(() => this.theme.set(choice), origin);
  }

  setLang(lang: Lang): void { currentLang.set(lang); }
  setAccent(hue: number | null): void { this.accent.set(hue); }
  setDensity(v: Density): void { this.density.set(v); }
  setMotion(v: Motion): void { this.motion.set(v); }
  setPrivacy(v: boolean): void { this.privacy.set(v); }
  togglePrivacy(): void { this.privacy.update(v => !v); }
  setDemo(v: boolean): void { this.demo.set(v); }
  setDemoCard(id: string): void { this.demoCard.set(id); }
  setTransfers(v: boolean): void { this.transfers.set(v); }
  setPeriod(p: PeriodPref): void { this.period.set(p); }

  reducedMotion(): boolean {
    return this.motion() === 'reduced' || this.win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private transition(mutate: () => void, origin?: { x: number; y: number }): void {
    const doc = this.doc as DocWithVT;
    if (!doc.startViewTransition || this.reducedMotion()) {
      mutate();
      this.applyDom();
      return;
    }
    const root = doc.documentElement;
    const x = origin?.x ?? this.win.innerWidth / 2;
    const y = origin?.y ?? this.win.innerHeight / 2;
    const radius = Math.hypot(Math.max(x, this.win.innerWidth - x), Math.max(y, this.win.innerHeight - y));

    root.classList.add('theme-vt');
    // the new snapshot is taken right after this callback, so the DOM must be updated synchronously
    const vt = doc.startViewTransition(() => {
      mutate();
      this.applyDom();
    });
    vt.updateCallbackDone.catch(() => undefined);
    vt.ready
      .then(() =>
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 640, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' },
        ),
      )
      .catch(() => undefined);
    vt.finished.catch(() => undefined).finally(() => root.classList.remove('theme-vt'));
  }

  private applyDom(): void {
    const el = this.doc.documentElement;
    el.lang = this.lang();
    el.dataset['theme'] = this.resolvedTheme();
    el.dataset['density'] = this.density();
    el.dataset['motion'] = this.motion();
    if (this.privacy()) el.dataset['privacy'] = 'on';
    else delete el.dataset['privacy'];

    const hue = this.accent();
    if (hue === null) el.style.removeProperty('--accent-h-user');
    else el.style.setProperty('--accent-h-user', String(hue));

    // keep the browser chrome (mobile address bar) in the theme's colour
    const meta = this.doc.querySelector('meta[name="theme-color"]');
    const colour = this.win.getComputedStyle(el).getPropertyValue('--meta').trim();
    if (meta && colour) meta.setAttribute('content', colour);
  }

  private save(): void {
    const stored: Stored = {
      lang: this.lang(),
      theme: this.theme(),
      accent: this.accent(),
      density: this.density(),
      privacy: this.privacy(),
      motion: this.motion(),
      demo: this.demo(),
      demoCard: this.demoCard(),
      transfers: this.transfers(),
      period: this.period(),
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(stored));
    } catch {
      /* storage may be unavailable (private mode) — preferences just won't persist */
    }
  }
}
