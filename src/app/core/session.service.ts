import { Injectable, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { DEMO_TOKEN } from './config';
import { DEMO_CARD_ID } from './demo/demo-data';
import { PrefsService } from './prefs.service';
import { setCardId } from '../store/actions/card.actions';
import { setTokenId } from '../store/actions/token.actions';
import { selectCardId } from '../store/selectors/card.selector';
import { selectTokenId } from '../store/selectors/token.selector';

/**
 * Who is connected and which card is active.
 * The real values stay in the NgRx store (persisted to localStorage exactly as before, so an
 * already-saved token keeps working). In demo mode they are swapped for placeholders and the
 * real ones are left untouched.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly store = inject(Store);
  private readonly prefs = inject(PrefsService);

  private readonly realToken = this.store.selectSignal(selectTokenId);
  private readonly realCard = this.store.selectSignal(selectCardId);

  readonly demo = this.prefs.demo;
  readonly token = computed(() => (this.prefs.demo() ? DEMO_TOKEN : this.realToken() || ''));
  readonly cardId = computed(() => (this.prefs.demo() ? this.prefs.demoCard() || DEMO_CARD_ID : this.realCard() || ''));
  readonly connected = computed(() => !!this.token());
  readonly hasCard = computed(() => !!this.cardId());

  /** The real token, even while demo mode hides it (for the Settings screen). */
  readonly savedToken = computed(() => this.realToken() || '');

  setToken(id: string): void {
    this.store.dispatch(setTokenId({ id }));
  }

  setCard(id: string): void {
    if (this.prefs.demo()) this.prefs.setDemoCard(id);
    else this.store.dispatch(setCardId({ id }));
  }

  disconnect(): void {
    this.store.dispatch(setTokenId({ id: '' }));
    this.store.dispatch(setCardId({ id: '' }));
  }
}
