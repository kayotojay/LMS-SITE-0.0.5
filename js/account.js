// LMS Dev Hub — account.js
// ========================================

// =====================================================
// ACCOUNT SYSTEM
// =====================================================
let currentUser = null; // {uid, username, displayName, email}

// =====================================================
// EMAIL VERIFICATION SYSTEM
// =====================================================
// Uses EmailJS to send real verification codes to the user's email.

async function sendEmailVerification(email, purpose){
  const code=String(Math.floor(100000+Math.random()*900000));
  const key=email.replace(/\./g,'_').replace(/@/g,'__at__');
  const expires=Date.now()+15*60*1000;
  // Delete any existing code first then insert fresh
  await fbDelete('/emailCodes/'+key);
  const saved=await fbSet('/emailCodes/'+key,{email_key:key,code,expires:String(expires),purpose,email});
  if(!saved){toast('Failed to save verification code. Check Supabase setup.');return;}
  const expireTime=new Date(expires).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  try{
    await emailjs.send('service_q9zwg4r','template_r32426f',{
      to_email: email,
      passcode: code,
      time: expireTime
    });
  }catch(err){
    console.error('EmailJS error:',err);
    toast('Failed to send verification email. Please try again.');
    await fbDelete('/emailCodes/'+key);
    return;
  }
  showEmailCodePanel(email, purpose);
}

function showEmailCodePanel(email, purpose){
  // Replace the login form with a verification panel
  const loginBody=document.getElementById('login-body-wrap');
  loginBody.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:24px;text-align:left;">
      <div style="font-family:var(--vt);font-size:18px;color:var(--accent2);margin-bottom:6px;letter-spacing:.08em;">VERIFY EMAIL</div>
      <div style="font-size:10px;color:var(--text3);margin-bottom:20px;line-height:1.7;">
        A 6-digit OTP has been sent to <strong style="color:var(--text);">${escHtml(email)}</strong>.<br>
        <span style="font-size:9px;color:var(--text3);">Check your inbox and enter the code below. Valid for 15 minutes.</span>
      </div>
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:6px;">ENTER OTP</label>
      <input id="verify-code-inp" class="modal-inp" placeholder="6-digit code" maxlength="6" style="letter-spacing:.2em;font-size:16px;text-align:center;margin-bottom:14px;" onkeydown="if(event.key==='Enter')submitVerifyCode('${escHtml(email)}','${escHtml(purpose)}')">
      <div id="verify-error" style="display:none;background:rgba(240,74,74,.1);border:1px solid var(--accent3);border-radius:3px;padding:8px 12px;margin-bottom:10px;font-size:10px;color:var(--accent3);"></div>
      <button onclick="submitVerifyCode('${escHtml(email)}','${escHtml(purpose)}')" class="btn accent" style="width:100%;padding:10px;font-size:11px;letter-spacing:.1em;">Verify →</button>
      <button onclick="resetLoginScreen()" style="background:none;border:none;color:var(--text3);font-family:var(--font);font-size:10px;cursor:pointer;margin-top:12px;width:100%;letter-spacing:.06em;">← Back</button>
    </div>`;
}

async function submitVerifyCode(email, purpose){
  const entered=(document.getElementById('verify-code-inp').value||'').trim();
  const errEl=document.getElementById('verify-error');
  if(!entered||entered.length!==6){errEl.textContent='Enter the 6-digit code.';errEl.style.display='block';return;}
  const key=email.replace(/\./g,'_').replace(/@/g,'__at__');
  const stored=await fbGet('/emailCodes/'+key);
  if(!stored){errEl.textContent='Code expired or not found. Try again.';errEl.style.display='block';return;}
  if(Date.now()>Number(stored.expires)){errEl.textContent='Code expired. Try again.';errEl.style.display='block';await fbDelete('/emailCodes/'+key);return;}
  if(stored.code!==entered){errEl.textContent='Wrong code. Try again.';errEl.style.display='block';return;}
  // Code valid — delete it
  await fbDelete('/emailCodes/'+key);
  errEl.style.display='none';
  if(purpose==='create'&&pendingAccount){
    const {username,displayName,email:pEmail,password}=pendingAccount;
    pendingAccount=null;
    resetLoginScreen();
    await _finalizeCreateAccount(username,displayName,pEmail,password);
  } else if(purpose==='link'&&currentUser){
    // Link email to existing account
    const uid=currentUser.uid;
    await fbPatch('/accounts/'+uid,{email:email});
    currentUser.email=email;
    localStorage.setItem('lms_session',JSON.stringify(currentUser));
    resetLoginScreen();
    toast('Email linked: '+email);
    closeAccountSettings();
    renderAccountSettings();
  }
}

function resetLoginScreen(){
  const loginBody=document.getElementById('login-body-wrap');
  loginBody.innerHTML=`
    <div id="login-error" style="display:none;background:rgba(240,74,74,.1);border:1px solid var(--accent3);border-radius:3px;padding:8px 12px;margin-bottom:12px;font-size:10px;color:var(--accent3);letter-spacing:.06em;"></div>
    <div id="login-tabs" style="display:flex;gap:0;margin-bottom:20px;border:1px solid var(--border);border-radius:3px;overflow:hidden;">
      <button id="ltab-login" onclick="switchLoginTab('login')" style="flex:1;background:linear-gradient(135deg,rgba(200,240,74,.1),rgba(74,240,200,.05));border:none;border-right:1px solid var(--border);color:var(--accent);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;">Sign In</button>
      <button id="ltab-create" onclick="switchLoginTab('create')" style="flex:1;background:var(--bg2);border:none;color:var(--text3);font-family:var(--font);font-size:10px;padding:10px;cursor:pointer;letter-spacing:.08em;">Create Account</button>
    </div>
    <div id="lpanel-login" style="background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:20px;">
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:4px;text-align:left;">USERNAME OR EMAIL</label>
      <input id="li-username" class="modal-inp" placeholder="Username or email" style="margin-bottom:10px;" onkeydown="if(event.key==='Enter')document.getElementById('li-password').focus()">
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:4px;text-align:left;">PASSWORD</label>
      <input id="li-password" class="modal-inp" type="password" placeholder="Your password" style="margin-bottom:16px;" onkeydown="if(event.key==='Enter')doLogin()">
      <button onclick="doLogin()" class="btn accent" style="width:100%;padding:10px;font-size:11px;letter-spacing:.1em;">Sign In →</button>
      <div style="text-align:center;margin-top:12px;">
        <button onclick="showForgotPassword()" style="background:none;border:none;color:var(--text3);font-family:var(--font);font-size:9px;cursor:pointer;letter-spacing:.08em;" onmouseover="this.style.color='var(--accent2)'" onmouseout="this.style.color='var(--text3)'">Forgot Password?</button>
      </div>
    </div>
    <div id="lpanel-create" style="display:none;background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:20px;">
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:4px;text-align:left;">USERNAME <span style="color:var(--text3);font-size:8px;">(login ID — no spaces)</span></label>
      <input id="ca-username" class="modal-inp" placeholder="e.g. devslash, xcommand3r" style="margin-bottom:10px;">
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:4px;text-align:left;">DISPLAY NAME <span style="color:var(--text3);font-size:8px;">(shown to others)</span></label>
      <input id="ca-displayname" class="modal-inp" placeholder="e.g. Slash, Dev X, Commander" style="margin-bottom:10px;">
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:4px;text-align:left;">EMAIL <span style="color:var(--text3);font-size:8px;">(optional — enables email sign-in)</span></label>
      <input id="ca-email" class="modal-inp" type="email" placeholder="your@email.com" style="margin-bottom:10px;">
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:4px;text-align:left;">PASSWORD</label>
      <input id="ca-password" class="modal-inp" type="password" placeholder="Choose a password" style="margin-bottom:10px;">
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:4px;text-align:left;">CONFIRM PASSWORD</label>
      <input id="ca-password2" class="modal-inp" type="password" placeholder="Confirm password" style="margin-bottom:16px;">
      <button onclick="doCreateAccount()" class="btn accent" style="width:100%;padding:10px;font-size:11px;letter-spacing:.1em;">Create Account →</button>
      <div style="font-size:9px;color:var(--text3);margin-top:10px;line-height:1.6;">Requires a Firebase DB. Your account is stored in the shared database.</div>
    </div>`;
}

// =====================================================
// ACCOUNT SETTINGS MODAL
// =====================================================
function openAccountSettings(){
  const modal=document.getElementById('account-settings-modal');
  if(modal){modal.style.display='flex';renderAccountSettings();return;}
  // Create modal dynamically
  const m=document.createElement('div');
  m.id='account-settings-modal';
  m.style.cssText='display:flex;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:6000;align-items:center;justify-content:center;overflow-y:auto;';
  m.innerHTML=`
    <div style="max-width:420px;width:93%;padding:20px 24px 40px;">
      <div style="font-family:var(--vt);font-size:32px;color:var(--accent);letter-spacing:.1em;margin-bottom:6px;">ACCOUNT</div>
      <div style="font-size:9px;color:var(--text3);letter-spacing:.25em;margin-bottom:28px;">PROFILE & SETTINGS</div>
      <div id="acct-settings-body"></div>
      <div style="text-align:center;margin-top:20px;">
        <button onclick="closeAccountSettings()" style="background:none;border:none;color:var(--text3);font-family:var(--font);font-size:10px;cursor:pointer;letter-spacing:.08em;"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="display:inline-block;vertical-align:middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  renderAccountSettings();
}

