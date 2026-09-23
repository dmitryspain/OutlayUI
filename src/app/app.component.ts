import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PrefsService } from './core/prefs.service';
import { TPipe } from './i18n/pipes';
import { BudgetService } from './core/budget.service';
import { LiveService } from './core/live.service';
import { SyncService } from './core/sync.service';
import { CardSwitcherComponent } from './layout/card-switcher.component';
import { CommandPaletteComponent } from './layout/command-palette.component';
import { NavComponent } from './layout/nav.component';
import { ToastsComponent } from './layout/toasts.component';
import { TopbarComponent } from './layout/topbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NavComponent, TopbarComponent, CommandPaletteComponent, CardSwitcherComponent, ToastsComponent, TPipe],
  template: `
    <a class="skip-link" href="/" (click)="skip($event)">{{ 'app.skip' | t }}</a>

    <div class="shell">
      <app-nav class="vt-nav" />
      <div class="col">
        <app-topbar class="vt-bar" />
        <main #main id="main" class="content" tabindex="-1">
          <div class="content-in"><router-outlet /></div>
        </main>
      </div>
    </div>

    <app-command-palette />
    <app-card-switcher />
    <app-toasts />
  `,
  styles: [
    `
      .shell { display: grid; grid-template-columns: var(--nav-w) minmax(0, 1fr); min-height: 100dvh; }
      .col { display: flex; flex-direction: column; min-width: 0; }
      .content { flex: 1 1 auto; container: page / inline-size; padding: 8px clamp(16px, 3vw, 32px) 56px; outline: none; }
      .content-in { max-width: var(--page-max); margin-inline: auto; }
      @media (max-width: 719px) {
        .shell { grid-template-columns: minmax(0, 1fr); }
        .content { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
      }
    `,
  ],
})
export class AppComponent {
  @ViewChild('main', { static: true }) private main!: ElementRef<HTMLElement>;

  constructor() {
    // instantiate the services that must run from startup: theme, background sync, live events, budget alerts
    inject(PrefsService);
    inject(SyncService);
    inject(LiveService);
    inject(BudgetService);
  }

  /** `#main` would resolve against <base href="/"> and navigate away, so focus it by hand. */
  protected skip(e: Event): void {
    e.preventDefault();
    this.main.nativeElement.focus();
  }
}
