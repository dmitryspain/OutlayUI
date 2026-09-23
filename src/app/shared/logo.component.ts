import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Outlay mark: two waves on an accent tile. Follows the theme accent. */
@Component({
  selector: 'app-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg viewBox="0 0 32 32" [attr.width]="size" [attr.height]="size" aria-hidden="true">
    <rect width="32" height="32" rx="9" class="tile" />
    <path d="M6 13c3-4 5.5-4 8.5 0s5.500 4 8.500 0c1.300-1.700 2.500-2.300 4-1.700" class="wave" />
    <path d="M6 21c3-4 5.5-4 8.500 0s5.500 4 8.500 0c1.300-1.700 2.500-2.300 4-1.700" class="wave w2" />
  </svg>`,
  styles: [
    `
      :host { display: inline-flex; line-height: 0; }
      .tile { fill: var(--accent); }
      .wave { fill: none; stroke: var(--accent-ink); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
      .w2 { opacity: .5; }
    `,
  ],
})
export class LogoComponent {
  @Input() size = 32;
}
