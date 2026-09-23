import type { MessageKey } from '../i18n/messages/uk';

export type ThemeId = 'aurora' | 'daylight' | 'ledger' | 'brutal' | 'terminal';
export type ThemeChoice = ThemeId | 'auto';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  tagline: MessageKey;
  scheme: 'dark' | 'light';
}

export const THEMES: readonly ThemeInfo[] = [
  { id: 'aurora', name: 'Aurora', tagline: 'theme.aurora', scheme: 'dark' },
  { id: 'daylight', name: 'Daylight', tagline: 'theme.daylight', scheme: 'light' },
  { id: 'ledger', name: 'Ledger', tagline: 'theme.ledger', scheme: 'light' },
  { id: 'brutal', name: 'Brutal', tagline: 'theme.brutal', scheme: 'light' },
  { id: 'terminal', name: 'Terminal', tagline: 'theme.terminal', scheme: 'dark' },
];

/** What "Auto" resolves to for a dark / light operating system. */
export const AUTO_DARK: ThemeId = 'aurora';
export const AUTO_LIGHT: ThemeId = 'daylight';

/** Accent hues (OKLCH hue angle). Lightness/chroma come from the active theme. */
export const ACCENT_PRESETS: readonly { name: MessageKey; hue: number }[] = [
  { name: 'accent.violet', hue: 285 },
  { name: 'accent.indigo', hue: 265 },
  { name: 'accent.sky', hue: 225 },
  { name: 'accent.emerald', hue: 160 },
  { name: 'accent.lime', hue: 120 },
  { name: 'accent.amber', hue: 75 },
  { name: 'accent.coral', hue: 28 },
  { name: 'accent.raspberry', hue: 350 },
];

/** Mirrors `--accent-h-default` of each theme in themes.css (used to position the hue slider). */
export const DEFAULT_HUES: Record<ThemeId, number> = {
  aurora: 285,
  daylight: 265,
  ledger: 158,
  brutal: 350,
  terminal: 148,
};
