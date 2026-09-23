import { Injectable, inject } from '@angular/core';
import { PrefsService } from '../core/prefs.service';
import { LANGS, Lang } from './lang';

/** The language switch. (Reading text is done with the `t` pipe / `translate()`, which follow it reactively.) */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly prefs = inject(PrefsService);

  readonly lang = this.prefs.lang;
  readonly languages = LANGS;

  setLang(lang: Lang): void {
    this.prefs.setLang(lang);
  }
}
