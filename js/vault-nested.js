// LMS Dev Hub — vault-nested.js
// DROP-IN REPLACEMENT for the Script Vault section of nav.js
// Adds: nested folders (folders inside folders), tree-view sidebar, move script/folder,
//       right-click context menu, collapse/expand, breadcrumb trail.
//
// DATA MODEL UPGRADE (backwards-compatible):
//   D.folders : [{id, name, parentId}]    — parentId null = root level
//   D.scripts : [{id, folder, name, version, code, date}]  — unchanged
//
// HOW TO INSTALL:
//   1. Remove the "SCRIPT VAULT" block from nav.js (lines between the
//      "// SCRIPT VAULT" comment and the next "// =====" block).
//   2. Add  <script src="js/vault-nested.js"></script>  after nav.js in index.html.
//   3. Replace the #page-vault HTML in index.html with the snippet below.
//
// HTML SNIPPET (replace <div class="page" id="page-vault">...</div>):
// ----------------------------------------------------------------------
// <div class="page" id="page-vault">
//   <div class="section-hdr">
//     <span class="section-title">SCRIPT VAULT</span>
//     <span class="section-sub">your project scripts</span>
//   </div>
//   <div class="vault-layout">
//     <div class="vault-sidebar" id="vault-sidebar"></div>
//     <div class="vault-main"  id="vault-main"></div>
//   </div>
// </div>
// ----------------------------------------------------------------------
//
// CSS TO ADD to main.css (append at end):
// ----------------------------------------------------------------------
// /* ---- vault-nested ---- */
// .vault-layout{display:grid;grid-template-columns:200px 1fr;gap:0;height:calc(100vh - 140px);min-height:300px;}
// .vault-sidebar{background:var(--bg1);border-right:1px solid var(--border);overflow-y:auto;display:flex;flex-direction:column;}
// .vault-sidebar-hdr{padding:8px 10px;display:flex;align-items:center;gap:5px;border-bottom:1px solid var(--border);flex-shrink:0;}
// .vault-sidebar-hdr input{flex:1;background:var(--inp-bg);border:1px solid var(--border);color:var(--text);font-family:var(--font);font-size:9px;padding:4px 6px;outline:none;border-radius:1px;}
// .vault-sidebar-hdr input:focus{border-color:var(--border2);}
// .vault-sidebar-hdr button{background:none;border:none;color:var(--accent4);cursor:pointer;font-size:14px;line-height:1;padding:0 2px;flex-shrink:0;}
// .vault-sidebar-hdr button:hover{color:var(--text);}
// .vault-tree{flex:1;overflow-y:auto;padding:4px 0;}
// .vt-folder{user-select:none;}
// .vt-folder-hdr{display:flex;align-items:center;gap:4px;padding:4px 8px;cursor:pointer;transition:background .1s;border-radius:1px;position:relative;}
// .vt-folder-hdr:hover{background:var(--bg2);}
// .vt-folder-hdr.vt-active{background:var(--bg2);color:var(--accent4);}
// .vt-folder-hdr.vt-dragover{outline:1px solid var(--accent4);}
// .vt-arr{font-size:8px;color:var(--icon-dim);transition:transform .15s;flex-shrink:0;width:8px;}
// .vt-arr.open{transform:rotate(90deg);}
// .vt-folder-name{flex:1;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
// .vt-folder-children{display:none;padding-left:12px;}
// .vt-folder-children.open{display:block;}
// .vt-script{display:flex;align-items:center;gap:5px;padding:3px 8px;cursor:pointer;font-size:10px;color:var(--text2);border-radius:1px;transition:background .1s;}
// .vt-script:hover{background:var(--bg2);color:var(--text);}
// .vt-script.vt-active{background:var(--bg2);color:var(--accent2);}
// .vt-script-dot{width:5px;height:5px;border-radius:50%;background:var(--accent2);flex-shrink:0;opacity:.5;}
// .vault-main{display:flex;flex-direction:column;overflow:hidden;}
// .vault-breadcrumb{padding:7px 12px;font-size:9px;color:var(--text3);letter-spacing:.08em;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;gap:4px;flex-wrap:wrap;}
// .vault-breadcrumb span{cursor:pointer;color:var(--text3);}
// .vault-breadcrumb span:hover{color:var(--text);}
// .vault-breadcrumb .bc-sep{cursor:default;opacity:.4;}
// .vault-breadcrumb .bc-cur{color:var(--accent4);cursor:default;}
// .vault-content-area{flex:1;overflow-y:auto;padding:12px;}
// .vault-folder-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:7px;margin-bottom:12px;}
// .vault-fc{background:var(--bg2);border:1px solid var(--border);padding:9px 10px;cursor:pointer;border-radius:var(--radius);transition:all .15s;position:relative;display:flex;flex-direction:column;gap:4px;}
// .vault-fc::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--accent4),transparent);opacity:0;transition:opacity .2s;}
// .vault-fc:hover{border-color:var(--border2);}
// .vault-fc:hover::before,.vault-fc.vf-active::before{opacity:.6;}
// .vault-fc.vf-active{border-color:var(--accent4);}
// .vault-fc.vt-dragover{outline:2px solid var(--accent4);}
// .vault-fc-icon{font-size:16px;line-height:1;}
// .vault-fc-name{font-size:10px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
// .vault-fc-meta{font-size:9px;color:var(--text3);}
// .vault-fc-del{position:absolute;top:4px;right:4px;background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;opacity:0;line-height:1;}
// .vault-fc:hover .vault-fc-del{opacity:.7;}
// .vault-fc-del:hover{opacity:1!important;color:var(--accent3);}
// /* context menu */
// .vt-ctx{position:fixed;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius);padding:4px 0;z-index:9999;min-width:140px;box-shadow:0 4px 16px rgba(0,0,0,.4);}
// .vt-ctx-item{padding:5px 12px;font-size:10px;cursor:pointer;color:var(--text2);transition:background .1s;}
// .vt-ctx-item:hover{background:var(--bg3,var(--bg1));color:var(--text);}
// .vt-ctx-item.danger{color:var(--accent3);}
// /* ---- end vault-nested ---- */