function closeAccountSettings(){
  const m=document.getElementById('account-settings-modal');
  if(m)m.style.display='none';
}
function openDataDisclaimer(){
  const existing=document.getElementById('data-disclaimer-modal');
  if(existing){existing.style.display='flex';return;}
  const m=document.createElement('div');
  m.id='data-disclaimer-modal';
  m.style.cssText='display:flex;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:7500;align-items:center;justify-content:center;overflow-y:auto;';
  m.innerHTML=`
    <div style="max-width:440px;width:93%;padding:28px 26px 32px;background:var(--bg);border:1px solid rgba(240,200,74,.3);border-radius:3px;box-shadow:0 0 40px rgba(0,0,0,.6);">
      <div style="font-family:var(--vt);font-size:22px;color:rgba(240,200,74,.9);letter-spacing:.12em;margin-bottom:4px;">! IMPORTANT</div>
      <div style="font-size:8px;color:var(--text3);letter-spacing:.25em;margin-bottom:22px;">HOW YOUR DATA IS STORED</div>

      <div style="display:flex;flex-direction:column;gap:12px;">

        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:2px;padding:14px 16px;">
          <div style="font-size:8px;color:var(--text3);letter-spacing:.2em;margin-bottom:8px;">LOCAL PROJECTS</div>
          <div style="font-size:10px;color:var(--text2);line-height:1.75;">
            Projects you create locally are stored in <span style="color:var(--accent);font-family:var(--vt);">this browser's localStorage</span> only. They are tied to the account you are logged into <em>on this specific browser and machine</em>.
          </div>
          <div style="margin-top:8px;font-size:9px;color:rgba(240,200,74,.7);line-height:1.6;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Switching to a different browser, a different device, or logging into a new account will <strong style="color:rgba(240,200,74,.95);">not</strong> carry over your local projects. They stay on the machine and browser they were created on.
          </div>
        </div>

        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:2px;padding:14px 16px;">
          <div style="font-size:8px;color:var(--text3);letter-spacing:.2em;margin-bottom:8px;">SERVER BACKUPS</div>
          <div style="font-size:10px;color:var(--text2);line-height:1.75;">
            Server backups and timed snapshots are also stored <span style="color:var(--accent);font-family:var(--vt);">locally per browser</span>. A backup taken in Chrome will not appear in Firefox, and vice versa — even on the same account.
          </div>
          <div style="margin-top:8px;font-size:9px;color:rgba(240,200,74,.7);line-height:1.6;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Always use the same browser if you want your backup history to remain accessible.
          </div>
        </div>

        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:2px;padding:14px 16px;">
          <div style="font-size:8px;color:var(--text3);letter-spacing:.2em;margin-bottom:8px;">DATABASE & ACCOUNTS</div>
          <div style="font-size:10px;color:var(--text2);line-height:1.75;">
            Your account, servers, and server projects are stored in the <span style="color:var(--accent2);font-family:var(--vt);">Supabase database</span> you have configured — these are accessible from any browser or device as long as you use the same DB credentials.
          </div>
          <div style="margin-top:8px;font-size:9px;color:rgba(240,74,74,.8);line-height:1.6;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>When switching accounts, always ensure the correct Supabase URL and anon key are configured. Using the wrong database on a different account can create duplicate entries, cause data conflicts, or trigger unintended deletions.
          </div>
        </div>

        <div style="background:rgba(74,240,200,.04);border:1px solid rgba(74,240,200,.15);border-radius:2px;padding:10px 14px;">
          <div style="font-size:9px;color:var(--text3);line-height:1.7;letter-spacing:.04em;">
            <span style="color:var(--accent2);"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Safe across browsers:</span> Account login, server data, server projects, member list<br>
            <span style="color:rgba(240,200,74,.8);"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Browser-local only:</span> Local projects, server backups, pass cache, settings
          </div>
        </div>

      </div>

      <div style="text-align:center;margin-top:22px;">
        <button onclick="document.getElementById('data-disclaimer-modal').style.display='none'" style="background:none;border:none;color:var(--text3);font-family:var(--font);font-size:10px;cursor:pointer;letter-spacing:.08em;"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="display:inline-block;vertical-align:middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Got it, close</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  // Close on backdrop click
  m.addEventListener('click',e=>{if(e.target===m)m.style.display='none';});
}
function renderAccountSettings(){
  const el=document.getElementById('acct-settings-body');if(!el||!currentUser)return;
  const emailRl=currentUser.uid?checkRateLimit('email_'+currentUser.uid,3,25):{allowed:true,used:0,max:3};
  const passRl=currentUser.uid?checkRateLimit('pass_'+currentUser.uid,3,25):{allowed:true,used:0,max:3};
  el.innerHTML=`
    <!-- Profile -->
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:18px;margin-bottom:14px;">
      <div style="font-size:8px;color:var(--text3);letter-spacing:.22em;margin-bottom:14px;">PROFILE</div>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border);">
        <div style="width:44px;height:44px;border-radius:3px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-family:var(--vt);font-size:26px;color:#000;flex-shrink:0;">${escHtml((currentUser.displayName||currentUser.username).charAt(0).toUpperCase())}</div>
        <div>
          <div style="font-family:var(--vt);font-size:18px;color:var(--text);">${escHtml(currentUser.displayName||currentUser.username)}</div>
          <div style="font-size:9px;color:var(--text3);">@${escHtml(currentUser.username)}</div>
          ${currentUser.email?`<div style="font-size:9px;color:var(--accent2);margin-top:2px;"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg> ${escHtml(currentUser.email)}</div>`:''}
        </div>
      </div>
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:4px;">DISPLAY NAME</label>
      <div style="display:flex;gap:6px;margin-bottom:12px;">
        <input id="acct-dispname-inp" class="modal-inp" style="flex:1;margin:0;" value="${escHtml(currentUser.displayName||currentUser.username)}" placeholder="Display name">
        <button onclick="saveDisplayName()" class="btn accent" style="white-space:nowrap;">Save</button>
      </div>
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:4px;">EMAIL ${currentUser.email?'<span style="color:var(--accent);font-size:8px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>LINKED</span>':'<span style="color:var(--text3);font-size:8px;">(not linked)</span>'} <span style="color:var(--text3);font-size:8px;">${emailRl.used}/${emailRl.max} changes in 25 days</span></label>
      ${currentUser.email
        ? `<div style="font-size:10px;color:var(--text2);margin-bottom:8px;">${escHtml(currentUser.email)}</div>
           <div style="display:flex;gap:6px;flex-wrap:wrap;">
             ${emailRl.allowed
               ? `<button onclick="promptChangeEmail()" class="btn" style="color:var(--accent2);border-color:var(--accent2);">Change Email</button>`
               : `<div style="font-size:9px;color:var(--accent3);">Email change limit reached. Try again in ${emailRl.daysLeft} day(s).</div>`
             }
             <button onclick="unlinkEmail()" style="background:none;border:1px solid var(--accent3);color:var(--accent3);font-family:var(--font);font-size:9px;padding:3px 10px;cursor:pointer;border-radius:1px;letter-spacing:.06em;">Unlink</button>
           </div>`
        : emailRl.allowed
          ? `<button onclick="promptLinkEmail()" class="btn" style="color:var(--accent2);border-color:var(--accent2);">Link Email Address</button>`
          : `<div style="font-size:9px;color:var(--accent3);">Email change limit reached. Try again in ${emailRl.daysLeft} day(s).</div>`
      }
    </div>
    <!-- Change Password -->
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:18px;margin-bottom:14px;">
      <div style="font-size:8px;color:var(--text3);letter-spacing:.22em;margin-bottom:14px;">CHANGE PASSWORD <span style="color:var(--text3);font-size:8px;font-family:var(--font);">${passRl.used}/${passRl.max} changes in 25 days</span></div>
      ${passRl.allowed
        ? `<button onclick="promptChangePassword()" class="btn accent" style="width:100%;padding:9px;font-size:11px;letter-spacing:.1em;">Change Password</button>`
        : `<div style="font-size:9px;color:var(--accent3);">Password change limit reached (3 per 25 days). Try again in ${passRl.daysLeft} day(s).</div>`}
    </div>
    <!-- Database -->
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:18px;margin-bottom:14px;">
      <div style="font-size:8px;color:var(--text3);letter-spacing:.22em;margin-bottom:14px;">DATABASE</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="min-width:0;flex:1;">
          <div style="font-size:11px;color:var(--text);margin-bottom:2px;">Supabase Database</div>
          <div style="font-size:9px;color:var(--text3);word-break:break-all;margin-top:2px;"><span style="color:var(--accent);"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Connected to shared database</span></div>
        </div>
        
      </div>
            <div style="margin-top:10px;padding:8px 10px;background:rgba(240,200,74,.06);border:1px solid rgba(240,200,74,.18);border-radius:2px;font-size:8px;color:rgba(240,200,74,.75);line-height:1.7;letter-spacing:.04em;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Each account should use the same Supabase project URL and key across all browsers. Using a different DB on the same account will create duplicate entries and may cause unexpected deletions or data conflicts.
      </div>
    </div>
    <!-- Danger zone -->
    <div style="background:var(--bg2);border:1px solid rgba(240,74,74,.3);border-radius:3px;padding:18px;">
      <div style="font-size:8px;color:var(--accent3);letter-spacing:.22em;margin-bottom:14px;">DANGER ZONE</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:12px;border-bottom:1px solid rgba(240,74,74,.15);margin-bottom:12px;">
        <div>
          <div style="font-size:11px;color:var(--text);margin-bottom:2px;">Sign Out</div>
          <div style="font-size:9px;color:var(--text3);">End your current session</div>
        </div>
        <button onclick="closeAccountSettings();logoutUser();" style="background:none;border:1px solid var(--border2);color:var(--text);font-family:var(--font);font-size:9px;padding:5px 12px;cursor:pointer;border-radius:1px;letter-spacing:.06em;white-space:nowrap;" onmouseover="this.style.borderColor='var(--accent3)';this.style.color='var(--accent3)'" onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--text)'">→ Sign Out</button>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-size:11px;color:var(--text);margin-bottom:2px;">Delete Account</div>
          <div style="font-size:9px;color:var(--text3);">Permanently removes your account and all data</div>
        </div>
        <button onclick="confirmDeleteAccount()" style="background:none;border:1px solid var(--accent3);color:var(--accent3);font-family:var(--font);font-size:9px;padding:5px 12px;cursor:pointer;border-radius:1px;letter-spacing:.06em;white-space:nowrap;">Delete Account</button>
      </div>
    </div>`;
}

async function saveDisplayName(){
  const val=(document.getElementById('acct-dispname-inp').value||'').trim();
  if(!val){toast('Display name cannot be empty');return;}
  await fbPatch('/accounts/'+currentUser.uid,{displayName:val});
  currentUser.displayName=val;
  localStorage.setItem('lms_session',JSON.stringify(currentUser));
  toast('Display name updated: '+val);
  renderAccountSettings();
  updateAccountChip();
  // Update presence if on server
  if(srvState.connected&&srvState.myId){
    await fbPatch('/servers/'+srvState.serverKey+'/members/'+srvState.myId,{name:val});
    srvState.username=val;
  }
}

function promptChangePassword(){
  // Password strength criteria:
  // - 8+ chars, uppercase, lowercase, number, special char
  openModal('Change Password',`
    <label class="modal-label">CURRENT PASSWORD</label>
    <input id="pcp-current" class="modal-inp" type="password" placeholder="Your current password" style="margin-bottom:10px;">
    <label class="modal-label">NEW PASSWORD</label>
    <input id="pcp-new1" class="modal-inp" type="password" placeholder="New password" oninput="checkPwStrength(this.value)" style="margin-bottom:6px;">
    <div id="pcp-strength-bar" style="height:3px;border-radius:2px;background:var(--border);margin-bottom:4px;"><div id="pcp-strength-fill" style="height:3px;border-radius:2px;width:0%;transition:width .3s,background .3s;"></div></div>
    <div id="pcp-strength-hints" style="font-size:9px;color:var(--text3);margin-bottom:10px;line-height:1.8;">
      <span id="ph-len" style="display:block;"><svg width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='var(--text3)' stroke-width='1.5' style='display:inline-block;vertical-align:middle;margin-right:3px;'><circle cx='12' cy='12' r='9'/></svg>At least 8 characters</span>
      <span id="ph-upper" style="display:block;"><svg width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='var(--text3)' stroke-width='1.5' style='display:inline-block;vertical-align:middle;margin-right:3px;'><circle cx='12' cy='12' r='9'/></svg>Uppercase letter (A-Z)</span>
      <span id="ph-lower" style="display:block;"><svg width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='var(--text3)' stroke-width='1.5' style='display:inline-block;vertical-align:middle;margin-right:3px;'><circle cx='12' cy='12' r='9'/></svg>Lowercase letter (a-z)</span>
      <span id="ph-num" style="display:block;"><svg width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='var(--text3)' stroke-width='1.5' style='display:inline-block;vertical-align:middle;margin-right:3px;'><circle cx='12' cy='12' r='9'/></svg>Number (0-9)</span>
      <span id="ph-special" style="display:block;"><svg width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='var(--text3)' stroke-width='1.5' style='display:inline-block;vertical-align:middle;margin-right:3px;'><circle cx='12' cy='12' r='9'/></svg>Special character (!@#$%^&*)</span>
    </div>
    <label class="modal-label">CONFIRM NEW PASSWORD</label>
    <input id="pcp-new2" class="modal-inp" type="password" placeholder="Confirm new password" style="margin-bottom:10px;">
    <div id="pcp-error" style="display:none;background:rgba(240,74,74,.1);border:1px solid var(--accent3);border-radius:3px;padding:8px 12px;font-size:10px;color:var(--accent3);"></div>
  `,[{label:'Cancel',action:closeModal},{label:'Change Password',action:async()=>{
    const current=document.getElementById('pcp-current').value;
    const new1=document.getElementById('pcp-new1').value;
    const new2=document.getElementById('pcp-new2').value;
    const errEl=document.getElementById('pcp-error');
    if(!current||!new1||!new2){errEl.textContent='Fill in all fields.';errEl.style.display='block';return;}
    const strength=getPwStrength(new1);
    if(strength.score<4){errEl.textContent='Password does not meet security requirements. Please check the criteria above.';errEl.style.display='block';return;}
    if(new1!==new2){errEl.textContent='New passwords do not match.';errEl.style.display='block';return;}
    const currentHash=await hashPass(current);
    const acc=await fbGet('/accounts/'+currentUser.uid);
    if(!acc||acc.passHash!==currentHash){errEl.textContent='Current password is incorrect.';errEl.style.display='block';return;}
    const rl=checkRateLimit('pass_'+currentUser.uid,3,25);
    if(!rl.allowed){errEl.textContent='Password change limit reached. Try again in '+rl.daysLeft+' day(s).';errEl.style.display='block';return;}
    bumpRateLimit('pass_'+currentUser.uid,3,25);
    const newHash=await hashPass(new1);
    await fbPatch('/accounts/'+currentUser.uid,{passHash:newHash});
    closeModal();toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Password changed successfully!');openAccountSettings();
  },accent:true}]);
}

function getPwStrength(pw){
  const checks={len:pw.length>=8,upper:/[A-Z]/.test(pw),lower:/[a-z]/.test(pw),num:/[0-9]/.test(pw),special:/[^a-zA-Z0-9]/.test(pw)};
  const score=Object.values(checks).filter(Boolean).length;
  return{score,checks};
}

function checkPwStrength(pw){
  const {score,checks}=getPwStrength(pw);
  const pct=score/5*100;
  const colors=['#f04a4a','#f04a4a','#f0a04a','#f0c84a','#c8f04a','#4af0c8'];
  const fill=document.getElementById('pcp-strength-fill');
  if(fill){fill.style.width=pct+'%';fill.style.background=colors[score]||'#4af0c8';}
  const mark=(ok)=>ok?`<span style='color:var(--accent);'><svg width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round'><polyline points='20 6 9 17 4 12'/></svg></span>`:`<svg width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='var(--text3)' stroke-width='1.5'><circle cx='12' cy='12' r='9'/></svg>`;
  const hints=[
    ['ph-len',mark(checks.len)+' At least 8 characters'],
    ['ph-upper',mark(checks.upper)+' Uppercase letter (A-Z)'],
    ['ph-lower',mark(checks.lower)+' Lowercase letter (a-z)'],
    ['ph-num',mark(checks.num)+' Number (0-9)'],
    ['ph-special',mark(checks.special)+' Special character (!@#$%^&*)'],
  ];
  hints.forEach(([id,html])=>{const el=document.getElementById(id);if(el)el.innerHTML=html;});
}

