import { createReducer, on } from '@ngrx/store';
import { setTokenId } from '../actions/token.actions';

export const initialState = {
  id: ''
};

export const tokenReducer = createReducer(
  initialState,
  on(setTokenId, (state, { id }) => ({ ...state, id }))
);
