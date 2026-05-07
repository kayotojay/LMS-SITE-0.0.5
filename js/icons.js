// LMS Dev Hub — icons.js
// =====================================================
// SVG icon library — replaces all emoji throughout the app.
// Three icon accent levels controlled by CSS vars:
//   --icon-hi   → important / primary icons (default: var(--accent))
//   --icon-mid  → common / secondary icons  (default: var(--accent2))
//   --icon-dim  → utility / quiet icons     (default: var(--text3))
//
// Default fallbacks ensure icons render even without custom theme active.
// Icons are injected via LMSICONS.* as SVG strings or via lmsIcon() helper.
// =====================================================

// ---- CSS var injection (defaults, overridden by theme or custom theme) ----
(function injectIconVarDefaults(){
  const s=document.createElement('style');
  s.id='lms-icon-vars';
  s.textContent=`
    :root {
      --icon-hi:  var(--accent,  #c8f04a);
      --icon-mid: var(--accent2, #4af0c8);
      --icon-dim: var(--text3,   #4a5278);
    }
  `;
  document.head.appendChild(s);
})();

// ---- Helper: returns an <svg> string sized to `size`px ----
function lmsIcon(name, colorVar, size){
  size = size || 12;
  colorVar = colorVar || 'var(--icon-mid)';
  const path = LMSICONS[name];
  if(!path) return `<span style="color:${colorVar};font-size:${size}px;">■</span>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${colorVar}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;">${path}</svg>`;
}

// ---- Filled variant (for node tree icons, status dots etc) ----
function lmsIconFill(name, colorVar, size){
  size = size || 12;
  colorVar = colorVar || 'var(--icon-mid)';
  const path = LMSICONS_FILL[name];
  if(!path) return lmsIcon(name, colorVar, size);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${colorVar}" stroke="none" style="display:inline-block;vertical-align:middle;flex-shrink:0;">${path}</svg>`;
}

