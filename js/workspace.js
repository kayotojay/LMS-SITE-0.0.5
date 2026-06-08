// LMS Dev Hub — workspace.js v6
// ============================================================
// UNIFIED WORKSPACE FILESYSTEM
//
// One tree. D.wsFolders for folders. Each folder holds "items":
//   { type: 'scene'|'script'|'asset', refId?, ... }
//
// Scenes and scripts are REFERENCES to D.scenes / D.scripts.
// Assets are pure workspace pseudo-files (no external data).
// Drag anything anywhere. One tree, like Godot FileSystem.
//
// D.wsFolders  = [{id, name, parentId}]
// D.wsItems    = [{id, folderId, type, refId?, name, assetType?, notes?, size?}]
//   type 'scene'  → refId = D.scenes[x].id
//   type 'script' → refId = D.scripts[x].id
//   type 'asset'  → refId null, name+assetType stored directly
// ============================================================

// ── State ────────────────────────────────────────────────────
const ws2 = {
  openSceneId: null,
  selNodeId:   null,
  sel:         null,   // {type:'folder'|'item', id}
  drag:        null,
  expanded:    new Set(),
  q:           '',
};

// ── Data / Workspace Versions ────────────────────────────────
// D.wsVersions = [{id, name, created, folders:[], items:[]}]
// D.wsActiveVersion = id of active workspace version
const ws2save = () => { if(typeof save==='function') save(); };

function wsd() {
  if(!D.wsVersions || !D.wsVersions.length) {
    if(!D.wsVersions) D.wsVersions=[];
    D.wsVersions.push({id:'wsv_default',name:'v1.0',created:new Date().toLocaleDateString(),folders:[],items:[]});
  }
  if(!D.wsActiveVersion) D.wsActiveVersion=D.wsVersions[0].id;
  // Migrate old flat data into default version if present
  let active=D.wsVersions.find(v=>v.id===D.wsActiveVersion)||D.wsVersions[0];
  if(D.wsFolders && D.wsFolders.length && !active.folders.length){active.folders=D.wsFolders;D.wsFolders=[];}
  if(D.wsItems   && D.wsItems.length   && !active.items.length)  {active.items=D.wsItems;  D.wsItems=[];}
  return active;
}
function wsGetAllVersions(){ if(!D.wsVersions)D.wsVersions=[];return D.wsVersions; }

function wsFolders(pid) { const d=wsd(); return d.folders.filter(f=>(f.parentId||null)===(pid||null)); }
function wsItems(fid)   { const d=wsd(); return d.items.filter(i=>(i.folderId||null)===(fid||null)); }
function wsFolderDescIds(id) {
  const r=[];(function w(p){wsFolders(p).forEach(f=>{r.push(f.id);w(f.id);});})(id);return r;
}
// Resolve display name and icon for any item
function wsItemMeta(item) {
  if(item.type==='scene'){
    const sc=(D.scenes||[]).find(s=>s.id===item.refId);
    if(!sc) return {name:'[missing] '+item.name, icon:'❌', ext:'.tscn', missing:true};
    const rn=sc.nodes?.[sc.rootId];
    const t=rn?.type||'Node2D';
    const icon=t.includes('3D')?'🟢':(t==='Control'||t.includes('Container')||t==='Panel')?'🟦':'🎬';
    return {name:sc.name, icon, ext:'.tscn', scene:sc};
  }
  if(item.type==='script'){
    const sp=(D.scripts||[]).find(s=>s.id===item.refId);
    if(!sp) return {name:'[missing] '+item.name, icon:'❌', ext:'.gd', missing:true};
    return {name:sp.name, icon:'📄', ext:'.gd', ver:sp.version||'', script:sp};
  }
  // asset
  const def=ASSET_TYPES.find(a=>a.type===item.assetType)||{icon:'📎',ext:''};
  return {name:item.name, icon:def.icon, ext:def.ext, ver:item.size||''};
}

const ASSET_TYPES = [
  {type:'image',   icon:'🖼',  ext:'.png',  label:'Image'},
  {type:'audio',   icon:'🔊', ext:'.wav',  label:'Audio'},
  {type:'font',    icon:'🔤', ext:'.ttf',  label:'Font'},
  {type:'shader',  icon:'✨', ext:'.glsl', label:'Shader'},
  {type:'tileset', icon:'🗺', ext:'.tres', label:'Tileset'},
  {type:'anim',    icon:'🎞', ext:'.anim', label:'Animation'},
  {type:'data',    icon:'📦', ext:'.json', label:'Data File'},
  {type:'doc',     icon:'📝', ext:'.md',   label:'Document'},
  {type:'prefab',  icon:'🧩', ext:'.scn',  label:'Prefab'},
  {type:'material',icon:'🎨', ext:'.mat',  label:'Material'},
];

