import { createAction, props } from '@ngrx/store';

export const setTokenId = createAction(
  '[Settings Component] Set Token ID',
  props<{ id: string }>()
);