function checkCaPwStrength(pw){
  const {score,checks}=getPwStrength(pw);
  const pct=score/5*100;
  const colors=['#f04a4a','#f04a4a','#f0a04a','#f0c84a','#c8f04a','#4af0c8'];
  const fill=document.getElementById('ca-pw-fill');
  if(fill){fill.style.width=pct+'%';fill.style.background=colors[score]||'#4af0c8';}
  const hints=[];
  if(!checks.len)hints.push('8+ chars');
  if(!checks.upper)hints.push('uppercase');
  if(!checks.lower)hints.push('lowercase');
  if(!checks.num)hints.push('number');
  if(!checks.special)hints.push('special char');
  const el=document.getElementById('ca-pw-hint');
  if(el){
    if(score>=4){el.textContent='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Strong password';el.style.color='var(--accent)';}
    else if(score>=2){el.textContent='Needs: '+hints.join(', ');el.style.color='var(--accent4)';}
    else{el.textContent='Weak — needs: '+hints.join(', ');el.style.color='var(--accent3)';}
  }
}

async function changePassword(){
  const current=document.getElementById('cp-current').value;
  const new1=document.getElementById('cp-new1').value;
  const new2=document.getElementById('cp-new2').value;
  const errEl=document.getElementById('cp-error');
  if(!current||!new1||!new2){errEl.textContent='Fill in all fields.';errEl.style.display='block';return;}
  if(new1.length<6){errEl.textContent='New password must be at least 6 characters.';errEl.style.display='block';return;}
  if(new1!==new2){errEl.textContent='New passwords do not match.';errEl.style.display='block';return;}
  // Verify current password
  const currentHash=await hashPass(current);
  const acc=await fbGet('/accounts/'+currentUser.uid);
  if(!acc||acc.passHash!==currentHash){errEl.textContent='Current password is incorrect.';errEl.style.display='block';return;}
  // Rate limit
  const rl=checkRateLimit('pass_'+currentUser.uid,3,25);
  if(!rl.allowed){errEl.textContent='Password change limit reached. Try again in '+rl.daysLeft+' day(s).';errEl.style.display='block';return;}
  bumpRateLimit('pass_'+currentUser.uid,3,25);
  const newHash=await hashPass(new1);
  await fbPatch('/accounts/'+currentUser.uid,{passHash:newHash});
  errEl.style.display='none';
  toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Password changed successfully!');
  renderAccountSettings();
}

