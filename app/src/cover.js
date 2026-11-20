// Neon Coast Cover Studio — the cover engine.
// Draws GTA-style multi-panel cover art on a 2D canvas: panels of the user's
// photos, a sunset/neon colour grade, and bold Anton lettering with a Pacifico
// script subtitle, a halftone title block, a badge ribbon and a heat meter.
// Everything is drawn by this file; nothing here reaches the network.

export const LAYOUTS = {
  'hero-three': { name: 'Hero + Three', panels: 4 },
  'grid-9': { name: 'Nine-Panel Grid', panels: 9 },
  'full-bleed': { name: 'Full-Bleed Hero', panels: 1 },
  'tilted': { name: 'Tilted Snapshots', panels: 4 },
  'triptych': { name: 'Triptych', panels: 3 },
};

export const GRADES = {
  sunset: {
    name: 'Sunset',
    filter: 'saturate(1.25) contrast(1.08)',
    wash: ['rgba(255,154,60,0.20)', 'rgba(255,46,136,0.28)'],
    blend: 'soft-light',
    accent: '#ff7a3c',
  },
  neon: {
    name: 'Neon Pink / Teal',
    filter: 'saturate(1.45) contrast(1.12)',
    wash: ['rgba(255,46,166,0.30)', 'rgba(0,229,212,0.30)'],
    blend: 'overlay',
    accent: '#ff2ea6',
  },
  golden: {
    name: 'Golden Hour',
    filter: 'saturate(1.2) contrast(1.05) brightness(1.05)',
    wash: ['rgba(255,215,106,0.26)', 'rgba(255,138,61,0.26)'],
    blend: 'soft-light',
    accent: '#ffc53d',
  },
  noir: {
    name: 'Noir Teal',
    filter: 'saturate(0.55) contrast(1.18) brightness(0.94)',
    wash: ['rgba(15,76,92,0.34)', 'rgba(0,0,0,0.30)'],
    blend: 'multiply',
    accent: '#2dd4bf',
  },
  vaporwave: {
    name: 'Vaporwave',
    filter: 'saturate(1.5) contrast(1.1) hue-rotate(-12deg)',
    wash: ['rgba(123,47,247,0.32)', 'rgba(255,93,162,0.30)'],
    blend: 'overlay',
    accent: '#c084fc',
  },
};

export const EXPORT_SIZES = [
  { id: '1080x1080', label: '1080 × 1080', w: 1080, h: 1080 },
  { id: '1080x1350', label: '1080 × 1350', w: 1080, h: 1350 },
  { id: '1920x1080', label: '1920 × 1080', w: 1920, h: 1080 },
];

/** Loads the three cover fonts so canvas lettering uses them, not a fallback. */
export async function ensureCoverFonts() {
  const loads = [
    document.fonts.load('100px Anton'),
    document.fonts.load('100px Pacifico'),
    document.fonts.load('100px "Bebas Neue"'),
  ];
  await Promise.all(loads.map((p) => p.catch(() => null)));
  await document.fonts.ready;
}

const INK = '#160a24';
const PAPER = '#fff7ec';

