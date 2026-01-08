import { state, clampInt } from "../game/state.js";
import { savePersisted, wipeScoreboard } from "../game/scoring.js";

export function initSettings({
  elements,
  syncMobileMenuVisibility,
  resetBoardOnly,
  updateScoreUI,
  confirmApply,
}) {
  const {
    settingsOverlay,
    playersSel,
    player1Name,
    player2Name,
    difficultySel,
    difficultyRow,
    firstMoveSel,
    matchSel,
    closeSettingsBtn,
  } = elements;

  function syncSettingsUI() {
    playersSel.value = String(state.playersCount);
    difficultySel.value = String(state.aiLevel);
    firstMoveSel.value = state.firstMovePolicy;
    matchSel.value = state.matchStyle;
    if (player1Name) player1Name.value = state.player1Name || "Player 1";
    if (player2Name) player2Name.value = state.player2Name || "Player 2";
    difficultyRow.style.display = (state.playersCount === 1) ? "grid" : "none";
  }

  function showSettings() {
    syncSettingsUI();
    settingsOverlay.style.display = "flex";
    settingsOverlay.setAttribute("aria-hidden", "false");
    closeSettingsBtn.textContent = state.hasCompletedWelcome ? "Apply" : "Start match";
    closeSettingsBtn?.focus?.();
  }

  function hideSettings() {
    settingsOverlay.style.display = "none";
    settingsOverlay.setAttribute("aria-hidden", "true");
  }

  function readSettingsFromUI() {
    const p1Default = "Player 1";
    const p2Default = "Player 2";
    const p1 = (player1Name?.value || "").trim() || p1Default;
    const p2 = (player2Name?.value || "").trim() || p2Default;
    return {
      playersCount: Number(playersSel.value) === 1 ? 1 : 2,
      aiLevel: clampInt(Number(difficultySel.value), 1, 5),
      firstMovePolicy: firstMoveSel.value,
      matchStyle: matchSel.value,
      player1Name: p1,
      player2Name: p2,
    };
  }

  function applySettings(next, { isInitial = false } = {}) {
    const prevPlayersCount = state.playersCount;
    const prevAiLevel = state.aiLevel;
    const prevName1 = state.player1Name;
    const prevName2 = state.player2Name;

    state.playersCount = next.playersCount;
    state.aiLevel = next.aiLevel;
    state.firstMovePolicy = next.firstMovePolicy;
    state.matchStyle = next.matchStyle;
    state.player1Name = next.player1Name;
    state.player2Name = next.player2Name;

    const playersChanged = (state.playersCount !== prevPlayersCount);
    const levelChanged = (state.playersCount === 1) && (state.aiLevel !== prevAiLevel);
    const namesChanged = (state.player1Name !== prevName1) || (state.player2Name !== prevName2);

    difficultyRow.style.display = (state.playersCount === 1) ? "grid" : "none";

    if (playersChanged || levelChanged) {
      wipeScoreboard();
      updateScoreUI();
    }
    if (namesChanged) updateScoreUI();

    savePersisted();
    syncMobileMenuVisibility();
    resetBoardOnly();

    if (isInitial) state.hasCompletedWelcome = true;
  }

  playersSel.addEventListener("change", () => {
    const next = Number(playersSel.value);
    difficultyRow.style.display = (next === 1) ? "grid" : "none";
  });

  closeSettingsBtn.addEventListener("click", () => {
    const next = readSettingsFromUI();
    const hasChanges = (
      next.playersCount !== state.playersCount ||
      next.aiLevel !== state.aiLevel ||
      next.firstMovePolicy !== state.firstMovePolicy ||
      next.matchStyle !== state.matchStyle ||
      next.player1Name !== state.player1Name ||
      next.player2Name !== state.player2Name
    );

    const doApply = () => {
      applySettings(next, { isInitial: !state.hasCompletedWelcome });
      hideSettings();
      if (!state.hasCompletedWelcome) state.hasCompletedWelcome = true;
    };

    if (hasChanges && typeof confirmApply === "function") {
      confirmApply({
        title: "Apply match options?",
        body: "Changing match options will reset the current game.",
        confirmLabel: "Apply & reset",
        onConfirm: doApply,
      });
      return;
    }

    doApply();
  });

  return {
    showSettings,
    hideSettings,
    syncSettingsUI,
    applySettingsFromUI: (opts) => applySettings(readSettingsFromUI(), opts),
  };
}
