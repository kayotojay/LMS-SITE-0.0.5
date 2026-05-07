// LMS Dev Hub — server-backup.js
// ============================================================
// SERVER BACKUP SYSTEM
//
// Two backup layers per server (host only):
//
//   LIVE   — updated on every syncProjData() call (every data change)
//             stored at: lms_bak_live_{serverKey}
//
//   TIMED  — snapshots taken at a user-chosen interval (5m/15m/30m/1h/4h)
//             stored at: lms_bak_timed_{serverKey}  →  array of up to 24 snapshots
//             each entry: { ts, label, meta, projects }
//
// Deleting a server FREEZES both layers — they stay in storage until
// you manually delete them from the Backup Vault.
//
// UI entry: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>Backups button in My Servers header → openBackupVault()
// ============================================================

// ── KEYS ────────────────────────────────────────────────────
const BAK_LIVE_PFX   = 'lms_bak_live_';
const BAK_TIMED_PFX  = 'lms_bak_timed_';
const BAK_CFG_PFX    = 'lms_bak_cfg_';   // per-server config { interval: ms|0, maxSlots: n }
const BAK_MAX_SLOTS  = 24;               // max timed snapshots kept per server

// ── INTERVALS ────────────────────────────────────────────────
const BAK_INTERVALS = [
  { label: 'Off',  ms: 0 },
  { label: '5 min',  ms: 5  * 60 * 1000 },
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '4 hours',ms: 4 * 60 * 60 * 1000 },
];

let _bakTimedTimer = null;
let _bakCurrentServerKey = null;

// ── CONFIG ───────────────────────────────────────────────────
function _bakGetCfg(serverKey) {
  try { return JSON.parse(localStorage.getItem(BAK_CFG_PFX + serverKey)) || { interval: 15*60*1000, maxSlots: BAK_MAX_SLOTS }; }
  catch(e) { return { interval: 15*60*1000, maxSlots: BAK_MAX_SLOTS }; }
}
function _bakSaveCfg(serverKey, cfg) {
  try { localStorage.setItem(BAK_CFG_PFX + serverKey, JSON.stringify(cfg)); } catch(e) {}
}

// ── RAW STORAGE ──────────────────────────────────────────────
function _bakSave(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) { console.warn('[BAK] storage full', e); }
}
function _bakLoad(key) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function _bakDel(key) { localStorage.removeItem(key); }

// ── SNAPSHOT BUILDER ─────────────────────────────────────────
async function _bakFetch(serverKey, serverName) {
  const _url = CFG_URL;
  const _key = srvState._dbKey || SRV_ANON_KEY;
  if (!_url) return null;
  try {
    const [meta, projects] = await Promise.all([
      _withServerCreds(_url, _key, () => fbGet('/servers/' + serverKey + '/meta')),
      _withServerCreds(_url, _key, () => fbGet('/servers/' + serverKey + '/projects')),
    ]);
    return {
      ts: Date.now(),
      serverKey,
      serverName: serverName || (meta && meta.name) || serverKey,
      frozen: false,
      frozenAt: null,
      meta: meta || {},
      projects: projects || {},
    };
  } catch(e) { console.warn('[BAK] fetch failed', e); return null; }
}

// ── LIVE BACKUP ──────────────────────────────────────────────
// Called from syncProjData() on every change — updates the single LIVE slot
async function bakUpdateLive(serverKey, serverName) {
  if (!serverKey) return;
  const snap = await _bakFetch(serverKey, serverName);
  if (!snap) return;
  const existing = _bakLoad(BAK_LIVE_PFX + serverKey) || {};
  snap.firstTs = existing.firstTs || snap.ts;
  snap.updateCount = (existing.updateCount || 0) + 1;
  _bakSave(BAK_LIVE_PFX + serverKey, snap);
}

