import { Pipe, PipeTransform } from '@angular/core';
import { categoryLabel } from './categories';
import { MessageKey, Params, RichPart, richParts, translate, translatePlural } from './translate';

/*
 * These pipes are deliberately impure: they read the language signal while the template runs, which is what
 * makes the whole UI follow a language switch (a pure pipe would cache the old text until its inputs change).
 */

/** {{ 'nav.overview' | t }}  ·  {{ 'top.syncUpdated' | t: { when: x } }} */
@Pipe({ name: 't', standalone: true, pure: false })
export class TPipe implements PipeTransform {
  transform(key: MessageKey, params?: Params): string {
    return translate(key, params);
  }
}

/** {{ count | tp: 'plural.ops' }} → "5 операцій" / "5 transactions" */
@Pipe({ name: 'tp', standalone: true, pure: false })
export class TpPipe implements PipeTransform {
  transform(n: number, key: MessageKey, params?: Params): string {
    return translatePlural(key, n, params);
  }
}

/** {{ tx.category | cat }} — a bank category in the current language (display only). */
@Pipe({ name: 'cat', standalone: true, pure: false })
export class CatPipe implements PipeTransform {
  transform(category: string): string {
    return categoryLabel(category);
  }
}

/** @for (p of 'wk.insight' | rich: params; track $index) { … } — text with **bold** parts. */
@Pipe({ name: 'rich', standalone: true, pure: false })
export class RichPipe implements PipeTransform {
  transform(key: MessageKey, params?: Params): RichPart[] {
    return richParts(key, params);
  }
}

export const I18N_PIPES = [TPipe, TpPipe, CatPipe, RichPipe] as const;
