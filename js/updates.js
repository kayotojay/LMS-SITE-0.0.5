// LMS Dev Hub — updates.js
// ========================================

// =====================================================
// SITE UPDATES PANEL
// =====================================================
let _siteUpdatesPanelOpen = false;
let _siteUpdatesLoaded = false;
let _siteUpdatesData = [];
let _siteUpdateTimerTick = null;

function toggleSiteUpdates(){
  const panel = document.getElementById('rs-updates-panel');
  const arrow = document.getElementById('rs-updates-arrow');
  const btn = document.getElementById('rs-updates-btn');
  if(!panel) return;
  _siteUpdatesPanelOpen = !_siteUpdatesPanelOpen;
  panel.style.display = _siteUpdatesPanelOpen ? 'block' : 'none';
  panel.classList.toggle('open', _siteUpdatesPanelOpen);
  if(arrow) arrow.textContent = _siteUpdatesPanelOpen ? '▲' : '▼';
  if(_siteUpdatesPanelOpen){
    btn.style.color = 'var(--accent6)';
    btn.style.borderColor = 'var(--accent6)';
    if(!_siteUpdatesLoaded) fetchSiteUpdates();
  } else {
    btn.style.color = 'var(--text3)';
    btn.style.borderColor = 'var(--border)';
  }
}

async function fetchSiteUpdates(){
  _siteUpdatesLoaded = true;
  const listEl = document.getElementById('rs-updates-list');
  if(!listEl) return;
  // Site updates live in YOUR config project (CFG_URL/CFG_KEY), not the user's DB.
  // This means updates show for everyone automatically — no user DB setup needed.
  try {
    const res = await fetch(CFG_URL + '/rest/v1/site_updates?select=*&order=created_at.desc&limit=20', {
      headers: { 'apikey': CFG_KEY, 'Authorization': 'Bearer ' + CFG_KEY, 'Content-Type': 'application/json' }
    });
    if(!res.ok){ throw new Error('HTTP ' + res.status); }
    const data = await res.json();
    _siteUpdatesData = data || [];
    renderSiteUpdates();
  } catch(e) {
    console.warn('LMS: could not fetch site updates', e);
    listEl.innerHTML = '<div style="font-size:10px;color:var(--text3);padding:14px 12px;text-align:center;line-height:1.6;">Could not load updates.<br><span style="font-size:9px;color:var(--accent3);">Run the SQL below in your config project to create the table.</span></div>';
  }
}

