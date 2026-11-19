/**
 * Build settings for the deployed web app (`npm run build`, Cloudflare Pages); same fields as `environment.ts`.
 * The API runs on Render; its CORS list (backend `appsettings.Production.json`) allows https://outlay.pages.dev.
 */
export const environment = { name: 'web', apiBaseUrl: 'https://outlay-api.onrender.com/api' };
