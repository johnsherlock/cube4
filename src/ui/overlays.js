export function createOverlayManager({
  elements,
  state,
  helpers,
  onConfirmReset,
}) {
  const {
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
  } = elements;

  let helpMode = "welcome";
  let reopenSettingsOnClose = false;

  function showHelp(mode) {
    helpMode = mode;
    helpOverlay.style.display = "flex";
    helpOverlay.setAttribute("aria-hidden", "false");

    const titleEl = document.getElementById("helpTitle");
    if (titleEl) titleEl.textContent = (mode === "welcome") ? "Welcome to CUBE4" : "How to play";

    if (helpPrimaryBtn) {
      helpPrimaryBtn.textContent = (mode === "welcome") ? "Start playing" : "Continue";
      helpPrimaryBtn?.focus?.();
    }
    if (demoBtn) demoBtn.style.display = (mode === "welcome") ? "inline-flex" : "none";
  }

  function hideHelp() {
    helpOverlay.style.display = "none";
    helpOverlay.setAttribute("aria-hidden", "true");
    if (!state.userHasMovedCamera) helpers.fitCameraToCube();
  }

  let confirmAction = null;

  function showConfirm({ title, body, confirmLabel, onConfirm } = {}) {
    if (confirmTitle && title) confirmTitle.textContent = title;
    if (confirmBody && body) confirmBody.textContent = body;
    if (confirmYesBtn && confirmLabel) confirmYesBtn.textContent = confirmLabel;
    confirmAction = onConfirm || null;
    reopenSettingsOnClose = (settingsOverlay?.style?.display === "flex");
    if (reopenSettingsOnClose) helpers.hideSettings();
    confirmOverlay.style.display = "flex";
    confirmOverlay.setAttribute("aria-hidden", "false");
    confirmNoBtn?.focus?.();
  }

  function showConfirmReset() {
    showConfirm({
      title: "Reset match?",
      body: "This will clear the board and wipe the scoreboard for the current match.",
      confirmLabel: "Yes",
      onConfirm: onConfirmReset,
    });
  }

  function hideConfirmReset({ restoreSettings = true } = {}) {
    confirmOverlay.style.display = "none";
    confirmOverlay.setAttribute("aria-hidden", "true");
    confirmAction = null;
    if (restoreSettings && reopenSettingsOnClose) helpers.showSettings();
    reopenSettingsOnClose = false;
  }

  function showOverlay(kind, player) {
    overlay.style.display = "flex";

    const matchOver = (kind === "win") ? helpers.isMatchOver() : false;
    const showDiffPrompt = helpers.isOnePlayerMode() && matchOver;

    if (difficultyPrompt) difficultyPrompt.style.display = showDiffPrompt ? "block" : "none";
    if (cpuLevelText) cpuLevelText.textContent = String(state.aiLevel);
    if (diffUpBtn) diffUpBtn.style.display = (state.aiLevel >= 5) ? "none" : "inline-block";

    playAgainBtn.style.display = showDiffPrompt ? "none" : "inline-block";

    if (kind === "win") {
      overlayTitle.textContent = `${helpers.playerName(player).toUpperCase()} WINS!`;
      overlayTitle.style.color = player === 1 ? "#ff4b4b" : "#4aa0ff";

      const scoreLine = helpers.getScoreLine();
      if (matchOver) {
        overlaySub.textContent = `${scoreLine}
MATCH OVER - ${helpers.playerName(player)} wins ${helpers.matchStyleLabel()}.`;
      } else {
        overlaySub.textContent = `${scoreLine}
Rotate and zoom to inspect the winning line.`;
      }

      playAgainBtn.textContent = matchOver ? "New match" : "Next game";
    } else {
      overlayTitle.textContent = "DRAW!";
      overlayTitle.style.color = "#ffffff";
      overlaySub.textContent = `${helpers.getScoreLine()}
No more moves. Rotate/zoom to inspect the final board.`;
      playAgainBtn.textContent = "Next game";
    }
  }

  function hideOverlay() {
    overlay.style.display = "none";
    helpers.setAutoSpin(false);
  }

  helpPrimaryBtn?.addEventListener?.("click", () => {
    if (helpMode === "welcome") {
      hideHelp();
      helpers.showSettings();
    } else {
      hideHelp();
    }
  });

  confirmYesBtn?.addEventListener?.("click", () => {
    const action = confirmAction || onConfirmReset;
    hideConfirmReset({ restoreSettings: false });
    if (action) action();
  });
  confirmNoBtn?.addEventListener?.("click", () => hideConfirmReset());
  confirmOverlay?.addEventListener?.("pointerdown", (ev) => {
    if (ev.target === confirmOverlay) hideConfirmReset();
  });

  return {
    showHelp,
    hideHelp,
    showConfirm,
    showConfirmReset,
    hideConfirmReset,
    showOverlay,
    hideOverlay,
    getHelpMode: () => helpMode,
  };
}
