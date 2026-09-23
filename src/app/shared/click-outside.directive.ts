import { Directive, ElementRef, EventEmitter, Output, inject } from '@angular/core';

/** Emits when a click lands outside the host element (for popovers). */
@Directive({
  selector: '[appClickOutside]',
  standalone: true,
  host: { '(document:click)': 'onClick($event)' },
})
export class ClickOutsideDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  @Output('appClickOutside') outside = new EventEmitter<void>();

  protected onClick(e: Event): void {
    if (!this.el.nativeElement.contains(e.target as Node)) this.outside.emit();
  }
}
