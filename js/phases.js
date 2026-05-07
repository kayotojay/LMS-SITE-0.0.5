// LMS Dev Hub — phases.js
// ========================================

// =====================================================
// PHASE MANAGEMENT
// =====================================================
function getPhasesForData(data){const cp=data.customPhases||{main:[],sub:[]};return{main:cp.main||[],sub:cp.sub||[]};}
function getPhases(){return getPhasesForData(D);}

function mkCheckbox(key,store,ph,onToggle){
  const cbx=document.createElement('div');cbx.className='cbx'+(store[key]?' on':'');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 7 7');
  const pl=document.createElementNS('http://www.w3.org/2000/svg','polyline');pl.setAttribute('points','1,3.5 2.8,5.5 6,1.5');pl.setAttribute('stroke','#080808');pl.setAttribute('stroke-width','1.5');pl.setAttribute('fill','none');
  svg.appendChild(pl);cbx.appendChild(svg);
  cbx.addEventListener('click',()=>{store[key]=!store[key];cbx.classList.toggle('on',store[key]);save();onToggle(store[key]);updateGlobal();
    if(store[key]&&SETTINGS.soundOnComplete){try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator();const g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(880,ctx.currentTime);o.frequency.setValueAtTime(1100,ctx.currentTime+0.06);g.gain.setValueAtTime(0.12,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.18);o.start();o.stop(ctx.currentTime+0.18);}catch(e){}}
  });
  return cbx;
}

