// LMS Dev Hub — nav.js
// ========================================

// =====================================================
// NAV
// =====================================================
function nav(page){
  document.querySelectorAll('.page').forEach(p=>{
    p.classList.remove('active');
    // Explicitly hide — clears any inline display:flex set by chat activation
    p.style.display='none';
  });
  document.querySelectorAll('.nav-item,.nav-subitem').forEach(n=>n.classList.remove('active'));
  let pageEl=document.getElementById('page-'+page);
  if(!pageEl&&page.startsWith('custom_')){
    const pfx='custom_';const rest=page.slice(pfx.length);const subMark=rest.lastIndexOf('_sub_');const secId=subMark>=0?rest.slice(0,subMark):rest;const subId=subMark>=0?rest.slice(subMark+1):null;
    if(secId&&subId)pageEl=getOrCreateCustomPage(page,secId,subId);
  }
  if(pageEl){
    if(page==='chat'||page==='canvas'||page==='whiteboard'){pageEl.style.display='flex';pageEl.classList.add('active');}
    else{pageEl.style.display='block';pageEl.classList.add('active');}
  }
  const navEl=document.querySelector(`[onclick="nav('${page}')"]`)||document.getElementById('navitem-'+page);
  if(navEl)navEl.classList.add('active');
  const titleMap={'dash':'Dashboard','main-tasks':'Main Phases','sub-tasks':'Sub Phases','canvas':'Canvas Mode','vault':'Script Vault','versions':'Versions','settings':'Settings','analytics':'Dev Time Tracker','scene-tree':'Scene Tree','gdd':'Game Design Doc','assets':'Asset Tracker','bugs':'Bug Tracker','custom-nodes':'Custom Nodes'};
  let title=titleMap[page]||'';
  if(!title&&page.startsWith('custom_')){
    const pfx2='custom_';const rest2=page.slice(pfx2.length);const subMk2=rest2.lastIndexOf('_sub_');const _secId2=subMk2>=0?rest2.slice(0,subMk2):rest2;const _subId2=subMk2>=0?rest2.slice(subMk2+1):null;const sec=D?.customSections?.find(s=>s.id===_secId2);const sub=sec?.subsections?.find(s=>s.id===_subId2);
    title=(sub?.name||'Custom')+' — '+(sec?.name||'');
  }
  document.getElementById('page-title').textContent=title||page;
  if(page==='canvas'){if(typeof initCanvas==='function')initCanvas();}
  if(page==='settings'){renderCustomSectionsList();updateGDriveUI();renderThemeGrid();syncCustomThemePickers();renderSavedThemes();syncInAppBehaviourToggles();}
  if(page==='analytics')renderAnalytics();
  if(page==='vault'){
    const vaultPage=document.getElementById('page-vault');
    if(vaultPage&&!vaultPage._vaultClickBound){
      vaultPage._vaultClickBound=true;
      vaultPage.addEventListener('click',function(e){
        const tag=e.target.tagName;
        if(tag==='INPUT'||tag==='TEXTAREA'||tag==='BUTTON'||e.target.closest('.script-item')||e.target.closest('.editor-area')||e.target.closest('.folder-card')||e.target.closest('.toolbar')||e.target.closest('.script-list'))return;
        if(activeScript){closeScriptEditor();}
      });
    }
  }
  if(page==='scene-tree'){renderSceneFileTree();renderNodeTree();renderInspector();}
  if(page==='custom-nodes'){if(typeof renderCustomNodesPage==='function')renderCustomNodesPage();}
  if(page==='gdd')renderGDD();
  if(page==='assets')renderAssets();
  if(page==='bugs')renderBugs();
  if(page==='whiteboard'){if(typeof initWhiteboard==='function')initWhiteboard();}
  if(page==='chat'){
    if(!srvState.connected){toast('Connect to a server to use Team Chat');return;}
    const chatPage=document.getElementById('page-chat');
    if(chatPage){chatPage.style.display='flex';chatPage.classList.add('active');}
    _lastKnownChatTs=Date.now(); // mark as caught up when entering chat
    renderSoloChat();
    srvBroadcastActivity('team chat');
  } else {
    // Make sure chat page is always hidden when on any other page
    const chatPage=document.getElementById('page-chat');
    if(chatPage){chatPage.style.display='none';chatPage.classList.remove('active');}
  }
}

