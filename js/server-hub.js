// LMS Dev Hub — server-hub.js
// ========================================

// LMS Dev Hub — server.js
// ========================================

// =====================================================
// NOTIFICATION SOUND ENGINE
// =====================================================
const _notifAudio={ctx:null,get(){if(!this.ctx)try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}return this.ctx;}};
function playChatSound(type='incoming'){
  const ctx=_notifAudio.get();if(!ctx)return;
  try{
    if(type==='incoming'){
      // Gentle "ping" — two tones
      const o1=ctx.createOscillator(),g1=ctx.createGain();
      o1.connect(g1);g1.connect(ctx.destination);
      o1.frequency.setValueAtTime(880,ctx.currentTime);
      o1.frequency.setValueAtTime(1320,ctx.currentTime+0.05);
      g1.gain.setValueAtTime(0.08,ctx.currentTime);
      g1.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.25);
      o1.start();o1.stop(ctx.currentTime+0.25);
    } else if(type==='outgoing'){
      // Soft "pop"
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='sine';o.frequency.setValueAtTime(660,ctx.currentTime);
      g.gain.setValueAtTime(0.05,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.12);
      o.start();o.stop(ctx.currentTime+0.12);
    } else if(type==='typing'){
      // Soft tick
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='sine';o.frequency.setValueAtTime(1100,ctx.currentTime);
      g.gain.setValueAtTime(0.025,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.06);
      o.start();o.stop(ctx.currentTime+0.06);
    } else if(type==='alert'){
      // Host alert — descending double beep
      [0,0.15].forEach((delay,i)=>{
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.connect(g);g.connect(ctx.destination);
        o.type='square';o.frequency.setValueAtTime(880-(i*180),ctx.currentTime+delay);
        g.gain.setValueAtTime(0.04,ctx.currentTime+delay);
        g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+0.18);
        o.start(ctx.currentTime+delay);o.stop(ctx.currentTime+delay+0.18);
      });
    }
  }catch(e){}
}

// =====================================================
// TYPING INDICATOR STATE
// =====================================================
let _typingTimeout=null;
let _lastTypingTs=0;
let _typingIndicatorShown={};  // uid -> name of who's typing

async function _setTyping(isTyping){
  if(!srvState.connected||!srvState.activeProjId||!srvState.myId)return;
  try{
    await _withServerCreds(CFG_URL,CFG_KEY,()=>fbSet(
      '/servers/'+srvState.serverKey+'/typing/'+srvState.activeProjId+'/'+srvState.myId,
      isTyping?{name:srvState.username,ts:Date.now()}:null
    ));
  }catch(e){}
}

function handleChatInput(e){
  const now=Date.now();
  if(now-_lastTypingTs>2000){_lastTypingTs=now;_setTyping(true);}
  clearTimeout(_typingTimeout);
  _typingTimeout=setTimeout(()=>{_setTyping(false);_lastTypingTs=0;},3000);
  if(e.key==='Enter'){clearTimeout(_typingTimeout);_setTyping(false);_lastTypingTs=0;}
}

async function _pollTypingIndicator(){
  if(!srvState.connected||!srvState.activeProjId)return;
  try{
    const typing=await _withServerCreds(CFG_URL,CFG_KEY,()=>fbGet(
      '/servers/'+srvState.serverKey+'/typing/'+srvState.activeProjId
    ))||{};
    const now=Date.now();
    const others=Object.entries(typing)
      .filter(([uid,v])=>uid!==srvState.myId&&v&&(now-v.ts)<5000)
      .map(([,v])=>v.name);
    const el=document.getElementById('solo-typing-indicator');
    if(el){
      if(others.length){
        const names=others.slice(0,3).join(', ');
        el.textContent=names+(others.length===1?' is typing…':' are typing…');
        el.style.display='block';
        // Typing sound — only tick once per new person
        const key=others.join(',');
        if(key!==el.dataset.lastKey){el.dataset.lastKey=key;playChatSound('typing');}
      } else {
        el.style.display='none';el.dataset.lastKey='';
      }
    }
  }catch(e){}
}

// =====================================================
// CHAT NOTIFICATION BANNER
// =====================================================
let _lastKnownChatTs=0;
let _chatNotifBannerTimeout=null;

function showChatNotifBanner(senderName,msgPreview){
  const inChat=document.getElementById('page-chat')?.classList.contains('active');
  let banner=document.getElementById('srv-chat-notif-banner');
  if(!banner){
    banner=document.createElement('div');
    banner.id='srv-chat-notif-banner';
    banner.style.cssText='position:fixed;bottom:18px;right:18px;z-index:8000;background:var(--bg2);border:1px solid var(--accent2);border-radius:3px;padding:12px 16px;max-width:280px;box-shadow:0 4px 20px rgba(0,0,0,.5);cursor:pointer;animation:fadeUp .2s ease;';
    banner.onclick=()=>{banner.remove();nav('chat');};
    document.body.appendChild(banner);
  }
  if(inChat){
    // In-chat: subtle side flash
    banner.style.borderColor='var(--accent)';
    banner.innerHTML=`<div style="font-size:9px;color:var(--accent);letter-spacing:.1em;margin-bottom:3px;">NEW MESSAGE</div><div style="font-size:10px;color:var(--text);"><strong>${escHtml(senderName)}:</strong> ${escHtml(msgPreview.substring(0,60))}</div>`;
    playChatSound('incoming');
  } else {
    // Not in chat: prominent banner with nav prompt
    banner.style.borderColor='var(--accent2)';
    banner.innerHTML=`<div style="font-size:9px;color:var(--accent2);letter-spacing:.1em;margin-bottom:4px;display:flex;align-items:center;gap:5px;"><ion-icon name="chatbubble-sharp" style="font-size:11px;"></ion-icon> TEAM CHAT — NEW MESSAGE</div><div style="font-size:10px;color:var(--text);margin-bottom:6px;"><strong>${escHtml(senderName)}:</strong> ${escHtml(msgPreview.substring(0,60))}</div><div style="font-size:8px;color:var(--text3);letter-spacing:.06em;">Click to open Team Chat</div>`;
    playChatSound('incoming');
  }
  clearTimeout(_chatNotifBannerTimeout);
  _chatNotifBannerTimeout=setTimeout(()=>{if(banner.parentNode)banner.remove();},6000);
}

// =====================================================
// SERVER ALERT SYSTEM (host broadcasts)
// =====================================================
async function sendHostAlert(msg,type){
  if(!srvState.connected||!srvState.isHost)return;
  await _withServerCreds(CFG_URL,CFG_KEY,()=>fbPush('/servers/'+srvState.serverKey+'/serverAlerts',{
    msg,type:type||'info',by:srvState.username,ts:Date.now(),seen:{}
  }));
  toast('Alert sent to all members');
}

