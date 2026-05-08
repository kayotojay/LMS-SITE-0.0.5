// LMS Dev Hub — roots.js
// ========================================

// =====================================================
// ROOT MANAGEMENT
// =====================================================
function loadRoots(){try{const r=localStorage.getItem(ROOT_SK);if(r)roots=JSON.parse(r);}catch(e){roots=[];}if(!Array.isArray(roots))roots=[];}
function saveRoots(){try{localStorage.setItem(ROOT_SK,JSON.stringify(roots));}catch(e){}}
function getRootData(id){
  const sk='lms_proj_'+id;
  try{
    const r=localStorage.getItem(sk);
    if(r){
      const parsed=JSON.parse(r);
      // Merge with defaults so missing keys never crash anything
      const defaults=newProjectData();
      return Object.assign({},defaults,parsed);
    }
  }catch(e){}
  return newProjectData();
}
function saveRootData(id,data){const sk='lms_proj_'+id;try{localStorage.setItem(sk,JSON.stringify(data));}catch(e){}}

function newProjectData(){
  return{mainTasks:{},subTasks:{},customPhases:{main:[],sub:[]},folders:[],scripts:[],versions:[],survivors:[],notes:[],lore:[],activity:[],customSections:[],sessions:[],scenes:[],sceneFolders:[],gddSections:[],assets:[],bugs:[],customNodes:[],taskAssignments:[]};
}

function calcProgress(data,phases){
  let tot=0,done=0;
  [...(phases.main||[]),...(phases.sub||[])].forEach(ph=>{
    const key=ph._subPhase?'subTasks':'mainTasks';
    const ps=data[key][ph.id]||{checks:{},custom:[],removed:[]};
    const r=ps.removed||[];
    [...(ph.tasks||[]).map((_,i)=>ph.id+'-t'+i).filter((_,i)=>!r.includes(i)),...(ps.custom||[]).map((_,i)=>ph.id+'-c'+i)].forEach(k=>{tot++;if(ps.checks[k])done++;});
  });
  return{tot,done,pct:tot?Math.round(done/tot*100):0};
}

function hexToRgb(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return isNaN(r)?'200,240,74':`${r},${g},${b}`;
}

// Track which server is selected in the home sidebar
let _activeSidebarServerKey=null;

function renderServerSidebar(){
  const sidebar=document.getElementById('rs-srv-sidebar');
  const slotBar=document.getElementById('rs-slot-bar');
  if(!sidebar)return;
  // Slot pips
  if(slotBar){
    slotBar.innerHTML='';
    for(let i=0;i<MAX_SERVERS;i++){
      const pip=document.createElement('div');
      pip.className='rs-srv-slot-pip'+(i<multiServers.length?' used':'');
      pip.title=i<multiServers.length?multiServers[i].serverName:'Empty slot';
      slotBar.appendChild(pip);
    }
    const countSpan=document.createElement('span');
    countSpan.style.cssText='color:var(--text3);font-size:8px;letter-spacing:.1em;margin-left:2px;';
    countSpan.textContent=multiServers.length+'/'+MAX_SERVERS;
    slotBar.appendChild(countSpan);
  }
  // Build sidebar items
  sidebar.innerHTML='';
  multiServers.forEach(sv=>{
    const isActive=sv.serverKey===_activeSidebarServerKey;
    const item=document.createElement('div');
    item.className='rs-srv-sidebar-item'+(isActive?' active':'');
    item.title=sv.serverName+(sv.isHost?' (Host)':'');
    item.innerHTML=`
      <div class="rs-srv-item-name">${escHtml(sv.serverName)}</div>
      ${sv.isHost?'<span class="rs-srv-item-badge" style="color:var(--accent);border:1px solid var(--accent);background:rgba(200,240,74,.07);">HOST</span>':'<span class="rs-srv-item-badge" style="color:var(--text3);border:1px solid var(--border2);">MEMBER</span>'}
      <button class="rs-srv-item-leave" onclick="event.stopPropagation();confirmLeaveServer('${sv.serverKey}')" title="Leave server (keeps membership)"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="display:inline-block;vertical-align:middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    `;
    item.addEventListener('click',()=>selectSidebarServer(sv.serverKey));
    sidebar.appendChild(item);
  });
  // Add slot button if under limit
  if(multiServers.length<MAX_SERVERS){
    const addBtn=document.createElement('button');
    addBtn.className='rs-srv-add-btn';
    addBtn.textContent='+ Join / Host';
    addBtn.onclick=()=>openServerHub();
    sidebar.appendChild(addBtn);
  }
}