// ── Context menu ─────────────────────────────────────────────
const ws2closeCtx = () => document.querySelectorAll('.ws2-ctx').forEach(e=>e.remove());
document.addEventListener('click', ws2closeCtx, true);
function ws2ctx(e, items) {
  e.preventDefault(); e.stopPropagation();
  ws2closeCtx();
  const m=document.createElement('div'); m.className='ws2-ctx';
  m.style.cssText=`left:${e.clientX}px;top:${e.clientY}px;`;
  items.forEach(it=>{
    if(it==='---'){const s=document.createElement('div');s.className='ws2-ctx-sep';m.appendChild(s);return;}
    const d=document.createElement('div');
    d.className='ws2-ctx-item'+(it.danger?' danger':'');
    d.innerHTML=`<span class="ws2-ctx-ico">${it.icon||''}</span>${wsE(it.label)}`;
    d.onclick=()=>{ws2closeCtx();it.fn();};
    m.appendChild(d);
  });
  document.body.appendChild(m);
  requestAnimationFrame(()=>{
    const r=m.getBoundingClientRect();
    if(r.right>window.innerWidth) m.style.left=(e.clientX-r.width)+'px';
    if(r.bottom>window.innerHeight) m.style.top=(e.clientY-r.height)+'px';
  });
}
const wsE = s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Drag & drop ──────────────────────────────────────────────
function ws2drag(e, type, id) {
  ws2.drag={type,id};
  e.dataTransfer.effectAllowed='move';
}
function ws2drop(el, fn) {
  el.addEventListener('dragover',e=>{ if(!ws2.drag)return; e.preventDefault(); e.stopPropagation(); el.classList.add('ws2-dv'); });
  el.addEventListener('dragleave',()=>el.classList.remove('ws2-dv'));
  el.addEventListener('drop',e=>{ e.preventDefault(); e.stopPropagation(); el.classList.remove('ws2-dv'); const d=ws2.drag; ws2.drag=null; if(d)fn(d); });
}

// ── Helpers ───────────────────────────────────────────────────
function ws2rename(label, obj, field, cb) {
  openModal('Rename '+label,`<input class="modal-inp" id="ws2ri" value="${wsE(obj[field]||'')}">`, [
    {label:'Cancel',action:closeModal},
    {label:'Rename',action:()=>{ const v=document.getElementById('ws2ri').value.trim(); if(!v)return; obj[field]=v; ws2save(); closeModal(); cb?cb():renderWorkspace(); }}
  ]);
  setTimeout(()=>{const i=document.getElementById('ws2ri');if(i)i.select();},80);
}
function ws2del(label, fn) {
  openModal('Delete',`<p style="font-size:11px;color:var(--text2);">Delete <strong style="color:var(--accent3);">${wsE(label)}</strong>?</p>`,[
    {label:'Cancel',action:closeModal},
    {label:'Delete',danger:true,action:()=>{closeModal();fn();}}
  ]);
}

// ── TOOLBAR ──────────────────────────────────────────────────
function renderWs2Toolbar() {
  const el=document.getElementById('ws2-fs-toolbar'); if(!el) return;
  const versions=wsGetAllVersions();
  const active=wsd();
  const verTabs=versions.map(v=>`<button class="ws2-ver-tab${v.id===active.id?' active':''}" onclick="wsSetVersion('${v.id}')" title="${wsE(v.name)}">${wsE(v.name)}</button>`).join('');
  el.innerHTML=`
    <div class="ws2-ver-bar">
      <div class="ws2-ver-tabs" id="ws2-ver-tabs">${verTabs}</div>
      <button class="ws2-tb-btn" title="New workspace version" onclick="wsNewVersion()" style="flex-shrink:0;">+</button>
      <button class="ws2-tb-btn" title="Manage versions" onclick="wsManageVersions()" style="flex-shrink:0;">⋯</button>
    </div>
    <div class="ws2-toolbar-row">
      <input class="ws2-search" placeholder="filter…" value="${wsE(ws2.q)}" oninput="ws2.q=this.value;renderWs2FileTree();">
      <button class="ws2-tb-btn" title="Expand all"   onclick="ws2expandAll()">⊞</button>
      <button class="ws2-tb-btn" title="Collapse all" onclick="ws2collapseAll()">⊟</button>
    </div>
    <div class="ws2-toolbar-row" style="padding-top:0;gap:3px;">
      <button class="ws2-tb-btn ws2-add-btn" onclick="wsAddSceneRef(null)">+ Scene</button>
      <button class="ws2-tb-btn ws2-add-btn" onclick="wsAddScriptRef(null)">+ Script</button>
      <button class="ws2-tb-btn ws2-add-btn" onclick="wsAddAsset(null)">+ Asset</button>
      <button class="ws2-tb-btn ws2-add-btn" onclick="wsAddFolder(null)">📁+</button>
    </div>`;
}

function wsSetVersion(id){
  D.wsActiveVersion=id;
  ws2.openSceneId=null; ws2.selNodeId=null; ws2.sel=null; ws2.expanded=new Set(); ws2.q='';
  ws2save(); renderWorkspace();
}

