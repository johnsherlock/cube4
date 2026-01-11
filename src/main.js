import * as THREE from "three";

import { state, EMPTY, P1, P2, aiPlayer, clampInt, makeEmptyBoard } from "./game/state.js";
import { keyOf, getWinningLineFrom, boardIsFull } from "./game/rules.js";
import { chooseAIMove, immediateWinningThreats, tryImmediate } from "./game/ai.js";
import { loadPersisted, savePersisted, wipeScoreboard } from "./game/scoring.js";
import { createScene } from "./render/scene.js";
import { createControls } from "./render/controls.js";
import { createCameraFitter, setAutoSpin as setAutoSpinControl } from "./render/camera.js";
import { animatePieceSpawn, nudgeCameraFocusTo, pulseBlockedLine, startWinPulse } from "./render/animations.js";
import { initSettings } from "./ui/settings.js";
import { createOverlayManager } from "./ui/overlays.js";
import { initMobileMenu } from "./ui/mobileMenu.js";

const wrap = document.getElementById("canvasWrap");
const statusEl = document.getElementById("status");
const statusPill = statusEl;
const scoreTextEl = document.getElementById("scoreText");
const difficultyValueEl = document.getElementById("difficultyValue");

const undoBtn = document.getElementById("undoBtn");
const resetBtn = document.getElementById("resetBtn");

const helpBtn = document.getElementById("helpBtn");
const settingsBtn = document.getElementById("settingsBtn");
const mobileMenu = document.getElementById("mobileMenu");

const helpOverlay = document.getElementById("helpOverlay");
const helpPrimaryBtn = document.getElementById("helpPrimaryBtn");
const demoBtn = document.getElementById("demoBtn");

const settingsOverlay = document.getElementById("settingsOverlay");
const playersSel = document.getElementById("playersSel");
const player1Name = document.getElementById("player1Name");
const player2Name = document.getElementById("player2Name");
const player2Row = document.getElementById("player2Row");
const player1Color = document.getElementById("player1Color");
const player2Color = document.getElementById("player2Color");
const player2Label = document.getElementById("player2Label");
const difficultySel = document.getElementById("difficultySel");
const difficultyRow = document.getElementById("difficultyRow");
const firstMoveSel = document.getElementById("firstMoveSel");
const matchSel = document.getElementById("matchSel");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const cancelSettingsBtn = document.getElementById("cancelSettingsBtn");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlaySub = document.getElementById("overlaySub");
const playAgainBtn = document.getElementById("playAgainBtn");
const difficultyPrompt = document.getElementById("difficultyPrompt");

const confirmOverlay = document.getElementById("confirmOverlay");
const confirmYesBtn = document.getElementById("confirmYesBtn");
const confirmNoBtn = document.getElementById("confirmNoBtn");
const confirmTitle = document.getElementById("confirmTitle");
const confirmBody = document.getElementById("confirmBody");
const cpuLevelText = document.getElementById("cpuLevelText");
const diffDownBtn = document.getElementById("diffDownBtn");
const diffKeepBtn = document.getElementById("diffKeepBtn");
const diffUpBtn = document.getElementById("diffUpBtn");
const exitDemoBtn = document.getElementById("exitDemoBtn");

const isCoarsePointer = matchMedia('(pointer: coarse)').matches;

const sceneBundle = createScene({ wrap, state });
const {
  scene,
  camera,
  renderer,
  frameMat,
  tierPickGroup,
  pickGroup,
  pickByKey,
  piecesByKey,
  updateTierVisibility,
  resetMarkers,
  placePiece,
  removePiece,
  addWinOutlineToPiece,
  clearWinOutlines,
  clearPieces,
} = sceneBundle;

const controls = createControls({
  camera,
  renderer,
  onStart: () => {
    if (state.gameOver && controls.autoRotate) setAutoSpin(false);
  },
});

controls.addEventListener("end", () => {
  if (state.gameOver) setAutoSpin(true);
});

const { fitCameraToCube } = createCameraFitter({ camera, controls, frame: sceneBundle.frame });
const setAutoSpin = (on) => setAutoSpinControl(controls, on);
setAutoSpin(false);

function setVH() {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  wrap.classList.add('vhfix');
}
window.addEventListener('resize', setVH);
window.addEventListener('orientationchange', setVH);
setVH();

updateTierVisibility();

