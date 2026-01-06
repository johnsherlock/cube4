import { SIZE, EMPTY } from "./state.js";

export function keyOf(x, y, z) {
  return `${x},${y},${z}`;
}

// 13 unique directions for 3D 4-in-a-row
const directions = [
  [1,0,0],[0,1,0],[0,0,1],
  [1,1,0],[1,-1,0],
  [1,0,1],[1,0,-1],
  [0,1,1],[0,1,-1],
  [1,1,1],[1,1,-1],
  [1,-1,1],[1,-1,-1],
];

// Precompute all winning lines (arrays of 4 coords)
export const WIN_LINES = (() => {
  const lines = [];
  const seen = new Set();
  const keyOfLine = (line) => line.map(([x,y,z]) => `${x}${y}${z}`).join("|");

  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      for (let z = 0; z < SIZE; z++) {
        for (const [dx,dy,dz] of directions) {
          const line = [];
          for (let i = 0; i < 4; i++) {
            const nx = x + dx * i;
            const ny = y + dy * i;
            const nz = z + dz * i;
            if (nx < 0 || ny < 0 || nz < 0 || nx >= SIZE || ny >= SIZE || nz >= SIZE) {
              line.length = 0;
              break;
            }
            line.push([nx, ny, nz]);
          }
          if (line.length === 4) {
            const sorted = [...line].sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]));
            const k = keyOfLine(sorted);
            if (!seen.has(k)) {
              seen.add(k);
              lines.push(line);
            }
          }
        }
      }
    }
  }
  return lines;
})();

export function inBounds(x, y, z) {
  return x >= 0 && y >= 0 && z >= 0 && x < SIZE && y < SIZE && z < SIZE;
}

export function getWinningLineFrom(board, x, y, z, player) {
  for (const [dx, dy, dz] of directions) {
    let sx = x, sy = y, sz = z;
    while (true) {
      const nx = sx - dx, ny = sy - dy, nz = sz - dz;
      if (!inBounds(nx, ny, nz) || board[nx][ny][nz] !== player) break;
      sx = nx; sy = ny; sz = nz;
    }

    const line = [];
    let cx = sx, cy = sy, cz = sz;
    while (inBounds(cx, cy, cz) && board[cx][cy][cz] === player) {
      line.push([cx, cy, cz]);
      cx += dx; cy += dy; cz += dz;
    }

    if (line.length >= 4) return line.slice(0, 4);
  }
  return null;
}

export function boardIsFull(board) {
  for (let x = 0; x < SIZE; x++)
    for (let y = 0; y < SIZE; y++)
      for (let z = 0; z < SIZE; z++)
        if (board[x][y][z] === EMPTY) return false;
  return true;
}

export function checkWin(board, player) {
  for (const line of WIN_LINES) {
    let ok = true;
    for (const [x, y, z] of line) {
      if (board[x][y][z] !== player) { ok = false; break; }
    }
    if (ok) return line;
  }
  return null;
}

export function legalMoves(board) {
  const moves = [];
  for (let x = 0; x < SIZE; x++)
    for (let y = 0; y < SIZE; y++)
      for (let z = 0; z < SIZE; z++)
        if (board[x][y][z] === EMPTY) moves.push([x, y, z]);
  return moves;
}