// =====================================================
// SCRIPT VAULT
// =====================================================
let activeFolder=null,activeScript=null;
function renderFolders(){
  const el=document.getElementById('folder-list');
  if(!D.folders.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);">No folders yet</div>';return;}
  el.innerHTML='';
  D.folders.forEach((f,fi)=>{const count=D.scripts.filter(s=>s.folder===f.id).length;const card=document.createElement('div');card.className='folder-card'+(activeFolder===f.id?' active-folder':'');card.innerHTML=`<div class="folder-icon"></div><div class="folder-name" style="flex:1;">${escHtml(f.name)}</div><div class="folder-count">${count} script${count!==1?'s':''}</div><button class="xbtn" title="Delete folder" style="margin-left:6px;flex-shrink:0;" onclick="deleteFolder('${f.id}',event)">×</button>`;card.addEventListener('click',()=>{activeFolder=f.id;activeScript=null;renderFolders();renderScripts();});el.appendChild(card);});
}
function createFolder(){const inp=document.getElementById('new-folder-inp');const name=inp.value.trim();if(!name)return;D.folders.push({id:'f'+Date.now(),name});inp.value='';save();renderFolders();logActivity('Folder: '+name,'#f0a04a');}
function deleteFolder(id,e){if(e)e.stopPropagation();const f=D.folders.find(x=>x.id===id);if(!f)return;openModal('Delete Folder',`<p style="font-size:11px;color:var(--text2);line-height:1.7;">Delete folder <strong style="color:var(--accent3);">${escHtml(f.name)}</strong>?<br><span style="color:var(--accent3);">This will also delete all ${D.scripts.filter(s=>s.folder===id).length} scripts inside it.</span></p>`,[{label:'Cancel',action:closeModal},{label:'Delete',action:()=>{D.scripts=D.scripts.filter(s=>s.folder!==id);D.folders=D.folders.filter(x=>x.id!==id);if(activeFolder===id){activeFolder=null;activeScript=null;}save();closeModal();renderFolders();renderScripts();updateGlobal();toast('Folder deleted');},danger:true}]);}
function closeScriptEditor(){activeScript=null;renderScripts();}
function renderScripts(){
  const el=document.getElementById('script-content');if(!activeFolder){el.innerHTML='<div style="font-size:11px;color:var(--text3);">Select a folder</div>';return;}
  const scripts=D.scripts.filter(s=>s.folder===activeFolder);el.innerHTML='';
  const list=document.createElement('div');list.className='script-list';
  if(!scripts.length)list.innerHTML='<div style="font-size:11px;color:var(--text3);margin-bottom:10px;">No scripts in this folder</div>';
  scripts.forEach(s=>{const item=document.createElement('div');item.className='script-item'+(activeScript===s.id?' active-script':'');item.innerHTML=`<span class="script-ver">${escHtml(s.version||'v?')}</span><span class="script-name">${escHtml(s.name)}</span><span class="script-date">${s.date||''}</span><button class="xbtn" onclick="deleteScript('${s.id}',event)">×</button>`;item.addEventListener('click',()=>{activeScript=s.id;renderScripts();});list.appendChild(item);});
  el.appendChild(list);
  const editorWrap=activeScript?buildEditor(D.scripts.find(x=>x.id===activeScript)):buildNewScriptForm();
  el.appendChild(editorWrap);
  /* Click-outside: clicking the script-content area (not an input/button/textarea) closes the editor */
  el.onclick=function(e){
    if(e.target===el&&activeScript){closeScriptEditor();}
  };
}
function buildNewScriptForm(){const w=document.createElement('div');w.className='editor-area';w.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><span style="font-size:9px;color:var(--accent);letter-spacing:.15em;">New Script</span><button class="xbtn" title="Close" onclick="closeScriptEditor()" style="font-size:13px;opacity:.6;">×</button></div><input class="editor-inp" id="ns-name" placeholder="Script name"><input class="editor-inp editor-ver" id="ns-ver" placeholder="Version (v1.0)"><textarea class="code-area" id="ns-code" placeholder="# GDScript / code here..."></textarea><div class="btn-row"><button class="btn accent" onclick="saveNewScript()">Save Script</button></div>`;return w;}
function buildEditor(s){if(!s)return buildNewScriptForm();const w=document.createElement('div');w.className='editor-area';w.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><span style="font-size:9px;color:var(--accent2);letter-spacing:.15em;">Editing: ${escHtml(s.name)} ${escHtml(s.version||'')}</span><button class="xbtn" title="Close editor" onclick="closeScriptEditor()" style="font-size:13px;opacity:.6;">×</button></div><input class="editor-inp" id="es-name" value="${escHtml(s.name||'')}"><input class="editor-inp editor-ver" id="es-ver" value="${escHtml(s.version||'')}"><textarea class="code-area" id="es-code">${escHtml(s.code||'')}</textarea><div class="btn-row"><button class="btn accent" onclick="updateScript('${s.id}')">Save</button><button class="btn" onclick="duplicateScript('${s.id}')">Duplicate as New Version</button><button class="btn danger" onclick="deleteScript('${s.id}')">Delete</button></div>`;return w;}
function saveNewScript(){const name=document.getElementById('ns-name').value.trim();const ver=document.getElementById('ns-ver').value.trim()||'v1.0';const code=document.getElementById('ns-code').value;if(!name||!activeFolder)return;const s={id:'s'+Date.now(),folder:activeFolder,name,version:ver,code,date:new Date().toLocaleDateString()};D.scripts.push(s);activeScript=s.id;save();renderScripts();updateGlobal();logActivity('Script: '+name,'#a04af0');toast('Saved');}
function updateScript(id){const s=D.scripts.find(x=>x.id===id);if(!s)return;s.name=document.getElementById('es-name').value.trim()||s.name;s.version=document.getElementById('es-ver').value.trim()||s.version;s.code=document.getElementById('es-code').value;s.date=new Date().toLocaleDateString();save();toast('Saved');}
function duplicateScript(id){const s=D.scripts.find(x=>x.id===id);if(!s)return;const code=document.getElementById('es-code').value;const ver=document.getElementById('es-ver').value.trim();const parts=ver.match(/v(\d+)\.(\d+)/);let nv=ver;if(parts)nv='v'+parts[1]+'.'+(parseInt(parts[2])+1);const ns={id:'s'+Date.now(),folder:s.folder,name:s.name,version:nv,code,date:new Date().toLocaleDateString()};D.scripts.push(ns);activeScript=ns.id;save();renderScripts();updateGlobal();toast('Duplicated as '+nv);}
function deleteScript(id,e){if(e)e.stopPropagation();D.scripts=D.scripts.filter(s=>s.id!==id);if(activeScript===id)activeScript=null;save();renderScripts();updateGlobal();}
function openNewScript(){activeScript=null;if(!activeFolder&&D.folders.length)activeFolder=D.folders[0].id;renderFolders();renderScripts();}

