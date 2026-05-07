// LMS Dev Hub — server-root.js
// ========================================

// ---- RECENT SERVERS ----
function saveRecentServer(name,pass){
  const recent=JSON.parse(localStorage.getItem('lms_recent_servers')||'[]');
  const filtered=recent.filter(s=>s.name.toLowerCase()!==name.toLowerCase());
  const entry={name,pass,ts:Date.now()};
  filtered.unshift(entry);
  const trimmed=filtered.slice(0,10);
  localStorage.setItem('lms_recent_servers',JSON.stringify(trimmed));
  // Persist to DB so recents survive refresh/new device
  if(currentUser&&CFG_URL){
    const fbKey=name.toLowerCase().replace(/[^a-z0-9]/g,'_');
    fbSet('/accounts/'+currentUser.uid+'/recentServers/'+fbKey,{name,pass,ts:Date.now()}).catch(()=>{});
  }
}

function saveCreatedServer(name,pass){
  const created=JSON.parse(localStorage.getItem('lms_created_servers')||'[]');
  const filtered=created.filter(s=>s.name.toLowerCase()!==name.toLowerCase());
  filtered.unshift({name,pass,ts:Date.now()});
  localStorage.setItem('lms_created_servers',JSON.stringify(filtered.slice(0,10)));
    if(currentUser&&CFG_URL){
      const fbKey=name.toLowerCase().replace(/[^a-z0-9]/g,'_');
      fbSet('/accounts/'+currentUser.uid+'/createdServers/'+fbKey,{name,pass,ts:Date.now()}).catch(()=>{});
    }
  }

function saveJoinedServer(name,pass){
  const joined=JSON.parse(localStorage.getItem('lms_joined_servers')||'[]');
  const filtered=joined.filter(s=>s.name.toLowerCase()!==name.toLowerCase());
  filtered.unshift({name,pass,ts:Date.now()});
  localStorage.setItem('lms_joined_servers',JSON.stringify(filtered.slice(0,20)));
  if(currentUser&&CFG_URL){
    const fbKey=name.toLowerCase().replace(/[^a-z0-9]/g,'_');
    fbSet('/accounts/'+currentUser.uid+'/joinedServers/'+fbKey,{name,pass,ts:Date.now()}).catch(()=>{});
  }
}

function loadJoinedServers(){
  const block=document.getElementById('srv-joined-block');
  const list=document.getElementById('srv-joined-list');
  if(!block||!list)return;

  function _renderJoinedList(joined){
    const created=JSON.parse(localStorage.getItem('lms_created_servers')||'[]');
    const createdNames=new Set(created.map(s=>s.name.toLowerCase()));
    const memberOnly=joined.filter(s=>!createdNames.has(s.name.toLowerCase()));
    if(!memberOnly.length){block.style.display='none';_checkMineEmpty();return;}
    block.style.display='block';
    const emptyEl=document.getElementById('srv-mine-empty');
    if(emptyEl)emptyEl.style.display='none';
    list.innerHTML=memberOnly.map(s=>`
      <div style="background:var(--bg2);border:1px solid rgba(74,240,200,.2);border-radius:2px;padding:9px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="quickJoin('${escHtml(s.name)}','${escHtml(s.pass)}')" onmouseover="this.style.borderColor='var(--accent2)'" onmouseout="this.style.borderColor='rgba(74,240,200,.2)'">
        <div style="width:6px;height:6px;border-radius:50%;background:var(--accent2);flex-shrink:0;"></div>
        <div style="font-size:11px;color:var(--text);flex:1;">${escHtml(s.name)}</div>
        <div style="font-size:9px;color:var(--accent2);letter-spacing:.05em;">Rejoin →</div>
      </div>
    `).join('');
  }

  const local=JSON.parse(localStorage.getItem('lms_joined_servers')||'[]');
  if(local.length){
    _renderJoinedList(local);
  } else if(currentUser){
    fbGet('/accounts/'+currentUser.uid+'/joinedServers').then(fbJoined=>{
      if(fbJoined){
        const arr=Object.values(fbJoined).sort((a,b)=>b.ts-a.ts).slice(0,20);
        localStorage.setItem('lms_joined_servers',JSON.stringify(arr));
        _renderJoinedList(arr);
      } else {
        _renderJoinedList([]);
      }
    }).catch(()=>_renderJoinedList([]));
  } else {
    _renderJoinedList([]);
  }
}

