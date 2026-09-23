import type { ApiError } from '../core/models';
import type { MessageKey } from './messages/uk';
import { translate } from './translate';

/** Error codes the backend sends that the UI words itself, in the current language. */
const BY_CODE: Record<string, MessageKey> = {
  'Monobank.RateLimited': 'err.rateLimited',
  'Monobank.Unauthorized': 'err.monoUnauthorized',
  'Monobank.Failed': 'err.monoFailed',
  'Connect.InvalidToken': 'err.monoUnauthorized',
  'Webhook.NotConfigured': 'st.live.notConfigured',
};

/** Human-readable text for an API error in the current language (a known code first, then the server's own text). */
export function errorText(e: ApiError): string {
  const known = e.code ? BY_CODE[e.code] : undefined;
  if (known) return translate(known);
  if (e.serverMessage) return e.serverMessage;
  switch (e.kind) {
    case 'offline': return translate('err.offline');
    case 'server': return translate('err.server');
    case 'request': return translate('err.request', { status: e.status });
    default: return translate('err.unknown');
  }
}