function promptChangeEmail(){
  openModal('Change Email',`
    <p style="font-size:11px;color:var(--text2);margin-bottom:12px;line-height:1.7;">Enter your new email address. You'll receive a verification code.</p>
    <label class="modal-label">NEW EMAIL ADDRESS</label>
    <input id="prompt-email-inp" class="modal-inp" type="email" placeholder="new@email.com">
    <div id="prompt-email-err" style="display:none;color:var(--accent3);font-size:10px;margin-top:4px;"></div>
  `,[{label:'Cancel',action:closeModal},{label:'Send Verification Code',action:async()=>{
    const newEmail=(document.getElementById('prompt-email-inp').value||'').trim().toLowerCase();
    if(!newEmail||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)){document.getElementById('prompt-email-err').textContent='Enter a valid email.';document.getElementById('prompt-email-err').style.display='block';return;}
    const rl=checkRateLimit('email_'+currentUser.uid,3,25);
    if(!rl.allowed){toast('Email change limit reached. Try again in '+rl.daysLeft+' day(s).');closeModal();return;}
    const accounts=await fbGet('/accounts')||{};
    const taken=Object.values(accounts).some(a=>a.email&&a.email===newEmail&&a.uid!==currentUser.uid);
    if(taken){document.getElementById('prompt-email-err').textContent='Email already linked to another account.';document.getElementById('prompt-email-err').style.display='block';return;}
    bumpRateLimit('email_'+currentUser.uid,3,25);
    if(currentUser.email){const oldKey=currentUser.email.replace(/\./g,'_').replace(/@/g,'__at__');await fbDelete('/emailIndex/'+oldKey);}
    await sendEmailVerification(newEmail,'change_email_'+currentUser.uid);
    closeModal();closeAccountSettings();showChangeEmailVerifyModal(newEmail);
  },accent:true}]);
}

