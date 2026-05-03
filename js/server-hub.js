// LMS Dev Hub — server-hub.js
// ========================================

// LMS Dev Hub — server.js
// ========================================

// =====================================================
// INVITE LINK ENCODE / DECODE
// Encodes host DB URL + anon key + server name into a
// non-obvious scrambled string. Paste into Join tab to
// auto-fill host database credentials.
// =====================================================
function lmsEncodeInvite(dbUrl, anonKey, serverName, shortId){
  const payload=JSON.stringify({u:dbUrl,k:anonKey,s:serverName,i:shortId||''});
  const b64=btoa(unescape(encodeURIComponent(payload)));
  const rotated=b64.split('').map((c,i)=>{
    const code=c.charCodeAt(0);
    const shifted=((code-32+(i%17)+13)%95)+32;
    return String.fromCharCode(shifted);
  }).join('');
  return 'LMXv1'+rotated;
}

function lmsDecodeInvite(str){
  try{
    if(!str.startsWith('LMXv1')) return null;
    const rotated=str.slice(5);
    const b64=rotated.split('').map((c,i)=>{
      const code=c.charCodeAt(0);
      const shifted=((code-32-(i%17)-13+95*2)%95)+32;
      return String.fromCharCode(shifted);
    }).join('');
    const payload=decodeURIComponent(escape(atob(b64)));
    return JSON.parse(payload);
  }catch(e){return null;}
}

function detectAndApplyInvite(val){
  const trimmed=(val||'').trim();
  if(!trimmed.startsWith('LMXv1')) return false;
  const decoded=lmsDecodeInvite(trimmed);
  if(!decoded) return false;
  const urlInp=document.getElementById('join-supabase-url');
  const keyInp=document.getElementById('join-anon-key');
  const nameInp=document.getElementById('join-servername');
  const idInp=document.getElementById('join-server-id');
  if(urlInp) urlInp.value=decoded.u||'';
  if(keyInp) keyInp.value=decoded.k||'';
  if(nameInp&&decoded.s) nameInp.value=decoded.s;
  if(idInp&&decoded.i) idInp.value=decoded.i;
  updateJoinDbHint();
  toast('✓ Invite decoded — enter the server password to join');
  setTimeout(()=>{const pw=document.getElementById('join-password');if(pw)pw.focus();},200);
  const inviteRow=document.getElementById('join-invite-row');
  if(inviteRow)inviteRow.style.display='none';
  const decodedBadge=document.getElementById('join-decoded-badge');
  if(decodedBadge){
    decodedBadge.style.display='flex';
    const short=((decoded.u||'').replace('https://','').split('.')[0]).substring(0,18);
    decodedBadge.querySelector('span').textContent='DB: '+short+'... · Server: '+(decoded.s||'?');
  }
  return true;
}

// ---- COPY INVITE LINK (encoded — host only) ----
function copyServerInvite(){
  const dbUrl=getSrvDbUrl();
  const anonKey=SRV_ANON_KEY;
  if(!dbUrl||!anonKey){toast('No database configured');return;}
  const encoded=lmsEncodeInvite(dbUrl,anonKey,srvState.serverName||'',srvState.shortId||'');
  navigator.clipboard.writeText(encoded).then(()=>toast('⧉ Invite code copied — teammate pastes it in the Join tab')).catch(()=>{
    const ta=document.createElement('textarea');ta.value=encoded;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    toast('⧉ Invite code copied');
  });
}

// ---- UI helpers ----
function openServerHub(){
  const _overlay=document.getElementById('server-hub-overlay');
  if(!_overlay){console.error('[LMS] server-hub-overlay element not found in DOM');toast('Server Hub UI not ready — try refreshing');return;}
  _overlay.style.display='block';
  // Reset manual-open state so lobby panel starts collapsed if already connected
  const lobbyPanel=document.getElementById('srv-lobby-panel');
  if(lobbyPanel){lobbyPanel.dataset.manualOpen='0';lobbyPanel.style.display='none';}
  const addBtn=document.getElementById('srv-add-another-btn');
  if(addBtn)addBtn.textContent='+ JOIN / HOST ANOTHER SERVER';
  renderSrvStatus();
  loadRecentServers();
  loadCreatedServers();
  // Update capacity bar
  const capText=document.getElementById('srv-capacity-text');
  const capFill=document.getElementById('srv-capacity-fill');
  if(capText){capText.textContent=multiServers.length+' / '+MAX_SERVERS;capText.style.color=multiServers.length>=MAX_SERVERS?'var(--accent3)':'var(--accent2)';}
  if(capFill){capFill.style.width=(multiServers.length/MAX_SERVERS*100)+'%';capFill.style.background=multiServers.length>=MAX_SERVERS?'var(--accent3)':'var(--accent2)';}
  if(currentUser){
    const dn=currentUser.displayName||currentUser.username;
    const hl=document.getElementById('host-as-label');const jl=document.getElementById('join-as-label');
    if(hl)hl.textContent=dn;if(jl)jl.textContent=dn;
  }
  // Do NOT pre-fill join credentials with own DB — joiner needs the HOST's DB info
  // Only clear if they look like own credentials
  const joinDbInp=document.getElementById('join-supabase-url');
  const joinKeyInp=document.getElementById('join-anon-key');
  if(joinDbInp&&joinDbInp.value===getSrvDbUrl()&&getSrvDbUrl()) joinDbInp.value='';
  if(joinKeyInp&&joinKeyInp.value===SRV_ANON_KEY&&SRV_ANON_KEY) joinKeyInp.value='';
  updateJoinDbHint();
  if(!getSrvDbUrl()||!SRV_ANON_KEY){
    const txt=document.getElementById('srv-status-txt');
    if(txt)txt.textContent='⚠ Database not configured — click DB Setup to get started';
    setTimeout(()=>openSupabaseSetup(), 400);
    return;
  }
  if(srvState.connected) renderActiveServer();
}
function closeServerHub(){
  const _overlay=document.getElementById('server-hub-overlay');
  if(_overlay)_overlay.style.display='none';
}
function switchSrvTab(tab){
  document.getElementById('srv-panel-host').style.display=tab==='host'?'block':'none';
  document.getElementById('srv-panel-join').style.display=tab==='join'?'block':'none';
  const minePanel=document.getElementById('srv-panel-mine');
  if(minePanel)minePanel.style.display=tab==='mine'?'block':'none';
  document.getElementById('srv-tab-host').style.cssText=tab==='host'
    ?'flex:1;background:linear-gradient(135deg,rgba(200,240,74,.1),rgba(74,240,200,.05));border:none;border-right:1px solid var(--border);color:var(--accent);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;'
    :'flex:1;background:var(--bg2);border:none;border-right:1px solid var(--border);color:var(--text3);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;';
  document.getElementById('srv-tab-join').style.cssText=tab==='join'
    ?'flex:1;background:linear-gradient(135deg,rgba(74,240,200,.1),rgba(74,240,200,.05));border:none;border-right:1px solid var(--border);color:var(--accent2);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;'
    :'flex:1;background:var(--bg2);border:none;border-right:1px solid var(--border);color:var(--text3);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;';
  const mineTab=document.getElementById('srv-tab-mine');
  if(mineTab)mineTab.style.cssText=tab==='mine'
    ?'flex:1;background:linear-gradient(135deg,rgba(160,74,240,.1),rgba(160,74,240,.05));border:none;color:var(--accent5,#a04af0);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;'
    :'flex:1;background:var(--bg2);border:none;color:var(--text3);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;';
  if(tab==='mine'){loadCreatedServers();loadRecentServers();}
}

