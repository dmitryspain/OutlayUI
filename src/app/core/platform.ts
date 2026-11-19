/**
 * Web vs the native shell (Capacitor, iOS). Platform differences go only through the tokens here and
 * `html[data-native]`, so tests can swap the platform for a fake.
 */
import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, StatusBarPlugin } from '@capacitor/status-bar';
import { THEMES, ThemeId } from './themes';

/** True inside the native shell (the iOS app), false in a browser. */
export const IS_NATIVE_APP = new InjectionToken<boolean>('IS_NATIVE_APP', {
  providedIn: 'root',
  factory: () => Capacitor.isNativePlatform(),
});

/** The part of the native status bar the app drives. */
export type StatusBarApi = Pick<StatusBarPlugin, 'setStyle'>;

/**
 * The native status bar (Capacitor `StatusBar` plugin). Wrapped rather than provided as is: the plugin object is a
 * Proxy that answers every property with a native call, `ngOnDestroy` included, so DI would register it as a destroy
 * hook and get a rejected "not implemented" promise whenever an injector is torn down (e.g. between tests).
 */
export const STATUS_BAR = new InjectionToken<StatusBarApi>('STATUS_BAR', {
  providedIn: 'root',
  factory: () => ({ setStyle: options => StatusBar.setStyle(options) }),
});

/** Status bar text that reads on the theme's background: light text on dark themes, dark text on light ones. */
export function statusBarStyleFor(theme: ThemeId): 'light-text' | 'dark-text' {
  return THEMES.find(t => t.id === theme)?.scheme === 'dark' ? 'light-text' : 'dark-text';
}