function promptLinkEmail(){
  openModal('Link Email',`
    <p style="font-size:11px;color:var(--text2);margin-bottom:12px;line-height:1.7;">Enter an email address to link to your account. You'll receive a verification code.</p>
    <label class="modal-label">EMAIL ADDRESS</label>
    <input id="prompt-link-email-inp" class="modal-inp" type="email" placeholder="your@email.com">
    <div id="prompt-link-email-err" style="display:none;color:var(--accent3);font-size:10px;margin-top:4px;"></div>
  `,[{label:'Cancel',action:closeModal},{label:'Send Verification Code',action:async()=>{
    const email=(document.getElementById('prompt-link-email-inp').value||'').trim().toLowerCase();
    if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){document.getElementById('prompt-link-email-err').textContent='Enter a valid email.';document.getElementById('prompt-link-email-err').style.display='block';return;}
    const rl=checkRateLimit('email_'+currentUser.uid,3,25);
    if(!rl.allowed){toast('Email change limit reached. Try again in '+rl.daysLeft+' day(s).');closeModal();return;}
    const accounts=await fbGet('/accounts')||{};
    const taken=Object.values(accounts).some(a=>a.email&&a.email===email&&a.uid!==currentUser.uid);
    if(taken){document.getElementById('prompt-link-email-err').textContent='Email already linked to another account.';document.getElementById('prompt-link-email-err').style.display='block';return;}
    bumpRateLimit('email_'+currentUser.uid,3,25);
    await sendEmailVerification(email,'link');
    closeModal();closeAccountSettings();showLinkVerifyModal(email);
  },accent:true}]);
}