function selectSidebarServer(serverKey){
  _activeSidebarServerKey=serverKey;
  const sv=getServerById(serverKey);
  if(sv){
    srvState={...srvState,connected:true,serverKey:sv.serverKey,serverName:sv.serverName,username:sv.username,isHost:sv.isHost,myId:sv.myId,shortId:sv.shortId,activeProjId:null,_dbUrl:sv.dbUrl||null,_dbKey:sv.dbKey||null};
    localStorage.setItem('lms_active_server',JSON.stringify({serverKey:sv.serverKey,serverName:sv.serverName,username:sv.username,isHost:sv.isHost,myId:sv.myId,shortId:sv.shortId,dbUrl:sv.dbUrl||'',dbKey:sv.dbKey||''}));
  }
  renderServerSidebar();
  renderSelectedServerPanel();
}

async function renderSelectedServerPanel(){
  const sv=getServerById(_activeSidebarServerKey);
  const grid=document.getElementById('rs-server-proj-grid');
  const empty=document.getElementById('rs-server-proj-empty');
  const nameEl=document.getElementById('rs-srv-panel-name');
  const tagEl=document.getElementById('rs-srv-panel-tag');
  const newBtn=document.getElementById('rs-srv-new-proj-btn');
  if(!sv){
    if(grid)grid.innerHTML='';
    if(empty)empty.style.display='block';
    return;
  }
  if(nameEl)nameEl.textContent=sv.serverName.toUpperCase()+(sv.shortId?' · '+sv.shortId:'');
  if(tagEl){tagEl.style.display=sv.isHost?'inline-block':'none';}
  if(newBtn)newBtn.style.display=sv.isHost?'inline-block':'none';
  if(empty)empty.style.display='none';
  await _renderServerSection(sv,grid,empty);
}

function confirmLeaveServer(serverKey){
  const sv=getServerById(serverKey);
  const name=sv?sv.serverName:'this server';
  openModal('Leave Server',`
    <div style="font-size:11px;color:var(--text2);line-height:1.8;margin-bottom:8px;">
      Leave <strong style="color:var(--accent3);">${escHtml(name)}</strong> from your active slots?
    </div>
    <div style="font-size:9px;color:var(--text3);background:var(--bg3);border:1px solid var(--border);border-radius:2px;padding:8px 10px;line-height:1.7;">
      ℹ You will <strong style="color:var(--text);">stay a member</strong> of the server — you can rejoin anytime with the server name &amp; password. This just frees up one of your 5 active slots.
    </div>
  `,[{label:'Cancel',action:closeModal},{label:'Leave Slot',action:()=>{closeModal();leaveServerSlot(serverKey);},danger:true}]);
}

function leaveServerSlot(serverKey){
  // Remove from active multiServers WITHOUT removing member from DB
  removeMultiServer(serverKey);
  if(_activeSidebarServerKey===serverKey){
    _activeSidebarServerKey=multiServers.length?multiServers[0].serverKey:null;
  }
  if(srvState.serverKey===serverKey){
    if(multiServers.length){
      const first=multiServers[0];
      srvState={...srvState,connected:true,serverKey:first.serverKey,serverName:first.serverName,username:first.username,isHost:first.isHost,myId:first.myId,shortId:first.shortId,_dbUrl:first.dbUrl||null,_dbKey:first.dbKey||null};
      localStorage.setItem('lms_active_server',JSON.stringify({serverKey:first.serverKey,serverName:first.serverName,username:first.username,isHost:first.isHost,myId:first.myId,shortId:first.shortId,dbUrl:first.dbUrl||'',dbKey:first.dbKey||''}));
    } else {
      stopSrvPolling();
      _srvMetaCache=null;_srvMetaCacheKey=null;srvState={connected:false,serverKey:null,serverName:null,username:null,isHost:false,pollInterval:null,chatPollInterval:null,activeProjId:null,activeTab:'tasks',myId:null,lastChatTs:0,shortId:''};
      localStorage.removeItem('lms_active_server');
    }
  }
  toast('Left active slot — you remain a server member');
  renderRootGrid();
}