function renderSrvStatus(){
  const dot=document.getElementById('srv-status-dot');
  const dbBtn=document.getElementById('srv-db-setup-btn');if(dbBtn){dbBtn.style.display=(srvState.connected||multiServers.length>0)?'none':'inline-block';dbBtn.textContent=getSrvDbUrl()?'✓ DB Ready':'⚙ DB Setup';dbBtn.style.color=getSrvDbUrl()?'var(--accent)':'var(--text3)';dbBtn.style.borderColor=getSrvDbUrl()?'var(--accent)':'var(--border2)';}
  const txt=document.getElementById('srv-status-txt');
  const discBtn=document.getElementById('srv-disconnect-btn');
  const lobbyPanel=document.getElementById('srv-lobby-panel');
  const activePanel=document.getElementById('srv-active-panel');

  const totalConnected=multiServers.length;

  if(srvState.connected){
    dot.style.background='var(--accent2)';
    dot.style.boxShadow='0 0 8px var(--accent2)';
    const idLabel=srvState.shortId?' · ID: '+srvState.shortId:'';
    const extraLabel=totalConnected>1?' · '+totalConnected+'/'+MAX_SERVERS+' servers':'';
    txt.textContent='Connected to: '+srvState.serverName+' as '+srvState.username+(srvState.isHost?' [HOST]':'')+idLabel+extraLabel;
    discBtn.style.display='inline-block';
    if(lobbyPanel.dataset.manualOpen!=='1')lobbyPanel.style.display='none';
    activePanel.style.display='block';
    const addAnotherWrap=document.getElementById('srv-add-another-wrap');
    if(addAnotherWrap)addAnotherWrap.style.display=multiServers.length>=MAX_SERVERS?'none':'block';
    // Inject multi-server switcher if multiple servers
    let switcherEl=document.getElementById('srv-switcher');
    if(totalConnected>1){
      if(!switcherEl){
        switcherEl=document.createElement('div');
        switcherEl.id='srv-switcher';
        switcherEl.style.cssText='display:flex;gap:6px;flex-wrap:wrap;padding:8px 0 4px;border-top:1px solid var(--border);margin-top:6px;';
        const statusWrap=txt.parentElement;
        if(statusWrap)statusWrap.appendChild(switcherEl);
      }
      switcherEl.innerHTML=multiServers.map(sv=>{
        const active=sv.serverKey===srvState.serverKey;
        return `<button onclick="switchActiveServer('${sv.serverKey}')" style="background:${active?'linear-gradient(135deg,rgba(74,240,200,.15),rgba(74,240,200,.07))':'var(--bg3)'};border:1px solid ${active?'var(--accent2)':'var(--border)'};color:${active?'var(--accent2)':'var(--text3)'};font-family:var(--font);font-size:8px;padding:3px 10px;cursor:pointer;border-radius:1px;letter-spacing:.06em;">${escHtml(sv.serverName)}${sv.isHost?' ⚡':''}</button>`;
      }).join('');
    } else if(switcherEl){switcherEl.remove();}
  } else if(totalConnected>0){
    // Multi-servers exist but srvState not set — pick first
    const sv=multiServers[0];
    dot.style.background='var(--accent2)';
    dot.style.boxShadow='0 0 8px var(--accent2)';
    txt.textContent=totalConnected+' server'+(totalConnected>1?'s':'')+' active · '+multiServers.map(s=>s.serverName).join(', ');
    discBtn.style.display='inline-block';
    if(lobbyPanel.dataset.manualOpen!=='1')lobbyPanel.style.display='none';
    activePanel.style.display='block';
    const addAnotherWrap2=document.getElementById('srv-add-another-wrap');
    if(addAnotherWrap2)addAnotherWrap2.style.display=totalConnected>=MAX_SERVERS?'none':'block';
    // Auto-set srvState to first server
    srvState={...srvState,connected:true,serverKey:sv.serverKey,serverName:sv.serverName,username:sv.username,isHost:sv.isHost,myId:sv.myId,shortId:sv.shortId,_dbUrl:sv.dbUrl||null,_dbKey:sv.dbKey||null};
    localStorage.setItem('lms_active_server',JSON.stringify({serverKey:sv.serverKey,serverName:sv.serverName,username:sv.username,isHost:sv.isHost,myId:sv.myId,shortId:sv.shortId,dbUrl:sv.dbUrl||'',dbKey:sv.dbKey||''}));
  } else {
    dot.style.background='#444';
    dot.style.boxShadow='none';
    txt.textContent=getSrvDbUrl() ? 'Not connected to any server' : '⚠ Database not configured';
    discBtn.style.display='none';
    lobbyPanel.style.display='block';
    activePanel.style.display='none';
    const switcherEl=document.getElementById('srv-switcher');
    if(switcherEl)switcherEl.remove();
  }
}

function switchActiveServer(serverKey){
  const sv=getServerById(serverKey);
  if(!sv)return;
  _activeSidebarServerKey=serverKey;
  srvState={...srvState,connected:true,serverKey:sv.serverKey,serverName:sv.serverName,username:sv.username,isHost:sv.isHost,myId:sv.myId,shortId:sv.shortId,activeProjId:null,_dbUrl:sv.dbUrl||null,_dbKey:sv.dbKey||null};
  localStorage.setItem('lms_active_server',JSON.stringify({serverKey:sv.serverKey,serverName:sv.serverName,username:sv.username,isHost:sv.isHost,myId:sv.myId,shortId:sv.shortId,dbUrl:sv.dbUrl||'',dbKey:sv.dbKey||''}));
  renderSrvStatus();
  renderActiveServer();
  renderRootGrid();
}

// Toggle the join/host panel while already connected to servers
function toggleAddAnotherServer(){
  const lobbyPanel=document.getElementById('srv-lobby-panel');
  const btn=document.getElementById('srv-add-another-btn');
  if(!lobbyPanel)return;
  const isOpen=lobbyPanel.dataset.manualOpen==='1';
  if(isOpen){
    lobbyPanel.style.display='none';
    lobbyPanel.dataset.manualOpen='0';
    if(btn)btn.textContent='+ JOIN / HOST ANOTHER SERVER';
  } else {
    lobbyPanel.style.display='block';
    lobbyPanel.dataset.manualOpen='1';
    if(btn)btn.textContent='▲ COLLAPSE';
    // Update capacity bar whenever panel is opened
    const capText=document.getElementById('srv-capacity-text');
    const capFill=document.getElementById('srv-capacity-fill');
    if(capText){capText.textContent=multiServers.length+' / '+MAX_SERVERS;capText.style.color=multiServers.length>=MAX_SERVERS?'var(--accent3)':'var(--accent2)';}
    if(capFill){capFill.style.width=(multiServers.length/MAX_SERVERS*100)+'%';capFill.style.background=multiServers.length>=MAX_SERVERS?'var(--accent3)':'var(--accent2)';}
  }
}


// ---- JOIN ----
function updateJoinDbHint(){
  const url=(document.getElementById('join-supabase-url')?.value||'').trim();
  const key=(document.getElementById('join-anon-key')?.value||'').trim();
  const hint=document.getElementById('join-db-hint');
  if(!hint)return;
  if(url&&!url.includes('.supabase.co')){hint.style.color='var(--accent3)';hint.textContent='⚠ Must be a .supabase.co URL';return;}
  if(key&&!key.startsWith('eyJ')){hint.style.color='var(--accent3)';hint.textContent='⚠ Key should start with eyJ... — check you copied the anon public key';return;}
  if(url&&key&&url.includes('.supabase.co')&&key.startsWith('eyJ')){hint.style.color='var(--accent)';hint.textContent='✓ Credentials look good';}
  else{hint.style.color='var(--text3)';hint.textContent='';}
}

