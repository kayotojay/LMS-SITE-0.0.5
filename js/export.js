// LMS Dev Hub — export.js
// ========================================

// =====================================================
// EXPORT / IMPORT ROOT
// =====================================================
function exportRoot(id){
  const root=roots.find(r=>r.id===id);
  const data=getRootData(id);
  const blob={_type:'lmsroot',_version:2,root,data,phases:{main:data.customPhases?.main||[],sub:data.customPhases?.sub||[]}};
  downloadFile(JSON.stringify(blob,null,2),(root?.name||'project').replace(/\s+/g,'-').toLowerCase()+'.lmsroot','application/json');
  toast('Root exported');
}
function exportCurrentRoot(){if(activeRootId)exportRoot(activeRootId);}

// ---- SERVER ROOT EXPORT ----
async function exportServerRoot(projId){
  if(!srvState.connected)return;
  toast('Fetching server project…');
  const proj=await fbGet('/servers/'+srvState.serverKey+'/projects/'+projId);
  if(!proj){toast('Project not found');return;}
  const blob={_type:'lmsroot',_version:2,_source:'server',root:{id:projId,name:proj.name||'server-project',engine:proj.engine||'',genre:proj.genre||'',color:proj.color||'var(--accent)',created:proj.createdAt?new Date(proj.createdAt).toLocaleDateString():''},data:proj.data||{},phases:{main:proj.data?.customPhases?.main||[],sub:proj.data?.customPhases?.sub||[]}};
  downloadFile(JSON.stringify(blob,null,2),(proj.name||'server-project').replace(/\s+/g,'-').toLowerCase()+'.lmsroot','application/json');
  toast('Server root exported');
}

// ---- IMPORT ROOT (with overwrite/append modal) ----
let _pendingImportBlob=null;
let _pendingImportType=null;

