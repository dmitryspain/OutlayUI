import { Lang, currentLang, localeOf } from './lang';
import { en } from './messages/en';
import type { Message, PluralMessage } from './messages/types';
import { uk } from './messages/uk';
import type { MessageKey } from './messages/uk';

export type { MessageKey };
export type Params = Record<string, string | number>;

const DICTS: Record<Lang, Record<MessageKey, Message>> = { uk, en };

const fill = (text: string, params?: Params): string =>
  params ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole)) : text;

/** Looks the key up in the current language. Reads the language signal, so it is reactive wherever it is called. */
export function translate(key: MessageKey, params?: Params): string {
  const msg = DICTS[currentLang()][key] as Message | undefined;
  if (msg === undefined) return key; // an unknown key shows itself, which is easy to spot
  return fill(typeof msg === 'string' ? msg : msg.other, params);
}

const rules = new Map<string, Intl.PluralRules>();
const numbers = new Map<string, Intl.NumberFormat>();

/** Picks the plural form for `n` (Ukrainian has one/few/many, English one/other); `{n}` is filled in. */
export function translatePlural(key: MessageKey, n: number, params?: Params): string {
  const lang = currentLang();
  const locale = localeOf(lang);
  const msg = DICTS[lang][key];
  if (!rules.has(locale)) {
    rules.set(locale, new Intl.PluralRules(locale));
    numbers.set(locale, new Intl.NumberFormat(locale));
  }
  const form =
    typeof msg === 'string'
      ? msg
      : ((msg as PluralMessage & Record<string, string | undefined>)[rules.get(locale)!.select(n)] ?? msg.other);
  return fill(form, { n: numbers.get(locale)!.format(n), ...params });
}

export interface RichPart {
  text: string;
  bold: boolean;
}

/** Splits `**bold**` markup into parts, so a template can wrap them in <strong> without innerHTML. */
export function richParts(key: MessageKey, params?: Params): RichPart[] {
  return translate(key, params)
    .split('**')
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter(p => p.text !== '');
}
