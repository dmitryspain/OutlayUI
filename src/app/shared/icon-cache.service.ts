import { Injectable, signal } from '@angular/core';

/**
 * Remembers which of a transaction's own `icon` URLs (from the backend) actually load. Every URL is
 * probed once with a plain Image(), so a repeated URL costs one request — not one per row — and
 * nobody sees a broken-image placeholder while the vector icon is a perfectly good fallback.
 */
@Injectable({ providedIn: 'root' })
export class IconCache {
  private readonly known = new Map<string, boolean>();
  private readonly probing = new Set<string>();
  /** bumps whenever a probe finishes, so whoever asked re-evaluates */
  private readonly version = signal(0);

  /** true = the image loads, false = it does not, null = not known yet (a probe is running) */
  check(url: string): boolean | null {
    this.version(); // register the caller as a dependent
    const hit = this.known.get(url);
    if (hit !== undefined) return hit;
    if (!this.probing.has(url)) {
      this.probing.add(url);
      const img = new Image();
      img.onload = () => this.settle(url, true);
      img.onerror = () => this.settle(url, false);
      img.src = url;
    }
    return null;
  }

  private settle(url: string, ok: boolean): void {
    this.known.set(url, ok);
    this.probing.delete(url);
    this.version.update(v => v + 1);
  }
}
