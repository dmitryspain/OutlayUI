import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export interface SegOption {
  value: string;
  label: string;
}

let uid = 0;

/** Radio-group semantics (arrow keys work natively) with a sliding thumb. */
@Component({
  selector: 'app-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seg" role="radiogroup" [attr.aria-label]="label" [style.--n]="options.length" [style.--i]="index">
      @for (o of options; track o.value) {
        <label>
          <input type="radio" [name]="name" [value]="o.value" [checked]="o.value === value" (change)="pick(o.value)" />
          <span>{{ o.label }}</span>
        </label>
      }
    </div>
  `,
  styles: [':host { display: inline-block; max-width: 100%; }'],
})
export class SegmentedComponent {
  @Input({ required: true }) options: readonly SegOption[] = [];
  @Input({ required: true }) value = '';
  @Input() label = '';
  @Output() valueChange = new EventEmitter<string>();

  protected readonly name = `seg-${++uid}`;

  protected get index(): number {
    return Math.max(0, this.options.findIndex(o => o.value === this.value));
  }

  protected pick(v: string): void {
    if (v !== this.value) this.valueChange.emit(v);
  }
}
