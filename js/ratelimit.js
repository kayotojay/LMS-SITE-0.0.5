// LMS Dev Hub — ratelimit.js
// Rate limiting helpers (localStorage, client-side)

// LMS Dev Hub — ratelimit.js
// ========================================

// =====================================================
// RATE LIMITING HELPERS (localStorage, client-side)
// =====================================================
function getRateLimitData(key){
  try{const r=localStorage.getItem('lms_rl_'+key);return r?JSON.parse(r):{attempts:[]};}catch(e){return{attempts:[]};}
}
function saveRateLimitData(key,data){try{localStorage.setItem('lms_rl_'+key,JSON.stringify(data));}catch(e){}}

function checkRateLimit(key,maxAttempts,windowDays){
  const windowMs=windowDays*24*60*60*1000;
  const now=Date.now();
  const data=getRateLimitData(key);
  const recent=(data.attempts||[]).filter(t=>now-t<windowMs);
  const allowed=recent.length<maxAttempts;
  let daysLeft=0;
  if(!allowed){
    const oldest=Math.min(...recent);
    daysLeft=Math.ceil((oldest+windowMs-now)/(24*60*60*1000));
  }
  return{allowed,used:recent.length,max:maxAttempts,daysLeft};
}

function bumpRateLimit(key,maxAttempts,windowDays){
  const windowMs=windowDays*24*60*60*1000;
  const now=Date.now();
  const data=getRateLimitData(key);
  const recent=(data.attempts||[]).filter(t=>now-t<windowMs);
  recent.push(now);
  saveRateLimitData(key,{attempts:recent});
}


function switchLoginTab(tab){
  document.getElementById('lpanel-login').style.display=tab==='login'?'block':'none';
  document.getElementById('lpanel-create').style.display=tab==='create'?'block':'none';
  const loginStyle='flex:1;background:linear-gradient(135deg,rgba(200,240,74,.1),rgba(74,240,200,.05));border:none;border-right:1px solid var(--border);color:var(--accent);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;';
  const inactiveStyle='flex:1;background:var(--bg2);border:none;border-right:1px solid var(--border);color:var(--text3);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;';
  document.getElementById('ltab-login').style.cssText=tab==='login'?loginStyle:inactiveStyle;
  document.getElementById('ltab-create').style.cssText=tab==='create'?loginStyle.replace('border-right:1px solid var(--border);',''):inactiveStyle.replace('border-right:1px solid var(--border);','');
}

function showLoginError(msg){
  const el=document.getElementById('login-error');el.textContent=msg;el.style.display='block';
}
function hideLoginError(){document.getElementById('login-error').style.display='none';}

let pendingAccount=null;
let pendingVerifyUid=null; // for email login verification

async function doLogin(){
  if(!getSrvDbUrl()){
    document.getElementById('login-db-warning').style.display='block';
    showLoginError('Please set SUPABASE_URL and SUPABASE_ANON_KEY in the script first.');return;
  }
  const identifier=document.getElementById('li-username').value.trim();
  const password=document.getElementById('li-password').value;
  if(!identifier||!password){showLoginError('Fill in all fields.');return;}
  hideLoginError();
  const passHash=await hashPass(password);
  const accounts=await fbGet('/accounts')||{};
  // Match by username OR email
  let entry=Object.values(accounts).find(a=>a.username.toLowerCase()===identifier.toLowerCase());
  if(!entry&&identifier.includes('@')){
    entry=Object.values(accounts).find(a=>a.email&&a.email===identifier.toLowerCase());
  }
  if(!entry){showLoginError('Account not found. Create one first.');return;}
  if(entry.passHash!==passHash){showLoginError('Wrong password.');return;}
  // Login success
  currentUser={uid:entry.uid,username:entry.username,displayName:entry.displayName||entry.username,email:entry.email||''};
  localStorage.setItem('lms_session',JSON.stringify(currentUser));
  document.getElementById('login-screen').style.display='none';
  document.getElementById('root-screen-wrap').style.display='block';
  updateAccountChip();
  renderRootGrid();
  addLogoutBtn();
  toast('Welcome back, '+(entry.displayName||entry.username)+'!');
}

