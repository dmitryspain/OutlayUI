import { signal } from '@angular/core';

export type Lang = 'uk' | 'en';

export const LANGS: readonly { id: Lang; /** always written in its own language */ name: string; locale: string }[] = [
  { id: 'uk', name: 'Українська', locale: 'uk-UA' },
  { id: 'en', name: 'English', locale: 'en-GB' },
];

/**
 * The active language. It lives in a module-level signal (not only in a service), so plain functions —
 * number, date and plural formatters — can depend on it: anything that reads it inside a template or a
 * `computed` re-evaluates by itself when the language changes.
 */
export const currentLang = signal<Lang>('uk');

export const localeOf = (lang: Lang): string => LANGS.find(l => l.id === lang)?.locale ?? 'uk-UA';
export const currentLocale = (): string => localeOf(currentLang());
export const isLang = (v: unknown): v is Lang => LANGS.some(l => l.id === v);
