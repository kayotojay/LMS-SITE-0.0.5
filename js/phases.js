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
      const cbx=mkCheckbox(key,ps.checks,ph,(checked)=>{lbl.classList.toggle('done',checked);if(checked)logActivity('Completed: '+t.substring(0,42),ph.color);countUpdate();});
      lbl.addEventListener('click',()=>cbx.click());
      const xb=document.createElement('button');xb.className='xbtn';xb.textContent='×';xb.addEventListener('click',()=>{if(!ps.removed.includes(i))ps.removed.push(i);delete ps.checks[key];save();renderBody();countUpdate();updateGlobal();});
      row.appendChild(cbx);row.appendChild(lbl);row.appendChild(xb);wrap.appendChild(row);
    });
    if(ps.custom.length){const cl=document.createElement('div');cl.className='sec-head';cl.style.marginTop='8px';cl.textContent='Custom';wrap.appendChild(cl);
      ps.custom.forEach((t,i)=>{const key=ph.id+'-c'+i;const row=document.createElement('div');row.className='task-row';const lbl=document.createElement('span');lbl.className='t-lbl'+(ps.checks[key]?' done':'');lbl.textContent=t;
        const cbx=mkCheckbox(key,ps.checks,ph,(checked)=>{lbl.classList.toggle('done',checked);countUpdate();});lbl.addEventListener('click',()=>cbx.click());
        const xb=document.createElement('button');xb.className='xbtn';xb.textContent='×';xb.addEventListener('click',()=>{ps.custom.splice(i,1);delete ps.checks[key];save();renderBody();countUpdate();updateGlobal();});
        row.appendChild(cbx);row.appendChild(lbl);row.appendChild(xb);wrap.appendChild(row);
      });
    }
    body.appendChild(wrap);
    const ar=document.createElement('div');ar.className='add-row';
    const inp=document.createElement('input');inp.type='text';inp.className='add-inp';inp.placeholder='Add task...';
    const btn=document.createElement('button');btn.className='add-btn';btn.textContent='Add';
    btn.addEventListener('click',()=>{const v=inp.value.trim();if(!v)return;ps.custom.push(v);inp.value='';save();renderBody();countUpdate();updateGlobal();});
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
  save();buildPhaseGrids();updateGlobal();toast('Phase added');
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