function openCommunity(){
  const old=document.getElementById('community-modal');if(old)old.remove();
  const modal=document.createElement('div');
  modal.id='community-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(16px);';
  modal.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:3px;padding:48px 40px;max-width:420px;width:90%;font-family:var(--font);text-align:center;position:relative;">
      <div style="font-family:var(--vt);font-size:48px;letter-spacing:.1em;background:linear-gradient(135deg,#c8f04a,#4af0c8,#a04af0,#c8f04a);background-size:300% 300%;animation:gradShift 5s ease infinite;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:12px;"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg></div>
      <div style="font-family:var(--vt);font-size:30px;color:var(--text);letter-spacing:.12em;margin-bottom:10px;">COMMUNITY</div>
      <div style="font-size:9px;color:var(--text3);letter-spacing:.25em;text-transform:uppercase;margin-bottom:28px;">LMS Dev Hub</div>
      <div style="background:linear-gradient(135deg,rgba(200,240,74,.06),rgba(74,240,200,.04));border:1px solid rgba(200,240,74,.2);border-radius:3px;padding:24px;margin-bottom:24px;">
        <div style="font-family:var(--vt);font-size:22px;color:var(--accent);letter-spacing:.15em;margin-bottom:8px;">COMING SOON</div>
        <div style="font-size:10px;color:var(--text2);line-height:1.8;letter-spacing:.04em;">The Community hub is in development.<br>Connect with other devs, share your<br>projects, and collaborate across teams.</div>
      </div>
      <button onclick="document.getElementById('community-modal').remove()" style="background:linear-gradient(135deg,rgba(200,240,74,.1),rgba(74,240,200,.05));border:1px solid var(--accent);color:var(--accent);font-family:var(--font);font-size:10px;padding:9px 30px;cursor:pointer;border-radius:2px;letter-spacing:.1em;">← Back</button>
    </div>`;
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
  document.body.appendChild(modal);
}


function importRootFile(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const blob=JSON.parse(e.target.result);
      if(blob._type!=='lmsroot')throw new Error('Not a .lmsroot file');
      _pendingImportBlob=blob;_pendingImportType='root';
      showImportModal('root',blob.root?.name||file.name);
    }catch(err){toast('Import failed: '+err.message);}
  };
  reader.readAsText(file);input.value='';
}

function showExportLastManTasks(){
  const blob={_type:'lmstasks',_version:1,_name:'Last Man Standing',_desc:'Godot 3 Horror Survival starter template',
    main:[
      {id:'mp1',label:'P1',color:'#c8f04a',tc:'#080808',title:'The Shell',tasks:["Block out all camp zones in Godot 3D","Player controller — walk all zones","Raycast interact on placeholder NPC","Day/night cycle — screen blacks, time advances","NPCs teleport to correct zone on time transition","One NPC with working dialogue trigger","Scene loads without errors","Camp zones clearly separated by invisible walls"]},
      {id:'mp2',label:'P2',color:'#4af0c8',tc:'#080808',title:'Data Backbone',tasks:["SurvivorData autoload — full survivor dictionary","SurvivorManager — alive/dead/infected state","Trust score system updates on choices","Morning report UI — nightly event summary","Day counter visible to player","Personality types wired to dialogue flags","Relationship web between survivors","Run start randomisation works correctly"]},
      {id:'mp3',label:'P3',color:'#f04a4a',tc:'#fff',title:'The Killer',tasks:["Killer flag assigned randomly at run start","Night phase executes killer logic","Killer targets isolated survivors first","Death state updates SurvivorData","Morning report reflects deaths","Killer boldness scales with days","Killer never targets same survivor twice in a row","Killer can frame deaths as infection"]},
      {id:'mp4',label:'P4',color:'#f0a04a',tc:'#080808',title:'Infection',tasks:["Random infection triggers after X days","Infection timer per survivor","Player choice UI — Kill/Quarantine/Ignore/Hide","Trust ripple based on personality + relationships","Unquarantined survivor spreads infection","Recovery chance if quarantined","Infection visual cue on NPC","Infection log in morning report"]},
      {id:'mp5',label:'P5',color:'#a04af0',tc:'#fff',title:'Evidence',tasks:["Hidden evidence score tracked globally","Clue system — dialogue lines award points","Killer tells active — location/dialogue/reaction","Accusation unlocks at 60 evidence","Accusation dialogue sequence","Win condition on correct accusation","Wrong accusation reputation crash","Evidence score shown near threshold"]},
      {id:'mp6',label:'P6',color:'#4a9af0',tc:'#fff',title:'Endings',tasks:["New survivor arrival roll fires nightly","Arrival choice UI","Escape components hidden in camp","Escape ending sequence","Survive X days ending","All loss endings implemented","End screen with run summary","Stats tracked per run"]}
    ],
    sub:[
      {id:'sp1',label:'SP1',color:'#555',tc:'#ddd',title:'Shell Details',_subPhase:true,tasks:["Tune player walk speed and camera feel","Add ambient light change per time of day","Confirm transition screens feel smooth","Label zones in editor for easy navigation","Test raycast range at conversational distance","Add collision walls around perimeter","Verify all zones reachable by player","Basic footstep sound on walk (placeholder ok)"]},
      {id:'sp2',label:'SP2',color:'#444',tc:'#ccc',title:'Data Details',_subPhase:true,tasks:["Validate all survivor IDs unique at run start","Debug readout of survivor states in testing","Stub all survivor slots before writing dialogue","Test morning report reflects all changes","Loyalty stat alongside trust confirmed","Add remove/restore survivor utility function","Export survivor state to JSON for debugging","Profile memory usage with 15 survivors loaded"]},
      {id:'sp3',label:'SP3',color:'#3a3a3a',tc:'#bbb',title:'Killer Details',_subPhase:true,tasks:["Log killer actions to hidden debug panel","Phase 3 test: killer kills by day 5","Killer avoids acting if player nearby","Death message pool — no repeats","Add killer suspicion score visible in debug","Killer spreads rumours to lower player rep","Test all killer action paths independently","Verify killer flag persists correctly on save"]},
      {id:'sp4',label:'SP4',color:'#333',tc:'#aaa',title:'Infection Details',_subPhase:true,tasks:["Quarantine deducts food resource","If hidden infection discovered — rep crash","Compassionate survivors oppose killing infected","Pragmatic survivors respect the hard call","Test spread chain: 1 infects 2 over 3 days","Add infection severity levels (mild/severe)","Killer can spend time near infected for cover","Check infection timer resets on recovery"]},
      {id:'sp5',label:'SP5',color:'#2a2a2a',tc:'#999',title:'Evidence Details',_subPhase:true,tasks:["Randomise which 3 tells killer has per run","Clue dialogue only fires at sufficient trust","Add red herring clues pointing to innocents","Killer reacts differently at high evidence","End accusation scene uses trust scores for group reaction","Test evidence score doesn't overflow","Verify wrong accusation cannot loop","Evidence audit: confirm all clue paths reachable"]},
      {id:'sp6',label:'SP6',color:'#222',tc:'#888',title:'Endings Details',_subPhase:true,tasks:["New arrivals start at trust 30","Cautious survivors suspicious of newcomers","Killer may target new arrivals early","Escape components findable via high-trust dialogue","Unique cutscene for wrong accusation collapse","Show which survivors lived on end screen","Seed next-run hint on end screen","Test all 6 ending states fire correctly"]}
    ]
  };
  downloadFile(JSON.stringify(blob,null,2),'last-man-standing.lmstasks','application/json');
  toast('Template exported');
}

function downloadFile(content,filename,type){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=filename;a.click();URL.revokeObjectURL(a.href);
}

function triggerImportRoot(){document.getElementById('import-root-file').click();}
function triggerImportTasks(){document.getElementById('import-tasks-file').click();}
function importTasksFileBtn(){document.getElementById('import-tasks-file').click();}

function importTasksFile(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const blob=JSON.parse(e.target.result);
      if(blob._type!=='lmstasks')throw new Error('Not a .lmstasks file');
      _pendingImportBlob=blob;_pendingImportType='tasks';
      showImportModal('tasks',blob._name||file.name);
    }catch(err){toast('Import failed: '+err.message);}
  };
  reader.readAsText(file);input.value='';
}

function triggerImportBackup(){document.getElementById('import-backup-file').click();}
function importBackupFile(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const backup=JSON.parse(e.target.result);
      if(!backup.roots)throw new Error('Invalid backup file');
      _pendingImportBlob=backup;_pendingImportType='backup';
      showImportModal('backup',file.name+' ('+backup.roots.length+' projects)');
    }catch(err){toast('Restore failed: '+err.message);}
  };
  reader.readAsText(file);input.value='';
}

function gdriveExportAll(){
  const data={roots,data:{}};
  roots.forEach(r=>{data.data[r.id]=getRootData(r.id);});
  downloadFile(JSON.stringify(data,null,2),'lms-devhub-backup.json','application/json');
  toast('Full backup downloaded');
}

// ====================================================
// IMPORT TO EXISTING PROJECT FLOW
// ====================================================
function openImportToProjectPicker(blob){
  // Show a modal where user picks which existing project to import into, then append/overwrite
  if(!roots.length){toast('No local projects exist. Create one first.');return;}
  const old=document.getElementById('itp-modal');if(old)old.remove();
  const modal=document.createElement('div');
  modal.id='itp-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9600;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);';
  modal.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:3px;padding:28px;max-width:480px;width:93%;font-family:var(--font);max-height:85vh;overflow-y:auto;">
      <div style="font-family:var(--vt);font-size:22px;color:var(--accent);letter-spacing:.1em;margin-bottom:4px;">IMPORT TO PROJECT</div>
      <div style="font-size:9px;color:var(--text3);letter-spacing:.12em;margin-bottom:6px;">Importing: <span style="color:var(--text);">${escHtml(blob.root?.name||blob._name||'file')}</span></div>
      <div style="font-size:9px;color:var(--text3);letter-spacing:.1em;margin-bottom:18px;line-height:1.6;">Select which project to import into, then choose Append or Overwrite.</div>
      <label style="font-size:9px;color:var(--text3);letter-spacing:.12em;display:block;margin-bottom:6px;">SELECT TARGET PROJECT</label>
      <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:18px;max-height:220px;overflow-y:auto;" id="itp-proj-list">
        ${roots.map(r=>`
          <label style="display:flex;align-items:center;gap:10px;background:var(--bg3);border:1px solid var(--border);border-radius:2px;padding:9px 12px;cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <input type="radio" name="itp-proj" value="${r.id}" style="accent-color:var(--accent);">
            <div style="width:8px;height:8px;border-radius:50%;background:${r.color||'#c8f04a'};flex-shrink:0;"></div>
            <span style="font-size:11px;color:var(--text);flex:1;">${escHtml(r.name)}</span>
            <span style="font-size:9px;color:var(--text3);">${escHtml(r.engine||'')}</span>
          </label>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button onclick="applyImportToProject('append','${escHtml(blob._itp_key||'_tmp_')}')" style="flex:1;background:linear-gradient(135deg,rgba(200,240,74,.08),rgba(74,240,200,.04));border:1px solid var(--accent);color:var(--accent);font-family:var(--font);font-size:10px;padding:12px 10px;cursor:pointer;border-radius:2px;letter-spacing:.04em;">
          <div style="font-size:11px;margin-bottom:3px;">⊕ Append</div>
          <div style="font-size:8px;color:var(--text3);line-height:1.5;">Add imported data alongside existing — nothing removed.</div>
        </button>
        <button onclick="applyImportToProject('overwrite','${escHtml(blob._itp_key||'_tmp_')}')" style="flex:1;background:linear-gradient(135deg,rgba(240,74,74,.08),rgba(240,74,74,.03));border:1px solid var(--accent3);color:var(--accent3);font-family:var(--font);font-size:10px;padding:12px 10px;cursor:pointer;border-radius:2px;letter-spacing:.04em;">
          <div style="font-size:11px;margin-bottom:3px;">⊘ Overwrite</div>
          <div style="font-size:8px;color:var(--text3);line-height:1.5;">Replace the selected project with the imported data.</div>
        </button>
      </div>
      <button onclick="document.getElementById('itp-modal').remove();_itpBlobStore={};" style="background:none;border:none;color:var(--text3);font-family:var(--font);font-size:9px;cursor:pointer;letter-spacing:.08em;width:100%;text-align:center;padding:4px;">Cancel</button>
    </div>`;
  document.body.appendChild(modal);
}

let _itpBlobStore={};

function applyImportToProject(mode,blobKey){
  const blob=_itpBlobStore[blobKey];
  if(!blob){toast('Import data lost — try again');return;}
  const sel=document.querySelector('input[name="itp-proj"]:checked');
  if(!sel){toast('Select a project first');return;}
  const targetId=sel.value;
  const targetRoot=roots.find(r=>r.id===targetId);
  if(!targetRoot){toast('Project not found');return;}
  document.getElementById('itp-modal').remove();

  if(blob._type==='lmsroot'){
    const importedData=blob.data||newProjectData();
    if(blob.phases){
      if(!importedData.customPhases)importedData.customPhases={main:[],sub:[]};
      if(blob.phases.main?.length)importedData.customPhases.main=[...blob.phases.main];
      if(blob.phases.sub?.length)importedData.customPhases.sub=[...blob.phases.sub];
    }
    if(mode==='overwrite'){
      // Replace the target project's data entirely but keep name/color/engine
      saveRootData(targetId,importedData);
      if(activeRootId===targetId)D=getRootData(targetId);
      toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Overwrote "'+targetRoot.name+'" with imported data');
    } else {
      // Append — merge scripts, bugs, notes, versions etc.
      const existing=getRootData(targetId);
      existing.scripts=[...(existing.scripts||[]),...(importedData.scripts||[])];
      existing.bugs=[...(existing.bugs||[]),...(importedData.bugs||[])];
      existing.notes=[...(existing.notes||[]),...(importedData.notes||[])];
      existing.versions=[...(existing.versions||[]),...(importedData.versions||[])];
      existing.survivors=[...(existing.survivors||[]),...(importedData.survivors||[])];
      existing.assets=[...(existing.assets||[]),...(importedData.assets||[])];
      // Merge phases
      if(!existing.customPhases)existing.customPhases={main:[],sub:[]};
      const existIds=new Set([...existing.customPhases.main,...existing.customPhases.sub].map(p=>p.id));
      (importedData.customPhases?.main||[]).forEach(p=>{if(!existIds.has(p.id))existing.customPhases.main.push(p);});
      (importedData.customPhases?.sub||[]).forEach(p=>{if(!existIds.has(p.id))existing.customPhases.sub.push(p);});
      saveRootData(targetId,existing);
      if(activeRootId===targetId)D=getRootData(targetId);
      toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Appended imported data into "'+targetRoot.name+'"');
    }
  } else if(blob._type==='lmstasks'){
    const existing=getRootData(targetId);
    if(!existing.customPhases)existing.customPhases={main:[],sub:[]};
    if(mode==='overwrite'){
      existing.customPhases.main=blob.main?blob.main.map(p=>({...p})):[];
      existing.customPhases.sub=blob.sub?blob.sub.map(p=>({...p,_subPhase:true})):[];
    } else {
      const existIds=new Set([...existing.customPhases.main,...existing.customPhases.sub].map(p=>p.id));
      (blob.main||[]).forEach(p=>{if(!existIds.has(p.id))existing.customPhases.main.push({...p});});
      (blob.sub||[]).forEach(p=>{if(!existIds.has(p.id))existing.customPhases.sub.push({...p,_subPhase:true});});
    }
    saveRootData(targetId,existing);
    if(activeRootId===targetId){D=getRootData(targetId);buildPhaseGrids();updateGlobal();}
    toast('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>'+(mode==='overwrite'?'Overwrote':'Appended')+' phases into "'+targetRoot.name+'"');
  }
  delete _itpBlobStore[blobKey];
  renderRootGrid();
}

// ====================================================
// IMPORT MODAL — overwrite / append + dashboard notice
// ====================================================
function showImportModal(type,label){
  const old=document.getElementById('import-mode-modal');if(old)old.remove();

  let appendTitle='⊕ Append';let appendDesc='';
  let overwriteTitle='⊘ Overwrite';let overwriteDesc='';

  if(type==='root'){
    appendTitle='⊕ Add as New Project';
    appendDesc='Imports as a brand-new project on the home screen. Your existing projects are untouched.';
    overwriteTitle='⊘ Replace Existing';
    overwriteDesc='If a project with the same name exists, it will be replaced. Otherwise added as new.';
  } else if(type==='tasks'){
    appendTitle='⊕ Append Phases';
    appendDesc='New phases from the file are added to the current project. Duplicate phases are skipped.';
    overwriteTitle='⊘ Replace All Phases';
    overwriteDesc='All existing phases in the current project are removed and replaced with the imported ones.';
  } else if(type==='backup'){
    appendTitle='⊕ Append Projects';
    appendDesc='Projects from the backup that don\'t already exist are added. Existing ones are untouched.';
    overwriteTitle='⊘ Restore Full Backup';
    overwriteDesc='All current projects are removed and replaced with everything in the backup file.';
  }

  // For root/tasks imports, allow "Import to Project" option
  const showImportToProj=(type==='root'||type==='tasks')&&roots.length>0;
  const importToProjBtn=showImportToProj?`
    <button onclick="triggerImportToProject()" style="background:linear-gradient(135deg,rgba(74,154,240,.12),rgba(74,154,240,.06));border:1px solid #4a9af0;color:#4a9af0;font-family:var(--font);font-size:10px;padding:12px 16px;cursor:pointer;border-radius:2px;text-align:left;letter-spacing:.04em;">
      <div style="font-size:12px;margin-bottom:4px;">⇒ Import to Project</div>
      <div style="font-size:9px;color:var(--text3);line-height:1.5;">Choose any existing project and append or overwrite it — regardless of the imported file's name.</div>
    </button>`:'';

  const modal=document.createElement('div');
  modal.id='import-mode-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);';
  modal.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:3px;padding:28px 28px 22px;max-width:440px;width:92%;font-family:var(--font);">
      <div style="font-family:var(--vt);font-size:22px;color:var(--accent);letter-spacing:.1em;margin-bottom:4px;">IMPORT</div>
      <div style="font-size:9px;color:var(--text3);letter-spacing:.12em;margin-bottom:20px;word-break:break-all;line-height:1.6;">${escHtml(label)}</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
        <button onclick="applyImport('append')" style="background:linear-gradient(135deg,rgba(200,240,74,.08),rgba(74,240,200,.04));border:1px solid var(--accent);color:var(--accent);font-family:var(--font);font-size:10px;padding:12px 16px;cursor:pointer;border-radius:2px;text-align:left;letter-spacing:.04em;">
          <div style="font-size:12px;margin-bottom:4px;">${appendTitle}</div>
          <div style="font-size:9px;color:var(--text3);line-height:1.5;">${appendDesc}</div>
        </button>
        <button onclick="applyImport('overwrite')" style="background:linear-gradient(135deg,rgba(240,74,74,.08),rgba(240,74,74,.03));border:1px solid var(--accent3);color:var(--accent3);font-family:var(--font);font-size:10px;padding:12px 16px;cursor:pointer;border-radius:2px;text-align:left;letter-spacing:.04em;">
          <div style="font-size:12px;margin-bottom:4px;">${overwriteTitle}</div>
          <div style="font-size:9px;color:var(--text3);line-height:1.5;">${overwriteDesc}</div>
        </button>
        ${importToProjBtn}
      </div>
      <button onclick="document.getElementById('import-mode-modal').remove();_pendingImportBlob=null;_pendingImportType=null;" style="background:none;border:none;color:var(--text3);font-family:var(--font);font-size:9px;cursor:pointer;letter-spacing:.08em;width:100%;text-align:center;padding:4px;">Cancel</button>
    </div>`;
  document.body.appendChild(modal);
}