function wsNewVersion(){
  openModal('New Workspace Version',`
    <label class="modal-label">Version Name</label>
    <input class="modal-inp" id="wsnv-name" placeholder="e.g. v2.0, Alpha, Prototype B">
    <label class="modal-label">Start from</label>
    <select class="modal-select" id="wsnv-from">
      <option value="">Empty workspace</option>
      ${wsGetAllVersions().map(v=>`<option value="${v.id}">Copy of: ${wsE(v.name)}</option>`).join('')}
    </select>
  `,[
    {label:'Cancel',action:closeModal},
    {label:'Create',action:()=>{
      const name=document.getElementById('wsnv-name').value.trim();if(!name)return;
      const fromId=document.getElementById('wsnv-from').value;
      const fromVer=fromId?wsGetAllVersions().find(v=>v.id===fromId):null;
      const newVer={
        id:'wsv_'+Date.now(),
        name,
        created:new Date().toLocaleDateString(),
        folders: fromVer ? JSON.parse(JSON.stringify(fromVer.folders)) : [],
        items:   fromVer ? JSON.parse(JSON.stringify(fromVer.items))   : [],
      };
      // Give new IDs to avoid conflicts if copied
      if(fromVer){
        const idMap={};
        newVer.folders.forEach(f=>{const newId='wsf_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);idMap[f.id]=newId;f.id=newId;});
        newVer.folders.forEach(f=>{if(f.parentId)f.parentId=idMap[f.parentId]||f.parentId;});
        newVer.items.forEach(i=>{const newId='wsi_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);i.id=newId;if(i.folderId)i.folderId=idMap[i.folderId]||i.folderId;});
      }
      wsGetAllVersions().push(newVer);
      D.wsActiveVersion=newVer.id;
      ws2.openSceneId=null;ws2.selNodeId=null;ws2.sel=null;ws2.expanded=new Set();
      ws2save();closeModal();renderWorkspace();
      if(typeof toast==='function')toast('Workspace: '+name);
    }}
  ]);
}

function wsManageVersions(){
  const versions=wsGetAllVersions();
  const rows=versions.map(v=>`
    <div class="ws2-ver-manage-row" id="wvmr-${v.id}">
      <span style="flex:1;font-size:10px;">${wsE(v.name)}</span>
      <span style="font-size:9px;color:var(--text3);margin-right:8px;">${wsE(v.created||'')}</span>
      <button class="ws2-tb-btn" onclick="wsRenameVersion('${v.id}')">✏️</button>
      ${versions.length>1?`<button class="ws2-tb-btn" style="color:var(--accent3);" onclick="wsDeleteVersion('${v.id}')">🗑</button>`:''}
    </div>`).join('');
  openModal('Workspace Versions',`<div class="ws2-ver-manage-list">${rows}</div>`,[
    {label:'Close',action:closeModal}
  ]);
}

function wsRenameVersion(id){
  const v=wsGetAllVersions().find(x=>x.id===id);if(!v)return;
  openModal('Rename Version',`<input class="modal-inp" id="wsvren" value="${wsE(v.name)}">`,[
    {label:'Cancel',action:closeModal},
    {label:'Rename',action:()=>{v.name=document.getElementById('wsvren').value.trim()||v.name;ws2save();closeModal();renderWorkspace();}}
  ]);
}

function wsDeleteVersion(id){
  if(wsGetAllVersions().length<=1){if(typeof toast==='function')toast('Cannot delete the only version');return;}
  openModal('Delete Version',`<p style="font-size:11px;color:var(--text2);">Delete this workspace version? Items in other sections are unaffected.</p>`,[
    {label:'Cancel',action:closeModal},
    {label:'Delete',danger:true,action:()=>{
      D.wsVersions=D.wsVersions.filter(v=>v.id!==id);
      if(D.wsActiveVersion===id) D.wsActiveVersion=D.wsVersions[0].id;
      ws2save();closeModal();renderWorkspace();
    }}
  ]);
}
function ws2expandAll() { D.wsFolders.forEach(f=>ws2.expanded.add(f.id)); renderWs2FileTree(); }
function ws2collapseAll() { ws2.expanded.clear(); renderWs2FileTree(); }

// ── ADD MODALS ───────────────────────────────────────────────
function wsAddFolder(parentId) {
  openModal('New Folder',`<input class="modal-inp" id="ws2nf" placeholder="e.g. Characters, UI, SFX">`,[
    {label:'Cancel',action:closeModal},
    {label:'Create',action:()=>{
      const name=document.getElementById('ws2nf').value.trim(); if(!name) return;
      wsd().wsFolders.push({id:'wsf_'+Date.now(),name,parentId:parentId||null});
      if(parentId) ws2.expanded.add(parentId);
      ws2save(); closeModal(); renderWs2FileTree();
    }}
  ]);
}

function wsAddSceneRef(folderId) {
  const existing=wsd().items.filter(i=>i.type==='scene').map(i=>i.refId);
  const available=(D.scenes||[]).filter(s=>!existing.includes(s.id));
  if(!available.length){
    openModal('Add Scene','<p style="font-size:11px;color:var(--text3);">All scenes are already in the workspace,<br>or no scenes exist yet. Create them in Scene Tree.</p>',[{label:'OK',action:closeModal}]);
    return;
  }
  const opts=available.map(s=>`<div class="ws2-pick-row" data-id="${s.id}"><span>🎬</span><span>${wsE(s.name)}</span><span class="ws2-row-ext">.tscn</span></div>`).join('');
  openModal('Add Scene to Workspace',`
    <div class="ws2-pick-hint">Click scenes to select, click again to deselect</div>
    <div class="ws2-pick-list" id="ws2-pick-list">${opts}</div>
  `,[
    {label:'Cancel',action:closeModal},
    {label:'Add Selected',action:()=>{
      const selected=[...document.querySelectorAll('#ws2-pick-list .ws2-pick-row.ws2-pick-sel')];
      if(!selected.length) return;
      selected.forEach(row=>{
        wsd().wsItems.push({id:'wsi_'+Date.now()+'_'+Math.random().toString(36).slice(2,5), type:'scene', refId:row.dataset.id, folderId:folderId||null});
      });
      ws2save(); closeModal(); renderWs2FileTree();
    }}
  ]);
  // Toggle selection on click
  setTimeout(()=>{
    document.querySelectorAll('#ws2-pick-list .ws2-pick-row').forEach(row=>{
      row.onclick=()=>row.classList.toggle('ws2-pick-sel');
    });
  },50);
}

function wsAddScriptRef(folderId) {
  const existing=wsd().items.filter(i=>i.type==='script').map(i=>i.refId);
  const available=(D.scripts||[]).filter(s=>!existing.includes(s.id));
  if(!available.length){
    openModal('Add Script','<p style="font-size:11px;color:var(--text3);">All scripts are already in the workspace,<br>or no scripts exist yet. Create them in Script Vault.</p>',[{label:'OK',action:closeModal}]);
    return;
  }
  const opts=available.map(s=>`<div class="ws2-pick-row" data-id="${s.id}"><span>📄</span><span>${wsE(s.name)}</span><span class="ws2-row-ext">.gd</span><span class="ws2-row-ver">${wsE(s.version||'')}</span></div>`).join('');
  openModal('Add Script to Workspace',`
    <div class="ws2-pick-hint">Click scripts to select</div>
    <div class="ws2-pick-list" id="ws2-pick-list">${opts}</div>
  `,[
    {label:'Cancel',action:closeModal},
    {label:'Add Selected',action:()=>{
      const selected=[...document.querySelectorAll('#ws2-pick-list .ws2-pick-row.ws2-pick-sel')];
      if(!selected.length) return;
      selected.forEach(row=>{
        wsd().wsItems.push({id:'wsi_'+Date.now()+'_'+Math.random().toString(36).slice(2,5), type:'script', refId:row.dataset.id, folderId:folderId||null});
      });
      ws2save(); closeModal(); renderWs2FileTree();
    }}
  ]);
  setTimeout(()=>{
    document.querySelectorAll('#ws2-pick-list .ws2-pick-row').forEach(row=>{
      row.onclick=()=>row.classList.toggle('ws2-pick-sel');
    });
  },50);
}

function wsAddAsset(folderId) {
  const typeOpts=ASSET_TYPES.map(t=>`<option value="${t.type}">${t.icon} ${t.label}${t.ext}</option>`).join('');
  openModal('Add Asset',`
    <label class="modal-label">Type</label>
    <select class="modal-select" id="ws2at">${typeOpts}</select>
    <label class="modal-label">Name</label>
    <input class="modal-inp" id="ws2an" placeholder="e.g. player_sprite, jump_sfx, ui_font">
    <label class="modal-label">Notes / path (optional)</label>
    <input class="modal-inp" id="ws2ano" placeholder="res://assets/…">
  `,[
    {label:'Cancel',action:closeModal},
    {label:'Add',action:()=>{
      const assetType=document.getElementById('ws2at').value;
      const name=document.getElementById('ws2an').value.trim(); if(!name) return;
      const notes=document.getElementById('ws2ano').value.trim();
      wsd().wsItems.push({id:'wsi_'+Date.now(),type:'asset',assetType,name,notes,folderId:folderId||null,created:new Date().toLocaleDateString()});
      if(folderId) ws2.expanded.add(folderId);
      ws2save(); closeModal(); renderWs2FileTree();
    }}
  ]);
}

// ── FILE TREE ─────────────────────────────────────────────────
function renderWs2FileTree() {
  const el=document.getElementById('ws2-fs-tree'); if(!el) return;
  el.innerHTML='';

  const q=ws2.q.toLowerCase();
  const selId=ws2.sel?.id;

  function folderHasMatch(fid) {
    if(!q) return true;
    const f=D.wsFolders.find(x=>x.id===fid);
    if(f?.name.toLowerCase().includes(q)) return true;
    if(wsFolders(fid).some(sf=>folderHasMatch(sf.id))) return true;
    if(wsItems(fid).some(item=>{ const m=wsItemMeta(item); return m.name.toLowerCase().includes(q); })) return true;
    return false;
  }

  function buildFolder(folder, depth) {
    if(!folderHasMatch(folder.id)) return null;
    const isOpen=ws2.expanded.has(folder.id)||!!q;
    const subs=wsFolders(folder.id), items=wsItems(folder.id);
    const count=subs.length+items.length;
    const wrap=document.createElement('div');

    const row=document.createElement('div');
    row.className='ws2-row ws2-folder-row'+(selId===folder.id?' ws2-sel':'');
    row.style.paddingLeft=(8+depth*14)+'px';
    row.innerHTML=`
      <span class="ws2-arrow${isOpen?' open':''}">▶</span>
      <span class="ws2-row-icon">${isOpen?'📂':'📁'}</span>
      <span class="ws2-row-label">${wsE(folder.name)}</span>
      ${count?`<span class="ws2-badge">${count}</span>`:''}`;

    row.onclick=()=>{
      isOpen ? ws2.expanded.delete(folder.id) : ws2.expanded.add(folder.id);
      ws2.sel={type:'folder',id:folder.id};
      renderWs2FileTree(); renderWs2Inspector();
    };
    row.oncontextmenu=e=>ws2ctx(e,[
      {icon:'📁', label:'New Subfolder',  fn:()=>wsAddFolder(folder.id)},
      {icon:'🎬', label:'Add Scene here', fn:()=>wsAddSceneRef(folder.id)},
      {icon:'📄', label:'Add Script here',fn:()=>wsAddScriptRef(folder.id)},
      {icon:'🖼', label:'Add Asset here', fn:()=>wsAddAsset(folder.id)},
      '---',
      {icon:'✏️', label:'Rename',         fn:()=>ws2rename('Folder',folder,'name')},
      '---',
      {icon:'🗑', label:'Delete folder',  danger:true, fn:()=>ws2del(folder.name,()=>{
        const all=[folder.id,...wsFolderDescIds(folder.id)];
        wsd().items=wsd().items.filter(i=>!all.includes(i.folderId));
        wsd().folders=wsd().folders.filter(f=>!all.includes(f.id));
        ws2save(); renderWorkspace();
      })},
    ]);
    row.draggable=true;
    row.ondragstart=e=>ws2drag(e,'folder',folder.id);
    ws2drop(row, drag=>{
      if(drag.type==='folder'){
        if(drag.id===folder.id||wsFolderDescIds(drag.id).includes(folder.id)) return;
        const f=wsd().folders.find(x=>x.id===drag.id);
        if(f){f.parentId=folder.id;ws2save();renderWs2FileTree();}
      } else if(drag.type==='item'){
        const i=wsd().items.find(x=>x.id===drag.id);
        if(i){i.folderId=folder.id;ws2save();renderWs2FileTree();}
      }
    });
    wrap.appendChild(row);

    if(isOpen){
      const ch=document.createElement('div'); ch.className='ws2-ch';
      subs.forEach(sf=>{const n=buildFolder(sf,depth+1);if(n)ch.appendChild(n);});
      items.forEach(item=>{
        const m=wsItemMeta(item);
        if(q&&!m.name.toLowerCase().includes(q)) return;
        ch.appendChild(buildItem(item,m,depth+1));
      });
      wrap.appendChild(ch);
    }
    return wrap;
  }

  function buildItem(item, meta, depth) {
    const isActive=(item.type==='scene'&&ws2.openSceneId===item.refId);
    const row=document.createElement('div');
    row.className='ws2-row ws2-item-row'+(selId===item.id?' ws2-sel':'')+(isActive?' ws2-open':'');
    row.style.paddingLeft=(8+depth*14)+'px';
    row.innerHTML=`
      <span class="ws2-row-spc"></span>
      <span class="ws2-row-icon${meta.missing?' ws2-missing':''}">${meta.icon}</span>
      <span class="ws2-row-label">${wsE(meta.name)}</span>
      <span class="ws2-row-ext">${meta.ext}</span>
      ${meta.ver?`<span class="ws2-row-ver">${wsE(meta.ver)}</span>`:''}`;

    row.onclick=()=>{ ws2.sel={type:'item',id:item.id}; renderWs2FileTree(); renderWs2Inspector(); };

    if(item.type==='scene'&&!meta.missing){
      row.ondblclick=()=>ws2openScene(item.refId);
    } else if(item.type==='script'&&!meta.missing){
      row.ondblclick=()=>{
        if(typeof nav==='function')nav('vault');
        setTimeout(()=>{ activeFolder=meta.script.folder||null; activeScript=item.refId; if(typeof renderVault==='function')renderVault(); },120);
      };
    }

    // Context menu
    const ctxItems=[];
    if(item.type==='scene'&&!meta.missing){
      ctxItems.push({icon:'📂',label:'Open here',fn:()=>ws2openScene(item.refId)});
      ctxItems.push({icon:'⬡', label:'Canvas Mode',fn:()=>{ws2.openSceneId=item.refId;if(typeof openSceneCanvas==='function')openSceneCanvas(item.refId);}});
      ctxItems.push({icon:'↗️',label:'Scene Tree', fn:()=>{if(typeof setActiveScene==='function')setActiveScene(item.refId);if(typeof nav==='function')nav('scene-tree');}});
      ctxItems.push('---');
    } else if(item.type==='script'&&!meta.missing){
      ctxItems.push({icon:'✏️',label:'Edit in Vault',fn:()=>{
        if(typeof nav==='function')nav('vault');
        setTimeout(()=>{ activeFolder=meta.script.folder||null; activeScript=item.refId; if(typeof renderVault==='function')renderVault(); },120);
      }});
      ctxItems.push('---');
    } else if(item.type==='asset'){
      ctxItems.push({icon:'✏️',label:'Edit notes',fn:()=>wsEditAssetNotes(item)});
      ctxItems.push('---');
    }
    ctxItems.push({icon:'🗑',label:'Remove from workspace',danger:true,fn:()=>{
      wsd().items=wsd().items.filter(i=>i.id!==item.id);
      if(item.type==='scene'&&ws2.openSceneId===item.refId){ws2.openSceneId=null;ws2.selNodeId=null;}
      ws2save(); renderWorkspace();
    }});

    row.oncontextmenu=e=>ws2ctx(e,ctxItems);
    row.draggable=true;
    row.ondragstart=e=>ws2drag(e,'item',item.id);
    return row;
  }

  // Root drop zone
  ws2drop(el, drag=>{
    if(drag.type==='folder'){const f=wsd().folders.find(x=>x.id===drag.id);if(f){f.parentId=null;ws2save();renderWs2FileTree();}}
    else if(drag.type==='item'){const i=wsd().items.find(x=>x.id===drag.id);if(i){i.folderId=null;ws2save();renderWs2FileTree();}}
  });

  // Build tree
  wsFolders(null).forEach(f=>{const n=buildFolder(f,0);if(n)el.appendChild(n);});
  wsItems(null).forEach(item=>{
    const m=wsItemMeta(item);
    if(!q||m.name.toLowerCase().includes(q)) el.appendChild(buildItem(item,m,0));
  });

  if(!D.wsFolders.length&&!D.wsItems.length){
    el.innerHTML=`<div class="ws2-empty">
      Empty workspace.<br>
      <span>Use <strong>+ Scene</strong>, <strong>+ Script</strong>, <strong>+ Asset</strong><br>or <strong>📁+</strong> to get started.</span>
    </div>`;
  }
}

function wsEditAssetNotes(item) {
  openModal('Edit Notes',`
    <label class="modal-label">Name</label>
    <input class="modal-inp" id="ws2en" value="${wsE(item.name)}">
    <label class="modal-label">Notes / path</label>
    <textarea class="modal-inp" id="ws2eno" style="min-height:70px;">${wsE(item.notes||'')}</textarea>
  `,[
    {label:'Cancel',action:closeModal},
    {label:'Save',action:()=>{
      item.name=document.getElementById('ws2en').value.trim()||item.name;
      item.notes=document.getElementById('ws2eno').value;
      ws2save(); closeModal(); renderWs2FileTree(); renderWs2Inspector();
    }}
  ]);
}

// ── SCENE OPEN ────────────────────────────────────────────────
function ws2openScene(sceneId) {
  ws2.openSceneId=sceneId;
  ws2.selNodeId=null;
  // Select the workspace item for this scene
  const wsItem=D.wsItems.find(i=>i.type==='scene'&&i.refId===sceneId);
  if(wsItem){ ws2.sel={type:'item',id:wsItem.id}; if(wsItem.folderId) ws2.expanded.add(wsItem.folderId); }
  renderWorkspace();
}

function renderWs2SceneHdr() {
  const el=document.getElementById('ws2-scene-hdr'); if(!el) return;
  const scene=(D.scenes||[]).find(s=>s.id===ws2.openSceneId);
  if(!scene){el.innerHTML=`<span style="font-size:9px;color:var(--text3);letter-spacing:.1em;">DOUBLE-CLICK A SCENE TO OPEN</span>`;return;}
  el.innerHTML=`
    <span style="font-size:9px;color:var(--accent2);letter-spacing:.1em;flex:1;">${wsE(scene.name.toUpperCase())}</span>
    <button class="ws2-tb-btn" onclick="ws2addNodeModal()">+ Node</button>
    <button class="ws2-tb-btn" style="color:var(--accent2);" onclick="if(typeof openSceneCanvas==='function')openSceneCanvas('${scene.id}');">⬡ Canvas</button>
    <button class="ws2-tb-btn" onclick="if(typeof setActiveScene==='function')setActiveScene('${scene.id}');if(typeof nav==='function')nav('scene-tree');">↗ Tree</button>`;
}

// ── NODE TREE ─────────────────────────────────────────────────
function renderWs2NodeTree() {
  const el=document.getElementById('ws2-node-tree'); if(!el) return;
  const scene=(D.scenes||[]).find(s=>s.id===ws2.openSceneId);
  if(!scene){el.innerHTML='<div style="padding:14px;font-size:10px;color:var(--text3);">Double-click a scene to open it.</div>';return;}
  el.innerHTML='';

  function buildNode(nodeId, depth) {
    const node=scene.nodes[nodeId]; if(!node) return null;
    const wrap=document.createElement('div');
    const hasKids=node.children&&node.children.length>0;
    const row=document.createElement('div');
    row.className='ws2-node-row'+(ws2.selNodeId===nodeId?' ws2-node-sel':'');
    row.style.paddingLeft=(6+depth*14)+'px';

    const arr=document.createElement('span');
    arr.className='ws2-arrow'+(hasKids&&!node.collapsed?' open':'')+(hasKids?'':' leaf');
    arr.innerHTML=hasKids?'▶':'·';
    if(hasKids) arr.onclick=e=>{e.stopPropagation();node.collapsed=!node.collapsed;ws2save();renderWs2NodeTree();};

    const icoHtml=typeof getNodeSVGIcon==='function'
      ?`<span class="ws2-node-ico">${getNodeSVGIcon(node.type,12)}</span>`
      :`<span class="ws2-node-ico">⭕</span>`;

    const nm=document.createElement('span'); nm.className='ws2-node-name'+(node.script?' ws2-scripted':''); nm.textContent=node.name;
    const tp=document.createElement('span'); tp.className='ws2-node-type'; tp.textContent=node.type;

    row.appendChild(arr);
    row.innerHTML+=icoHtml;
    row.appendChild(nm); row.appendChild(tp);
    if(node.script){const b=document.createElement('span');b.className='ws2-script-badge';b.title='Has script';b.textContent='⚡';row.appendChild(b);}
    row.onclick=()=>{ws2.selNodeId=nodeId;renderWs2NodeTree();renderWs2Inspector();};
    row.oncontextmenu=e=>ws2nodeCtx(e,nodeId,scene);
    wrap.appendChild(row);
    if(hasKids&&!node.collapsed) node.children.forEach(c=>{const n=buildNode(c,depth+1);if(n)wrap.appendChild(n);});
    return wrap;
  }

  const root=buildNode(scene.rootId,0);
  if(root) el.appendChild(root);
}

function ws2nodeCtx(e,nodeId,scene){
  e.preventDefault(); e.stopPropagation();
  const isRoot=nodeId===scene.rootId;
  ws2ctx(e,[
    {icon:'➕',label:'Add Child',fn:()=>{ws2.selNodeId=nodeId;ws2addNodeModal();}},
    '---',
    {icon:'✏️',label:'Rename',fn:()=>{
      const node=scene.nodes[nodeId]; if(!node) return;
      openModal('Rename Node',`<input class="modal-inp" id="ws2rni" value="${wsE(node.name)}">`,[
        {label:'Cancel',action:closeModal},
        {label:'Rename',action:()=>{node.name=document.getElementById('ws2rni').value.trim()||node.name;ws2save();closeModal();renderWs2NodeTree();}}
      ]);
    }},
    ...(!isRoot?[{icon:'🗑',label:'Delete',danger:true,fn:()=>{
      function del(id){const n=scene.nodes[id];if(!n)return;(n.children||[]).forEach(c=>del(c));delete scene.nodes[id];}
      Object.values(scene.nodes).forEach(n=>{if(n.children)n.children=n.children.filter(c=>c!==nodeId);});
      del(nodeId); if(ws2.selNodeId===nodeId)ws2.selNodeId=null;
      ws2save(); renderWs2NodeTree(); renderWs2Inspector();
    }}]:[]),
  ]);
}

function ws2addNodeModal() {
  const scene=(D.scenes||[]).find(s=>s.id===ws2.openSceneId); if(!scene) return;
  const typeOpts=(typeof NODE_TYPES!=='undefined'?NODE_TYPES:[]).map(t=>`<option value="${wsE(t.type)}">${wsE(t.type)}</option>`).join('');
  const parentOpts=Object.values(scene.nodes).map(n=>`<option value="${n.id}"${n.id===ws2.selNodeId?' selected':''}>${wsE(n.name)} (${n.type})</option>`).join('');
  openModal('Add Node',`
    <label class="modal-label">Type</label><select class="modal-select" id="ws2ant">${typeOpts}</select>
    <label class="modal-label">Name</label><input class="modal-inp" id="ws2ann" placeholder="e.g. Player, Enemy">
    <label class="modal-label">Parent</label><select class="modal-select" id="ws2anp">${parentOpts}</select>
  `,[
    {label:'Cancel',action:closeModal},
    {label:'Add Node',action:()=>{
      const type=document.getElementById('ws2ant').value;
      const name=document.getElementById('ws2ann').value.trim()||type;
      const parentId=document.getElementById('ws2anp').value;
      const node=typeof makeNode==='function'?makeNode(type,name,parentId):{id:'nd_'+Date.now(),type,name,parentId,children:[],collapsed:false,props:{},script:null};
      scene.nodes[node.id]=node;
      const parent=scene.nodes[parentId];
      if(parent){if(!parent.children)parent.children=[];parent.children.push(node.id);}
      ws2.selNodeId=node.id;
      ws2save(); closeModal(); renderWs2NodeTree(); renderWs2Inspector();
      if(typeof toast==='function')toast('Node added: '+name);
    }}
  ]);
}

// ── INSPECTOR ─────────────────────────────────────────────────
function renderWs2Inspector() {
  const el=document.getElementById('ws2-inspector'); if(!el) return;

  // Node selected in open scene → use scene.js full inspector
  const scene=(D.scenes||[]).find(s=>s.id===ws2.openSceneId);
  const node=scene?.nodes?.[ws2.selNodeId];
  if(node&&typeof renderInspector==='function'){
    const pS=selectedNodeId,pSc=activeSceneId;
    selectedNodeId=ws2.selNodeId; activeSceneId=ws2.openSceneId;
    el.innerHTML='<div id="inspector-body"></div>';
    renderInspector();
    selectedNodeId=pS; activeSceneId=pSc;
    return;
  }

  if(!ws2.sel){el.innerHTML='<div class="ws2-insp-empty">Select a file or node</div>';return;}

  if(ws2.sel.type==='folder'){
    const f=D.wsFolders.find(x=>x.id===ws2.sel.id); if(!f){el.innerHTML='';return;}
    const subs=wsFolders(f.id).length, items=wsItems(f.id).length;
    el.innerHTML=`
      <div class="ws2-insp-hdr"><span class="ws2-insp-big">📁</span>
        <div><div class="ws2-insp-name">${wsE(f.name)}</div>
        <div class="ws2-insp-type">${subs} subfolder${subs!==1?'s':''} · ${items} item${items!==1?'s':''}</div></div>
      </div>
      <div class="ws2-insp-sec" style="display:flex;gap:5px;flex-wrap:wrap;">
        <button class="ws2-tb-btn" onclick="wsAddSceneRef('${f.id}')">+ Scene</button>
        <button class="ws2-tb-btn" onclick="wsAddScriptRef('${f.id}')">+ Script</button>
        <button class="ws2-tb-btn" onclick="wsAddAsset('${f.id}')">+ Asset</button>
        <button class="ws2-tb-btn" onclick="wsAddFolder('${f.id}')">📁+</button>
      </div>
      <div class="ws2-insp-sec" style="font-size:9px;color:var(--text3);line-height:1.9;">Drag items onto this folder to move them in.</div>`;
    return;
  }

  if(ws2.sel.type==='item'){
    const item=D.wsItems.find(x=>x.id===ws2.sel.id); if(!item){el.innerHTML='';return;}
    const meta=wsItemMeta(item);

    if(item.type==='scene'&&meta.scene){
      const sc=meta.scene;
      const nc=Object.keys(sc.nodes||{}).length;
      const rn=sc.nodes?.[sc.rootId];
      el.innerHTML=`
        <div class="ws2-insp-hdr"><span class="ws2-insp-big">${meta.icon}</span>
          <div><div class="ws2-insp-name">${wsE(sc.name)}</div><div class="ws2-insp-type">.tscn · ${nc} node${nc!==1?'s':''} · ${wsE(rn?.type||'?')}</div></div>
        </div>
        <div class="ws2-insp-sec" style="display:flex;gap:5px;flex-wrap:wrap;">
          <button class="btn accent" style="font-size:9px;" onclick="ws2openScene('${sc.id}')">Open</button>
          <button class="btn" style="font-size:9px;" onclick="if(typeof openSceneCanvas==='function')openSceneCanvas('${sc.id}');">⬡ Canvas</button>
          <button class="btn" style="font-size:9px;" onclick="if(typeof setActiveScene==='function')setActiveScene('${sc.id}');if(typeof nav==='function')nav('scene-tree');">Tree ↗</button>
        </div>`;
      return;
    }

    if(item.type==='script'&&meta.script){
      const sp=meta.script;
      el.innerHTML=`
        <div class="ws2-insp-hdr"><span class="ws2-insp-big">📄</span>
          <div><div class="ws2-insp-name">${wsE(sp.name)}</div><div class="ws2-insp-type">.gd · ${wsE(sp.version||'')}</div></div>
        </div>
        <div class="ws2-insp-sec">
          <div class="ws2-insp-lbl">PREVIEW</div>
          <pre class="ws2-code-pre">${wsE((sp.code||'(empty)').slice(0,500))}${(sp.code||'').length>500?'\n…':''}</pre>
        </div>
        <div class="ws2-insp-sec">
          <button class="btn accent" style="font-size:9px;" onclick="if(typeof nav==='function')nav('vault');setTimeout(()=>{activeFolder='${sp.folder||''}';activeScript='${sp.id}';if(typeof renderVault==='function')renderVault();},120);">Edit in Vault ↗</button>
        </div>`;
      return;
    }

    if(item.type==='asset'){
      const def=ASSET_TYPES.find(a=>a.type===item.assetType)||{icon:'📎',ext:'',label:'File'};
      el.innerHTML=`
        <div class="ws2-insp-hdr"><span class="ws2-insp-big">${def.icon}</span>
          <div><div class="ws2-insp-name">${wsE(item.name)}</div><div class="ws2-insp-type">${def.label}${def.ext}${item.created?' · '+item.created:''}</div></div>
        </div>
        <div class="ws2-insp-sec">
          <div class="ws2-insp-lbl">NOTES / PATH</div>
          <textarea class="ws2-code-pre" style="resize:vertical;min-height:60px;font-family:var(--font);cursor:text;" oninput="(function(v){const i=(D.wsItems||[]).find(x=>x.id==='${item.id}');if(i){i.notes=v;ws2save();}})(this.value)">${wsE(item.notes||'')}</textarea>
        </div>
        <div class="ws2-insp-sec">
          <button class="ws2-tb-btn" onclick="wsEditAssetNotes((D.wsItems||[]).find(x=>x.id==='${item.id}')||{})">Edit name / notes</button>
        </div>`;
      return;
    }

    // missing ref
    el.innerHTML=`<div class="ws2-insp-hdr"><span class="ws2-insp-big">❌</span><div><div class="ws2-insp-name">${wsE(meta.name)}</div><div class="ws2-insp-type">Source deleted — remove this item</div></div></div>`;
    return;
  }

  el.innerHTML='<div class="ws2-insp-empty">Select a file or node</div>';
}

// ── Live refresh hook ─────────────────────────────────────────
function wsRefresh() {
  if(typeof refreshSceneCanvas==='function'){
    const cp=document.getElementById('page-canvas');
    if(cp&&(cp.classList.contains('active')||cp.style.display==='flex')) refreshSceneCanvas();
  }
  const wp=document.getElementById('page-workspace');
  if(wp&&(wp.classList.contains('active')||wp.style.display==='flex')){
    renderWs2NodeTree(); renderWs2Inspector();
  }
}

// ── Master render ─────────────────────────────────────────────
function renderWorkspace() {
  if(!document.getElementById('page-workspace')) return;
  renderWs2Toolbar();
  renderWs2FileTree();
  renderWs2SceneHdr();
  renderWs2NodeTree();
  renderWs2Inspector();
}
