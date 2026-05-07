// LMS Dev Hub — init.js
// App initialization — must be loaded LAST

loadSettings();
loadRoots();
// Restore session or show login
(async function initApp(){
  const session=localStorage.getItem('lms_session');
  if(session){
    try{
      currentUser=JSON.parse(session);
      // Only verify against Firebase if we actually have a DB URL configured
      // If Firebase is unreachable, we trust the local session — don't log them out
      if(currentUser?.uid){
        try{
          // Look up by username — uid in localStorage may be stale/wrong on new devices
          const allAccounts=await fbGet('/accounts')||{};
          const acc=Object.values(allAccounts).find(a=>a.username===currentUser.username)||null;
          if(acc){
            currentUser.uid=acc.uid; // Always sync uid from DB — this is what host_id is keyed on
            currentUser.displayName=acc.displayName||acc.username||currentUser.displayName;
            currentUser.email=acc.email||currentUser.email||'';
            currentUser.username=acc.username||currentUser.username;
            localStorage.setItem('lms_session',JSON.stringify(currentUser));
          }
          // If acc is null: Firebase returned null but was reachable —
          // the account genuinely does not exist in the database.
          // Flag this so the Server Hub can warn the user.
          if(!acc) window._accountMissingFromDb = true;
        }catch(fbErr){
          // Firebase fetch failed (network error, CORS, etc.) — trust local session
        }
      }
    }catch(e){currentUser=null;}
  }
  if(currentUser){
    document.getElementById('login-screen').style.display='none';
    document.getElementById('root-screen-wrap').style.display='block';
    // Attempt to restore server connection from previous session
    const savedSrv=localStorage.getItem('lms_active_server');
    if(savedSrv){
      try{
        const sv=JSON.parse(savedSrv);
        // Verify server still exists — MUST use the server's own DB credentials (sv.dbUrl),
        // NOT the member's own getSrvDbUrl(). Using the wrong DB is why members see "not found" on refresh.
        const _restoreUrl=(CFG_URL).replace(/\/+$/,'');
        const _restoreKey=CFG_KEY;
        const meta=await _withServerCreds(_restoreUrl,_restoreKey,()=>fbGet('/servers/'+sv.serverKey+'/meta'));
        if(meta){
          // Re-register presence
          const isHost=!!(meta.hostId&&meta.hostId===sv.myId);
          const username=sv.username||(currentUser?(currentUser.displayName||currentUser.username):'Member');
          await _withServerCreds(CFG_URL,CFG_KEY,()=>
            fbSet('/servers/'+sv.serverKey+'/members/'+sv.myId,{
              uid:sv.myId,server_key:sv.serverKey,name:username,displayName:username,
              username:currentUser?.username||username,lastSeen:Date.now(),
              isHost,email:currentUser?.email||'',activity:null,inProject:null
            })
          );
          // Restore multiServers slot so the member can re-enter projects
          const restoredSv={serverKey:sv.serverKey,serverName:meta.name,username,isHost,myId:sv.myId,shortId:sv.shortId||meta.shortId||'',dbUrl:sv.dbUrl||null,dbKey:sv.dbKey||null};
          if(!multiServers.find(s=>s.serverKey===sv.serverKey))addMultiServer(restoredSv);
          srvState={...srvState,connected:true,serverKey:sv.serverKey,serverName:meta.name,username,isHost,myId:sv.myId,activeProjId:null,shortId:sv.shortId||meta.shortId||'',_dbUrl:sv.dbUrl||null,_dbKey:sv.dbKey||null};
          startSrvHeartbeat();
        } else {
          localStorage.removeItem('lms_active_server');
        }
      }catch(e){localStorage.removeItem('lms_active_server');}
    }
    renderRootGrid();
    updateAccountChip();
    addLogoutBtn();
    renderRootMyServers();
    // If account was not found in the database, warn the user immediately
    if(window._accountMissingFromDb){
      setTimeout(()=>toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Account not found in database — open Server Hub for details'),800);
    }
    // Load multi-server connections
    const _priorCount=multiServers.length;loadMultiServers().then(()=>{if(multiServers.length>_priorCount)renderRootGrid();});
  } else {
    document.getElementById('login-screen').style.display='flex';
    if(false){
      document.getElementById('login-db-warning').style.display='block';
      const btn=document.getElementById('login-db-setup-btn');
      if(btn){btn.style.color='var(--accent2)';btn.style.borderColor='var(--accent2)';btn.style.boxShadow='0 0 10px rgba(74,240,200,.15)';}
      setTimeout(()=>openSupabaseSetup(), 300);
    }
  }
})();

// Simple hash for server name → firebase key
function hashStr(str){
  let h=5381;for(let i=0;i<str.length;i++)h=(h*33^str.charCodeAt(i))>>>0;
  return'srv_'+h.toString(36);
}

// Generate a short alphanumeric server ID (e.g. "XK9-4TM")
function genServerId(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id='';for(let i=0;i<7;i++){if(i===3)id+='-';id+=chars[Math.floor(Math.random()*chars.length)];}
  return id;
}

// Find a serverKey from a short server ID
async function findServerByShortId(shortId){
  const clean=shortId.toUpperCase().replace(/-/g,'');
  const row=await fbGet('/serverIds/'+clean);
  return row?row.server_key:null;
}

// SHA-256 password hash (async)
async function hashPass(pass){
  const enc=new TextEncoder();
  const buf=await crypto.subtle.digest('SHA-256',enc.encode(pass));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}