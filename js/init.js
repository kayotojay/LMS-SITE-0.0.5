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
      if(getSrvDbUrl()&&currentUser?.uid){
        try{
          const acc=await fbGet('/accounts/'+currentUser.uid);
          if(acc){
            // Refresh display name and email from server
            currentUser.displayName=acc.displayName||acc.username||currentUser.displayName;
            currentUser.email=acc.email||currentUser.email||'';
            currentUser.username=acc.username||currentUser.username;
            localStorage.setItem('lms_session',JSON.stringify(currentUser));
          }
          // If acc is null: Firebase returned null but was reachable.
          // Could be a migration or data issue — still trust the local session.
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
    if(savedSrv&&getSrvDbUrl()){
      try{
        const sv=JSON.parse(savedSrv);
        // Verify server still exists
        const meta=await fbGet('/servers/'+sv.serverKey+'/meta');
        if(meta){
          // Re-register presence
          const isHost=!!(meta.hostId&&meta.hostId===sv.myId);
          await fbSet('/servers/'+sv.serverKey+'/members/'+sv.myId,{name:sv.username,lastSeen:Date.now(),isHost,uid:sv.myId});
          srvState={...srvState,connected:true,serverKey:sv.serverKey,serverName:meta.name,username:sv.username,isHost,myId:sv.myId,activeProjId:null,shortId:sv.shortId||meta.shortId||'',_dbUrl:sv.dbUrl||null,_dbKey:sv.dbKey||null};
          startSrvHeartbeat();
        } else {
          localStorage.removeItem('lms_active_server');
        }
      }catch(e){localStorage.removeItem('lms_active_server');}
    }
    renderRootGrid();
    updateAccountChip();
    addLogoutBtn();
    // Load multi-server connections
    if(getSrvDbUrl()) loadMultiServers().then(()=>{if(multiServers.length>0)renderRootGrid();});
  } else {
    document.getElementById('login-screen').style.display='flex';
    if(!getSrvDbUrl()||!SRV_ANON_KEY){
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
