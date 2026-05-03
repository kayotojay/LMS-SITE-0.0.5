// LMS Dev Hub — bugs.js
// ========================================

// =====================================================
// BUG TRACKER
// =====================================================
const SEV_COLORS={critical:'#f04a4a',high:'#f0a04a',medium:'#f0f04a',low:'#4a9af0'};

function renderBugs(){
  const el=document.getElementById('bug-list');if(!el)return;if(!D||!D.bugs)return;
  const sf=document.getElementById('bug-filter')?.value||'all';
  const stf=document.getElementById('bug-status-filter')?.value||'all';
  let bugs=D.bugs;
  if(sf!=='all')bugs=bugs.filter(b=>b.severity===sf);
  if(stf!=='all')bugs=bugs.filter(b=>b.status===stf);
  if(!bugs.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);padding:20px 0;">No bugs logged! Either youre perfect or haven\'t started testing. 🎉</div>';return;}
  el.innerHTML='';
  bugs.forEach(bug=>{
    const orig_i=D.bugs.indexOf(bug);
    const sevCol=SEV_COLORS[bug.severity]||'#888';
    const card=document.createElement('div');card.className='bug-card'+(bug.status==='resolved'?' resolved':'');
    card.style.setProperty('--sev',sevCol);
    card.innerHTML=`<div class="bug-top"><span class="bug-sev" style="color:${sevCol};border-color:${sevCol};">${bug.severity.toUpperCase()}</span><span class="bug-id">#${String(orig_i+1).padStart(3,'0')}</span><span class="bug-title">${escHtml(bug.title)}</span><span class="pill" style="color:${bug.status==='resolved'?'var(--accent)':bug.status==='inprogress'?'var(--accent4)':'var(--accent3)'};border-color:currentColor;">${bug.status}</span><button class="xbtn" onclick="deleteBug(${orig_i})">×</button></div>${bug.desc?`<div class="bug-desc">${escHtml(bug.desc)}</div>`:''}<div class="bug-meta">Reported: ${bug.date||'—'} ${bug.scene?'• Scene: '+escHtml(bug.scene):''}</div><div style="display:flex;gap:6px;margin-top:8px;"><button class="btn" style="font-size:9px;" onclick="cycleBugStatus(${orig_i})">${bug.status==='open'?'Mark In Progress':bug.status==='inprogress'?'Mark Resolved':'Reopen'}</button></div>`;
    el.appendChild(card);
  });
}

function openAddBug(){
  openModal('Report Bug',`
    <label class="modal-label">Title</label>
    <input class="modal-inp" id="bg-title" placeholder="Brief description of the bug">
    <label class="modal-label">Severity</label>
    <select class="modal-select" id="bg-sev"><option value="low">Low</option><option value="medium">Medium</option><option value="high" selected>High</option><option value="critical">Critical</option></select>
    <label class="modal-label">Scene / Area</label>
    <input class="modal-inp" id="bg-scene" placeholder="e.g. PlayerScene, MainMenu">
    <label class="modal-label">Steps to Reproduce / Description</label>
    <textarea class="modal-inp" id="bg-desc" style="min-height:90px;resize:vertical;" placeholder="1. Open scene\n2. Run game\n3. See error..."></textarea>
  `,[{label:'Cancel',action:closeModal},{label:'Report',action:()=>{
    const title=document.getElementById('bg-title').value.trim();if(!title)return;
    if(!D.bugs)D.bugs=[];
    D.bugs.push({id:'bug_'+Date.now(),title,severity:document.getElementById('bg-sev').value,scene:document.getElementById('bg-scene').value.trim(),desc:document.getElementById('bg-desc').value.trim(),status:'open',date:new Date().toLocaleDateString()});
    save();closeModal();renderBugs();logActivity('Bug reported: '+title,'#f04a4a');toast('Bug reported');
  },accent:true}]);
}

function cycleBugStatus(i){
  const bug=D.bugs[i];if(!bug)return;
  const statuses=['open','inprogress','resolved'];
  const cur=statuses.indexOf(bug.status);
  bug.status=statuses[(cur+1)%statuses.length];
  if(bug.status==='resolved')logActivity('Bug fixed: '+bug.title,'#c8f04a');
  save();renderBugs();
}

function deleteBug(i){D.bugs.splice(i,1);save();renderBugs();}