function buildPhaseCard(ph,storeKey){
  const store=D[storeKey];
  if(!store[ph.id])store[ph.id]={checks:{},custom:[],removed:[]};
  const ps=store[ph.id];if(!ps.removed)ps.removed=[];
  const card=document.createElement('div');card.className='phase-card';
  const hdr=document.createElement('div');hdr.className='phase-card-header';
  hdr.innerHTML=`<span class="ph-badge" style="background:${ph.color};color:${ph.tc}">${escHtml(ph.label)}</span><span class="ph-title">${escHtml(ph.title)}</span><span class="ph-cnt" id="c-${ph.id}">0/0</span><span class="ph-arr" id="a-${ph.id}">&#9658;</span>`;
  const body=document.createElement('div');body.className='phase-body';
  function countUpdate(){const all=[...(ph.tasks||[]).map((_,i)=>ph.id+'-t'+i).filter((_,i)=>!ps.removed.includes(i)),...ps.custom.map((_,i)=>ph.id+'-c'+i)];const done=all.filter(k=>ps.checks[k]).length;const el=document.getElementById('c-'+ph.id);if(el)el.textContent=done+'/'+all.length;}
  function renderBody(){
    body.innerHTML='';const wrap=document.createElement('div');wrap.className='sec-wrap';
    const sl=document.createElement('div');sl.className='sec-head';sl.textContent='Tasks';wrap.appendChild(sl);
    (ph.tasks||[]).forEach((t,i)=>{
      if(ps.removed.includes(i))return;const key=ph.id+'-t'+i;
      const row=document.createElement('div');row.className='task-row';
      const lbl=document.createElement('span');lbl.className='t-lbl'+(ps.checks[key]?' done':'');lbl.textContent=t;
      const cbx=mkCheckbox(key,ps.checks,ph,(checked)=>{lbl.classList.toggle('done',checked);logActivity((checked?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Completed: ':'↩ Unchecked: ')+t.substring(0,42),ph.color);countUpdate();});
      lbl.addEventListener('click',()=>cbx.click());
      const xb=document.createElement('button');xb.className='xbtn';xb.textContent='×';xb.addEventListener('click',()=>{
      if(!ps.removed.includes(i)) ps.removed.push(i);
      delete ps.checks[key];
      logActivity('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>Task removed: '+t.substring(0,42),ph.color);
      save(); renderBody(); countUpdate(); updateGlobal();
      const remaining=[...(ph.tasks||[]).filter((_,j)=>!ps.removed.includes(j)),...(ps.custom||[])];
      if(!remaining.length){
        openModal('Empty Phase',`<p style="color:var(--text2);font-size:13px;"><strong>${escHtml(ph.title)}</strong> has no tasks left. Delete the phase?</p>`,
          [{label:'Keep it',action:()=>closeModal()},{label:'Delete phase',cls:'btn danger',action:()=>{
            closeModal();
            D.customPhases[ph._subPhase?'sub':'main']=D.customPhases[ph._subPhase?'sub':'main'].filter(x=>x.id!==ph.id);
            logActivity('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>Phase deleted: '+ph.title,'#f04a4a');
            save(); buildPhaseGrids(); updateGlobal();
          }}]
        );
      }
    });
      
      row.appendChild(cbx);row.appendChild(lbl);row.appendChild(xb);wrap.appendChild(row);
    });
    if(ps.custom.length){const cl=document.createElement('div');cl.className='sec-head';cl.style.marginTop='8px';cl.textContent='Custom';wrap.appendChild(cl);
      ps.custom.forEach((t,i)=>{const key=ph.id+'-c'+i;const row=document.createElement('div');row.className='task-row';const lbl=document.createElement('span');lbl.className='t-lbl'+(ps.checks[key]?' done':'');lbl.textContent=t;
        const cbx=mkCheckbox(key,ps.checks,ph,(checked)=>{lbl.classList.toggle('done',checked);countUpdate();});lbl.addEventListener('click',()=>cbx.click());
        const xb=document.createElement('button');xb.className='xbtn';xb.textContent='×';xb.addEventListener('click',()=>{
        ps.custom.splice(i,1);
        delete ps.checks[key];
        logActivity('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>Task removed: '+t.substring(0,42),ph.color);
        save(); renderBody(); countUpdate(); updateGlobal();
        const remaining=[...(ph.tasks||[]).filter((_,j)=>!ps.removed.includes(j)),...(ps.custom||[])];
        if(!remaining.length){
          openModal('Empty Phase',`<p style="color:var(--text2);font-size:13px;"><strong>${escHtml(ph.title)}</strong> has no tasks left. Delete the phase?</p>`,
            [{label:'Keep it',action:()=>closeModal()},{label:'Delete phase',cls:'btn danger',action:()=>{
              closeModal();
              D.customPhases[ph._subPhase?'sub':'main']=D.customPhases[ph._subPhase?'sub':'main'].filter(x=>x.id!==ph.id);
              logActivity('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>Phase deleted: '+ph.title,'#f04a4a');
              save(); buildPhaseGrids(); updateGlobal();
            }}]
          );
        }
      });
        row.appendChild(cbx);row.appendChild(lbl);row.appendChild(xb);wrap.appendChild(row);
      });
    }
    body.appendChild(wrap);
    const ar=document.createElement('div');ar.className='add-row';
    const inp=document.createElement('input');inp.type='text';inp.className='add-inp';inp.placeholder='Add task...';
    const btn=document.createElement('button');btn.className='add-btn';btn.textContent='Add';
    btn.addEventListener('click',()=>{
      const v=inp.value.trim(); if(!v)return;
      ps.custom.push(v); inp.value='';
      logActivity('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Task added: '+v.substring(0,42)+' → '+ph.title, ph.color);
      save(); renderBody(); countUpdate(); updateGlobal();
    });
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')btn.click();});
    ar.appendChild(inp);ar.appendChild(btn);body.appendChild(ar);countUpdate();
  }
  renderBody();
  let open=false;
  hdr.addEventListener('click',()=>{open=!open;body.classList.toggle('open',open);document.getElementById('a-'+ph.id).classList.toggle('open',open);});
  card.appendChild(hdr);card.appendChild(body);return card;
}

function buildPhaseGrids(){
  const mg=document.getElementById('main-phase-grid');const sg=document.getElementById('sub-phase-grid');
  mg.innerHTML='';sg.innerHTML='';
  // Inject Canvas Mode button into Main Phases toolbar
  const mainToolbar=document.querySelector('#page-main-tasks .toolbar');
  if(mainToolbar&&!mainToolbar.querySelector('.canvas-mode-btn')){
    const cvsBtnMain=document.createElement('button');
    cvsBtnMain.className='btn canvas-mode-btn';
    cvsBtnMain.innerHTML='⬡ Canvas Mode';
    cvsBtnMain.title='Switch to draggable canvas view';
    cvsBtnMain.style.cssText='margin-left:auto;border-color:var(--accent2);color:var(--accent2);';
    cvsBtnMain.addEventListener('click',()=>{ nav('canvas'); initCanvas('main'); });
    mainToolbar.appendChild(cvsBtnMain);
  }
  // Inject Canvas Mode button into Sub Phases toolbar (create one if missing)
  const subPage=document.getElementById('page-sub-tasks');
  if(subPage&&!subPage.querySelector('.canvas-mode-btn')){
    let subToolbar=subPage.querySelector('.toolbar');
    if(!subToolbar){
      subToolbar=document.createElement('div');
      subToolbar.className='toolbar';
      const hdr=subPage.querySelector('.section-hdr');
      if(hdr) hdr.insertAdjacentElement('afterend',subToolbar);
      else subPage.prepend(subToolbar);
    }
    const cvsBtnSub=document.createElement('button');
    cvsBtnSub.className='btn canvas-mode-btn';
    cvsBtnSub.innerHTML='⬡ Canvas Mode';
    cvsBtnSub.title='Switch to draggable canvas view';
    cvsBtnSub.style.cssText='margin-left:auto;border-color:var(--accent2);color:var(--accent2);';
    cvsBtnSub.addEventListener('click',()=>{ nav('canvas'); initCanvas('sub'); });
    subToolbar.appendChild(cvsBtnSub);
  }
  const phases=getPhases();
  const addRow=document.createElement('div');addRow.style.gridColumn='1/-1';
  addRow.innerHTML=`<div style="display:flex;gap:8px;align-items:center;padding:8px 0;flex-wrap:wrap;">
    <input class="add-inp" id="np-label" placeholder="Label" style="width:80px;flex:none;">
    <input class="add-inp" id="np-title" placeholder="New phase title..." style="max-width:220px;">
    <button class="btn" onclick="createCustomPhase('main')">Add Main Phase</button>
    <button class="btn" onclick="createCustomPhase('sub')">Add Sub Phase</button>
  </div>`;
  if(!phases.main.length&&!phases.sub.length){mg.innerHTML=`<div style="font-size:11px;color:var(--text3);grid-column:1/-1;margin-bottom:8px;">No phases yet. Import a .lmstasks file or create a phase below.</div>`;}
  phases.main.forEach(ph=>{mg.appendChild(buildPhaseCard(ph,'mainTasks'));});
  mg.appendChild(addRow);
  phases.sub.forEach(ph=>sg.appendChild(buildPhaseCard(ph,'subTasks')));
}

function createCustomPhase(type){
  const label=(document.getElementById('np-label').value.trim())||'P';
  const title=document.getElementById('np-title').value.trim();if(!title)return;
  const id=(type==='main'?'mp':'sp')+'_'+Date.now();
  const colIdx=((D.customPhases?.main?.length||0)+(D.customPhases?.sub?.length||0))%PHASE_COLORS.length;
  const ph={id,label,title,color:PHASE_COLORS[colIdx],tc:'#080808',tasks:[],_subPhase:type==='sub'};
  if(!D.customPhases)D.customPhases={main:[],sub:[]};
  D.customPhases[type].push(ph);
  document.getElementById('np-label').value='';document.getElementById('np-title').value='';
  save();buildPhaseGrids();updateGlobal();
  logActivity('<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>Phase created: '+title+' ('+(type==='main'?'Main':'Sub')+')', ph.color);
  toast('Phase added');
}

function updateGlobal(){
  if(!D)return;
  const phases=getPhases();let tot=0,done=0;
  phases.main.forEach(ph=>{const ps=D.mainTasks[ph.id]||{checks:{},custom:[],removed:[]};const r=ps.removed||[];[...(ph.tasks||[]).map((_,i)=>ph.id+'-t'+i).filter((_,i)=>!r.includes(i)),...(ps.custom||[]).map((_,i)=>ph.id+'-c'+i)].forEach(k=>{tot++;if(ps.checks[k])done++;});});
  phases.sub.forEach(ph=>{const ps=D.subTasks[ph.id]||{checks:{},custom:[],removed:[]};const r=ps.removed||[];[...(ph.tasks||[]).map((_,i)=>ph.id+'-t'+i).filter((_,i)=>!r.includes(i)),...(ps.custom||[]).map((_,i)=>ph.id+'-c'+i)].forEach(k=>{tot++;if(ps.checks[k])done++;});});
  const pct=tot?Math.round(done/tot*100):0;
  document.getElementById('g-bar').style.width=pct+'%';
  document.getElementById('g-label').textContent=done+' / '+tot+' tasks complete';
  document.getElementById('overall-pct').textContent=pct+'%';
  document.getElementById('d-done').textContent=done;
  document.getElementById('d-total').textContent=tot;
  document.getElementById('d-scripts').textContent=D.scripts.length;
  document.getElementById('d-chars').textContent=D.survivors.length;
  const mpEl=document.getElementById('d-main-phases');if(mpEl)mpEl.textContent=phases.main.length;
  const spEl=document.getElementById('d-sub-phases');if(spEl)spEl.textContent=phases.sub.length;
  renderImportLogBadge();
}

// =====================================================
// CUSTOM SECTIONS SYSTEM
// =====================================================
// Section structure: {id, name, color, icon, subsections:[{id, name, blocks:[{id,type,title,data}]}]}
// Block types: textarea, checklist, list, links, rating, progress, characters, notes

const BLOCK_TYPES=[
  {type:'textarea',label:'Rich Text Area'},
  {type:'checklist',label:'Checklist'},
  {type:'list',label:'Bullet List'},
  {type:'links',label:'Link List'},
  {type:'rating',label:'Star Rating'},
  {type:'progress',label:'Progress Tracker'},
  {type:'table',label:'Simple Table'},
  {type:'characters',label:'Character Cards'},
];