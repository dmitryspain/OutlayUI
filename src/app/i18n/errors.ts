import type { ApiError } from '../core/models';
import { translate } from './translate';

/** Human-readable text for an API error in the current language (the server's own message wins when it sent one). */
export function errorText(e: ApiError): string {
  if (e.serverMessage) return e.serverMessage;
  switch (e.kind) {
    case 'offline': return translate('err.offline');
    case 'server': return translate('err.server');
    case 'request': return translate('err.request', { status: e.status });
    default: return translate('err.unknown');
  }
}