function renderSiteUpdates(){
  const listEl = document.getElementById('rs-updates-list');
  const dot = document.getElementById('rs-updates-dot');
  if(!listEl) return;
  const data = _siteUpdatesData;

  // ---- Visibility filtering ----
  // Each update can have a visible_duration (seconds). We track when the user
  // first saw it in localStorage. Once the duration expires, the update is hidden.
  const seenKey = 'lms_update_seen';
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(seenKey) || '{}'); } catch(e){}

  const now = Date.now();
  const visible = data.filter(u => {
    // Hard delete_after date (server-set, no localStorage needed)
    if(u.delete_after && new Date(u.delete_after).getTime() < now) return false;
    // Existing per-user visible_duration logic
    if(!u.visible_duration) return true;
    const firstSeen = seen[u.id];
    if(!firstSeen) return true;
    return (now - firstSeen) < (u.visible_duration * 1000);
  });

  // Mark all currently visible as seen (record first-seen timestamp)
  visible.forEach(u => { if(u.visible_duration && !seen[u.id]) seen[u.id] = now; });
  try { localStorage.setItem(seenKey, JSON.stringify(seen)); } catch(e){}

  // Dot: show if any visible update is flagged is_new
  const hasNew = visible.some(u => u.is_new);
  if(dot) dot.style.display = hasNew ? 'block' : 'none';

  if(!visible.length){
    listEl.innerHTML = '<div style="font-size:10px;color:var(--text3);padding:14px 12px;text-align:center;letter-spacing:.06em;">No active updates.</div>';
    return;
  }

  const defaultTagColors = { announcement:'#4af0c8', update:'#c8f04a', fix:'#f0a84a', warning:'#f0504a', info:'#8892b8' };

  listEl.innerHTML = visible.map(u => {
    const tag = u.tag || 'info';
    // color column overrides default tag color
    const accentColor = u.color || defaultTagColors[tag] || '#8892b8';
    const ts = u.created_at ? new Date(u.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : '';

    // Timer display: how long left before this update disappears
    let timerHtml = '';
    if(u.visible_duration){
      const firstSeen = seen[u.id] || now;
      const msLeft = Math.max(0, (u.visible_duration * 1000) - (now - firstSeen));
      const totalSec = Math.round(msLeft / 1000);
      if(totalSec > 0){
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const timeStr = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
        timerHtml = `<span style="font-size:8px;color:${accentColor};opacity:.7;letter-spacing:.06em;" title="Disappears in ${timeStr}">⏱ ${timeStr}</span>`;
      }
    }

    return `<div style="
      padding:10px 12px;
      border-bottom:1px solid var(--border);
      border-left:3px solid ${accentColor};
      background:linear-gradient(90deg,${accentColor}0d,transparent 60%);
      position:relative;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap;">
        ${u.is_new ? `<span style="width:5px;height:5px;border-radius:50%;background:${accentColor};box-shadow:0 0 4px ${accentColor};flex-shrink:0;display:inline-block;"></span>` : ''}
        <span style="font-size:8px;padding:1px 6px;background:${accentColor}22;border:1px solid ${accentColor};color:${accentColor};border-radius:1px;letter-spacing:.1em;text-transform:uppercase;font-weight:bold;">${escHtml(tag)}</span>
        <span style="font-size:8px;color:var(--text3);letter-spacing:.04em;">${ts}</span>
        <span style="margin-left:auto;">${timerHtml}</span>
      </div>
      <div style="font-size:11px;color:var(--text);letter-spacing:.04em;margin-bottom:${u.body?'4px':'0'};font-weight:bold;">${escHtml(u.title||'')}</div>
      ${u.body ? `<div style="font-size:10px;color:var(--text2);line-height:1.6;white-space:pre-wrap;">${escHtml(u.body)}</div>` : ''}
    </div>`;
  }).join('');

  // Live-tick timers every second if any timed updates are visible
  if(visible.some(u => u.visible_duration)){
    clearTimeout(_siteUpdateTimerTick);
    _siteUpdateTimerTick = setTimeout(() => {
      if(_siteUpdatesPanelOpen) renderSiteUpdates();
    }, 1000);
  }
}

// Close updates panel when clicking outside
document.addEventListener('click', function(e){
  const panel = document.getElementById('rs-updates-panel');
  const btn = document.getElementById('rs-updates-btn');
  if(_siteUpdatesPanelOpen && panel && btn && !panel.contains(e.target) && !btn.contains(e.target)){
    _siteUpdatesPanelOpen = false;
    panel.style.display = 'none';
    panel.classList.remove('open');
    const arrow = document.getElementById('rs-updates-arrow');
    if(arrow) arrow.textContent = '▼';
    btn.style.color = 'var(--text3)';
    btn.style.borderColor = 'var(--border)';
  }
});