// ---- Stroke paths (Feather/Lucide style, viewBox 0 0 24 24) ----
const LMSICONS = {
  // UI actions
  warning:    '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  check:      '<polyline points="20 6 9 17 4 12"/>',
  cross:      '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  star:       '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  sparkle:    '<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>',
  bolt:       '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  link:       '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
  clock:      '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  gear:       '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
  // Navigation / direction
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  arrowDown:  '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  arrowUp:    '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  chevDown:   '<polyline points="6 9 12 15 18 9"/>',
  chevRight:  '<polyline points="9 18 15 12 9 6"/>',
  chevUp:     '<polyline points="18 15 12 9 6 15"/>',
  play:       '<polygon points="5 3 19 12 5 21 5 3"/>',
  collapse:   '<polyline points="4 9 12 3 20 9"/><polyline points="4 15 12 21 20 15"/>',
  expand:     '<polyline points="4 6 12 12 20 6"/><polyline points="4 18 12 12 20 18"/>',
  // Data / files
  database:   '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  archive:    '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
  package:    '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  trash:      '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>',
  copy:       '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
  download:   '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload:     '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  // Communication
  mail:       '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>',
  // Node / scene types
  node2d:     '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>',
  sprite:     '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  animSprite: '<rect x="2" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><rect x="18" y="4" width="4" height="16" rx="1"/>',
  body:       '<rect x="4" y="4" width="16" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="4" y1="12" x2="20" y2="12"/>',
  area:       '<circle cx="12" cy="12" r="10" stroke-dasharray="4 2"/><circle cx="12" cy="12" r="3"/>',
  collision:  '<polygon points="12 2 22 20 2 20"/>',
  label:      '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="10" x2="14" y2="10"/><line x1="4" y1="14" x2="16" y2="14"/><line x1="4" y1="18" x2="11" y2="18"/>',
  button:     '<rect x="2" y="7" width="20" height="10" rx="2"/><line x1="7" y1="12" x2="17" y2="12"/>',
  panel:      '<rect x="3" y="3" width="18" height="18" rx="2"/>',
  control:    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v6"/>',
  camera:     '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>',
  audio:      '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/>',
  audioMini:  '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/>',
  animation:  '<polygon points="5 3 19 12 5 21 5 3"/>',
  timer:      '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><line x1="12" y1="2" x2="12" y2="4"/>',
  root:       '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>',
  node3d:     '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  mesh:       '<polygon points="12 2 22 20 2 20"/><line x1="12" y1="2" x2="12" y2="20"/><line x1="2" y1="13" x2="22" y2="13"/>',
  light:      '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  camera3d:   '<path d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.311a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>',
  scene:      '<path d="M2 6l10-4 10 4v12l-10 4L2 18V6z"/>',
  folder:     '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>',
  file:       '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  script:     '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="11" y2="17"/>',
  // Misc status
  lock:       '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>',
  celebration:'<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10l-8-4V7"/>',
  refresh:    '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>',
  plus:       '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  minus:      '<line x1="5" y1="12" x2="19" y2="12"/>',
  circle:     '<circle cx="12" cy="12" r="10"/>',
  dot:        '<circle cx="12" cy="12" r="4"/>',
  pen:        '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  globe:      '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>',
  // ── Extra custom-node icons ──────────────────────────────
  shield:     '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  flame:      '<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/>',
  skull:      '<circle cx="12" cy="11" r="7"/><path d="M9 17v1a3 3 0 006 0v-1m-6 0h6M9 11h.01M15 11h.01"/>',
  trophy:     '<path d="M6 9H4.5a2.5 2.5 0 010-5H6m12 5h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22m10-8v2.34c0 .55.47.98.97 1.21C19.15 18.75 20 20.24 20 22M10 14.66C10.93 14.89 11.46 15 12 15c.54 0 1.07-.11 2-.34M6 4v5a6 6 0 0012 0V4"/>',
  heart:      '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>',
  diamond:    '<path d="M2.7 10.3a2.41 2.41 0 000 3.41l7.59 7.58a2.41 2.41 0 003.41 0l7.58-7.58a2.41 2.41 0 000-3.41L13.7 2.71a2.41 2.41 0 00-3.41 0l-7.59 7.59z"/>',
  magnet:     '<path d="M6 15A6 6 0 006 3H4v4h2M18 15A6 6 0 0018 3h2v4h-2M4 3H2m20 0h-2M6 7H4m14 0h2M6 11h8m0 0a6 6 0 010 8m0-8V7m0 12h-2a6 6 0 01-6-6"/>',
  scan:       '<path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/>',
  rocket:     '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M15 11v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  planet:     '<circle cx="12" cy="12" r="7"/><path d="M3 3c0 4 3.44 7.56 7 9 3.56 1.44 9.56 1 12 0"/>',
  sword:      '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/>',
  map:        '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  key:        '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  eye:        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  layers:     '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  cpu:        '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
  wifi:       '<path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  target:     '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  compass:    '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
};

// ---- Filled paths for node tree icons ----
const LMSICONS_FILL = {
  node2d:    '<circle cx="12" cy="12" r="5"/>',
  sprite:    '<rect x="3" y="3" width="18" height="18" rx="2"/>',
  area:      '<circle cx="12" cy="12" r="10" opacity=".25"/><circle cx="12" cy="12" r="5"/>',
  collision: '<polygon points="12 2 22 20 2 20"/>',
  camera:    '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4" fill="var(--bg2)"/>',
  audio:     '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>',
  body:      '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  button:    '<rect x="2" y="7" width="20" height="10" rx="2"/>',
  panel:     '<rect x="3" y="3" width="18" height="18" rx="2"/>',
  folder:    '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>',
  scene:     '<path d="M2 6l10-4 10 4v12l-10 4L2 18V6z"/>',
  package:   '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>',
  dot:       '<circle cx="12" cy="12" r="6"/>',
  celebration:'<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10l-8-4V7"/>',
  lock:      '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4" fill="none" stroke="var(--bg2)" stroke-width="2"/>',
};