function renderRootGrid(){
  const grid=document.getElementById('root-grid');
  const empty=document.getElementById('empty-state');
  grid.innerHTML='';
  // Render persistent "My Servers" section
  renderRootMyServers();

  // New sidebar-based server layout
  const srvLayout=document.getElementById('rs-server-layout');
  const localLabel=document.getElementById('rs-local-label');

  if(multiServers.length>0){
    if(srvLayout)srvLayout.style.display='block';
    if(localLabel)localLabel.style.display='flex';
    // Ensure a sidebar server is selected
    if(!_activeSidebarServerKey||!getServerById(_activeSidebarServerKey)){
      _activeSidebarServerKey=multiServers[0].serverKey;
    }
    renderServerSidebar();
    renderSelectedServerPanel();
  } else {
    if(srvLayout)srvLayout.style.display='none';
    if(localLabel)localLabel.style.display='none';
    _activeSidebarServerKey=null;
    const rsGrid=document.getElementById('rs-server-proj-grid');
    if(rsGrid)rsGrid.innerHTML='';
    const rsEmpty=document.getElementById('rs-server-proj-empty');
    if(rsEmpty)rsEmpty.style.display='none';
  }

  if(!roots.length){empty.style.display='block';return;}
  empty.style.display='none';
  // Sort roots per settings
  let sortedRoots=[...roots];
  const so=SETTINGS.sortOrder||'created-desc';
  if(so==='name-asc') sortedRoots.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  else if(so==='name-desc') sortedRoots.sort((a,b)=>(b.name||'').localeCompare(a.name||''));
  else if(so==='created-asc') sortedRoots.sort((a,b)=>0); // keep original order (oldest first since array is push-ordered)
  else if(so==='progress-desc'){
    sortedRoots.sort((a,b)=>{
      const pa=calcProgress(getRootData(a.id),getPhasesForData(getRootData(a.id)));
      const pb=calcProgress(getRootData(b.id),getPhasesForData(getRootData(b.id)));
      return pb.pct-pa.pct;
    });
  } else {
    // created-desc = newest first = reverse of array order
    sortedRoots.reverse();
  }
  sortedRoots.forEach(root=>{
    try{
    const data=getRootData(root.id);
    const phases=getPhasesForData(data);
    const prog=calcProgress(data,phases);
    const col=root.color||'#c8f04a';
    const card=document.createElement('div');
    card.className='root-card';
    card.style.setProperty('--card-color',col);
    card.style.setProperty('--card-glow',`rgba(${hexToRgb(col)},.05)`);
    const hostBtn=srvState.connected&&srvState.isHost
      ? `<button class="rc-action-btn" style="color:var(--accent2);border-color:var(--accent2);margin-right:auto;" onclick="event.stopPropagation();hostExistingProjectOnServer('${root.id}')"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Publish to Server</button>`
      : `<button class="rc-action-btn" style="color:var(--accent2);margin-right:auto;opacity:.7;" onclick="event.stopPropagation();promptPublishToServer('${root.id}')"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Publish to Server</button>`;
    card.innerHTML=`
      <div class="rc-top">
        <div class="rc-icon" style="background:linear-gradient(135deg,${col}40,${col}10);color:${col};">${(root.name||'P').charAt(0).toUpperCase()}</div>
        <div class="rc-info"><div class="rc-name">${escHtml(root.name)}</div><div class="rc-engine">${escHtml(root.engine||'Godot')} &mdash; ${escHtml(root.genre||'Game')}</div></div>
      </div>
      ${SETTINGS.showProjectStats!==false?`<div class="rc-stats">
        <div class="rc-stat"><div class="rc-stat-val" style="color:${col}">${prog.done}</div><div class="rc-stat-lbl">Done</div></div>
        <div class="rc-stat"><div class="rc-stat-val">${prog.tot}</div><div class="rc-stat-lbl">Tasks</div></div>
        <div class="rc-stat"><div class="rc-stat-val" style="color:#a04af0">${data.scripts.length}</div><div class="rc-stat-lbl">Scripts</div></div>
        <div class="rc-stat"><div class="rc-stat-val" style="color:#4af0c8">${data.survivors.length}</div><div class="rc-stat-lbl">Chars</div></div>
      </div>`:''}
      ${SETTINGS.showProgressBar!==false?`<div class="rc-prog"><div class="rc-prog-bar"><div class="rc-prog-fill" style="width:${prog.pct}%;background:${col}"></div></div><div class="rc-prog-txt">${prog.pct}% complete</div></div>`:''}
      ${SETTINGS.showCreatedDate!==false?`<div class="rc-date">Created ${root.created||'—'}</div>`:''}
      <div class="rc-actions">
        ${hostBtn}
        <button class="rc-action-btn" onclick="event.stopPropagation();openEditSoloProjectInfo('${root.id}')"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Info</button>
        <button class="rc-action-btn" onclick="event.stopPropagation();exportRoot('${root.id}')">Export</button>
        <button class="rc-action-btn" onclick="event.stopPropagation();confirmDeleteRoot('${root.id}')">Delete</button>
      </div>`;
    card.addEventListener('click',()=>openRoot(root.id));
    grid.appendChild(card);
    }catch(err){console.warn('Failed to render root card',root.id,err);}
  });
  // Re-apply cards per row after render
  applyCardsPerRow();
}

