// LMS Dev Hub — supabase.js
// ========================================

// =====================================================
// Supabase config — loaded from localStorage (set via setup modal)
let SRV_DB_URL  = (localStorage.getItem('lms_db_url') ||'').replace(/\/+$/,'');
let SRV_ANON_KEY= localStorage.getItem('lms_anon_key')||'';

/* ----------------------------------------------------------------
   CONFIG PROJECT — hardcoded. This is YOUR Supabase project that
   holds the sql_scripts table. Users never see or touch this.
   To update the SQL users see, just edit the rows in that table.
   ---------------------------------------------------------------- */
const CFG_URL = 'https://plhsoqnpaupqsvlgnynk.supabase.co';
const CFG_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsaHNvcW5wYXVwcXN2bGdueW5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDM3NzAsImV4cCI6MjA5MzAxOTc3MH0.sLh1Fgu9IXsHtZ2irkEwrn7IqXIYxSd0CCH-5W7Sr-4';

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

function getSrvDbUrl(){ return SRV_DB_URL.replace(/\/+$/,''); }
function setSrvDbUrl(url){ SRV_DB_URL = url.replace(/\/+$/,''); }
function sbHeaders(extra){
  return Object.assign({'Content-Type':'application/json','apikey':SRV_ANON_KEY,'Authorization':'Bearer '+SRV_ANON_KEY},extra||{});
}

// Context-aware DB credential getter — uses per-server credentials when communicating
// with a server that has different credentials than the user's own DB.
// Returns {url, key} for the currently active server context.
function _activeSrvCreds(){
  // If srvState has per-server creds (set when joining a foreign server), use those
  if(srvState._dbUrl&&srvState._dbKey) return{url:srvState._dbUrl.replace(/\/+$/,''),key:srvState._dbKey};
  return{url:getSrvDbUrl(),key:SRV_ANON_KEY};
}

// Run an async function with a specific server's credentials, then restore
async function _withServerCreds(dbUrl,dbKey,fn){
  const prevUrl=SRV_DB_URL;const prevKey=SRV_ANON_KEY;
  SRV_DB_URL=dbUrl.replace(/\/+$/,'');SRV_ANON_KEY=dbKey;
  try{return await fn();}
  finally{SRV_DB_URL=prevUrl;SRV_ANON_KEY=prevKey;}
}

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
  // Per-server DB credentials (host's DB, may differ from joiner's own DB)
  _dbUrl: null,
  _dbKey: null,
};

// Multi-server support — up to 5 simultaneous server connections
// Each entry: {serverKey, serverName, username, isHost, myId, shortId, pollInterval}
let multiServers = []; // loaded from localStorage on init
const MAX_SERVERS = 5;

function saveMultiServers(){
  try{localStorage.setItem('lms_multi_servers',JSON.stringify(multiServers.map(s=>({serverKey:s.serverKey,serverName:s.serverName,username:s.username,isHost:s.isHost,myId:s.myId,shortId:s.shortId,dbUrl:s.dbUrl||'',dbKey:s.dbKey||''}))));} catch(e){}
}
async function loadMultiServers(){
  try{
    const saved=localStorage.getItem('lms_multi_servers');
    if(!saved)return;
    const arr=JSON.parse(saved);
    for(const sv of arr){
      const dbUrl=sv.dbUrl||getSrvDbUrl();
      const dbKey=sv.dbKey||SRV_ANON_KEY;
      if(dbUrl){
        // Temporarily use this server's credentials for the meta check
        const _prevUrl=SRV_DB_URL;const _prevKey=SRV_ANON_KEY;
        SRV_DB_URL=dbUrl;SRV_ANON_KEY=dbKey;
        const meta=await fbGet('/servers/'+sv.serverKey+'/meta');
        SRV_DB_URL=_prevUrl;SRV_ANON_KEY=_prevKey;
        if(meta&&!meta.deleted){
          multiServers.push({...sv,dbUrl,dbKey,pollInterval:null});
          // Write presence using server's own credentials
          const _pu=SRV_DB_URL;const _pk=SRV_ANON_KEY;
          SRV_DB_URL=dbUrl;SRV_ANON_KEY=dbKey;
          await fbSet('/servers/'+sv.serverKey+'/members/'+sv.myId,{name:sv.username,lastSeen:Date.now(),isHost:sv.isHost,uid:sv.myId});
          SRV_DB_URL=_pu;SRV_ANON_KEY=_pk;
        }
      }
    }
    saveMultiServers();
  }catch(e){}
}

function getServerById(serverKey){return multiServers.find(s=>s.serverKey===serverKey)||null;}
function isConnectedToServer(serverKey){return multiServers.some(s=>s.serverKey===serverKey);}

// Add a new server connection to the multi-server list
function addMultiServer(sv){
  if(multiServers.length>=MAX_SERVERS){
    toast('You already have '+MAX_SERVERS+' servers. Leave one to add another.');
    return false;
  }
  const existing=multiServers.findIndex(s=>s.serverKey===sv.serverKey);
  if(existing>=0)multiServers[existing]={...sv,pollInterval:multiServers[existing].pollInterval};
  else multiServers.push({...sv,pollInterval:null});
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

// Start per-server heartbeat
function startServerHeartbeat(serverKey){
  const sv=getServerById(serverKey);
  if(!sv)return;
  if(sv.pollInterval)clearInterval(sv.pollInterval);
  sv.pollInterval=setInterval(async()=>{
    const _shUrl=sv.dbUrl||getSrvDbUrl();const _shKey=sv.dbKey||SRV_ANON_KEY;
    const meta=await _withServerCreds(_shUrl,_shKey,()=>fbGet('/servers/'+serverKey+'/meta'));
    if(!meta||meta.deleted){
      toast('⚠ Server "'+sv.serverName+'" was deleted by the host.');
      const localCreated=JSON.parse(localStorage.getItem('lms_created_servers')||'[]');
      localStorage.setItem('lms_created_servers',JSON.stringify(localCreated.filter(s=>s.name.toLowerCase()!==sv.serverName?.toLowerCase())));
      const localRecent=JSON.parse(localStorage.getItem('lms_recent_servers')||'[]');
      localStorage.setItem('lms_recent_servers',JSON.stringify(localRecent.filter(s=>s.name.toLowerCase()!==sv.serverName?.toLowerCase())));
      removeMultiServer(serverKey);
      // If we were in a project on this server, go home
      if(srvState.connected&&srvState.serverKey===serverKey){
        _srvMetaCache=null;_srvMetaCacheKey=null;srvState={connected:false,serverKey:null,serverName:null,username:null,isHost:false,pollInterval:null,chatPollInterval:null,activeProjId:null,activeTab:'tasks',myId:null,lastChatTs:0,shortId:''};
        localStorage.removeItem('lms_active_server');
        if(document.getElementById('app-shell').classList.contains('visible'))goHome();
        else renderRootGrid();
      } else renderRootGrid();
      return;
    }
    await _withServerCreds(_shUrl,_shKey,()=>fbPatch('/servers/'+serverKey+'/members/'+sv.myId,{lastSeen:Date.now()}));
    if(document.getElementById('root-screen-wrap').style.display!=='none') renderRootGrid();
  },7000);
}