// ---- Node type → icon map (replaces emoji in scene.js NODE_TYPES) ----
// Colors use the three icon accent levels
const NODE_ICON_MAP = {
  // PRIMARY — important structural nodes → --icon-hi
  'Node2D':             { svgName:'node2d',    colorVar:'var(--icon-hi)',  fill:false },
  'Node3D':             { svgName:'node3d',    colorVar:'var(--icon-hi)',  fill:false },
  'Node':               { svgName:'root',      colorVar:'var(--icon-hi)',  fill:false },
  'Camera2D':           { svgName:'camera',    colorVar:'var(--icon-hi)',  fill:false },
  'Camera3D':           { svgName:'camera3d',  colorVar:'var(--icon-hi)',  fill:false },
  // SECONDARY — common gameplay nodes → --icon-mid
  'Sprite2D':           { svgName:'sprite',    colorVar:'var(--icon-mid)', fill:false },
  'AnimatedSprite2D':   { svgName:'animSprite',colorVar:'var(--icon-mid)', fill:false },
  'StaticBody2D':       { svgName:'body',      colorVar:'var(--icon-mid)', fill:false },
  'RigidBody2D':        { svgName:'body',      colorVar:'var(--icon-mid)', fill:false },
  'CharacterBody2D':    { svgName:'body',      colorVar:'var(--icon-mid)', fill:false },
  'Area2D':             { svgName:'area',      colorVar:'var(--icon-mid)', fill:false },
  'CollisionShape2D':   { svgName:'collision', colorVar:'var(--icon-mid)', fill:false },
  'CollisionPolygon2D': { svgName:'collision', colorVar:'var(--icon-mid)', fill:false },
  'MeshInstance3D':     { svgName:'mesh',      colorVar:'var(--icon-mid)', fill:false },
  'DirectionalLight3D': { svgName:'light',     colorVar:'var(--icon-mid)', fill:false },
  // UTILITY — UI, audio, animation → --icon-dim
  'Label':              { svgName:'label',     colorVar:'var(--icon-dim)', fill:false },
  'Button':             { svgName:'button',    colorVar:'var(--icon-dim)', fill:false },
  'TextureButton':      { svgName:'button',    colorVar:'var(--icon-dim)', fill:false },
  'Panel':              { svgName:'panel',     colorVar:'var(--icon-dim)', fill:false },
  'HBoxContainer':      { svgName:'panel',     colorVar:'var(--icon-dim)', fill:false },
  'VBoxContainer':      { svgName:'panel',     colorVar:'var(--icon-dim)', fill:false },
  'Control':            { svgName:'control',   colorVar:'var(--icon-dim)', fill:false },
  'AudioStreamPlayer':  { svgName:'audio',     colorVar:'var(--icon-dim)', fill:false },
  'AudioStreamPlayer2D':{ svgName:'audioMini', colorVar:'var(--icon-dim)', fill:false },
  'AnimationPlayer':    { svgName:'animation', colorVar:'var(--icon-dim)', fill:false },
  'Timer':              { svgName:'timer',     colorVar:'var(--icon-dim)', fill:false },
};

// Returns the SVG icon element for a node type def
function getNodeSVGIcon(nodeType, size){
  size = size || 13;
  const def = NODE_ICON_MAP[nodeType];
  if(!def) return lmsIcon('root', 'var(--icon-hi)', size);
  return def.fill
    ? lmsIconFill(def.svgName, def.colorVar, size)
    : lmsIcon(def.svgName, def.colorVar, size);
}

// ---- Apply custom icon accent CSS vars from theme settings ----
function applyIconAccentVars(ct){
  if(!ct) return;
  const root = document.documentElement;
  if(ct['icon-hi'])  root.style.setProperty('--icon-hi',  ct['icon-hi']);
  if(ct['icon-mid']) root.style.setProperty('--icon-mid', ct['icon-mid']);
  if(ct['icon-dim']) root.style.setProperty('--icon-dim', ct['icon-dim']);
}

// ---- Reset icon accents to follow the base theme accents ----
function resetIconAccentVars(){
  const root = document.documentElement;
  root.style.removeProperty('--icon-hi');
  root.style.removeProperty('--icon-mid');
  root.style.removeProperty('--icon-dim');
}