// ── TIMED BACKUP ─────────────────────────────────────────────
// Saves a new timed slot; keeps up to maxSlots, oldest dropped first
async function bakTakeTimedSnapshot(serverKey, serverName, label) {
  if (!serverKey) return;
  const snap = await _bakFetch(serverKey, serverName);
  if (!snap) return;
  const slots = _bakLoad(BAK_TIMED_PFX + serverKey) || [];
  const cfg = _bakGetCfg(serverKey);
  const max = cfg.maxSlots || BAK_MAX_SLOTS;
  snap.label = label || _fmtTs(snap.ts);
  slots.unshift(snap);           // newest first
  if (slots.length > max) slots.length = max;
  _bakSave(BAK_TIMED_PFX + serverKey, slots);
  if (document.getElementById('backup-vault-overlay')?.style.display !== 'none') _vaultRefresh();
}

// ── TIMER MANAGEMENT ─────────────────────────────────────────
function bakStartTimers(serverKey, serverName) {
  bakStopTimers();
  _bakCurrentServerKey = serverKey;
  const cfg = _bakGetCfg(serverKey);
  if (cfg.interval > 0) {
    _bakTimedTimer = setInterval(() => {
      if (!srvState.connected || srvState.serverKey !== serverKey) return;
      bakTakeTimedSnapshot(serverKey, serverName);
    }, cfg.interval);
  }
}

function bakStopTimers() {
  if (_bakTimedTimer) { clearInterval(_bakTimedTimer); _bakTimedTimer = null; }
  _bakCurrentServerKey = null;
}

// Also restart timers when interval setting changes
function bakSetInterval(serverKey, serverName, ms) {
  const cfg = _bakGetCfg(serverKey);
  cfg.interval = ms;
  _bakSaveCfg(serverKey, cfg);
  bakStartTimers(serverKey, serverName);
  toast(ms > 0 ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Timed backup every ' + BAK_INTERVALS.find(i=>i.ms===ms)?.label : 'Timed backups off');
}

// ── FREEZE (server deleted) ───────────────────────────────────
function bakFreeze(serverKey) {
  const ft = Date.now();
  for (const pfx of [BAK_LIVE_PFX, BAK_TIMED_PFX]) {
    const raw = _bakLoad(pfx + serverKey);
    if (!raw) continue;
    if (Array.isArray(raw)) {
      raw.forEach(s => { s.frozen = true; s.frozenAt = ft; });
    } else {
      raw.frozen = true; raw.frozenAt = ft;
    }
    _bakSave(pfx + serverKey, raw);
  }
}

// ── INITIAL SNAPSHOT (server created / reconnected as host) ──
async function bakInitialSnapshot(serverKey, serverName) {
  // Live
  await bakUpdateLive(serverKey, serverName);
  // Timed — only if no slots exist yet
  const existing = _bakLoad(BAK_TIMED_PFX + serverKey);
  if (!existing || !existing.length) {
    await bakTakeTimedSnapshot(serverKey, serverName, 'Initial snapshot');
  }
}

// ── HELPERS ──────────────────────────────────────────────────
function _fmtTs(ts) {
  return new Date(ts).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}
function _fmtAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
  return Math.floor(diff/86400000) + 'd ago';
}
function _projSummary(projects) {
  const entries = Object.values(projects || {});
  return entries.map(p => p.name || p.id || '?').slice(0, 6).join(', ') + (entries.length > 6 ? '…' : '');
}

// ── COLLECT ALL SERVER KEYS WITH BACKUPS ─────────────────────
function _bakAllServerKeys() {
  const keys = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith(BAK_LIVE_PFX) || k.startsWith(BAK_TIMED_PFX))) {
      const sk = k.startsWith(BAK_LIVE_PFX)
        ? k.slice(BAK_LIVE_PFX.length)
        : k.slice(BAK_TIMED_PFX.length);
      keys.add(sk);
    }
  }
  return [...keys];
}

// ─────────────────────────────────────────────────────────────
// BACKUP VAULT UI
// ─────────────────────────────────────────────────────────────

let _vaultCurrentServer = null;   // serverKey currently expanded

function openBackupVault() {
  let o = document.getElementById('backup-vault-overlay');
  if (!o) {
    o = document.createElement('div');
    o.id = 'backup-vault-overlay';
    o.style.cssText = [
      'display:none','position:fixed','inset:0',
      'background:rgba(0,0,0,.96)','z-index:9000',
      'font-family:var(--font)','overflow:hidden',
      'display:flex','flex-direction:column'
    ].join(';');
    document.body.appendChild(o);
  }
  o.style.display = 'flex';
  _vaultRender(o);
}

