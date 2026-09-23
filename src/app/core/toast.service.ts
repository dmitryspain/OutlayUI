import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  readonly items = signal<Toast[]>([]);

  show(text: string, kind: Toast['kind'] = 'info', ms = 4500): void {
    const id = ++this.seq;
    this.items.update(list => [...list.slice(-2), { id, kind, text }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  dismiss(id: number): void {
    this.items.update(list => list.filter(t => t.id !== id));
  }
}