function triggerImportToProject(){
  const modal=document.getElementById('import-mode-modal');if(modal)modal.remove();
  if(!_pendingImportBlob){toast('Nothing to import');return;}
  const blob=_pendingImportBlob;
  const blobKey='itp_'+Date.now();
  _itpBlobStore[blobKey]=blob;
  blob._itp_key=blobKey;
  _pendingImportBlob=null;_pendingImportType=null;
  openImportToProjectPicker(blob);
}

function applyImport(mode){
  const modal=document.getElementById('import-mode-modal');if(modal)modal.remove();
  if(!_pendingImportBlob){toast('Nothing to import');return;}
  const blob=_pendingImportBlob;const type=_pendingImportType;
  _pendingImportBlob=null;_pendingImportType=null;

  const report={roots:[],tasks:{main:[],sub:[]}};

  try{
    if(type==='root'){
      // Always results in a project on the root screen (never modifies open active project)
      if(mode==='overwrite'){
        // Replace existing project with same name if found, otherwise add new
        const origName=blob.root?.name||'';
        const idx=origName?roots.findIndex(r=>r.name===origName):-1;
        if(idx>=0){
          // Replace in-place keeping same id so data key matches
          const existingId=roots[idx].id;
          const root={...blob.root,id:existingId,created:roots[idx].created||new Date().toLocaleDateString()};
          const data=blob.data||newProjectData();
          if(blob.phases){if(!data.customPhases)data.customPhases={main:[],sub:[]};if(blob.phases.main?.length)data.customPhases.main=[...blob.phases.main];if(blob.phases.sub?.length)data.customPhases.sub=[...blob.phases.sub];}
          roots[idx]=root;
          saveRootData(existingId,data);
          // Refresh active project data if it's the one being overwritten
          if(activeRootId===existingId)D=getRootData(existingId);
          report.roots.push({name:root.name,action:'overwritten'});
        } else {
          // No match — just add as new
          const newId='root_'+Date.now();
          const root={...blob.root,id:newId,created:new Date().toLocaleDateString()};
          const data=blob.data||newProjectData();
          if(blob.phases){if(!data.customPhases)data.customPhases={main:[],sub:[]};if(blob.phases.main?.length)data.customPhases.main=[...blob.phases.main];if(blob.phases.sub?.length)data.customPhases.sub=[...blob.phases.sub];}
          roots.push(root);saveRootData(newId,data);
          report.roots.push({name:root.name,action:'added (no match found)'});
        }
      } else {
        // Append — always add as a new project
        const newId='root_'+Date.now();
        const root={...blob.root,id:newId,created:new Date().toLocaleDateString()};
        const data=blob.data||newProjectData();
        if(blob.phases){if(!data.customPhases)data.customPhases={main:[],sub:[]};if(blob.phases.main?.length)data.customPhases.main=[...blob.phases.main];if(blob.phases.sub?.length)data.customPhases.sub=[...blob.phases.sub];}
        roots.push(root);saveRootData(newId,data);
        report.roots.push({name:root.name,action:'added'});
      }
      saveRoots();
      renderRootGrid();

    } else if(type==='tasks'){
      // Operates on the currently open project (D)
      if(!D){toast('Open a project first to import tasks into it');return;}
      if(!D.customPhases)D.customPhases={main:[],sub:[]};
      if(mode==='overwrite'){
        D.customPhases.main=blob.main?blob.main.map(p=>({...p})):[];
        D.customPhases.sub=blob.sub?blob.sub.map(p=>({...p,_subPhase:true})):[];
        (blob.main||[]).forEach(p=>report.tasks.main.push({title:p.title,action:'overwritten'}));
        (blob.sub||[]).forEach(p=>report.tasks.sub.push({title:p.title,action:'overwritten'}));
      } else {
        const existing=new Set([...D.customPhases.main,...D.customPhases.sub].map(p=>p.id));
        (blob.main||[]).forEach(ph=>{if(!existing.has(ph.id)){D.customPhases.main.push({...ph});report.tasks.main.push({title:ph.title,action:'added'});}});
        (blob.sub||[]).forEach(ph=>{if(!existing.has(ph.id)){D.customPhases.sub.push({...ph,_subPhase:true});report.tasks.sub.push({title:ph.title,action:'added'});}});
      }
      save();buildPhaseGrids();updateGlobal();
      const mainCount=(blob.main||[]).length;const subCount=(blob.sub||[]).length;
      logActivity('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Imported '+(blob._name||'tasks')+': '+mainCount+' main, '+subCount+' sub phases ('+(mode==='overwrite'?'overwrite':'append')+')','#c8f04a');

    } else if(type==='backup'){
      if(mode==='overwrite'){
        // Clear all existing roots then restore from backup
        const oldRoots=[...roots];
        roots.length=0;
        blob.roots.forEach(root=>{
          roots.push(root);
          if(blob.data&&blob.data[root.id])saveRootData(root.id,blob.data[root.id]);
          report.roots.push({name:root.name,action:'restored'});
        });
        // If active project was overwritten, reload its data
        if(activeRootId){const found=roots.find(r=>r.id===activeRootId);if(found)D=getRootData(activeRootId);}
      } else {
        blob.roots.forEach(root=>{
          const exists=roots.find(r=>r.id===root.id);
          if(!exists){roots.push(root);report.roots.push({name:root.name,action:'added'});}
          else{report.roots.push({name:root.name,action:'skipped (exists)'});}
          if(blob.data&&blob.data[root.id])saveRootData(root.id,blob.data[root.id]);
        });
      }
      saveRoots();
      renderRootGrid();
    }

    // Log the import
    const importLog=JSON.parse(localStorage.getItem('lms_import_log')||'[]');
    importLog.unshift({ts:Date.now(),mode,type,report});
    if(importLog.length>20)importLog.length=20;
    localStorage.setItem('lms_import_log',JSON.stringify(importLog));

    showImportReport(report,type,mode);

  }catch(err){
    toast('Import error: '+err.message);
    console.error('Import error',err);
  }
}

