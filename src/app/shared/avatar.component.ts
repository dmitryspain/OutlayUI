import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { FROM_PREFIX, categoryMeta, hueOf, initials, isPerson } from '../core/category';
import { IconCache } from './icon-cache.service';
import { IconComponent } from './icon.component';

/**
 * The picture next to a transaction. In order of preference:
 *   1. the transaction's own icon URL (from the backend), if it actually loads;
 *   2. a vector icon for the category — or initials, for a person-to-person transfer.
 * Pictures sit on a light tile, so their dark outlines stay readable on dark themes too.
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { 'aria-hidden': 'true' },
  template: `
    @if (view(); as v) {
      <span class="tile" [class.pic]="!!v.img" [style.--s.px]="size" [style.--h]="v.hue">
        @if (v.img) {
          <img [src]="v.img" alt="" decoding="async" draggable="false" />
        } @else if (v.text) {
          <span class="t">{{ v.text }}</span>
        } @else {
          <app-icon [name]="v.glyph" [size]="size * 0.5" />
        }
      </span>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; flex: none; }
      .tile {
        display: grid; place-items: center; overflow: hidden;
        width: var(--s); height: var(--s);
        border-radius: calc(var(--radius-s) * 1.35);
        background: color-mix(in oklab, oklch(.68 .13 var(--h)) 24%, var(--surface-solid));
        color: oklch(var(--av-fg, .8) .13 var(--h));
        font-weight: 750;
      }
      .t { font-size: calc(var(--s) * .34); letter-spacing: .02em; }
      .tile.pic { background: #fbfbfd; box-shadow: inset 0 0 0 1px rgb(0 0 0 / .1); }
      .tile img { display: block; width: 78%; height: 78%; object-fit: contain; }
      :host-context([data-theme='brutal']) .tile { background: oklch(.9 .09 var(--h)); color: #111; border: 2px solid #111; }
      :host-context([data-theme='brutal']) .tile.pic { background: #fff; }
    `,
  ],
})
export class AvatarComponent {
  private readonly cache = inject(IconCache);

  @Input() size = 40;

  private readonly cat = signal('');
  private readonly desc = signal('');
  private readonly url = signal('');

  @Input({ required: true }) set category(c: string) { this.cat.set(c ?? ''); }
  @Input() set description(d: string) { this.desc.set(d ?? ''); }
  /** the transaction's own icon URL, if the backend sent one */
  @Input() set icon(u: string | null | undefined) { this.url.set((u ?? '').trim()); }

  protected readonly view = computed(() => {
    const category = this.cat();
    const description = this.desc();
    const person = isPerson(category, description);
    const meta = categoryMeta(category, description);
    return {
      img: this.picture(),
      text: person ? initials(description) : '',
      glyph: meta.icon,
      hue: person ? hueOf(description.replace(FROM_PREFIX, '')) : meta.hue,
    };
  });

  /** The backend icon, if there is one and it actually loads (null while the check is still running: the vector icon shows meanwhile). */
  private picture(): string | null {
    const url = this.url();
    if (!url) return null;
    return this.cache.check(url) === true ? url : null;
  }
}
