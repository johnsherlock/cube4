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
    return {
      playersCount: Number(playersSel.value) === 1 ? 1 : 2,
      aiLevel: clampInt(Number(difficultySel.value), 1, 5),
      firstMovePolicy: firstMoveSel.value,
      matchStyle: matchSel.value,
    };
  }

  function applySettings(next, { isInitial = false } = {}) {
    const prevPlayersCount = state.playersCount;
    const prevAiLevel = state.aiLevel;

    state.playersCount = next.playersCount;
    state.aiLevel = next.aiLevel;
    state.firstMovePolicy = next.firstMovePolicy;
    state.matchStyle = next.matchStyle;

    const playersChanged = (state.playersCount !== prevPlayersCount);
    const levelChanged = (state.playersCount === 1) && (state.aiLevel !== prevAiLevel);

    difficultyRow.style.display = (state.playersCount === 1) ? "grid" : "none";

    if (playersChanged || levelChanged) {
      wipeScoreboard();
      updateScoreUI();
    }

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
      next.matchStyle !== state.matchStyle
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
