import { ChangeDetectionStrategy, Component, ElementRef, Input, inject } from '@angular/core';
import { cardTypeLabel } from '../core/format';
import { Card } from '../core/models';
import { TPipe } from '../i18n/pipes';

const CURRENCIES: Record<number, string> = { 980: 'UAH', 840: 'USD', 978: 'EUR' };

/** A bank card drawn in CSS. Tilts towards the pointer with a moving sheen (mouse only, never with reduced motion). */
@Component({
  selector: 'app-card-visual',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe],
  host: {
    '[attr.data-type]': 'card.type',
    '[class.active]': 'active',
    '(pointermove)': 'onMove($event)',
    '(pointerleave)': 'reset()',
  },
  template: `
    <div class="cv">
      <span class="sheen"></span>
      <div class="r1">
        <span class="type">{{ typeLabel }}</span>
        <svg class="nfc" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M8 7c2 3 2 7 0 10M12 5c3 4.5 3 9.5 0 14M16 3c4 6 4 12 0 18" />
        </svg>
      </div>
      <span class="emv"></span>
      <div class="num">{{ number }}</div>
      <div class="r3">
        <span>{{ currency }}</span>
        @if (active) { <span class="badge">{{ 'card.active' | t }}</span> }
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; perspective: 900px; }
      .cv {
        --fg: #fff;
        position: relative; display: grid; grid-template-rows: auto 1fr auto auto; overflow: hidden;
        aspect-ratio: 1.586; padding: 18px; border-radius: 20px; color: var(--fg);
        background: linear-gradient(140deg, oklch(.5 .18 var(--accent-h)), oklch(.32 .12 calc(var(--accent-h) + 40)));
        box-shadow: 0 18px 40px -18px rgb(0 0 0 / .6), inset 0 0 0 1px rgb(255 255 255 / .14);
        transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
        transition: transform var(--dur-2) var(--ease), box-shadow var(--dur-2) var(--ease);
      }
      :host(.active) .cv { box-shadow: 0 0 0 3px var(--accent), 0 18px 40px -18px rgb(0 0 0 / .6); }
      :host([data-type='black']) .cv { background: linear-gradient(140deg, #262630, #0a0a0d 62%, #18181d); }
      :host([data-type='white']) .cv { --fg: #16161d; background: linear-gradient(140deg, #ffffff, #e2e5ee 70%, #f4f5f9); }
      :host([data-type='platinum']) .cv { --fg: #111318; background: linear-gradient(140deg, #e0e4ed, #9aa1b2 70%, #c9cedb); }
      :host([data-type='iron']) .cv { background: linear-gradient(140deg, #7d889c, #3a4252 70%, #566074); }
      :host([data-type='yellow']) .cv { --fg: #2a2000; background: linear-gradient(140deg, #ffe066, #ffb300); }
      :host([data-type='fop']) .cv { background: linear-gradient(140deg, #4a5b70, #1a222d); }
      :host([data-type='eaid']) .cv { background: linear-gradient(140deg, #3d7bff, #1c3fa6); }
      .sheen {
        position: absolute; inset: 0; pointer-events: none;
        background: radial-gradient(240px 170px at var(--gx, 25%) var(--gy, 0%), rgb(255 255 255 / .24), transparent 62%);
      }
      .r1 { display: flex; align-items: center; justify-content: space-between; font-weight: 700; letter-spacing: .02em; }
      .nfc { opacity: .8; }
      .emv {
        align-self: center; width: 38px; height: 28px; border-radius: 6px;
        background: linear-gradient(135deg, #f5dc92, #b98d2e); box-shadow: inset 0 0 0 1px rgb(0 0 0 / .28);
      }
      .num { font: 600 .95rem/1 var(--font-mono); letter-spacing: .08em; white-space: nowrap; margin-top: 4px; }
      .r3 { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; font-size: var(--fs-xs); font-weight: 650; opacity: .88; }
      .badge { padding: 2px 9px; border-radius: 99px; background: rgb(255 255 255 / .22); backdrop-filter: blur(6px); }
      :host([data-type='white']) .badge, :host([data-type='platinum']) .badge, :host([data-type='yellow']) .badge { background: rgb(0 0 0 / .12); }
    `,
  ],
})
export class CardVisualComponent {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  @Input({ required: true }) card!: Card;
  @Input() active = false;

  protected get typeLabel(): string {
    return cardTypeLabel(this.card.type);
  }
  protected get number(): string {
    return this.card.maskedNumber ? this.card.maskedNumber.replace(/\*/g, '•') : '•••• •••• •••• ••••';
  }
  protected get currency(): string {
    return CURRENCIES[this.card.currencyCode] ?? 'UAH';
  }

  protected onMove(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (document.documentElement.dataset['motion'] === 'reduced') return;
    const r = this.el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    this.el.style.setProperty('--ry', `${((px - 0.5) * 12).toFixed(2)}deg`);
    this.el.style.setProperty('--rx', `${((0.5 - py) * 12).toFixed(2)}deg`);
    this.el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    this.el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
  }

  protected reset(): void {
    for (const p of ['--rx', '--ry', '--gx', '--gy']) this.el.style.removeProperty(p);
  }
}