/** Panel rectangles for a layout, in cover pixels. Each rect is {x, y, w, h, rot}. */
export function getLayoutPanels(layout, W, H) {
  const gap = Math.round(Math.min(W, H) * 0.014);
  const m = Math.round(Math.min(W, H) * 0.022);
  const titleH = Math.round(H * 0.20);
  const bodyH = H - titleH - m;
  const bodyW = W - m * 2;
  if (layout === 'hero-three') {
    const heroH = Math.round(bodyH * 0.60);
    const rowH = bodyH - heroH - gap;
    const cellW = Math.round((bodyW - gap * 2) / 3);
    return [
      { x: m, y: m, w: bodyW, h: heroH, rot: 0 },
      { x: m, y: m + heroH + gap, w: cellW, h: rowH, rot: 0 },
      { x: m + cellW + gap, y: m + heroH + gap, w: cellW, h: rowH, rot: 0 },
      { x: m + (cellW + gap) * 2, y: m + heroH + gap, w: bodyW - (cellW + gap) * 2, h: rowH, rot: 0 },
    ];
  }
  if (layout === 'grid-9') {
    const cellW = Math.round((bodyW - gap * 2) / 3);
    const cellH = Math.round((bodyH - gap * 2) / 3);
    const rects = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        rects.push({
          x: m + c * (cellW + gap),
          y: m + r * (cellH + gap),
          w: c === 2 ? bodyW - (cellW + gap) * 2 : cellW,
          h: r === 2 ? bodyH - (cellH + gap) * 2 : cellH,
          rot: 0,
        });
      }
    }
    return rects;
  }
  if (layout === 'full-bleed') {
    return [{ x: 0, y: 0, w: W, h: H - titleH, rot: 0 }];
  }
  if (layout === 'tilted') {
    const cellW = Math.round(bodyW * 0.47);
    const cellH = Math.round(bodyH * 0.44);
    const cx = m + bodyW / 2;
    const cy = m + bodyH / 2;
    return [
      { x: cx - cellW - gap, y: cy - cellH - gap * 2, w: cellW, h: cellH, rot: -0.045 },
      { x: cx + gap, y: cy - cellH - gap, w: cellW, h: cellH, rot: 0.05 },
      { x: cx - cellW - gap * 2, y: cy + gap, w: cellW, h: cellH, rot: 0.04 },
      { x: cx + gap * 2, y: cy + gap * 2, w: cellW, h: cellH, rot: -0.055 },
    ];
  }
  // triptych: three tall panels side by side.
  const cellW = Math.round((bodyW - gap * 2) / 3);
  return [
    { x: m, y: m, w: cellW, h: bodyH, rot: 0 },
    { x: m + cellW + gap, y: m, w: cellW, h: bodyH, rot: 0 },
    { x: m + (cellW + gap) * 2, y: m, w: bodyW - (cellW + gap) * 2, h: bodyH, rot: 0 },
  ];
}

/** Draws one photo panel: the photo cover-fit with pan/zoom, then the grade. */
export function drawCoverPanel(ctx, rect, panel, grade) {
  const { x, y, w, h, rot } = rect;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  if (rot) ctx.rotate(rot);
  ctx.translate(-w / 2, -h / 2);
  // Drop shadow under the panel, then a white poster border.
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = Math.round(Math.min(w, h) * 0.05);
  ctx.shadowOffsetY = Math.round(Math.min(w, h) * 0.02);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  const pad = Math.round(Math.min(w, h) * 0.018) + 2;
  const ix = pad;
  const iy = pad;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();
  if (panel && panel.img) {
    const img = panel.img;
    const zoom = panel.zoom || 1;
    const base = Math.max(iw / img.naturalWidth, ih / img.naturalHeight) * zoom;
    const pw = img.naturalWidth * base;
    const ph = img.naturalHeight * base;
    // Clamp the pan so the photo always covers the panel, never a bare edge.
    const maxOx = Math.max(0, (pw - iw) / 2) / pw;
    const maxOy = Math.max(0, (ph - ih) / 2) / ph;
    const ox = Math.max(-maxOx, Math.min(maxOx, panel.ox || 0)) * pw;
    const oy = Math.max(-maxOy, Math.min(maxOy, panel.oy || 0)) * ph;
    ctx.filter = grade.filter;
    ctx.drawImage(img, ix + (iw - pw) / 2 + ox, iy + (ih - ph) / 2 + oy, pw, ph);
    ctx.filter = 'none';
  } else {
    const g = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
    g.addColorStop(0, '#3b1d5e');
    g.addColorStop(1, '#12081f');
    ctx.fillStyle = g;
    ctx.fillRect(ix, iy, iw, ih);
  }
  applyGrade(ctx, ix, iy, iw, ih, grade);
  ctx.restore();
  // Inked inner line, poster style.
  ctx.strokeStyle = 'rgba(22,10,36,0.85)';
  ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.012));
  ctx.strokeRect(ix + ctx.lineWidth / 2, iy + ctx.lineWidth / 2, iw - ctx.lineWidth, ih - ctx.lineWidth);
  ctx.restore();
}

