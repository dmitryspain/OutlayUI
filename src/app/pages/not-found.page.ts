import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TPipe } from '../i18n/pipes';
import { EmptyStateComponent } from '../shared/states.component';

@Component({
  selector: 'app-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EmptyStateComponent, TPipe],
  template: `
    <div class="page">
      <div class="card">
        <app-empty-state icon="search" [title]="'nf.title' | t" [text]="'nf.text' | t">
          <a class="btn btn-primary" routerLink="/home">{{ 'nf.home' | t }}</a>
        </app-empty-state>
      </div>
    </div>
  `,
})
export class NotFoundPage {}