async function changeEmail(){
  const newEmail=(document.getElementById('acct-email-change-inp').value||'').trim().toLowerCase();
  if(!newEmail||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)){toast('Enter a valid email');return;}
  // Rate limit
  const rl=checkRateLimit('email_'+currentUser.uid,3,25);
  if(!rl.allowed){toast('Email change limit reached. Try again in '+rl.daysLeft+' day(s).');return;}
  // Check not taken
  const accounts=await fbGet('/accounts')||{};
  const taken=Object.values(accounts).some(a=>a.email&&a.email===newEmail&&a.uid!==currentUser.uid);
  if(taken){toast('Email already linked to another account');return;}
  bumpRateLimit('email_'+currentUser.uid,3,25);
  // Remove old email index
  if(currentUser.email){const oldKey=currentUser.email.replace(/\./g,'_').replace(/@/g,'__at__');await fbDelete('/emailIndex/'+oldKey);}
  // Send verification to new email
  await sendEmailVerification(newEmail,'change_email_'+currentUser.uid);
  closeAccountSettings();
  showChangeEmailVerifyModal(newEmail);
}

function showChangeEmailVerifyModal(email){
  let m=document.getElementById('change-email-verify-modal');
  if(!m){m=document.createElement('div');m.id='change-email-verify-modal';m.style.cssText='display:flex;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:7000;align-items:center;justify-content:center;';document.body.appendChild(m);}
  m.style.display='flex';
  m.innerHTML=`
    <div style="max-width:380px;width:93%;background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:24px;">
      <div style="font-family:var(--vt);font-size:22px;color:var(--accent2);margin-bottom:6px;letter-spacing:.08em;">VERIFY NEW EMAIL</div>
      <div style="font-size:10px;color:var(--text3);margin-bottom:20px;line-height:1.7;">
        A 6-digit OTP was sent to <strong style="color:var(--text);">${escHtml(email)}</strong>.<br>
        <span style="font-size:9px;color:var(--text3);">Valid for 15 minutes.</span>
      </div>
      <input id="ce-verify-inp" class="modal-inp" placeholder="6-digit code" maxlength="6" style="letter-spacing:.2em;font-size:16px;text-align:center;margin-bottom:10px;">
      <div id="ce-verify-error" style="display:none;background:rgba(240,74,74,.1);border:1px solid var(--accent3);border-radius:3px;padding:8px 12px;margin-bottom:10px;font-size:10px;color:var(--accent3);"></div>
      <button onclick="submitChangeEmailVerify('${escHtml(email)}')" class="btn accent" style="width:100%;padding:10px;font-size:11px;letter-spacing:.1em;">Verify & Save Email →</button>
      <button onclick="document.getElementById('change-email-verify-modal').style.display='none'" style="background:none;border:none;color:var(--text3);font-family:var(--font);font-size:10px;cursor:pointer;margin-top:12px;width:100%;letter-spacing:.06em;">Cancel</button>
    </div>`;
}

async function submitChangeEmailVerify(email){
  const entered=(document.getElementById('ce-verify-inp').value||'').trim();
  const errEl=document.getElementById('ce-verify-error');
  if(!entered||entered.length!==6){errEl.textContent='Enter the 6-digit code.';errEl.style.display='block';return;}
  const key=email.replace(/\./g,'_').replace(/@/g,'__at__');
  const stored=await fbGet('/emailCodes/'+key);
  if(!stored){errEl.textContent='Code expired.';errEl.style.display='block';return;}
  if(Date.now()>Number(stored.expires)){errEl.textContent='Code expired.';errEl.style.display='block';await fbDelete('/emailCodes/'+key);return;}
  if(stored.code!==entered){errEl.textContent='Wrong code.';errEl.style.display='block';return;}
  await fbDelete('/emailCodes/'+key);
  await fbPatch('/accounts/'+currentUser.uid,{email});
  currentUser.email=email;
  localStorage.setItem('lms_session',JSON.stringify(currentUser));
  document.getElementById('change-email-verify-modal').style.display='none';
  toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Email updated to '+email);
  openAccountSettings();
}

async function linkEmail(){
  const email=(document.getElementById('acct-email-inp').value||'').trim().toLowerCase();
  if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){toast('Enter a valid email');return;}
  // Rate limit
  const rl=checkRateLimit('email_'+currentUser.uid,3,25);
  if(!rl.allowed){toast('Email change limit reached. Try again in '+rl.daysLeft+' day(s).');return;}
  // Check not taken
  const accounts=await fbGet('/accounts')||{};
  const taken=Object.values(accounts).some(a=>a.email&&a.email===email&&a.uid!==currentUser.uid);
  if(taken){toast('Email already linked to another account');return;}
  bumpRateLimit('email_'+currentUser.uid,3,25);
  await sendEmailVerification(email,'link');
  closeAccountSettings();
  showLinkVerifyModal(email);
}

