// Neon Coast Cover Studio — the editor.
// Wires the controls to the cover engine: per-panel photos with pan and zoom,
// caption and lettering, layouts, grades, sizes, undo/redo history, PNG export.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import {
  LAYOUTS, GRADES, EXPORT_SIZES, getLayoutPanels, renderCover, exportCoverPNG,
  ensureCoverFonts,
} from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const badgeInput = document.getElementById('badge');
const heatSelect = document.getElementById('heat');
const zoomSlider = document.getElementById('zoom');
const panelLabel = document.getElementById('panel-label');
const statusEl = document.getElementById('status');
const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');

const SAMPLE_NAMES = ['boulevard', 'pier'];
const PANEL_COUNT = 9;

function blankPanel() {
  return { img: null, srcKind: null, src: null, zoom: 1, ox: 0, oy: 0 };
}

const state = {
  layout: 'hero-three',
  grade: 'sunset',
  size: '1920x1080',
  caption: 'Neon Coast',
  subtitle: 'Vice City nights',
  badge: 'Vice City',
  heat: 4,
  grain: true,
  vignette: true,
  selectedPanel: 0,
  panels: Array.from({ length: PANEL_COUNT }, blankPanel),
};

// --- undo / redo history (snapshots carry photo sources, not image objects) ---

let history = [];
let historyIndex = -1;

function snapshotState() {
  return JSON.stringify({
    layout: state.layout,
    grade: state.grade,
    size: state.size,
    caption: state.caption,
    subtitle: state.subtitle,
    badge: state.badge,
    heat: state.heat,
    grain: state.grain,
    vignette: state.vignette,
    selectedPanel: state.selectedPanel,
    panels: state.panels.map((p) => ({
      srcKind: p.srcKind, src: p.src, zoom: p.zoom, ox: p.ox, oy: p.oy,
    })),
  });
}

async function restoreSnapshot(json) {
  const snap = JSON.parse(json);
  Object.assign(state, {
    layout: snap.layout, grade: snap.grade, size: snap.size,
    caption: snap.caption, subtitle: snap.subtitle, badge: snap.badge,
    heat: snap.heat, grain: snap.grain, vignette: snap.vignette,
    selectedPanel: snap.selectedPanel,
  });
  for (let i = 0; i < PANEL_COUNT; i++) {
    const sp = snap.panels[i];
    const panel = state.panels[i];
    panel.zoom = sp.zoom;
    panel.ox = sp.ox;
    panel.oy = sp.oy;
    if (sp.srcKind === 'sample') {
      panel.img = await loadImage(`samples/${sp.src}.jpg`);
      panel.srcKind = 'sample';
      panel.src = sp.src;
    } else if (sp.srcKind === 'data') {
      panel.img = await loadImage(sp.src);
      panel.srcKind = 'data';
      panel.src = sp.src;
    } else {
      panel.img = null;
      panel.srcKind = null;
      panel.src = null;
    }
  }
  syncControls();
  redraw();
}

function pushHistory() {
  history = history.slice(0, historyIndex + 1);
  history.push(snapshotState());
  if (history.length > 60) history.shift();
  historyIndex = history.length - 1;
  syncHistoryButtons();
}

function syncHistoryButtons() {
  undoBtn.disabled = historyIndex <= 0;
  redoBtn.disabled = historyIndex >= history.length - 1;
}

async function undoCover() {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  await restoreSnapshot(history[historyIndex]);
  syncHistoryButtons();
}

async function redoCover() {
  if (historyIndex >= history.length - 1) return;
  historyIndex += 1;
  await restoreSnapshot(history[historyIndex]);
  syncHistoryButtons();
}

// --- photos ---

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Puts `img` into panel `i`, remembering how it got there for undo/redo. */
function setPanelPhoto(i, img, srcKind, src) {
  const panel = state.panels[i];
  panel.img = img;
  panel.srcKind = srcKind;
  panel.src = src;
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
}

/** Fills every panel with one photo, each panel cropped to a different part. */
async function fillAllPanelsWith(img, srcKind, src) {
  const crops = [
    { zoom: 1.15, ox: -0.06, oy: 0 }, { zoom: 1.35, ox: 0.08, oy: -0.04 },
    { zoom: 1.2, ox: 0.02, oy: 0.06 }, { zoom: 1.5, ox: -0.1, oy: -0.06 },
    { zoom: 1.1, ox: 0, oy: 0 }, { zoom: 1.4, ox: 0.1, oy: 0.02 },
    { zoom: 1.25, ox: -0.04, oy: -0.08 }, { zoom: 1.6, ox: 0.06, oy: 0.08 },
    { zoom: 1.3, ox: 0, oy: -0.02 },
  ];
  for (let i = 0; i < PANEL_COUNT; i++) {
    setPanelPhoto(i, img, srcKind, src);
    Object.assign(state.panels[i], crops[i]);
  }
}

