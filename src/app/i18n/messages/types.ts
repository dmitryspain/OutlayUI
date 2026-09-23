/** A message with plural forms; `{n}` is replaced by the (locale-formatted) number. */
export interface PluralMessage {
  one: string;
  few?: string;
  many?: string;
  other: string;
}

export type Message = string | PluralMessage;
