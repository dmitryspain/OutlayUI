import { Injectable, computed, inject } from '@angular/core';
import { ApiService } from './api.service';
import { query } from './query';
import { SessionService } from './session.service';

/** The cards of the connected client, and which one is active. */
@Injectable({ providedIn: 'root' })
export class CardsService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);

  private readonly q = query(
    () => this.session.token() || null,
    () => this.api.cards(),
    { key: token => token },
  );

  readonly cards = computed(() => this.q.data() ?? []);
  readonly loaded = computed(() => this.q.data() !== undefined);
  readonly loading = this.q.loading;
  readonly error = this.q.error;
  readonly active = computed(() => this.cards().find(c => c.id === this.session.cardId()) ?? null);

  reload(): void {
    this.q.reload();
  }
}