let _lastAlertTs=0;
async function _pollServerAlerts(){
  if(!srvState.connected)return;
  try{
    const alerts=await _withServerCreds(CFG_URL,CFG_KEY,()=>fbGet('/servers/'+srvState.serverKey+'/serverAlerts'))||{};
    const myId=srvState.myId||'';
    const newAlerts=Object.entries(alerts)
      .map(([k,v])=>({...v,_key:k}))
      .filter(a=>a.ts>_lastAlertTs&&!a.seen?.[myId]&&a.by!==srvState.username)
      .sort((a,b)=>a.ts-b.ts);
    if(newAlerts.length){
      _lastAlertTs=Math.max(...newAlerts.map(a=>a.ts));
      newAlerts.forEach(a=>{
        showServerAlertBanner(a);
        // Mark seen
        _withServerCreds(CFG_URL,CFG_KEY,()=>fbSet('/servers/'+srvState.serverKey+'/serverAlerts/'+a._key+'/seen/'+myId,true)).catch(()=>{});
      });
      _renderNotifTabBadge();
    }
  }catch(e){}
}

function showServerAlertBanner(alert){
  playChatSound('alert');
  const banner=document.createElement('div');
  const colors={info:'var(--accent2)',warn:'var(--accent4)',danger:'var(--accent3)',success:'var(--accent)'};
  const color=colors[alert.type]||colors.info;
  banner.style.cssText=`position:fixed;top:18px;right:18px;z-index:8000;background:var(--bg2);border:1px solid ${color};border-radius:3px;padding:14px 18px;max-width:320px;box-shadow:0 4px 24px rgba(0,0,0,.55);animation:fadeUp .2s ease;`;
  banner.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><ion-icon name="megaphone-sharp" style="font-size:14px;color:${color};"></ion-icon><div style="font-size:9px;color:${color};letter-spacing:.12em;flex:1;">SERVER ALERT from ${escHtml(alert.by)}</div><button onclick="this.closest('div[style]').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:0;line-height:1;">×</button></div><div style="font-size:11px;color:var(--text);line-height:1.5;">${escHtml(alert.msg)}</div>`;
  document.body.appendChild(banner);
  setTimeout(()=>{if(banner.parentNode)banner.remove();},12000);
}

function _renderNotifTabBadge(){
  const btn=document.getElementById('srv-tab-notifs');
  if(!btn)return;
  // Count unread — just pulse
  btn.style.color='var(--accent3)';
  btn.innerHTML=btn.innerHTML.replace(/ ●/g,'')+' ●';
}


// Encodes host DB URL + anon key + server name into a
// non-obvious scrambled string. Paste into Join tab to
// auto-fill host database credentials.
// =====================================================

// Holds decoded invite creds in memory so they survive input clearing
let _pendingInviteCreds = null;
function lmsEncodeInvite(serverName, shortId){
  const payload=JSON.stringify({s:serverName,i:shortId||''});
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
  if(urlInp){urlInp.value=decoded.u||'';urlInp.style.display='none';}
  if(keyInp){keyInp.value=decoded.k||'';keyInp.style.display='none';}
  if(nameInp&&decoded.s) nameInp.value=decoded.s;
  if(idInp&&decoded.i) idInp.value=decoded.i;
  // Store in memory so joinServer can use them even if inputs get cleared
  _pendingInviteCreds={shortId:decoded.i||''};
  const _hint=document.getElementById('join-db-hint');if(_hint)_hint.style.display='none';
  toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Invite decoded — enter the server password to join');
  setTimeout(()=>{const pw=document.getElementById('join-password');if(pw)pw.focus();},200);
  const inviteRow=document.getElementById('join-invite-row');
  if(inviteRow)inviteRow.style.display='none';
  const decodedBadge=document.getElementById('join-decoded-badge');
  if(decodedBadge){
    decodedBadge.style.display='flex';
    decodedBadge.querySelector('span').textContent='Server: '+(decoded.s||'?');
  }
  return true;
}

// ---- COPY INVITE LINK (encoded — host only) ----
function copyServerInvite(){
  const encoded=lmsEncodeInvite(srvState.serverName||'',srvState.shortId||'');
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
  // Show ghost-account warning if the user's account wasn't found in the DB
  const _ghostWarn=document.getElementById('srv-ghost-account-warning');
  if(_ghostWarn) _ghostWarn.style.display=window._accountMissingFromDb?'block':'none';
  // Reset manual-open state so lobby panel starts collapsed if already connected
  const lobbyPanel=document.getElementById('srv-lobby-panel');
  if(lobbyPanel){lobbyPanel.dataset.manualOpen='0';lobbyPanel.style.display='none';}
  const addBtn=document.getElementById('srv-add-another-btn');
  if(addBtn)addBtn.textContent='+ JOIN / HOST ANOTHER SERVER';
  renderSrvStatus();
  loadRecentServers();
  loadCreatedServers();
  loadJoinedServers();
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
  // Always clear join credential fields on open — these are for the HOST's DB, never the member's own
  _pendingInviteCreds=null;
  const joinDbInp=document.getElementById('join-supabase-url');
  const joinKeyInp=document.getElementById('join-anon-key');
  if(joinDbInp)joinDbInp.value='';
  if(joinKeyInp)joinKeyInp.value='';
  updateJoinDbHint();
  if(false){
    const txt=document.getElementById('srv-status-txt');
    if(txt)txt.textContent='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Database not configured — click DB Setup to get started';
    // shared DB — no setup needed
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
  const notifsPanel=document.getElementById('srv-panel-notifs');
  if(notifsPanel)notifsPanel.style.display=tab==='notifs'?'block':'none';
  if(tab==='notifs')loadNotifsPanel();
  const tabs=['host','join','mine','notifs'];
  const styles={
    host:'flex:1;background:linear-gradient(135deg,rgba(200,240,74,.1),rgba(74,240,200,.05));border:none;border-right:1px solid var(--border);color:var(--accent);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;',
    join:'flex:1;background:linear-gradient(135deg,rgba(74,240,200,.1),rgba(74,240,200,.05));border:none;border-right:1px solid var(--border);color:var(--accent2);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;',
    mine:'flex:1;background:linear-gradient(135deg,rgba(160,74,240,.1),rgba(160,74,240,.05));border:none;border-right:1px solid var(--border);color:var(--accent5,#a04af0);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;',
    notifs:'flex:1;background:linear-gradient(135deg,rgba(240,74,74,.1),rgba(240,74,74,.05));border:none;color:var(--accent3);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;',
  };
  const inactive='flex:1;background:var(--bg2);border:none;border-right:1px solid var(--border);color:var(--text3);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;';
  const inactiveLast='flex:1;background:var(--bg2);border:none;color:var(--text3);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;';
  tabs.forEach((t,i)=>{
    const btn=document.getElementById('srv-tab-'+t);
    if(!btn)return;
    if(t===tab)btn.style.cssText=styles[t];
    else btn.style.cssText=(i===tabs.length-1)?inactiveLast:inactive;
  });
  if(tab==='mine'){loadCreatedServers();loadJoinedServers();loadRecentServers();}
}

async function loadNotifsPanel(){
  // Show host send-alert section only for hosts
  const wrap=document.getElementById('srv-send-alert-wrap');
  if(wrap)wrap.style.display=srvState.connected&&srvState.isHost?'block':'none';
  // Clear badge
  const btn=document.getElementById('srv-tab-notifs');
  if(btn){const txt=btn.textContent.replace(/ ●/g,'');btn.innerHTML=`<ion-icon name="notifications-sharp" style="font-size:13px;"></ion-icon> ${txt.trim()}`;}
  // Load alert history
  const histEl=document.getElementById('srv-alerts-history');
  if(!histEl||!srvState.connected)return;
  try{
    const alerts=await _withServerCreds(CFG_URL,CFG_KEY,()=>fbGet('/servers/'+srvState.serverKey+'/serverAlerts'))||{};
    const list=Object.entries(alerts).map(([k,v])=>({...v,_key:k})).sort((a,b)=>b.ts-a.ts).slice(0,30);
    const colors={info:'var(--accent2)',warn:'var(--accent4)',danger:'var(--accent3)',success:'var(--accent)'};
    if(!list.length){histEl.innerHTML='<div style="font-size:10px;color:var(--text3);text-align:center;padding:20px 0;letter-spacing:.06em;">No alerts yet</div>';return;}
    histEl.innerHTML=list.map(a=>`
      <div style="background:var(--bg3);border:1px solid var(--border);border-left:3px solid ${colors[a.type]||colors.info};border-radius:2px;padding:10px 12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:8px;color:${colors[a.type]||colors.info};letter-spacing:.1em;text-transform:uppercase;">${a.type||'info'}</span>
          <span style="font-size:8px;color:var(--text3);">from ${escHtml(a.by)}</span>
          <span style="margin-left:auto;font-size:8px;color:var(--text3);">${new Date(a.ts).toLocaleString()}</span>
        </div>
        <div style="font-size:11px;color:var(--text);line-height:1.5;">${escHtml(a.msg)}</div>
      </div>`).join('');
  }catch(e){histEl.innerHTML='<div style="font-size:10px;color:var(--text3);padding:12px;">Could not load alerts.</div>';}
}

async function clearServerAlerts(){
  if(!srvState.connected||!srvState.isHost){toast('Only hosts can clear server alerts');return;}
  await _withServerCreds(CFG_URL,CFG_KEY,()=>fbDelete('/servers/'+srvState.serverKey+'/serverAlerts'));
  loadNotifsPanel();
  toast('Alerts cleared');
}

function renderSrvStatus(){
  const dot=document.getElementById('srv-status-dot');
  const dbBtn=document.getElementById('srv-db-setup-btn');if(dbBtn){dbBtn.style.display=(srvState.connected||multiServers.length>0)?'none':'inline-block';dbBtn.innerHTML='<ion-icon name="checkmark-circle-sharp" style="font-size:12px;pointer-events:none;vertical-align:middle;margin-right:4px;"></ion-icon>DB Ready';dbBtn.style.color='var(--accent)';dbBtn.style.borderColor='var(--accent)';}
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
        return `<button onclick="switchActiveServer('${sv.serverKey}')" style="background:${active?'linear-gradient(135deg,rgba(74,240,200,.15),rgba(74,240,200,.07))':'var(--bg3)'};border:1px solid ${active?'var(--accent2)':'var(--border)'};color:${active?'var(--accent2)':'var(--text3)'};font-family:var(--font);font-size:8px;padding:3px 10px;cursor:pointer;border-radius:1px;letter-spacing:.06em;display:inline-flex;align-items:center;gap:4px;">${escHtml(sv.serverName)}${sv.isHost?` <ion-icon name="flash-sharp" style="font-size:10px;"></ion-icon>`:''}</button>`;
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
    srvState={...srvState,connected:true,serverKey:sv.serverKey,serverName:sv.serverName,username:sv.username,isHost:sv.isHost,myId:sv.myId,shortId:sv.shortId,_dbUrl:CFG_URL,_dbKey:CFG_KEY};
    localStorage.setItem('lms_active_server',JSON.stringify({serverKey:sv.serverKey,serverName:sv.serverName,username:sv.username,isHost:sv.isHost,myId:sv.myId,shortId:sv.shortId}));
  } else {
    dot.style.background='#444';
    dot.style.boxShadow='none';
    txt.textContent='Not connected to any server';
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
  srvState={...srvState,connected:true,serverKey:sv.serverKey,serverName:sv.serverName,username:sv.username,isHost:sv.isHost,myId:sv.myId,shortId:sv.shortId,activeProjId:null,_dbUrl:CFG_URL,_dbKey:CFG_KEY};
  localStorage.setItem('lms_active_server',JSON.stringify({serverKey:sv.serverKey,serverName:sv.serverName,username:sv.username,isHost:sv.isHost,myId:sv.myId,shortId:sv.shortId}));
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
  if(url&&!url.includes('.supabase.co')){hint.style.color='var(--accent3)';hint.textContent='Must be a .supabase.co URL';return;}
  if(key&&!key.startsWith('eyJ')){hint.style.color='var(--accent3)';hint.textContent='Key should start with eyJ... — check you copied the anon public key';return;}
  if(url&&key&&url.includes('.supabase.co')&&key.startsWith('eyJ')){hint.style.color='var(--accent)';hint.textContent='Credentials look good';}
  else{hint.style.color='var(--text3)';hint.textContent='';}
}

async function joinServer(){
  // If we have a decoded invite with a shortId, use ID-based join — it's the source of truth
  if(_pendingInviteCreds?.shortId){return joinServerById();}
  const targetDbUrl=CFG_URL;
  const targetDbKey=CFG_KEY;
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
  const _createdEntry=localStorage.getItem('lms_created_'+serverKey);
  const isHost=!!(meta.hostId && meta.hostId===myId)||!!(_createdEntry);
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
    uid:myId,server_key:serverKey,name:username, displayName:username, username:currentUser?.username||username,
    lastSeen:now,isHost:isHost,createdAt:now,email:currentUser?.email||'',activity:null,inProject:null
  };

  const saved=await _withServerCreds(targetDbUrl,targetDbKey,()=>fbSet('/servers/'+serverKey+'/members/'+myId,memberData));
  if(!saved){toast('Failed to join server. Check database configuration.');return;}

  // Store per-server credentials — do NOT touch the user's own SRV_DB_URL / SRV_ANON_KEY
  const sv={serverKey,serverName:meta.name,username,isHost,myId,shortId:meta.shortId||''};
  addMultiServer(sv);
  startServerHeartbeat(serverKey);

  srvState={...srvState,connected:true,serverKey,serverName:meta.name,username,isHost,myId,activeProjId:null,shortId:meta.shortId||'',_dbUrl:CFG_URL,_dbKey:CFG_KEY};
  localStorage.setItem('lms_active_server',JSON.stringify({serverKey,serverName:meta.name,username,isHost,myId,shortId:meta.shortId||''}));
  saveRecentServer(serverName,pass);
  if(isHost||meta.hostId===myId)saveCreatedServer(meta.name,pass);
  else saveJoinedServer(meta.name,pass);
  const _svForCreated={serverKey,serverName:meta.name,pass};
  if(isHost) localStorage.setItem('lms_created_'+serverKey, JSON.stringify(_svForCreated));
  _savePassCache(meta.name,pass,serverKey);
  _pendingInviteCreds=null;
  startSrvHeartbeat();
  renderSrvStatus();
  renderActiveServer();
  toast('Joined server: '+meta.name+(isHost?' [HOST]':'')+(multiServers.length>1?' ('+multiServers.length+'/'+MAX_SERVERS+' servers)':''));
  closeServerHub();
  renderRootGrid();
}

// Replace hostServer() function (around line 3200+)
async function hostServer(){
  // Server creation always uses the HOST's OWN personal DB — never srvState creds
  // (srvState may point to a different server the host is currently connected to).
  const _hUrl=CFG_URL; const _hKey=CFG_KEY;
  const username=currentUser?(currentUser.displayName||currentUser.username):(document.getElementById('host-username')?.value.trim()||'Host');
  const serverName=document.getElementById('host-servername').value.trim();
  const pass=document.getElementById('host-password').value;
  const pass2=document.getElementById('host-password2').value;
  if(!username||!serverName||!pass){toast('Fill all fields');return;}
  if(pass!==pass2){toast('Passwords do not match');return;}

  if(multiServers.length>=MAX_SERVERS){
    toast('You already have '+MAX_SERVERS+' servers active. Leave one to create another.');
    return;
  }

  // Lifetime cap: max 10 created servers per user (DB check)
  if(currentUser){
    try{
      const _capR=await fetch(CFG_URL+'/rest/v1/servers?host_id=eq.'+encodeURIComponent(currentUser.uid)+'&deleted=eq.false&select=id',
        {headers:{'apikey':CFG_KEY,'Authorization':'Bearer '+CFG_KEY,'Accept':'application/json','Range':'0-0','Prefer':'count=exact'}});
      const _capCount=parseInt(_capR.headers.get('content-range')?.split('/')[1]||'0',10);
      if(_capCount>=10){
        toast('You have reached the 10 server limit. Delete an old server to create a new one.');
        return;
      }
    }catch(e){ /* allow through if count check fails */ }
  }

  toast('Creating server…');
  const serverKey=hashStr(serverName.toLowerCase());
  const passHash=await hashPass(pass);
  const serverType=(document.getElementById('host-server-type')?.value)||'public';
  const serverDesc=(document.getElementById('host-serverdesc')?.value||'').trim();
  const serverTags=(document.getElementById('host-servertags')?.value||'').trim().split(',').map(t=>t.trim()).filter(Boolean);

  // All creation writes go to the host's own DB explicitly
  const existing=await _withServerCreds(_hUrl,_hKey,()=>fbGet('/servers/'+serverKey+'/meta'));
  if(existing && existing.passHash && !existing.deleted){
    toast('Server name taken — try another');
    return;
  }

  const myId=currentUser?.uid||('user_'+Date.now()+'_'+Math.random().toString(36).slice(2,6));
  const now=Date.now();
  const shortId=genServerId();
  const shortIdClean=shortId.replace(/-/g,'');

  // Create server in the host's own DB
  await _withServerCreds(_hUrl,_hKey,()=>fbSet('/servers/'+serverKey+'/meta',{
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
  }));

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

  const memberSaved=await _withServerCreds(_hUrl,_hKey,()=>fbSet('/servers/'+serverKey+'/members/'+myId,hostMemberData));
  if(!memberSaved){
    console.warn('Member upsert failed, trying plain POST fallback…');
    const _murl=_hUrl+'/rest/v1/members';
    const _mdata=_memberToDb(hostMemberData);
    const _mhdrs=Object.assign({'Content-Type':'application/json','apikey':_hKey,'Authorization':'Bearer '+_hKey},{'Prefer':'return=minimal'});
    const _mr=await fetch(_murl,{method:'POST',headers:_mhdrs,body:JSON.stringify(_mdata)});
    const _mok=_mr.ok||_mr.status===201||_mr.status===204;
    if(!_mok){const _mt=await _mr.text().catch(()=>'');console.warn('Member fallback failed:',_mr.status,_mt);toast('Warning: member row failed ('+_mr.status+'). Check console.');}
  }

  // Store reverse-lookup index in host's own DB
  await _withServerCreds(_hUrl,_hKey,()=>fbSet('/serverIds/'+shortIdClean,{short_id:shortIdClean,server_key:serverKey}));

  const sv={serverKey,serverName,username,isHost:true,myId,shortId};
  addMultiServer(sv);
  startServerHeartbeat(serverKey);

  srvState={...srvState,connected:true,serverKey,serverName,username,isHost:true,myId,activeProjId:null,shortId,_dbUrl:CFG_URL,_dbKey:CFG_KEY};
  localStorage.setItem('lms_active_server',JSON.stringify({serverKey,serverName,username,isHost:true,myId,shortId}));
  saveRecentServer(serverName,pass);
  saveCreatedServer(serverName,pass);
  _savePassCache(serverName,pass,serverKey);
  bakInitialSnapshot(serverKey,serverName);
  startSrvHeartbeat();
  // Force lobby panel closed so it doesn't render alongside the active panel (duplicate view bug)
  const _lp=document.getElementById('srv-lobby-panel');
  if(_lp){_lp.dataset.manualOpen='0';_lp.style.display='none';}
  renderSrvStatus();
  renderActiveServer();
  toast('Server launched: '+serverName+' ('+multiServers.length+'/'+MAX_SERVERS+')');
  closeServerHub();
  renderRootGrid();
}

// Also add this heartbeat enhancement to detect deleted members
function startSrvHeartbeat(){
  stopSrvPolling();
  _lastAlertTs=Date.now(); // don't flood with old alerts on connect
  _lastKnownChatTs=0;
  if(srvState.isHost)bakStartTimers(srvState.serverKey,srvState.serverName);
  srvState.pollInterval=setInterval(async()=>{
    if(!srvState.connected)return;
    const _hUrl=CFG_URL;const _hKey=CFG_KEY;
    const meta=await _withServerCreds(_hUrl,_hKey,()=>fbGet('/servers/'+srvState.serverKey+'/meta'));
    if(!meta||meta.deleted){
      toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>This server was deleted by the host.');
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

    // Kick detection — check own member row for kicked flag or deletion
    if(!srvState.isHost){
      const myRow=await _withServerCreds(_hUrl,_hKey,()=>fbGet('/servers/'+srvState.serverKey+'/members/'+srvState.myId));
      if(!myRow||myRow.kicked){
        toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>You have been kicked from "'+srvState.serverName+'".');
        // Clean up joined servers list immediately
        const _kSrvName=(srvState.serverName||'').toLowerCase();
        if(_kSrvName){
          try{
            const _kj=JSON.parse(localStorage.getItem('lms_joined_servers')||'[]');
            localStorage.setItem('lms_joined_servers',JSON.stringify(_kj.filter(s=>s.name.toLowerCase()!==_kSrvName)));
          }catch(e){}
        }
        const _kKey2=srvState.serverKey;
        stopSrvPolling();
        removeMultiServer(_kKey2);
        _srvMetaCache=null;_srvMetaCacheKey=null;
        srvState={connected:false,serverKey:null,serverName:null,username:null,isHost:false,pollInterval:null,chatPollInterval:null,activeProjId:null,activeTab:'tasks',myId:null,lastChatTs:0,shortId:''};
        localStorage.removeItem('lms_active_server');
        if(document.getElementById('app-shell').classList.contains('visible')){goHome();}
        else{renderRootGrid();}
        return;
      }
    }
    
    if(document.getElementById('server-hub-overlay')?.style.display!=='none'){
      renderActiveServer();
    }
    if(document.getElementById('root-screen-wrap').style.display!=='none'&&srvState.connected){
      renderSelectedServerPanel();
    }
    if(srvState.activeProjId&&document.getElementById('app-shell').classList.contains('visible')){
      updateSoloPresenceBar();
    }
    if(srvState.activeProjId&&document.getElementById('app-shell').classList.contains('visible')){
      if(document.getElementById('page-chat')?.classList.contains('active')) renderSoloChat();
      // Poll for new chat messages even when NOT in chat
      else await _pollChatForNotifs();
      // Always poll typing indicator
      await _pollTypingIndicator();
    }
    // Poll server alerts for all members
    await _pollServerAlerts();
  },5000);
}

// ---- JOIN BY SERVER ID ----
async function joinServerById(){
  const targetDbUrl=CFG_URL;
  const targetDbKey=CFG_KEY;

  const username=currentUser?(currentUser.displayName||currentUser.username):'Member';
  const shortIdRaw=(_pendingInviteCreds?.shortId||document.getElementById('join-server-id').value).trim();
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
  const _createdEntry=localStorage.getItem('lms_created_'+serverKey);
  const isHost=!!(meta.hostId && meta.hostId===myId)||!!(_createdEntry);

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

  await _withServerCreds(targetDbUrl,targetDbKey,()=>fbSet('/servers/'+serverKey+'/members/'+myId,{uid:myId,server_key:serverKey,name:username, displayName:username, username:currentUser?.username||username,lastSeen:Date.now(),isHost,createdAt:Date.now(),email:currentUser?.email||'',activity:null,inProject:null}));

  // Store per-server credentials — do NOT touch SRV_DB_URL / SRV_ANON_KEY
  const sv={serverKey,serverName:meta.name,username,isHost,myId,shortId:meta.shortId||shortIdRaw};
  addMultiServer(sv);
  startServerHeartbeat(serverKey);

  srvState={...srvState,connected:true,serverKey,serverName:meta.name,username,isHost,myId,activeProjId:null,shortId:meta.shortId||shortIdRaw,_dbUrl:CFG_URL,_dbKey:CFG_KEY};
  localStorage.setItem('lms_active_server',JSON.stringify({serverKey,serverName:meta.name,username,isHost,myId,shortId:meta.shortId||shortIdRaw}));
  saveRecentServer(meta.name,pass);
  _pendingInviteCreds=null;
  if(isHost||meta.hostId===myId)saveCreatedServer(meta.name,pass);
  else saveJoinedServer(meta.name,pass);
  const _svForCreated={serverKey,serverName:meta.name,pass};
  if(isHost) localStorage.setItem('lms_created_'+serverKey, JSON.stringify(_svForCreated));
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
  // Remove member presence using server's own creds
  if(sv.myId){
    const _dUrl=(CFG_URL);const _dKey=(CFG_KEY);
    await _withServerCreds(_dUrl,_dKey,()=>fbDelete('/servers/'+key+'/members/'+sv.myId));
  }
  removeMultiServer(key);
  // Remove from lms_joined_servers so My Servers bar updates immediately (no refresh needed)
  const _srvName=(sv.serverName||'').toLowerCase();
  if(_srvName){
    try{
      const _joined=JSON.parse(localStorage.getItem('lms_joined_servers')||'[]');
      localStorage.setItem('lms_joined_servers',JSON.stringify(_joined.filter(s=>s.name.toLowerCase()!==_srvName)));
      if(currentUser&&CFG_URL){
        const _fbKey=_srvName.replace(/[^a-z0-9]/g,'_');
        fbDelete('/accounts/'+currentUser.uid+'/joinedServers/'+_fbKey).catch(()=>{});
      }
    }catch(e){}
  }
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
  const _raUrl=CFG_URL;const _raKey=CFG_KEY;
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
      ?`<span style="font-size:8px;padding:1px 6px;border:1px solid var(--accent5);color:var(--accent5);border-radius:1px;letter-spacing:.08em;margin-left:8px;"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:2px;"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> PRIVATE</span>`
      :`<span style="font-size:8px;padding:1px 6px;border:1px solid var(--accent2);color:var(--accent2);border-radius:1px;letter-spacing:.08em;margin-left:8px;display:inline-flex;align-items:center;gap:4px;"><ion-icon name="earth-sharp" style="font-size:10px;"></ion-icon> PUBLIC</span>`;
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
      if(meta.hostName)parts.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><ion-icon name="flash-sharp" style="font-size:11px;color:var(--accent);"></ion-icon> Hosted by <strong style="color:var(--accent);">${escHtml(meta.hostName)}</strong></span>`);
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

  memberEl.innerHTML=onlineMembers.map(([id,m])=>{
    const isMe=id===srvState.myId;
    const permBtn=srvState.isHost&&!isMe&&!m.isHost
      ?`<button onclick="event.stopPropagation();openMemberPermissions('${id}','${(m.name||'Member').replace(/'/g,"\\\\'\'")}')" title="Manage permissions" style="background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--font);font-size:8px;padding:2px 5px;cursor:pointer;border-radius:1px;margin-left:4px;display:inline-flex;align-items:center;" onmouseover="this.style.color='var(--accent4)';this.style.borderColor='var(--accent4)'" onmouseout="this.style.color='var(--text3)';this.style.borderColor='var(--border2)'"><ion-icon name="settings-sharp" style="font-size:11px;pointer-events:none;"></ion-icon></button>`
      :'';
    const kickBtn=srvState.isHost&&!isMe&&!m.isHost
      ?`<button onclick="event.stopPropagation();kickMember('${id}','${(m.name||'Member').replace(/'/g,"\\\\'\'")}')" title="Kick member" style="background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--font);font-size:8px;padding:2px 5px;cursor:pointer;border-radius:1px;margin-left:2px;display:inline-flex;align-items:center;" onmouseover="this.style.color='var(--accent3)';this.style.borderColor='var(--accent3)'" onmouseout="this.style.color='var(--text3)';this.style.borderColor='var(--border2)'"><ion-icon name="person-remove-sharp" style="font-size:11px;pointer-events:none;"></ion-icon></button>`
      :'';
    const hostIcon=m.isHost?` <ion-icon name="flash-sharp" style="font-size:10px;color:var(--accent);pointer-events:none;"></ion-icon>`:'';
    return `<div class="srv-member-badge${isMe?' you':''}" style="display:flex;align-items:center;">${escHtml(m.name)}${hostIcon}${permBtn}${kickBtn}</div>`;
  }).join('');

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
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>HOST ALERTS — MEMBER DELETIONS
          <button onclick="clearHostNotifs()" title="Clear all notifications" style="margin-left:auto;background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--font);font-size:8px;padding:2px 7px;cursor:pointer;border-radius:1px;letter-spacing:.06em;display:inline-flex;align-items:center;gap:4px;" onmouseover="this.style.color='var(--accent3)';this.style.borderColor='var(--accent3)'" onmouseout="this.style.color='var(--text3)';this.style.borderColor='var(--border2)'"><ion-icon name="trash-outline" style="font-size:11px;pointer-events:none;"></ion-icon> Clear All</button>
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
    toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Server password changed!');
    loadCreatedServers();
    loadJoinedServers();
  },accent:true}]);
}

