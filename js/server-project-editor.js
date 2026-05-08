// LMS Dev Hub — server-project-editor.js
// ========================================

// ---- OPEN PROJECT EDITOR ----
let speProjData=null;
let spe_activityLog=[];

// ---- Permission guard helper (used by all write actions in server projects) ----
async function _requirePerm(perm, msg){
  if(!(await canMember(perm))){
    toast(msg||'You do not have permission to do that');
    return false;
  }
  return true;
}

async function openSrvProject(projId){
  if(!srvState.connected)return;
  srvState.activeProjId=projId;
  document.getElementById('server-hub-overlay').style.display='none';
  document.getElementById('root-screen-wrap').style.display='none';

  // Load project data from Firebase into D
  toast('Loading project…');
  const _spUrl=CFG_URL;const _spKey=CFG_KEY;
  const proj=await _withServerCreds(_spUrl,_spKey,()=>fbGet('/servers/'+srvState.serverKey+'/projects/'+projId));
  if(!proj){toast('Project not found');renderRootGrid();document.getElementById('root-screen-wrap').style.display='block';return;}

  // Populate D like a local project
  activeRootId='srv_'+projId;
  D={
    mainTasks:proj.phaseData||{},subTasks:{},
    customPhases:proj.phases||{main:[],sub:[]},
    folders:proj.folders||[],scripts:proj.scripts||[],
    versions:Object.values(proj.versions||{}),
    survivors:proj.survivors||[],notes:Object.values(proj.notes||{}).map(n=>({title:n.title||'Note',content:n.content||''})),
    lore:proj.lore||[],activity:proj.activity||[],
    customSections:[],sessions:proj.sessions||[],
    scenes:proj.scenes||[],sceneFolders:proj.sceneFolders||[],
    gddSections:proj.gddSections||[],assets:proj.assets||[],
    bugs:Object.values(proj.bugs||{}),
    chat:proj.chat||{},
    taskAssignments:proj.taskAssignments||[]
  };

  // Show solo app-shell with server branding
  document.getElementById('proj-logo-title').textContent=(proj.name||'PROJECT').substring(0,14);
  document.getElementById('proj-logo-sub').textContent=srvState.serverName.toLowerCase()+' · live';
  document.getElementById('sidebar-footer').textContent='server: '+srvState.serverName.toLowerCase();
  document.getElementById('dash-sub').textContent=escHtml((proj.name||'project').toLowerCase());
  document.getElementById('solo-live-badge').style.display='inline-block';
  document.getElementById('solo-server-nav').style.display='block';
  document.getElementById('app-shell').classList.add('visible');

  initProject();
  await srvBroadcastActivity('viewing dashboard');
  updateSoloPresenceBar();

  // Start periodic sync
  srvState._soloSyncInterval=setInterval(async()=>{
    if(!srvState.activeProjId)return;
    // Merge remote changes into D (non-destructive — only update if remote is newer)
    const remote=await fbGet('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId);
    if(remote){
      D.bugs=Object.values(remote.bugs||{});
      D.versions=Object.values(remote.versions||{});
      D.notes=Object.values(remote.notes||{}).map(n=>({title:n.title||'Note',content:n.content||''}));
      D.chat=remote.chat||{};
      D.taskAssignments=remote.taskAssignments||D.taskAssignments||[];
      if(typeof renderDashAssignments==='function')renderDashAssignments();
    }
    updateSoloPresenceBar();
    if(document.getElementById('page-chat').classList.contains('active'))renderSoloChat();
  },5000);
}

async function updateSoloPresenceBar(){
  if(!srvState.connected||!srvState.activeProjId)return;
  const members=await fbGet('/servers/'+srvState.serverKey+'/members')||{};
  const now=Date.now();
  const online=Object.entries(members).filter(([id,m])=>m&&m.lastSeen&&(now-m.lastSeen)<30000);
  const bar=document.getElementById('solo-presence-bar');
  if(!bar)return;
  bar.style.display='flex';
  // Clear existing member pills (keep the ONLINE: label)
  while(bar.children.length>1)bar.removeChild(bar.lastChild);
  online.forEach(([id,m])=>{
    const isMe=id===srvState.myId;
    const pill=document.createElement('div');
    pill.className='srv-presence-member online'+(isMe?' you':'');
    pill.innerHTML='<div class="srv-presence-dot"></div><span>'+escHtml(m.name)+(m.isHost?' <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>':'')+'</span>';
    if(m.activity&&!isMe){const a=document.createElement('span');a.className='srv-activity-pill';a.textContent=m.activity;pill.appendChild(a);}
    bar.appendChild(pill);
  });
}

function closeSrvProjEditor(){
  // No longer used — server projects open in solo shell, goHome() handles exit
  goHome();
}

async function syncProjData(fullRender=false){
  if(!srvState.activeProjId)return;
  const proj=await fbGet('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId);
  speProjData=proj;
  if(!proj){toast('Project not found');closeSrvProjEditor();return;}
  // Live backup — silently update on every sync (host only)
  if(srvState.isHost&&srvState.serverKey)bakUpdateLive(srvState.serverKey,srvState.serverName);

  // Update header
  document.getElementById('spe-title').textContent=proj.name.toUpperCase();
  document.getElementById('spe-logo-sub').textContent='server · '+srvState.serverName.toLowerCase();
  document.getElementById('spe-dash-sub').textContent=proj.name.toLowerCase();

  // Online members + presence bar
  const members=await fbGet('/servers/'+srvState.serverKey+'/members')||{};
  const now=Date.now();
  const online=Object.entries(members).filter(([id,m])=>m&&m.lastSeen&&(now-m.lastSeen)<30000);

  // Update presence bar
  const presBar=document.getElementById('spe-presence-bar');
  presBar.innerHTML='<span style="font-size:8px;color:var(--text3);letter-spacing:.15em;flex-shrink:0;">ONLINE:</span>';
  online.forEach(([id,m])=>{
    const isMe=id===srvState.myId;
    const pill=document.createElement('div');
    pill.className='srv-presence-member online'+(isMe?' you':'');
    pill.innerHTML=`<div class="srv-presence-dot"></div><span>${escHtml(m.name)}${m.isHost?' <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>':''}</span>`;
    if(m.activity&&!isMe){
      const act=document.createElement('span');act.className='srv-activity-pill';act.textContent=m.activity;pill.appendChild(act);
    }
    presBar.appendChild(pill);
  });

  // Sync indicator
  document.getElementById('spe-sync-dot').style.background='var(--accent2)';
  document.getElementById('spe-sync-txt').textContent='Live · '+online.length+' online';
  setTimeout(()=>{const dot=document.getElementById('spe-sync-dot');if(dot)dot.style.background='#555';},1500);

  // Dashboard stats — use phases if available, fall back to flat tasks
  const phases=[...((proj.phases&&proj.phases.main)||[]),...((proj.phases&&proj.phases.sub)||[])];
  let totalTasks=0,doneTasks=0;
  if(phases.length){
    phases.forEach(ph=>{
      const saved=(proj.phaseData&&proj.phaseData[ph.id])||{checks:{},custom:[],removed:[]};
      const removed=saved.removed||[];
      const custom=saved.custom||[];
      const allKeys=[...(ph.tasks||[]).map((_,i)=>ph.id+'-t'+i).filter((_,i)=>!removed.includes(i)),...custom.map((_,i)=>ph.id+'-c'+i)];
      totalTasks+=allKeys.length;
      doneTasks+=allKeys.filter(k=>(saved.checks||{})[k]).length;
    });
  } else {
    const flatTasks=Object.values(proj.tasks||{});
    totalTasks=flatTasks.length;
    doneTasks=flatTasks.filter(t=>t.status==='done').length;
  }
  const openBugs=Object.values(proj.bugs||{}).filter(b=>b.status!=='resolved').length;
  const d=id=>document.getElementById(id);
  if(d('spe-d-done'))d('spe-d-done').textContent=doneTasks;
  if(d('spe-d-total'))d('spe-d-total').textContent=totalTasks;
  if(d('spe-d-bugs'))d('spe-d-bugs').textContent=openBugs;
  if(d('spe-d-members'))d('spe-d-members').textContent=online.length;
  const pct=totalTasks?Math.round(doneTasks/totalTasks*100):0;
  if(d('spe-g-bar'))d('spe-g-bar').style.width=pct+'%';
  if(d('spe-g-label'))d('spe-g-label').textContent=doneTasks+' / '+totalTasks+' tasks complete';

  // Activity feed — pull member activities and recent changes
  renderSpeActivityFeed(online,proj);

  // Re-render assignments panel so "My Tasks" uses the now-resolved srvState.username
  if(typeof renderDashAssignments==='function')renderDashAssignments();

  if(fullRender)speRenderCurrentPage();
}

function renderSpeActivityFeed(online,proj){
  const el=document.getElementById('spe-activity-feed');if(!el)return;
  const items=[];
  // Members online now with their activity
  online.forEach(([id,m])=>{
    if(m.activity){
      items.push({dot:'var(--accent2)',title:escHtml(m.name)+' — '+escHtml(m.activity),meta:'right now'+(m.isHost?' · host':'')});
    }
  });
  // Recent task changes
  Object.values(proj.tasks||{}).filter(t=>t.status==='done').slice(-3).forEach(t=>{
    items.push({dot:'var(--accent)',title:'Task completed: '+escHtml(t.title),meta:'by '+escHtml(t.assignee||'team')});
  });
  Object.values(proj.tasks||{}).filter(t=>t.status==='inprogress').slice(-3).forEach(t=>{
    items.push({dot:'var(--accent4)',title:'In progress: '+escHtml(t.title),meta:'assigned to '+escHtml(t.assignee||'team')});
  });
  // Recent bugs
  Object.values(proj.bugs||{}).filter(b=>b.status!=='resolved').slice(-2).forEach(b=>{
    items.push({dot:'var(--accent3)',title:'Bug: '+escHtml(b.title),meta:'reported by '+escHtml(b.reportedBy||'?')+' · '+escHtml(b.severity||'')});
  });
  if(!items.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);padding:12px 0;">No activity yet. Start working!</div>';return;}
  el.innerHTML=items.map(i=>`<div class="tl-item"><div class="tl-dot" style="background:${i.dot};"></div><div class="tl-content"><div class="tl-title">${i.title}</div><div class="tl-meta">${i.meta}</div></div></div>`).join('');
}

// ---- SPE NAVIGATION (full mirror of solo nav) ----
const SPE_TITLE_MAP={
  dash:'Dashboard','main-tasks':'Main Phases','sub-tasks':'Sub Phases',
  vault:'Script Vault',versions:'Versions',analytics:'Analytics',
  'scene-tree':'Scene Tree',gdd:'Game Design Doc',assets:'Asset Tracker',
  bugs:'Bug Tracker',chat:'Team Chat'
};

function speNav(page){
  // Hide all pages
  document.querySelectorAll('[id^="spe-page-"]').forEach(p=>{
    p.classList.remove('active');
    p.style.display='none';
  });
  // Deactivate all nav items
  document.querySelectorAll('[id^="spe-nav-"]').forEach(n=>n.classList.remove('active'));

  const pageEl=document.getElementById('spe-page-'+page);
  if(pageEl){
    if(page==='chat'){pageEl.style.display='flex';}
    else{pageEl.style.display='block';pageEl.classList.add('active');}
  }
  const navEl=document.getElementById('spe-nav-'+page);
  if(navEl)navEl.classList.add('active');

  const title=SPE_TITLE_MAP[page]||page;
  document.getElementById('spe-page-title').textContent=title;
  srvState.activeTab=page;

  srvBroadcastActivity('viewing '+title);
  speRenderCurrentPage();
}

function speRenderCurrentPage(){
  if(!speProjData)return;
  const tab=srvState.activeTab;
  if(tab==='dash')renderSpeDash();
  if(tab==='main-tasks')speRenderMainPhases();
  if(tab==='sub-tasks')speRenderSubPhases();
  if(tab==='vault')speRenderVault();
  if(tab==='versions')renderSpeVersions();
  if(tab==='analytics')speRenderAnalytics();
  if(tab==='scene-tree')speRenderSceneTree();
  if(tab==='gdd')speRenderGDD();
  if(tab==='assets')speRenderAssets();
  if(tab==='bugs')renderSpeBugs();
  if(tab==='chat')renderSpeChat();
}

// Legacy aliases
function speSwitchTab(tab){speNav(tab);}
function renderSpeCurrentTab(){speRenderCurrentPage();}

// ---- BROADCAST PRESENCE ACTIVITY ----
async function srvBroadcastActivity(activity){
  if(!srvState.connected||!srvState.myId)return;
  const _bUrl=CFG_URL;const _bKey=CFG_KEY;
  await _withServerCreds(_bUrl,_bKey,()=>fbPatch('/servers/'+srvState.serverKey+'/members/'+srvState.myId,{
    lastSeen:Date.now(),activity:activity||null,inProject:srvState.activeProjId||null
  }));
}

// ---- NOTIFY HOST OF DELETIONS ----
async function notifyHostDeletion(what){
  if(!srvState.connected||!srvState.activeProjId)return;
  const projName=speProjData?.name||'project';
  await fbPush('/servers/'+srvState.serverKey+'/hostNotifications',{
    type:'member_deleted',what,by:srvState.username,projectName:projName,projId:srvState.activeProjId,ts:Date.now(),seen:false
  });
}

// ---- DASHBOARD ----
function renderSpeDash(){
  // Stats already updated in syncProjData, just re-render activity feed
  if(speProjData){
    const members=[];// Will be refreshed by syncProjData
    renderSpeActivityFeed([],speProjData);
  }
}

// ---- TASKS ----
function _buildSrvTaskRow(id,task){
  const isDone=task.status==='done';
  const isWip=task.status==='inprogress';
  const borderCol=isDone?'var(--accent)':isWip?'var(--accent4)':'var(--border2)';
  const bgCol=isDone?'var(--accent)':isWip?'rgba(240,160,74,.2)':'transparent';
  const textStyle=isDone?'text-decoration:line-through;color:var(--text3);':'';
  const statusCol=isDone?'var(--accent)':isWip?'var(--accent4)':'var(--text3)';
  // Assignee pill — highlight if assigned to me
  const me=srvState.username;
  const assignee=task.assignee||'—';
  const isMe=assignee===me;
  const assigneePill=`<div style="font-size:8px;padding:1px 7px;border-radius:8px;border:1px solid ${isMe?'var(--accent)':'var(--border2)'};color:${isMe?'var(--accent)':'var(--text3)'};background:${isMe?'rgba(74,240,200,.08)':'transparent'};white-space:nowrap;">${escHtml(assignee)}</div>`;
  return`<div class="srv-task-row">
    <div style="width:10px;height:10px;border-radius:2px;border:1px solid ${borderCol};background:${bgCol};cursor:pointer;flex-shrink:0;" onclick="cycleSrvTaskStatus('${id}')"></div>
    <div style="flex:1;">
      <div style="font-size:11px;color:var(--text);${textStyle}">${escHtml(task.title)}</div>
      ${task.desc?`<div style="font-size:9px;color:var(--text3);margin-top:2px;">${escHtml(task.desc)}</div>`:''}
    </div>
    ${assigneePill}
    <div style="font-size:8px;padding:1px 6px;border-radius:1px;border:1px solid ${borderCol};color:${statusCol};">${task.status||'todo'}</div>
    <button onclick="deleteSrvTask('${id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-family:var(--font);font-size:11px;" onmouseover="this.style.color='var(--accent3)'" onmouseout="this.style.color='var(--text3)'">×</button>
  </div>`;
}

function renderSpeTasks(){
  const el=document.getElementById('spe-tasks-content');
  const tasks=Object.entries(speProjData.tasks||{});
  const me=srvState.username;

  const statusOrder={todo:0,inprogress:1,done:2};
  tasks.sort((a,b)=>(statusOrder[a[1].status]||0)-(statusOrder[b[1].status]||0));

  const myTasks=tasks.filter(([,t])=>t.assignee===me&&t.status!=='done');
  const allTasks=tasks;

  let html='';

  // ── MY TASKS section ──
  html+=`<div style="margin-bottom:14px;">
    <div style="font-size:9px;letter-spacing:.12em;color:var(--accent);text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
      <ion-icon name="person-sharp" style="font-size:11px;pointer-events:none;"></ion-icon> My Tasks
      <span style="font-size:8px;padding:1px 5px;border-radius:8px;background:rgba(74,240,200,.1);border:1px solid rgba(74,240,200,.25);color:var(--accent);">${myTasks.length}</span>
    </div>`;
  if(!myTasks.length){
    html+=`<div style="font-size:10px;color:var(--text3);padding:8px 10px;border:1px dashed var(--border2);border-radius:2px;text-align:center;">No tasks assigned to you yet.</div>`;
  } else {
    html+=myTasks.map(([id,task])=>_buildSrvTaskRow(id,task)).join('');
  }
  html+=`</div>`;

  // ── ALL TASKS section ──
  html+=`<div>
    <div style="font-size:9px;letter-spacing:.12em;color:var(--text3);text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
      <ion-icon name="list-sharp" style="font-size:11px;pointer-events:none;"></ion-icon> All Tasks
      <span style="font-size:8px;padding:1px 5px;border-radius:8px;background:var(--bg3);border:1px solid var(--border2);color:var(--text3);">${allTasks.length}</span>
    </div>`;
  if(!allTasks.length){
    html+=`<div style="font-size:11px;color:var(--text3);padding:20px 0;text-align:center;">No tasks yet. Add the first one!</div>`;
  } else {
    html+=allTasks.map(([id,task])=>_buildSrvTaskRow(id,task)).join('');
  }
  html+=`</div>`;

  el.innerHTML=html;
}

async function openAddSrvTask(){
  // Fetch current members to build the tag picker
  let memberNames=[];
  try{
    const members=await fbGet('/servers/'+srvState.serverKey+'/members')||{};
    memberNames=Object.values(members)
      .filter(m=>m&&(m.name||m.displayName))
      .map(m=>m.name||m.displayName||'Member')
      .filter((n,i,arr)=>arr.indexOf(n)===i);
  }catch(e){}

  // Ensure current user is always in the list
  if(srvState.username&&!memberNames.includes(srvState.username))memberNames.unshift(srvState.username);

  const pillsHtml=memberNames.map(name=>`
    <button type="button" class="st-member-pill" data-name="${escHtml(name)}"
      onclick="(function(btn){
        document.querySelectorAll('.st-member-pill').forEach(p=>{p.style.background='transparent';p.style.color='var(--text3)';p.style.borderColor='var(--border2)';});
        btn.style.background='rgba(74,240,200,.12)';btn.style.color='var(--accent)';btn.style.borderColor='var(--accent)';
        document.getElementById('st-assign-val').value=btn.dataset.name;
        document.getElementById('st-assign-custom').value='';
      })(this)"
      style="font-size:9px;padding:3px 10px;border-radius:10px;border:1px solid ${name===srvState.username?'var(--accent)':'var(--border2)'};color:${name===srvState.username?'var(--accent)':'var(--text3)'};background:${name===srvState.username?'rgba(74,240,200,.12)':'transparent'};cursor:pointer;font-family:var(--font);transition:all .15s;">
      ${escHtml(name)}${name===srvState.username?' ✓':''}
    </button>`).join('');

  openModal('Add Task',`
    <label class="modal-label">Task Title</label>
    <input class="modal-inp" id="st-title" placeholder="e.g. Set up auth, Fix login bug">
    <label class="modal-label">Description (optional)</label>
    <input class="modal-inp" id="st-desc" placeholder="More details…">
    <label class="modal-label">Assign To</label>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px;">${pillsHtml}</div>
    <input class="modal-inp" id="st-assign-custom" placeholder="Or type a name…" oninput="document.getElementById('st-assign-val').value=this.value;document.querySelectorAll('.st-member-pill').forEach(p=>{p.style.background='transparent';p.style.color='var(--text3)';p.style.borderColor='var(--border2)';});" style="margin-top:0;">
    <input type="hidden" id="st-assign-val" value="${escHtml(srvState.username)}">
    <label class="modal-label">Status</label>
    <select class="modal-select" id="st-status"><option value="todo">To Do</option><option value="inprogress">In Progress</option><option value="done">Done</option></select>
  `,[{label:'Cancel',action:closeModal},{label:'Add Task',action:addSrvTask,accent:true}]);
}

async function addSrvTask(){
  const title=document.getElementById('st-title').value.trim();if(!title)return;
  if(!(await _requirePerm('canManageTasks','You don\'t have permission to add tasks')))return;
  const assignee=(document.getElementById('st-assign-val')||{}).value||(document.getElementById('st-assign-custom')||{}).value||srvState.username;
  const task={id:'t_'+Date.now(),title,desc:document.getElementById('st-desc').value.trim(),assignee:assignee.trim()||srvState.username,status:document.getElementById('st-status').value,createdBy:srvState.username,createdAt:Date.now()};
  await fbSet('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/tasks/'+task.id,task);
  await srvBroadcastActivity('added task: '+title.substring(0,30));
  closeModal();await syncProjData(true);toast('Task added');
}

async function cycleSrvTaskStatus(taskId){
  const task=(speProjData.tasks||{})[taskId];if(!task)return;
  const statuses=['todo','inprogress','done'];
  const next=statuses[(statuses.indexOf(task.status)+1)%statuses.length];
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/tasks/'+taskId,{status:next});
  const label={todo:'working on',inprogress:'working on',done:'completed'};
  await srvBroadcastActivity((label[next]||'updated')+': '+task.title.substring(0,30));
  await syncProjData(true);
}

async function deleteSrvTask(taskId){
  if(!(await _requirePerm('canManageTasks','You don\'t have permission to remove tasks')))return;
  await fbDelete('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/tasks/'+taskId);
  await syncProjData(true);toast('Task removed');
}

// ---- NOTES ----
function renderSpeNotes(){
  const el=document.getElementById('spe-notes-content');
  const notes=Object.entries(speProjData.notes||{});
  el.innerHTML=`<div id="spe-notes-list"></div>`;
  const listEl=document.getElementById('spe-notes-list');
  if(!notes.length){listEl.innerHTML='<div style="font-size:11px;color:var(--text3);padding:20px 0;text-align:center;">No notes yet.</div>';return;}
  listEl.innerHTML=notes.map(([id,note])=>`
    <div class="card" style="margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="font-size:10px;color:var(--text2);">${escHtml(note.title||'Note')}</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span style="font-size:9px;color:var(--text3);">${escHtml(note.author||'')}</span>
          <button onclick="deleteSrvNote('${id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;" onmouseover="this.style.color='var(--accent3)'" onmouseout="this.style.color='var(--text3)'">×</button>
        </div>
      </div>
      <textarea class="notes-area" style="min-height:80px;" onblur="updateSrvNote('${id}',this.value)">${escHtml(note.content||'')}</textarea>
    </div>
  `).join('');
}

function addSrvNote(){
  openModal('New Note',`
    <label class="modal-label">Title</label>
    <input class="modal-inp" id="sn2-title" placeholder="e.g. Meeting Notes, Ideas">
  `,[{label:'Cancel',action:closeModal},{label:'Create',action:async()=>{
    const title=document.getElementById('sn2-title').value.trim();if(!title)return;
    const id='note_'+Date.now();
    await fbSet('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/notes/'+id,{id,title,content:'',author:srvState.username,createdAt:Date.now()});
    closeModal();await syncProjData(true);
  },accent:true}]);
}

async function updateSrvNote(noteId,content){
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/notes/'+noteId,{content});
}

async function deleteSrvNote(noteId){
  if(!(await _requirePerm('canManageNotes','You don\'t have permission to delete notes')))return;
  await fbDelete('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/notes/'+noteId);
  await syncProjData(true);
}

// ---- BUGS ----
function renderSpeBugs(){
  const el=document.getElementById('spe-bugs-content');
  const bugs=Object.entries(speProjData.bugs||{});
  el.innerHTML=`<div id="spe-bugs-list"></div>`;
  const listEl=document.getElementById('spe-bugs-list');
  if(!bugs.length){listEl.innerHTML='<div style="font-size:11px;color:var(--text3);padding:20px 0;text-align:center;">No bugs reported. Either perfect or untested <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10l-8-4V7"/></svg></div>';return;}
  const sevColors={critical:'#f04a4a',high:'#f0a04a',medium:'#f0f04a',low:'#4a9af0'};
  listEl.innerHTML=bugs.map(([id,bug])=>`
    <div class="bug-card" style="--sev:${sevColors[bug.severity]||'#888'};margin-bottom:8px;${bug.status==='resolved'?'opacity:.5':''}">
      <div class="bug-top">
        <span class="bug-sev" style="color:${sevColors[bug.severity]||'#888'};border-color:${sevColors[bug.severity]||'#888'};">${(bug.severity||'').toUpperCase()}</span>
        <span class="bug-title" style="flex:1;">${escHtml(bug.title)}</span>
        <span class="pill" style="color:${bug.status==='resolved'?'var(--accent)':bug.status==='inprogress'?'var(--accent4)':'var(--accent3)'};border-color:currentColor;font-size:8px;">${bug.status||'open'}</span>
        <button onclick="cycleSrvBug('${id}')" class="btn" style="font-size:9px;padding:3px 8px;">${bug.status==='open'?'→ In Progress':bug.status==='inprogress'?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Resolve':'↺ Reopen'}</button>
        <button onclick="deleteSrvBug('${id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;" onmouseover="this.style.color='var(--accent3)'" onmouseout="this.style.color='var(--text3)'">×</button>
      </div>
      ${bug.desc?`<div class="bug-desc">${escHtml(bug.desc)}</div>`:''}
      <div class="bug-meta">By ${escHtml(bug.reportedBy||'?')} · ${bug.date||''}</div>
    </div>
  `).join('');
}

function openAddSrvBug(){
  openModal('Report Bug',`
    <label class="modal-label">Title</label>
    <input class="modal-inp" id="sb-title" placeholder="Brief bug description">
    <label class="modal-label">Severity</label>
    <select class="modal-select" id="sb-sev"><option value="low">Low</option><option value="medium">Medium</option><option value="high" selected>High</option><option value="critical">Critical</option></select>
    <label class="modal-label">Description / Steps</label>
    <textarea class="modal-inp" id="sb-desc" style="min-height:80px;resize:vertical;" placeholder="Steps to reproduce…"></textarea>
  `,[{label:'Cancel',action:closeModal},{label:'Report',action:addSrvBug,accent:true}]);
}

async function addSrvBug(){
  const title=document.getElementById('sb-title').value.trim();if(!title)return;
  const id='bug_'+Date.now();
  const bug={id,title,severity:document.getElementById('sb-sev').value,desc:document.getElementById('sb-desc').value.trim(),status:'open',reportedBy:srvState.username,date:new Date().toLocaleDateString()};
  await fbSet('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/bugs/'+id,bug);
  await srvBroadcastActivity('reported bug: '+title.substring(0,30));
  if(!(await _requirePerm('canManageBugs','You don\'t have permission to report bugs')))return;
  closeModal();await syncProjData(true);toast('Bug reported');
}

async function cycleSrvBug(bugId){
  const bug=(speProjData.bugs||{})[bugId];if(!bug)return;
  const statuses=['open','inprogress','resolved'];
  const next=statuses[(statuses.indexOf(bug.status)+1)%statuses.length];
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/bugs/'+bugId,{status:next});
  await syncProjData(true);
}

async function deleteSrvBug(bugId){
  if(!(await _requirePerm('canManageBugs','You don\'t have permission to remove bugs')))return;
  await fbDelete('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/bugs/'+bugId);
  await syncProjData(true);toast('Bug removed');
}

// ---- VERSIONS ----
function renderSpeVersions(){
  const el=document.getElementById('spe-versions-content');
  const versions=Object.entries(speProjData.versions||{}).sort((a,b)=>b[1].createdAt-a[1].createdAt);
  if(!versions.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);padding:20px 0;text-align:center;">No versions logged yet.</div>';return;}
  el.innerHTML=versions.map(([id,v])=>`
    <div class="version-card" style="--vc:${escHtml(v.color||'#c8f04a')};">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-family:var(--vt);font-size:18px;color:${escHtml(v.color||'var(--accent)')};">${escHtml(v.tag||'v?')}</span>
        <span style="font-size:11px;color:var(--text);flex:1;">${escHtml(v.name||'')}</span>
        <span style="font-size:9px;color:var(--text3);">${escHtml(v.date||'')} · ${escHtml(v.createdBy||'')}</span>
        <button onclick="deleteSrvVersion('${id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;" onmouseover="this.style.color='var(--accent3)'" onmouseout="this.style.color='var(--text3)'">×</button>
      </div>
      ${v.notes?`<div style="font-size:10px;color:var(--text2);line-height:1.5;">${escHtml(v.notes)}</div>`:''}
    </div>
  `).join('');
}

function openAddSrvVersion(){
  const colors=['#c8f04a','#4af0c8','#f04a4a','#f0a04a','#a04af0','#4a9af0'];
  openModal('Log Version',`
    <label class="modal-label">Version Tag</label>
    <input class="modal-inp" id="sv-tag" placeholder="e.g. v0.1.0, Alpha 2">
    <label class="modal-label">Name</label>
    <input class="modal-inp" id="sv-name" placeholder="e.g. First Playable, Bug Fix Pass">
    <label class="modal-label">Notes</label>
    <textarea class="modal-inp" id="sv-notes" style="min-height:80px;resize:vertical;" placeholder="What changed in this version?"></textarea>
    <label class="modal-label">Color</label>
    <div style="display:flex;gap:6px;margin-bottom:4px;">${colors.map(c=>`<div onclick="this.parentElement.querySelectorAll('div').forEach(x=>x.style.outline='none');this.style.outline='2px solid #fff';document.getElementById('sv-color').value='${c}';" style="width:20px;height:20px;border-radius:50%;background:${c};cursor:pointer;outline:${c==='#c8f04a'?'2px solid #fff':'none'};"></div>`).join('')}</div>
    <input type="hidden" id="sv-color" value="#c8f04a">
  `,[{label:'Cancel',action:closeModal},{label:'Log',action:addSrvVersion,accent:true}]);
}

async function addSrvVersion(){
  const tag=document.getElementById('sv-tag').value.trim();if(!tag)return;
  const id='ver_'+Date.now();
  const ver={id,tag,name:document.getElementById('sv-name').value.trim(),notes:document.getElementById('sv-notes').value.trim(),color:document.getElementById('sv-color').value,createdBy:srvState.username,date:new Date().toLocaleDateString(),createdAt:Date.now()};
  await fbSet('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/versions/'+id,ver);
  await srvBroadcastActivity('logged version '+tag);
  if(!(await _requirePerm('canManageVersions','You don\'t have permission to log versions')))return;
  closeModal();await syncProjData(true);toast('Version logged: '+tag);
}

async function deleteSrvVersion(id){
  if(!(await _requirePerm('canManageVersions','You don\'t have permission to remove versions')))return;
  await fbDelete('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/versions/'+id);
  await syncProjData(true);toast('Version removed');
}

// ---- CHAT ----
async function renderSpeChat(){
  if(!speProjData)return;
  const chat=await fbGet('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/chat')||{};
  const msgs=Object.values(chat).sort((a,b)=>a.ts-b.ts).slice(-80);
  const msgsEl=document.getElementById('spe-chat-msgs');
  if(!msgsEl)return;
  const wasAtBottom=msgsEl.scrollHeight-msgsEl.scrollTop-msgsEl.clientHeight<40;
  msgsEl.innerHTML=msgs.map(m=>`
    <div class="srv-msg ${m.authorId===srvState.myId?'mine':'theirs'}">
      ${m.authorId!==srvState.myId?`<div class="srv-msg-name">${escHtml(m.author)}</div>`:''}
      <div class="srv-msg-text">${escHtml(m.text)}</div>
      <div class="srv-msg-time">${new Date(m.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
    </div>
  `).join('');
  if(wasAtBottom||msgs.length<=5)msgsEl.scrollTop=msgsEl.scrollHeight;
}

async function sendSrvMsg(){
  const inp=document.getElementById('spe-chat-inp');
  const text=inp.value.trim();if(!text)return;
  inp.value='';
  const id='msg_'+Date.now();
  await fbSet('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/chat/'+id,{
    id,text,author:srvState.username,authorId:srvState.myId,ts:Date.now()
  });
  await srvBroadcastActivity('chatting');
  await renderSpeChat();
}

// ---- SPE MAIN PHASES ----
function speRenderMainPhases(){
  const proj=speProjData;
  const phases=(proj.phases&&proj.phases.main)||[];
  const el=document.getElementById('spe-main-phase-grid');
  if(!el)return;
  if(!phases.length){el.innerHTML=`<div style="font-size:11px;color:var(--text3);padding:24px 0;grid-column:1/-1;">No main phases yet. Import a .lmstasks file to get started.</div>`;return;}
  el.innerHTML=phases.map(ph=>{
    const saved=(proj.phaseData&&proj.phaseData[ph.id])||{checks:{},custom:[],removed:[]};
    const tasks=(ph.tasks||[]);
    const removed=saved.removed||[];
    const custom=saved.custom||[];
    const allKeys=[...tasks.map((_,i)=>ph.id+'-t'+i).filter((_,i)=>!removed.includes(i)),...custom.map((_,i)=>ph.id+'-c'+i)];
    const done=allKeys.filter(k=>saved.checks[k]).length;
    const pct=allKeys.length?Math.round(done/allKeys.length*100):0;
    return`<div class="phase-card" style="--ph:${ph.color||'#c8f04a'};--ptc:${ph.tc||'#080808'};">
      <div class="phase-header"><div class="phase-label">${escHtml(ph.label||'')}</div><div class="phase-title">${escHtml(ph.title||'')}</div></div>
      <div class="phase-pct">${pct}%</div>
      <div class="phase-bar"><div class="phase-fill" style="width:${pct}%"></div></div>
      <div class="phase-tasks">${tasks.filter((_,i)=>!removed.includes(i)).map((t,i)=>{const k=ph.id+'-t'+i;return`<div class="phase-task${saved.checks[k]?' done':''}" onclick="speTogglePhaseTask('${ph.id}','${k}')"><div class="phase-task-dot"></div>${escHtml(t)}</div>`;}).join('')}
      ${custom.map((t,i)=>{const k=ph.id+'-c'+i;return`<div class="phase-task${saved.checks[k]?' done':''}" onclick="speTogglePhaseTask('${ph.id}','${k}')"><div class="phase-task-dot"></div>${escHtml(t)}</div>`;}).join('')}
      </div>
      <div style="margin-top:8px;display:flex;gap:4px;">
        <button class="btn" style="font-size:9px;flex:1;" onclick="speAddCustomTask('${ph.id}','main')">+ Task</button>
      </div>
    </div>`;
  }).join('');
}

async function speTogglePhaseTask(phaseId,key){
  const path='/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/phaseData/'+phaseId+'/checks/'+key.replace(/\//g,'__');
  const cur=((speProjData.phaseData||{})[phaseId]||{checks:{}}).checks||{};
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/phaseData/'+phaseId,{checks:{...cur,[key]:!cur[key]}});
  await srvBroadcastActivity('updated task in '+phaseId);
  await syncProjData(true);
}

async function speAddCustomTask(phaseId,type){
  openModal('Add Custom Task',`
    <label class="modal-label">Task Name</label>
    <input class="modal-inp" id="spe-ct-name" placeholder="Task description…">
  `,[{label:'Cancel',action:closeModal},{label:'Add',action:async()=>{
    const name=document.getElementById('spe-ct-name').value.trim();if(!name)return;
    const existing=((speProjData.phaseData||{})[phaseId]||{}).custom||[];
    await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId+'/phaseData/'+phaseId,{custom:[...existing,name]});
    await srvBroadcastActivity('added task to '+phaseId);
    closeModal();await syncProjData(true);
  },accent:true}]);
}

function speImportTasks(){
  openModal('Import .lmstasks',`
    <div class="drop-zone" onclick="document.getElementById('spe-import-tasks-file').click()">Click to select .lmstasks file</div>
    <input type="file" id="spe-import-tasks-file" accept=".lmstasks,.json" style="display:none;" onchange="speHandleTasksImport(this)">
  `,[{label:'Cancel',action:closeModal}]);
}

async function speHandleTasksImport(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async e=>{
    try{
      const blob=JSON.parse(e.target.result);
      if(blob._type!=='lmstasks')throw new Error('Not a .lmstasks file');
      await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{
        phases:{main:blob.main||[],sub:blob.sub||[]}
      });
      closeModal();await syncProjData(true);toast('Phases imported: '+blob._name);
    }catch(err){toast('Import failed: '+err.message);}
  };
  reader.readAsText(file);
}

// ---- SPE SUB PHASES ----
function speRenderSubPhases(){
  const proj=speProjData;
  const phases=(proj.phases&&proj.phases.sub)||[];
  const el=document.getElementById('spe-sub-phase-grid');
  if(!el)return;
  if(!phases.length){el.innerHTML=`<div style="font-size:11px;color:var(--text3);padding:24px 0;grid-column:1/-1;">No sub phases. Import a .lmstasks file from Main Phases.</div>`;return;}
  el.innerHTML=phases.map(ph=>{
    const saved=(proj.phaseData&&proj.phaseData[ph.id])||{checks:{},custom:[],removed:[]};
    const tasks=(ph.tasks||[]);
    const custom=saved.custom||[];
    const allKeys=[...tasks.map((_,i)=>ph.id+'-t'+i),...custom.map((_,i)=>ph.id+'-c'+i)];
    const done=allKeys.filter(k=>saved.checks[k]).length;
    const pct=allKeys.length?Math.round(done/allKeys.length*100):0;
    return`<div class="phase-card" style="--ph:${ph.color||'#555'};--ptc:${ph.tc||'#ddd'};">
      <div class="phase-header"><div class="phase-label">${escHtml(ph.label||'')}</div><div class="phase-title">${escHtml(ph.title||'')}</div></div>
      <div class="phase-pct">${pct}%</div>
      <div class="phase-bar"><div class="phase-fill" style="width:${pct}%"></div></div>
      <div class="phase-tasks">${tasks.map((t,i)=>{const k=ph.id+'-t'+i;return`<div class="phase-task${saved.checks[k]?' done':''}" onclick="speTogglePhaseTask('${ph.id}','${k}')"><div class="phase-task-dot"></div>${escHtml(t)}</div>`;}).join('')}
      ${custom.map((t,i)=>{const k=ph.id+'-c'+i;return`<div class="phase-task${saved.checks[k]?' done':''}" onclick="speTogglePhaseTask('${ph.id}','${k}')"><div class="phase-task-dot"></div>${escHtml(t)}</div>`;}).join('')}
      </div>
      <div style="margin-top:8px;"><button class="btn" style="font-size:9px;width:100%;" onclick="speAddCustomTask('${ph.id}','sub')">+ Task</button></div>
    </div>`;
  }).join('');
}

// ---- SPE SCRIPT VAULT ----
let speActiveFolder=null;
let speActiveScript=null;

function speRenderVault(){
  const proj=speProjData;
  const folders=proj.folders||[];
  const scripts=proj.scripts||[];
  const el=document.getElementById('spe-folder-list');if(!el)return;
  if(!folders.length){el.innerHTML='';document.getElementById('spe-script-content').innerHTML='<div style="font-size:11px;color:var(--text3);">No folders yet. Create one to start.</div>';return;}
  el.innerHTML=folders.map(f=>`
    <div class="folder-card${speActiveFolder===f.id?' active-folder':''}" onclick="speSelectFolder('${f.id}')">
      <div class="folder-icon"></div>
      <div class="folder-name">${escHtml(f.name)}</div>
      <div class="folder-count">${scripts.filter(s=>s.folder===f.id).length} scripts</div>
    </div>
  `).join('');
  if(speActiveFolder)speRenderScripts(speActiveFolder);
}

async function speCreateFolder(){
  if(!(await _requirePerm('canManageScripts','You don\'t have permission to manage scripts')))return;
  const name=document.getElementById('spe-new-folder-inp').value.trim();if(!name)return;
  const folders=speProjData.folders||[];
  const id='f_'+Date.now();
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{folders:[...folders,{id,name}]});
  document.getElementById('spe-new-folder-inp').value='';
  speActiveFolder=id;
  await syncProjData(true);
}