function syncInAppBehaviourToggles(){
  const map={
    'in-tog-confirmdelete':SETTINGS.confirmDelete!==false,
    'in-tog-autosave':SETTINGS.autoSaveSessions!==false,
    'in-tog-sound':!!SETTINGS.soundOnComplete,
    'in-tog-done':SETTINGS.showCompleted!==false,
    'in-tog-phasepct':SETTINGS.showPhasePercent!==false,
    'in-tog-collapse':!!SETTINGS.collapsePhases,
    'in-tog-keys':SETTINGS.keyboardShortcuts!==false,
    'in-tog-dense':!!SETTINGS.denseActivity,
  };
  Object.entries(map).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.classList.toggle('on',!!val);});
  const td=document.getElementById('in-toast-dur');if(td)td.value=SETTINGS.toastDuration||2200;
  const tdv=document.getElementById('in-td-val');if(tdv)tdv.textContent=((SETTINGS.toastDuration||2200)/1000).toFixed(1)+'s';
}

// Also update the updateGDriveUI if it doesn't exist
function updateGDriveUI(){}


/*
 * ============================================================
 * SUPABASE TABLE SCHEMA — Create these tables in your project
 * Dashboard → Table Editor (or SQL Editor → New Query)
 * ============================================================
 *
 * TABLE: servers
 *   id           uuid default uuid_generate_v4() primary key
 *   key          text unique not null          -- hashed server name, e.g. "srv_abc123"
 *   name         text                          -- human-readable server name
 *   pass_hash    text                          -- SHA-256 password hash
 *   host_id      text                          -- uid of the server creator
 *   short_id     text                          -- 7-char invite code, e.g. "XK9-4TM"
 *   visibility   text default 'public'         -- 'public' or 'private'
 *   deleted      boolean default false
 *   created_at   bigint                        -- Unix ms timestamp
 *
 * TABLE: members
 *   id           uuid default uuid_generate_v4() primary key
 *   uid          text unique not null          -- user's unique ID
 *   server_key   text                          -- FK → servers.key (nullable for account rows)
 *   name         text                          -- display name / username
 *   is_host      boolean default false
 *   last_seen    bigint                        -- Unix ms, used for online presence
 *   activity     text                          -- e.g. "viewing Scene Tree"
 *   in_project   text                          -- active project id
 *   pass_hash    text                          -- account password hash
 *   email        text                          -- linked email address
 *   created_at   bigint
 *
 * TABLE: projects
 *   id           uuid default uuid_generate_v4() primary key
 *   project_id   text unique not null          -- e.g. "proj_1718000000000"
 *   server_key   text not null                 -- FK → servers.key
 *   name         text
 *   engine       text
 *   genre        text
 *   color        text default '#4af0c8'
 *   created_by   text                          -- uid
 *   created_at   bigint
 *   data         jsonb default '{}'            -- full project payload (tasks, phases, etc.)
 *
 * TABLE: chat
 *   id           uuid default uuid_generate_v4() primary key
 *   msg_id       text unique not null          -- e.g. "msg_1718000000000"
 *   server_key   text not null
 *   project_id   text                          -- FK → projects.project_id
 *   author       text
 *   author_id    text
 *   text         text
 *   ts           bigint                        -- Unix ms
 *
 * TABLE: email_codes   (OTP verification)
 *   id           uuid default uuid_generate_v4() primary key
 *   email_key    text unique not null          -- encoded email, e.g. "user__at__example_com"
 *   code         text
 *   expires      bigint
 *   purpose      text                          -- 'link', 'reset', 'change_email_...'
 *   email        text
 *
 * TABLE: server_ids   (short-id lookup)
 *   id           uuid default uuid_generate_v4() primary key
 *   short_id     text unique not null          -- cleaned 7-char code, no dash
 *   server_key   text not null                 -- FK → servers.key
 *
 * RLS POLICIES: For a quick start, enable Row Level Security on each table
 *   and add a policy: allow all for anon (service role will bypass it).
 *   In production, tighten policies to require auth.
 *
 * ENABLE RLS EXAMPLE (run in SQL Editor):
 *   alter table servers enable row level security;
 *   create policy "allow all" on servers for all using (true) with check (true);
 *   -- repeat for members, projects, chat, email_codes, server_ids
 * ============================================================
 */

// SERVER HUB — Real-time collaboration via Supabase