function closeBackupVault() {
  const o = document.getElementById('backup-vault-overlay');
  if (o) o.style.display = 'none';
  _vaultCurrentServer = null;
}

function _vaultRefresh() {
  const o = document.getElementById('backup-vault-overlay');
  if (o && o.style.display !== 'none') _vaultRender(o);
}

function _vaultRender(o) {
  const sks = _bakAllServerKeys();

  // Sort: live backups for connected servers first, then by last update
  const rows = sks.map(sk => {
    const live = _bakLoad(BAK_LIVE_PFX + sk);
    const timed = _bakLoad(BAK_TIMED_PFX + sk) || [];
    const cfg = _bakGetCfg(sk);
    const isConnected = srvState.connected && srvState.serverKey === sk;
    const isFrozen = live && live.frozen;
    return { sk, live, timed, cfg, isConnected, isFrozen, lastTs: live ? live.ts : 0 };
  }).sort((a, b) => {
    if (a.isConnected && !b.isConnected) return -1;
    if (!a.isConnected && b.isConnected) return 1;
    return b.lastTs - a.lastTs;
  });

  const expanded = _vaultCurrentServer;

  o.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px 14px;border-bottom:1px solid var(--border);flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="font-family:var(--vt);font-size:22px;color:var(--accent2);letter-spacing:.1em;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>BACKUP VAULT</div>
        <div style="font-size:8px;color:var(--text3);letter-spacing:.18em;padding-top:2px;">${sks.length} SERVER${sks.length!==1?'S':''} · LOCAL ONLY · SUPABASE-INDEPENDENT</div>
      </div>
      <button onclick="closeBackupVault()" style="background:none;border:none;color:var(--text3);font-family:var(--font);font-size:10px;cursor:pointer;letter-spacing:.06em;" onmouseover="this.style.color='var(--accent3)'" onmouseout="this.style.color='var(--text3)'"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="display:inline-block;vertical-align:middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> CLOSE</button>
    </div>

    <div style="flex:1;overflow-y:auto;padding:16px 24px 40px;">
      ${rows.length === 0 ? _vaultEmpty() : rows.map(r => _vaultServerBlock(r, r.sk === expanded)).join('')}
    </div>`;
}

function _vaultEmpty() {
  return `<div style="text-align:center;padding:80px 0;color:var(--text3);">
    <div style="font-size:28px;margin-bottom:12px;opacity:.3;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;opacity:.3;"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg></div>
    <div style="font-size:11px;letter-spacing:.1em;">NO BACKUPS YET</div>
    <div style="font-size:9px;margin-top:8px;opacity:.5;">Host a server and backups will appear here automatically.</div>
  </div>`;
}

function _vaultServerBlock(r, expanded) {
  const { sk, live, timed, cfg, isConnected, isFrozen } = r;
  const name = (live && live.serverName) || sk;
  const liveAgo = live ? _fmtAgo(live.ts) : '—';
  const timedCount = timed.length;
  const projCount = live ? Object.keys(live.projects||{}).length : 0;
  const liveUpdates = live ? (live.updateCount||1) : 0;

  const statusDot = isFrozen
    ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent3);flex-shrink:0;" title="Frozen"></span>`
    : isConnected
      ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 5px var(--accent);flex-shrink:0;animation:glowPulse 2s infinite;" title="Live"></span>`
      : `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--border2);flex-shrink:0;" title="Offline"></span>`;

  const frozenTag = isFrozen
    ? `<span style="font-size:7px;padding:1px 6px;border:1px solid var(--accent3);color:var(--accent3);border-radius:1px;letter-spacing:.1em;">DELETED SERVER</span>`
    : isConnected
      ? `<span style="font-size:7px;padding:1px 6px;border:1px solid var(--accent);color:var(--accent);border-radius:1px;letter-spacing:.1em;">LIVE</span>`
      : `<span style="font-size:7px;padding:1px 6px;border:1px solid var(--border2);color:var(--text3);border-radius:1px;letter-spacing:.1em;">OFFLINE</span>`;

  const expandContent = expanded ? _vaultExpandedContent(r) : '';

  return `
    <div style="background:var(--bg2);border:1px solid ${isFrozen?'rgba(240,74,74,.3)':isConnected?'rgba(74,240,200,.25)':'var(--border)'};border-radius:3px;margin-bottom:10px;overflow:hidden;">

      <!-- SERVER ROW HEADER -->
      <div onclick="_vaultToggle('${escHtml(sk)}')" style="display:flex;align-items:center;gap:12px;padding:13px 16px;cursor:pointer;user-select:none;"
        onmouseover="this.style.background='rgba(255,255,255,.02)'" onmouseout="this.style.background='none'">
        ${statusDot}
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-family:var(--vt);font-size:15px;color:var(--text);">${escHtml(name)}</span>
            ${frozenTag}
          </div>
          <div style="font-size:9px;color:var(--text3);margin-top:3px;display:flex;gap:12px;flex-wrap:wrap;">
            <span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>Live: ${liveAgo} · ${liveUpdates} updates</span>
            <span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>${timedCount} timed snapshot${timedCount!==1?'s':''}</span>
            <span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>${projCount} project${projCount!==1?'s':''}</span>
          </div>
        </div>
        <span style="color:var(--text3);font-size:12px;transition:transform .2s;${expanded?'transform:rotate(90deg)':''}">▶</span>
      </div>

      <!-- EXPANDED CONTENT -->
      ${expanded ? `<div style="border-top:1px solid var(--border);">${expandContent}</div>` : ''}
    </div>`;
}

