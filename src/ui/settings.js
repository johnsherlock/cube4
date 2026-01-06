import { state, clampInt } from "../game/state.js";
import { savePersisted, wipeScoreboard } from "../game/scoring.js";

export function initSettings({
  elements,
  syncMobileMenuVisibility,
  resetBoardOnly,
  updateScoreUI,
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

  function applySettingsFromUI({ isInitial = false } = {}) {
    const prevPlayersCount = state.playersCount;
    const prevAiLevel = state.aiLevel;

    state.playersCount = Number(playersSel.value) === 1 ? 1 : 2;
    state.aiLevel = clampInt(Number(difficultySel.value), 1, 5);
    state.firstMovePolicy = firstMoveSel.value;
    state.matchStyle = matchSel.value;

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
    applySettingsFromUI({ isInitial: !state.hasCompletedWelcome });
    hideSettings();
    if (!state.hasCompletedWelcome) state.hasCompletedWelcome = true;
  });

  return {
    showSettings,
    hideSettings,
    syncSettingsUI,
    applySettingsFromUI,
  };
}
