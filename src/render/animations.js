import * as THREE from "three";
import { keyOf } from "../game/rules.js";

export function animatePieceSpawn(piece, player, playerHex, { durationMs = 450 } = {}) {
  if (!piece) return;

  const start = performance.now();
  const mat = piece.material;

  const fromScale = 1.8;
  const toScale = 1.0;
  piece.scale.setScalar(fromScale);

  const glowHex = playerHex(player);
  mat.emissive.setHex(glowHex);
  mat.emissiveIntensity = 1.2;

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const tick = (now) => {
    const t = Math.min(1, (now - start) / durationMs);
    const e = easeOutCubic(t);

    const s = fromScale + (toScale - fromScale) * e;
    piece.scale.setScalar(s);

    mat.emissiveIntensity = 1.2 * (1 - e);

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      piece.scale.setScalar(1.0);
      if (piece.userData) {
        piece.userData.baseScale = 1.0;
        piece.userData.baseColorHex = mat?.color?.getHex?.() ?? piece.userData.baseColorHex;
        piece.userData.baseEmissiveHex = 0x000000;
      }
      mat.emissiveIntensity = 0.0;
      mat.emissive.setHex(0x000000);
    }
  };

  requestAnimationFrame(tick);
}

export function nudgeCameraFocusTo(controls, worldPos, { durationMs = 320, strength = 0.22, maxShift = 0.7 } = {}) {
  if (!worldPos) return;

  const start = performance.now();
  const from = controls.target.clone();
  const delta = new THREE.Vector3().subVectors(worldPos, from);

  const desiredShift = delta.multiplyScalar(strength);
  if (desiredShift.length() > maxShift) desiredShift.setLength(maxShift);
  const to = from.clone().add(desiredShift);

  const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);

  const tick = (now) => {
    const t = Math.min(1, (now - start) / durationMs);
    const e = easeOutQuad(t);
    controls.target.lerpVectors(from, to, e);
    controls.update();
    if (t < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

export function pulseBlockedLine(line4, threatenedPlayer, piecesByKey, { durationMs = 650, scaleMax = 1.38, emissiveMax = 0.85 } = {}) {
  if (!Array.isArray(line4) || line4.length !== 4) return;

  const targets = [];
  for (const [x, y, z] of line4) {
    const piece = piecesByKey.get(keyOf(x, y, z));
    if (!piece) continue;
    if (piece.userData?.player !== threatenedPlayer) continue;

    const mat = piece.material;
    const baseColorHex = piece.userData?.baseColorHex ?? mat?.color?.getHex?.() ?? 0xffffff;
    const baseEmissiveHex = piece.userData?.baseEmissiveHex ?? 0x000000;
    targets.push({
      piece,
      baseScale: piece.userData?.baseScale ?? 1.0,
      baseColor: new THREE.Color(baseColorHex),
      baseEmissive: new THREE.Color(baseEmissiveHex),
      baseColorHex,
      baseEmissiveHex,
      baseEmissiveIntensity: (mat && 'emissiveIntensity' in mat) ? (mat.emissiveIntensity || 0) : 0,
    });
  }

  if (targets.length === 0) return;

  const t0 = performance.now();

  const tick = (now) => {
    const t = Math.min(1, (now - t0) / durationMs);
    const ease = t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const pulse = Math.sin(Math.PI * ease);

    for (const it of targets) {
      const s = it.baseScale * (1 + (scaleMax - 1) * pulse);
      it.piece.scale.setScalar(s);

      const mat = it.piece.material;
      if (mat && mat.isMeshStandardMaterial) {
        if (it.baseColor && mat.color) {
          mat.color.copy(it.baseColor).lerp(new THREE.Color(0xffffff), 0.28 * pulse);
        }
        if (it.baseColor && mat.emissive) {
          mat.emissive.copy(it.baseColor);
          mat.emissiveIntensity = it.baseEmissiveIntensity + emissiveMax * pulse;
        }
      }
    }

    if (t < 1) {
      requestAnimationFrame(tick);
      return;
    }

    for (const it of targets) {
      it.piece.scale.setScalar(it.baseScale);
      const mat = it.piece.material;
      if (mat && mat.isMeshStandardMaterial) {
        if (mat.color) mat.color.setHex(it.baseColorHex);
        if (mat.emissive) mat.emissive.setHex(it.baseEmissiveHex);
        if ('emissiveIntensity' in mat) mat.emissiveIntensity = it.baseEmissiveIntensity;
      }
    }
  };

  requestAnimationFrame(tick);
}

export function startWinPulse(line4, winningPlayer, piecesByKey, { durationMs = 1600, scaleMax = 1.10, emissiveMax = 0.55 } = {}) {
  if (!Array.isArray(line4) || line4.length !== 4) return () => {};

  const targets = [];
  for (const [x, y, z] of line4) {
    const piece = piecesByKey.get(keyOf(x, y, z));
    if (!piece) continue;
    if (piece.userData?.player !== winningPlayer) continue;

    const mat = piece.material;
    const baseColorHex = piece.userData?.baseColorHex ?? mat?.color?.getHex?.() ?? 0xffffff;
    const baseEmissiveHex = piece.userData?.baseEmissiveHex ?? 0x000000;
    targets.push({
      piece,
      baseScale: piece.userData?.baseScale ?? 1.0,
      baseColor: new THREE.Color(baseColorHex),
      baseEmissive: new THREE.Color(baseEmissiveHex),
      baseColorHex,
      baseEmissiveHex,
      baseEmissiveIntensity: (mat && 'emissiveIntensity' in mat) ? (mat.emissiveIntensity || 0) : 0,
    });
  }

  if (targets.length === 0) return () => {};

  let stopped = false;
  let rafId = 0;
  const t0 = performance.now();

  const tick = (now) => {
    if (stopped) return;
    const t = ((now - t0) % durationMs) / durationMs;
    const ease = t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const pulse = Math.sin(Math.PI * ease);

    for (const it of targets) {
      const s = it.baseScale * (1 + (scaleMax - 1) * pulse);
      it.piece.scale.setScalar(s);

      const mat = it.piece.material;
      if (mat && mat.isMeshStandardMaterial) {
        if (it.baseColor && mat.color) {
          mat.color.copy(it.baseColor).lerp(new THREE.Color(0xffffff), 0.18 * pulse);
        }
        if (it.baseColor && mat.emissive) {
          mat.emissive.copy(it.baseColor);
          mat.emissiveIntensity = it.baseEmissiveIntensity + emissiveMax * pulse;
        }
      }
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    for (const it of targets) {
      it.piece.scale.setScalar(it.baseScale);
      const mat = it.piece.material;
      if (mat && mat.isMeshStandardMaterial) {
        if (mat.color) mat.color.setHex(it.baseColorHex);
        if (mat.emissive) mat.emissive.setHex(it.baseEmissiveHex);
        if ('emissiveIntensity' in mat) mat.emissiveIntensity = it.baseEmissiveIntensity;
      }
    }
  };
}