function speSelectFolder(id){
  speActiveFolder=id;speActiveScript=null;
  speRenderVault();speRenderScripts(id);
}

function speCloseScriptEditor(){speActiveScript=null;const ed=document.getElementById('spe-script-editor');if(ed)ed.innerHTML='';document.querySelectorAll('.script-item').forEach(el=>el.classList.remove('active-script'));}

function speRenderScripts(folderId){
  const scripts=(speProjData.scripts||[]).filter(s=>s.folder===folderId);
  const el=document.getElementById('spe-script-content');if(!el)return;
  if(!scripts.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);">No scripts in this folder.</div>';return;}
  el.innerHTML=`<div class="script-list">${scripts.map(s=>`
    <div class="script-item${speActiveScript===s.id?' active-script':''}" onclick="speOpenScript('${s.id}')">
      <div class="script-ver">${escHtml(s.version||'v1.0')}</div>
      <div class="script-name">${escHtml(s.name)}</div>
      <div class="script-date">${escHtml(s.date||'')}</div>
      <button onclick="event.stopPropagation();speDeleteScript('${s.id}')" class="xbtn">×</button>
    </div>`).join('')}</div>
  <div id="spe-script-editor" style="margin-top:12px;"></div>`;
  el._closeHandler&&el.removeEventListener('click',el._closeHandler);
  el._closeHandler=function(e){if(e.target===el&&speActiveScript)speCloseScriptEditor();};
  el.addEventListener('click',el._closeHandler);
  if(speActiveScript)speOpenScript(speActiveScript);
}