// ============================================================
// STATE
// ============================================================
let activeFolder = null;   // id of currently open folder (null = root)
let activeScript = null;   // id of currently selected script
let _vaultDragType = null; // 'folder' | 'script'
let _vaultDragId   = null;

// ============================================================
// HELPERS
// ============================================================
function vaultFolders(parentId = null) {
  if (!D.folders) D.folders = [];
  return D.folders.filter(f => (f.parentId || null) === (parentId || null));
}
function vaultScripts(folderId) {
  if (!D.scripts) D.scripts = [];
  return D.scripts.filter(s => (s.folder || null) === (folderId || null));
}
function folderPath(id) {
  // Returns array of folders from root → id
  const path = [];
  let cur = id;
  const seen = new Set();
  while (cur) {
    if (seen.has(cur)) break;
    seen.add(cur);
    const f = (D.folders || []).find(x => x.id === cur);
    if (!f) break;
    path.unshift(f);
    cur = f.parentId || null;
  }
  return path;
}
function allDescendantFolderIds(id) {
  // Returns flat array of all nested folder ids under id (not including id itself)
  const result = [];
  function walk(pid) {
    (D.folders || []).filter(f => f.parentId === pid).forEach(f => {
      result.push(f.id);
      walk(f.id);
    });
  }
  walk(id);
  return result;
}
function escHtmlV(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
const _eH = typeof escHtml === 'function' ? escHtml : escHtmlV;

// ============================================================
// CONTEXT MENU
// ============================================================
function closeVaultCtx() {
  document.querySelectorAll('.vt-ctx').forEach(el => el.remove());
}
document.addEventListener('click', closeVaultCtx, true);

function openFolderCtx(e, folderId) {
  e.preventDefault(); e.stopPropagation();
  closeVaultCtx();
  const f = (D.folders || []).find(x => x.id === folderId);
  if (!f) return;
  const menu = document.createElement('div');
  menu.className = 'vt-ctx';
  menu.style.left = e.clientX + 'px';
  menu.style.top  = e.clientY + 'px';
  const items = [
    { label: '📂 Open', action: () => { activeFolder = folderId; activeScript = null; renderVault(); } },
    { label: '✏️ Rename', action: () => renameVaultFolder(folderId) },
    { label: '📁 New subfolder', action: () => createSubFolder(folderId) },
    { label: '📄 New script here', action: () => { activeFolder = folderId; activeScript = null; renderVault(); openNewScriptInFolder(folderId); } },
    { label: '🗑 Delete', action: () => deleteVaultFolder(folderId), cls: 'danger' },
  ];
  items.forEach(it => {
    const d = document.createElement('div');
    d.className = 'vt-ctx-item' + (it.cls ? ' ' + it.cls : '');
    d.textContent = it.label;
    d.onclick = () => { closeVaultCtx(); it.action(); };
    menu.appendChild(d);
  });
  document.body.appendChild(menu);
  // Flip if off screen
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth) menu.style.left = (e.clientX - r.width) + 'px';
  if (r.bottom > window.innerHeight) menu.style.top = (e.clientY - r.height) + 'px';
}