async function confirmDeleteServer(){
  if(!srvState.isHost){toast('Only the host can delete this server');return;}
  const code=Math.floor(100000+Math.random()*900000)+'';
  openModal('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Delete Server',`
    <div style="background:rgba(240,74,74,.08);border:1px solid var(--accent3);border-radius:2px;padding:10px 12px;margin-bottom:14px;font-size:10px;color:var(--accent3);line-height:1.7;letter-spacing:.04em;">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>This will permanently delete <strong>${escHtml(srvState.serverName)}</strong> and ALL projects, members, and data inside it. This cannot be undone.
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
    if(currentUser&&CFG_URL){
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


// ============================================================
// MEMBER PERMISSIONS SYSTEM
// Stored in DB at /servers/{key}/permissions/{uid} (jsonb)
// Default: all false for non-hosts (host always has all perms)
// ============================================================

const PERM_DEFS = [
  { key:'canCreateProject',  label:'Create Projects',  desc:'Add new projects to the server' },
  { key:'canDeleteProject',  label:'Delete Projects',  desc:'Remove any project from the server' },
  { key:'canEditProject',    label:'Edit Projects',    desc:'Rename/re-color any project' },
  { key:'canViewProjects',   label:'View Projects',    desc:'See and open server projects' },
  { key:'canImportProject',  label:'Import Projects',  desc:'Upload/import a .lmsroot file as a new project' },
  { key:'canExportProject',  label:'Export Projects',  desc:'Download/export any project' },
  { key:'canManageTasks',    label:'Manage Tasks',     desc:'Add, remove and check off tasks/phases' },
  { key:'canManageBugs',     label:'Manage Bugs',      desc:'Create, update and close bug reports' },
  { key:'canManageVersions', label:'Manage Versions',  desc:'Log and delete version entries' },
  { key:'canManageNotes',    label:'Manage Notes',     desc:'Write and delete notes' },
  { key:'canChat',           label:'Chat',             desc:'Send messages in project chat' },
  { key:'canManageScenes',   label:'Manage Scenes',    desc:'Create/edit scene tree nodes' },
  { key:'canManageAssets',   label:'Manage Assets',    desc:'Add and update asset tracker entries' },
  { key:'canManageScripts',  label:'Manage Scripts',   desc:'Write and delete vault scripts' },
];

// Default permissions for new non-host members
const DEFAULT_PERMS = {
  canCreateProject:false, canDeleteProject:false, canEditProject:false,
  canViewProjects:true, canImportProject:false, canExportProject:true,
  canManageTasks:true, canManageBugs:true, canManageVersions:true,
  canManageNotes:true, canChat:true, canManageScenes:true,
  canManageAssets:true, canManageScripts:false,
};

// Cache: {serverKey:{uid:{...perms}}}
let _permCache = {};

async function _getPermsRow(serverKey){
  // Permissions are stored as a special project row: project_id = '__permissions__'
  // Its data jsonb holds {uid: {perm:bool, ...}} for every member
  const _pUrl=CFG_URL; const _pKey=CFG_KEY;
  const url=(CFG_URL)+'/rest/v1/projects?server_key=eq.'+encodeURIComponent(serverKey)+'&project_id=eq.__permissions__&select=data';
  try{
    const r=await fetch(url,{headers:Object.assign({'Content-Type':'application/json'},{'apikey':_pKey||SRV_ANON_KEY,'Authorization':'Bearer '+(_pKey||SRV_ANON_KEY),'Accept':'application/json'})});
    if(!r.ok)return{};
    const j=await r.json();
    if(!j||!j.length)return{};
    const d=j[0].data;
    return typeof d==='string'?JSON.parse(d):(d||{});
  }catch(e){return{};}
}

async function _savePermsRow(serverKey, allPerms){
  const _pUrl=CFG_URL; const _pKey=CFG_KEY;
  const url=(CFG_URL)+'/rest/v1/projects?on_conflict=project_id';
  const body={project_id:'__permissions__',server_key:serverKey,name:'__permissions__',color:'#000',created_by:'system',created_at:Date.now(),data:JSON.stringify(allPerms)};
  try{
    await fetch(url,{method:'POST',headers:Object.assign({'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},{'apikey':_pKey||SRV_ANON_KEY,'Authorization':'Bearer '+(_pKey||SRV_ANON_KEY)}),body:JSON.stringify(body)});
  }catch(e){console.warn('savePermsRow failed',e);}
}

async function loadMemberPerms(serverKey, uid){
  if(_permCache[serverKey]&&_permCache[serverKey][uid]!==undefined) return _permCache[serverKey][uid];
  const all=await _getPermsRow(serverKey);
  const perms=all[uid]?{...DEFAULT_PERMS,...all[uid]}:{...DEFAULT_PERMS};
  if(!_permCache[serverKey])_permCache[serverKey]={};
  _permCache[serverKey][uid]=perms;
  return perms;
}

async function saveMemberPerms(serverKey, uid, perms){
  const all=await _getPermsRow(serverKey);
  all[uid]=perms;
  await _savePermsRow(serverKey, all);
  if(!_permCache[serverKey])_permCache[serverKey]={};
  _permCache[serverKey][uid]=perms;
}

// Check if current user has a permission (host always passes)
async function canMember(perm){
  if(!srvState.connected) return false;
  if(srvState.isHost) return true;
  const perms=await loadMemberPerms(srvState.serverKey, srvState.myId);
  return !!perms[perm];
}

// Invalidate cache for a member (call after saving)
function _invalidatePermCache(serverKey, uid){
  if(_permCache[serverKey]) delete _permCache[serverKey][uid];
}

// ---- HOST: open permissions modal for a member ----
async function openMemberPermissions(uid, memberName){
  if(!srvState.isHost){toast('Only the host can manage permissions');return;}
  const perms=await loadMemberPerms(srvState.serverKey, uid);

  const rows=PERM_DEFS.map(p=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-size:11px;color:var(--text);letter-spacing:.03em;">${escHtml(p.label)}</div>
        <div style="font-size:9px;color:var(--text3);margin-top:1px;">${escHtml(p.desc)}</div>
      </div>
      <label style="position:relative;display:inline-block;width:34px;height:18px;flex-shrink:0;margin-left:12px;">
        <input type="checkbox" id="mp-${p.key}" ${perms[p.key]?'checked':''} style="opacity:0;width:0;height:0;">
        <span onclick="this.previousElementSibling.click()" style="position:absolute;inset:0;background:${perms[p.key]?'var(--accent2)':'var(--bg3)'};border:1px solid ${perms[p.key]?'var(--accent2)':'var(--border2)'};border-radius:10px;cursor:pointer;transition:.2s;" id="mp-track-${p.key}">
          <span style="position:absolute;top:2px;left:${perms[p.key]?'16px':'2px'};width:12px;height:12px;border-radius:50%;background:#fff;transition:.2s;"></span>
        </span>
      </label>
    </div>
  `).join('');

  // Add toggle-all shortcut
  const headerRow=`
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;margin-bottom:4px;border-bottom:2px solid var(--border);">
      <div style="font-size:9px;color:var(--text3);letter-spacing:.15em;">PERMISSION</div>
      <div style="display:flex;gap:8px;">
        <button onclick="_mpSetAll(true)" style="background:none;border:1px solid var(--accent2);color:var(--accent2);font-family:var(--font);font-size:8px;padding:2px 8px;cursor:pointer;border-radius:1px;letter-spacing:.06em;">All On</button>
        <button onclick="_mpSetAll(false)" style="background:none;border:1px solid var(--accent3);color:var(--accent3);font-family:var(--font);font-size:8px;padding:2px 8px;cursor:pointer;border-radius:1px;letter-spacing:.06em;">All Off</button>
      </div>
    </div>
  `;

  openModal('Permissions · '+escHtml(memberName),
    `<div style="font-size:9px;color:var(--accent4);padding:6px 10px;background:rgba(240,160,74,.07);border:1px solid rgba(240,160,74,.2);border-radius:2px;margin-bottom:12px;letter-spacing:.05em;">Applies to this member on <strong>${escHtml(srvState.serverName)}</strong>. Hosts always have full access.</div>
    ${headerRow}
    <div style="max-height:340px;overflow-y:auto;padding-right:4px;">${rows}</div>`,
    [
      {label:'Cancel', action:closeModal},
      {label:'Save Permissions', accent:true, action:async()=>{
        const newPerms={};
        PERM_DEFS.forEach(p=>{newPerms[p.key]=document.getElementById('mp-'+p.key).checked;});
        await saveMemberPerms(srvState.serverKey, uid, newPerms);
        _invalidatePermCache(srvState.serverKey, uid);
        closeModal();
        toast('Permissions updated for '+memberName);
      }}
    ]
  );

  // Wire up toggle visual sync after modal renders
  setTimeout(()=>{
    PERM_DEFS.forEach(p=>{
      const cb=document.getElementById('mp-'+p.key);
      const track=document.getElementById('mp-track-'+p.key);
      if(!cb||!track)return;
      cb.addEventListener('change',()=>{
        const on=cb.checked;
        track.style.background=on?'var(--accent2)':'var(--bg3)';
        track.style.borderColor=on?'var(--accent2)':'var(--border2)';
        track.querySelector('span').style.left=on?'16px':'2px';
      });
    });
  },50);
}