function openRootSettings(){
  // Build or show the root settings overlay
  let overlay=document.getElementById('root-settings-overlay');
  if(overlay){overlay.style.display='flex';_rsyncRootSettings();return;}
  overlay=document.createElement('div');
  overlay.id='root-settings-overlay';
  overlay.style.cssText='display:flex;position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:4000;overflow-y:auto;backdrop-filter:blur(14px);align-items:flex-start;justify-content:center;';
  overlay.innerHTML=`
  <div style="width:100%;max-width:980px;padding:28px 24px 80px;">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;">
      <div>
        <div style="font-family:var(--vt);font-size:36px;letter-spacing:.12em;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">HUB SETTINGS</div>
        <div style="font-size:9px;color:var(--text3);letter-spacing:.28em;margin-top:4px;">APPEARANCE · BEHAVIOUR · DATA</div>
      </div>
      <button onclick="closeRootSettings()" style="background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--font);font-size:11px;padding:6px 16px;cursor:pointer;border-radius:1px;letter-spacing:.08em;" onmouseover="this.style.borderColor='var(--accent3)';this.style.color='var(--accent3)'" onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--text3)'">✕ Close</button>
    </div>

    <!-- GRID LAYOUT: 3 columns -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">

      <!-- COL 1: Themes -->
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="settings-section">
          <h3>Color Theme</h3>
          <div style="font-size:8px;color:var(--text3);letter-spacing:.18em;margin-bottom:8px;">— DARK —</div>
          <div class="theme-grid-v2" id="rs-theme-grid-dark"></div>
          <div style="font-size:8px;color:var(--text3);letter-spacing:.18em;margin:10px 0 8px;">— LIGHT —</div>
          <div class="theme-grid-v2" id="rs-theme-grid-light"></div>
          <div style="font-size:8px;color:var(--text3);letter-spacing:.18em;margin:10px 0 8px;">— BRAND —</div>
          <div class="theme-grid-v2" id="rs-theme-grid-brand"></div>
          <div style="height:1px;background:var(--border);margin:12px 0 10px;"></div>
          <div style="font-size:9px;color:var(--text3);letter-spacing:.12em;margin-bottom:6px;">ACCENT OVERRIDE</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <input type="color" id="rs-accent-pick" value="#c8f04a" oninput="setAccent(this.value)" style="width:32px;height:24px;border:1px solid var(--border2);background:none;cursor:pointer;border-radius:2px;">
            <button class="btn" style="padding:3px 10px;font-size:8px;" onclick="clearAccentOverride()">Reset</button>
          </div>
          <div style="height:1px;background:var(--border);margin:10px 0 10px;"></div>
          <div style="font-size:9px;color:var(--text3);letter-spacing:.12em;margin-bottom:8px;">FONT</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;" id="rs-font-grid">
            ${[['mono','Mono'],['pixel','Pixel'],['sans','Sans'],['serif','Serif'],['slab','Slab']].map(([f,l])=>`<button class="theme-btn rs-font-btn" data-f="${f}" onclick="setFont('${f}');document.querySelectorAll('.rs-font-btn').forEach(b=>b.classList.toggle('active',b.dataset.f==='${f}'));">${l}</button>`).join('')}
          </div>
          <div style="font-size:9px;color:var(--text3);letter-spacing:.12em;margin-bottom:8px;">HOME LAYOUT</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;" id="rs-layout-grid">
            ${[['','Default'],['compact','Compact'],['retro','Retro'],['godot','Godot'],['unity','Unity'],['minimal','Minimal'],['youtube','▶ YT'],['discord','Discord'],['twitter','𝕏 X'],['spacex','SpaceX']].map(([v,l])=>`<button class="theme-btn rs-layout-btn" data-l="${v}" onclick="setLayout('${v}');document.querySelectorAll('.rs-layout-btn').forEach(b=>b.classList.toggle('active',b.dataset.l==='${v}'));">${l}</button>`).join('')}
          </div>
          <div style="height:1px;background:var(--border);margin:10px 0 10px;"></div>
          <div class="setting-row">
            <div><div class="setting-label">Scanlines</div><div class="setting-sub">CRT overlay effect</div></div>
            <div class="toggle" id="rs-toggle-scanlines" onclick="toggleScanlines(this);this.classList.toggle('on',SETTINGS.scanlines);"></div>
          </div>
          <div class="setting-row">
            <div><div class="setting-label">Compact Sidebar</div><div class="setting-sub">Narrower nav panel</div></div>
            <div class="toggle" id="rs-toggle-compact" onclick="toggleCompact(this);this.classList.toggle('on',SETTINGS.compact);"></div>
          </div>
        </div>
      </div>

      <!-- COL 2: Custom Theme + Behaviour -->
      <div style="display:flex;flex-direction:column;gap:14px;">

        <!-- Custom Theme Builder (collapsed by default, expands on click) -->
        <div class="settings-section">
          <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;" onclick="toggleRsCustomTheme()">
            <h3 style="margin-bottom:0;">✦ Custom Theme</h3>
            <span id="rs-ct-arr" style="font-size:10px;color:var(--text3);transition:transform .2s;">▶</span>
          </div>
          <div id="rs-ct-body" style="display:none;margin-top:12px;">
            <div style="font-size:9px;color:var(--text3);margin-bottom:10px;line-height:1.6;">Build your own theme. Click Apply to preview live.</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
              ${[['bg','BG Base'],['bg2','BG Surface'],['bg3','BG Elevated'],['bg4','BG High'],['inp-bg','Input BG'],['border','Border Subtle'],['border2','Border Strong'],['text','Text Primary'],['text2','Text Secondary'],['text3','Text Muted'],['accent','Accent 1'],['accent2','Accent 2'],['accent3','Danger'],['accent4','Warning'],['accent5','Purple'],['accent6','Blue']].map(([k,l])=>`<div class="ct-row"><span class="ct-lbl" style="font-size:8px;">${l}</span><input type="color" class="ct-pick" id="rs-ct-${k}" oninput="previewCustomTheme()"></div>`).join('')}
            </div>
            <div id="rs-ct-preview" style="background:var(--ct-bg2,#0d0f18);border:1px solid var(--ct-border,#1f2438);border-radius:3px;padding:8px;border-top:2px solid var(--ct-accent,#c8f04a);margin-bottom:8px;">
              <div style="font-family:var(--vt);font-size:14px;color:var(--ct-accent,#c8f04a);margin-bottom:2px;">PREVIEW</div>
              <div style="height:2px;background:linear-gradient(90deg,var(--ct-accent,#c8f04a),var(--ct-accent2,#4af0c8));margin-bottom:6px;"></div>
              <div style="display:flex;gap:3px;flex-wrap:wrap;">
                <span style="font-size:8px;padding:1px 5px;border:1px solid var(--ct-accent2,#4af0c8);color:var(--ct-accent2,#4af0c8);border-radius:1px;">tag</span>
                <span style="font-size:8px;padding:1px 5px;border:1px solid var(--ct-accent3,#f0504a);color:var(--ct-accent3,#f0504a);border-radius:1px;">danger</span>
              </div>
            </div>
            <div style="display:flex;gap:6px;margin-bottom:6px;">
              <button class="btn accent" onclick="applyCustomTheme()" style="flex:1;">▶ Apply</button>
              <button class="btn" onclick="exportCustomTheme()">↑ Export</button>
            </div>
            <div style="display:flex;gap:4px;">
              <input id="rs-ct-save-name" class="modal-inp" placeholder="Name theme…" style="flex:1;font-size:10px;margin-bottom:0;">
              <button class="btn" onclick="rsCtSave()">Save</button>
            </div>
          </div>
        </div>

        <!-- Behaviour Settings -->
        <div class="settings-section">
          <h3>Behaviour</h3>

          <div class="setting-row">
            <div><div class="setting-label">Confirm Before Delete</div><div class="setting-sub">Prompt before removing projects or phases</div></div>
            <div class="toggle${SETTINGS.confirmDelete!==false?' on':''}" id="rs-tog-confirmdelete" onclick="toggleSetting('confirmDelete',this)"></div>
          </div>

          <div class="setting-row">
            <div><div class="setting-label">Auto-Save Sessions</div><div class="setting-sub">Log timer sessions automatically on stop</div></div>
            <div class="toggle${SETTINGS.autoSaveSessions!==false?' on':''}" id="rs-tog-autosave" onclick="toggleSetting('autoSaveSessions',this)"></div>
          </div>

          <div class="setting-row">
            <div><div class="setting-label">Show Phase Progress %</div><div class="setting-sub">Display percentage on phase cards</div></div>
            <div class="toggle${SETTINGS.showPhasePercent!==false?' on':''}" id="rs-tog-phasepct" onclick="toggleSetting('showPhasePercent',this)"></div>
          </div>

          <div class="setting-row">
            <div><div class="setting-label">Collapse Phases on Load</div><div class="setting-sub">All phase cards start collapsed</div></div>
            <div class="toggle${SETTINGS.collapsePhases?' on':''}" id="rs-tog-collapse" onclick="toggleSetting('collapsePhases',this)"></div>
          </div>

          <div class="setting-row">
            <div><div class="setting-label">Enable Keyboard Shortcuts</div><div class="setting-sub">Ctrl+S saves, Esc closes panels</div></div>
            <div class="toggle${SETTINGS.keyboardShortcuts!==false?' on':''}" id="rs-tog-keys" onclick="toggleSetting('keyboardShortcuts',this)"></div>
          </div>

          <div class="setting-row">
            <div><div class="setting-label">Show Completed Tasks</div><div class="setting-sub">Keep done tasks visible in phase cards</div></div>
            <div class="toggle${SETTINGS.showCompleted!==false?' on':''}" id="rs-tog-done" onclick="toggleSetting('showCompleted',this)"></div>
          </div>

          <div class="setting-row">
            <div><div class="setting-label">Dense Activity Log</div><div class="setting-sub">Show up to 30 activity entries instead of 15</div></div>
            <div class="toggle${SETTINGS.denseActivity?' on':''}" id="rs-tog-dense" onclick="toggleSetting('denseActivity',this)"></div>
          </div>

          <div style="height:1px;background:var(--border);margin:10px 0;"></div>

          <div style="font-size:9px;color:var(--text3);letter-spacing:.12em;margin-bottom:6px;">DEFAULT ENGINE</div>
          <input id="rs-default-engine" class="modal-inp" placeholder="e.g. Godot 4, Unity 6…" value="${escHtml(SETTINGS.defaultEngine||'')}" style="margin-bottom:6px;font-size:10px;" oninput="SETTINGS.defaultEngine=this.value;saveSettings();">
          <div style="font-size:9px;color:var(--text3);letter-spacing:.08em;margin-bottom:10px;">Pre-filled when creating new projects.</div>

          <div style="font-size:9px;color:var(--text3);letter-spacing:.12em;margin-bottom:6px;">SIDEBAR WIDTH</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="range" min="160" max="300" step="10" value="${parseInt(SETTINGS.sidebarWidth)||220}" id="rs-sidebar-width" style="flex:1;" oninput="document.getElementById('rs-sw-val').textContent=this.value+'px';SETTINGS.sidebarWidth=this.value;document.documentElement.style.setProperty('--sidebar',this.value+'px');saveSettings();">
            <span id="rs-sw-val" style="font-size:10px;color:var(--text2);width:36px;">${parseInt(SETTINGS.sidebarWidth)||220}px</span>
          </div>
        </div>

      </div>

      <!-- COL 3: Data + Import/Export Shortcuts -->
      <div style="display:flex;flex-direction:column;gap:14px;">

        <div class="settings-section">
          <h3>Dashboard</h3>

          <div class="setting-row">
            <div><div class="setting-label">Show Project Stats</div><div class="setting-sub">Display task/script counts on root cards</div></div>
            <div class="toggle${SETTINGS.showProjectStats!==false?' on':''}" id="rs-tog-stats" onclick="toggleSetting('showProjectStats',this)"></div>
          </div>

          <div class="setting-row">
            <div><div class="setting-label">Show Progress Bar</div><div class="setting-sub">Task completion bar on project cards</div></div>
            <div class="toggle${SETTINGS.showProgressBar!==false?' on':''}" id="rs-tog-progbar" onclick="toggleSetting('showProgressBar',this)"></div>
          </div>

          <div class="setting-row">
            <div><div class="setting-label">Show Creation Date</div><div class="setting-sub">Date stamp on each project card</div></div>
            <div class="toggle${SETTINGS.showCreatedDate!==false?' on':''}" id="rs-tog-date" onclick="toggleSetting('showCreatedDate',this)"></div>
          </div>

          <div class="setting-row">
            <div><div class="setting-label">Animate Card Entrance</div><div class="setting-sub">Staggered card fade-in on home load</div></div>
            <div class="toggle${SETTINGS.animateCards!==false?' on':''}" id="rs-tog-anim" onclick="toggleSetting('animateCards',this)"></div>
          </div>

          <div style="height:1px;background:var(--border);margin:10px 0;"></div>

          <div style="font-size:9px;color:var(--text3);letter-spacing:.12em;margin-bottom:6px;">PROJECTS SORT ORDER</div>
          <select id="rs-sort-order" class="modal-select" style="margin-bottom:10px;font-size:10px;" onchange="SETTINGS.sortOrder=this.value;saveSettings();renderRootGrid();">
            <option value="created-desc" ${(SETTINGS.sortOrder||'created-desc')==='created-desc'?'selected':''}>Newest First</option>
            <option value="created-asc" ${(SETTINGS.sortOrder||'')==='created-asc'?'selected':''}>Oldest First</option>
            <option value="name-asc" ${(SETTINGS.sortOrder||'')==='name-asc'?'selected':''}>Name A–Z</option>
            <option value="name-desc" ${(SETTINGS.sortOrder||'')==='name-desc'?'selected':''}>Name Z–A</option>
            <option value="progress-desc" ${(SETTINGS.sortOrder||'')==='progress-desc'?'selected':''}>Most Complete</option>
          </select>

          <div style="font-size:9px;color:var(--text3);letter-spacing:.12em;margin-bottom:6px;">CARDS PER ROW (max)</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px;">
            ${['auto','2','3','4'].map(v=>`<button class="theme-btn" onclick="SETTINGS.cardsPerRow='${v}';saveSettings();applyCardsPerRow();document.querySelectorAll('#rs-cpr-btn button').forEach(b=>b.classList.toggle('active',b.textContent==='${v}'));" style="${(SETTINGS.cardsPerRow||'auto')===v?'border-color:var(--accent);color:var(--accent)':''}">${v}</button>`).join('')}
          </div>
          <div style="font-size:8px;color:var(--text3);margin-bottom:10px;">Auto fits your screen width.</div>
        </div>

        <div class="settings-section">
          <h3>Notifications</h3>
          <div class="setting-row">
            <div><div class="setting-label">Toast Duration</div><div class="setting-sub">How long pop-up notices stay visible</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <input type="range" min="1000" max="5000" step="500" value="${SETTINGS.toastDuration||2200}" id="rs-toast-dur" style="flex:1;" oninput="document.getElementById('rs-td-val').textContent=(this.value/1000).toFixed(1)+'s';SETTINGS.toastDuration=parseInt(this.value);saveSettings();">
            <span id="rs-td-val" style="font-size:10px;color:var(--text2);width:30px;">${((SETTINGS.toastDuration||2200)/1000).toFixed(1)}s</span>
          </div>
          <div class="setting-row">
            <div><div class="setting-label">Sound on Complete</div><div class="setting-sub">Play a subtle tick when task is checked</div></div>
            <div class="toggle${SETTINGS.soundOnComplete?' on':''}" id="rs-tog-sound" onclick="toggleSetting('soundOnComplete',this)"></div>
          </div>
        </div>

        <div class="settings-section danger-zone">
          <h3>Data</h3>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button class="btn" onclick="gdriveExportAll()" style="width:100%;text-align:left;">↓ Export Full Backup</button>
            <button class="btn" onclick="triggerImportBackup()" style="width:100%;text-align:left;">↑ Import Backup</button>
            <button class="btn" onclick="closeRootSettings();openSupabaseSetup();" style="width:100%;text-align:left;color:var(--accent2);border-color:var(--accent2);">⚙ Database Setup</button>
            <div style="height:1px;background:var(--border);margin:4px 0;"></div>
            <button class="btn danger" onclick="confirmClearAllProjects()" style="width:100%;text-align:left;">⚠ Clear ALL Projects</button>
          </div>
        </div>

        <div class="settings-section" style="background:rgba(200,240,74,.03);border-color:rgba(200,240,74,.2);">
          <h3 style="font-size:13px;">About</h3>
          <div style="font-size:9px;color:var(--text3);line-height:2;letter-spacing:.06em;">
            <div>LMS Dev Hub <span style="color:var(--accent);">v52</span></div> 
            <div>Engine: <span style="color:var(--text2);">Supabase REST</span></div>
            <div>Projects: <span id="rs-proj-count" style="color:var(--accent);">—</span></div>
            <div>Scripts: <span id="rs-script-count" style="color:var(--accent2);">—</span></div>
            <div>Storage Used: <span id="rs-storage-used" style="color:var(--accent4);">—</span></div>
          </div>
          <button class="btn" style="width:100%;margin-top:10px;font-size:9px;" onclick="computeRsStats()">Compute Stats</button>
        </div>

      </div>
    </div>
  </div>`; /*VERSION STORGE INFO*/
  document.body.appendChild(overlay);
  // Close on backdrop click
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeRootSettings();});
  _rsyncRootSettings();
}