function playerColor(player) { return player === P1 ? state.player1Color : state.player2Color; }
function playerHex(player) { return parseInt(playerColor(player).replace("#", ""), 16); }
function playerName(player) { return player === P1 ? state.player1Name : state.player2Name; }

function updateFrameForCurrentPlayer() {
  frameMat.color.setHex(playerHex(state.currentPlayer));
}

function refreshPlayerColors() {
  updateScoreUI();
  updateStatusForPlayer(state.currentPlayer);
  updateFrameForCurrentPlayer();
  for (const piece of piecesByKey.values()) {
    const p = piece.userData?.player;
    if (!p || !piece.material?.color) continue;
    piece.material.color.setHex(playerHex(p));
  }
}

function updateScoreUI() {
  const leftName = document.createElement("span");
  leftName.className = "scoreName";
  leftName.style.color = playerColor(P1);
  leftName.textContent = state.player1Name;
  const leftScore = document.createElement("span");
  leftScore.className = "scoreValue";
  leftScore.textContent = String(state.winsP1);
  const mid = document.createTextNode(" - ");
  const rightScore = document.createElement("span");
  rightScore.className = "scoreValue";
  rightScore.textContent = String(state.winsP2);
  const rightName = document.createElement("span");
  rightName.className = "scoreName";
  rightName.style.color = playerColor(P2);
  rightName.textContent = state.player2Name;
  scoreTextEl.replaceChildren(leftName, document.createTextNode(" "), leftScore, mid, rightScore, document.createTextNode(" "), rightName);
  if (difficultyValueEl) difficultyValueEl.textContent = String(state.aiLevel || 1);
}

function setPillAccentForPlayer(el, player, alpha = 0.28, borderAlpha = 0.45) {
  const hex = playerHex(player);
  el.style.setProperty('--pill-accent', `rgba(${(hex >> 16) & 255}, ${(hex >> 8) & 255}, ${hex & 255}, ${alpha})`);
  el.style.borderColor = `rgba(${(hex >> 16) & 255}, ${(hex >> 8) & 255}, ${hex & 255}, ${borderAlpha})`;
}

function updateStatusForPlayer(player) {
  statusEl.textContent = `Current move: ${playerName(player)}`;
  setPillAccentForPlayer(statusPill, player, 0.30, 0.55);
}

function isOnePlayerMode() {
  return state.playersCount === 1;
}

function isAITurn() {
  return state.demoMode || ((state.playersCount === 1) && (state.currentPlayer === aiPlayer));
}

function getScoreLine() {
  return `Match score: ${state.player1Name} ${state.winsP1} - ${state.winsP2} ${state.player2Name}`;
}

function matchStyleTargetWins() {
  if (state.matchStyle === "bo3") return 2;
  if (state.matchStyle === "bo5") return 3;
  return Infinity;
}

function matchStyleLabel() {
  if (state.matchStyle === "bo3") return "Best of 3";
  if (state.matchStyle === "bo5") return "Best of 5";
  return "Unbounded";
}

function isMatchOver() {
  const target = matchStyleTargetWins();
  return state.winsP1 >= target || state.winsP2 >= target;
}

function chooseStartingPlayer() {
  if (state.firstMovePolicy === "red") return P1;
  if (state.firstMovePolicy === "blue") return P2;

  if (state.firstMovePolicy === "winner" && (state.lastWinner === P1 || state.lastWinner === P2)) return state.lastWinner;
  if (state.firstMovePolicy === "alternate" && (state.lastStartingPlayer === P1 || state.lastStartingPlayer === P2)) {
    return state.lastStartingPlayer === P1 ? P2 : P1;
  }
  return Math.random() < 0.5 ? P1 : P2;
}

function clearSelection() {
  state.selectedLevelZ = null;
  updateTierVisibility();
}

let mobile;
let confirmApply = null;

function syncMobileMenuVisibility() {
  mobile?.syncMobileMenuVisibility?.();
}

const settings = initSettings({
  elements: {
    settingsOverlay,
    playersSel,
    player1Name,
    player2Name,
    player2Row,
    player2Label,
    player1Color,
    player2Color,
    difficultySel,
    difficultyRow,
    firstMoveSel,
    matchSel,
    closeSettingsBtn,
    cancelSettingsBtn,
  },
  syncMobileMenuVisibility,
  resetBoardOnly,
  updateScoreUI,
  confirmApply: (opts) => confirmApply?.(opts),
  onCancel: () => {
    if (!state.hasCompletedWelcome) {
      overlays.showHelp("welcome");
    }
  },
  onColorsChanged: () => refreshPlayerColors(),
});