// =====================================================
// VERSIONS
// =====================================================
function renderVersions(){const el=document.getElementById('version-list');if(!el)return;if(!D.versions.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);">No versions logged yet</div>';return;}el.innerHTML=D.versions.slice().reverse().map(v=>`<div class="version-card" style="--vc:${v.color||'#c8f04a'}"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;"><span style="font-size:15px;color:${v.color||'#c8f04a'};letter-spacing:.1em;font-family:var(--vt);">${escHtml(v.number)}</span><span style="font-size:11px;color:var(--text);flex:1;">${escHtml(v.name)}</span><span style="font-size:9px;color:var(--text3);">${v.date}</span><button class="xbtn" onclick="deleteVersion('${v.id}')">×</button></div><div style="font-size:11px;color:var(--text2);line-height:1.6;white-space:pre-wrap;">${escHtml(v.notes||'')}</div></div>`).join('');}
function deleteVersion(id){D.versions=D.versions.filter(v=>v.id!==id);save();renderVersions();}
function openNewVersion(){
  const colors=['#c8f04a','#4af0c8','#f04a4a','#f0a04a','#a04af0','#4a9af0'];
  openModal('Log Version',`<label class="modal-label">Version Number</label><input class="modal-inp" id="mv-num" placeholder="e.g. v0.3"><label class="modal-label">Name</label><input class="modal-inp" id="mv-name" placeholder="e.g. Killer System Live"><label class="modal-label">Color</label><select class="modal-select" id="mv-color">${colors.map(c=>`<option value="${c}" style="color:${c}">${c}</option>`).join('')}</select><label class="modal-label">Notes</label><textarea class="modal-inp" id="mv-notes" placeholder="What changed..." style="height:90px;resize:vertical;"></textarea>`,[{label:'Cancel',action:closeModal},{label:'Save',action:saveVersion,accent:true}]);
}
function saveVersion(){const num=document.getElementById('mv-num').value.trim();if(!num)return;const name=document.getElementById('mv-name').value.trim();const notes=document.getElementById('mv-notes').value.trim();const color=document.getElementById('mv-color').value;D.versions.push({id:'v'+Date.now(),number:num,name:name||'untitled',notes,color,date:new Date().toLocaleDateString()});save();closeModal();renderVersions();logActivity('Version: '+num,'#4a9af0');toast('Version logged');}

// =====================================================
// SURVIVORS / CHARACTERS
// =====================================================
function renderSurvivors(){const el=document.getElementById('survivor-grid');if(!el)return;if(!D.survivors.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);">No characters yet</div>';return;}el.innerHTML='';D.survivors.forEach((s,i)=>{const card=document.createElement('div');card.className='survivor-card';const tags=[`<span class="tag ${s.status}">${s.status}</span>`];if(s.isKiller)tags.push('<span class="tag killer">killer</span>');card.innerHTML=`<div class="surv-name">${escHtml(s.name)}</div><div class="surv-row"><span class="surv-key">personality</span><span class="surv-val">${escHtml(s.personality||'—')}</span></div><div class="surv-row"><span class="surv-key">trust</span><div class="surv-bar-wrap"><div class="surv-bar-fill" style="width:${s.trust||50}%;background:#c8f04a;"></div></div><span class="surv-val">${s.trust||50}</span></div><div class="surv-row"><span class="surv-key">loyalty</span><div class="surv-bar-wrap"><div class="surv-bar-fill" style="width:${s.loyalty||50}%;background:#4af0c8;"></div></div><span class="surv-val">${s.loyalty||50}</span></div><div class="surv-actions">${tags.join('')}</div><div style="display:flex;gap:4px;margin-top:8px;"><button class="btn" style="flex:1;font-size:9px;" onclick="editSurvivor(${i})">Edit</button><button class="btn danger" style="font-size:9px;" onclick="deleteSurvivor(${i})">×</button></div>`;el.appendChild(card);});}
function deleteSurvivor(i){D.survivors.splice(i,1);save();renderSurvivors();updateGlobal();}
function openNewSurvivor(){openModal('New Character',`<label class="modal-label">Name</label><input class="modal-inp" id="sn-name" placeholder="Character name"><label class="modal-label">Personality</label><select class="modal-select" id="sn-personality"><option value="pragmatic">Pragmatic</option><option value="compassionate">Compassionate</option><option value="cautious">Cautious</option><option value="volatile">Volatile</option></select><label class="modal-label">Status</label><select class="modal-select" id="sn-status"><option value="alive">Alive</option><option value="dead">Dead</option><option value="infected">Infected</option></select><div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;"><label style="font-size:10px;color:var(--text2);width:48px;">Trust</label><input type="range" min="0" max="100" value="50" id="sn-trust" oninput="document.getElementById('sn-tv').textContent=this.value"><span id="sn-tv" style="font-size:10px;color:var(--text2);width:26px;">50</span></div><div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;"><label style="font-size:10px;color:var(--text2);width:48px;">Loyalty</label><input type="range" min="0" max="100" value="50" id="sn-loyalty" oninput="document.getElementById('sn-lv').textContent=this.value"><span id="sn-lv" style="font-size:10px;color:var(--text2);width:26px;">50</span></div><div style="display:flex;gap:10px;margin-bottom:8px;align-items:center;"><label style="font-size:10px;color:var(--text2);">Is Killer?</label><input type="checkbox" id="sn-killer"></div><label class="modal-label">Backstory / Notes</label><textarea class="modal-inp" id="sn-notes" style="height:70px;resize:vertical;"></textarea>`,[{label:'Cancel',action:closeModal},{label:'Add',action:addSurvivor,accent:true}]);}
function editSurvivor(i){const s=D.survivors[i];openModal('Edit: '+escHtml(s.name),`<input class="modal-inp" id="sn-name" value="${escHtml(s.name)}"><select class="modal-select" id="sn-personality">${['pragmatic','compassionate','cautious','volatile'].map(p=>`<option value="${p}"${s.personality===p?' selected':''}>${p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('')}</select><select class="modal-select" id="sn-status">${['alive','dead','infected'].map(p=>`<option value="${p}"${s.status===p?' selected':''}>${p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('')}</select><div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;"><label style="font-size:10px;color:var(--text2);width:48px;">Trust</label><input type="range" min="0" max="100" value="${s.trust||50}" id="sn-trust" oninput="document.getElementById('sn-tv').textContent=this.value"><span id="sn-tv" style="font-size:10px;color:var(--text2);width:26px;">${s.trust||50}</span></div><div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;"><label style="font-size:10px;color:var(--text2);width:48px;">Loyalty</label><input type="range" min="0" max="100" value="${s.loyalty||50}" id="sn-loyalty" oninput="document.getElementById('sn-lv').textContent=this.value"><span id="sn-lv" style="font-size:10px;color:var(--text2);width:26px;">${s.loyalty||50}</span></div><div style="display:flex;gap:10px;margin-bottom:8px;align-items:center;"><label style="font-size:10px;color:var(--text2);">Is Killer?</label><input type="checkbox" id="sn-killer"${s.isKiller?' checked':''}></div><textarea class="modal-inp" id="sn-notes" style="height:70px;resize:vertical;">${escHtml(s.notes||'')}</textarea>`,[{label:'Cancel',action:closeModal},{label:'Save',action:()=>updateSurvivor(i),accent:true}]);}
function addSurvivor(){const name=document.getElementById('sn-name').value.trim();if(!name)return;D.survivors.push({name,personality:document.getElementById('sn-personality').value,status:document.getElementById('sn-status').value,trust:parseInt(document.getElementById('sn-trust').value),loyalty:parseInt(document.getElementById('sn-loyalty').value),isKiller:document.getElementById('sn-killer').checked,notes:document.getElementById('sn-notes').value});save();closeModal();renderSurvivors();updateGlobal();logActivity('Character: '+name,'#4af0c8');toast('Added');}
function updateSurvivor(i){const s=D.survivors[i];s.name=document.getElementById('sn-name').value.trim()||s.name;s.personality=document.getElementById('sn-personality').value;s.status=document.getElementById('sn-status').value;s.trust=parseInt(document.getElementById('sn-trust').value);s.loyalty=parseInt(document.getElementById('sn-loyalty').value);s.isKiller=document.getElementById('sn-killer').checked;s.notes=document.getElementById('sn-notes').value;save();closeModal();renderSurvivors();toast('Updated');}

// =====================================================
// NOTES & LORE
// =====================================================
function renderNotes(){const el=document.getElementById('notes-grid');if(!el)return;if(!D.notes.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);">No notes yet</div>';return;}el.innerHTML='';D.notes.forEach((n,i)=>{const card=document.createElement('div');card.className='note-card';card.innerHTML=`<div class="note-card-title"><span>${escHtml(n.title)}</span><button class="xbtn" onclick="deleteNote(${i})">×</button></div><textarea class="notes-area" style="min-height:100px;" onchange="updateNote(${i},this.value)">${escHtml(n.content||'')}</textarea>`;el.appendChild(card);});}
function createNote(){const inp=document.getElementById('new-note-title');const title=inp.value.trim();if(!title)return;D.notes.push({title,content:''});inp.value='';save();renderNotes();toast('Note created');}
function updateNote(i,val){D.notes[i].content=val;save();}
function deleteNote(i){D.notes.splice(i,1);save();renderNotes();}
function renderLore(){const el=document.getElementById('lore-sections');if(!el)return;el.innerHTML='';(D.lore||[]).forEach((l,i)=>{const card=document.createElement('div');card.className='card';card.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><input class="editor-inp" style="flex:1;margin:0;" value="${escHtml(l.title||'')}" onchange="D.lore[${i}].title=this.value;save();" placeholder="Section title"><button class="xbtn" onclick="deleteLore(${i})">×</button></div><textarea class="notes-area" style="min-height:100px;" onchange="D.lore[${i}].content=this.value;save();">${escHtml(l.content||'')}</textarea>`;el.appendChild(card);});}
function addLoreSection(){D.lore.push({title:'',content:''});save();renderLore();}
function deleteLore(i){D.lore.splice(i,1);save();renderLore();}