function _vaultToggle(sk) {
  _vaultCurrentServer = (_vaultCurrentServer === sk) ? null : sk;
  _vaultRefresh();
}

function _vaultExpandedContent(r) {
  const { sk, live, timed, cfg, isConnected, isFrozen } = r;
  const name = (live && live.serverName) || sk;

  // ── INTERVAL SELECTOR ──
  const intervalPicker = isConnected && !isFrozen ? `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <span style="font-size:9px;color:var(--text3);letter-spacing:.14em;">TIMED INTERVAL:</span>
      ${BAK_INTERVALS.map(opt => {
        const active = cfg.interval === opt.ms;
        return `<button onclick="bakSetInterval('${escHtml(sk)}','${escHtml(name)}',${opt.ms});_vaultCurrentServer='${escHtml(sk)}';_vaultRefresh();"
          style="background:${active?'rgba(74,240,200,.12)':'none'};border:1px solid ${active?'var(--accent2)':'var(--border2)'};color:${active?'var(--accent2)':'var(--text3)'};font-family:var(--font);font-size:9px;padding:3px 10px;cursor:pointer;border-radius:1px;letter-spacing:.06em;"
          onmouseover="this.style.borderColor='var(--accent2)';this.style.color='var(--accent2)'"
          onmouseout="this.style.borderColor='${active?'var(--accent2)':'var(--border2)'}';this.style.color='${active?'var(--accent2)':'var(--text3)'}'">
          ${opt.label}
        </button>`;
      }).join('')}
    </div>` : `<div style="font-size:9px;color:var(--text3);">${isFrozen ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Server deleted — timed backups frozen.' : 'Connect to this server as host to configure timed backups.'}</div>`;

  // ── LIVE BACKUP PANEL ──
  const livePanel = _vaultLivePanel(sk, live, isConnected, isFrozen, name);

  // ── TIMED SNAPSHOTS TABLE ──
  const timedPanel = _vaultTimedPanel(sk, timed, isConnected, name);

  // ── DELETE ALL ──
  const deleteAll = `
    <button onclick="bakDeleteAllForServer('${escHtml(sk)}')" style="background:none;border:1px solid rgba(240,74,74,.35);color:var(--accent3);font-family:var(--font);font-size:8px;padding:3px 10px;cursor:pointer;border-radius:1px;letter-spacing:.06em;" onmouseover="this.style.borderColor='var(--accent3)'" onmouseout="this.style.borderColor='rgba(240,74,74,.35)'"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>Delete All Backups for This Server</button>`;

  return `
    <div style="padding:14px 16px;display:flex;flex-direction:column;gap:16px;">
      <!-- Interval selector -->
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:2px;padding:12px 14px;">
        <div style="font-size:8px;color:var(--text3);letter-spacing:.2em;margin-bottom:10px;">⏱ TIMED SNAPSHOT INTERVAL</div>
        ${intervalPicker}
      </div>
      ${livePanel}
      ${timedPanel}
      <div>${deleteAll}</div>
    </div>`;
}