function speOpenScript(id){
  speActiveScript=id;
  const s=(speProjData.scripts||[]).find(x=>x.id===id);if(!s)return;
  document.querySelectorAll('.script-item').forEach(el=>el.classList.toggle('active-script',el.querySelector('.script-name')&&el.querySelector('.script-name').textContent===s.name));
  const el=document.getElementById('spe-script-editor');if(!el)return;
  el.innerHTML=`
    <div class="editor-area">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:9px;color:var(--accent2);letter-spacing:.15em;">Editing: ${escHtml(s.name)} ${escHtml(s.version||'')}</span>
        <button class="xbtn" title="Close editor" onclick="speCloseScriptEditor()" style="font-size:13px;opacity:.6;">×</button>
      </div>
      <input class="editor-inp" value="${escHtml(s.name)}" id="spe-se-name" placeholder="Script name">
      <input class="editor-inp editor-ver" value="${escHtml(s.version||'v1.0')}" id="spe-se-ver" placeholder="Version">
      <textarea class="code-area" id="spe-se-code" rows="16">${escHtml(s.code||'')}</textarea>
      <div class="btn-row">
        <button class="btn accent" onclick="speSaveScript('${id}')">Save</button>
        <button class="btn danger" onclick="speDeleteScript('${id}')">Delete</button>
      </div>
    </div>`;
  srvBroadcastActivity('editing: '+s.name.substring(0,28));
}

