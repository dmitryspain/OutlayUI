import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { currentLang } from '../i18n/lang';
import { MessageKey, translate } from '../i18n/translate';
import { PrefsService } from './prefs.service';

/** "Огляд · Outlay" / "Overview · Outlay" in the tab title. Route titles are message keys. */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private key: string | undefined;

  constructor() {
    super();
    inject(PrefsService); // makes sure the saved language is applied before the first title is set
    // subscribe to the language explicitly: on the first run there is no page yet, so apply() would not read it
    effect(() => {
      currentLang();
      this.apply();
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key = this.buildTitle(snapshot);
    this.apply();
  }

  private apply(): void {
    const page = this.key ? translate(this.key as MessageKey) : '';
    this.title.setTitle(page ? `${page} · Outlay` : 'Outlay');
  }
}