function openScriptCtx(e, scriptId) {
  e.preventDefault(); e.stopPropagation();
  closeVaultCtx();
  const s = (D.scripts || []).find(x => x.id === scriptId);
  if (!s) return;
  const folders = [{ id: null, name: '📁 Root' }, ...(D.folders || []).map(f => ({ id: f.id, name: f.name }))];
  const menu = document.createElement('div');
  menu.className = 'vt-ctx';
  menu.style.left = e.clientX + 'px';
  menu.style.top  = e.clientY + 'px';
  // Move to submenu items
  const moveItem = document.createElement('div');
  moveItem.className = 'vt-ctx-item';
  moveItem.textContent = '📦 Move to…';
  moveItem.onclick = () => { closeVaultCtx(); openMoveScriptModal(scriptId); };
  menu.appendChild(moveItem);
  const delItem = document.createElement('div');
  delItem.className = 'vt-ctx-item danger';
  delItem.textContent = '🗑 Delete';
  delItem.onclick = () => { closeVaultCtx(); deleteScript(scriptId); };
  menu.appendChild(delItem);
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth) menu.style.left = (e.clientX - r.width) + 'px';
  if (r.bottom > window.innerHeight) menu.style.top = (e.clientY - r.height) + 'px';
}

// ============================================================
// FOLDER CRUD
// ============================================================
function createFolder() {
  const inp = document.getElementById('new-folder-inp');
  const name = inp ? inp.value.trim() : '';
  if (!name) return;
  if (!D.folders) D.folders = [];
  D.folders.push({ id: 'f' + Date.now(), name, parentId: activeFolder || null });
  inp.value = '';
  save();
  renderVault();
  if (typeof logActivity === 'function') logActivity('Folder: ' + name, '#f0a04a');
}

function createSubFolder(parentId) {
  openModal('New Subfolder', `
    <label class="modal-label">Folder name</label>
    <input class="modal-inp" id="nsf-name" placeholder="e.g. Utils, Enemies, UI">
  `, [
    { label: 'Cancel', action: closeModal },
    { label: 'Create', action: () => {
      const name = document.getElementById('nsf-name').value.trim();
      if (!name) return;
      if (!D.folders) D.folders = [];
      D.folders.push({ id: 'f' + Date.now(), name, parentId: parentId || null });
      save(); closeModal(); renderVault();
    }}
  ]);
}

function renameVaultFolder(id) {
  const f = (D.folders || []).find(x => x.id === id);
  if (!f) return;
  openModal('Rename Folder', `
    <label class="modal-label">New name</label>
    <input class="modal-inp" id="rvf-name" value="${_eH(f.name)}">
  `, [
    { label: 'Cancel', action: closeModal },
    { label: 'Rename', action: () => {
      const name = document.getElementById('rvf-name').value.trim();
      if (!name) return;
      f.name = name;
      save(); closeModal(); renderVault();
    }}
  ]);
}

function deleteVaultFolder(id) {
  const f = (D.folders || []).find(x => x.id === id);
  if (!f) return;
  const desc = allDescendantFolderIds(id);
  const allIds = [id, ...desc];
  const scriptCount = (D.scripts || []).filter(s => allIds.includes(s.folder)).length;
  const folderCount = desc.length;
  openModal('Delete Folder', `
    <p style="font-size:11px;color:var(--text2);line-height:1.7;">
      Delete <strong style="color:var(--accent3)">${_eH(f.name)}</strong>?<br>
      <span style="color:var(--accent3);">
        This will also delete ${folderCount > 0 ? folderCount + ' subfolder(s) and ' : ''}${scriptCount} script(s).
      </span>
    </p>
  `, [
    { label: 'Cancel', action: closeModal },
    { label: 'Delete', danger: true, action: () => {
      D.scripts = (D.scripts || []).filter(s => !allIds.includes(s.folder));
      D.folders = (D.folders || []).filter(x => !allIds.includes(x.id));
      if (allIds.includes(activeFolder)) { activeFolder = f.parentId || null; activeScript = null; }
      save(); closeModal(); renderVault();
      if (typeof updateGlobal === 'function') updateGlobal();
      if (typeof toast === 'function') toast('Folder deleted');
    }}
  ]);
}