async function joinServer(){
  const joinUrlRaw=(document.getElementById('join-supabase-url')?.value||'').trim();
  const joinKeyRaw=(document.getElementById('join-anon-key')?.value||'').trim();
  // Use host's DB credentials for this server — NEVER overwrite our own global credentials
  const targetDbUrl=(joinUrlRaw||getSrvDbUrl()).replace(/\/+$/,'');
  const targetDbKey=joinKeyRaw||SRV_ANON_KEY;
  if(!targetDbUrl||!targetDbKey){openSupabaseSetup();return;}
  const username=currentUser?(currentUser.displayName||currentUser.username):'Member';
  const serverName=document.getElementById('join-servername').value.trim();
  const pass=document.getElementById('join-password').value;
  if(!serverName||!pass){toast('Fill all fields');return;}

  toast('Connecting…');
  const serverKey=hashStr(serverName.toLowerCase());
  const passHash=await hashPass(pass);

  // All server communication uses the host's DB credentials, via _withServerCreds
  const meta=await _withServerCreds(targetDbUrl,targetDbKey,()=>fbGet('/servers/'+serverKey+'/meta'));
  if(!meta){toast('Server not found — check the server name and credentials');return;}
  if(meta.passHash!==passHash){toast('Wrong password');return;}

  const myId=currentUser?.uid||('user_'+Date.now()+'_'+Math.random().toString(36).slice(2,6));
  const isHost=!!(meta.hostId && meta.hostId===myId);
  const now=Date.now();

  // Block non-host from joining private servers
  if(meta.visibility==='private'&&meta.hostId&&meta.hostId!==myId){
    toast('This is a private server — only the owner can access it');
    return;
  }

  // Check multi-server limit (only for new servers, not re-joining)
  if(!isConnectedToServer(serverKey)&&multiServers.length>=MAX_SERVERS){
    toast('You already have '+MAX_SERVERS+' servers. Leave one to join another.');
    return;
  }

  const memberData={
    uid:myId,server_key:serverKey,name:username,displayName:username,username:username,
    lastSeen:now,isHost:isHost,createdAt:now,email:currentUser?.email||'',activity:null,inProject:null
  };

  const saved=await _withServerCreds(targetDbUrl,targetDbKey,()=>fbSet('/servers/'+serverKey+'/members/'+myId,memberData));
  if(!saved){toast('Failed to join server. Check database configuration.');return;}

  // Store per-server credentials — do NOT touch the user's own SRV_DB_URL / SRV_ANON_KEY
  const sv={serverKey,serverName:meta.name,username,isHost,myId,shortId:meta.shortId||'',dbUrl:targetDbUrl,dbKey:targetDbKey};
  addMultiServer(sv);
  startServerHeartbeat(serverKey);

  srvState={...srvState,connected:true,serverKey,serverName:meta.name,username,isHost,myId,activeProjId:null,shortId:meta.shortId||'',_dbUrl:targetDbUrl,_dbKey:targetDbKey};
  localStorage.setItem('lms_active_server',JSON.stringify({serverKey,serverName:meta.name,username,isHost,myId,shortId:meta.shortId||'',dbUrl:targetDbUrl,dbKey:targetDbKey}));
  saveRecentServer(serverName,pass);
  if(isHost)saveCreatedServer(meta.name,pass);
  _savePassCache(meta.name,pass,targetDbUrl,targetDbKey);
  startSrvHeartbeat();
  renderSrvStatus();
  renderActiveServer();
  toast('Joined server: '+meta.name+(isHost?' [HOST]':'')+(multiServers.length>1?' ('+multiServers.length+'/'+MAX_SERVERS+' servers)':''));
  closeServerHub();
  renderRootGrid();
}

// Replace hostServer() function (around line 3200+)
async function hostServer(){
  if(!getSrvDbUrl()){openSupabaseSetup();return;}
  const username=currentUser?(currentUser.displayName||currentUser.username):(document.getElementById('host-username')?.value.trim()||'Host');
  const serverName=document.getElementById('host-servername').value.trim();
  const pass=document.getElementById('host-password').value;
  const pass2=document.getElementById('host-password2').value;
  if(!username||!serverName||!pass){toast('Fill all fields');return;}
  if(pass!==pass2){toast('Passwords do not match');return;}

  if(multiServers.length>=MAX_SERVERS){
    toast('You already have '+MAX_SERVERS+' servers running. Leave one to create another.');
    return;
  }

  toast('Creating server…');
  const serverKey=hashStr(serverName.toLowerCase());
  const passHash=await hashPass(pass);
  const serverType=(document.getElementById('host-server-type')?.value)||'public';
  const serverDesc=(document.getElementById('host-serverdesc')?.value||'').trim();
  const serverTags=(document.getElementById('host-servertags')?.value||'').trim().split(',').map(t=>t.trim()).filter(Boolean);

  const existing=await fbGet('/servers/'+serverKey+'/meta');
  if(existing && existing.passHash && !existing.deleted){
    toast('Server name taken — try another');
    return;
  }

  const myId=currentUser?.uid||('user_'+Date.now()+'_'+Math.random().toString(36).slice(2,6));
  const now=Date.now();
  const shortId=genServerId();
  const shortIdClean=shortId.replace(/-/g,'');

  // Create server
  await fbSet('/servers/'+serverKey+'/meta',{
    key:serverKey,
    name:serverName,
    passHash:passHash,
    createdAt:now,
    hostId:myId,
    hostName:username,
    shortId:shortId,
    visibility:serverType,
    description:serverDesc,
    tags:serverTags,
    deleted:false
  });

  // FIX: Create proper host member object with all required fields
  const hostMemberData={
    uid:myId,
    server_key:serverKey,
    name:username,
    displayName:username,
    username:username,
    lastSeen:now,
    isHost:true,
    createdAt:now,
    email:currentUser?.email||'',
    activity:null,
    inProject:null
  };

  const memberSaved=await fbSet('/servers/'+serverKey+'/members/'+myId,hostMemberData);
  if(!memberSaved){
    console.warn('Member upsert failed, trying plain POST fallback…');
    const _murl=getSrvDbUrl()+'/rest/v1/members';
    const _mdata=_memberToDb(hostMemberData);
    const _mr=await fetch(_murl,{method:'POST',headers:sbHeaders({'Prefer':'return=minimal'}),body:JSON.stringify(_mdata)});
    const _mok=_mr.ok||_mr.status===201||_mr.status===204;
    if(!_mok){const _mt=await _mr.text().catch(()=>'');console.warn('Member fallback failed:',_mr.status,_mt);toast('Warning: member row failed ('+_mr.status+'). Check console.');}
    // Do NOT return — let server creation finish
  }

  // Store reverse-lookup index for short ID joining
  await fbSet('/serverIds/'+shortIdClean,{short_id:shortIdClean,server_key:serverKey});

  const sv={serverKey,serverName,username,isHost:true,myId,shortId};
  addMultiServer(sv);
  startServerHeartbeat(serverKey);

  srvState={...srvState,connected:true,serverKey,serverName,username,isHost:true,myId,activeProjId:null,shortId};
  localStorage.setItem('lms_active_server',JSON.stringify({serverKey,serverName,username,isHost:true,myId,shortId}));
  saveRecentServer(serverName,pass);
  saveCreatedServer(serverName,pass);
  _savePassCache(serverName,pass,getSrvDbUrl(),SRV_ANON_KEY);
  bakInitialSnapshot(serverKey,serverName);
  startSrvHeartbeat();
  renderSrvStatus();
  renderActiveServer();
  toast('Server launched: '+serverName+' ('+multiServers.length+'/'+MAX_SERVERS+')');
  closeServerHub();
  renderRootGrid();
}

// Also add this heartbeat enhancement to detect deleted members
function startSrvHeartbeat(){
  stopSrvPolling();
  if(srvState.isHost)bakStartTimers(srvState.serverKey,srvState.serverName);
  srvState.pollInterval=setInterval(async()=>{
    if(!srvState.connected)return;
    const _hUrl=srvState._dbUrl||getSrvDbUrl();const _hKey=srvState._dbKey||SRV_ANON_KEY;
    const meta=await _withServerCreds(_hUrl,_hKey,()=>fbGet('/servers/'+srvState.serverKey+'/meta'));
    if(!meta||meta.deleted){
      toast('⚠ This server was deleted by the host.');
      stopSrvPolling();
      _srvMetaCache=null;_srvMetaCacheKey=null;srvState={connected:false,serverKey:null,serverName:null,username:null,isHost:false,pollInterval:null,chatPollInterval:null,activeProjId:null,activeTab:'tasks',myId:null,lastChatTs:0,shortId:''};
      localStorage.removeItem('lms_active_server');
      if(document.getElementById('app-shell').classList.contains('visible')){goHome();}
      else{renderRootGrid();}
      return;
    }
    
    // Keep presence alive using this server's own credentials
    await _withServerCreds(_hUrl,_hKey,()=>fbPatch('/servers/'+srvState.serverKey+'/members/'+srvState.myId,{
      lastSeen:Date.now(),
      activity:srvState.activity||null,
      inProject:srvState.activeProjId||null
    }));
    
    if(document.getElementById('server-hub-overlay')?.style.display!=='none'){
      renderActiveServer();
    }
    if(document.getElementById('root-screen-wrap').style.display!=='none'&&srvState.connected){
      renderRootServerProjects();
    }
    if(srvState.activeProjId&&document.getElementById('app-shell').classList.contains('visible')){
      updateSoloPresenceBar();
    }
    if(srvState.activeProjId&&document.getElementById('app-shell').classList.contains('visible')){
      if(document.getElementById('page-chat')?.classList.contains('active')) renderSoloChat();
    }
  },5000);
}