function showLinkVerifyModal(email){
  let m=document.getElementById('link-verify-modal');
  if(!m){m=document.createElement('div');m.id='link-verify-modal';m.style.cssText='display:flex;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:7000;align-items:center;justify-content:center;';document.body.appendChild(m);}
  const key=email.replace(/\./g,'_').replace(/@/g,'__at__');
  m.style.display='flex';
  // We can't actually retrieve the code here, so we rely on the fbGet
  // Show input for code
  m.innerHTML=`
    <div style="max-width:380px;width:93%;background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:24px;">
      <div style="font-family:var(--vt);font-size:22px;color:var(--accent2);margin-bottom:6px;letter-spacing:.08em;">VERIFY EMAIL</div>
      <div style="font-size:10px;color:var(--text3);margin-bottom:20px;line-height:1.7;">
        A 6-digit OTP has been sent to <strong style="color:var(--text);">${escHtml(email)}</strong>.<br>
        <span style="font-size:9px;color:var(--text3);">Check your inbox and enter the code below. Valid for 15 minutes.</span>
      </div>
      <input id="link-verify-inp" class="modal-inp" placeholder="6-digit code" maxlength="6" style="letter-spacing:.2em;font-size:16px;text-align:center;margin-bottom:10px;">
      <div id="link-verify-error" style="display:none;background:rgba(240,74,74,.1);border:1px solid var(--accent3);border-radius:3px;padding:8px 12px;margin-bottom:10px;font-size:10px;color:var(--accent3);"></div>
      <button onclick="submitLinkVerify('${escHtml(email)}')" class="btn accent" style="width:100%;padding:10px;font-size:11px;letter-spacing:.1em;">Verify →</button>
      <button onclick="document.getElementById('link-verify-modal').style.display='none'" style="background:none;border:none;color:var(--text3);font-family:var(--font);font-size:10px;cursor:pointer;margin-top:12px;width:100%;letter-spacing:.06em;">Cancel</button>
    </div>`;
}


async function submitLinkVerify(email){
  const entered=(document.getElementById('link-verify-inp').value||'').trim();
  const errEl=document.getElementById('link-verify-error');
  if(!entered||entered.length!==6){errEl.textContent='Enter the 6-digit code.';errEl.style.display='block';return;}
  const key=email.replace(/\./g,'_').replace(/@/g,'__at__');
  const stored=await fbGet('/emailCodes/'+key);
  if(!stored){errEl.textContent='Code expired.';errEl.style.display='block';return;}
  if(Date.now()>Number(stored.expires)){errEl.textContent='Code expired.';errEl.style.display='block';await fbDelete('/emailCodes/'+key);return;}
  if(stored.code!==entered){errEl.textContent='Wrong code.';errEl.style.display='block';return;}
  await fbDelete('/emailCodes/'+key);
  await fbPatch('/accounts/'+currentUser.uid,{email});
  currentUser.email=email;
  localStorage.setItem('lms_session',JSON.stringify(currentUser));
  document.getElementById('link-verify-modal').style.display='none';
  toast('Email linked: '+email);
  openAccountSettings();
}

async function unlinkEmail(){
  if(!currentUser.email)return;
  openModal('Unlink Email',`<p style="font-size:11px;color:var(--text2);line-height:1.7;">Remove <strong style="color:var(--accent3);">${escHtml(currentUser.email)}</strong> from your account?</p>`,[
    {label:'Cancel',action:closeModal},{label:'Unlink',action:async()=>{
      const key=currentUser.email.replace(/\./g,'_').replace(/@/g,'__at__');
      await fbDelete('/emailIndex/'+key);
      await fbPatch('/accounts/'+currentUser.uid,{email:''});
      currentUser.email='';
      localStorage.setItem('lms_session',JSON.stringify(currentUser));
      closeModal();closeAccountSettings();openAccountSettings();
      toast('Email unlinked');
    },danger:true}
  ]);
}

async function confirmDeleteAccount(){
  const code=Math.floor(100000+Math.random()*900000)+'';
  openModal('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Delete Account',`
    <div style="background:rgba(240,74,74,.08);border:1px solid var(--accent3);border-radius:2px;padding:10px 12px;margin-bottom:14px;font-size:10px;color:var(--accent3);line-height:1.7;">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>This permanently deletes your account <strong>@${escHtml(currentUser.username)}</strong>. You will be signed out. All your account data will be removed. This cannot be undone.
    </div>
    <p style="font-size:11px;color:var(--text2);margin-bottom:8px;">Type: <strong style="color:var(--accent3);letter-spacing:.1em;">delete ${escHtml(code)}</strong></p>
    <input class="modal-inp" id="del-acct-inp" placeholder="Type confirmation above..." autocomplete="off">
  `,[{label:'Cancel',action:closeModal},{label:'Delete My Account',action:async()=>{
    const typed=(document.getElementById('del-acct-inp').value||'').trim();
    if(typed!=='delete '+code){toast('Confirmation did not match');closeModal();return;}
    // Delete account data
    if(currentUser.email){
      const key=currentUser.email.replace(/\./g,'_').replace(/@/g,'__at__');
      await fbDelete('/emailIndex/'+key);
    }
    await fbDelete('/accounts/'+currentUser.uid);
    closeModal();closeAccountSettings();logoutUser();
    toast('Account deleted. Goodbye.');
  },danger:true}]);
}