async function speSaveScript(id){
  const scripts=speProjData.scripts||[];
  const updated=scripts.map(s=>s.id===id?{...s,name:document.getElementById('spe-se-name').value.trim(),version:document.getElementById('spe-se-ver').value.trim(),code:document.getElementById('spe-se-code').value,date:new Date().toLocaleDateString()}:s);
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{scripts:updated});
  await srvBroadcastActivity('saved script');
  await syncProjData(true);toast('Script saved');
}

async function speDeleteScript(id){
  const s=(speProjData.scripts||[]).find(x=>x.id===id);
  const scripts=(speProjData.scripts||[]).filter(s=>s.id!==id);
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{scripts});
  if(!srvState.isHost&&s){await notifyHostDeletion('Script "'+s.name+'"');}
  speActiveScript=null;await syncProjData(true);toast('Script deleted');
}

function speOpenNewScript(){
  if(!speActiveFolder){toast('Select a folder first');return;}
  // Inline new script — add directly to the script list without a modal
  const el=document.getElementById('spe-script-content');if(!el)return;
  // Check if inline form already exists
  if(document.getElementById('spe-ns-inline'))return;
  const form=document.createElement('div');
  form.id='spe-ns-inline';
  form.style.cssText='background:var(--bg2);border:1px solid var(--accent2);border-radius:2px;padding:10px 12px;margin-top:10px;';
  form.innerHTML=`
    <div style="font-size:9px;color:var(--accent2);letter-spacing:.15em;margin-bottom:8px;">NEW SCRIPT</div>
    <div style="display:flex;gap:6px;margin-bottom:6px;">
      <input class="add-inp" id="spe-ns-name" placeholder="e.g. Player.gd, GameManager.cs" style="flex:1;">
      <input class="add-inp" id="spe-ns-ver" placeholder="v1.0" style="width:70px;">
    </div>
    <div style="display:flex;gap:6px;">
      <button class="add-btn" style="color:var(--accent2);border-color:var(--accent2);" onclick="speCreateScriptInline()">Create</button>
      <button class="add-btn" onclick="document.getElementById('spe-ns-inline').remove()">Cancel</button>
    </div>`;
  el.insertBefore(form,el.firstChild);
  document.getElementById('spe-ns-name').focus();
  document.getElementById('spe-ns-name').addEventListener('keydown',e=>{if(e.key==='Enter')speCreateScriptInline();if(e.key==='Escape')form.remove();});
}

