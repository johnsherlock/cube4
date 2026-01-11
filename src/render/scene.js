import * as THREE from "three";
import { SIZE, EMPTY } from "../game/state.js";
import { keyOf } from "../game/rules.js";

const MARKER_DIM_HEX = 0x707a8f;
const MARKER_BRIGHT_HEX = 0xcfd8ea;

const OP_BASE = 0.18;
const OP_LEVEL_MAX = 0.78;

export function createScene({ wrap, state }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1115);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(8, 8, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  wrap.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(8, 10, 6);
  scene.add(dirLight);

  const grid = new THREE.GridHelper(16, 16, 0x2a2f3a, 0x1d2230);
  grid.position.y = -2.2;
  grid.material.opacity = 0.35;
  grid.material.transparent = true;
  scene.add(grid);

  const frameSize = SIZE - 1;
  const box = new THREE.BoxGeometry(frameSize + 1.4, frameSize + 1.4, frameSize + 1.4);
  const edges = new THREE.EdgesGeometry(box);

  // Slightly thicker outline (note: linewidth ignored on many platforms, but keep intent)
  const frameMat = new THREE.LineBasicMaterial({ color: 0x6f7a92, transparent: true, opacity: 0.42, linewidth: 2 });
  const frame = new THREE.LineSegments(edges, frameMat);
  scene.add(frame);

  const cellGroup = new THREE.Group();
  const pieceGroup = new THREE.Group();
  const tierPickGroup = new THREE.Group();
  const pickGroup = new THREE.Group();

  scene.add(cellGroup);
  scene.add(pieceGroup);
  scene.add(tierPickGroup);
  scene.add(pickGroup);

  const markers = [];
  const markersByKey = new Map();
  const piecesByKey = new Map();
  const winOutlines = [];

  function cellToWorld(x, y, z) {
    const half = (SIZE - 1) / 2;
    return new THREE.Vector3(x - half, z - half, y - half);
  }

  const markerGeom = new THREE.SphereGeometry(0.14, 16, 12);
  const baseMarkerMat = new THREE.MeshStandardMaterial({
    color: MARKER_DIM_HEX,
    transparent: true,
    opacity: OP_BASE,
    roughness: 0.4,
    metalness: 0.0,
  });

  const pickByKey = new Map();
  const pickGeom = new THREE.SphereGeometry(0.30, 12, 10);
  const pickMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    depthTest: false,
  });

  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      for (let z = 0; z < SIZE; z++) {
        const m = new THREE.Mesh(markerGeom, baseMarkerMat.clone());
        m.position.copy(cellToWorld(x, y, z));
        m.userData = { x, y, z, kind: "marker" };
        cellGroup.add(m);
        markers.push(m);
        markersByKey.set(keyOf(x, y, z), m);

        const p = new THREE.Mesh(pickGeom, pickMat.clone());
        p.position.copy(m.position);
        p.userData = { x, y, z, kind: "pick" };
        pickGroup.add(p);
        pickByKey.set(keyOf(x, y, z), p);
      }
    }
  }

  // --- Tier pick slabs ---
  const slabSize = 3.55;
  const slabThickness = 0.55;
  const slabGap = 0.12;

  const slabMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    depthTest: false,
  });

  function addTierSlab(zTier) {
    const yWorld = (zTier - (SIZE - 1) / 2);
    const g = new THREE.BoxGeometry(slabSize, slabThickness - slabGap, slabSize);
    const slab = new THREE.Mesh(g, slabMat.clone());
    slab.position.set(0, yWorld, 0);
    slab.userData = { kind: "tier", zTier };
    tierPickGroup.add(slab);
  }

  for (let z = 0; z < SIZE; z++) addTierSlab(z);

  function updateTierVisibility() {
    const hasSelection = state.selectedLevelZ !== null;
    const board = state.board;

    tierPickGroup.visible = !hasSelection;

    if (!hasSelection) {
      for (const m of markers) {
        const { x, y, z } = m.userData;
        const empty = (board[x][y][z] === EMPTY);
        m.visible = empty;
        if (empty) {
          m.material.opacity = 0.12;
          m.material.color.setHex(MARKER_DIM_HEX);
        }

        const p = pickByKey.get(keyOf(x, y, z));
        if (p) p.visible = false;
      }
      return;
    }

    for (const m of markers) {
      const { x, y, z } = m.userData;
      const empty = (board[x][y][z] === EMPTY);
      const onTier = (z === state.selectedLevelZ);

      m.visible = onTier && empty;
      if (m.visible) {
        m.material.opacity = OP_LEVEL_MAX;
        m.material.color.setHex(MARKER_BRIGHT_HEX);
      }

      const p = pickByKey.get(keyOf(x, y, z));
      if (p) p.visible = onTier && empty;
    }
  }

  function resetMarkers() {
    for (const m of markers) {
      m.scale.setScalar(1.0);
      m.material.opacity = OP_BASE;
      m.material.color.setHex(MARKER_DIM_HEX);
    }
    for (const p of pickByKey.values()) p.visible = false;
  }

  function placePiece(x, y, z, player, colorHex) {
    state.board[x][y][z] = player;

    const marker = markersByKey.get(keyOf(x, y, z));
    if (marker) marker.visible = false;

    const pk = pickByKey.get(keyOf(x, y, z));
    if (pk) pk.visible = false;

    const geom = new THREE.CylinderGeometry(0.34, 0.34, 0.14, 28);
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: 0x000000,
      emissiveIntensity: 0.0,
      roughness: 0.35,
      metalness: 0.08,
    });

    const piece = new THREE.Mesh(geom, mat);
    piece.position.copy(cellToWorld(x, y, z));
    piece.userData = { x, y, z, kind: "piece", player, baseScale: 1.0 };

    pieceGroup.add(piece);
    piecesByKey.set(keyOf(x, y, z), piece);
    return piece;
  }

  function removePiece(x, y, z) {
    state.board[x][y][z] = EMPTY;

    const k = keyOf(x, y, z);
    const piece = piecesByKey.get(k);
    if (piece) {
      pieceGroup.remove(piece);
      piecesByKey.delete(k);
    }

    updateTierVisibility();
  }

  function addWinOutlineToPiece(piece) {
    const outlineGeom = new THREE.CylinderGeometry(0.39, 0.39, 0.17, 28);
    const outlineEdges = new THREE.EdgesGeometry(outlineGeom);
    const outline = new THREE.LineSegments(
      outlineEdges,
      new THREE.LineBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.95 })
    );
    outline.position.copy(piece.position);
    outline.rotation.copy(piece.rotation);
    pieceGroup.add(outline);
    winOutlines.push(outline);
  }

  function clearWinOutlines() {
    for (const o of winOutlines) pieceGroup.remove(o);
    winOutlines.length = 0;
  }

  function clearPieces() {
    while (pieceGroup.children.length) pieceGroup.remove(pieceGroup.children[0]);
    piecesByKey.clear();
    clearWinOutlines();
  }

  return {
    scene,
    camera,
    renderer,
    frame,
    frameMat,
    cellGroup,
    pieceGroup,
    tierPickGroup,
    pickGroup,
    markers,
    pickByKey,
    piecesByKey,
    winOutlines,
    cellToWorld,
    updateTierVisibility,
    resetMarkers,
    placePiece,
    removePiece,
    addWinOutlineToPiece,
    clearWinOutlines,
    clearPieces,
  };
}
