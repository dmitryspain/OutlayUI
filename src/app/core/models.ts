/** A bank card. `balance` is already in whole currency units (the API sends minor units). */
export interface Card {
  id: string;
  balance: number;
  creditLimit: number;
  currencyCode: number;
  /** black | white | platinum | iron | fop | yellow | eAid … (lower-cased) */
  type: string;
  maskedNumber: string;
}

/** One transaction. `amount` < 0 is money out, > 0 is money in. `key` is the backend id (or, from older backends, derived from the content). */
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
  /** the other party of a transfer as the bank names it, '' when none */
  counterName: string;
  /** the note on a transfer, '' when none */
  comment: string;
  cashback: number;
  /** the bank has not finished processing it yet */
  hold: boolean;
}

export type BackfillState = 'idle' | 'running' | 'done' | 'failed';

/** Loading of older history from the bank (the backend walks back one statement request per minute). */
export interface BackfillStatus {
  state: BackfillState;
  /** 0..1 */
  progress: number;
  imported: number;
  /** how far back the stored history now reaches */
  oldestLoaded: Date | null;
  /** rough seconds left */
  etaSeconds: number | null;
  error: string | null;
}

export interface WebhookStatus {
  /** the server has a public URL it can give Monobank */
  configured: boolean;
  /** Monobank pushes this client's transactions to us */
  enabled: boolean;
}

/** A transaction pushed by the bank a moment ago (server-sent event). */
export interface LiveTxn {
  description: string;
  amount: number;
  date: Date;
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