function closeRootSettings(){
  const o=document.getElementById('root-settings-overlay');
  if(o)o.style.display='none';
}

function _rsyncRootSettings(){
  // Sync theme grid
  ['dark','light','brand'].forEach(group=>{
    const cont=document.getElementById('rs-theme-grid-'+group);
    if(!cont)return;
    cont.innerHTML='';
    const defs=THEME_DEFS[group]||[];
    defs.forEach(def=>{
      const btn=document.createElement('button');
      btn.className='theme-btn-v2'+((SETTINGS.theme||'')===def.id?' active':'');
      btn.dataset.t=def.id;
      btn.onclick=()=>{setTheme(def.id);document.querySelectorAll('.theme-btn-v2').forEach(b=>b.classList.toggle('active',b.dataset.t===def.id));};
      btn.innerHTML=`<div class="tbv2-swatches"><div class="tbv2-swatch" style="background:${def.bg};flex:2;"></div><div class="tbv2-swatch" style="background:${def.bg2};flex:1;"></div><div class="tbv2-swatch" style="background:${def.accent};flex:1;"></div><div class="tbv2-swatch" style="background:${def.accent2};flex:1;"></div><div class="tbv2-swatch" style="background:${def.accent3};flex:1;"></div></div><div class="tbv2-label">${def.label}</div>`;
      cont.appendChild(btn);
    });
    // Add custom button to dark group
    if(group==='dark'){
      const btn=document.createElement('button');
      btn.className='theme-btn-v2'+((SETTINGS.theme||'')==='custom'?' active':'');
      btn.dataset.t='custom';
      btn.onclick=()=>{
        if(SETTINGS.customTheme){setTheme('custom');document.querySelectorAll('.theme-btn-v2').forEach(b=>b.classList.toggle('active',b.dataset.t==='custom'));}
        else{toggleRsCustomTheme();}
      };
      const ct=SETTINGS.customTheme||{bg:'#07080d',accent:'#c8f04a',accent2:'#4af0c8',accent3:'#f0504a'};
      btn.innerHTML=`<div class="tbv2-swatches"><div class="tbv2-swatch" style="background:${ct.bg||'#07080d'};flex:2;"></div><div class="tbv2-swatch" style="background:${ct.accent||'#c8f04a'};flex:1;"></div><div class="tbv2-swatch" style="background:${ct.accent2||'#4af0c8'};flex:1;"></div><div class="tbv2-swatch" style="background:${ct.accent3||'#f0504a'};flex:1;"></div><div class="tbv2-swatch" style="background:linear-gradient(135deg,#888,#444);flex:1;"></div></div><div class="tbv2-label">✦ Custom</div>`;
      cont.appendChild(btn);
    }
  });
  // Sync toggles
  const togMap={
    'rs-toggle-scanlines':SETTINGS.scanlines,
    'rs-toggle-compact':SETTINGS.compact,
    'rs-tog-confirmdelete':SETTINGS.confirmDelete!==false,
    'rs-tog-autosave':SETTINGS.autoSaveSessions!==false,
    'rs-tog-phasepct':SETTINGS.showPhasePercent!==false,
    'rs-tog-collapse':!!SETTINGS.collapsePhases,
    'rs-tog-keys':SETTINGS.keyboardShortcuts!==false,
    'rs-tog-done':SETTINGS.showCompleted!==false,
    'rs-tog-dense':!!SETTINGS.denseActivity,
    'rs-tog-stats':SETTINGS.showProjectStats!==false,
    'rs-tog-progbar':SETTINGS.showProgressBar!==false,
    'rs-tog-date':SETTINGS.showCreatedDate!==false,
    'rs-tog-anim':SETTINGS.animateCards!==false,
    'rs-tog-sound':!!SETTINGS.soundOnComplete,
  };
  Object.entries(togMap).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.classList.toggle('on',!!val);});
  // Font / layout active states
  document.querySelectorAll('.rs-font-btn').forEach(b=>b.classList.toggle('active',b.dataset.f===(SETTINGS.font||'mono')));
  document.querySelectorAll('.rs-layout-btn').forEach(b=>b.classList.toggle('active',b.dataset.l===(SETTINGS.layout||'')));
  // Accent color
  const ap=document.getElementById('rs-accent-pick');if(ap)ap.value=SETTINGS.accent||'#c8f04a';
  // Sidebar width
  const sw=document.getElementById('rs-sidebar-width');if(sw)sw.value=parseInt(SETTINGS.sidebarWidth)||220;
  // Sync custom theme pickers if they exist
  CT_VARS.forEach(k=>{const el=document.getElementById('rs-ct-'+k);if(el&&SETTINGS.customTheme&&SETTINGS.customTheme[k])el.value=SETTINGS.customTheme[k];});
}