// OLD deleteFolder kept for compatibility (some calls may remain in nav.js)
function deleteFolder(id, e) { if (e) e.stopPropagation(); deleteVaultFolder(id); }

function openMoveScriptModal(scriptId) {
  const s = (D.scripts || []).find(x => x.id === scriptId);
  if (!s) return;
  const opts = [
    '<option value="">📁 Root</option>',
    ...(D.folders || []).map(f => `<option value="${f.id}" ${s.folder === f.id ? 'selected' : ''}>${_eH(f.name)}</option>`)
  ].join('');
  openModal('Move Script', `
    <label class="modal-label">Move "${_eH(s.name)}" to:</label>
    <select class="modal-select" id="ms-dest">${opts}</select>
  `, [
    { label: 'Cancel', action: closeModal },
    { label: 'Move', action: () => {
      s.folder = document.getElementById('ms-dest').value || null;
      save(); closeModal(); renderVault();
      if (typeof toast === 'function') toast('Script moved');
    }}
  ]);
}

// ============================================================
// SCRIPT CRUD (kept compatible with existing code)
// ============================================================
function closeScriptEditor() { activeScript = null; renderVaultMain(); }

function openNewScript() {
  activeScript = null;
  if (!activeFolder && (D.folders || []).length) activeFolder = D.folders[0].id;
  renderVault();
}

function openNewScriptInFolder(folderId) {
  activeFolder = folderId;
  activeScript = null;
  renderVaultMain();
}

function buildNewScriptForm() {
  const w = document.createElement('div');
  w.className = 'editor-area';
  w.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <span style="font-size:9px;color:var(--accent);letter-spacing:.15em;">New Script</span>
      <button class="xbtn" title="Close" onclick="closeScriptEditor()" style="font-size:13px;opacity:.6;">×</button>
    </div>
    <input class="editor-inp" id="ns-name" placeholder="Script name">
    <input class="editor-inp editor-ver" id="ns-ver" placeholder="Version (v1.0)">
    <textarea class="code-area" id="ns-code" placeholder="# GDScript / code here..."></textarea>
    <div class="btn-row">
      <button class="btn accent" onclick="saveNewScript()">Save Script</button>
    </div>`;
  return w;
}

function buildEditor(s) {
  if (!s) return buildNewScriptForm();
  const w = document.createElement('div');
  w.className = 'editor-area';
  w.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <span style="font-size:9px;color:var(--accent2);letter-spacing:.15em;">Editing: ${_eH(s.name)} ${_eH(s.version || '')}</span>
      <button class="xbtn" title="Close editor" onclick="closeScriptEditor()" style="font-size:13px;opacity:.6;">×</button>
    </div>
    <input class="editor-inp" id="es-name" value="${_eH(s.name || '')}">
    <input class="editor-inp editor-ver" id="es-ver" value="${_eH(s.version || '')}">
    <textarea class="code-area" id="es-code">${_eH(s.code || '')}</textarea>
    <div class="btn-row">
      <button class="btn accent" onclick="updateScript('${s.id}')">Save</button>
      <button class="btn" onclick="duplicateScript('${s.id}')">Duplicate as New Version</button>
      <button class="btn" onclick="openMoveScriptModal('${s.id}')">Move to…</button>
      <button class="btn danger" onclick="deleteScript('${s.id}')">Delete</button>
    </div>`;
  return w;
}

function saveNewScript() {
  const name = document.getElementById('ns-name').value.trim();
  const ver  = document.getElementById('ns-ver').value.trim() || 'v1.0';
  const code = document.getElementById('ns-code').value;
  if (!name) return;
  if (!D.scripts) D.scripts = [];
  const s = { id: 's' + Date.now(), folder: activeFolder || null, name, version: ver, code, date: new Date().toLocaleDateString() };
  D.scripts.push(s);
  activeScript = s.id;
  save(); renderVaultMain();
  if (typeof updateGlobal === 'function') updateGlobal();
  if (typeof logActivity === 'function') logActivity('Script: ' + name, '#a04af0');
  if (typeof toast === 'function') toast('Saved');
}