const overlays = createOverlayManager({
  elements: {
    helpOverlay,
    helpPrimaryBtn,
    demoBtn,
    settingsOverlay,
    confirmOverlay,
    confirmYesBtn,
    confirmNoBtn,
    confirmTitle,
    confirmBody,
    overlay,
    overlayTitle,
    overlaySub,
    playAgainBtn,
    difficultyPrompt,
    cpuLevelText,
    diffUpBtn,
  },
  state,
  helpers: {
    fitCameraToCube,
    setAutoSpin,
    showSettings: settings.showSettings,
    hideSettings: settings.hideSettings,
    isMatchOver,
    isOnePlayerMode,
    matchStyleLabel,
    playerName,
    playerColor,
    getScoreLine,
  },
  onConfirmReset: () => resetMatch(),
});
confirmApply = overlays.showConfirm;

mobile = initMobileMenu({
  mobileMenu,
  onUndo: () => undoMove(),
  onReset: () => overlays.showConfirmReset(),
  onOptions: () => settings.showSettings(),
  onHelp: () => overlays.showHelp("rules"),
});

let demoSnapshot = null;

function setDemoUI(on) {
  if (exitDemoBtn) exitDemoBtn.style.display = on ? "inline-flex" : "none";
}

function startDemoMode() {
  demoSnapshot = {
    playersCount: state.playersCount,
    aiLevel: state.aiLevel,
    firstMovePolicy: state.firstMovePolicy,
    matchStyle: state.matchStyle,
    player1Name: state.player1Name,
    player2Name: state.player2Name,
    winsP1: state.winsP1,
    winsP2: state.winsP2,
    lastWinner: state.lastWinner,
    lastStartingPlayer: state.lastStartingPlayer,
    hasCompletedWelcome: state.hasCompletedWelcome,
  };

  state.demoMode = true;
  state.playersCount = 2;
  state.player1Name = "CPU 1";
  state.player2Name = "CPU 2";
  state.winsP1 = 0;
  state.winsP2 = 0;
  state.lastWinner = null;
  state.lastStartingPlayer = null;
  state.hasCompletedWelcome = false;
  updateScoreUI();
  setDemoUI(true);
  overlays.hideHelp();
  resetBoardOnly();
}

function exitDemoMode() {
  state.demoMode = false;
  setDemoUI(false);

  if (demoSnapshot) {
    state.playersCount = demoSnapshot.playersCount;
    state.aiLevel = demoSnapshot.aiLevel;
    state.firstMovePolicy = demoSnapshot.firstMovePolicy;
    state.matchStyle = demoSnapshot.matchStyle;
    state.player1Name = demoSnapshot.player1Name;
    state.player2Name = demoSnapshot.player2Name;
    state.winsP1 = demoSnapshot.winsP1;
    state.winsP2 = demoSnapshot.winsP2;
    state.lastWinner = demoSnapshot.lastWinner;
    state.lastStartingPlayer = demoSnapshot.lastStartingPlayer;
    state.hasCompletedWelcome = demoSnapshot.hasCompletedWelcome;
    demoSnapshot = null;
  }

  updateScoreUI();
  resetBoardOnly();
  overlays.showHelp("welcome");
}

function resetBoardOnly() {
  setAutoSpin(false);
  mobile.syncMobileMenuVisibility();
  state.board = makeEmptyBoard();
  state.gameOver = false;

  clearWinPulse();
  clearPieces();
  resetMarkers();
  clearSelection();

  state.lastMove = null;
  undoBtn.disabled = true;
  overlays.hideOverlay();

  state.currentPlayer = chooseStartingPlayer();
  state.lastStartingPlayer = state.currentPlayer;

  updateStatusForPlayer(state.currentPlayer);
  updateFrameForCurrentPlayer();

  undoBtn.style.display = (state.playersCount === 2) ? "inline-block" : "none";

  mobile.syncMobileMenuVisibility();

  if (!state.demoMode) savePersisted();

  state.userHasMovedCamera = false;
  state.initialFitDone = false;
  fitCameraToCube();
  state.initialFitDone = true;

  maybeAIMove();
}