function loadCreatedServers(){
  const block=document.getElementById('srv-created-block');
  const list=document.getElementById('srv-created-list');
  if(!block||!list)return;

  function _renderCreatedList(created){
    if(!created.length){block.style.display='none';_checkMineEmpty();return;}
    block.style.display='block';
    const emptyEl=document.getElementById('srv-mine-empty');
    if(emptyEl)emptyEl.style.display='none';
    list.innerHTML=created.map(s=>`
      <div style="background:var(--bg2);border:1px solid rgba(200,240,74,.2);border-radius:2px;padding:9px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="quickJoin('${escHtml(s.name)}','${escHtml(s.pass)}')" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='rgba(200,240,74,.2)'">
        <div style="width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0;"></div>
        <div style="font-size:11px;color:var(--text);flex:1;">${escHtml(s.name)}</div>
        <button onclick="event.stopPropagation();promptChangeServerPassword('${escHtml(s.name)}','${escHtml(s.pass)}')" class="ii-btn" style="background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--font);font-size:8px;padding:2px 7px;cursor:pointer;border-radius:1px;letter-spacing:.06em;display:inline-flex;align-items:center;gap:4px;" title="Change server password" onmouseover="this.style.color='var(--accent4)';this.style.borderColor='var(--accent4)'" onmouseout="this.style.color='var(--text3)';this.style.borderColor='var(--border2)'"><ion-icon name="key-sharp" style="font-size:11px;pointer-events:none;"></ion-icon></button>
        <div style="font-size:9px;color:var(--accent);letter-spacing:.05em;">Rejoin as Host →</div>
      </div>
    `).join('');
  }

  // Always try DB first when user is logged in — localStorage may be stale
  // Must use OWN DB credentials — never a server host's DB — for self-scoped queries.
if(currentUser&&CFG_URL){
    
    // Query Supabase servers table directly — host_id is the source of truth
    const url=CFG_URL+'/rest/v1/servers?host_id=eq.'+encodeURIComponent(currentUser.uid)+'&deleted=eq.false&select=key,name,pass_hash,created_at';
    fetch(url,{headers:Object.assign({'Content-Type':'application/json','apikey':CFG_KEY,'Authorization':'Bearer '+CFG_KEY},{'Accept':'application/json'})}).then(async r=>{
      const dbServers=r.ok?await r.json():[];
      const local=JSON.parse(localStorage.getItem('lms_created_servers')||'[]');
      // Merge: DB rows + local cache (local has the plaintext pass, DB has hash)
      const merged=Array.isArray(dbServers)?dbServers.map(row=>({
        name:row.name,
        pass:local.find(l=>l.name.toLowerCase()===row.name.toLowerCase())?.pass||_getPassCache(row.name)?.pass||'',
        ts:row.created_at||0
      })):[];
      // Add any local entries not yet in DB
      for(const ls of local){
        if(!merged.find(m=>m.name.toLowerCase()===ls.name.toLowerCase()))merged.push(ls);
      }
      merged.sort((a,b)=>b.ts-a.ts);
      if(merged.length)localStorage.setItem('lms_created_servers',JSON.stringify(merged.slice(0,10)));
      _renderCreatedList(merged);
    }).catch(()=>{
      const local=JSON.parse(localStorage.getItem('lms_created_servers')||'[]');
      if(local.length)_renderCreatedList(local);
      else{block.style.display='none';_checkMineEmpty();}
    });
}}

// ---- ROOT SCREEN: MY SERVERS SECTION ----
// Password cache: stored separately in localStorage keyed by server name hash
// so it survives HTML file changes (it's just a simple key-value store)
function _savePassCache(serverName, pass){
  try{
    const cache=JSON.parse(localStorage.getItem('lms_srv_pass_cache')||'{}');
    cache[serverName.toLowerCase()]={pass,ts:Date.now()};
    localStorage.setItem('lms_srv_pass_cache',JSON.stringify(cache));
  }catch(e){}
}
function _getPassCache(serverName){
  try{
    const cache=JSON.parse(localStorage.getItem('lms_srv_pass_cache')||'{}');
    return cache[serverName.toLowerCase()]||null;
  }catch(e){return null;}
}