function toggleRsCustomTheme(){
  const body=document.getElementById('rs-ct-body');
  const arr=document.getElementById('rs-ct-arr');
  if(!body)return;
  const open=body.style.display!=='none';
  body.style.display=open?'none':'block';
  if(arr)arr.style.transform=open?'':'rotate(90deg)';
  if(!open){
    // Sync pickers to current values
    CT_VARS.forEach(k=>{const el=document.getElementById('rs-ct-'+k);if(el&&SETTINGS.customTheme&&SETTINGS.customTheme[k])el.value=SETTINGS.customTheme[k];});
  }
}

function rsCtSave(){
  const name=(document.getElementById('rs-ct-save-name')?.value||'').trim()||('Custom '+Date.now());
  // Gather values from rs- prefixed pickers
  const ct={};
  CT_VARS.forEach(k=>{const el=document.getElementById('rs-ct-'+k);if(el)ct[k]=el.value;});
  SETTINGS.customTheme=ct;
  applyCustomThemeCssVars(ct);
  setTheme('custom');
  let saved=[];
  try{const s=localStorage.getItem(SAVED_THEMES_SK);if(s)saved=JSON.parse(s);}catch(e){}
  saved.push({id:'ct_'+Date.now(),name,theme:ct});
  try{localStorage.setItem(SAVED_THEMES_SK,JSON.stringify(saved));}catch(e){}
  renderThemeGrid();
  renderSavedThemes();
  toast('Theme "'+name+'" saved & applied');
}

