import { state } from "../game/state.js";

export function initMobileMenu({ mobileMenu, onUndo, onReset, onOptions, onHelp }) {
  function syncMobileMenuVisibility() {
    const undoOpt = mobileMenu?.querySelector('option[value="undo"]');
    if (undoOpt) undoOpt.hidden = (state.playersCount !== 2);
  }

  mobileMenu?.addEventListener?.("change", () => {
    const v = mobileMenu.value;
    mobileMenu.value = "";
    if (!v) return;

    if (v === "undo") {
      if (state.playersCount === 2) onUndo();
      return;
    }
    if (v === "reset") {
      onReset();
      return;
    }
    if (v === "options") {
      onOptions();
      return;
    }
    if (v === "help") {
      onHelp();
      return;
    }
  });

  return { syncMobileMenuVisibility };
}
