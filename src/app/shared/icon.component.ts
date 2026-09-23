import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONS, IconName } from './icons';

const cache = new Map<string, SafeHtml>();

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg
    viewBox="0 0 24 24"
    [attr.width]="size"
    [attr.height]="size"
    fill="none"
    stroke="currentColor"
    [attr.stroke-width]="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    [innerHTML]="html"
  ></svg>`,
  styles: [':host { display: inline-flex; flex: none; line-height: 0; }'],
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  html: SafeHtml = '';
  @Input() size = 20;
  @Input() stroke = 1.75;

  @Input({ required: true }) set name(n: IconName) {
    let html = cache.get(n);
    if (!html) {
      // ICONS is a table of trusted constants, so bypassing the sanitizer is safe here
      html = this.sanitizer.bypassSecurityTrustHtml(ICONS[n] ?? ICONS.tag);
      cache.set(n, html);
    }
    this.html = html;
  }
}