// previewCustomTheme needs to also handle rs- prefixed pickers
const _origPreviewCustomTheme=previewCustomTheme;
function previewCustomTheme(){
  const ct={};
  CT_VARS.forEach(k=>{
    // Try main settings page pickers first, then root settings pickers
    const el=document.getElementById('ct-'+k)||document.getElementById('rs-ct-'+k);
    if(el)ct[k]=el.value;
  });
  applyCustomThemeCssVars(ct);
  const sw=document.getElementById('ct-accent-swatches');
  if(sw){sw.innerHTML=['accent','accent2','accent3','accent4','accent5','accent6'].map(k=>`<div style="width:14px;height:14px;border-radius:2px;background:${ct[k]||'#888'};"></div>`).join('');}
}

function toggleSetting(key,el){
  SETTINGS[key]=!SETTINGS[key];
  el.classList.toggle('on',!!SETTINGS[key]);
  saveSettings();
  applyBehaviourSettings();
}

function applyBehaviourSettings(){
  // Toast duration
  // Cards per row
  applyCardsPerRow();
}

function applyCardsPerRow(){
  const val=SETTINGS.cardsPerRow||'auto';
  const cols=val==='auto'?'repeat(auto-fill,minmax(260px,1fr))':`repeat(${val},1fr)`;
  const grids=[
    document.getElementById('root-grid'),
    document.getElementById('rs-server-proj-grid'),
    ...Array.from(document.querySelectorAll('[class*="ms-grid-"]'))
  ].filter(Boolean);
  grids.forEach(g=>g.style.gridTemplateColumns=cols);
}

function computeRsStats(){
  let scripts=0;
  roots.forEach(r=>{const d=getRootData(r.id);scripts+=(d.scripts||[]).length;});
  let storageBytes=0;
  try{for(let k in localStorage)if(k.startsWith('lms_'))storageBytes+=localStorage[k].length*2;}catch(e){}
  const el=id=>document.getElementById(id);
  if(el('rs-proj-count'))el('rs-proj-count').textContent=roots.length;
  if(el('rs-script-count'))el('rs-script-count').textContent=scripts;
  if(el('rs-storage-used'))el('rs-storage-used').textContent=storageBytes>1048576?(storageBytes/1048576).toFixed(2)+' MB':(storageBytes/1024).toFixed(1)+' KB';
}

function confirmClearAllProjects(){
  if(SETTINGS.confirmDelete===false||!confirm('Delete ALL local projects permanently? This cannot be undone.'))return;
  roots.forEach(r=>{try{localStorage.removeItem('lms_proj_'+r.id);}catch(e){}});
  roots.length=0;
  saveRoots();
  renderRootGrid();
  toast('All local projects cleared');
}