async function speCreateScriptInline(){
  const name=(document.getElementById('spe-ns-name')||{}).value?.trim();if(!name)return;
  const scripts=speProjData.scripts||[];
  const id='s_'+Date.now();
  const s={id,name,version:(document.getElementById('spe-ns-ver')||{}).value?.trim()||'v1.0',folder:speActiveFolder,code:'',date:new Date().toLocaleDateString()};
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{scripts:[...scripts,s]});
  speActiveScript=id;
  const form=document.getElementById('spe-ns-inline');if(form)form.remove();
  await syncProjData(true);
  toast('Script created');
}

// ---- SPE ANALYTICS ----
let speTimerInterval=null;let speTimerStart=null;let speTimerRunning=false;

function speRenderAnalytics(){
  const proj=speProjData;
  const sessions=proj.sessions||[];
  const totalMs=sessions.reduce((a,s)=>a+(s.duration||0),0);
  const todayStr=new Date().toLocaleDateString();
  const todayMs=sessions.filter(s=>s.date===todayStr).reduce((a,s)=>a+(s.duration||0),0);
  const weekStart=Date.now()-7*864e5;
  const weekMs=sessions.filter(s=>s.ts>weekStart).reduce((a,s)=>a+(s.duration||0),0);
  const avgMs=sessions.length?totalMs/sessions.length:0;
  const fmtH=ms=>ms<3600000?(ms/60000).toFixed(1)+'m':(ms/3600000).toFixed(1)+'h';
  const d=id=>document.getElementById(id);
  if(d('spe-an-total'))d('spe-an-total').textContent=fmtH(totalMs);
  if(d('spe-an-today'))d('spe-an-today').textContent=fmtH(todayMs);
  if(d('spe-an-week'))d('spe-an-week').textContent=fmtH(weekMs);
  if(d('spe-an-avg'))d('spe-an-avg').textContent=fmtH(avgMs);
  // Session list
  const sl=d('spe-an-session-list');
  if(sl)sl.innerHTML=sessions.slice().reverse().slice(0,20).map(s=>`
    <div class="session-row">
      <div class="session-dot"></div>
      <div class="session-proj">${escHtml(s.label||'Session')} · ${escHtml(s.by||'')}</div>
      <div class="session-dur">${fmtH(s.duration||0)}</div>
      <div class="session-date">${escHtml(s.date||'')}</div>
    </div>`).join('')||'<div style="font-size:11px;color:var(--text3);">No sessions logged.</div>';
  // Bar chart — last 7 days
  const bc=d('spe-an-bar-chart');
  if(bc){
    const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const now=new Date();
    const cols=Array.from({length:7},(_,i)=>{
      const d2=new Date(now);d2.setDate(now.getDate()-6+i);
      const ds=d2.toLocaleDateString();
      const ms=sessions.filter(s=>s.date===ds).reduce((a,s)=>a+(s.duration||0),0);
      return{lbl:days[d2.getDay()],ms};
    });
    const maxMs=Math.max(...cols.map(c=>c.ms),1);
    bc.innerHTML=cols.map(c=>`<div class="bar-col"><div class="bar-fill" style="height:${Math.round(c.ms/maxMs*72)}px;"></div><div class="bar-lbl">${c.lbl}</div></div>`).join('');
  }
  // Heatmap
  const hm=d('spe-an-heatmap');
  if(hm){
    const cells=Array.from({length:52*7},(_,i)=>{
      const d2=new Date();d2.setDate(d2.getDate()-(52*7-1-i));
      const ds=d2.toLocaleDateString();
      const ms=sessions.filter(s=>s.date===ds).reduce((a,s)=>a+(s.duration||0),0);
      const v=ms>14400000?4:ms>7200000?3:ms>1800000?2:ms>0?1:0;
      return`<div class="heatmap-cell" data-v="${v}" title="${ds}: ${fmtH(ms)}"></div>`;
    });
    hm.innerHTML=cells.join('');
  }
}