function resetMatch() {
  setAutoSpin(false);
  if (!state.demoMode) {
    wipeScoreboard();
    updateScoreUI();
  } else {
    state.winsP1 = 0;
    state.winsP2 = 0;
    updateScoreUI();
  }
  resetBoardOnly();
}

function undoMove() {
  if (!state.lastMove) return;

  if (state.gameOver) {
    state.gameOver = false;
    overlays.hideOverlay();
  }

  clearWinPulse();
  clearWinOutlines();

  const last = state.lastMove;
  state.lastMove = null;
  removePiece(last.x, last.y, last.z);

  state.currentPlayer = last.player;
  updateStatusForPlayer(state.currentPlayer);
  updateFrameForCurrentPlayer();

  undoBtn.disabled = true;
  clearSelection();
}

function finishWin(player, winning4) {
  clearWinPulse();
  clearWinOutlines();
  for (const [wx, wy, wz] of winning4) {
    const piece = piecesByKey.get(keyOf(wx, wy, wz));
    if (piece) addWinOutlineToPiece(piece);
  }

  frameMat.color.setHex(playerHex(player));
  state.gameOver = true;

  if (player === P1) state.winsP1++; else state.winsP2++;
  state.lastWinner = player;
  updateScoreUI();
  if (!state.demoMode) savePersisted();

  overlays.showOverlay("win", player);

  setAutoSpin(true);
  winPulseTimeout = setTimeout(() => {
    winPulseTimeout = null;
    stopWinPulse = startWinPulse(winning4, player, piecesByKey, { durationMs: 1800 });
  }, 480);
}

let stopWinPulse = null;
let winPulseTimeout = null;
let aiThinking = false;

function clearWinPulse() {
  if (winPulseTimeout) {
    clearTimeout(winPulseTimeout);
    winPulseTimeout = null;
  }
  if (stopWinPulse) {
    stopWinPulse();
    stopWinPulse = null;
  }
}

function maybeAIMove() {
  if (!state.hasCompletedWelcome && !state.demoMode) return;
  if (state.gameOver) return;
  if (!state.demoMode && state.playersCount !== 1) return;
  if (!state.demoMode && state.currentPlayer !== aiPlayer) return;

  aiThinking = true;
  const thinkDelayMs = 1000 + Math.floor(Math.random() * 2000);

  setTimeout(() => {
    if (!state.demoMode && (state.playersCount !== 1 || state.currentPlayer !== aiPlayer)) {
      aiThinking = false;
      return;
    }
    if (state.gameOver) {
      aiThinking = false;
      return;
    }

    const aiSide = state.demoMode ? state.currentPlayer : aiPlayer;
    const mv = chooseAIMove(aiSide);
    if (!mv) { aiThinking = false; return; }
    const [x, y, z] = mv;
    if (state.board[x][y][z] !== EMPTY) { aiThinking = false; return; }

    const player = aiSide;
    const opponent = (player === P1) ? P2 : P1;
    const preThreats = immediateWinningThreats(opponent);

    const cpuPiece = placePiece(x, y, z, player, playerHex(player));
    animatePieceSpawn(cpuPiece, player, playerHex);
    nudgeCameraFocusTo(controls, cpuPiece.position);

    const blockedLine = preThreats.get(keyOf(x, y, z));
    if (blockedLine) setTimeout(() => pulseBlockedLine(blockedLine, opponent, piecesByKey), 90);

    state.lastMove = { x, y, z, player };
    undoBtn.disabled = true;
    clearSelection();

    const winning4 = getWinningLineFrom(state.board, x, y, z, player);
    if (winning4) {
      aiThinking = false;
      finishWin(player, winning4);
      return;
    }

    if (boardIsFull(state.board)) {
      state.gameOver = true;
      aiThinking = false;
      overlays.showOverlay("draw");
      setAutoSpin(true);
      return;
    }

    state.currentPlayer = (state.currentPlayer === P1) ? P2 : P1;
    updateStatusForPlayer(state.currentPlayer);
    updateFrameForCurrentPlayer();

    aiThinking = false;

    if (state.demoMode) {
      maybeAIMove();
    }
  }, thinkDelayMs);
}

undoBtn.addEventListener("click", undoMove);
resetBtn.addEventListener("click", () => overlays.showConfirmReset());

playAgainBtn.addEventListener("click", () => {
  if (isMatchOver()) {
    resetMatch();
  } else {
    resetBoardOnly();
  }
});

