import { Injectable, signal } from '@angular/core';

/** Open/closed state of the app-wide dialogs, so anything (a button, a shortcut) can open them. */
@Injectable({ providedIn: 'root' })
export class UiService {
  readonly paletteOpen = signal(false);
  readonly cardSwitcherOpen = signal(false);

  openPalette(): void { this.paletteOpen.set(true); }
  togglePalette(): void { this.paletteOpen.update(v => !v); }
  openCardSwitcher(): void { this.cardSwitcherOpen.set(true); }
}