// =====================================================
// ACTIVITY LOG
// =====================================================
let _activityFilter='all';
function setActivityFilter(f){
  _activityFilter=f;
  document.querySelectorAll('.af-filter-btn').forEach(b=>{
    const id=b.id.replace('af-filter-','');const active=id===f;
    b.style.background=active?'rgba(200,240,74,.1)':'none';
    b.style.borderColor=active?'var(--accent)':'var(--border2)';
    b.style.color=active?'var(--accent)':'var(--text3)';
  });
  renderActivity();
}
function _activityType(msg){
  if(msg.includes('Assigned')||msg.includes('assigned'))return'assign';
  if(msg.includes('Completed')||msg.includes('Unchecked')||msg.includes('Task added')||msg.includes('Task removed'))return'task';
  if(msg.includes('Phase')||msg.includes('phase'))return'phase';
  return'other';
}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');const dur=SETTINGS.toastDuration||2200;setTimeout(()=>t.classList.remove('show'),dur);}
function logActivity(msg,color,type){if(!D)return;D.activity.unshift({msg,color:color||'#c8f04a',ts:new Date().toLocaleString(),type:type||_activityType(msg)});if(D.activity.length>60)D.activity.pop();save();renderActivity();renderDashAssignments();}
function clearActivityItem(globalIndex){if(!D?.activity)return;D.activity.splice(globalIndex,1);save();renderActivity();}
function clearActivityFiltered(){
  if(!D?.activity)return;
  if(_activityFilter==='all'){D.activity=[];save();renderActivity();return;}
  D.activity=D.activity.filter(a=>(a.type||_activityType(a.msg))!==_activityFilter);
  save();renderActivity();
}
function renderActivity(){
  const el=document.getElementById('activity-log');
  if(!el)return;
  if(!D?.activity?.length){el.innerHTML='<div class="tl-item"><div class="tl-dot" style="background:#333"></div><div class="tl-content"><div class="tl-title" style="color:#333">No activity yet</div><div class="tl-meta">Complete tasks to see activity</div></div></div>';return;}
  const limit=SETTINGS.denseActivity?40:20;
  // Build index map — filter keeps global indices for deletion
  const all=D.activity;
  let indexed=all.map((a,i)=>({a,i}));
  if(_activityFilter!=='all')indexed=indexed.filter(({a})=>(a.type||_activityType(a.msg))===_activityFilter);
  if(!indexed.length){el.innerHTML='<div class="tl-item"><div class="tl-dot" style="background:#333"></div><div class="tl-content"><div class="tl-title" style="color:var(--text3)">No entries for this filter</div></div></div>';return;}
  el.innerHTML=indexed.slice(0,limit).map(({a,i})=>`<div class="tl-item" style="position:relative;padding-right:22px;"><div class="tl-dot" style="background:${a.color}"></div><div class="tl-content"><div class="tl-title">${a.msg}</div><div class="tl-meta">${a.ts}</div></div><button onclick="clearActivityItem(${i})" title="Remove" style="position:absolute;right:0;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text3);font-size:13px;cursor:pointer;padding:0 4px;line-height:1;opacity:.5;" onmouseover="this.style.opacity='1';this.style.color='var(--accent3)'" onmouseout="this.style.opacity='.5';this.style.color='var(--text3)'">×</button></div>`).join('');
}