function updateScript(id) {
  const s = (D.scripts || []).find(x => x.id === id);
  if (!s) return;
  s.name    = document.getElementById('es-name').value.trim() || s.name;
  s.version = document.getElementById('es-ver').value.trim()  || s.version;
  s.code    = document.getElementById('es-code').value;
  s.date    = new Date().toLocaleDateString();
  save(); if (typeof toast === 'function') toast('Saved');
}

function duplicateScript(id) {
  const s = (D.scripts || []).find(x => x.id === id);
  if (!s) return;
  const code = document.getElementById('es-code').value;
  const ver  = document.getElementById('es-ver').value.trim();
  const parts = ver.match(/v(\d+)\.(\d+)/);
  let nv = ver;
  if (parts) nv = 'v' + parts[1] + '.' + (parseInt(parts[2]) + 1);
  const ns = { id: 's' + Date.now(), folder: s.folder, name: s.name, version: nv, code, date: new Date().toLocaleDateString() };
  D.scripts.push(ns);
  activeScript = ns.id;
  save(); renderVaultMain();
  if (typeof updateGlobal === 'function') updateGlobal();
  if (typeof toast === 'function') toast('Duplicated as ' + nv);
}

function deleteScript(id, e) {
  if (e) e.stopPropagation();
  D.scripts = (D.scripts || []).filter(s => s.id !== id);
  if (activeScript === id) activeScript = null;
  save(); renderVaultMain();
  if (typeof updateGlobal === 'function') updateGlobal();
}

