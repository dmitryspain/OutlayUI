import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ThemeChoice } from '../core/themes';
import { TPipe } from '../i18n/pipes';

/**
 * A miniature app rendered with a theme's *real* tokens (they are scoped to [data-theme], so a nested
 * element can carry a different theme than the page). "Auto" shows dark and light split diagonally.
 */
@Component({
  selector: 'app-theme-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, TPipe],
  template: `
    <div class="stage" aria-hidden="true">
      @if (theme === 'auto') {
        <div class="tp" data-theme="aurora"><ng-container *ngTemplateOutlet="mini" /></div>
        <div class="tp split" data-theme="daylight"><ng-container *ngTemplateOutlet="mini" /></div>
      } @else {
        <div class="tp" [attr.data-theme]="theme"><ng-container *ngTemplateOutlet="mini" /></div>
      }
    </div>

    <ng-template #mini>
      <div class="side"><i class="lg"></i><i></i><i></i><i></i></div>
      <div class="body">
        <div class="h"><b>{{ 'ov.kpi.expenses' | t }}</b><span class="pl">{{ 'period.short.30d' | t }}</span></div>
        <div class="big">12 480 ₴</div>
        <div class="bars">
          @for (h of bars; track $index) { <i [style.height.%]="h"></i> }
        </div>
        <div class="rw"><i class="av"></i><s></s><em>−240 ₴</em></div>
        <div class="rw"><i class="av"></i><s></s><em class="p">+1 200 ₴</em></div>
      </div>
    </ng-template>
  `,
  styles: [
    `
      :host { display: block; }
      .stage { position: relative; aspect-ratio: 16 / 10; overflow: hidden; border-radius: var(--radius-m); }
      .tp {
        position: absolute; inset: 0; display: grid; grid-template-columns: 20% 1fr; overflow: hidden;
        background: var(--bg); color: var(--ink); font-size: 10px; line-height: 1.25;
        box-shadow: inset 0 0 0 var(--edge-w) var(--edge);
        border-radius: inherit;
      }
      .tp.split { clip-path: polygon(100% 0, 100% 100%, 0 100%); }
      .side {
        display: grid; gap: 5px; align-content: start; padding: 9px 6px;
        background: color-mix(in srgb, var(--ink) 5%, var(--surface-solid)); border-right: 1px solid var(--line);
      }
      .side i { height: 6px; border-radius: 3px; background: var(--surface-3); }
      .side .lg { width: 12px; height: 12px; border-radius: 4px; background: var(--accent); margin-bottom: 4px; }
      .body { display: grid; gap: 6px; align-content: start; padding: 10px; min-width: 0; }
      .h { display: flex; align-items: center; justify-content: space-between; }
      .pl { padding: 1px 6px; border-radius: 99px; background: var(--surface-2); color: var(--ink-2); font-size: 8px; }
      .big { font-size: 16px; font-weight: 750; letter-spacing: -.02em; }
      .bars { display: flex; align-items: flex-end; gap: 3px; height: 34px; }
      .bars i { flex: 1; border-radius: 2px 2px 0 0; background: var(--viz-accent); }
      .rw { display: flex; align-items: center; gap: 6px; }
      .av { width: 13px; height: 13px; border-radius: 4px; background: var(--accent-soft); }
      s { flex: 1; height: 5px; border-radius: 3px; background: var(--surface-3); }
      em { font-style: normal; font-weight: 650; }
      em.p { color: var(--pos); }
    `,
  ],
})
export class ThemePreviewComponent {
  @Input({ required: true }) theme: ThemeChoice = 'aurora';
  protected readonly bars = [42, 66, 38, 80, 54, 96, 62, 48];
}