// ---- JOIN BY SERVER ID ----
async function joinServerById(){
  const joinUrlRaw=(document.getElementById('join-supabase-url')?.value||'').trim();
  const joinKeyRaw=(document.getElementById('join-anon-key')?.value||'').trim();
  // Use host's DB credentials — NEVER overwrite the user's own global credentials
  const targetDbUrl=(joinUrlRaw||getSrvDbUrl()).replace(/\/+$/,'');
  const targetDbKey=joinKeyRaw||SRV_ANON_KEY;
  if(!targetDbUrl||!targetDbKey){openSupabaseSetup();return;}

  const username=currentUser?(currentUser.displayName||currentUser.username):'Member';
  const shortIdRaw=document.getElementById('join-server-id').value.trim();
  const pass=document.getElementById('join-password').value;
  if(!shortIdRaw||!pass){toast('Fill all fields');return;}

  toast('Looking up server ID…');
  const shortIdClean=shortIdRaw.toUpperCase().replace(/-/g,'').replace(/[^A-Z0-9]/g,'');
  const serverKey=await _withServerCreds(targetDbUrl,targetDbKey,()=>findServerByShortId(shortIdClean));
  if(!serverKey){toast('Server ID not found — check the ID and credentials');return;}

  const passHash=await hashPass(pass);
  const meta=await _withServerCreds(targetDbUrl,targetDbKey,()=>fbGet('/servers/'+serverKey+'/meta'));
  if(!meta){toast('Server not found');return;}
  if(meta.passHash!==passHash){toast('Wrong password');return;}

  const myId=currentUser?.uid||('user_'+Date.now()+'_'+Math.random().toString(36).slice(2,6));
  const isHost=!!(meta.hostId && meta.hostId===myId);

  // Block non-host from joining private servers
  if(meta.visibility==='private'&&meta.hostId&&meta.hostId!==myId){
    toast('This is a private server — only the owner can access it');
    return;
  }

  // Check multi-server limit
  if(!isConnectedToServer(serverKey)&&multiServers.length>=MAX_SERVERS){
    toast('You already have '+MAX_SERVERS+' servers. Leave one to join another.');
    return;
  }

  await _withServerCreds(targetDbUrl,targetDbKey,()=>fbSet('/servers/'+serverKey+'/members/'+myId,{uid:myId,server_key:serverKey,name:username,displayName:username,username:username,lastSeen:Date.now(),isHost,createdAt:Date.now(),email:currentUser?.email||'',activity:null,inProject:null}));

  // Store per-server credentials — do NOT touch SRV_DB_URL / SRV_ANON_KEY
  const sv={serverKey,serverName:meta.name,username,isHost,myId,shortId:meta.shortId||shortIdRaw,dbUrl:targetDbUrl,dbKey:targetDbKey};
  addMultiServer(sv);
  startServerHeartbeat(serverKey);

  srvState={...srvState,connected:true,serverKey,serverName:meta.name,username,isHost,myId,activeProjId:null,shortId:meta.shortId||shortIdRaw,_dbUrl:targetDbUrl,_dbKey:targetDbKey};
  localStorage.setItem('lms_active_server',JSON.stringify({serverKey,serverName:meta.name,username,isHost,myId,shortId:meta.shortId||shortIdRaw,dbUrl:targetDbUrl,dbKey:targetDbKey}));
  saveRecentServer(meta.name,pass);
  if(isHost)saveCreatedServer(meta.name,pass);
  startSrvHeartbeat();
  renderSrvStatus();
  renderActiveServer();
  toast('Joined server: '+meta.name+(isHost?' [HOST]':''));
  closeServerHub();
  renderRootGrid();
}

// ---- DISCONNECT ----
async function disconnectServer(serverKeyToLeave){
  const key=serverKeyToLeave||srvState.serverKey;
  if(!key)return;
  const sv=getServerById(key)||srvState;
  // Remove member presence
  if(sv.myId)await fbDelete('/servers/'+key+'/members/'+sv.myId);
  removeMultiServer(key);
  // If this was the active session server, clear srvState
  if(srvState.serverKey===key){
    stopSrvPolling();
    _srvMetaCache=null;_srvMetaCacheKey=null;srvState={connected:false,serverKey:null,serverName:null,username:null,isHost:false,pollInterval:null,chatPollInterval:null,activeProjId:null,activeTab:'tasks',myId:null,lastChatTs:0,shortId:''};
    localStorage.removeItem('lms_active_server');
    renderSrvStatus();
    document.getElementById('srv-active-panel').style.display='none';
    document.getElementById('srv-lobby-panel').style.display='block';
  }
  toast('Left server'+(sv.serverName?' "'+sv.serverName+'"':''));
  renderRootGrid();
}


function stopSrvPolling(){
  if(srvState.pollInterval)clearInterval(srvState.pollInterval);
  if(srvState.chatPollInterval)clearInterval(srvState.chatPollInterval);
  srvState.pollInterval=null;srvState.chatPollInterval=null;
  bakStopTimers();
}