function speTimerToggle(){
  if(!speTimerRunning){
    speTimerStart=Date.now();speTimerRunning=true;
    document.getElementById('spe-timer-start-btn').textContent='Stop Session';
    document.getElementById('spe-timer-display').classList.add('timer-running');
    speTimerInterval=setInterval(speUpdateTimerDisplay,1000);
    srvBroadcastActivity('dev session running');
  } else {
    clearInterval(speTimerInterval);speTimerRunning=false;
    document.getElementById('spe-timer-start-btn').textContent='Start Session';
    document.getElementById('spe-timer-display').classList.remove('timer-running');
    const dur=Date.now()-speTimerStart;
    speLogSession(dur,'Timer Session');
  }
}

function speUpdateTimerDisplay(){
  if(!speTimerStart)return;
  const ms=Date.now()-speTimerStart;
  const h=Math.floor(ms/3600000).toString().padStart(2,'0');
  const m=Math.floor((ms%3600000)/60000).toString().padStart(2,'0');
  const s=Math.floor((ms%60000)/1000).toString().padStart(2,'0');
  const el=document.getElementById('spe-timer-display');
  if(el)el.textContent=`${h}:${m}:${s}`;
}

async function speLogSession(duration,label){
  const sessions=speProjData.sessions||[];
  const session={id:'ses_'+Date.now(),label,duration,date:new Date().toLocaleDateString(),by:srvState.username,ts:Date.now()};
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{sessions:[...sessions,session]});
  await syncProjData(true);toast('Session logged: '+formatDuration(duration));
}

