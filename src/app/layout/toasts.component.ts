import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';
import { TPipe } from '../i18n/pipes';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-toasts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (t of toast.items(); track t.id) {
        <div class="toast" [class.error]="t.kind === 'error'" [class.success]="t.kind === 'success'">
          <app-icon [name]="t.kind === 'error' ? 'alert' : t.kind === 'success' ? 'check' : 'info'" [size]="18" />
          <span>{{ t.text }}</span>
          <button type="button" (click)="toast.dismiss(t.id)" [attr.aria-label]="'common.close' | t"><app-icon name="x" [size]="16" /></button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toasts {
        position: fixed; z-index: 70; left: 50%; bottom: 20px; transform: translateX(-50%);
        display: grid; gap: 8px; width: min(440px, calc(100vw - 24px)); pointer-events: none;
      }
      .toast {
        display: flex; align-items: center; gap: 10px; padding: 12px 14px; pointer-events: auto;
        background: var(--surface-solid); color: var(--ink);
        border: var(--edge-w) solid var(--edge); border-radius: var(--radius-m); box-shadow: var(--shadow-pop);
        animation: toast-in var(--dur-2) var(--ease);
      }
      .toast span { flex: 1 1 auto; }
      .toast.error > app-icon { color: var(--neg); }
      .toast.success > app-icon { color: var(--pos); }
      .toast button { color: var(--ink-3); }
      @keyframes toast-in { from { opacity: 0; transform: translateY(10px); } }
      @media (max-width: 719px) { .toasts { bottom: calc(80px + env(safe-area-inset-bottom)); } }
    `,
  ],
})
export class ToastsComponent {
  protected readonly toast = inject(ToastService);
}
