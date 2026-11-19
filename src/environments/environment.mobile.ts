/**
 * Build settings for the iOS app (`npm run build:mobile`); same fields as `environment.ts`.
 * The app talks to the deployed API on Render (the simulator too); its CORS list allows capacitor://localhost.
 * To try the app against the backend on this Mac, put `https://localhost:7016/api` here for that build only.
 */
export const environment = { name: 'mobile', apiBaseUrl: 'https://outlay-api-64rz.onrender.com/api' };