function formatDuration(ms){const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000);return h?`${h}h ${m}m`:`${m}m`;}

function speOpenLogSession(){
  openModal('Log Manual Session',`
    <label class="modal-label">Label</label>
    <input class="modal-inp" id="spe-ls-label" placeholder="e.g. Feature work, Bug fixing">
    <label class="modal-label">Duration (hours)</label>
    <input class="modal-inp" id="spe-ls-hrs" type="number" step="0.25" min="0" placeholder="e.g. 1.5">
  `,[{label:'Cancel',action:closeModal},{label:'Log',action:async()=>{
    const label=document.getElementById('spe-ls-label').value.trim()||'Manual Session';
    const hrs=parseFloat(document.getElementById('spe-ls-hrs').value)||0;
    closeModal();await speLogSession(hrs*3600000,label);
  },accent:true}]);
}

async function speClearSessions(){
  openModal('Clear Sessions?',`<div style="font-size:11px;color:var(--text2);">This will delete all session data for this project. Cannot be undone.</div>`,
  [{label:'Cancel',action:closeModal},{label:'Clear All',danger:true,action:async()=>{
    await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{sessions:[]});
    closeModal();await syncProjData(true);toast('Sessions cleared');
  }}]);
}

// ---- SPE SCENE TREE (shared data, mirrors solo UX) ----
let speSelectedScene=null;let speSelectedNode=null;

function speRenderSceneTree(){
  speRenderSceneFileTree();speRenderNodeTree();
}

function speRenderSceneFileTree(){
  const proj=speProjData;
  const folders=proj.sceneFolders||[];
  const scenes=proj.scenes||[];
  const el=document.getElementById('spe-scene-file-tree');if(!el)return;
  if(!scenes.length&&!folders.length){el.innerHTML='<div style="font-size:10px;color:var(--text3);padding:12px 8px;">No scenes yet.</div>';return;}
  // Flat list of scenes for now
  el.innerHTML=scenes.map(s=>`
    <div class="sft-scene${speSelectedScene===s.id?' active-scene':''}" onclick="speSelectScene('${s.id}')">
      <span class="sft-scene-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--icon-mid)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M2 6l10-4 10 4v12l-10 4L2 18V6z"/></svg></span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(s.name)}</span>
    </div>`).join('');
}

function speSelectScene(id){
  speSelectedScene=id;speSelectedNode=null;
  speRenderSceneFileTree();speRenderNodeTree();
  const scene=(speProjData.scenes||[]).find(s=>s.id===id);
  document.getElementById('spe-st-panel-title').textContent=scene?scene.name.toUpperCase():'NODE TREE';
  document.getElementById('spe-st-add-btn').disabled=false;document.getElementById('spe-st-add-btn').style.opacity='1';
  srvBroadcastActivity('scene: '+(scene?scene.name:'?').substring(0,25));
}

function speRenderNodeTree(){
  const el=document.getElementById('spe-scene-node-tree');if(!el)return;
  if(!speSelectedScene){el.innerHTML='<div style="font-size:10px;color:var(--text3);padding:12px 8px;">Select a scene</div>';return;}
  const scene=(speProjData.scenes||[]).find(s=>s.id===speSelectedScene);
  if(!scene){el.innerHTML='';return;}
  const nodes=scene.nodes||[];
  function renderNode(node,depth){
    const children=nodes.filter(n=>n.parent===node.id);
    return`<div class="st-node">
      <div class="st-node-row${speSelectedNode===node.id?' selected':''}" style="padding-left:${6+depth*14}px;" onclick="speSelectNode('${node.id}')">
        <div class="st-node-arr${children.length?' open':'leaf'}">▶</div>
        <div class="st-node-icon">${typeof getNodeSVGIcon !== 'undefined' ? getNodeSVGIcon(node.type||'Node',12) : ''}</div>
        <div class="st-node-name${node.script?' has-script':''}">${escHtml(node.name)}</div>
        <div class="st-node-id">${escHtml(node.type||'Node')}</div>
      </div>
      ${children.map(c=>renderNode(c,depth+1)).join('')}
    </div>`;
  }
  const roots=nodes.filter(n=>!n.parent||n.parent==='root');
  el.innerHTML=roots.map(n=>renderNode(n,0)).join('')||'<div style="font-size:10px;color:var(--text3);padding:12px 8px;">No nodes yet.</div>';
}

function speSelectNode(id){
  speSelectedNode=id;
  speRenderNodeTree();
  const scene=(speProjData.scenes||[]).find(s=>s.id===speSelectedScene);
  const node=scene&&(scene.nodes||[]).find(n=>n.id===id);
  document.getElementById('spe-st-del-btn').disabled=!node;document.getElementById('spe-st-del-btn').style.opacity=node?'1':'.4';
  const ib=document.getElementById('spe-inspector-body');if(!ib)return;
  if(!node){ib.innerHTML='<div class="no-sel-msg">Select a node</div>';return;}
  ib.innerHTML=`
    <div style="padding:10px 12px;">
      <div style="font-size:10px;color:var(--text3);letter-spacing:.12em;margin-bottom:10px;">${escHtml(node.type||'Node')}</div>
      <label class="inline-lbl">Name</label>
      <input class="editor-inp" value="${escHtml(node.name)}" id="spe-insp-name" style="margin-bottom:8px;">
      <label class="inline-lbl">Type</label>
      <input class="editor-inp" value="${escHtml(node.type||'')}" id="spe-insp-type" style="margin-bottom:8px;">
      <label class="inline-lbl">Script</label>
      <input class="editor-inp" value="${escHtml(node.script||'')}" id="spe-insp-script" placeholder="res://scripts/MyNode.gd" style="margin-bottom:12px;">
      <button class="btn accent" style="width:100%;font-size:9px;" onclick="speSaveNode('${id}')">Save Node</button>
    </div>`;
}

async function speSaveNode(nodeId){
  const scenes=JSON.parse(JSON.stringify(speProjData.scenes||[]));
  const si=scenes.findIndex(s=>s.id===speSelectedScene);if(si<0)return;
  const ni=scenes[si].nodes.findIndex(n=>n.id===nodeId);if(ni<0)return;
  scenes[si].nodes[ni]={...scenes[si].nodes[ni],name:document.getElementById('spe-insp-name').value.trim(),type:document.getElementById('spe-insp-type').value.trim(),script:document.getElementById('spe-insp-script').value.trim()};
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{scenes});
  await srvBroadcastActivity('edited node');
  await syncProjData(true);toast('Node saved');
}

function speNewSceneModal(){
  openModal('New Scene',`
    <label class="modal-label">Scene Name</label>
    <input class="modal-inp" id="spe-sc-name" placeholder="e.g. Main, Player, HUD">
  `,[{label:'Cancel',action:closeModal},{label:'Create',action:async()=>{
    const name=document.getElementById('spe-sc-name').value.trim();if(!name)return;
    const scenes=speProjData.scenes||[];
    const id='sc_'+Date.now();
    await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{scenes:[...scenes,{id,name,nodes:[]}]});
    speSelectedScene=id;
    closeModal();await syncProjData(true);
  },accent:true}]);
}

