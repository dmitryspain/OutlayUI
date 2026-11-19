/**
 * Build settings for the iOS app (`npm run build:mobile`); same fields as `environment.ts`.
 * localhost works in the iOS Simulator, which shares the Mac's network. For a physical iPhone, put the backend's
 * stable HTTPS address here (see the backend README, section "Доступ з телефона (iOS)").
 */
export const environment = { name: 'mobile', apiBaseUrl: 'https://localhost:7016/api' };