// ============================================================
// RENDER — SIDEBAR TREE
// ============================================================
function renderVaultSidebar() {
  const el = document.getElementById('vault-sidebar');
  if (!el) return;

  // Header with input + add buttons
  let hdr = el.querySelector('.vault-sidebar-hdr');
  if (!hdr) {
    hdr = document.createElement('div');
    hdr.className = 'vault-sidebar-hdr';
    hdr.innerHTML = `
      <input id="new-folder-inp" placeholder="New folder…" title="Folder name" onkeydown="if(event.key==='Enter')createFolder()">
      <button title="Add folder at current level" onclick="createFolder()">＋</button>`;
    el.appendChild(hdr);
  }

  let tree = el.querySelector('.vault-tree');
  if (!tree) {
    tree = document.createElement('div');
    tree.className = 'vault-tree';
    el.appendChild(tree);
  }
  tree.innerHTML = '';

  // "All scripts" root entry
  const rootItem = document.createElement('div');
  rootItem.className = 'vt-folder-hdr' + (activeFolder === null ? ' vt-active' : '');
  rootItem.style.cssText = 'padding-left:6px;';
  rootItem.innerHTML = `<span style="font-size:11px;margin-right:3px;">📁</span><span class="vt-folder-name">Root</span>`;
  rootItem.onclick = () => { activeFolder = null; activeScript = null; renderVault(); };
  setupFolderDrop(rootItem, null);
  tree.appendChild(rootItem);

  function buildTreeNode(folder, depth) {
    const wrap = document.createElement('div');
    wrap.className = 'vt-folder';

    const hdrRow = document.createElement('div');
    hdrRow.className = 'vt-folder-hdr' + (activeFolder === folder.id ? ' vt-active' : '');
    hdrRow.style.paddingLeft = (6 + depth * 12) + 'px';

    const arr = document.createElement('span');
    arr.className = 'vt-arr' + (folder.collapsed ? '' : ' open');
    arr.innerHTML = '▶';

    const ico = document.createElement('span');
    ico.style.cssText = 'font-size:11px;flex-shrink:0;';
    ico.textContent = '📁';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'vt-folder-name';
    nameSpan.textContent = folder.name;

    hdrRow.appendChild(arr);
    hdrRow.appendChild(ico);
    hdrRow.appendChild(nameSpan);
    wrap.appendChild(hdrRow);

    const children = document.createElement('div');
    children.className = 'vt-folder-children' + (folder.collapsed ? '' : ' open');
    wrap.appendChild(children);

    hdrRow.onclick = (e) => {
      if (e.target.closest('.vt-ctx')) return;
      activeFolder = folder.id; activeScript = null;
      folder.collapsed = false;
      arr.classList.add('open');
      children.classList.add('open');
      save(); renderVault();
    };

    // Toggle arrow separately
    arr.onclick = (e) => {
      e.stopPropagation();
      folder.collapsed = !folder.collapsed;
      arr.classList.toggle('open', !folder.collapsed);
      children.classList.toggle('open', !folder.collapsed);
      save();
    };

    hdrRow.oncontextmenu = (e) => openFolderCtx(e, folder.id);

    // Drag source
    hdrRow.draggable = true;
    hdrRow.ondragstart = (e) => {
      _vaultDragType = 'folder'; _vaultDragId = folder.id;
      e.dataTransfer.effectAllowed = 'move';
    };

    // Drop target
    setupFolderDrop(hdrRow, folder.id);

    // Recursively build sub-folders
    vaultFolders(folder.id).forEach(sub => children.appendChild(buildTreeNode(sub, depth + 1)));

    // Scripts inside this folder (mini list in sidebar)
    vaultScripts(folder.id).forEach(sc => {
      const si = document.createElement('div');
      si.className = 'vt-script' + (activeScript === sc.id ? ' vt-active' : '');
      si.style.paddingLeft = (14 + (depth + 1) * 12) + 'px';
      si.innerHTML = `<span class="vt-script-dot"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_eH(sc.name)}</span>`;
      si.onclick = (e) => { e.stopPropagation(); activeFolder = folder.id; activeScript = sc.id; renderVault(); };
      si.oncontextmenu = (e) => openScriptCtx(e, sc.id);
      si.draggable = true;
      si.ondragstart = ev => { _vaultDragType = 'script'; _vaultDragId = sc.id; ev.dataTransfer.effectAllowed = 'move'; };
      children.appendChild(si);
    });

    return wrap;
  }

  vaultFolders(null).forEach(f => tree.appendChild(buildTreeNode(f, 0)));

  // Root-level scripts (no folder)
  vaultScripts(null).forEach(sc => {
    const si = document.createElement('div');
    si.className = 'vt-script' + (activeScript === sc.id ? ' vt-active' : '');
    si.style.paddingLeft = '18px';
    si.innerHTML = `<span class="vt-script-dot" style="background:var(--accent4);"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_eH(sc.name)}</span>`;
    si.onclick = () => { activeFolder = null; activeScript = sc.id; renderVault(); };
    si.oncontextmenu = (e) => openScriptCtx(e, sc.id);
    si.draggable = true;
    si.ondragstart = ev => { _vaultDragType = 'script'; _vaultDragId = sc.id; ev.dataTransfer.effectAllowed = 'move'; };
    tree.appendChild(si);
  });
}

function setupFolderDrop(el, targetFolderId) {
  el.ondragover = (e) => {
    e.preventDefault();
    el.classList.add('vt-dragover');
  };
  el.ondragleave = () => el.classList.remove('vt-dragover');
  el.ondrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    el.classList.remove('vt-dragover');
    if (!_vaultDragId) return;
    if (_vaultDragType === 'folder') {
      if (_vaultDragId === targetFolderId) return;
      // Prevent dropping a folder into its own descendant
      const desc = allDescendantFolderIds(_vaultDragId);
      if (desc.includes(targetFolderId)) { if (typeof toast === 'function') toast('Cannot nest a folder inside itself'); return; }
      const f = (D.folders || []).find(x => x.id === _vaultDragId);
      if (f) { f.parentId = targetFolderId; save(); renderVault(); }
    } else if (_vaultDragType === 'script') {
      const s = (D.scripts || []).find(x => x.id === _vaultDragId);
      if (s) { s.folder = targetFolderId; save(); renderVault(); }
    }
    _vaultDragType = null; _vaultDragId = null;
  };
}