function speNewFolderModal(){toast('Folder support coming soon');}

function speAddNodeModal(){
  if(!speSelectedScene){toast('Select a scene first');return;}
  openModal('Add Node',`
    <label class="modal-label">Node Name</label>
    <input class="modal-inp" id="spe-nd-name" placeholder="e.g. Player, Camera, HUD">
    <label class="modal-label">Type</label>
    <input class="modal-inp" id="spe-nd-type" placeholder="e.g. CharacterBody3D, Node2D">
    <label class="modal-label">Icon</label>
    <input class="modal-inp" id="spe-nd-icon" placeholder="node type e.g. Camera2D, Area2D" maxlength="4">
  `,[{label:'Cancel',action:closeModal},{label:'Add',action:async()=>{
    const name=document.getElementById('spe-nd-name').value.trim();if(!name)return;
    const scenes=JSON.parse(JSON.stringify(speProjData.scenes||[]));
    const si=scenes.findIndex(s=>s.id===speSelectedScene);if(si<0)return;
    const node={id:'nd_'+Date.now(),name,type:document.getElementById('spe-nd-type').value.trim(),icon:document.getElementById('spe-nd-icon').value.trim()||'Node',parent:speSelectedNode||null,script:''};
    scenes[si].nodes=[...(scenes[si].nodes||[]),node];
    await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{scenes});
    await srvBroadcastActivity('added node: '+name);
    closeModal();await syncProjData(true);
  },accent:true}]);
}

async function speDeleteNode(){
  if(!speSelectedNode||!speSelectedScene)return;
  const scenes=JSON.parse(JSON.stringify(speProjData.scenes||[]));
  const si=scenes.findIndex(s=>s.id===speSelectedScene);if(si<0)return;
  const node=(scenes[si].nodes||[]).find(n=>n.id===speSelectedNode);
  scenes[si].nodes=(scenes[si].nodes||[]).filter(n=>n.id!==speSelectedNode);
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{scenes});
  if(!srvState.isHost&&node){await notifyHostDeletion('Scene Node "'+node.name+'"');}
  speSelectedNode=null;await syncProjData(true);toast('Node removed');
}

// ---- SPE GDD ----
function speRenderGDD(){
  const sections=speProjData.gddSections||[];
  const el=document.getElementById('spe-gdd-list');if(!el)return;
  if(!sections.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);padding:20px 0;">No GDD sections yet. Add one to start writing.</div>';return;}
  el.innerHTML=sections.map((s,i)=>`
    <div class="card" style="margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <input class="editor-inp" value="${escHtml(s.title||'')}" id="spe-gdd-t${i}" style="font-family:var(--vt);font-size:18px;color:var(--accent);flex:1;background:none;border:none;border-bottom:1px solid var(--border);padding:0 0 4px;" placeholder="Section Title">
        <button onclick="speDeleteGDDSection(${i})" class="xbtn" style="margin-left:8px;">×</button>
      </div>
      <textarea class="notes-area" id="spe-gdd-c${i}" style="min-height:120px;" onblur="speAutoSaveGDD()">${escHtml(s.content||'')}</textarea>
    </div>`).join('');
}

async function speAutoSaveGDD(){
  const sections=(speProjData.gddSections||[]).map((s,i)=>({...s,title:(document.getElementById('spe-gdd-t'+i)||{}).value||s.title,content:(document.getElementById('spe-gdd-c'+i)||{}).value||s.content}));
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{gddSections:sections});
  await srvBroadcastActivity('editing GDD');
}

async function speAddGDDSection(){
  const sections=speProjData.gddSections||[];
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{gddSections:[...sections,{title:'New Section',content:''}]});
  await syncProjData(true);
}

async function speDeleteGDDSection(idx){
  const sec=(speProjData.gddSections||[])[idx];
  const sections=(speProjData.gddSections||[]).filter((_,i)=>i!==idx);
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{gddSections:sections});
  if(!srvState.isHost&&sec){await notifyHostDeletion('GDD Section "'+sec.title+'"');}
  await syncProjData(true);
}

function speExportGDD(){
  const sections=speProjData.gddSections||[];
  const text=sections.map(s=>`# ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
  const blob=new Blob([text],{type:'text/markdown'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(speProjData.name||'project').replace(/\s+/g,'-').toLowerCase()+'-gdd.md';a.click();
  toast('GDD exported');
}

// ---- SPE ASSET TRACKER ----
function speRenderAssets(){
  const assets=speProjData.assets||[];
  const filter=(document.getElementById('spe-asset-filter')||{}).value||'all';
  const filtered=filter==='all'?assets:assets.filter(a=>a.type===filter);
  const el=document.getElementById('spe-assets-list');if(!el)return;
  const statusColors={pending:'#888',inprogress:'#f0a04a',done:'#c8f04a',blocked:'#f04a4a'};
  if(!filtered.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);padding:20px 0;">No assets yet.</div>';return;}
  el.innerHTML=`<div class="survivor-grid">${filtered.map(a=>`
    <div class="survivor-card">
      <div class="surv-name">${escHtml(a.name)}</div>
      <div class="surv-row"><span class="surv-key">Type</span><span class="surv-val">${escHtml(a.type||'')}</span></div>
      <div class="surv-row"><span class="surv-key">Status</span><span class="tag" style="color:${statusColors[a.status]||'#888'};border-color:${statusColors[a.status]||'#888'};">${a.status||'pending'}</span></div>
      <div class="surv-row"><span class="surv-key">Assignee</span><span class="surv-val">${escHtml(a.assignee||'—')}</span></div>
      ${a.notes?`<div style="font-size:10px;color:var(--text2);margin-top:6px;">${escHtml(a.notes)}</div>`:''}
      <div class="surv-actions">
        <button class="btn" style="font-size:9px;" onclick="speCycleAsset('${a.id}')">${a.status==='done'?'↺':a.status==='inprogress'?'<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>':'→'}</button>
        <button class="btn danger" style="font-size:9px;" onclick="speDeleteAsset('${a.id}')">×</button>
      </div>
    </div>`).join('')}</div>`;
}

function speOpenAddAsset(){
  openModal('Add Asset',`
    <label class="modal-label">Name</label>
    <input class="modal-inp" id="spe-as-name" placeholder="e.g. Player_Walk_Anim.png">
    <label class="modal-label">Type</label>
    <select class="modal-select" id="spe-as-type"><option value="sprite">Sprite</option><option value="audio">Audio</option><option value="model">3D Model</option><option value="fx">VFX / Shader</option><option value="ui">UI</option><option value="other">Other</option></select>
    <label class="modal-label">Assignee</label>
    <input class="modal-inp" id="spe-as-assign" placeholder="Who's making this?" value="${escHtml(srvState.username)}">
    <label class="modal-label">Notes</label>
    <input class="modal-inp" id="spe-as-notes" placeholder="Optional notes…">
  `,[{label:'Cancel',action:closeModal},{label:'Add',action:async()=>{
    const name=document.getElementById('spe-as-name').value.trim();if(!name)return;
    const assets=speProjData.assets||[];
    const id='as_'+Date.now();
    const asset={id,name,type:document.getElementById('spe-as-type').value,assignee:document.getElementById('spe-as-assign').value.trim(),notes:document.getElementById('spe-as-notes').value.trim(),status:'pending',createdBy:srvState.username};
    await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{assets:[...assets,asset]});
    await srvBroadcastActivity('added asset: '+name.substring(0,25));
    closeModal();await syncProjData(true);toast('Asset added');
  },accent:true}]);
}

async function speCycleAsset(id){
  const statuses=['pending','inprogress','done'];
  const assets=(speProjData.assets||[]);
  const asset=assets.find(a=>a.id===id);if(!asset)return;
  const next=statuses[(statuses.indexOf(asset.status)+1)%statuses.length];
  const updated=assets.map(a=>a.id===id?{...a,status:next}:a);
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{assets:updated});
  await srvBroadcastActivity('asset '+next+': '+asset.name.substring(0,20));
  await syncProjData(true);
}

async function speDeleteAsset(id){
  const a=(speProjData.assets||[]).find(x=>x.id===id);
  const assets=(speProjData.assets||[]).filter(a=>a.id!==id);
  await fbPatch('/servers/'+srvState.serverKey+'/projects/'+srvState.activeProjId,{assets});
  if(!srvState.isHost&&a){await notifyHostDeletion('Asset "'+a.name+'"');}
  await syncProjData(true);toast('Asset removed');
}