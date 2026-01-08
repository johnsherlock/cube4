export const SIZE = 4;
export const EMPTY = 0;
export const P1 = 1;
export const P2 = 2;
export const aiPlayer = P2;

export function clampInt(n, lo, hi) {
  n = Math.trunc(n);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

export function makeEmptyBoard() {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () =>
      Array(SIZE).fill(EMPTY)
    )
  );
}

export const state = {
  board: makeEmptyBoard(),
  currentPlayer: P1,
  gameOver: false,
  lastMove: null,
  winsP1: 0,
  winsP2: 0,
  lastWinner: null,
  lastStartingPlayer: null,
  playersCount: 1,
  aiLevel: 1,
  firstMovePolicy: "alternate",
  matchStyle: "bo3",
  player1Name: "Player 1",
  player2Name: "Player 2",
  selectedLevelZ: null,
  aiThinking: false,
  userHasMovedCamera: false,
  initialFitDone: false,
  hasCompletedWelcome: false,
  demoMode: false,
};