function _vaultLivePanel(sk, live, isConnected, isFrozen, name) {
  if (!live) {
    return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:2px;padding:12px 14px;font-size:10px;color:var(--text3);">No live backup yet — will appear once connected as host.</div>`;
  }
  const projEntries = Object.values(live.projects || {});

  return `
    <div style="background:var(--bg3);border:1px solid ${isFrozen?'rgba(240,74,74,.2)':'rgba(74,240,200,.15)'};border-radius:2px;padding:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <div>
          <span style="font-size:8px;color:${isFrozen?'var(--accent3)':'var(--accent2)'};letter-spacing:.2em;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>LIVE BACKUP</span>
          <span style="font-size:8px;color:var(--text3);margin-left:10px;">Last updated: ${_fmtTs(live.ts)} · ${live.updateCount||1} total saves</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${isConnected && !isFrozen ? `<button onclick="bakManualLiveSnapshot('${escHtml(sk)}','${escHtml(name)}')" style="background:none;border:1px solid var(--accent2);color:var(--accent2);font-family:var(--font);font-size:8px;padding:3px 10px;cursor:pointer;border-radius:1px;letter-spacing:.06em;">↻ Refresh Now</button>` : ''}
          <button onclick="bakExportSnap('live','${escHtml(sk)}')" style="background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--font);font-size:8px;padding:3px 10px;cursor:pointer;border-radius:1px;letter-spacing:.06em;" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text3)'">⬇ Export JSON</button>
        </div>
      </div>

      <!-- Projects in live snap -->
      ${projEntries.length === 0
        ? `<div style="font-size:9px;color:var(--text3);">No projects in snapshot.</div>`
        : `<div style="display:flex;flex-direction:column;gap:4px;">
            ${projEntries.map(p => `
              <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:rgba(0,0,0,.2);border-radius:2px;">
                <div style="width:7px;height:7px;border-radius:50%;background:${escHtml(p.color||'#4af0c8')};flex-shrink:0;"></div>
                <span style="flex:1;font-size:10px;color:var(--text);">${escHtml(p.name||'?')}</span>
                <span style="font-size:9px;color:var(--text3);">${Object.keys(p.tasks||{}).length} tasks · ${Object.keys(p.bugs||{}).length} bugs</span>
              </div>`).join('')}
          </div>`}
    </div>`;
}

function _vaultTimedPanel(sk, timed, isConnected, name) {
  const isFrozen = timed.length && timed[0].frozen;

  return `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:2px;padding:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <span style="font-size:8px;color:var(--accent);letter-spacing:.2em;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>TIMED SNAPSHOTS (${timed.length}/${BAK_MAX_SLOTS})</span>
        ${isConnected && !isFrozen ? `<button onclick="bakManualTimedSnapshot('${escHtml(sk)}','${escHtml(name)}')" style="background:none;border:1px solid var(--accent);color:var(--accent);font-family:var(--font);font-size:8px;padding:3px 10px;cursor:pointer;border-radius:1px;letter-spacing:.06em;">+ Take Snapshot Now</button>` : ''}
      </div>

      ${timed.length === 0
        ? `<div style="font-size:9px;color:var(--text3);">No timed snapshots yet. Set an interval above or take one manually.</div>`
        : `<div style="display:flex;flex-direction:column;gap:4px;">
            ${timed.map((snap, i) => _vaultTimedRow(sk, snap, i)).join('')}
          </div>`}
    </div>`;
}

