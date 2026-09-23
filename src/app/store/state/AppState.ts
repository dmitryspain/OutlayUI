export interface AppState {
  // user: UserState;
  card: CardState;
  token: TokenState;
}

export interface CardState {
  id: string;
}
export interface TokenState {
  id: string;
}
