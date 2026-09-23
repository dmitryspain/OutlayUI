/** A bank card. `balance` is already in whole currency units (the API sends minor units). */
export interface Card {
  id: string;
  balance: number;
  currencyCode: number;
  /** black | white | platinum | iron | fop | yellow | eAid … (lower-cased) */
  type: string;
  maskedNumber: string;
}

/**
 * One transaction. `amount` < 0 is money out, > 0 is money in.
 * The backend sends a zero GUID as `id` and an empty `icon`, so `key` is derived from the content.
 */
export interface Txn {
  key: string;
  date: Date;
  /** local calendar day, yyyy-MM-dd */
  day: string;
  description: string;
  category: string;
  amount: number;
  /** icon URL sent by the backend, '' when there is none */
  icon: string;
}

/** Inclusive range: `from` is a start of day, `to` is an end of day. */
export interface DateRange {
  from: Date;
  to: Date;
}

export interface ApiError {
  status: number;
  code?: string;
  /** text the backend itself sent (already readable), if any */
  serverMessage?: string;
  /** what kind of failure it was; the wording is chosen by the UI, in the current language */
  kind: 'offline' | 'server' | 'request' | 'unknown';
  /** true when the server could not be reached at all */
  offline: boolean;
}