// Render all active server sections (multi-server)
// Guard prevents concurrent renders racing and causing panel glitch
let _renderingServerSections=false;
async function renderAllServerSections(){
  if(_renderingServerSections)return;
  _renderingServerSections=true;
  try{
  const srvSection=document.getElementById('rs-server-projects-section');
  if(!srvSection||multiServers.length===0){_renderingServerSections=false;return;}

  const defaultHdr=document.getElementById('rs-srv-default-hdr');

  // Clear old per-server sections (keep the first rs-server-proj-grid for compatibility)
  const existingExtra=srvSection.querySelectorAll('.multi-srv-section');
  existingExtra.forEach(el=>el.remove());

  if(multiServers.length===1){
    // Single server — use existing layout, show default header
    const sv=multiServers[0];
    const rsGrid=document.getElementById('rs-server-proj-grid');
    const rsEmpty=document.getElementById('rs-server-proj-empty');
    if(defaultHdr){
      defaultHdr.style.display='flex';
      const lbl=defaultHdr.querySelector('div');
      if(lbl)lbl.textContent='Live Server Projects — '+sv.serverName;
    }
    await _renderServerSection(sv, rsGrid, rsEmpty);
  } else {
    // Multiple servers — hide default header, render one section per server
    const rsGrid=document.getElementById('rs-server-proj-grid');
    const rsEmpty=document.getElementById('rs-server-proj-empty');
    if(rsGrid)rsGrid.innerHTML='';
    if(rsEmpty)rsEmpty.style.display='none';
    if(defaultHdr)defaultHdr.style.display='none';

    // Build all section containers first (synchronously), then fetch data concurrently
    const renderJobs=multiServers.map(sv=>{
      const srvDiv=document.createElement('div');
      srvDiv.className='multi-srv-section';
      srvDiv.style.cssText='margin-bottom:28px;';
      const typeLabel=sv.isHost?'<span style="font-size:7px;padding:1px 5px;border:1px solid var(--accent);color:var(--accent);border-radius:1px;letter-spacing:.08em;margin-left:6px;">HOST</span>':'';
      srvDiv.innerHTML=`
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <div style="width:6px;height:6px;border-radius:50%;background:var(--accent2);box-shadow:0 0 6px var(--accent2);flex-shrink:0;animation:glowPulse 2s infinite;"></div>
          <div style="font-size:9px;color:var(--accent2);letter-spacing:.25em;text-transform:uppercase;">${escHtml(sv.serverName)}${typeLabel}</div>
          <div style="flex:1;height:1px;background:linear-gradient(90deg,var(--accent2),transparent);opacity:.25;"></div>
          <button onclick="openServerHubForServer('${sv.serverKey}')" style="background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--font);font-size:8px;padding:2px 8px;cursor:pointer;border-radius:1px;letter-spacing:.06em;" onmouseover="this.style.color='var(--accent2)';this.style.borderColor='var(--accent2)'" onmouseout="this.style.color='var(--text3)';this.style.borderColor='var(--border2)'">Hub <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></button>
          <button onclick="openCreateServerProjectFor('${sv.serverKey}')" style="background:linear-gradient(135deg,rgba(74,240,200,.1),rgba(74,240,200,.05));border:1px solid var(--accent2);color:var(--accent2);font-family:var(--font);font-size:9px;padding:4px 14px;cursor:pointer;border-radius:1px;letter-spacing:.06em;">+ New</button>
          <button onclick="disconnectServer('${sv.serverKey}')" style="background:none;border:1px solid var(--accent3);color:var(--accent3);font-family:var(--font);font-size:8px;padding:2px 8px;cursor:pointer;border-radius:1px;letter-spacing:.06em;">Leave</button>
        </div>
        <div class="root-grid ms-grid-${sv.serverKey}" style="margin-bottom:0;"></div>
        <div class="ms-empty-${sv.serverKey}" style="display:none;text-align:center;padding:16px;background:var(--bg2);border:1px dashed var(--border2);border-radius:3px;font-size:9px;color:var(--text3);letter-spacing:.15em;">No server projects yet</div>
      `;
      srvSection.appendChild(srvDiv);
      const g=srvDiv.querySelector('.ms-grid-'+sv.serverKey);
      const e=srvDiv.querySelector('.ms-empty-'+sv.serverKey);
      return _renderServerSection(sv,g,e);
    });
    await Promise.all(renderJobs);
  }
  }finally{_renderingServerSections=false;}
}