/** Fills the panels with the two sample photos, alternating. */
async function fillPanelsWithSamples() {
  const imgs = {};
  for (const name of SAMPLE_NAMES) imgs[name] = await loadImage(`samples/${name}.jpg`);
  // Wide panels crop a portrait photo's middle band, which cuts the subject's
  // face off: shift each panel's crop up so the faces stay in frame.
  const crops = [
    { zoom: 1.08, ox: 0, oy: 0.32 }, { zoom: 1.1, ox: 0, oy: 0.24 },
    { zoom: 1.08, ox: 0, oy: 0.30 }, { zoom: 1.1, ox: 0, oy: 0.24 },
    { zoom: 1.08, ox: 0, oy: 0.30 }, { zoom: 1.1, ox: 0, oy: 0.24 },
    { zoom: 1.08, ox: 0, oy: 0.30 }, { zoom: 1.1, ox: 0, oy: 0.24 },
    { zoom: 1.08, ox: 0, oy: 0.30 },
  ];
  for (let i = 0; i < PANEL_COUNT; i++) {
    const name = SAMPLE_NAMES[i % SAMPLE_NAMES.length];
    setPanelPhoto(i, imgs[name], 'sample', name);
    Object.assign(state.panels[i], crops[i]);
  }
  redraw();
  pushHistory();
}

async function loadPhotoFileIntoPanel(file, panelIndex) {
  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);
  setPanelPhoto(panelIndex, img, 'data', dataUrl);
  redraw();
  pushHistory();
  statusEl.textContent = `Photo loaded into panel ${panelIndex + 1}.`;
}

// --- preview ---

function currentSize() {
  return EXPORT_SIZES.find((s) => s.id === state.size) || EXPORT_SIZES[2];
}

function redraw() {
  const size = currentSize();
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  renderCover(canvas, state);
  // In a full-frame cover scene no panel is selected; show panel 1's values.
  const sel = state.selectedPanel ?? 0;
  panelLabel.textContent = String(sel + 1);
  zoomSlider.value = String(state.panels[sel].zoom);
}

function syncControls() {
  captionInput.value = state.caption;
  subtitleInput.value = state.subtitle;
  badgeInput.value = state.badge;
  heatSelect.value = String(state.heat);
  document.getElementById('grain').checked = state.grain;
  document.getElementById('vignette').checked = state.vignette;
  document.querySelectorAll('#layout-picker button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.value === state.layout));
  });
  document.querySelectorAll('#grade-picker button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.value === state.grade));
  });
  document.querySelectorAll('#size-picker button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.value === state.size));
  });
}

// --- pickers ---

function buildPicker(containerId, entries, onPick) {
  const container = document.getElementById(containerId);
  for (const [value, entry] of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.value = value;
    button.setAttribute('aria-pressed', 'false');
    if (entry.swatch) {
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = entry.swatch;
      button.append(swatch, document.createTextNode(entry.name));
    } else {
      button.textContent = entry.name;
    }
    button.addEventListener('click', () => {
      onPick(value);
      syncControls();
      redraw();
      pushHistory();
    });
    container.append(button);
  }
}

buildPicker('layout-picker', Object.entries(LAYOUTS).map(([v, e]) => [v, { name: e.name }]), (v) => {
  state.layout = v;
});
buildPicker('grade-picker', Object.entries(GRADES).map(([v, g]) => [v, {
  name: g.name,
  swatch: `linear-gradient(135deg, ${g.wash[0]}, ${g.wash[1]})`,
}]), (v) => {
  state.grade = v;
});
buildPicker('size-picker', EXPORT_SIZES.map((s) => [s.id, { name: s.label }]), (v) => {
  state.size = v;
});

// --- panel selection, pan and zoom on the preview ---

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function panelAt(point) {
  const rects = getLayoutPanels(state.layout, canvas.width, canvas.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;

canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const index = panelAt(point);
  if (index === -1) return;
  state.selectedPanel = index;
  const panel = state.panels[index];
  drag = { startX: point.x, startY: point.y, ox: panel.ox, oy: panel.oy, moved: false };
  canvas.setPointerCapture(event.pointerId);
  redraw();
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const point = canvasPoint(event);
  const dx = point.x - drag.startX;
  const dy = point.y - drag.startY;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  const panel = state.panels[state.selectedPanel];
  if (!panel.img || !drag.moved) return;
  const rects = getLayoutPanels(state.layout, canvas.width, canvas.height);
  const rect = rects[state.selectedPanel];
  const pad = Math.round(Math.min(rect.w, rect.h) * 0.018) + 2;
  const iw = rect.w - pad * 2;
  const ih = rect.h - pad * 2;
  const base = Math.max(iw / panel.img.naturalWidth, ih / panel.img.naturalHeight) * panel.zoom;
  panel.ox = drag.ox + dx / (panel.img.naturalWidth * base);
  panel.oy = drag.oy + dy / (panel.img.naturalHeight * base);
  redraw();
});