async function doCreateAccount(){
  if(!getSrvDbUrl()){
    document.getElementById('login-db-warning').style.display='block';
    showLoginError('Please set SUPABASE_URL and SUPABASE_ANON_KEY in the script first.');return;
  }
  const username=document.getElementById('ca-username').value.trim();
  const displayName=document.getElementById('ca-displayname').value.trim()||username;
  const email=document.getElementById('ca-email').value.trim().toLowerCase();
  const password=document.getElementById('ca-password').value;
  const password2=document.getElementById('ca-password2').value;
  if(!username||!password){showLoginError('Fill in all fields.');return;}
  if(password!==password2){showLoginError('Passwords do not match.');return;}
  if(username.length<2){showLoginError('Username must be at least 2 characters.');return;}
  if(!/^[a-zA-Z0-9_.-]+$/.test(username)){showLoginError('Username can only contain letters, numbers, _ . -');return;}
  // Password strength check
  const pwStrength=getPwStrength(password);
  if(pwStrength.score<4){showLoginError('Password too weak. Need: 8+ chars, uppercase, lowercase, number, and a special character.');return;}
  // If email provided, send verification code first
  if(email){
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){showLoginError('Enter a valid email address.');return;}
    // Stash pending account data and request verification
    pendingAccount={username,displayName,email,password};
    await sendEmailVerification(email,'create');
    return;
  }
  hideLoginError();
  await _finalizeCreateAccount(username,displayName,email,password);
}

async function _finalizeCreateAccount(username,displayName,email,password){
  hideLoginError();
  const passHash=await hashPass(password);
  const accounts=await fbGet('/accounts')||{};
  const taken=Object.values(accounts).some(a=>a.username.toLowerCase()===username.toLowerCase());
  if(taken){showLoginError('Username already taken. Choose another.');return;}
  if(email){
    const emailTaken=Object.values(accounts).some(a=>a.email&&a.email===email.toLowerCase());
    if(emailTaken){showLoginError('Email already linked to an account.');return;}
  }
  const uid='uid_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
  await fbSet('/accounts/'+uid,{uid,username,displayName:displayName||username,email:email||'',passHash,createdAt:Date.now()});
  currentUser={uid,username,displayName:displayName||username,email:email||''};
  localStorage.setItem('lms_session',JSON.stringify(currentUser));
  document.getElementById('login-screen').style.display='none';
  document.getElementById('root-screen-wrap').style.display='block';
  updateAccountChip();
  renderRootGrid();
  addLogoutBtn();
  toast('Account created! Welcome, '+(displayName||username)+'!');
}

function logoutUser(){
  currentUser=null;
  localStorage.removeItem('lms_session');
  localStorage.removeItem('lms_active_server');
  localStorage.removeItem('lms_multi_servers');
  // Disconnect all servers
  multiServers.forEach(sv=>{
    if(sv.pollInterval)clearInterval(sv.pollInterval);
    if(sv.myId&&getSrvDbUrl())fbDelete('/servers/'+sv.serverKey+'/members/'+sv.myId);
  });
  multiServers.length=0;
  // Disconnect srvState if connected
  if(srvState.connected){
    if(srvState.serverKey&&srvState.myId&&getSrvDbUrl()) fbDelete('/servers/'+srvState.serverKey+'/members/'+srvState.myId);
    stopSrvPolling();
    _srvMetaCache=null;_srvMetaCacheKey=null;srvState={connected:false,serverKey:null,serverName:null,username:null,isHost:false,pollInterval:null,chatPollInterval:null,activeProjId:null,activeTab:'tasks',myId:null,lastChatTs:0,shortId:''};
  }
  document.getElementById('root-screen-wrap').style.display='none';
  document.getElementById('app-shell').classList.remove('visible');
  document.getElementById('login-screen').style.display='flex';
}

// Add logout button to root screen header actions (called after DOM ready)
function addLogoutBtn(){
  // Update account chip
  updateAccountChip();
}

function updateAccountChip(){
  if(!currentUser)return;
  const nameEl=document.getElementById('rs-acct-name');
  const handleEl=document.getElementById('rs-acct-handle');
  const avatarEl=document.getElementById('rs-avatar');
  if(nameEl)nameEl.textContent=currentUser.displayName||currentUser.username;
  if(handleEl)handleEl.textContent='@'+currentUser.username;
  if(avatarEl)avatarEl.textContent=(currentUser.displayName||currentUser.username).charAt(0).toUpperCase();
}

// =====================================================