function showImportReport(report,type,mode){
  const old=document.getElementById('import-report-modal');if(old)old.remove();
  let lines=[];
  if(report.roots.length){
    lines.push('<div style="font-size:9px;color:var(--text3);letter-spacing:.15em;margin-bottom:6px;">PROJECTS</div>');
    report.roots.forEach(r=>{
      const col=r.action==='skipped (exists)'?'var(--text3)':r.action==='overwritten'?'var(--accent4)':'var(--accent)';
      lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:10px;"><span style="color:var(--text)">${escHtml(r.name)}</span><span style="color:${col};letter-spacing:.06em;font-size:9px;">${r.action.toUpperCase()}</span></div>`);
    });
  }
  if(report.tasks.main.length||report.tasks.sub.length){
    lines.push('<div style="font-size:9px;color:var(--text3);letter-spacing:.15em;margin:12px 0 6px;">PHASES / TASKS</div>');
    [...report.tasks.main,...report.tasks.sub].forEach(t=>{
      const col=t.action==='overwritten'?'var(--accent4)':'var(--accent)';
      lines.push(`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:10px;"><span style="color:var(--text)">${escHtml(t.title)}</span><span style="color:${col};letter-spacing:.06em;font-size:9px;">${t.action.toUpperCase()}</span></div>`);
    });
  }
  if(!lines.length)lines.push('<div style="font-size:10px;color:var(--text3);">Nothing new was imported.</div>');

  const modal=document.createElement('div');
  modal.id='import-report-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);';
  modal.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:3px;padding:28px 28px 22px;max-width:460px;width:90%;font-family:var(--font);max-height:80vh;overflow-y:auto;">
      <div style="font-family:var(--vt);font-size:22px;color:var(--accent);letter-spacing:.1em;margin-bottom:4px;">IMPORT COMPLETE</div>
      <div style="font-size:9px;color:var(--text3);letter-spacing:.15em;margin-bottom:20px;">${mode.toUpperCase()} MODE · ${type.toUpperCase()}</div>
      ${lines.join('')}
      <button onclick="document.getElementById('import-report-modal').remove()" style="margin-top:18px;background:linear-gradient(135deg,rgba(200,240,74,.1),rgba(74,240,200,.05));border:1px solid var(--accent);color:var(--accent);font-family:var(--font);font-size:10px;padding:9px 24px;cursor:pointer;border-radius:2px;width:100%;letter-spacing:.08em;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Done</button>
    </div>`;
  document.body.appendChild(modal);
}

// Dashboard import log badge
function renderImportLogBadge(){
  const log=JSON.parse(localStorage.getItem('lms_import_log')||'[]');
  const el=document.getElementById('dash-import-badge');if(!el)return;
  if(!log.length){el.style.display='none';return;}
  const last=log[0];const d=new Date(last.ts);
  const rootCount=last.report.roots.filter(r=>r.action!=='skipped (exists)').length;
  const taskCount=(last.report.tasks?.main?.length||0)+(last.report.tasks?.sub?.length||0);
  let summary=[];
  if(rootCount)summary.push(rootCount+' project'+(rootCount!==1?'s':''));
  if(taskCount)summary.push(taskCount+' phase'+(taskCount!==1?'s':''));
  el.style.display='flex';
  el.innerHTML=`<span style="color:var(--accent);margin-right:6px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></span><span style="flex:1;">Last import: <strong>${summary.join(', ')||'nothing new'}</strong> · ${last.mode} · ${d.toLocaleDateString()} ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span><button onclick="localStorage.removeItem('lms_import_log');renderImportLogBadge();" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:9px;font-family:var(--font);">✕</button>`;
}