// =====================================================
// TASK ASSIGNMENT (Dashboard)
// =====================================================
function _getDashMe(){
  // Try srvState first (server project), then currentUser (local), then empty
  if(typeof srvState!=='undefined'&&srvState&&srvState.username)return srvState.username;
  if(typeof currentUser!=='undefined'&&currentUser){
    return currentUser.displayName||currentUser.username||'';
  }
  return '';
}
function renderDashAssignments(){
  const el=document.getElementById('dash-assignments');
  if(!el||!D)return;
  if(!D.taskAssignments)D.taskAssignments=[];

  const me=_getDashMe();
  const all=D.taskAssignments;

  const rowHtml=(a,i,isMySection)=>{
    const isDone=a.done;
    const isMine=me&&a.assignee===me;
    const avatarBg=a.color||'var(--accent5)';
    const highlight=isMySection&&!isDone;
    const urgencyColors={low:'#4af0c8',medium:'#c8f04a',high:'#f0a04a',critical:'#f04a4a'};
    const uColor=urgencyColors[a.urgency||'low'];
    const deadlineStr=a.deadline?new Date(a.deadline+'T00:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
    const isOverdue=a.deadline&&!isDone&&new Date(a.deadline+'T00:00:00')<new Date();
    return`<div style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid var(--border);font-size:9px;${highlight?'background:rgba(160,74,240,.04);':''}">
      <div style="display:flex;align-items:center;justify-content:center;flex-shrink:0;" title="${escHtml(a.urgency||'low')} urgency">${_urgencySvg(a.urgency)}</div>
      <div style="width:18px;height:18px;border-radius:2px;background:${avatarBg};display:flex;align-items:center;justify-content:center;font-family:var(--vt);font-size:11px;color:#080808;flex-shrink:0;">${(a.assignee||'?').charAt(0).toUpperCase()}</div>
      <div style="flex:1;min-width:0;">
        <div style="color:${isDone?'var(--text3)':'var(--text)'};letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${isDone?'text-decoration:line-through;':''}">${escHtml(a.task)}</div>
        <div style="color:var(--text3);font-size:8px;letter-spacing:.06em;display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:1px;">
          <span>${escHtml(a.assignee)}</span>
          ${a.section?`<span style="color:var(--accent3);opacity:.8;">· ${escHtml(a.section)}</span>`:''}
          ${a.phase?`<span>· ${escHtml(a.phase)}</span>`:''}
          ${deadlineStr?`<span style="color:${isOverdue?'#f04a4a':'var(--text3)'};font-size:7px;">· ${isOverdue?'⚠ ':''} ${deadlineStr}</span>`:''}
        </div>
        ${a.desc?`<div style="color:var(--text3);font-size:8px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.7;">${escHtml(a.desc)}</div>`:''}
      </div>
      <span style="font-size:7px;padding:1px 5px;border:1px solid ${isDone?'var(--accent)':'var(--border2)'};color:${isDone?'var(--accent)':'var(--text3)'};border-radius:1px;cursor:pointer;flex-shrink:0;" onclick="toggleAssignment(${i})">${isDone?'DONE':'TODO'}</span>
      <button onclick="openEditAssignmentModal(${i})" title="Edit" style="background:none;border:1px solid var(--border2);color:var(--text3);font-size:9px;cursor:pointer;padding:1px 5px;border-radius:1px;flex-shrink:0;font-family:var(--font);" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--text3)'">edit</button>
      <button class="xbtn" onclick="removeAssignment(${i})" style="flex-shrink:0;">×</button>
    </div>`;
  };

  let html='';

  // ── My Tasks — always shown when there's a logged-in user and they have any tasks ──
  if(me){
    const myItems=all.map((a,i)=>({a,i})).filter(({a})=>a.assignee===me);
    const pendingCount=myItems.filter(({a})=>!a.done).length;
    html+=`<div style="font-size:8px;letter-spacing:.12em;color:var(--accent5,#a04af0);text-transform:uppercase;padding:6px 4px 4px;display:flex;align-items:center;gap:5px;">
      <ion-icon name="person-sharp" style="font-size:10px;pointer-events:none;"></ion-icon> My Tasks
      ${pendingCount?`<span style="font-size:7px;padding:0 4px;border-radius:8px;background:rgba(160,74,240,.12);border:1px solid rgba(160,74,240,.3);color:var(--accent5,#a04af0);">${pendingCount} pending</span>`:''}
    </div>`;
    if(!myItems.length){
      html+=`<div style="font-size:9px;color:var(--text3);padding:8px 10px;border:1px dashed var(--border2);border-radius:2px;text-align:center;margin-bottom:2px;">No tasks assigned to you yet.</div>`;
    } else {
      html+=myItems.map(({a,i})=>rowHtml(a,i,true)).join('');
    }
    // Divider before All Assignments
    if(all.length){
      const othersCount=all.filter(a=>a.assignee!==me).length;
      html+=`<div style="font-size:8px;letter-spacing:.12em;color:var(--text3);text-transform:uppercase;padding:10px 4px 4px;margin-top:4px;border-top:1px solid var(--border);display:flex;align-items:center;gap:5px;">
        <ion-icon name="list-sharp" style="font-size:10px;pointer-events:none;vertical-align:middle;"></ion-icon> All Assignments
        <span style="font-size:7px;padding:0 4px;border-radius:8px;background:var(--bg3);border:1px solid var(--border2);">${all.length}</span>
      </div>`;
    }
  }

  if(!all.length){
    html+='<div style="font-size:9px;color:var(--text3);padding:12px;text-align:center;letter-spacing:.08em;">No assignments yet.<br><span style="opacity:.6;">Click + Assign to assign tasks to team members.</span></div>';
  } else {
    html+=all.map((a,i)=>rowHtml(a,i,false)).join('');
  }

  el.innerHTML=html;

  // If username wasn't ready yet (srvState still connecting), re-render once it is
  if(!me&&(typeof srvState!=='undefined')&&srvState.connected){
    const _retryRender=setInterval(()=>{
      if(srvState.username){clearInterval(_retryRender);renderDashAssignments();}
    },500);
    setTimeout(()=>clearInterval(_retryRender),8000); // give up after 8s
  }
}
// Urgency SVG icons
function _urgencySvg(urgency){
  const u=urgency||'low';
  if(u==='critical')return`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f04a4a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><title>Critical</title><polygon points="12 2 22 20 2 20"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;
  if(u==='high')return`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f0a04a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><title>High</title><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  if(u==='medium')return`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c8f04a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><title>Medium</title><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  return`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4af0c8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><title>Low</title><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
}
function toggleAssignment(i){if(!D.taskAssignments)return;D.taskAssignments[i].done=!D.taskAssignments[i].done;save();renderDashAssignments();logActivity((D.taskAssignments[i].done?'\u2713 ':'\u21a9 ')+'Assignment: '+D.taskAssignments[i].task.substring(0,36),'#a04af0','assign');}
function removeAssignment(i){if(!D.taskAssignments)return;D.taskAssignments.splice(i,1);save();renderDashAssignments();}
async function openEditAssignmentModal(i){
  if(!D?.taskAssignments?.[i])return;
  const a=D.taskAssignments[i];
  const phases=[...((D.customPhases||{}).main||[]),...((D.customPhases||{}).sub||[])];
  const phaseOptions=phases.length?phases.map(ph=>`<option value="${escHtml(ph.id)}"${ph.title===a.phase?' selected':''}>${escHtml(ph.title)}</option>`).join(''):'<option value="">— no phases —</option>';
  const SERVER_SECTIONS=['Script Vault','Bug Tracker','Asset Tracker','Scene Tree','Canvas Mode','Main Phases','Sub Phases','Game Design Doc','Dev Time Tracker','Versions','Settings'];
  const customSecs=(D.customSections||[]).map(s=>s.name);
  const allSections=[...SERVER_SECTIONS,...customSecs];
  const sectionOptions=allSections.map(s=>`<option value="${escHtml(s)}"${a.section===s?' selected':''}>${escHtml(s)}</option>`).join('');
  const ASSIGN_COLORS=['#c8f04a','#4af0c8','#a04af0','#f0a04a','#4a9ff0','#f04a4a'];
  openModal('Edit Assignment',`
    <label class="modal-label">TASK NAME</label>
    <input class="modal-inp" id="ta-task" value="${escHtml(a.task)}">
    <label class="modal-label">DESCRIPTION (optional)</label>
    <textarea class="modal-inp" id="ta-desc" style="height:60px;resize:vertical;" placeholder="More details about this task...">${escHtml(a.desc||'')}</textarea>
    <label class="modal-label">SECTION / AREA</label>
    <select class="modal-select" id="ta-section"><option value="">— general —</option>${sectionOptions}</select>
    <label class="modal-label">URGENCY</label>
    <select class="modal-select" id="ta-urgency">
      <option value="low"${(a.urgency||'low')==='low'?' selected':''}>Low</option>
      <option value="medium"${a.urgency==='medium'?' selected':''}>Medium</option>
      <option value="high"${a.urgency==='high'?' selected':''}>High</option>
      <option value="critical"${a.urgency==='critical'?' selected':''}>Critical</option>
    </select>
    <label class="modal-label">DEADLINE (optional)</label>
    <input class="modal-inp" id="ta-deadline" type="date" value="${escHtml(a.deadline||'')}">
    <label class="modal-label">PHASE (optional)</label>
    <select class="modal-select" id="ta-phase"><option value="">— no phase —</option>${phaseOptions}</select>
    <label class="modal-label">COLOR</label>
    <div style="display:flex;gap:6px;margin-bottom:8px;">${ASSIGN_COLORS.map(c=>`<div onclick="this.parentNode.querySelectorAll('div').forEach(d=>d.style.outline='none');this.style.outline='2px solid #fff';" data-color="${c}" style="width:18px;height:18px;border-radius:2px;background:${c};cursor:pointer;flex-shrink:0;${a.color===c?'outline:2px solid #fff;':''}"></div>`).join('')}</div>
  `,[{label:'Cancel',action:closeModal},{label:'Save',accent:true,action:()=>{
    const task=document.getElementById('ta-task').value.trim();
    if(!task)return;
    const phId=document.getElementById('ta-phase').value;
    const phases2=[...((D.customPhases||{}).main||[]),...((D.customPhases||{}).sub||[])];
    const ph=phases2.find(p=>p.id===phId);
    const colorEl=document.querySelector('[data-color][style*="outline: 2px"]');
    const color=colorEl?colorEl.dataset.color:(a.color||ASSIGN_COLORS[0]);
    D.taskAssignments[i]={...a,task,desc:document.getElementById('ta-desc').value.trim(),section:document.getElementById('ta-section').value,urgency:document.getElementById('ta-urgency').value,deadline:document.getElementById('ta-deadline').value,phase:ph?ph.title:(a.phase||''),color};
    save();closeModal();renderDashAssignments();toast('Assignment updated');
  }}]);
}
async function openTaskAssignModal(){
  if(!D)return;
  const phases=[...((D.customPhases||{}).main||[]),...((D.customPhases||{}).sub||[])];
  const phaseOptions=phases.length?phases.map(ph=>`<option value="${escHtml(ph.id)}">${escHtml(ph.title)}</option>`).join(''):'<option value="">— no phases —</option>';
  const ASSIGN_COLORS=['#c8f04a','#4af0c8','#a04af0','#f0a04a','#4a9ff0','#f04a4a'];
  const SERVER_SECTIONS=['Script Vault','Bug Tracker','Asset Tracker','Scene Tree','Canvas Mode','Main Phases','Sub Phases','Game Design Doc','Dev Time Tracker','Versions','Settings'];
  const customSecs=(D.customSections||[]).map(s=>s.name);
  const allSections=[...SERVER_SECTIONS,...customSecs];
  const sectionOptions=allSections.map(s=>`<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('');
  // Fetch server members if connected
  let memberNames=[];
  if(typeof srvState!=='undefined'&&srvState.connected&&srvState.serverKey&&typeof activeRootId!=='undefined'&&String(activeRootId).startsWith('srv_')){
    try{
      const members=await fbGet('/servers/'+srvState.serverKey+'/members')||{};
      memberNames=Object.values(members)
        .filter(m=>m&&(m.name||m.displayName))
        .map(m=>m.displayName||m.name||'Member')
        .filter((n,i,arr)=>n&&arr.indexOf(n)===i);
    }catch(e){}
    const me=srvState.username;
    if(me&&!memberNames.includes(me))memberNames.unshift(me);
  }
  const memberPickerHtml=memberNames.length?`
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px;" id="ta-member-pills">
      ${memberNames.map((name,idx)=>`
        <button type="button" class="ta-mpill"
          onclick="(function(btn){
            document.querySelectorAll('.ta-mpill').forEach(p=>{p.style.background='transparent';p.style.color='var(--text3)';p.style.borderColor='var(--border2)';});
            btn.style.background='rgba(160,74,240,.14)';btn.style.color='var(--accent5,#a04af0)';btn.style.borderColor='var(--accent5,#a04af0)';
            document.getElementById('ta-assignee').value=btn.dataset.name;
          })(this)"
          data-name="${escHtml(name)}"
          style="font-size:9px;padding:3px 10px;border-radius:10px;border:1px solid ${idx===0?'var(--accent5,#a04af0)':'var(--border2)'};color:${idx===0?'var(--accent5,#a04af0)':'var(--text3)'};background:${idx===0?'rgba(160,74,240,.14)':'transparent'};cursor:pointer;font-family:var(--font);transition:all .15s;">
          ${escHtml(name)}${idx===0?' \u2713':''}
        </button>`).join('')}
    </div>
    <input class="modal-inp" id="ta-assignee" placeholder="Or type a name\u2026"
      value="${escHtml(memberNames[0]||'')}"
      oninput="document.querySelectorAll('.ta-mpill').forEach(p=>{p.style.background='transparent';p.style.color='var(--text3)';p.style.borderColor='var(--border2)';});"
      style="margin-top:0;">
  `:`<input class="modal-inp" id="ta-assignee" placeholder="Team member name or handle">`;
  openModal('Assign Task',`
    <label class="modal-label">TASK NAME</label>
    <input class="modal-inp" id="ta-task" placeholder="e.g. Implement player jump">
    <label class="modal-label">DESCRIPTION (optional)</label>
    <textarea class="modal-inp" id="ta-desc" style="height:60px;resize:vertical;" placeholder="More details about this task..."></textarea>
    <label class="modal-label">SECTION / AREA</label>
    <select class="modal-select" id="ta-section"><option value="">— general —</option>${sectionOptions}</select>
    <label class="modal-label">URGENCY</label>
    <select class="modal-select" id="ta-urgency">
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
      <option value="critical">Critical</option>
    </select>
    <label class="modal-label">DEADLINE (optional)</label>
    <input class="modal-inp" id="ta-deadline" type="date">
    <label class="modal-label">ASSIGN TO</label>
    ${memberPickerHtml}
    <label class="modal-label">PHASE (optional)</label>
    <select class="modal-select" id="ta-phase"><option value="">— no phase —</option>${phaseOptions}</select>
    <label class="modal-label">COLOR</label>
    <div style="display:flex;gap:6px;margin-bottom:8px;">${ASSIGN_COLORS.map(c=>`<div onclick="this.parentNode.querySelectorAll('div').forEach(d=>d.style.outline='none');this.style.outline='2px solid #fff';" data-color="${c}" style="width:18px;height:18px;border-radius:2px;background:${c};cursor:pointer;flex-shrink:0;"></div>`).join('')}</div>
  `,[{label:'Cancel',action:closeModal},{label:'Assign',accent:true,action:()=>{
    const task=document.getElementById('ta-task').value.trim();
    const assignee=document.getElementById('ta-assignee').value.trim();
    if(!task||!assignee)return;
    const phId=document.getElementById('ta-phase').value;
    const ph=phases.find(p=>p.id===phId);
    const colorEl=document.querySelector('[data-color][style*="outline: 2px"]')||document.querySelector('[data-color]');
    const color=colorEl?colorEl.dataset.color:ASSIGN_COLORS[0];
    const urgency=document.getElementById('ta-urgency').value;
    const deadline=document.getElementById('ta-deadline').value;
    const desc=document.getElementById('ta-desc').value.trim();
    const section=document.getElementById('ta-section').value;
    if(!D.taskAssignments)D.taskAssignments=[];
    D.taskAssignments.push({task,assignee,phase:ph?ph.title:'',section,urgency,deadline,desc,color,done:false,ts:new Date().toLocaleString()});
    save();closeModal();renderDashAssignments();
    logActivity(`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Assigned: ${task.substring(0,36)} \u2192 ${assignee}`,color,'assign');
    toast('Task assigned to '+assignee);
  }}]);
}

// =====================================================
// MODAL
// =====================================================
function openModal(title,bodyHtml,buttons){
  document.getElementById('modal-title').textContent=title;
  document.getElementById('modal-body').innerHTML=bodyHtml;
  const btns=document.getElementById('modal-btns');btns.innerHTML='';
  buttons.forEach(b=>{const btn=document.createElement('button');btn.className='btn'+(b.accent?' accent':'')+(b.danger?' danger':'');btn.textContent=b.label;btn.addEventListener('click',b.action);btns.appendChild(btn);});
  document.getElementById('modal').classList.add('show');
}
function closeModal(){document.getElementById('modal').classList.remove('show');}
document.getElementById('modal').addEventListener('click',e=>{if(e.target===document.getElementById('modal'))closeModal();});

// =====================================================
// MISC
// =====================================================
function confirmClearProject(){
  openModal('Clear Project',`<p style="font-size:11px;color:var(--text2);line-height:1.7;">This will wipe <strong style="color:var(--accent3);">all data</strong> in this project (tasks, scripts, characters, notes, custom sections). Cannot be undone.</p>`,[
    {label:'Cancel',action:closeModal},{label:'Clear Everything',action:()=>{D=newProjectData();save();closeModal();initProject();toast('Project cleared');},danger:true}
  ]);
}
function renderCustomSectionsList(){
  // Custom sections list in settings — stub to prevent crash
  const el=document.getElementById('custom-sections-list');
  if(!el)return;
  if(!D?.customSections?.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);">No custom sections yet.</div>';return;}
  el.innerHTML=D.customSections.map((s,i)=>`<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:11px;color:var(--text);">${escHtml(s.name)}</div>`).join('');
}

function escHtml(str){if(!str)return'';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// =====================================================
// INIT
// =====================================================
function initProject(){
  if(!D.customPhases)D.customPhases={main:[],sub:[]};
  activeFolder=null;activeScript=null;
  // Remove old custom pages
  document.querySelectorAll('[data-cpage]').forEach(p=>p.remove());
  nav('dash');
  buildPhaseGrids();updateGlobal();renderActivity();renderDashAssignments();
  renderFolders();renderScripts();renderVersions();
  renderSurvivors();renderNotes();renderLore();
  // Ensure new data keys exist
  if(!D.sessions)D.sessions=[];
  if(!D.scenes)D.scenes=[];
  if(!D.sceneFolders)D.sceneFolders=[];
  if(!D.gddSections)D.gddSections=[];
  if(!D.assets)D.assets=[];
  if(!D.bugs)D.bugs=[];
  renderAnalytics();
  renderSceneFileTree();
  renderNodeTree();
  renderGDD();
  renderAssets();
  renderBugs();
  if(!D.lore||!D.lore.length){D.lore=[{title:'World Backstory',content:''},{title:'Tone Notes',content:''}];save();renderLore();}
}

// ── Collapsible sidebar ───────────────────────────────
// Auto-assign title to nav-items that have nav-text for collapsed tooltip
function assignNavTitles(){
  document.querySelectorAll('.nav-item').forEach(el=>{
    if(!el.title){
      const t = el.querySelector('.nav-text');
      if(t) el.title = t.textContent.trim();
    }
  });
}
function toggleSidebar(){
  const sb = document.getElementById('sidebar');
  const collapsed = sb.classList.toggle('collapsed');
  try { localStorage.setItem('lms-sidebar-collapsed', collapsed ? '1' : '0'); } catch(e){}
}
function initSidebarState(){
  try {
    if(localStorage.getItem('lms-sidebar-collapsed') === '1'){
      const sb = document.getElementById('sidebar');
      if(sb) sb.classList.add('collapsed');
    }
  } catch(e){}
  assignNavTitles();
}
document.addEventListener('DOMContentLoaded', initSidebarState);