function _vaultTimedRow(sk, snap, idx) {
  const projCount = Object.keys(snap.projects || {}).length;
  const projNames = _projSummary(snap.projects);
  return `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:rgba(0,0,0,.2);border-radius:2px;flex-wrap:wrap;gap:6px;">
      <div style="width:6px;height:6px;border-radius:50%;background:${idx===0?'var(--accent)':'var(--border2)'};flex-shrink:0;" title="${idx===0?'Newest':''}"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:10px;color:var(--text);">${escHtml(snap.label || _fmtTs(snap.ts))}</div>
        <div style="font-size:9px;color:var(--text3);margin-top:1px;">${projCount} project${projCount!==1?'s':''} ${projNames ? '· '+escHtml(projNames) : ''}</div>
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0;">
        <button onclick="bakExportSnap('timed','${escHtml(sk)}',${idx})" style="background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--font);font-size:8px;padding:2px 8px;cursor:pointer;border-radius:1px;" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text3)'">⬇ Export</button>
        <button onclick="bakDeleteTimedSlot('${escHtml(sk)}',${idx})" style="background:none;border:1px solid rgba(240,74,74,.3);color:var(--accent3);font-family:var(--font);font-size:8px;padding:2px 8px;cursor:pointer;border-radius:1px;" onmouseover="this.style.borderColor='var(--accent3)'" onmouseout="this.style.borderColor='rgba(240,74,74,.3)'"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="display:inline-block;vertical-align:middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
    </div>`;
}

// ── VAULT ACTIONS ────────────────────────────────────────────

async function bakManualLiveSnapshot(sk, name) {
  toast('Refreshing live backup…');
  await bakUpdateLive(sk, name);
  toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Live backup refreshed');
  _vaultCurrentServer = sk;
  _vaultRefresh();
}

async function bakManualTimedSnapshot(sk, name) {
  toast('Taking snapshot…');
  await bakTakeTimedSnapshot(sk, name, _fmtTs(Date.now()) + ' (manual)');
  toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Snapshot saved');
  _vaultCurrentServer = sk;
  _vaultRefresh();
}

function bakExportSnap(type, sk, idx) {
  let data;
  if (type === 'live') {
    data = _bakLoad(BAK_LIVE_PFX + sk);
  } else {
    const slots = _bakLoad(BAK_TIMED_PFX + sk) || [];
    data = slots[idx];
  }
  if (!data) { toast('Snapshot not found'); return; }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (data.serverName || sk).replace(/[^a-z0-9]/gi, '_');
  const ts = new Date(data.ts).toISOString().slice(0, 16).replace('T', '-').replace(':', '');
  a.href = url; a.download = `lms-${type}-backup-${safeName}-${ts}.json`; a.click();
  URL.revokeObjectURL(url);
  toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Exported');
}

function bakDeleteTimedSlot(sk, idx) {
  openModal('Delete Snapshot', `<p style="font-size:11px;color:var(--text2);">Remove this timed snapshot? It cannot be recovered.</p>`, [
    { label: 'Cancel', action: closeModal },
    { label: 'Delete', action: () => {
      const slots = _bakLoad(BAK_TIMED_PFX + sk) || [];
      slots.splice(idx, 1);
      _bakSave(BAK_TIMED_PFX + sk, slots);
      closeModal(); _vaultCurrentServer = sk; _vaultRefresh();
      toast('Snapshot deleted');
    }, danger: true }
  ]);
}

function bakDeleteAllForServer(sk) {
  openModal('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Delete All Backups', `
    <div style="background:rgba(240,74,74,.08);border:1px solid var(--accent3);border-radius:2px;padding:10px 12px;margin-bottom:12px;font-size:10px;color:var(--accent3);line-height:1.7;">
      This deletes ALL backup data for this server — live and all timed snapshots. Cannot be undone.
    </div>`, [
    { label: 'Cancel', action: closeModal },
    { label: 'Delete Everything', action: () => {
      _bakDel(BAK_LIVE_PFX + sk);
      _bakDel(BAK_TIMED_PFX + sk);
      _bakDel(BAK_CFG_PFX + sk);
      closeModal(); _vaultCurrentServer = null; _vaultRefresh();
      toast('All backups deleted for server');
    }, danger: true }
  ]);
}