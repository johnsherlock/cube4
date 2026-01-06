import { state, SIZE, P1, P2, EMPTY } from "./state.js";
import { legalMoves, boardIsFull, checkWin, keyOf, WIN_LINES } from "./rules.js";

function heuristicScore(forPlayer) {
  const opp = (forPlayer === P1) ? P2 : P1;
  const weights = { 1: 1, 2: 6, 3: 28 };
  let score = 0;
  const board = state.board;

  function positionalPreferenceValue(level, x, y, z) {
    const cx = 1.5, cy = 1.5, cz = 1.5;
    const centerDist = Math.abs(x - cx) + Math.abs(y - cy) + Math.abs(z - cz);
    const surfaceDist = Math.min(x, 3 - x) + Math.min(y, 3 - y) + Math.min(z, 3 - z);
    const centerVal = 4.5 - centerDist;
    const surfaceVal = 4.5 - surfaceDist;

    const tByLevel = { 1: 0.00, 2: 0.25, 3: 0.50, 4: 0.75, 5: 0.90 };
    const t = (tByLevel[level] ?? 0.25);
    return (1 - t) * surfaceVal + t * centerVal;
  }

  const posSelfScaleByLevel = { 1: 0.55, 2: 0.45, 3: 0.30, 4: 0.35, 5: 0.40 };
  const posOppScaleByLevel  = { 1: 0.05, 2: 0.10, 3: 0.18, 4: 0.22, 5: 0.25 };
  const posSelfScale = posSelfScaleByLevel[state.aiLevel] ?? 0.40;
  const posOppScale  = posOppScaleByLevel[state.aiLevel] ?? 0.18;

  for (let x = 0; x < SIZE; x++)
    for (let y = 0; y < SIZE; y++)
      for (let z = 0; z < SIZE; z++) {
        const v = board[x][y][z];
        if (v === EMPTY) continue;
        const pref = positionalPreferenceValue(state.aiLevel, x, y, z);
        if (v === forPlayer) score += pref * posSelfScale;
        else if (v === opp) score -= pref * posOppScale;
      }

  for (const line of WIN_LINES) {
    let fp = 0, op = 0;
    for (const [x, y, z] of line) {
      const v = board[x][y][z];
      if (v === forPlayer) fp++;
      else if (v === opp) op++;
    }
    if (fp > 0 && op > 0) continue;
    if (fp > 0) score += weights[fp] || 0;
    if (op > 0) score -= (weights[op] || 0);
  }

  return score;
}

export function tryImmediate(player) {
  const board = state.board;
  for (const [x, y, z] of legalMoves(board)) {
    board[x][y][z] = player;
    const win = checkWin(board, player);
    board[x][y][z] = EMPTY;
    if (win) return [x, y, z];
  }
  return null;
}

export function immediateWinningThreats(player) {
  const board = state.board;
  const threats = new Map();
  for (const [x, y, z] of legalMoves(board)) {
    board[x][y][z] = player;
    const line = checkWin(board, player);
    board[x][y][z] = EMPTY;
    if (line) threats.set(keyOf(x, y, z), line);
  }
  return threats;
}

function negamax(depth, alpha, beta, player, rootPlayer) {
  const board = state.board;
  const opp = (player === P1) ? P2 : P1;
  const winLine = checkWin(board, opp);
  if (winLine) return -100000 - depth;
  if (boardIsFull(board) || depth === 0) return heuristicScore(rootPlayer);

  let best = -Infinity;
  const moves = legalMoves(board);
  moves.sort((a, b) => {
    const ca = Math.abs(a[0] - 1.5) + Math.abs(a[1] - 1.5) + Math.abs(a[2] - 1.5);
    const cb = Math.abs(b[0] - 1.5) + Math.abs(b[1] - 1.5) + Math.abs(b[2] - 1.5);
    return ca - cb;
  });

  for (const [x, y, z] of moves) {
    board[x][y][z] = player;
    const score = -negamax(depth - 1, -beta, -alpha, opp, rootPlayer);
    board[x][y][z] = EMPTY;

    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }

  return best;
}

export function chooseAIMove() {
  const board = state.board;
  const moves = legalMoves(board);
  if (moves.length === 0) return null;

  const filled = 64 - moves.length;
  const busy = Math.min(1, filled / 40);

  const cfgByLevel = {
    1: { pSeeWin: 0.50, pSeeBlock: 0.18, sample: 10, useMinimax: false, depth: 0, noise: 12.0 },
    2: { pSeeWin: 0.70, pSeeBlock: 0.32, sample: 14, useMinimax: false, depth: 0, noise: 9.0 },
    3: { pSeeWin: 0.90, pSeeBlock: 0.62, sample: 18, useMinimax: false, depth: 0, noise: 6.0 },
    4: { pSeeWin: 0.95, pSeeBlock: 0.85, sample: 22, useMinimax: true,  depth: 2, noise: 3.5 },
    5: { pSeeWin: 0.97, pSeeBlock: 0.90, sample: 26, useMinimax: true,  depth: 2, noise: 3.1 },
  };

  const cfg = cfgByLevel[state.aiLevel] || cfgByLevel[1];
  const pWin = Math.max(0.20, cfg.pSeeWin - busy * 0.18);
  const pBlock = Math.max(0.18, cfg.pSeeBlock - busy * 0.22);

  if (Math.random() < pWin) {
    const winNow = tryImmediate(P2);
    if (winNow) return winNow;
  }

  if (Math.random() < pBlock) {
    const block = tryImmediate(P1);
    if (block) return block;
  }

  const shuffled = moves.slice().sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, Math.min(cfg.sample, shuffled.length));

  let best = null;
  let bestScore = -Infinity;

  for (const [x, y, z] of sample) {
    board[x][y][z] = P2;

    let s;
    if (cfg.useMinimax && cfg.depth > 0) {
      s = -negamax(cfg.depth - 1, -Infinity, Infinity, P1, P2);
    } else {
      s = heuristicScore(P2);
    }

    s += (Math.random() - 0.5) * cfg.noise;

    board[x][y][z] = EMPTY;

    if (s > bestScore) {
      bestScore = s;
      best = [x, y, z];
    }
  }

  return best || moves[(Math.random() * moves.length) | 0];
}
