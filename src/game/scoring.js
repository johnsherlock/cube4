import { state, P1, P2 } from "./state.js";

export const LS_KEY = "cube4_settings_v3";
export const LS_SCORE_KEY = "cube4_score_v3";

export function loadPersisted() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (s && typeof s === "object") {
      if (s.playersCount === 1 || s.playersCount === 2) state.playersCount = s.playersCount;
      if (Number.isFinite(Number(s.aiLevel))) state.aiLevel = Math.max(1, Math.min(5, Number(s.aiLevel)));
      if (s.firstMovePolicy) state.firstMovePolicy = s.firstMovePolicy;
      if (s.matchStyle) state.matchStyle = s.matchStyle;
      if (typeof s.player1Name === "string") state.player1Name = s.player1Name;
      if (typeof s.player2Name === "string") state.player2Name = s.player2Name;
      if (s.lastWinner === P1 || s.lastWinner === P2) state.lastWinner = s.lastWinner;
      if (s.lastStartingPlayer === P1 || s.lastStartingPlayer === P2) state.lastStartingPlayer = s.lastStartingPlayer;
    }
  } catch {}

  try {
    const sc = JSON.parse(localStorage.getItem(LS_SCORE_KEY) || "null");
    if (sc && typeof sc === "object") {
      state.winsP1 = Number(sc.winsP1) || 0;
      state.winsP2 = Number(sc.winsP2) || 0;
    }
  } catch {}
}

export function savePersisted() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      playersCount: state.playersCount,
      aiLevel: state.aiLevel,
      firstMovePolicy: state.firstMovePolicy,
      matchStyle: state.matchStyle,
      player1Name: state.player1Name,
      player2Name: state.player2Name,
      lastWinner: state.lastWinner,
      lastStartingPlayer: state.lastStartingPlayer,
    }));
  } catch {}

  try {
    localStorage.setItem(LS_SCORE_KEY, JSON.stringify({ winsP1: state.winsP1, winsP2: state.winsP2 }));
  } catch {}
}

export function wipeScoreboard() {
  state.winsP1 = 0;
  state.winsP2 = 0;
  state.lastWinner = null;
  savePersisted();
}