async function _renderServerSection(sv,grid,empty){
  if(!grid)return;
  // Show skeleton cards while loading
  grid.innerHTML=`
    <div class="skeleton-card">
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;">
        <div class="skeleton-circle"></div>
        <div style="flex:1;">
          <div class="skeleton-line" style="width:60%;height:13px;margin-bottom:6px;"></div>
          <div class="skeleton-line" style="width:40%;height:8px;"></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <div class="skeleton-stat"></div><div class="skeleton-stat"></div><div class="skeleton-stat"></div><div class="skeleton-stat"></div>
      </div>
      <div class="skeleton-line" style="height:3px;width:100%;margin-bottom:4px;"></div>
      <div class="skeleton-line" style="width:35%;height:7px;"></div>
    </div>
    <div class="skeleton-card" style="animation-delay:.1s;">
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;">
        <div class="skeleton-circle"></div>
        <div style="flex:1;">
          <div class="skeleton-line" style="width:55%;height:13px;margin-bottom:6px;"></div>
          <div class="skeleton-line" style="width:38%;height:8px;"></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <div class="skeleton-stat"></div><div class="skeleton-stat"></div><div class="skeleton-stat"></div><div class="skeleton-stat"></div>
      </div>
      <div class="skeleton-line" style="height:3px;width:100%;margin-bottom:4px;"></div>
      <div class="skeleton-line" style="width:28%;height:7px;"></div>
    </div>`;
  if(empty)empty.style.display='none';

  const _rUrl=CFG_URL;const _rKey=CFG_KEY;
  const projects=await _withServerCreds(_rUrl,_rKey,()=>fbGet('/servers/'+sv.serverKey+'/projects'))||{};
  const members=await _withServerCreds(_rUrl,_rKey,()=>fbGet('/servers/'+sv.serverKey+'/members'))||{};
  const now=Date.now();
  const online=Object.entries(members).filter(([id,m])=>m&&m.lastSeen&&(now-m.lastSeen)<30000);
  const entries=Object.entries(projects);
  // Build everything before touching the DOM — no flash
  if(!entries.length){
    grid.innerHTML='';
    if(empty)empty.style.display='block';
    return;
  }
  if(empty)empty.style.display='none';
  const frag=document.createDocumentFragment();
  entries.forEach(([id,proj])=>{
    const col=proj.color||'#4af0c8';
    const totalTasks=Object.keys(proj.tasks||{}).length;
    const doneTasks=Object.values(proj.tasks||{}).filter(t=>t.status==='done').length;
    const openBugs=Object.values(proj.bugs||{}).filter(b=>b.status!=='resolved').length;
    const pct=totalTasks?Math.round(doneTasks/totalTasks*100):0;
    const inProj=online.filter(([uid,m])=>m.inProject===id);
    const card=document.createElement('div');
    card.className='root-card';
    card.style.setProperty('--card-color',col);
    card.style.setProperty('--card-glow',`rgba(${hexToRgb(col)},.05)`);
    card.innerHTML=`
      <div class="rc-top">
        <div class="rc-icon" style="background:linear-gradient(135deg,${col}40,${col}10);color:${col};">${(proj.name||'P').charAt(0).toUpperCase()}</div>
        <div class="rc-info">
          <div class="rc-name">${escHtml(proj.name)}</div>
          <div class="rc-engine" style="display:flex;align-items:center;gap:6px;">
            <span style="color:var(--accent2);font-size:8px;padding:1px 5px;border:1px solid var(--accent2);border-radius:1px;letter-spacing:.1em;">LIVE</span>
            <span>${escHtml(sv.serverName||'server')}</span>
          </div>
        </div>
      </div>
      ${proj.desc?`<div style="font-size:9px;color:var(--text2);line-height:1.5;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border);">${escHtml(proj.desc)}</div>`:''}
      ${(proj.tags&&proj.tags.length)?`<div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:8px;">${proj.tags.map(t=>`<span style="font-size:7px;padding:1px 6px;border-radius:8px;background:rgba(74,240,200,.07);border:1px solid rgba(74,240,200,.2);color:var(--accent2);letter-spacing:.05em;">${escHtml(t)}</span>`).join('')}</div>`:''}
      ${inProj.length?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">${inProj.map(([uid,m])=>`<div style="font-size:8px;padding:1px 6px;border-radius:8px;background:rgba(74,240,200,.1);border:1px solid rgba(74,240,200,.3);color:var(--accent2);">${escHtml(m.name)}</div>`).join('')}</div>`:''}
      <div class="rc-stats">
        <div class="rc-stat"><div class="rc-stat-val" style="color:${col}">${doneTasks}</div><div class="rc-stat-lbl">Done</div></div>
        <div class="rc-stat"><div class="rc-stat-val">${totalTasks}</div><div class="rc-stat-lbl">Tasks</div></div>
        <div class="rc-stat"><div class="rc-stat-val" style="color:#f04a4a">${openBugs}</div><div class="rc-stat-lbl">Bugs</div></div>
        <div class="rc-stat"><div class="rc-stat-val" style="color:var(--accent2)">${inProj.length}</div><div class="rc-stat-lbl">Online</div></div>
      </div>
      <div class="rc-prog"><div class="rc-prog-bar"><div class="rc-prog-fill" style="width:${pct}%;background:${col}"></div></div><div class="rc-prog-txt">${pct}% complete</div></div>
      ${proj.createdBy?`<div style="font-size:8px;color:var(--text3);margin-top:6px;letter-spacing:.04em;">by <strong style="color:var(--accent);font-weight:normal;">${escHtml(proj.createdBy)}</strong>${proj.createdAt?' · '+new Date(proj.createdAt).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}):''}</div>`:''}
      <div class="rc-actions">
        <button class="rc-action-btn" onclick="event.stopPropagation();exportServerRootFor('${sv.serverKey}','${id}')">Export</button>
        ${sv.isHost?`<button class="rc-action-btn" onclick="event.stopPropagation();openEditProjectMetaFor('${sv.serverKey}','${id}')"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Info</button>`:''}
        ${sv.isHost?`<button class="rc-action-btn" onclick="event.stopPropagation();deleteSrvProjectFor('${sv.serverKey}','${id}')" style="color:var(--accent3);">Delete</button>`:''}
      </div>`;
    card.addEventListener('click',()=>openSrvProjectFrom(sv,id));
    frag.appendChild(card);
  });
  // Single DOM write — no intermediate empty state visible
  grid.innerHTML='';
  grid.appendChild(frag);
}

// Open a server hub focused on a specific server
function openServerHubForServer(serverKey){
  const sv=getServerById(serverKey);
  if(sv){
    // Temporarily set as active srvState so hub shows correctly
    if(srvState.serverKey!==serverKey){
      srvState={...srvState,connected:true,serverKey:sv.serverKey,serverName:sv.serverName,username:sv.username,isHost:sv.isHost,myId:sv.myId,shortId:sv.shortId};
    }
  }
  openServerHub();
}

// Open create project for a specific server
function openCreateServerProjectFor(serverKey){
  const sv=getServerById(serverKey);
  if(!sv)return;
  // Temporarily set srvState
  srvState={...srvState,connected:true,serverKey:sv.serverKey,serverName:sv.serverName,username:sv.username,isHost:sv.isHost,myId:sv.myId,shortId:sv.shortId};
  openCreateServerProject();
}

// Export server root for a specific server
async function exportServerRootFor(serverKey,projId){
  const sv=getServerById(serverKey);
  if(!sv)return;
  const origKey=srvState.serverKey;
  const origConn=srvState.connected;
  srvState={...srvState,connected:true,serverKey};
  await exportServerRoot(projId);
  srvState={...srvState,connected:origConn,serverKey:origKey};
}

// Delete server project for a specific server
async function deleteSrvProjectFor(serverKey,projId){
  const sv=getServerById(serverKey);
  if(!sv||!sv.isHost){toast('Only the host can delete projects');return;}
  const origState={...srvState};
  srvState={...srvState,connected:true,serverKey,serverName:sv.serverName,isHost:true,myId:sv.myId};
  await deleteSrvProject(projId);
  srvState={...origState};
}

// Open a server project from a specific server connection
async function openSrvProjectFrom(sv,projId){
  // Set srvState to this server — must include _dbUrl/_dbKey so project fetch uses correct credentials
  srvState={...srvState,connected:true,serverKey:sv.serverKey,serverName:sv.serverName,username:sv.username,isHost:sv.isHost,myId:sv.myId,shortId:sv.shortId,activeProjId:projId,_dbUrl:sv.dbUrl||null,_dbKey:sv.dbKey||null};
  localStorage.setItem('lms_active_server',JSON.stringify({serverKey:sv.serverKey,serverName:sv.serverName,username:sv.username,isHost:sv.isHost,myId:sv.myId,shortId:sv.shortId,dbUrl:sv.dbUrl||'',dbKey:sv.dbKey||''}));
  await openSrvProject(projId);
}

let selectedRootColor=ACCENT_COLORS[0];
function openCreateRoot(){
  selectedRootColor=ACCENT_COLORS[0];
  const colorOpts=ACCENT_COLORS.map((c,i)=>`<div class="color-opt${i===0?' selected':''}" style="background:${c}" data-col="${c}" onclick="selectRootColor(this)"></div>`).join('');
  openModal('New Project',`
    <label class="modal-label">Project Name</label>
    <input class="modal-inp" id="cr-name" placeholder="e.g. Last Man Standing" autofocus>
    <label class="modal-label">Engine</label>
    <input class="modal-inp" id="cr-engine" placeholder="e.g. Godot 4, Unity, Unreal">
    <label class="modal-label">Genre / Type</label>
    <input class="modal-inp" id="cr-genre" placeholder="e.g. Horror Survival, Platformer">
    <label class="modal-label">Project Color</label>
    <div class="color-row" id="color-row">${colorOpts}</div>
  `,[{label:'Cancel',action:closeModal},{label:'Create Project',action:createRoot,accent:true}]);
}

function selectRootColor(el){document.querySelectorAll('#color-row .color-opt').forEach(e=>e.classList.remove('selected'));el.classList.add('selected');selectedRootColor=el.dataset.col;}

function createRoot(){
  const name=document.getElementById('cr-name').value.trim();if(!name)return;
  const engine=document.getElementById('cr-engine').value.trim()||'Godot';
  const genre=document.getElementById('cr-genre').value.trim()||'Game';
  const id='root_'+Date.now();
  roots.push({id,name,engine,genre,color:selectedRootColor,created:new Date().toLocaleDateString()});
  saveRoots();closeModal();renderRootGrid();toast('Project created: '+name);
}

function confirmDeleteRoot(id){
  const root=roots.find(r=>r.id===id);
  openModal('Delete Project',`<p style="font-size:11px;color:var(--text2);line-height:1.7;">Permanently delete <strong style="color:var(--accent3)">${escHtml(root?.name||'this project')}</strong> and all its data? This cannot be undone.</p>`,[
    {label:'Cancel',action:closeModal},{label:'Delete',action:()=>deleteRoot(id),danger:true}
  ]);
}

function deleteRoot(id){
  roots=roots.filter(r=>r.id!==id);saveRoots();
  try{localStorage.removeItem('lms_proj_'+id);}catch(e){}
  closeModal();renderRootGrid();toast('Project deleted');
}

function openRoot(id){
  activeRootId=id;D=getRootData(id);
  const root=roots.find(r=>r.id===id);
  document.getElementById('proj-logo-title').textContent=(root?.name||'PROJECT').substring(0,14);
  document.getElementById('proj-logo-sub').textContent=(root?.engine||'dev')+' — '+(root?.genre||'game');
  document.getElementById('sidebar-footer').textContent=(root?.engine||'solo dev');
  document.getElementById('dash-sub').textContent=escHtml(root?.name?.toLowerCase()||'project overview');
  document.getElementById('root-screen-wrap').style.display='none';
  document.getElementById('app-shell').classList.add('visible');
  initProject();
}

function goHome(){
  // Clean up server state if we were in a server project
  if(srvState.activeProjId){
    if(srvState._soloSyncInterval)clearInterval(srvState._soloSyncInterval);
    srvState._soloSyncInterval=null;
    if(srvState.connected&&srvState.serverKey&&srvState.myId){
      fbPatch('/servers/'+srvState.serverKey+'/members/'+srvState.myId,{activity:null,inProject:null});
    }
    srvState.activeProjId=null;
    // Reset server UI in solo shell
    document.getElementById('solo-live-badge').style.display='none';
    document.getElementById('solo-server-nav').style.display='none';
    document.getElementById('solo-presence-bar').style.display='none';
  }
  document.getElementById('app-shell').classList.remove('visible');
  document.getElementById('root-screen-wrap').style.display='block';
  activeRootId=null;D=null;renderRootGrid();
}

function save(){
  if(!D)return;
  if(srvState.activeProjId){
    // Server mode — serialize D to Firebase format
    const fbData={
      folders:D.folders||[],
      scripts:D.scripts||[],
      sessions:D.sessions||[],
      scenes:D.scenes||[],
      sceneFolders:D.sceneFolders||[],
      customNodes:D.customNodes||[],
      gddSections:D.gddSections||[],
      assets:D.assets||[],
      lore:D.lore||[],
      activity:D.activity||[],
      survivors:D.survivors||[],
      phases:D.customPhases||{main:[],sub:[]},
      phaseData:D.mainTasks||{},
      taskAssignments:D.taskAssignments||[]
    };
    // Convert arrays to objects for Firebase (versions, bugs)
    const versions={};(D.versions||[]).forEach(v=>{versions[v.id||'v_'+Date.now()]=v;});
    fbData.versions=versions;
    const bugs={};(D.bugs||[]).forEach(b=>{bugs[b.id||'bug_'+Date.now()]=b;});
    fbData.bugs=bugs;
    const notes={};(D.notes||[]).forEach((n,i)=>{notes['n_'+i]={title:n.title||'Note',content:n.content||''};});
    fbData.notes=notes;
    const _svUrl=CFG_URL;const _svKey=CFG_KEY;
    _withServerCreds(_svUrl,_svKey,()=>fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId, {_dataOnly:true, data:JSON.stringify(fbData)}));
  } else {
    if(activeRootId) saveRootData(activeRootId,D);
  }
}