let _renderingMyServers=false;
async function renderRootMyServers(){
  if(_renderingMyServers)return;
  _renderingMyServers=true;
  try{
  const section=document.getElementById('rs-my-servers-section');
  const grid=document.getElementById('rs-my-servers-grid');
  const connSection=document.getElementById('rs-connected-servers-section');
  const connGrid=document.getElementById('rs-connected-servers-grid');
  if(!section||!grid){_renderingMyServers=false;return;}
  if(!currentUser){
    if(section)section.style.display='none';
    if(connSection)connSection.style.display='none';
    _renderingMyServers=false;return;
  }

  // Show loading state immediately
  section.style.display='block';
  grid.innerHTML=`<div class="srv-loading-spinner"><div class="srv-spinner-ring"></div><div class="srv-spinner-txt">FETCHING SERVERS…</div></div>`;
  if(connSection){connSection.style.display='none';}

  // ── SOURCE 1: DB query — all servers where host_id = my uid ──
  // Always use the member's OWN DB for self-scoped queries — never a server's host DB.
  const _ownHdrs=(extra)=>Object.assign({'Content-Type':'application/json','apikey':CFG_KEY,'Authorization':'Bearer '+CFG_KEY},extra||{});
  let hostedServers=[];
  let src1Ok=false;
  try{
    const url=CFG_URL+'/rest/v1/servers?host_id=eq.'+encodeURIComponent(currentUser.uid)+'&deleted=eq.false&select=key,name,short_id,host_id,created_at';
    const r=await fetch(url,{headers:_ownHdrs({'Accept':'application/json'})});
    if(r.ok){
      const rows=await r.json();
      if(Array.isArray(rows)){hostedServers=rows.map(r=>({key:r.key,name:r.name,shortId:r.short_id,role:'HOST'}));src1Ok=true;}
    }
  }catch(e){console.warn('renderRootMyServers: DB query failed',e);}

  // ── SOURCE 2: joined servers — member rows live in each HOST's DB, not the member's own DB.
  // Read the join cache from localStorage (written at join time with host DB creds),
  // then verify each entry is still alive by querying the host's DB directly.
  let joinedServers=[];
  const joinedCache=JSON.parse(localStorage.getItem('lms_joined_servers')||'[]');
  for(const j of joinedCache){
    const key=hashStr(j.name.toLowerCase());
    if(hostedServers.find(h=>h.key===key)) continue;
    // all servers on shared DB — no per-server creds needed
    try{
      // Verify membership in the host's DB — member rows are stored there
      const jHdrs=Object.assign({'Content-Type':'application/json','apikey':CFG_KEY,'Authorization':'Bearer '+CFG_KEY},{'Accept':'application/json'});
      const mUrl=CFG_URL+'/rest/v1/members?uid=eq.'+encodeURIComponent(currentUser.uid)+'&server_key=eq.'+encodeURIComponent(key)+'&select=server_key,is_host';
      const mR=await fetch(mUrl,{headers:jHdrs});
      if(mR.ok){
        const mRows=await mR.json();
        if(Array.isArray(mRows)&&mRows.length>0){
          // Confirmed member — get server meta
          const meta=await _withServerCreds(CFG_URL,CFG_KEY,()=>fbGet('/servers/'+key+'/meta'));
          if(meta&&!meta.deleted&&!joinedServers.find(s=>s.key===key))
            joinedServers.push({key,name:meta.name,shortId:meta.shortId||'',role:'MEMBER'});
        }
      }
    }catch(e){}
  }

  // ── SOURCE 4: localStorage fallback for joined (member) servers ──
  // Ensures joined servers appear on refresh even when members table query misses creds
  const localJoined=JSON.parse(localStorage.getItem('lms_joined_servers')||'[]');
  for(const s of localJoined){
    const key=hashStr(s.name.toLowerCase());
    if(hostedServers.find(h=>h.key===key)) continue;
    if(joinedServers.find(j=>j.key===key)) continue;
    try{
      // Use the stored host DB creds — joined server member rows are in the host's DB
      // all servers on shared DB — no per-server creds needed
      const meta=await _withServerCreds(CFG_URL,CFG_KEY,()=>fbGet('/servers/'+key+'/meta'));
      if(meta&&!meta.deleted) joinedServers.push({key,name:meta.name,shortId:meta.shortId||'',role:'MEMBER'});
    }catch(e){}
  }

  // ── SOURCE 3: localStorage fallback for hosted servers only ──
  if(!src1Ok){
    const oldCreated=JSON.parse(localStorage.getItem('lms_created_servers')||'[]');
    for(const s of oldCreated){
      const key=hashStr(s.name.toLowerCase());
      if(hostedServers.find(h=>h.key===key)) continue;
      if(joinedServers.find(j=>j.key===key)) continue;
      // Use own DB for hosted server lookup — fall back to stored dbUrl if own DB unset
      try{
        const meta=await _withServerCreds(CFG_URL,CFG_KEY,()=>fbGet('/servers/'+key+'/meta'));
        if(meta&&!meta.deleted) hostedServers.push({key,name:meta.name,shortId:meta.shortId||'',role:'HOST'});
      }catch(e){}
    }
  }

  const passCache=JSON.parse(localStorage.getItem('lms_srv_pass_cache')||'{}');

  const isActive=s=>{
    if(srvState.connected&&srvState.serverKey===s.key) return true;
    return multiServers.some(mv=>mv.serverKey===s.key);
  };

  function _makeCard(s,accent){
    const cached=_getPassCache(s.name)||passCache[s.name.toLowerCase()];
    // Use only stored creds — NEVER fall back to CFG_URL/SRV_ANON_KEY which may be wrong.
    // For hosted servers: own DB. For joined servers: host's DB. Both stored explicitly.
    const pass=cached?.pass||'';
    const hasPass=!!pass;
    const active=isActive(s);
    const btnLabel=active?'Open →':(hasPass?'Connect →':'Enter Password →');
    return `<div onclick="rsQuickConnectServer('${escHtml(s.name)}','${escHtml(pass)}',${s.role==='HOST'})"
      style="background:var(--bg2);border:1px solid ${active?accent:'var(--border)'};border-radius:3px;padding:14px 16px;cursor:pointer;position:relative;overflow:hidden;transition:border-color .2s,transform .15s,box-shadow .2s;display:flex;flex-direction:column;gap:6px;"
      onmouseover="this.style.borderColor='${accent}';this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,.3)'"
      onmouseout="this.style.borderColor='${active?accent:'var(--border)'}';this.style.transform='';this.style.boxShadow=''">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${accent};opacity:${active?1:.5}"></div>
      ${active?`<div style="position:absolute;top:8px;right:8px;font-size:7px;padding:1px 5px;border:1px solid ${accent};color:${accent};border-radius:1px;letter-spacing:.1em;">LIVE</div>`:''}
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${accent};${active?'box-shadow:0 0 6px '+accent+';animation:glowPulse 2s infinite;':''}flex-shrink:0;"></div>
        <div style="font-size:13px;color:var(--text);letter-spacing:.04em;font-family:var(--vt);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(s.name)}</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
        <span style="font-size:8px;color:${accent};letter-spacing:.12em;padding:1px 5px;border:1px solid ${accent};border-radius:1px;opacity:.8;">${s.role}</span>
        <span style="font-size:9px;color:var(--text3);">${btnLabel}</span>
      </div>
      ${!hasPass&&!active?`<div style="font-size:8px;color:var(--accent4);letter-spacing:.06em;margin-top:2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Password needed to connect</div>`:''}
    </div>`;
  }

  // ── Render hosted servers ──
  if(hostedServers.length){
    section.style.display='block';
    grid.innerHTML=hostedServers.map(s=>_makeCard(s,'var(--accent)')).join('');
  } else {
    section.style.display='none';
  }

  // ── Render member (connected) servers ──
  if(connSection&&connGrid){
    if(joinedServers.length){
      connSection.style.display='block';
      connGrid.innerHTML=joinedServers.map(s=>_makeCard(s,'var(--accent2)')).join('');
    } else {
      connSection.style.display='none';
    }
  }

  }finally{_renderingMyServers=false;}
}

async function rsQuickConnectServer(name,pass,isCreated){
  // If already connected to this server, just open the hub showing it
  if(srvState.connected&&srvState.serverName&&srvState.serverName.toLowerCase()===name.toLowerCase()){
    openServerHub();return;
  }
  const alreadyIn=multiServers.find(sv=>sv.serverName&&sv.serverName.toLowerCase()===name.toLowerCase());
  if(alreadyIn){switchActiveServer(alreadyIn.serverKey);openServerHub();return;}

  // If no password cached, prompt for it inline
  if(!pass){
    openModal('Connect to '+name,`
      <div style="font-size:10px;color:var(--text2);margin-bottom:14px;line-height:1.6;">Enter the password for <strong style="color:var(--accent);">${escHtml(name)}</strong> to reconnect.</div>
      <label class="modal-label">Password</label>
      <input class="modal-inp" id="rs-srv-pw-inp" type="password" placeholder="Server password" autofocus>
      <div id="rs-srv-pw-err" style="font-size:9px;color:var(--accent3);min-height:14px;margin-top:4px;"></div>
    `,[{label:'Cancel',action:closeModal},{label:'Connect →',action:async()=>{
      const entered=document.getElementById('rs-srv-pw-inp').value;
      if(!entered){document.getElementById('rs-srv-pw-err').textContent='Enter a password';return;}
      closeModal();
      await rsQuickConnectServer(name,entered,isCreated);
    },accent:true}]);
    // Allow Enter key
    setTimeout(()=>{
      const inp=document.getElementById('rs-srv-pw-inp');
      if(inp)inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.querySelector('#modal-wrap .btn.accent')?.click();}});
    },50);
    return;
  }

  toast('Connecting to '+name+'…');

  const targetDbUrl=CFG_URL;
  const targetDbKey=CFG_KEY;

  if(!targetDbUrl||!targetDbKey){toast('No database configured for this server — re-join manually');openServerHub();return;}
  if(multiServers.length>=MAX_SERVERS&&!multiServers.find(s=>s.serverName===name)){
    toast('Max servers reached. Leave one first.');openServerHub();return;
  }

  const username=currentUser?(currentUser.displayName||currentUser.username):'Member';
  const serverKey=hashStr(name.toLowerCase());
  const passHash=await hashPass(pass);

  const meta=await _withServerCreds(targetDbUrl,targetDbKey,()=>fbGet('/servers/'+serverKey+'/meta'));
  if(!meta){
    toast('Server "'+name+'" not found — it may have been deleted');
    renderRootMyServers();return;
  }
  if(meta.passHash!==passHash){
    // Clear bad cached password and re-prompt
    try{const c=JSON.parse(localStorage.getItem('lms_srv_pass_cache')||'{}');delete c[name.toLowerCase()];localStorage.setItem('lms_srv_pass_cache',JSON.stringify(c));}catch(e){}
    openModal('Wrong Password',`
      <div style="font-size:10px;color:var(--text2);margin-bottom:14px;line-height:1.6;">Wrong password for <strong style="color:var(--accent);">${escHtml(name)}</strong>. Try again.</div>
      <label class="modal-label">Password</label>
      <input class="modal-inp" id="rs-srv-pw-inp2" type="password" placeholder="Server password" autofocus>
      <div id="rs-srv-pw-err2" style="font-size:9px;color:var(--accent3);min-height:14px;margin-top:4px;"></div>
    `,[{label:'Cancel',action:closeModal},{label:'Try Again →',action:async()=>{
      const entered=document.getElementById('rs-srv-pw-inp2').value;
      if(!entered){document.getElementById('rs-srv-pw-err2').textContent='Enter a password';return;}
      closeModal();
      await rsQuickConnectServer(name,entered,isCreated,targetDbUrl,targetDbKey);
    },accent:true}]);
    return;
  }

  const myId=currentUser?.uid||('user_'+Date.now()+'_'+Math.random().toString(36).slice(2,6));
  const isHost=!!(meta.hostId&&meta.hostId===myId);
  const now=Date.now();

  if(meta.visibility==='private'&&meta.hostId&&meta.hostId!==myId){
    toast('Private server — only the owner can access it');return;
  }

  const memberData={uid:myId,server_key:serverKey,name:username, displayName:username, username:currentUser?.username||username,lastSeen:now,isHost,createdAt:now,email:currentUser?.email||'',activity:null,inProject:null};
  await _withServerCreds(targetDbUrl,targetDbKey,()=>fbSet('/servers/'+serverKey+'/members/'+myId,memberData));

  const sv={serverKey,serverName:meta.name,username,isHost,myId,shortId:meta.shortId||''};
  addMultiServer(sv);
  startServerHeartbeat(serverKey);

  srvState={...srvState,connected:true,serverKey,serverName:meta.name,username,isHost,myId,activeProjId:null,shortId:meta.shortId||'',_dbUrl:CFG_URL,_dbKey:CFG_KEY};
  localStorage.setItem('lms_active_server',JSON.stringify({serverKey,serverName:meta.name,username,isHost,myId,shortId:meta.shortId||''}));

  // Cache the working password so reconnect is seamless next time
  _savePassCache(meta.name,pass,targetDbUrl,targetDbKey);
  saveRecentServer(name,pass,targetDbUrl,targetDbKey);
  if(isHost){saveCreatedServer(meta.name,pass,targetDbUrl,targetDbKey);bakInitialSnapshot(serverKey,meta.name);}
  else{saveJoinedServer(meta.name,pass,targetDbUrl,targetDbKey);}
  startSrvHeartbeat();
  renderRootGrid();
  toast('Connected to '+meta.name+(isHost?' [HOST]':''));
  openServerHub();
}

function _renderRecentList(recent){
  const block=document.getElementById('srv-recent-block');
  const list=document.getElementById('srv-recent-list');
  const emptyEl=document.getElementById('srv-mine-empty');
  if(!block||!list)return;
  if(!recent.length){block.style.display='none';_checkMineEmpty();return;}
  block.style.display='block';
  if(emptyEl)emptyEl.style.display='none';
  list.innerHTML=recent.map(s=>`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:2px;padding:9px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="quickJoin('${escHtml(s.name)}','${escHtml(s.pass)}')" onmouseover="this.style.borderColor='var(--accent2)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="width:6px;height:6px;border-radius:50%;background:var(--accent2);flex-shrink:0;"></div>
      <div style="font-size:11px;color:var(--text);flex:1;">${escHtml(s.name)}</div>
      <div style="font-size:9px;color:var(--accent2);letter-spacing:.05em;">Quick Join →</div>
    </div>
  `).join('');
}

function _checkMineEmpty(){
  const emptyEl=document.getElementById('srv-mine-empty');
  if(!emptyEl)return;
  const createdBlock=document.getElementById('srv-created-block');
  const joinedBlock=document.getElementById('srv-joined-block');
  const recentBlock=document.getElementById('srv-recent-block');
  const allHidden=(!createdBlock||createdBlock.style.display==='none')&&(!joinedBlock||joinedBlock.style.display==='none')&&(!recentBlock||recentBlock.style.display==='none');
  emptyEl.style.display=allHidden?'block':'none';
}

function loadRecentServers(){
  const block=document.getElementById('srv-recent-block');
  const list=document.getElementById('srv-recent-list');
  if(!block||!list)return;
  const localRecent=JSON.parse(localStorage.getItem('lms_recent_servers')||'[]');
  if(localRecent.length){
    _renderRecentList(localRecent);
  } else if(currentUser){
    // Pull from DB (cross-device persistence)
    fbGet('/accounts/'+currentUser.uid+'/recentServers').then(fbRecent=>{
      if(fbRecent){
        const arr=Object.values(fbRecent).sort((a,b)=>b.ts-a.ts).slice(0,10);
        localStorage.setItem('lms_recent_servers',JSON.stringify(arr));
        _renderRecentList(arr);
      } else {
        _renderRecentList([]);
      }
    }).catch(()=>_renderRecentList([]));
  } else {
    _renderRecentList([]);
  }
}

async function quickJoin(name,pass){
  // Find saved server record to get its DB credentials
  const savedRecent=JSON.parse(localStorage.getItem('lms_recent_servers')||'[]');
  const savedCreated=JSON.parse(localStorage.getItem('lms_created_servers')||'[]');
  const savedSv=[...savedRecent,...savedCreated].find(s=>s.name.toLowerCase()===name.toLowerCase());
  // Use the stored server's own DB creds — for hosted servers that's own DB,
  // for joined servers that's the host's DB. Never fall back to CFG_URL.
  const targetDbUrl=CFG_URL;
  const targetDbKey=CFG_KEY;
  if(!targetDbUrl||!targetDbKey){toast('No database configured for this server');return;}
  // Verify server still exists using its own credentials
  const serverKey=hashStr(name.toLowerCase());
  const meta=await _withServerCreds(targetDbUrl,targetDbKey,()=>fbGet('/servers/'+serverKey+'/meta'));
  if(!meta){
    toast('Server "'+name+'" no longer exists — removed from recents');
    // Remove from recent servers
    const recent=JSON.parse(localStorage.getItem('lms_recent_servers')||'[]');
    localStorage.setItem('lms_recent_servers',JSON.stringify(recent.filter(s=>s.name.toLowerCase()!==name.toLowerCase())));
    loadRecentServers();
    return;
  }
  const _jsnEl=document.getElementById('join-servername');if(_jsnEl)_jsnEl.value=name;
  const _jpwEl=document.getElementById('join-password');if(_jpwEl)_jpwEl.value=pass;
  const storedUser=currentUser?currentUser.username:(localStorage.getItem('lms_last_username')||'');
  const _juEl=document.getElementById('join-username');if(_juEl&&storedUser)_juEl.value=storedUser;
  switchSrvTab('join');
}

// Save username on join/host
const _origJoin=joinServer;
const _origHost=hostServer;


// ---- FIREBASE SETUP ----
function openSupabaseSetup(){ /* shared DB hardcoded — no setup needed */ }


function closeSupabaseSetup(){
  document.getElementById('supabase-setup-modal').style.display = 'none';
}

async function saveSupabaseUrl(){
  const url = (document.getElementById('supabase-url-input')?.value||'').trim().replace(/\/+$/,'');
  const key = (document.getElementById('supabase-key-input')?.value||'').trim();
  if(!url.startsWith('https://')||!url.includes('.supabase.co')){
    toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Enter a valid Supabase project URL'); return;
  }
  if(!key.startsWith('eyJ')||key.length<100){
    toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Enter a valid anon public key'); return;
  }
  // Shared DB — no user config needed
  toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Using shared database');
  closeSupabaseSetup();
}

function clearSupabaseUrl(){
  // Shared DB — cannot be cleared
  const urlInp = document.getElementById('supabase-url-input');
  const keyInp = document.getElementById('supabase-key-input');
  if(urlInp) urlInp.value = '';
  if(keyInp) keyInp.value = '';
  document.getElementById('fsm-has-url').style.display = 'none';
  validateDbInputs();
  toast('Database config cleared — enter your credentials to reconnect');
}



// Escape key closes overlays
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    const supaModal = document.getElementById('supabase-setup-modal');
    if(supaModal && supaModal.style.display !== 'none'){ closeSupabaseSetup(); return; }
    // Close open script editor in personal vault
    if(activeScript){ closeScriptEditor(); return; }
    // Close open script editor in SPE vault
    if(speActiveScript){ speCloseScriptEditor(); return; }
    // server project in solo shell — Escape goes home
    if(srvState.activeProjId&&document.getElementById('app-shell').classList.contains('visible')){ goHome(); return; }
    const hub = document.getElementById('server-hub-overlay');
    if(hub && hub.style.display !== 'none'){ closeServerHub(); return; }
  }
});

(function startRootSyncPoll(){
  setInterval(async()=>{
    if(!currentUser) return;
    // Only run when root screen is visible (not inside a project or hub overlay)
    const rootVisible = document.getElementById('root-screen-wrap')?.style.display !== 'none';
    const hubOpen = document.getElementById('server-hub-overlay')?.style.display !== 'none';
    const appOpen = document.getElementById('app-shell')?.classList.contains('visible');
    if(!rootVisible || appOpen) return;
    // Re-query DB and update My Servers grid silently
    renderRootMyServers();
    // If hub is open too, refresh the mine tab
    if(hubOpen){ loadCreatedServers(); loadJoinedServers(); loadRecentServers(); }
  }, 20000); // 20s — short enough to feel live, long enough not to spam Supabase
})();