// =====================================================
// FORGOT PASSWORD (from login screen)
// =====================================================
function showForgotPassword(){
  const loginBody=document.getElementById('login-body-wrap');
  loginBody.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:24px;text-align:left;">
      <div style="font-family:var(--vt);font-size:18px;color:var(--accent2);margin-bottom:6px;letter-spacing:.08em;">FORGOT PASSWORD</div>
      <div style="font-size:10px;color:var(--text3);margin-bottom:20px;line-height:1.7;">
        Enter your account email. We'll send a 6-digit reset code.<br>
        <span style="font-size:9px;color:var(--text3);">You must have an email linked to your account.</span>
      </div>
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:4px;">EMAIL ADDRESS</label>
      <input id="fp-email-inp" class="modal-inp" type="email" placeholder="your@email.com" style="margin-bottom:14px;" onkeydown="if(event.key==='Enter')submitForgotPassword()">
      <div id="fp-error" style="display:none;background:rgba(240,74,74,.1);border:1px solid var(--accent3);border-radius:3px;padding:8px 12px;margin-bottom:10px;font-size:10px;color:var(--accent3);"></div>
      <button onclick="submitForgotPassword()" class="btn accent" style="width:100%;padding:10px;font-size:11px;letter-spacing:.1em;">Send Reset Code →</button>
      <button onclick="resetLoginScreen()" style="background:none;border:none;color:var(--text3);font-family:var(--font);font-size:10px;cursor:pointer;margin-top:12px;width:100%;letter-spacing:.06em;">← Back to Sign In</button>
    </div>`;
}

async function submitForgotPassword(){
  const email=(document.getElementById('fp-email-inp').value||'').trim().toLowerCase();
  const errEl=document.getElementById('fp-error');
  if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){errEl.textContent='Enter a valid email.';errEl.style.display='block';return;}
  
  // Check account exists with this email
  const accounts=await fbGet('/accounts')||{};
  const entry=Object.values(accounts).find(a=>a.email&&a.email.toLowerCase()===email);
  if(!entry){errEl.textContent='No account found with that email.';errEl.style.display='block';return;}
  // Rate limit: 3 per 25 days
  const rl=checkRateLimit('forgot_'+entry.uid,3,25);
  if(!rl.allowed){errEl.textContent='Too many reset requests. Try again in '+rl.daysLeft+' day(s).';errEl.style.display='block';return;}
  bumpRateLimit('forgot_'+entry.uid,3,25);
  // Store pending reset UID
  pendingResetUid=entry.uid;
  // Send OTP
  await sendEmailVerification(email,'reset');
  showForgotPasswordCodePanel(email);
}

let pendingResetUid=null;

function showForgotPasswordCodePanel(email){
  const loginBody=document.getElementById('login-body-wrap');
  loginBody.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:24px;text-align:left;">
      <div style="font-family:var(--vt);font-size:18px;color:var(--accent2);margin-bottom:6px;letter-spacing:.08em;">ENTER CODE</div>
      <div style="font-size:10px;color:var(--text3);margin-bottom:20px;line-height:1.7;">
        A 6-digit code was sent to <strong style="color:var(--text);">${escHtml(email)}</strong>.<br>
        <span style="font-size:9px;color:var(--text3);">Check your inbox. Valid for 15 minutes.</span>
      </div>
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:4px;">OTP CODE</label>
      <input id="fp-code-inp" class="modal-inp" placeholder="6-digit code" maxlength="6" style="letter-spacing:.2em;font-size:16px;text-align:center;margin-bottom:14px;" onkeydown="if(event.key==='Enter')submitForgotCode('${escHtml(email)}')">
      <div id="fp-code-error" style="display:none;background:rgba(240,74,74,.1);border:1px solid var(--accent3);border-radius:3px;padding:8px 12px;margin-bottom:10px;font-size:10px;color:var(--accent3);"></div>
      <button onclick="submitForgotCode('${escHtml(email)}')" class="btn accent" style="width:100%;padding:10px;font-size:11px;letter-spacing:.1em;">Verify →</button>
      <button onclick="showForgotPassword()" style="background:none;border:none;color:var(--text3);font-family:var(--font);font-size:10px;cursor:pointer;margin-top:12px;width:100%;letter-spacing:.06em;">← Back</button>
    </div>`;
}

async function submitForgotCode(email){
  const entered=(document.getElementById('fp-code-inp').value||'').trim();
  const errEl=document.getElementById('fp-code-error');
  if(!entered||entered.length!==6){errEl.textContent='Enter the 6-digit code.';errEl.style.display='block';return;}
  const key=email.replace(/\./g,'_').replace(/@/g,'__at__');
  const stored=await fbGet('/emailCodes/'+key);
  if(!stored){errEl.textContent='Code expired. Try again.';errEl.style.display='block';return;}
  if(Date.now()>Number(stored.expires)){errEl.textContent='Code expired.';errEl.style.display='block';await fbDelete('/emailCodes/'+key);return;}
  if(stored.code!==entered){errEl.textContent='Wrong code.';errEl.style.display='block';return;}
  await fbDelete('/emailCodes/'+key);
  showSetNewPasswordPanel(email);
}

function showSetNewPasswordPanel(email){
  const loginBody=document.getElementById('login-body-wrap');
  loginBody.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:24px;text-align:left;">
      <div style="font-family:var(--vt);font-size:18px;color:var(--accent);margin-bottom:6px;letter-spacing:.08em;">NEW PASSWORD</div>
      <div style="font-size:10px;color:var(--text3);margin-bottom:20px;line-height:1.7;">
        Identity verified. Choose a new password for your account.
      </div>
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:4px;">NEW PASSWORD</label>
      <input id="np-pass1" class="modal-inp" type="password" placeholder="New password (8+ chars, mixed)" style="margin-bottom:4px;" oninput="checkNpStrength(this.value)" onkeydown="if(event.key==='Enter')document.getElementById('np-pass2').focus()">
      <div style="height:3px;border-radius:2px;background:rgba(255,255,255,.1);margin-bottom:4px;"><div id="np-str-fill" style="height:3px;border-radius:2px;width:0%;transition:width .3s,background .3s;"></div></div>
      <div id="np-str-hint" style="font-size:9px;color:var(--text3);margin-bottom:10px;min-height:14px;"></div>
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:4px;">CONFIRM PASSWORD</label>
      <input id="np-pass2" class="modal-inp" type="password" placeholder="Confirm password" style="margin-bottom:14px;" onkeydown="if(event.key==='Enter')submitNewPassword()">
      <div id="np-error" style="display:none;background:rgba(240,74,74,.1);border:1px solid var(--accent3);border-radius:3px;padding:8px 12px;margin-bottom:10px;font-size:10px;color:var(--accent3);"></div>
      <button onclick="submitNewPassword()" class="btn accent" style="width:100%;padding:10px;font-size:11px;letter-spacing:.1em;">Set New Password →</button>
    </div>`;
}

function checkNpStrength(pw){
  const {score}=getPwStrength(pw);
  const fill=document.getElementById('np-str-fill');
  const hint=document.getElementById('np-str-hint');
  const colors=['#f04a4a','#f04a4a','#f0a04a','#f0c84a','#c8f04a','#4af0c8'];
  if(fill){fill.style.width=(score/5*100)+'%';fill.style.background=colors[score];}
  if(hint){if(score>=4){hint.textContent='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Strong';hint.style.color='var(--accent)';}else{hint.textContent='Add uppercase, number, special char...';hint.style.color='var(--accent4)';}}
}

async function submitNewPassword(){
  const pass1=document.getElementById('np-pass1').value;
  const pass2=document.getElementById('np-pass2').value;
  const errEl=document.getElementById('np-error');
  if(!pass1||getPwStrength(pass1).score<4){errEl.textContent='Password too weak. Need 8+ chars, uppercase, lowercase, number, and special character.';errEl.style.display='block';return;}
  if(pass1!==pass2){errEl.textContent='Passwords do not match.';errEl.style.display='block';return;}
  if(!pendingResetUid){errEl.textContent='Session expired. Start over.';errEl.style.display='block';return;}
  const passHash=await hashPass(pass1);
  await fbPatch('/accounts/'+pendingResetUid,{passHash});
  pendingResetUid=null;
  resetLoginScreen();
  toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Password reset! Sign in with your new password.');
}
