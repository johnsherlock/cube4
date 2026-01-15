import { state, clampInt } from "../game/state.js";
import { savePersisted, wipeScoreboard } from "../game/scoring.js";

export function initSettings({
  elements,
  syncMobileMenuVisibility,
  resetBoardOnly,
  updateScoreUI,
  confirmApply,
  onCancel,
  onColorsChanged,
}) {
  const {
    settingsOverlay,
    playersSel,
    player1Name,
    player2Name,
    player2Row,
    player2Label,
    player1Color,
    player2Color,
    timerToggle,
    timeP1,
    timeP2,
    timeRowP1,
    timeRowP2,
    difficultySel,
    difficultyRow,
    firstMoveSel,
    matchSel,
    closeSettingsBtn,
    cancelSettingsBtn,
  } = elements;

  const COLOR_SWATCHES = [
    "#ef4444",
    "#3b82f6",
    "#22c55e",
    "#f97316",
    "#facc15",
    "#a855f7",
    "#ec4899",
    "#14b8a6",
  ];

  let localP1Color = state.player1Color;
  let localP2Color = state.player2Color;

  function normalizeName(value, fallback) {
    return (value || "").trim() || fallback;
  }

  function renderSwatches(container, selected, other, onSelect) {
    if (!container) return;
    container.innerHTML = "";
    for (const color of COLOR_SWATCHES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch";
      btn.style.background = color;
      btn.setAttribute("aria-label", `Pick ${color}`);
      const isBlocked = color === other;
      if (color === selected) btn.classList.add("selected");
      if (isBlocked && color !== selected) btn.disabled = true;
      btn.addEventListener("click", () => onSelect(color));
      container.appendChild(btn);
    }
  }

  function isNameValid() {
    const p1 = (player1Name?.value || "").trim();
    if (!p1) return false;
    if (Number(playersSel.value) === 2) {
      const p2 = (player2Name?.value || "").trim();
      if (!p2) return false;
    }
    return true;
  }

  function isTimeValid() {
    if (timerToggle?.value !== "on") return true;
    const t1 = Number(timeP1?.value);
    if (!Number.isFinite(t1) || t1 <= 0) return false;
    if (Number(playersSel.value) === 2) {
      const t2 = Number(timeP2?.value);
      if (!Number.isFinite(t2) || t2 <= 0) return false;
    }
    return true;
  }

  function updateStartButtonState() {
    const ok = isNameValid() && isTimeValid();
    if (closeSettingsBtn) closeSettingsBtn.disabled = !ok;
  }

  function syncSwatches() {
    renderSwatches(player1Color, localP1Color, localP2Color, (color) => {
      localP1Color = color;
      syncSwatches();
    });
    renderSwatches(player2Color, localP2Color, localP1Color, (color) => {
      localP2Color = color;
      syncSwatches();
    });
  }

  function syncPlayer2Visibility() {
    const isCpu = (Number(playersSel.value) === 1);
    if (player2Label) player2Label.textContent = "Player 2";
    if (player2Row) player2Row.style.display = "grid";
    if (player2Name) {
      player2Name.style.display = "";
      player2Name.readOnly = isCpu;
      player2Name.value = isCpu ? "CPU" : (player2Name.value || "Player 2");
    }
  }

  function syncSettingsUI() {
    playersSel.value = String(state.playersCount);
    difficultySel.value = String(state.aiLevel);
    firstMoveSel.value = state.firstMovePolicy;
    matchSel.value = state.matchStyle;
    if (player1Name) player1Name.value = state.player1Name || "Player 1";
    if (player2Name) {
      const fallback = (state.playersCount === 1) ? "CPU" : "Player 2";
      const next = state.player2Name || fallback;
      player2Name.value = (state.playersCount === 2 && next === "CPU") ? "Player 2" : next;
    }
    difficultyRow.style.display = (state.playersCount === 1) ? "grid" : "none";
    syncPlayer2Visibility();
    if (timerToggle) timerToggle.value = state.timeEnabled ? "on" : "off";
    if (timeP1) timeP1.value = String(state.timeP1Sec || 30);
    if (timeP2) timeP2.value = String(state.timeP2Sec || 30);
    const timerOn = (timerToggle?.value === "on");
    if (timeRowP1) timeRowP1.style.display = timerOn ? "grid" : "none";
    if (timeRowP2) timeRowP2.style.display = (timerOn && Number(playersSel.value) === 2) ? "grid" : "none";
    updateStartButtonState();

    localP1Color = state.player1Color;
    localP2Color = state.player2Color;
    syncSwatches();
  }

  function showSettings() {
    syncSettingsUI();
    settingsOverlay.style.display = "flex";
    settingsOverlay.setAttribute("aria-hidden", "false");
    closeSettingsBtn.textContent = state.hasCompletedWelcome ? "Apply" : "Start match";
    if (cancelSettingsBtn) {
      cancelSettingsBtn.textContent = state.hasCompletedWelcome ? "Close" : "Back";
    }
    closeSettingsBtn?.focus?.();
  }

  function hideSettings() {
    settingsOverlay.style.display = "none";
    settingsOverlay.setAttribute("aria-hidden", "true");
  }

  function readSettingsFromUI() {
    const p1Default = "Player 1";
    const p2Default = "Player 2";
    const p1 = normalizeName(player1Name?.value, p1Default);
    const playersCount = Number(playersSel.value) === 1 ? 1 : 2;
    const p2 = (playersCount === 1) ? "CPU" : normalizeName(player2Name?.value, p2Default);
    return {
      playersCount,
      aiLevel: clampInt(Number(difficultySel.value), 1, 5),
      firstMovePolicy: firstMoveSel.value,
      matchStyle: matchSel.value,
      player1Name: p1,
      player2Name: p2,
      player1Color: localP1Color,
      player2Color: localP2Color,
      timeEnabled: (timerToggle?.value === "on"),
      timeP1Sec: clampInt(Number(timeP1?.value), 1, 36000),
      timeP2Sec: clampInt(Number(timeP2?.value), 1, 36000),
    };
  }

  function applySettings(next, { isInitial = false } = {}) {
    const prevPlayersCount = state.playersCount;
    const prevAiLevel = state.aiLevel;
    const prevName1 = state.player1Name;
    const prevName2 = state.player2Name;
    const prevColor1 = state.player1Color;
    const prevColor2 = state.player2Color;
    const prevFirstMove = state.firstMovePolicy;
    const prevMatchStyle = state.matchStyle;
    const prevTimeEnabled = state.timeEnabled;
    const prevTimeP1Sec = state.timeP1Sec;
    const prevTimeP2Sec = state.timeP2Sec;

    state.playersCount = next.playersCount;
    state.aiLevel = next.aiLevel;
    state.firstMovePolicy = next.firstMovePolicy;
    state.matchStyle = next.matchStyle;
    state.player1Name = next.player1Name;
    state.player2Name = next.player2Name;
    state.player1Color = next.player1Color;
    state.player2Color = next.player2Color;
    state.timeEnabled = next.timeEnabled;
    state.timeP1Sec = next.timeP1Sec;
    state.timeP2Sec = next.timeP2Sec;

    const playersChanged = (state.playersCount !== prevPlayersCount);
    const levelChanged = (state.playersCount === 1) && (state.aiLevel !== prevAiLevel);
    const namesChanged = (state.player1Name !== prevName1) || (state.player2Name !== prevName2);
    const colorsChanged = (state.player1Color !== prevColor1) || (state.player2Color !== prevColor2);
    const firstMoveChanged = (state.firstMovePolicy !== prevFirstMove);
    const matchStyleChanged = (state.matchStyle !== prevMatchStyle);
    const timerChanged = (state.timeEnabled !== prevTimeEnabled) ||
      (state.timeP1Sec !== prevTimeP1Sec) ||
      (state.timeP2Sec !== prevTimeP2Sec);
    const resetRequired = playersChanged || levelChanged || firstMoveChanged || matchStyleChanged || timerChanged;

    difficultyRow.style.display = (state.playersCount === 1) ? "grid" : "none";

    if (playersChanged || levelChanged) {
      wipeScoreboard();
      updateScoreUI();
    }
    if (namesChanged || colorsChanged) updateScoreUI();
    if (colorsChanged && typeof onColorsChanged === "function") onColorsChanged();

    if (isInitial) state.hasCompletedWelcome = true;

    savePersisted();
    syncMobileMenuVisibility();
    if (resetRequired || isInitial) {
      resetBoardOnly();
    }
  }

  playersSel.addEventListener("change", () => {
    const next = Number(playersSel.value);
    difficultyRow.style.display = (next === 1) ? "grid" : "none";
    if (next === 2 && player2Name) {
      const current = (player2Name.value || "").trim();
      if (!current || current === "CPU") player2Name.value = "Player 2";
    }
    syncPlayer2Visibility();
    syncSwatches();
    const timerOn = (timerToggle?.value === "on");
    if (timeRowP2) timeRowP2.style.display = (timerOn && next === 2) ? "grid" : "none";
    updateStartButtonState();
  });

  timerToggle?.addEventListener?.("change", () => {
    const timerOn = (timerToggle.value === "on");
    if (timeRowP1) timeRowP1.style.display = timerOn ? "grid" : "none";
    if (timeRowP2) timeRowP2.style.display = (timerOn && Number(playersSel.value) === 2) ? "grid" : "none";
    updateStartButtonState();
  });

  timeP1?.addEventListener?.("input", updateStartButtonState);
  timeP2?.addEventListener?.("input", updateStartButtonState);

  closeSettingsBtn.addEventListener("click", () => {
    updateStartButtonState();
    if (!isNameValid() || !isTimeValid()) return;
    const next = readSettingsFromUI();
    const resetRequired = (
      next.playersCount !== state.playersCount ||
      next.aiLevel !== state.aiLevel ||
      next.firstMovePolicy !== state.firstMovePolicy ||
      next.matchStyle !== state.matchStyle ||
      next.timeEnabled !== state.timeEnabled ||
      next.timeP1Sec !== state.timeP1Sec ||
      next.timeP2Sec !== state.timeP2Sec
    );
    const hasChanges = resetRequired || (
      next.player1Name !== state.player1Name ||
      next.player2Name !== state.player2Name ||
      next.player1Color !== state.player1Color ||
      next.player2Color !== state.player2Color
    );

    const doApply = () => {
      applySettings(next, { isInitial: !state.hasCompletedWelcome });
      hideSettings();
      if (!state.hasCompletedWelcome) state.hasCompletedWelcome = true;
    };

    if (resetRequired && typeof confirmApply === "function") {
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

  cancelSettingsBtn?.addEventListener?.("click", () => {
    hideSettings();
    if (typeof onCancel === "function") onCancel();
  });

  player1Name?.addEventListener?.("input", updateStartButtonState);
  player2Name?.addEventListener?.("input", updateStartButtonState);

  return {
    showSettings,
    hideSettings,
    syncSettingsUI,
    applySettingsFromUI: (opts) => applySettings(readSettingsFromUI(), opts),
  };
}