function applyDifficultyDelta(delta) {
  state.aiLevel = clampInt(state.aiLevel + delta, 1, 5);
  difficultySel.value = String(state.aiLevel);
  savePersisted();
  resetMatch();
}

diffDownBtn?.addEventListener?.("click", () => applyDifficultyDelta(-1));
diffUpBtn?.addEventListener?.("click", () => applyDifficultyDelta(+1));
diffKeepBtn?.addEventListener?.("click", () => applyDifficultyDelta(0));

helpBtn.addEventListener("click", () => {
  overlays.showHelp("rules");
});

settingsBtn.addEventListener("click", () => {
  settings.showSettings();
});

demoBtn?.addEventListener?.("click", () => {
  startDemoMode();
});

exitDemoBtn?.addEventListener?.("click", () => {
  exitDemoMode();
});

window.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape") return;

  if (helpOverlay.style.display === "flex" && overlays.getHelpMode() === "rules") {
    overlays.hideHelp();
    return;
  }

  if (!isCoarsePointer && settingsOverlay.style.display !== "flex" && helpOverlay.style.display !== "flex") {
    clearSelection();
  }
});

// --- Pointer handling: two-click selection on ALL devices ---
function hapticTap() {
  try {
    if (navigator.vibrate) navigator.vibrate(10);
  } catch {}
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let downPos = null;
let downTime = 0;
const CLICK_MOVE_TOL = matchMedia('(pointer: coarse)').matches ? 14 : 6;
const CLICK_TIME_TOL = matchMedia('(pointer: coarse)').matches ? 800 : 650;

const activePointers = new Set();
let hadMultiTouch = false;

renderer.domElement.addEventListener("pointerdown", (ev) => {
  state.userHasMovedCamera = true;
  if (settingsOverlay.style.display === "flex") return;

  activePointers.add(ev.pointerId);
  if (activePointers.size > 1) {
    hadMultiTouch = true;
    downPos = null;
    return;
  }

  downPos = { x: ev.clientX, y: ev.clientY };
  downTime = performance.now();
});

renderer.domElement.addEventListener("pointercancel", (ev) => {
  activePointers.delete(ev.pointerId);
  if (activePointers.size === 0) {
    downPos = null;
    hadMultiTouch = false;
  }
});

renderer.domElement.addEventListener("pointerup", (ev) => {
  activePointers.delete(ev.pointerId);
  if (settingsOverlay.style.display === "flex") return;

  if (hadMultiTouch) {
    if (activePointers.size === 0) hadMultiTouch = false;
    return;
  }

  if (!downPos) return;
  const dx = ev.clientX - downPos.x;
  const dy = ev.clientY - downPos.y;
  const dist = Math.hypot(dx, dy);
  const dt = performance.now() - downTime;
  downPos = null;

  if (dist > CLICK_MOVE_TOL) return;
  if (dt > CLICK_TIME_TOL) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

  raycaster.setFromCamera(mouse, camera);

  const targets = (state.selectedLevelZ === null)
    ? [tierPickGroup, pickGroup]
    : [pickGroup];

  const hits = raycaster.intersectObjects(targets, true);
  const hit = hits.find(h => {
    const o = h.object;
    if (!o) return false;
    if (o.userData?.kind === "tier") return !!o.visible;
    if (o.userData?.kind === "pick") return !!o.visible;
    return false;
  });

  if (!hit) {
    clearSelection();
    return;
  }

  if (state.gameOver) return;
  if (isAITurn() || aiThinking) return;

  const obj = hit.object;
  const hadSelectionAtClick = (state.selectedLevelZ !== null);

  if (obj.userData?.kind === "tier") {
    if (state.selectedLevelZ !== null) {
      clearSelection();
      return;
    }
    state.selectedLevelZ = obj.userData.zTier;
    updateTierVisibility();
    hapticTap();
    return;
  }

  const { x, y, z } = obj.userData;

  if (!hadSelectionAtClick) {
    state.selectedLevelZ = z;
    updateTierVisibility();
    hapticTap();
    return;
  }

  if (state.selectedLevelZ !== z) {
    if (!isCoarsePointer) clearSelection();
    return;
  }

  if (state.gameOver) return;
  if (state.board[x][y][z] !== EMPTY) return;

  const player = state.currentPlayer;
  const opponent = (player === P1) ? P2 : P1;
  const preThreats = immediateWinningThreats(opponent);

  const placedPiece = placePiece(x, y, z, player, playerHex(player));
  animatePieceSpawn(placedPiece, player, playerHex);
  hapticTap();

  const blockedLine = preThreats.get(keyOf(x, y, z));
  if (blockedLine) setTimeout(() => pulseBlockedLine(blockedLine, opponent, piecesByKey), 110);

  state.lastMove = { x, y, z, player };

  if (state.playersCount === 2) {
    undoBtn.style.display = "inline-block";
    undoBtn.disabled = false;
  } else {
    undoBtn.style.display = "none";
    undoBtn.disabled = true;
  }

  clearSelection();

  const winning4 = getWinningLineFrom(state.board, x, y, z, player);
  if (winning4) {
    finishWin(player, winning4);
    return;
  }

  if (boardIsFull(state.board)) {
    state.gameOver = true;
    overlays.showOverlay("draw");
    return;
  }

  state.currentPlayer = (state.currentPlayer === P1) ? P2 : P1;
  updateStatusForPlayer(state.currentPlayer);
  updateFrameForCurrentPlayer();

  maybeAIMove();
});

function resize() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  if (!state.initialFitDone) {
    fitCameraToCube();
    state.initialFitDone = true;
    return;
  }

  if (!state.userHasMovedCamera) {
    fitCameraToCube();
  }
}

