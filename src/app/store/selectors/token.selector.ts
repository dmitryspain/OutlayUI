import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AppState, CardState, TokenState } from "../state/AppState";

export const selectTokenState = createFeatureSelector<TokenState>('token');

export const selectTokenId = createSelector(
  selectTokenState,
  (state) => state.id
);

// export const selectCardState = (state: AppState) => state.card;
//
// export const selectCardId = createSelector(
//   selectCardState,
//   (state) => state.id
// );
//
