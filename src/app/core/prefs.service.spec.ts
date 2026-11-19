import { TestBed } from '@angular/core/testing';
import { currentLang } from '../i18n/lang';
import { PrefsService } from './prefs.service';

const KEY = 'outlay.prefs.v1';

describe('PrefsService defaults', () => {
  let saved: string | null;
  let html: { lang: string; theme: string | undefined };

  beforeEach(() => {
    saved = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    html = { lang: document.documentElement.lang, theme: document.documentElement.dataset['theme'] };
  });

  afterEach(() => {
    // destroy the service first, so its saving effect cannot run after the storage is put back
    TestBed.resetTestingModule();
    if (saved === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, saved);
    currentLang.set('uk');
    const el = document.documentElement;
    el.lang = html.lang;
    if (html.theme) el.dataset['theme'] = html.theme;
    else delete el.dataset['theme'];
  });

  it('a first visit gets English, the Terminal theme and the demo data', () => {
    const prefs = TestBed.inject(PrefsService);
    expect(prefs.lang()).toBe('en');
    expect(prefs.theme()).toBe('terminal');
    expect(prefs.resolvedTheme()).toBe('terminal');
    expect(prefs.demo()).toBeTrue();
  });

  it('what a returning visitor saved wins over the defaults', () => {
    localStorage.setItem(KEY, JSON.stringify({ lang: 'uk', theme: 'auto', demo: false }));
    const prefs = TestBed.inject(PrefsService);
    expect(prefs.lang()).toBe('uk');
    expect(prefs.theme()).toBe('auto');
    expect(prefs.demo()).toBeFalse();
  });

  it('an unknown saved theme or language falls back to the defaults', () => {
    localStorage.setItem(KEY, JSON.stringify({ lang: 'de', theme: 'neon' }));
    const prefs = TestBed.inject(PrefsService);
    expect(prefs.lang()).toBe('en');
    expect(prefs.theme()).toBe('terminal');
  });
});