window.addEventListener("resize", resize);

const ro = new ResizeObserver(() => resize());
ro.observe(wrap);

requestAnimationFrame(() => {
  setVH();
  resize();
});

resize();

function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();

loadPersisted();
if (state.playersCount === 1) state.player2Name = "CPU";
updateScoreUI();
settings.syncSettingsUI();
mobile.syncMobileMenuVisibility();
undoBtn.style.display = (state.playersCount === 2) ? "inline-block" : "none";

overlays.showHelp("welcome");

function assert(cond, msg) {
  if (!cond) throw new Error(`Self-test failed: ${msg}`);
}

function runSelfTests() {
  state.board = makeEmptyBoard();
  for (let i = 0; i < 4; i++) state.board[i][i][i] = P1;
  const w1 = getWinningLineFrom(state.board, 1, 1, 1, P1);
  assert(Array.isArray(w1) && w1.length === 4, "XYZ diagonal win not detected");

  state.board = makeEmptyBoard();
  for (let x = 0; x < 4; x++) state.board[x][0][0] = P2;
  const w2 = getWinningLineFrom(state.board, 2, 0, 0, P2);
  assert(Array.isArray(w2) && w2.length === 4, "X-axis win not detected");

  state.board = makeEmptyBoard();
  for (let z = 0; z < 4; z++) state.board[0][0][z] = P1;
  const w3 = getWinningLineFrom(state.board, 0, 0, 2, P1);
  assert(Array.isArray(w3) && w3.length === 4, "Z-axis win not detected");

  state.board = makeEmptyBoard();
  state.board[0][0][0] = P1;
  state.board[1][1][0] = P1;
  state.board[2][2][1] = P1;
  state.board[3][3][2] = P1;
  const w4 = getWinningLineFrom(state.board, 3, 3, 2, P1);
  assert(w4 === null, "False positive win detected");

  state.board = makeEmptyBoard();
  state.board[0][0][0] = P2;
  state.board[1][0][0] = P2;
  state.board[2][0][0] = P2;
  const mv = tryImmediate(P2);
  assert(Array.isArray(mv) && mv[0] === 3 && mv[1] === 0 && mv[2] === 0, "AI immediate win not found");

  state.board = makeEmptyBoard();
  state.board[0][0][0] = P1;
  state.board[1][0][0] = P1;
  state.board[2][0][0] = P1;
  const threats = immediateWinningThreats(P1);
  assert(threats.has(keyOf(3, 0, 0)), "Immediate threat not detected for block test");

  let tLevel = 999;
  tLevel = clampInt(tLevel, 1, 5);
  assert(tLevel === 5, "clampInt upper bound failed");

  state.selectedLevelZ = null;
  updateTierVisibility();
  state.selectedLevelZ = 0;
  updateTierVisibility();
  state.selectedLevelZ = null;
  updateTierVisibility();

  state.board = makeEmptyBoard();
}

runSelfTests();

state.currentPlayer = chooseStartingPlayer();
state.lastStartingPlayer = state.currentPlayer;
updateStatusForPlayer(state.currentPlayer);
updateFrameForCurrentPlayer();
maybeAIMove();
