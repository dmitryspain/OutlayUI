import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { LiveService } from '../core/live.service';
import { PrefsService } from '../core/prefs.service';
import { SessionService } from '../core/session.service';
import { SyncService } from '../core/sync.service';
import { translate } from '../i18n/translate';
import { ConnectPanelComponent } from '../shared/connect-panel.component';
import { HistoryLoaderComponent } from '../shared/history-loader.component';
import { SettingsPage } from './settings.page';

describe('SettingsPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        // just what the page reads; the real services write to <html>/localStorage and talk to the backend
        {
          provide: PrefsService,
          useValue: {
            lang: signal('uk'), theme: signal('auto'), resolvedTheme: signal('aurora'), accent: signal(null),
            density: signal('comfortable'), motion: signal('system'), privacy: signal(false), demo: signal(false), transfers: signal(true),
          },
        },
        { provide: SessionService, useValue: { hasSession: signal(false), demo: signal(false), connected: signal(false), hasCard: signal(false) } },
        { provide: SyncService, useValue: { syncing: signal(false), lastError: signal(null), lastSync: signal(null) } },
        { provide: LiveService, useValue: { webhook: signal(null), connected: signal(false), enabling: signal(false) } },
      ],
    });
    // these two call the backend themselves and are not what is checked here
    TestBed.overrideComponent(SettingsPage, {
      remove: { imports: [ConnectPanelComponent, HistoryLoaderComponent] },
      add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
  });

  it('"About" shows the backend address with the build it belongs to', () => {
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();

    const terms = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('dl.about dt'));
    const backend = terms.find(dt => dt.textContent?.trim() === translate('st.about.backend'));
    expect(backend?.nextElementSibling?.textContent?.replace(/\s+/g, ' ').trim()).toBe(`${environment.apiBaseUrl} (web)`);
  });
});
