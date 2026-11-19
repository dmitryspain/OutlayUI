import { Injectable, inject } from '@angular/core';
import { Style } from '@capacitor/status-bar';
import { IS_NATIVE_APP, STATUS_BAR, statusBarStyleFor } from './platform';
import { ThemeId } from './themes';

/** Keeps the native shell around the web view (the iOS status bar) in tune with the theme. Does nothing on the web. */
@Injectable({ providedIn: 'root' })
export class NativeShellService {
  private readonly native = inject(IS_NATIVE_APP);
  private readonly statusBar = inject(STATUS_BAR);

  syncStatusBar(theme: ThemeId): void {
    if (!this.native) return;
    // Capacitor names the style after the background: Style.Dark = light text, Style.Light = dark text
    const style = statusBarStyleFor(theme) === 'light-text' ? Style.Dark : Style.Light;
    try {
      this.statusBar.setStyle({ style }).catch(() => undefined);
    } catch {
      /* a status bar failure must not break applying the theme */
    }
  }
}