// ---- RENDER ACTIVE SERVER ----
let _srvMetaCache=null;
let _srvMetaCacheKey=null;
async function renderActiveServer(refetchMeta=false){
  if(!srvState.connected)return;
  // Load members using this server's credentials
  const _raUrl=srvState._dbUrl||getSrvDbUrl();const _raKey=srvState._dbKey||SRV_ANON_KEY;
  const members=await _withServerCreds(_raUrl,_raKey,()=>fbGet('/servers/'+srvState.serverKey+'/members'))||{};
  const now=Date.now();
  const onlineMs=30000; // 30s = online
  const onlineMembers=Object.entries(members).filter(([id,m])=>m&&m.lastSeen&&(now-m.lastSeen)<onlineMs);

  const memberEl=document.getElementById('srv-members-list');
  const countEl=document.getElementById('srv-member-count');
  document.getElementById('srv-active-name').textContent=srvState.serverName.toUpperCase();
  countEl.textContent=onlineMembers.length+' online';
  // Cache meta — only re-fetch when explicitly needed or switching servers
  if(refetchMeta||_srvMetaCacheKey!==srvState.serverKey||!_srvMetaCache){
    _srvMetaCache=await _withServerCreds(_raUrl,_raKey,()=>fbGet('/servers/'+srvState.serverKey+'/meta'));
    _srvMetaCacheKey=srvState.serverKey;
  }
  const meta=_srvMetaCache;
  const visibility=(meta&&meta.visibility)||'public';
  const srvNameEl=document.getElementById('srv-active-name');
  if(srvNameEl){
    const badge=visibility==='private'
      ?`<span style="font-size:8px;padding:1px 6px;border:1px solid var(--accent5);color:var(--accent5);border-radius:1px;letter-spacing:.08em;margin-left:8px;">🔒 PRIVATE</span>`
      :`<span style="font-size:8px;padding:1px 6px;border:1px solid var(--accent2);color:var(--accent2);border-radius:1px;letter-spacing:.08em;margin-left:8px;">⚡ PUBLIC</span>`;
    srvNameEl.innerHTML=escHtml(srvState.serverName.toUpperCase())+badge;
  }

  // Render server meta info panel
  const metaPanel=document.getElementById('srv-meta-info');
  const metaDescEl=document.getElementById('srv-meta-desc');
  const metaTagsEl=document.getElementById('srv-meta-tags');
  const metaFooterEl=document.getElementById('srv-meta-footer');
  const editMetaBtn=document.getElementById('srv-edit-meta-btn');
  if(metaPanel&&meta){
    const hasDesc=meta.description&&meta.description.trim();
    const hasTags=meta.tags&&meta.tags.length;
    const hasAnyMeta=hasDesc||hasTags||meta.hostName||meta.createdAt;
    metaPanel.style.display=hasAnyMeta?'block':'none';
    if(metaDescEl)metaDescEl.innerHTML=hasDesc?escHtml(meta.description):'';
    if(metaDescEl)metaDescEl.style.display=hasDesc?'block':'none';
    if(metaTagsEl){
      if(hasTags){
        metaTagsEl.innerHTML=meta.tags.map(t=>`<span style="font-size:8px;padding:1px 7px;border-radius:10px;background:rgba(74,240,200,.08);border:1px solid rgba(74,240,200,.25);color:var(--accent2);letter-spacing:.06em;">${escHtml(t)}</span>`).join('');
        metaTagsEl.style.display='flex';
      } else {metaTagsEl.style.display='none';}
    }
    if(metaFooterEl){
      const parts=[];
      if(meta.hostName)parts.push(`<span>⚡ Hosted by <strong style="color:var(--accent);">${escHtml(meta.hostName)}</strong></span>`);
      if(meta.createdAt){const d=new Date(meta.createdAt);parts.push(`<span>Created ${d.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})}</span>`);}
      metaFooterEl.innerHTML=parts.join('<span style="opacity:.3;">·</span>');
    }
    if(editMetaBtn)editMetaBtn.style.display=srvState.isHost?'inline-block':'none';
    // If no meta yet and host, show a prompt to add info
    if(!hasAnyMeta&&srvState.isHost){
      metaPanel.style.display='block';
      if(metaDescEl){metaDescEl.style.display='block';metaDescEl.innerHTML='<span style="color:var(--text3);font-style:italic;">No description yet.</span>';}
      if(editMetaBtn)editMetaBtn.style.display='inline-block';
    }
  } else if(metaPanel){metaPanel.style.display='none';}

  // Show delete server button only for host
  const delSrvBtn=document.getElementById('srv-delete-server-btn');
  if(delSrvBtn)delSrvBtn.style.display=srvState.isHost?'inline-block':'none';
  const chgPwBtn=document.getElementById('srv-change-pw-btn');
  if(chgPwBtn)chgPwBtn.style.display=srvState.isHost?'inline-block':'none';
  // Show server ID if available
  const idWrap=document.getElementById('srv-active-id-wrap');
  const idEl=document.getElementById('srv-active-id');
  if(srvState.shortId&&idWrap&&idEl){
    idWrap.style.display='flex';
    idEl.textContent=srvState.shortId;
  } else if(idWrap){idWrap.style.display='none';}

  memberEl.innerHTML=onlineMembers.map(([id,m])=>
    `<div class="srv-member-badge${id===srvState.myId?' you':''}">${escHtml(m.name)}${m.isHost?' ⚡':''}</div>`
  ).join('');

  // Load projects
  const projects=await _withServerCreds(_raUrl,_raKey,()=>fbGet('/servers/'+srvState.serverKey+'/projects'))||{};
  renderSrvProjectsList(projects);

  // Host: show deletion notifications
  if(srvState.isHost){
    const notifs=await _withServerCreds(_raUrl,_raKey,()=>fbGet('/servers/'+srvState.serverKey+'/hostNotifications'))||{};
    const notifList=Object.entries(notifs).map(([k,v])=>({...v,_key:k})).filter(n=>!n.seen).sort((a,b)=>b.ts-a.ts);
    let notifEl=document.getElementById('srv-host-notifs');
    if(!notifEl){
      notifEl=document.createElement('div');notifEl.id='srv-host-notifs';
      const projPanel=document.getElementById('srv-active-panel');
      if(projPanel)projPanel.insertBefore(notifEl,projPanel.firstChild);
    }
    if(notifList.length){
      notifEl.innerHTML=`<div style="background:rgba(240,160,74,.06);border:1px solid rgba(240,160,74,.3);border-radius:3px;padding:12px 14px;margin-bottom:14px;">
        <div style="font-size:8px;color:var(--accent4);letter-spacing:.2em;margin-bottom:8px;display:flex;align-items:center;gap:8px;">
          ⚠ HOST ALERTS — MEMBER DELETIONS
          <button onclick="clearHostNotifs()" style="margin-left:auto;background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--font);font-size:8px;padding:1px 7px;cursor:pointer;border-radius:1px;letter-spacing:.06em;">Clear All</button>
        </div>
        ${notifList.map(n=>`<div style="padding:5px 0;border-bottom:1px solid rgba(240,160,74,.15);font-size:10px;color:var(--text2);">
          <span style="color:var(--accent3);">${escHtml(n.by)}</span> deleted ${escHtml(n.what)} in <span style="color:var(--accent2);">${escHtml(n.projectName)}</span>
          <span style="color:var(--text3);font-size:9px;margin-left:8px;">${new Date(n.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
        </div>`).join('')}
      </div>`;
    } else {
      notifEl.innerHTML='';
    }
  }
}

async function clearHostNotifs(){
  await fbDelete('/servers/'+srvState.serverKey+'/hostNotifications');
  renderActiveServer();
}

// ---- CHANGE SERVER PASSWORD ----
async function promptChangeServerPassword(serverName,currentPass){
  openModal('Change Server Password',`
    <div style="font-size:9px;color:var(--text3);margin-bottom:10px;letter-spacing:.1em;">Server: <strong style="color:var(--accent);">${escHtml(serverName||srvState.serverName)}</strong></div>
    <label class="modal-label">CURRENT PASSWORD</label>
    <input id="csp-current" class="modal-inp" type="password" placeholder="Current server password" style="margin-bottom:10px;" value="${escHtml(currentPass||'')}">
    <label class="modal-label">NEW PASSWORD</label>
    <input id="csp-new1" class="modal-inp" type="password" placeholder="New server password" style="margin-bottom:10px;">
    <label class="modal-label">CONFIRM NEW PASSWORD</label>
    <input id="csp-new2" class="modal-inp" type="password" placeholder="Confirm new password" style="margin-bottom:10px;">
    <div id="csp-err" style="display:none;background:rgba(240,74,74,.1);border:1px solid var(--accent3);border-radius:2px;padding:8px 12px;font-size:10px;color:var(--accent3);"></div>
  `,[{label:'Cancel',action:closeModal},{label:'Change Password',action:async()=>{
    const cur=document.getElementById('csp-current').value;
    const n1=document.getElementById('csp-new1').value;
    const n2=document.getElementById('csp-new2').value;
    const errEl=document.getElementById('csp-err');
    if(!cur||!n1||!n2){errEl.textContent='Fill in all fields.';errEl.style.display='block';return;}
    if(n1!==n2){errEl.textContent='New passwords do not match.';errEl.style.display='block';return;}
    if(n1.length<4){errEl.textContent='Password must be at least 4 characters.';errEl.style.display='block';return;}
    const srvKey=serverName?hashStr(serverName.toLowerCase()):srvState.serverKey;
    const curHash=await hashPass(cur);
    const meta=await fbGet('/servers/'+srvKey+'/meta');
    if(!meta){errEl.textContent='Server not found.';errEl.style.display='block';return;}
    if(meta.passHash!==curHash){errEl.textContent='Current password is incorrect.';errEl.style.display='block';return;}
    const newHash=await hashPass(n1);
    await fbPatch('/servers/'+srvKey+'/meta',{passHash:newHash});
    // Update localStorage and Firebase cache
    saveCreatedServer(serverName||srvState.serverName,n1);
    closeModal();
    toast('✓ Server password changed!');
    loadCreatedServers();
  },accent:true}]);
}

async function confirmDeleteServer(){
  if(!srvState.isHost){toast('Only the host can delete this server');return;}
  const code=Math.floor(100000+Math.random()*900000)+'';
  openModal('⚠ Delete Server',`
    <div style="background:rgba(240,74,74,.08);border:1px solid var(--accent3);border-radius:2px;padding:10px 12px;margin-bottom:14px;font-size:10px;color:var(--accent3);line-height:1.7;letter-spacing:.04em;">
      ⚠ This will permanently delete <strong>${escHtml(srvState.serverName)}</strong> and ALL projects, members, and data inside it. This cannot be undone.
    </div>
    <p style="font-size:11px;color:var(--text2);margin-bottom:8px;">To confirm, type: <strong style="color:var(--accent3);letter-spacing:.1em;">delete ${escHtml(code)}</strong></p>
    <input class="modal-inp" id="del-srv-inp" placeholder="Type the confirmation above..." autocomplete="off">
  `,[{label:'Cancel',action:closeModal},{label:'Delete Server Forever',action:async()=>{
    const typed=(document.getElementById('del-srv-inp').value||'').trim();
    if(typed!=='delete '+code){toast('Confirmation did not match — cancelled');closeModal();return;}
    toast('Deleting server…');
    bakFreeze(srvState.serverKey);
    // Write tombstone FIRST so connected members detect the deletion
    await fbSet('/servers/'+srvState.serverKey+'/meta/deleted',true);
    await fbSet('/servers/'+srvState.serverKey+'/meta/deletedAt',Date.now());
    // Remove shortId reverse-index
    if(srvState.shortId){
      const clean=srvState.shortId.replace(/-/g,'');
      await fbDelete('/serverIds/'+clean);
    }
    await fbDelete('/servers/'+srvState.serverKey);
    // Remove from "Servers You Created" lists (localStorage + Firebase)
    const deletedName=srvState.serverName;
    const localCreated=JSON.parse(localStorage.getItem('lms_created_servers')||'[]');
    localStorage.setItem('lms_created_servers',JSON.stringify(localCreated.filter(s=>s.name.toLowerCase()!==deletedName.toLowerCase())));
    if(currentUser&&getSrvDbUrl()){
      const fbKey=deletedName.toLowerCase().replace(/[^a-z0-9]/g,'_');
      fbDelete('/accounts/'+currentUser.uid+'/createdServers/'+fbKey).catch(()=>{});
    }
    // Also remove from recent servers
    const localRecent=JSON.parse(localStorage.getItem('lms_recent_servers')||'[]');
    localStorage.setItem('lms_recent_servers',JSON.stringify(localRecent.filter(s=>s.name.toLowerCase()!==deletedName.toLowerCase())));
    closeModal();
    stopSrvPolling();
    removeMultiServer(srvState.serverKey);
    localStorage.removeItem('lms_active_server');
    _srvMetaCache=null;_srvMetaCacheKey=null;srvState={connected:false,serverKey:null,serverName:null,username:null,isHost:false,pollInterval:null,chatPollInterval:null,activeProjId:null,activeTab:'tasks',myId:null,lastChatTs:0,shortId:''};
    closeServerHub();
    renderRootGrid();
    toast('Server deleted');
  },danger:true}]);
}

function renderSrvProjectsList(projects){
  const el=document.getElementById('srv-projects-list');
  const entries=Object.entries(projects);
  let newHtml;
  if(!entries.length){
    newHtml='<div style="font-size:11px;color:var(--text3);padding:16px 0;text-align:center;letter-spacing:.08em;">No projects yet. Create one to get started.</div>';
    if(el.innerHTML!==newHtml)el.innerHTML=newHtml;
    return;
  }
  newHtml=entries.map(([id,proj])=>{
    const tagsHtml=(proj.tags&&proj.tags.length)?proj.tags.map(t=>`<span style="font-size:7px;padding:1px 5px;border-radius:8px;background:rgba(74,240,200,.07);border:1px solid rgba(74,240,200,.2);color:var(--accent2);letter-spacing:.05em;">${escHtml(t)}</span>`).join(''):'';
    const createdDate=proj.createdAt?new Date(proj.createdAt).toLocaleDateString([],{month:'short',day:'numeric'}):'';
    return`<div class="srv-proj-card" onclick="openSrvProject('${id}')">
      <div style="width:8px;height:8px;border-radius:50%;background:${escHtml(proj.color||'#c8f04a')};flex-shrink:0;margin-top:3px;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;color:var(--text);font-family:var(--vt);letter-spacing:.05em;">${escHtml(proj.name)}</div>
        ${proj.desc?`<div style="font-size:9px;color:var(--text2);margin-top:2px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(proj.desc)}">${escHtml(proj.desc)}</div>`:''}
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
          <span style="font-size:9px;color:var(--text3);">${Object.keys(proj.tasks||{}).length} tasks · ${Object.keys(proj.bugs||{}).length} bugs</span>
          ${proj.createdBy?`<span style="font-size:8px;color:var(--text3);">by <strong style="color:var(--accent);font-weight:normal;">${escHtml(proj.createdBy)}</strong></span>`:''}
          ${createdDate?`<span style="font-size:8px;color:var(--text3);">${createdDate}</span>`:''}
        </div>
        ${tagsHtml?`<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:4px;">${tagsHtml}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
        <div style="font-size:9px;color:var(--text3);">→</div>
        ${srvState.isHost?`<button onclick="event.stopPropagation();openEditProjectMeta('${id}')" style="background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--font);font-size:7px;padding:1px 6px;cursor:pointer;border-radius:1px;letter-spacing:.06em;" onmouseover="this.style.color='var(--accent)';this.style.borderColor='var(--accent)'" onmouseout="this.style.color='var(--text3)';this.style.borderColor='var(--border2)'">✎</button>`:''}
        ${srvState.isHost?`<button onclick="event.stopPropagation();deleteSrvProject('${id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-family:var(--font);font-size:11px;padding:2px 4px;" onmouseover="this.style.color='var(--accent3)'" onmouseout="this.style.color='var(--text3)'">×</button>`:''}
      </div>
    </div>`;
  }).join('');
  if(el.innerHTML!==newHtml)el.innerHTML=newHtml;
}

// ---- SOLO SHELL TEAM CHAT (server mode) ----
async function renderSoloChat(){
  if(!srvState.connected||!srvState.activeProjId)return;
  const chat=await fbGet('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/chat')||{};
  const msgs=Object.values(chat).sort((a,b)=>a.ts-b.ts);
  const el=document.getElementById('solo-chat-msgs');if(!el)return;
  el.innerHTML=msgs.map(m=>{
    const mine=m.uid===srvState.myId;
    return`<div class="srv-msg${mine?' mine':' theirs'}">
      ${!mine?`<div class="srv-msg-name">${escHtml(m.name)}</div>`:''}
      <div class="srv-msg-text">${escHtml(m.text)}</div>
      <div class="srv-msg-time">${new Date(m.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
    </div>`;
  }).join('');
  el.scrollTop=el.scrollHeight;
}

async function sendSoloSrvMsg(){
  const inp=document.getElementById('solo-chat-inp');if(!inp)return;
  const text=inp.value.trim();if(!text)return;
  inp.value='';
  const id='msg_'+Date.now();
  await fbSet('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/chat/'+id,{id,text,name:srvState.username,uid:srvState.myId,ts:Date.now()});
  await srvBroadcastActivity('chatting');
  renderSoloChat();
}

// ---- RENDER SERVER PROJECTS ON ROOT SCREEN ----
async function renderRootServerProjects(){
  if(!srvState.connected)return;
  const grid=document.getElementById('rs-server-proj-grid');
  const empty=document.getElementById('rs-server-proj-empty');
  // Only show skeleton on first load (grid is empty), never on poll refreshes
  const isFirstLoad=grid&&grid.innerHTML.trim()==='';
  if(isFirstLoad){
    grid.innerHTML=`
      <div class="skeleton-card">
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;">
          <div class="skeleton-circle"></div>
          <div style="flex:1;"><div class="skeleton-line" style="width:62%;height:13px;margin-bottom:6px;"></div><div class="skeleton-line" style="width:40%;height:8px;"></div></div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px;"><div class="skeleton-stat"></div><div class="skeleton-stat"></div><div class="skeleton-stat"></div><div class="skeleton-stat"></div></div>
        <div class="skeleton-line" style="height:3px;width:100%;margin-bottom:4px;"></div>
        <div class="skeleton-line" style="width:33%;height:7px;"></div>
      </div>
      <div class="skeleton-card" style="animation-delay:.12s;">
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;">
          <div class="skeleton-circle"></div>
          <div style="flex:1;"><div class="skeleton-line" style="width:50%;height:13px;margin-bottom:6px;"></div><div class="skeleton-line" style="width:38%;height:8px;"></div></div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px;"><div class="skeleton-stat"></div><div class="skeleton-stat"></div><div class="skeleton-stat"></div><div class="skeleton-stat"></div></div>
        <div class="skeleton-line" style="height:3px;width:100%;margin-bottom:4px;"></div>
        <div class="skeleton-line" style="width:28%;height:7px;"></div>
      </div>`;
    if(empty)empty.style.display='none';
  }
  const projects=await fbGet('/servers/'+srvState.serverKey+'/projects')||{};
  const members=await fbGet('/servers/'+srvState.serverKey+'/members')||{};
  const now=Date.now();
  const online=Object.entries(members).filter(([id,m])=>m&&m.lastSeen&&(now-m.lastSeen)<30000);
  const presEl=document.getElementById('rs-srv-presence');
  if(presEl){
    presEl.innerHTML=online.map(([id,m])=>`<div style="display:flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;border:1px solid ${id===srvState.myId?'var(--accent)':'var(--accent2)'};font-size:9px;color:${id===srvState.myId?'var(--accent)':'var(--accent2)'};letter-spacing:.06em;"><div style="width:4px;height:4px;border-radius:50%;background:currentColor;flex-shrink:0;"></div>${escHtml(m.name)}${m.isHost?' ⚡':''}</div>`).join('');
    const cnt=document.getElementById('rs-srv-members');if(cnt)cnt.textContent=online.length+' online';
  }
  if(!grid)return;
  const entries=Object.entries(projects);
  if(!entries.length){grid.innerHTML='';if(empty)empty.style.display='block';return;}
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
            <span>${escHtml(srvState.serverName||'server')}</span>
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
        <button class="rc-action-btn" onclick="event.stopPropagation();exportServerRoot('${id}')">Export</button>
        ${srvState.isHost?`<button class="rc-action-btn" onclick="event.stopPropagation();openEditProjectMeta('${id}')">✎ Info</button>`:''}
        ${srvState.isHost?`<button class="rc-action-btn" onclick="event.stopPropagation();deleteSrvProject('${id}')" style="color:var(--accent3);">Delete</button>`:''}
      </div>`;
    card.addEventListener('click',()=>openSrvProject(id));
    frag.appendChild(card);
  });
  const newGridHtml=frag.children.length?Array.from(frag.children).map(c=>c.outerHTML).join(''):'';
  if(grid.innerHTML!==newGridHtml){grid.innerHTML='';grid.appendChild(frag);}
}

// ---- PROMPT PUBLISH TO SERVER (when not connected/host) ----
function promptPublishToServer(rootId){
  const root=roots.find(r=>r.id===rootId);
  if(!root)return;
  if(!getSrvDbUrl()){
    openModal('Publish to Server',`<p style="font-size:11px;color:var(--text2);line-height:1.7;margin-bottom:10px;">To publish <strong style="color:var(--accent);">${escHtml(root.name)}</strong> to a server, you first need to configure a Supabase database and connect to or host a server.</p>`,[
      {label:'Cancel',action:closeModal},{label:'⚙ DB Setup',action:()=>{closeModal();openSupabaseSetup();},accent:true}
    ]);
    return;
  }
  if(!srvState.connected){
    openModal('Publish to Server',`<p style="font-size:11px;color:var(--text2);line-height:1.7;margin-bottom:10px;">To publish <strong style="color:var(--accent);">${escHtml(root.name)}</strong> to a server, you need to host or join a server first as the host.</p>`,[
      {label:'Cancel',action:closeModal},{label:'⚡ Open Server Hub',action:()=>{closeModal();openServerHub();},accent:true}
    ]);
    return;
  }
  if(!srvState.isHost){
    openModal('Publish to Server',`<p style="font-size:11px;color:var(--text2);line-height:1.7;">Only the server host can publish projects. You are currently a member of <strong style="color:var(--accent2);">${escHtml(srvState.serverName)}</strong>.</p>`,[
      {label:'OK',action:closeModal}
    ]);
    return;
  }
  hostExistingProjectOnServer(rootId);
}

// ---- HOST EXISTING LOCAL PROJECT ON SERVER ----
async function hostExistingProjectOnServer(rootId){
  if(!srvState.connected||!srvState.isHost){toast('Connect as host first');return;}
  const root=roots.find(r=>r.id===rootId);
  if(!root){toast('Project not found');return;}
  const data=getRootData(rootId);
  openModal('Host "'+root.name+'" on Server',`
    <p style="font-size:11px;color:var(--text2);line-height:1.7;margin-bottom:12px;">This will create a server copy of <strong style="color:var(--accent);">${escHtml(root.name)}</strong> on <strong style="color:var(--accent2);">${escHtml(srvState.serverName)}</strong>.<br>Your local project stays untouched.</p>
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:2px;padding:10px 12px;font-size:10px;color:var(--text3);">📋 ${(data.scripts||[]).length} scripts · ${(data.bugs||[]).length} bugs · ${(data.assets||[]).length} assets will be copied</div>
  `,[{label:'Cancel',action:closeModal},{label:'⚡ Host It',action:async()=>{
    closeModal();
    toast('Uploading to server…');
    const id='proj_'+Date.now();
    const bugs={};(data.bugs||[]).forEach((b,i)=>{bugs[b.id||'bug_'+i]=b;});
    const proj={id,name:root.name,color:root.color||'#4af0c8',desc:root.engine||'',createdBy:srvState.username,createdAt:Date.now(),tasks:{},notes:{},bugs,versions:{},chat:{},phases:data.customPhases||{main:[],sub:[]},phaseData:{},folders:data.folders||[],scripts:data.scripts||[],sessions:data.sessions||[],scenes:data.scenes||[],sceneFolders:data.sceneFolders||[],gddSections:data.gddSections||[],assets:data.assets||[]};
    await fbSet('/servers/'+srvState.serverKey+'/projects/'+id,proj);
    await srvBroadcastActivity('hosted project: '+root.name.substring(0,25));
    toast('Project live on server!');
    renderRootGrid();
  },accent:true}]);
}

// ---- CREATE SERVER PROJECT ----
function openCreateServerProject(){
  const colors=['#c8f04a','#4af0c8','#f04a4a','#f0a04a','#a04af0','#4a9af0'];
  let selCol=colors[Math.floor(Math.random()*colors.length)];
  openModal('New Server Project',`
    <label class="modal-label">Project Name</label>
    <input class="modal-inp" id="sp-name" placeholder="e.g. Main Build, Design Sprint, Hotfix">
    <label class="modal-label">What is this project for? <span style="color:var(--text3);font-weight:normal;">(optional)</span></label>
    <textarea class="modal-inp" id="sp-desc" placeholder="e.g. Core gameplay loop implementation — targeting alpha by end of sprint." style="height:60px;resize:vertical;line-height:1.5;font-size:10px;margin-bottom:10px;"></textarea>
    <label class="modal-label">Tags <span style="color:var(--text3);font-weight:normal;">(optional, comma-separated)</span></label>
    <input class="modal-inp" id="sp-tags" placeholder="e.g. gameplay, ui, sprint-2, bugfix" style="margin-bottom:10px;">
    <label class="modal-label">Color</label>
    <div style="display:flex;gap:8px;margin-bottom:12px;">${colors.map(c=>`<div onclick="document.querySelectorAll('.sc-col').forEach(x=>x.style.outline='none');this.style.outline='2px solid #fff';document.getElementById('sp-color-val').value='${c}'" class="sc-col" style="width:22px;height:22px;border-radius:50%;background:${c};cursor:pointer;outline:${c===selCol?'2px solid #fff':'none'};"></div>`).join('')}</div>
    <input type="hidden" id="sp-color-val" value="${selCol}">
  `,[{label:'Cancel',action:closeModal},{label:'Create',action:createSrvProject,accent:true}]);
}

async function createSrvProject(){
  const name=document.getElementById('sp-name').value.trim();if(!name)return;
  const color=document.getElementById('sp-color-val').value;
  const desc=(document.getElementById('sp-desc').value||'').trim();
  const tags=(document.getElementById('sp-tags').value||'').trim().split(',').map(t=>t.trim()).filter(Boolean);
  const id='proj_'+Date.now();
  const proj={id,name,color,desc,tags,createdBy:srvState.username,createdByUid:srvState.myId||'',createdAt:Date.now(),tasks:{},notes:{},bugs:{},versions:{},chat:{},phases:{main:[],sub:[]},phaseData:{},folders:[],scripts:[],sessions:[],scenes:[],sceneFolders:[],gddSections:[],assets:[]};
  await fbSet('/servers/'+srvState.serverKey+'/projects/'+id,proj);
  closeModal();
  toast('Project created: '+name);
  renderActiveServer();
  renderRootGrid();
  renderRootServerProjects();
}

// ---- EDIT SOLO PROJECT INFO ----
function openEditSoloProjectInfo(rootId){
  const root=roots.find(r=>r.id===rootId);
  if(!root){toast('Project not found');return;}
  const currentTags=(root.tags||[]).join(', ');
  openModal('Edit Project Info: '+escHtml(root.name),`
    <label class="modal-label">Description</label>
    <textarea class="modal-inp" id="espi-desc" placeholder="What is this project about?" style="height:80px;resize:vertical;line-height:1.5;font-size:10px;">${escHtml(root.description||root.desc||'')}</textarea>
    <label class="modal-label">Tags <span style="color:var(--text3);font-weight:normal;">(comma-separated)</span></label>
    <input class="modal-inp" id="espi-tags" placeholder="e.g. godot, horror, jam, solo" value="${escHtml(currentTags)}">
  `,[{label:'Cancel',action:closeModal},{label:'Save',action:()=>{
    const desc=(document.getElementById('espi-desc').value||'').trim();
    const tags=(document.getElementById('espi-tags').value||'').trim().split(',').map(t=>t.trim()).filter(Boolean);
    const idx=roots.findIndex(r=>r.id===rootId);
    if(idx===-1){toast('Project not found');return;}
    roots[idx].description=desc;
    roots[idx].tags=tags;
    saveRoots();
    closeModal();toast('Project info updated');renderRootGrid();
  },accent:true}]);
}

// ---- EDIT SERVER META (host only) ----
async function openEditServerMeta(){
  if(!srvState.isHost){toast('Only the host can edit server info');return;}
  const _raUrl=srvState._dbUrl||getSrvDbUrl();const _raKey=srvState._dbKey||SRV_ANON_KEY;
  const meta=await _withServerCreds(_raUrl,_raKey,()=>fbGet('/servers/'+srvState.serverKey+'/meta'))||{};
  const currentTags=(meta.tags||[]).join(', ');
  openModal('Edit Server Info',`
    <label class="modal-label">Server Description</label>
    <textarea class="modal-inp" id="esm-desc" placeholder="What is this server for? Team, project type, goals…" style="height:80px;resize:vertical;line-height:1.5;font-size:10px;">${escHtml(meta.description||'')}</textarea>
    <label class="modal-label">Tags <span style="color:var(--text3);font-weight:normal;">(comma-separated)</span></label>
    <input class="modal-inp" id="esm-tags" placeholder="e.g. godot, horror, jam, team" value="${escHtml(currentTags)}">
  `,[{label:'Cancel',action:closeModal},{label:'Save',action:async()=>{
    const desc=(document.getElementById('esm-desc').value||'').trim();
    const tags=(document.getElementById('esm-tags').value||'').trim().split(',').map(t=>t.trim()).filter(Boolean);
    await _withServerCreds(_raUrl,_raKey,()=>fbPatch('/servers/'+srvState.serverKey+'/meta',{description:desc,tags}));
    closeModal();toast('Server info updated');_srvMetaCache=null;renderActiveServer(true);
  },accent:true}]);
}

// ---- EDIT PROJECT META (host only, active server) ----
async function openEditProjectMeta(projId){
  if(!srvState.isHost){toast('Only the host can edit project info');return;}
  const _rUrl=srvState._dbUrl||getSrvDbUrl();const _rKey=srvState._dbKey||SRV_ANON_KEY;
  const proj=await _withServerCreds(_rUrl,_rKey,()=>fbGet('/servers/'+srvState.serverKey+'/projects/'+projId));
  if(!proj){toast('Project not found');return;}
  const currentTags=(proj.tags||[]).join(', ');
  openModal('Edit Project Info: '+escHtml(proj.name),`
    <label class="modal-label">Description</label>
    <textarea class="modal-inp" id="epm-desc" placeholder="What is this project for? Goals, scope, sprint…" style="height:80px;resize:vertical;line-height:1.5;font-size:10px;">${escHtml(proj.desc||'')}</textarea>
    <label class="modal-label">Tags <span style="color:var(--text3);font-weight:normal;">(comma-separated)</span></label>
    <input class="modal-inp" id="epm-tags" placeholder="e.g. gameplay, ui, sprint-2, bugfix" value="${escHtml(currentTags)}">
  `,[{label:'Cancel',action:closeModal},{label:'Save',action:async()=>{
    const desc=(document.getElementById('epm-desc').value||'').trim();
    const tags=(document.getElementById('epm-tags').value||'').trim().split(',').map(t=>t.trim()).filter(Boolean);
    await _withServerCreds(_rUrl,_rKey,()=>fbPatch('/servers/'+srvState.serverKey+'/projects/'+projId,{desc,tags}));
    closeModal();toast('Project info updated');renderActiveServer(true);renderRootServerProjects();
  },accent:true}]);
}

// ---- EDIT PROJECT META for a specific server (multi-server) ----
async function openEditProjectMetaFor(serverKey,projId){
  const sv=getServerById(serverKey);
  if(!sv||!sv.isHost){toast('Only the host can edit project info');return;}
  const origState={...srvState};
  srvState={...srvState,connected:true,serverKey:sv.serverKey,serverName:sv.serverName,isHost:true,myId:sv.myId,_dbUrl:sv.dbUrl||null,_dbKey:sv.dbKey||null};
  await openEditProjectMeta(projId);
  // Restore after modal opens (modal is async so srvState will be used inside)
  // We restore on close via renderActiveServer which re-reads srvState
}

async function deleteSrvProject(id){
  if(!srvState.isHost){toast('Only the host can delete projects');return;}
  const proj=speProjData&&speProjData.id===id?speProjData:(await fbGet('/servers/'+srvState.serverKey+'/projects/'+id));
  const projName=proj?.name||'this project';
  const code=Math.floor(100000+Math.random()*900000)+'';
  openModal('⚠ Delete Server Project',`
    <div style="background:rgba(240,74,74,.08);border:1px solid var(--accent3);border-radius:2px;padding:10px 12px;margin-bottom:14px;font-size:10px;color:var(--accent3);line-height:1.7;letter-spacing:.04em;">
      ⚠ This will permanently delete <strong>${escHtml(projName)}</strong> and ALL its data from the server. This cannot be undone.
    </div>
    <p style="font-size:11px;color:var(--text2);margin-bottom:8px;">To confirm, type: <strong style="color:var(--accent3);letter-spacing:.1em;">delete ${escHtml(code)}</strong></p>
    <input class="modal-inp" id="del-confirm-inp" placeholder="Type the confirmation above..." autocomplete="off">
  `,[{label:'Cancel',action:closeModal},{label:'Delete Forever',action:async()=>{
    const typed=(document.getElementById('del-confirm-inp').value||'').trim();
    if(typed!=='delete '+code){toast('Confirmation text did not match — cancelled');closeModal();return;}
    await fbDelete('/servers/'+srvState.serverKey+'/projects/'+id);
    // Notify host dashboard
    await fbPush('/servers/'+srvState.serverKey+'/notifications',{type:'project_deleted',projectName:projName,by:srvState.username,ts:Date.now()});
    closeModal();toast('Project deleted');renderActiveServer();renderRootGrid();
  },danger:true}]);
}