// ============================================================
// RENDER — MAIN CONTENT AREA
// ============================================================
function renderVaultMain() {
  const el = document.getElementById('vault-main');
  if (!el) return;
  el.innerHTML = '';

  // Breadcrumb
  const bc = document.createElement('div');
  bc.className = 'vault-breadcrumb';
  const rootSpan = document.createElement('span');
  rootSpan.textContent = 'Root';
  rootSpan.className = activeFolder ? '' : 'bc-cur';
  rootSpan.onclick = () => { if (activeFolder) { activeFolder = null; activeScript = null; renderVault(); } };
  bc.appendChild(rootSpan);

  if (activeFolder) {
    const path = folderPath(activeFolder);
    path.forEach((f, i) => {
      const sep = document.createElement('span'); sep.className = 'bc-sep'; sep.textContent = ' › ';
      bc.appendChild(sep);
      const s = document.createElement('span');
      s.textContent = f.name;
      s.className = (i === path.length - 1) ? 'bc-cur' : '';
      if (i < path.length - 1) {
        s.onclick = () => { activeFolder = f.id; activeScript = null; renderVault(); };
      }
      bc.appendChild(s);
    });
  }
  el.appendChild(bc);

  // Scrollable content
  const area = document.createElement('div');
  area.className = 'vault-content-area';
  el.appendChild(area);

  // Sub-folders grid
  const subFolders = vaultFolders(activeFolder);
  if (subFolders.length) {
    const grid = document.createElement('div');
    grid.className = 'vault-folder-grid';
    subFolders.forEach(f => {
      const scriptCount = vaultScripts(f.id).length;
      const subCount    = vaultFolders(f.id).length;
      const card = document.createElement('div');
      card.className = 'vault-fc';
      card.innerHTML = `
        <div class="vault-fc-icon">📁</div>
        <div class="vault-fc-name">${_eH(f.name)}</div>
        <div class="vault-fc-meta">${subCount ? subCount + ' folder' + (subCount !== 1 ? 's' : '') + ', ' : ''}${scriptCount} script${scriptCount !== 1 ? 's' : ''}</div>
        <button class="vault-fc-del xbtn" title="Delete" onclick="event.stopPropagation();deleteVaultFolder('${f.id}')">×</button>`;
      card.onclick = () => { activeFolder = f.id; activeScript = null; renderVault(); };
      card.oncontextmenu = (e) => openFolderCtx(e, f.id);
      card.draggable = true;
      card.ondragstart = (e) => { _vaultDragType = 'folder'; _vaultDragId = f.id; e.dataTransfer.effectAllowed = 'move'; };
      setupFolderDrop(card, f.id);
      grid.appendChild(card);
    });
    // "New subfolder" quick-add card
    const addCard = document.createElement('div');
    addCard.className = 'vault-fc';
    addCard.style.cssText = 'border-style:dashed;opacity:.5;justify-content:center;align-items:center;min-height:70px;';
    addCard.innerHTML = `<div style="font-size:18px;">＋</div><div style="font-size:9px;color:var(--text3);">New subfolder</div>`;
    addCard.onclick = () => createSubFolder(activeFolder);
    grid.appendChild(addCard);
    area.appendChild(grid);
  }

  // Scripts list
  const scripts = vaultScripts(activeFolder);
  const list = document.createElement('div');
  list.className = 'script-list';
  if (!scripts.length && !subFolders.length) {
    list.innerHTML = '<div style="font-size:11px;color:var(--text3);margin-bottom:10px;">Empty folder — add a script or subfolder</div>';
  }
  scripts.forEach(s => {
    const item = document.createElement('div');
    item.className = 'script-item' + (activeScript === s.id ? ' active-script' : '');
    item.innerHTML = `
      <span class="script-ver">${_eH(s.version || 'v?')}</span>
      <span class="script-name">${_eH(s.name)}</span>
      <span class="script-date">${s.date || ''}</span>
      <button class="xbtn" onclick="deleteScript('${s.id}',event)">×</button>`;
    item.addEventListener('click', () => { activeScript = s.id; renderVaultMain(); });
    item.oncontextmenu = (e) => openScriptCtx(e, s.id);
    item.draggable = true;
    item.ondragstart = (ev) => { _vaultDragType = 'script'; _vaultDragId = s.id; ev.dataTransfer.effectAllowed = 'move'; };
    list.appendChild(item);
  });
  area.appendChild(list);

  // Editor
  const editor = activeScript
    ? buildEditor((D.scripts || []).find(x => x.id === activeScript))
    : buildNewScriptForm();
  area.appendChild(editor);
}

// ============================================================
// MASTER RENDER
// ============================================================
function renderVault() {
  renderVaultSidebar();
  renderVaultMain();
}

// Legacy aliases so nav.js init calls still work
function renderFolders() { renderVaultSidebar(); }
function renderScripts() { renderVaultMain(); }