/** Washes a panel rectangle with the grade's sunset/neon colour. */
export function applyGrade(ctx, x, y, w, h, grade) {
  const wash = ctx.createLinearGradient(x, y, x, y + h);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(1, grade.wash[1]);
  ctx.save();
  ctx.globalCompositeOperation = grade.blend;
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  // Warm light from the top edge, like a low sun.
  const sun = ctx.createLinearGradient(x, y, x, y + h * 0.45);
  sun.addColorStop(0, 'rgba(255,236,180,0.14)');
  sun.addColorStop(1, 'rgba(255,236,180,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = sun;
  ctx.fillRect(x, y, w, h * 0.45);
  ctx.restore();
}

/** Fits `text` in Anton capitals to `maxWidth`, returning the font size used. */
export function fitAntonTitle(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${size}px Anton, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > 24) {
    size -= 4;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  return size;
}

/** Draws the halftone dot band behind the title block. */
export function drawHalftoneTitleBlock(ctx, x, y, w, h, accent) {
  ctx.save();
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#1c0b31');
  bg.addColorStop(1, '#0d0518');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  // Halftone dots: small at the top of the band, growing toward the bottom.
  const step = Math.max(10, Math.round(h * 0.11));
  ctx.fillStyle = accent;
  for (let row = 0; row * step < h; row++) {
    const r = (0.8 + row * 0.9) * (step / 8);
    for (let cx = x + step / 2 + (row % 2) * step / 2; cx < x + w; cx += step) {
      ctx.globalAlpha = 0.16 + row * 0.05;
      ctx.beginPath();
      ctx.arc(cx, y + row * step + step / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Thin neon rule above the band.
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, w, Math.max(3, Math.round(h * 0.03)));
  ctx.restore();
}

/** Draws the angled badge ribbon in the top corner of the cover. */
export function drawBadgeRibbon(ctx, text, W, grade, scale) {
  const s = scale;
  const ribbonH = Math.round(64 * s);
  const ribbonW = Math.round((text.length * 26 + 90) * s);
  ctx.save();
  ctx.translate(Math.round(46 * s), Math.round(10 * s));
  ctx.rotate(-0.06);
  ctx.fillStyle = grade.accent;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(ribbonW, 0);
  ctx.lineTo(ribbonW - Math.round(18 * s), ribbonH);
  ctx.lineTo(0, ribbonH);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#160a24';
  ctx.font = `${Math.round(34 * s)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), Math.round(26 * s), ribbonH / 2 + 1);
  ctx.restore();
}

/** Draws the heat meter: five stars, `heat` of them filled, with a label. */
export function drawHeatMeter(ctx, heat, x, y, size, accent) {
  ctx.save();
  ctx.font = `${Math.round(size * 0.62)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,247,236,0.75)';
  ctx.fillText('HEAT', x, y);
  const labelW = ctx.measureText('HEAT').width + size * 0.45;
  for (let i = 0; i < 5; i++) {
    const cx = x + labelW + i * size * 1.25;
    drawHeatStar(ctx, cx, y, size * 0.52, i < heat ? '#ffd23d' : 'rgba(255,247,236,0.25)', i < heat);
  }
  ctx.restore();
}

function drawHeatStar(ctx, cx, cy, r, fill, filled) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(angle) * rad;
    const py = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (filled) {
    ctx.strokeStyle = 'rgba(22,10,36,0.7)';
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draws the big caption title with outline and offset shadow. */
export function renderTitleBlock(ctx, state, W, H, grade) {
  const s = Math.min(W, H) / 1080;
  const titleH = Math.round(H * 0.20);
  const y0 = H - titleH;
  drawHalftoneTitleBlock(ctx, 0, y0, W, titleH, grade.accent);
  const padX = Math.round(W * 0.045);
  const title = (state.caption || 'NEON COAST').trim().toUpperCase() || 'NEON COAST';
  const subtitle = (state.subtitle || '').trim();
  // The heat meter shares the title line on the right, so the title must fit
  // in the space left of it — never run underneath the stars.
  const meterSize = Math.round(titleH * 0.30);
  const meterW = meterSize * 7.2;
  const titleMaxW = W - padX * 2 - meterW - Math.round(W * 0.03);
  const titleSize = fitAntonTitle(ctx, title, titleMaxW, Math.round(titleH * 0.62));
  const titleY = subtitle ? y0 + titleH * 0.52 : y0 + titleH * 0.56;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  // Offset shadow, then dark outline, then white fill.
  ctx.font = `${titleSize}px Anton, sans-serif`;
  ctx.fillStyle = grade.accent;
  ctx.fillText(title, padX + titleSize * 0.07, titleY + titleSize * 0.07);
  ctx.lineWidth = Math.max(3, Math.round(titleSize * 0.09));
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.strokeText(title, padX, titleY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, padX, titleY);
  ctx.restore();
  if (subtitle) {
    // Shrink the script so it never runs under the footer credit at the right.
    let subSize = Math.round(titleH * 0.26);
    ctx.font = `${subSize}px Pacifico, cursive`;
    while (ctx.measureText(subtitle).width > W * 0.58 && subSize > 16) {
      subSize -= 2;
      ctx.font = `${subSize}px Pacifico, cursive`;
    }
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd9ec';
    ctx.shadowColor = 'rgba(255,46,166,0.8)';
    ctx.shadowBlur = Math.round(10 * s);
    ctx.fillText(subtitle, padX, y0 + titleH * 0.86);
    ctx.restore();
  }
  // Heat meter sits top-right of the title band, on the title's own line.
  drawHeatMeter(ctx, state.heat ?? 4, W - padX - meterW, titleY, meterSize, grade.accent);
  // Small footer credit line, bottom-right.
  ctx.save();
  ctx.font = `${Math.round(20 * s)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,247,236,0.6)';
  ctx.fillText('NEON COAST COVER STUDIO  •  VICE CITY', W - padX, y0 + titleH * 0.90);
  ctx.restore();
}

/** Film grain from a small seeded noise tile, tiled over the cover. */
let grainTile = null;
export function drawGrain(ctx, W, H) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 160;
    grainTile.height = 160;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(160, 160);
    let seed = 1234567;
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = 118 + (seed % 40);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.globalCompositeOperation = 'overlay';
  const pattern = ctx.createPattern(grainTile, 'repeat');
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Darkens the cover's corners so the panels pop. */
export function drawVignette(ctx, W, H) {
  ctx.save();
  const g = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  g.addColorStop(0, 'rgba(10,4,20,0)');
  g.addColorStop(1, 'rgba(10,4,20,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/**
 * Renders the whole cover for `state` onto `canvas` at its own size.
 * `options.forExport` skips the editor's selection outline.
 */
export function renderCover(canvas, state, options = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const grade = GRADES[state.grade] || GRADES.sunset;
  const s = Math.min(W, H) / 1080;
  // Sunset sky backdrop behind the panels.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2a1046');
  sky.addColorStop(0.45, '#7a1e63');
  sky.addColorStop(0.8, '#ff5e62');
  sky.addColorStop(1, '#ffb347');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // A low sun glow behind the panels.
  const glow = ctx.createRadialGradient(W * 0.72, H * 0.30, 10, W * 0.72, H * 0.30, Math.min(W, H) * 0.55);
  glow.addColorStop(0, 'rgba(255,214,140,0.55)');
  glow.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const rects = getLayoutPanels(state.layout, W, H);
  rects.forEach((rect, i) => {
    drawCoverPanel(ctx, rect, state.panels[i], grade);
  });
  renderTitleBlock(ctx, state, W, H, grade);
  if (state.badge) {
    drawBadgeRibbon(ctx, state.badge, W, grade, s);
  }
  if (state.vignette) drawVignette(ctx, W, H);
  if (state.grain) drawGrain(ctx, W, H);
  // White poster frame.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,247,236,0.9)';
  ctx.lineWidth = Math.max(3, Math.round(6 * s));
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  ctx.restore();
  if (!options.forExport && state.selectedPanel != null && rects[state.selectedPanel]) {
    const r = rects[state.selectedPanel];
    ctx.save();
    ctx.strokeStyle = '#00e5d4';
    ctx.lineWidth = Math.max(3, Math.round(5 * s));
    ctx.setLineDash([Math.round(18 * s), Math.round(10 * s)]);
    ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
    ctx.restore();
  }
  return rects;
}

/** Renders `state` at W x H and returns a PNG blob. */
export async function exportCoverPNG(state, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  renderCover(canvas, { ...state, selectedPanel: null }, { forExport: true });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