canvas.addEventListener('pointerup', () => {
  if (drag && drag.moved) pushHistory();
  drag = null;
});

zoomSlider.addEventListener('input', () => {
  state.panels[state.selectedPanel].zoom = Number(zoomSlider.value);
  redraw();
});
zoomSlider.addEventListener('change', pushHistory);

document.getElementById('reset-crop').addEventListener('click', () => {
  const panel = state.panels[state.selectedPanel];
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  redraw();
  pushHistory();
});

document.getElementById('clear-panel').addEventListener('click', () => {
  state.panels[state.selectedPanel] = blankPanel();
  redraw();
  pushHistory();
});

// Drag and drop a photo onto the preview: it fills the panel under the drop.
canvas.addEventListener('dragover', (event) => event.preventDefault());
canvas.addEventListener('drop', async (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const index = panelAt(canvasPoint(event));
  await loadPhotoFileIntoPanel(file, index === -1 ? state.selectedPanel : index);
});

// --- text and effect controls ---

captionInput.addEventListener('input', () => { state.caption = captionInput.value; redraw(); });
captionInput.addEventListener('change', pushHistory);
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
subtitleInput.addEventListener('change', pushHistory);
badgeInput.addEventListener('input', () => { state.badge = badgeInput.value; redraw(); });
badgeInput.addEventListener('change', pushHistory);
heatSelect.addEventListener('change', () => {
  state.heat = Number(heatSelect.value);
  redraw();
  pushHistory();
});
document.getElementById('grain').addEventListener('change', (e) => {
  state.grain = e.target.checked;
  redraw();
  pushHistory();
});
document.getElementById('vignette').addEventListener('change', (e) => {
  state.vignette = e.target.checked;
  redraw();
  pushHistory();
});

// --- photo buttons ---

document.getElementById('photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await loadPhotoFileIntoPanel(file, state.selectedPanel);
  e.target.value = '';
});
document.getElementById('fill-all').addEventListener('click', async () => {
  const file = await pickPhotoFile();
  if (!file) return;
  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);
  await fillAllPanelsWith(img, 'data', dataUrl);
  redraw();
  pushHistory();
  statusEl.textContent = 'One photo fills every panel, each cropped differently.';
});
document.getElementById('use-samples').addEventListener('click', fillPanelsWithSamples);

function pickPhotoFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => resolve(input.files[0] || null));
    input.click();
  });
}

// --- history buttons and keys ---

undoBtn.addEventListener('click', undoCover);
redoBtn.addEventListener('click', redoCover);
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redoCover();
    else undoCover();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    redoCover();
  }
});

// --- export ---

async function exportCover(sizeId) {
  const size = EXPORT_SIZES.find((s) => s.id === sizeId);
  const blob = await exportCoverPNG(state, size.w, size.h);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `neon-coast-cover-${size.id}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  statusEl.textContent = `Saved neon-coast-cover-${size.id}.png (${size.w} × ${size.h}).`;
}

for (const size of EXPORT_SIZES) {
  document.getElementById(`export-${size.id}`).addEventListener('click', () => exportCover(size.id));
}

// --- shots API: the fixed scenes shots.js sets up ---

const shotApi = {
  state,
  redraw,
  syncControls,
  pushHistory,
  async loadSample(name) {
    return loadImage(`samples/${name}.jpg`);
  },
  async fillPanelsWithSamples() {
    await fillPanelsWithSamples();
    history = [snapshotState()];
    historyIndex = 0;
    syncHistoryButtons();
  },
  async fillAllPanelsWithSample(name) {
    const img = await loadImage(`samples/${name}.jpg`);
    await fillAllPanelsWith(img, 'sample', name);
    redraw();
  },
  setLayout(layout) { state.layout = layout; },
  setGrade(grade) { state.grade = grade; },
  setSize(sizeId) { state.size = sizeId; },
  setCaption(text) { state.caption = text; },
  setSubtitle(text) { state.subtitle = text; },
  setBadge(text) { state.badge = text; },
  setHeat(heat) { state.heat = heat; },
  setSelectedPanel(i) { state.selectedPanel = i; },
  setEffects(grain, vignette) { state.grain = grain; state.vignette = vignette; },
};

// --- boot ---

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  await ensureCoverFonts();
  await runShot(shot, new URLSearchParams(location.search), shotApi);
  syncControls();
  redraw();
  pushHistory();
} else {
  await ensureCoverFonts();
  await fillPanelsWithSamples();
  syncControls();
  redraw();
  // The boot fill already pushed one history entry; keep it as the baseline.
}
