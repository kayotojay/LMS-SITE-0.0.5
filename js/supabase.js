// LMS Dev Hub — supabase.js
// ========================================

// =====================================================
// Supabase config — SHARED hosted DB (no per-user setup needed)
// All servers, members, projects, and email codes live here.
// =====================================================
const CFG_URL = 'https://plhsoqnpaupqsvlgnynk.supabase.co';
const CFG_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsaHNvcW5wYXVwcXN2bGdueW5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDM3NzAsImV4cCI6MjA5MzAxOTc3MH0.sLh1Fgu9IXsHtZ2irkEwrn7IqXIYxSd0CCH-5W7Sr-4';
// Force-overwrite any stale personal DB credentials from previous versions.
// Everyone uses the shared DB now — wipe old keys so nothing reads them.
(function(){
  try {
    localStorage.removeItem('lms_db_url');
    localStorage.removeItem('lms_anon_key');
    // Also clear any saved server slots that had old dbUrl/dbKey embedded
    const saved = localStorage.getItem('lms_multi_servers');
    if(saved){
      const arr = JSON.parse(saved);
      const cleaned = arr.map(s => {
        const {dbUrl, dbKey, ...rest} = s;
        return rest;
      });
      localStorage.setItem('lms_multi_servers', JSON.stringify(cleaned));
    }
    const activeSrv = localStorage.getItem('lms_active_server');
    if(activeSrv){
      const sv = JSON.parse(activeSrv);
      delete sv.dbUrl; delete sv.dbKey;
      localStorage.setItem('lms_active_server', JSON.stringify(sv));
    }
  } catch(e) {}
})();


// SRV_DB_URL / SRV_ANON_KEY always point to the shared DB — no user config required.
let SRV_DB_URL  = CFG_URL;
let SRV_ANON_KEY= CFG_KEY;

// Compat shims — code that used to read personal DB creds now gets the shared DB.
function getOwnDbUrl(){ return CFG_URL; }
function getOwnDbKey(){ return CFG_KEY; }
function ownDbCreds(){ return { url: CFG_URL, key: CFG_KEY }; }

/* Cached SQL — populated on modal open */
var _cfgSql = { fresh: null, update: null };

async function fetchSqlScripts(){
  try{
    const r = await fetch(
      CFG_URL + '/rest/v1/sql_scripts?select=type,sql&order=type',
      { headers:{ 'apikey': CFG_KEY, 'Authorization': 'Bearer ' + CFG_KEY } }
    );
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const rows = await r.json();
    rows.forEach(function(row){
      if(row.type === 'fresh')  _cfgSql.fresh  = row.sql;
      if(row.type === 'update') _cfgSql.update = row.sql;
    });
  } catch(e){
    console.warn('LMS: could not fetch SQL scripts from config project', e);
  }
}

/* Call once when the page loads so SQL is ready before the modal opens */
fetchSqlScripts();

function getSrvDbUrl(){ return CFG_URL; }
function setSrvDbUrl(url){ /* no-op — shared DB is hardcoded */ }
function sbHeaders(extra){
  return Object.assign({'Content-Type':'application/json','apikey':CFG_KEY,'Authorization':'Bearer '+CFG_KEY},extra||{});
}

// All server contexts use the shared DB — cred resolution is a no-op.
function _activeSrvCreds(){ return { url: CFG_URL, key: CFG_KEY }; }

// Stack kept for API compat but always resolves to shared DB creds.
const _srvCredsStack = [];
function _pushSrvCreds(url, key){ _srvCredsStack.push({ url: CFG_URL, key: CFG_KEY }); }
function _popSrvCreds(){ _srvCredsStack.pop(); }
function _topSrvCreds(){ return _srvCredsStack.length ? _srvCredsStack[_srvCredsStack.length-1] : null; }

async function _withServerCreds(dbUrl, dbKey, fn){
  _pushSrvCreds(CFG_URL, CFG_KEY);
  try { return await fn({ url: CFG_URL, key: CFG_KEY }); }
  finally { _popSrvCreds(); }
}

function _resolveDbCreds(){ return { url: CFG_URL, key: CFG_KEY }; }

let srvState = {
  connected: false,
  serverKey: null,
  serverName: null,
  username: null,
  isHost: false,
  pollInterval: null,
  chatPollInterval: null,
  activeProjId: null,
  activeTab: 'tasks',
  myId: null,
  lastChatTs: 0,
  shortId: '',
  // Per-server DB credentials — always the shared DB now
  _dbUrl: CFG_URL,
  _dbKey: CFG_KEY,
};