function _mpSetAll(val){
  PERM_DEFS.forEach(p=>{
    const cb=document.getElementById('mp-'+p.key);
    const track=document.getElementById('mp-track-'+p.key);
    if(!cb||!track)return;
    cb.checked=val;
    track.style.background=val?'var(--accent2)':'var(--bg3)';
    track.style.borderColor=val?'var(--accent2)':'var(--border2)';
    track.querySelector('span').style.left=val?'16px':'2px';
  });
}

// ---- KICK MEMBER ----
function kickMember(uid, memberName){
  if(!srvState.isHost){toast('Only the host can kick members');return;}
  openModal('Kick · '+escHtml(memberName),
    `<div style="font-size:11px;color:var(--text2);line-height:1.7;margin-bottom:8px;">Remove <strong style="color:var(--accent3);">${escHtml(memberName)}</strong> from <strong>${escHtml(srvState.serverName)}</strong>?</div>
    <div style="font-size:9px;color:var(--text3);background:var(--bg3);border:1px solid var(--border);border-radius:2px;padding:8px 10px;line-height:1.65;">They will be force-disconnected immediately and their member slot freed. They can still rejoin unless you also change the server password.</div>`,
    [
      {label:'Cancel', action:closeModal},
      {label:'Kick Member', danger:true, action:async()=>{
        closeModal();
        const _kUrl=CFG_URL;const _kKey=CFG_KEY;
        // Write kicked flag — member heartbeat detects this and self-disconnects
        await _withServerCreds(_kUrl,_kKey,()=>fbPatch('/servers/'+srvState.serverKey+'/members/'+uid,{kicked:true,kickedAt:Date.now()}));
        // Also delete their member row after a brief grace period so they get one poll cycle to detect it
        setTimeout(async()=>{
          await _withServerCreds(_kUrl,_kKey,()=>fbDelete('/servers/'+srvState.serverKey+'/members/'+uid));
        },6000);
        toast(escHtml(memberName)+' has been kicked');
        renderActiveServer();
      }}
    ]
  );
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
        ${srvState.isHost?`<button onclick="event.stopPropagation();openEditProjectMeta('${id}')" title="Edit project info" style="background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--font);font-size:7px;padding:2px 6px;cursor:pointer;border-radius:1px;display:inline-flex;align-items:center;" onmouseover="this.style.color='var(--accent)';this.style.borderColor='var(--accent)'" onmouseout="this.style.color='var(--text3)';this.style.borderColor='var(--border2)'"><ion-icon name="create-sharp" style="font-size:11px;pointer-events:none;"></ion-icon></button>`:''}
        ${srvState.isHost?`<button onclick="event.stopPropagation();deleteSrvProject('${id}')" title="Delete project" style="background:none;border:none;color:var(--text3);cursor:pointer;font-family:var(--font);font-size:11px;padding:2px 4px;display:inline-flex;align-items:center;" onmouseover="this.style.color='var(--accent3)'" onmouseout="this.style.color='var(--text3)'"><ion-icon name="trash-sharp" style="font-size:12px;pointer-events:none;"></ion-icon></button>`:''}
      </div>
    </div>`;
  }).join('');
  if(el.innerHTML!==newHtml)el.innerHTML=newHtml;
}

// ---- POLL CHAT FOR NOTIFS (when not in chat page) ----
async function _pollChatForNotifs(){
  if(!srvState.connected||!srvState.activeProjId)return;
  try{
    const chat=await _withServerCreds(CFG_URL,CFG_KEY,()=>fbGet('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/chat'))||{};
    const msgs=Object.values(chat).sort((a,b)=>a.ts-b.ts);
    if(!msgs.length)return;
    const lastMsg=msgs[msgs.length-1];
    if(_lastKnownChatTs===0){_lastKnownChatTs=lastMsg.ts;return;}
    if(lastMsg.ts>_lastKnownChatTs&&lastMsg.uid!==srvState.myId){
      _lastKnownChatTs=lastMsg.ts;
      showChatNotifBanner(lastMsg.name||'Someone',lastMsg.text||'');
    }
  }catch(e){}
}

// ---- SOLO SHELL TEAM CHAT (server mode) ----
async function renderSoloChat(){
  if(!srvState.connected||!srvState.activeProjId)return;
  const chat=await _withServerCreds(CFG_URL,CFG_KEY,()=>fbGet('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/chat'))||{};
  const msgs=Object.values(chat).sort((a,b)=>a.ts-b.ts);
  const el=document.getElementById('solo-chat-msgs');if(!el)return;
  // Detect new messages since last render
  const latestTs=msgs.length?msgs[msgs.length-1].ts:0;
  const hadNew=latestTs>_lastKnownChatTs&&_lastKnownChatTs>0;
  const newFromOther=msgs.filter(m=>m.ts>_lastKnownChatTs&&m.uid!==srvState.myId);
  if(hadNew&&newFromOther.length){playChatSound('incoming');}
  _lastKnownChatTs=latestTs||_lastKnownChatTs;
  const wasAtBottom=el.scrollTop>=el.scrollHeight-el.clientHeight-30;
  el.innerHTML=msgs.map(m=>{
    const mine=m.uid===srvState.myId;
    return`<div class="srv-msg${mine?' mine':' theirs'}">
      ${!mine?`<div class="srv-msg-name">${escHtml(m.name)}</div>`:''}
      <div class="srv-msg-text">${escHtml(m.text)}</div>
      <div class="srv-msg-time">${new Date(m.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
    </div>`;
  }).join('');
  if(wasAtBottom||msgs.length<=1)el.scrollTop=el.scrollHeight;
  // Poll typing indicator
  await _pollTypingIndicator();
}

async function sendSoloSrvMsg(){
  const inp=document.getElementById('solo-chat-inp');if(!inp)return;
  const text=inp.value.trim();if(!text)return;
  inp.value='';
  clearTimeout(_typingTimeout);
  await _setTyping(false);
  _lastTypingTs=0;
  const id='msg_'+Date.now();
  await _withServerCreds(CFG_URL,CFG_KEY,()=>fbSet('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/chat/'+id,{id,text,name:srvState.username,uid:srvState.myId,ts:Date.now()}));
  playChatSound('outgoing');
  await srvBroadcastActivity('chatting');
  _lastKnownChatTs=Date.now();
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
    presEl.innerHTML=online.map(([id,m])=>`<div style="display:flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;border:1px solid ${id===srvState.myId?'var(--accent)':'var(--accent2)'};font-size:9px;color:${id===srvState.myId?'var(--accent)':'var(--accent2)'};letter-spacing:.06em;"><div style="width:4px;height:4px;border-radius:50%;background:currentColor;flex-shrink:0;"></div>${escHtml(m.name)}${m.isHost?` <ion-icon name="flash-sharp" style="font-size:10px;pointer-events:none;"></ion-icon>`:''}</div>`).join('');
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
        <button class="rc-action-btn" onclick="event.stopPropagation();exportServerRoot('${id}')"><ion-icon name="cloud-download-sharp" style="font-size:11px;pointer-events:none;"></ion-icon> Export</button>
        ${srvState.isHost?`<button class="rc-action-btn" title="Edit project info" onclick="event.stopPropagation();openEditProjectMeta('${id}')"><ion-icon name="create-sharp" style="font-size:11px;pointer-events:none;"></ion-icon> Info</button>`:''}
        ${srvState.isHost?`<button class="rc-action-btn" title="Delete project" onclick="event.stopPropagation();deleteSrvProject('${id}')" style="color:var(--accent3);"><ion-icon name="trash-sharp" style="font-size:11px;pointer-events:none;"></ion-icon> Delete</button>`:''}
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
  if(false){
    openModal('Publish to Server',`<p style="font-size:11px;color:var(--text2);line-height:1.7;margin-bottom:10px;">To publish <strong style="color:var(--accent);">${escHtml(root.name)}</strong> to a server, you first need to configure a Supabase database and connect to or host a server.</p>`,[
      {label:'Cancel',action:closeModal},{label:'OK',action:closeModal,accent:true}
    ]);
    return;
  }
  if(!srvState.connected){
    openModal('Publish to Server',`<p style="font-size:11px;color:var(--text2);line-height:1.7;margin-bottom:10px;">To publish <strong style="color:var(--accent);">${escHtml(root.name)}</strong> to a server, you need to host or join a server first as the host.</p>`,[
      {label:'Cancel',action:closeModal},{label:'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Open Server Hub',action:()=>{closeModal();openServerHub();},accent:true}
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
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:2px;padding:10px 12px;font-size:10px;color:var(--text3);"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> ${(data.scripts||[]).length} scripts · ${(data.bugs||[]).length} bugs · ${(data.assets||[]).length} assets will be copied</div>
  `,[{label:'Cancel',action:closeModal},{label:'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Host It',action:async()=>{
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
async function openCreateServerProject(){
  if(!(await canMember('canCreateProject','You don\'t have permission to create projects')))return;
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
  const _raUrl=CFG_URL;const _raKey=CFG_KEY;
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
  const _rUrl=CFG_URL;const _rKey=CFG_KEY;
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
  srvState={...srvState,connected:true,serverKey:sv.serverKey,serverName:sv.serverName,isHost:true,myId:sv.myId,_dbUrl:CFG_URL,_dbKey:CFG_KEY};
  await openEditProjectMeta(projId);
  // Restore after modal opens (modal is async so srvState will be used inside)
  // We restore on close via renderActiveServer which re-reads srvState
}

async function deleteSrvProject(id){
  if(!srvState.isHost){toast('Only the host can delete projects');return;}
  const proj=speProjData&&speProjData.id===id?speProjData:(await fbGet('/servers/'+srvState.serverKey+'/projects/'+id));
  const projName=proj?.name||'this project';
  const code=Math.floor(100000+Math.random()*900000)+'';
  openModal('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Delete Server Project',`
    <div style="background:rgba(240,74,74,.08);border:1px solid var(--accent3);border-radius:2px;padding:10px 12px;margin-bottom:14px;font-size:10px;color:var(--accent3);line-height:1.7;letter-spacing:.04em;">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>This will permanently delete <strong>${escHtml(projName)}</strong> and ALL its data from the server. This cannot be undone.
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

// ---- DB SYNC: re-check servers when tab regains visibility or focus ----
// Catches Opera, cross-browser tab switches, and device changes
(function initServerSyncListeners(){
  let _lastSync = 0;
  const SYNC_COOLDOWN = 15000; // 15s minimum between syncs

  function _syncIfStale(){
    if(!currentUser || !CFG_URL) return;
    const now = Date.now();
    if(now - _lastSync < SYNC_COOLDOWN) return;
    _lastSync = now;

    // Always re-sync the root My Servers grid
    renderRootMyServers();

    // If the hub overlay is open, also refresh the Mine tab lists
    const hub = document.getElementById('server-hub-overlay');
    if(hub && hub.style.display !== 'none'){
      loadCreatedServers();
      loadJoinedServers();
      loadRecentServers();
    }
  }

  // Fires when tab becomes visible again (Opera, Chrome, Firefox, Safari)
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible') _syncIfStale();
  });

  // Fires when window regains focus (covers Opera's edge cases)
  window.addEventListener('focus', _syncIfStale);

  // Fires on back/forward navigation (bfcache restore — Opera specific)
  window.addEventListener('pageshow', (e)=>{
    if(e.persisted) _syncIfStale(); // persisted = restored from bfcache
  });
})();