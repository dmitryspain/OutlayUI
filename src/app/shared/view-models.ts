import { DayBucket, OTHER_KEY, Ranked } from '../core/aggregate';
import { formatDayHeading, formatShortDate } from '../core/format';
import { categoryLabel } from '../i18n/categories';
import { translate, translatePlural } from '../i18n/translate';
import { BarDatum } from './bar-chart.component';
import { RankedItem } from './ranked-list.component';
import { ShareSegment } from './share-bar.component';

export const opsLabel = (n: number): string => translatePlural('plural.ops', n);

/** `categories`: the rows are bank categories, so their names are shown in the current language. */
export function toRankedItems(
  list: readonly Ranked[],
  slots?: ReadonlyMap<string, number>,
  opts: { categories?: boolean } = {},
): RankedItem[] {
  const top = Math.max(0, ...list.map(r => r.amount));
  return list.map(r => ({
    key: r.key,
    label: r.key === OTHER_KEY ? translate('common.other') : opts.categories ? categoryLabel(r.label) : r.label,
    amount: r.amount,
    rel: top ? r.amount / top : 0,
    share: r.share,
    category: r.category,
    description: r.label,
    icon: r.icon,
    sub: opsLabel(r.count),
    slot: slots?.get(r.key),
    other: r.key === OTHER_KEY,
  }));
}

export function toSegments(list: readonly Ranked[], slots: ReadonlyMap<string, number>): ShareSegment[] {
  return list.map(r => ({
    key: r.key,
    label: r.key === OTHER_KEY ? translate('common.other') : categoryLabel(r.label),
    share: r.share,
    slot: slots.get(r.key),
    other: r.key === OTHER_KEY,
  }));
}

/** Daily expenses as chart data. `field` picks what to plot. */
export function dailyBars(buckets: readonly DayBucket[], field: 'expenses' | 'income' = 'expenses'): BarDatum[] {
  return buckets.map(b => ({
    key: b.day,
    label: formatDayHeading(b.date),
    short: formatShortDate(b.date),
    value: b[field],
    sub: b.count ? opsLabel(b.count) : translate('chart.noTx'),
  }));
}