// Multi-server support — up to 5 simultaneous server connections
let multiServers = [];
const MAX_SERVERS = 5;

function saveMultiServers(){
  try{localStorage.setItem('lms_multi_servers',JSON.stringify(multiServers.map(s=>({serverKey:s.serverKey,serverName:s.serverName,username:s.username,isHost:s.isHost,myId:s.myId,shortId:s.shortId}))));} catch(e){}
}
async function loadMultiServers(){
  try{
    const saved=localStorage.getItem('lms_multi_servers');
    if(!saved)return;
    const arr=JSON.parse(saved);
    for(const sv of arr){
      const meta=await _withServerCreds(CFG_URL,CFG_KEY,()=>fbGet('/servers/'+sv.serverKey+'/meta'));
      if(meta&&!meta.deleted){
        if(!multiServers.find(s=>s.serverKey===sv.serverKey))multiServers.push({...sv,dbUrl:CFG_URL,dbKey:CFG_KEY,pollInterval:null});
        await _withServerCreds(CFG_URL,CFG_KEY,()=>fbSet('/servers/'+sv.serverKey+'/members/'+sv.myId,{uid:sv.myId,server_key:sv.serverKey,name:sv.username,displayName:sv.username,username:sv.username,isHost:sv.isHost,lastSeen:Date.now(),activity:null,inProject:null}));
      }
    }
    saveMultiServers();
  }catch(e){}
}

function getServerById(serverKey){return multiServers.find(s=>s.serverKey===serverKey)||null;}
function isConnectedToServer(serverKey){return multiServers.some(s=>s.serverKey===serverKey);}

function addMultiServer(sv){
  if(multiServers.length>=MAX_SERVERS){
    toast('You already have '+MAX_SERVERS+' servers. Leave one to add another.');
    return false;
  }
  const existing=multiServers.findIndex(s=>s.serverKey===sv.serverKey);
  if(existing>=0)multiServers[existing]={...sv,dbUrl:CFG_URL,dbKey:CFG_KEY,pollInterval:multiServers[existing].pollInterval};
  else multiServers.push({...sv,dbUrl:CFG_URL,dbKey:CFG_KEY,pollInterval:null});
  saveMultiServers();
  return true;
}

function removeMultiServer(serverKey){
  const idx=multiServers.findIndex(s=>s.serverKey===serverKey);
  if(idx>=0){
    if(multiServers[idx].pollInterval)clearInterval(multiServers[idx].pollInterval);
    multiServers.splice(idx,1);
    saveMultiServers();
  }
}

function startServerHeartbeat(serverKey){
  const sv=getServerById(serverKey);
  if(!sv)return;
  if(sv.pollInterval)clearInterval(sv.pollInterval);
  sv.pollInterval=setInterval(async()=>{
    const meta=await _withServerCreds(CFG_URL,CFG_KEY,()=>fbGet('/servers/'+serverKey+'/meta'));
    if(!meta||meta.deleted){
      toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Server "'+sv.serverName+'" was deleted by the host.');
      const localCreated=JSON.parse(localStorage.getItem('lms_created_servers')||'[]');
      localStorage.setItem('lms_created_servers',JSON.stringify(localCreated.filter(s=>s.name.toLowerCase()!==sv.serverName?.toLowerCase())));
      const localRecent=JSON.parse(localStorage.getItem('lms_recent_servers')||'[]');
      localStorage.setItem('lms_recent_servers',JSON.stringify(localRecent.filter(s=>s.name.toLowerCase()!==sv.serverName?.toLowerCase())));
      removeMultiServer(serverKey);
      if(srvState.connected&&srvState.serverKey===serverKey){
        _srvMetaCache=null;_srvMetaCacheKey=null;srvState={connected:false,serverKey:null,serverName:null,username:null,isHost:false,pollInterval:null,chatPollInterval:null,activeProjId:null,activeTab:'tasks',myId:null,lastChatTs:0,shortId:'',_dbUrl:CFG_URL,_dbKey:CFG_KEY};
        localStorage.removeItem('lms_active_server');
        if(document.getElementById('app-shell').classList.contains('visible'))goHome();
        else renderRootGrid();
      } else renderRootGrid();
      return;
    }
    await _withServerCreds(CFG_URL,CFG_KEY,()=>fbPatch('/servers/'+serverKey+'/members/'+sv.myId,{lastSeen:Date.now()}));
  },7000);
}
