// LMS Dev Hub — canvas.js  v5
// =====================================================================
// New in v5:
//   • Node resizing — drag the ◢ handle on any drill node to resize
//     both width and height freely (saved per node in D.canvasNodeSizes)
//   • Task reorder — drag the ⠿ handle on any drill node to move it;
//     connections follow because they are keyed by task key, not index
//   • Delete phase card — ✕ button in overview card header
//   • Delete drill node — ✕ button in drill node header
// =====================================================================

(function () {
  'use strict';

  const MIN_SCALE  = 0.08;
  const MAX_SCALE  = 2.5;
  const CARD_W     = 220;
  const CARD_ROW_H = 22;
  const CARD_HDR_H = 32;
  const NODE_W     = 240;
  const NODE_H     = 78;        // header(28) + body(26) + deadline row(24)
  const GRID       = 10;        // snap grid size (px, world coords)

  const LINE_STYLES = ['curve','bezier','straight','elbow'];
  const LINE_LABELS = {curve:'⌒ Curve',bezier:'∿ Bezier',straight:'/ Straight',elbow:'⌐ Elbow'};

  // ─── state ───────────────────────────────────────
  let _canvasType  = 'main';
  let _layer       = 0;
  let _drillPhId   = null;
  let _scale       = 1;
  let _offsetX     = 0;
  let _offsetY     = 0;
  let _panState    = null;
  let _dragState   = null;
  let _cardDrag    = null;
  let _wpDrag      = null;
  let _resizeState = null;   // NEW — node resize
  let _lineStyle   = 'curve';

  // ─── snap helpers ────────────────────────────────
  function snapOn()    { return !!(D.canvasSnap); }
  function snap(v)     { return snapOn() ? Math.round(v/GRID)*GRID : v; }
  function snapPt(x,y) { return {x:snap(x), y:snap(y)}; }
  function toggleSnap(){ D.canvasSnap = !D.canvasSnap; saveAll(); rerender(); }

  // ─── node-size helpers ────────────────────────────
  function getNodeSizes(phId) {
    if(!D.canvasNodeSizes) D.canvasNodeSizes={};
    if(!D.canvasNodeSizes[phId]) D.canvasNodeSizes[phId]={};
    return D.canvasNodeSizes[phId];
  }
  function nodeSize(phId, key) {
    const sz = getNodeSizes(phId)[key];
    return { w: (sz&&sz.w)||NODE_W, h: (sz&&sz.h)||null };
  }

  // ─── data helpers ────────────────────────────────
  function getLayout()  { if(!D.canvasLayout) D.canvasLayout={}; return D.canvasLayout; }
  function getConnections(id) {
    if(!D.canvasConnections) D.canvasConnections={};
    if(!D.canvasConnections[id]) D.canvasConnections[id]=[];
    return D.canvasConnections[id];
  }
  function getPhaseLinks() { if(!D.canvasPhaseLinks) D.canvasPhaseLinks=[]; return D.canvasPhaseLinks; }
  function getCollapsed()  { if(!D.canvasCollapsed)  D.canvasCollapsed={};  return D.canvasCollapsed; }
  function saveAll()       { save(); }

  function getPhaseStore(ph) {
    const k=ph._subPhase?'subTasks':'mainTasks';
    if(!D[k][ph.id]) D[k][ph.id]={checks:{},custom:[],removed:[]};
    const ps=D[k][ph.id];
    if(!ps.removed) ps.removed=[];
    if(!ps.custom)  ps.custom=[];
    return ps;
  }
  function allPhases() { const p=getPhases(); return _canvasType==='main'?p.main:p.sub; }

  function phaseProgress(ph) {
    const ps=getPhaseStore(ph); const r=ps.removed||[];
    const keys=[
      ...(ph.tasks||[]).map((_,i)=>ph.id+'-t'+i).filter((_,i)=>!r.includes(i)),
      ...(ps.custom||[]).map((_,i)=>ph.id+'-c'+i)
    ];
    const done=keys.filter(k=>ps.checks[k]).length;
    return {done,total:keys.length,pct:keys.length?Math.round(done/keys.length*100):0};
  }
  function isComplete(ph) { const {done,total}=phaseProgress(ph); return total>0&&done===total; }

  function getTaskKeys(ph) {
    const ps=getPhaseStore(ph); const r=ps.removed||[];
    const keys=[],labels=[];
    (ph.tasks||[]).forEach((t,i)=>{ if(!r.includes(i)){keys.push(ph.id+'-t'+i);labels.push(t);} });
    (ps.custom||[]).forEach((t,i)=>{ keys.push(ph.id+'-c'+i);labels.push(t); });
    return {keys,labels};
  }

  // ─── deadline helpers ─────────────────────────────
  function getDeadlines(ph) {
    const ps = getPhaseStore(ph);
    if (!ps.deadlines) ps.deadlines = {};
    return ps.deadlines;
  }

  function deadlineStatus(deadline, checked) {
    if (!deadline) return null;
    if (checked) return 'done';
    const now = new Date(); now.setHours(0,0,0,0);
    const d = new Date(deadline + 'T00:00:00');
    const diff = Math.round((d - now) / 86400000);
    if (diff < 0) return 'overdue';
    if (diff <= 3) return 'due-soon';
    return 'on-track';
  }

  function phaseDeadlineInfo(ph) {
    const {keys} = getTaskKeys(ph);
    const ps = getPhaseStore(ph);
    const deadlines = getDeadlines(ph);
    let worst = null;
    let nearestDate = null;
    const rank = {overdue:3,'due-soon':2,'on-track':1,done:0};
    keys.forEach(k => {
      const dl = deadlines[k];
      if (!dl) return;
      const s = deadlineStatus(dl, !!ps.checks[k]);
      if (!worst || (rank[s]||0) > (rank[worst]||0)) worst = s;
      if (!nearestDate || dl < nearestDate) nearestDate = dl;
    });
    return {status: worst, nearest: nearestDate};
  }

  const DL_COLORS = {
    'overdue':  {bg:'rgba(240,74,74,.18)',  border:'rgba(240,74,74,.6)',  text:'#f04a4a', label:'OVERDUE'},
    'due-soon': {bg:'rgba(240,200,74,.15)', border:'rgba(240,200,74,.5)', text:'#f0c84a', label:'DUE SOON'},
    'on-track': {bg:'rgba(74,240,200,.12)', border:'rgba(74,240,200,.4)', text:'#4af0c8', label:'ON TRACK'},
    'done':     {bg:'rgba(74,240,200,.08)', border:'rgba(74,240,200,.25)',text:'#4af0c8', label:'DONE'},
  };

  function fmtDate(iso) {
    if (!iso) return '';
    const [y,m,d] = iso.split('-');
    return `${m}/${d}/${y.slice(2)}`;
  }

  function cardHeight(ph) {
    const collapsed=getCollapsed()[ph.id];
    if(collapsed) return CARD_HDR_H+2;
    const {keys}=getTaskKeys(ph);
    return CARD_HDR_H+2+keys.length*CARD_ROW_H+6;
  }

  // ─── transform ───────────────────────────────────
  function applyTransform(world) {
    world.style.transform=`translate(${_offsetX}px,${_offsetY}px) scale(${_scale})`;
  }
  function vpDims() { const v=document.getElementById('canvas-vp'); return v?{w:v.clientWidth,h:v.clientHeight}:{w:900,h:600}; }
  function toWorld(sx,sy) { return {x:(sx-_offsetX)/_scale,y:(sy-_offsetY)/_scale}; }

  function rerender() {
    if(_layer===1&&_drillPhId) renderDrillIn(_drillPhId);
    else renderOverview();
  }

  // ─── SVG helpers ─────────────────────────────────
  function makeSVGLayer(id) {
    const s=document.createElementNS('http://www.w3.org/2000/svg','svg');
    s.id=id;
    s.setAttribute('style','position:absolute;top:0;left:0;width:6000px;height:6000px;pointer-events:none;z-index:0;overflow:visible;');
    return s;
  }
  function addArrowDef(svg,id) {
    const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
    const mk=document.createElementNS('http://www.w3.org/2000/svg','marker');
    mk.setAttribute('id',id); mk.setAttribute('markerWidth','8'); mk.setAttribute('markerHeight','8');
    mk.setAttribute('refX','7'); mk.setAttribute('refY','3.5'); mk.setAttribute('orient','auto');
    mk.setAttribute('markerUnits','userSpaceOnUse');
    const mp=document.createElementNS('http://www.w3.org/2000/svg','path');
    mp.setAttribute('d','M0,0 L0,7 L8,3.5 z');
    mp.setAttribute('fill','var(--accent)'); mp.setAttribute('opacity','0.7');
    mk.appendChild(mp); defs.appendChild(mk); svg.appendChild(defs);
  }

  // ─── Port anchors ────────────────────────────────
  function rectPorts(r) {
    return {
      right: {x:r.x+r.w,y:r.y+r.h/2}, left:{x:r.x,y:r.y+r.h/2},
      bottom:{x:r.x+r.w/2,y:r.y+r.h}, top:{x:r.x+r.w/2,y:r.y}
    };
  }
  function bestPorts(rA,rB) {
    const pA=rectPorts(rA),pB=rectPorts(rB);
    const sides=['right','left','bottom','top'];
    let best=null,bd=Infinity;
    for(const sA of sides) for(const sB of sides){
      const dx=pB[sB].x-pA[sA].x,dy=pB[sB].y-pA[sA].y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<bd){bd=d;best={sA,sB,p1:pA[sA],p2:pB[sB]};}
    }
    return best;
  }

  // ─── Path generators ─────────────────────────────
  function pathForStyle(style,x1,y1,x2,y2,mx,my,sA,sB){
    if(style==='straight'){
      if(mx!==undefined) return `M${x1},${y1} L${mx},${my} L${x2},${y2}`;
      return `M${x1},${y1} L${x2},${y2}`;
    }
    if(style==='elbow'){
      if(mx!==undefined) return `M${x1},${y1} L${mx},${y1} L${mx},${my} L${x2},${my} L${x2},${y2}`;
      const midX=(x1+x2)/2,midY=(y1+y2)/2;
      if(sA==='right'||sA==='left') return `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`;
      return `M${x1},${y1} L${x1},${midY} L${x2},${midY} L${x2},${y2}`;
    }
    const dx=Math.abs(x2-x1),dy=Math.abs(y2-y1);
    const t=style==='bezier'?0.7:0.45;
    let cp1x,cp1y,cp2x,cp2y;
    if(sA==='right'||sA==='left'){const sg=sA==='right'?1:-1;cp1x=x1+sg*dx*t;cp1y=y1;}
    else{cp1x=x1;cp1y=y1+(sA==='bottom'?1:-1)*dy*t;}
    if(sB==='left'||sB==='right'){const sg=sB==='left'?-1:1;cp2x=x2+sg*dx*t;cp2y=y2;}
    else{cp2x=x2;cp2y=y2+(sB==='top'?-1:1)*dy*t;}
    if(mx!==undefined){
      const m1cp1x=x1+(mx-x1)*t,m1cp2x=mx-(mx-x1)*t;
      const m2cp1x=mx+(x2-mx)*t,m2cp2x=x2-(x2-mx)*t;
      return `M${x1},${y1} C${m1cp1x},${y1} ${m1cp2x},${my} ${mx},${my} C${m2cp1x},${my} ${m2cp2x},${y2} ${x2},${y2}`;
    }
    return `M${x1},${y1} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;
  }

  // ═══════════════════════════════════════════════════
  // LAYER 0 — OVERVIEW
  // ═══════════════════════════════════════════════════

  function initCardPositions(phases,force) {
    const layout=getLayout();
    const {w}=vpDims();
    const cols=Math.ceil(Math.sqrt(phases.length));
    const gapX=CARD_W+90+GRID, gapY=240;
    const startX=snap((w/2)-((cols-1)*gapX/2)-CARD_W/2);
    phases.forEach((ph,i)=>{
      if(force||!layout[ph.id]){
        layout[ph.id]={
          x:snap(startX+(i%cols)*gapX),
          y:snap(80+Math.floor(i/cols)*gapY)
        };
      }
    });
    saveAll();
  }

  function renderOverview() {
    const container=document.getElementById('canvas-container'); if(!container) return;
    container.innerHTML='';
    container.appendChild(buildToolbar());
    const vp=document.createElement('div'); vp.id='canvas-vp'; container.appendChild(vp);
    const world=document.createElement('div'); world.id='canvas-world'; vp.appendChild(world);

    vp.className='cvs-vp'+(snapOn()?' cvs-vp-grid':'');

    const phases=allPhases();
    if(!phases.length){
      world.innerHTML=`<div style="position:absolute;top:80px;left:80px;font-size:11px;color:var(--text3);">No phases yet.</div>`;
      setupPan(vp,world); setupZoom(vp,world); return;
    }

    initCardPositions(phases,false);
    const svgEl=makeSVGLayer('cvs-overview-svg'); addArrowDef(svgEl,'ov-arrow'); world.appendChild(svgEl);
    phases.forEach(ph=>{ world.appendChild(buildOverviewCard(ph,svgEl,world,phases)); });
    redrawOverviewSVG(svgEl,phases);
    setupPan(vp,world); setupZoom(vp,world); applyTransform(world);
  }

  function redrawOverviewSVG(svgEl,phases) {
    Array.from(svgEl.querySelectorAll('.cvs-ov-line')).forEach(l=>l.remove());
    const layout=getLayout();
    getPhaseLinks().forEach(lk=>{
      const a=layout[lk.from],b=layout[lk.to]; if(!a||!b) return;
      const phA=phases.find(p=>p.id===lk.from),phB=phases.find(p=>p.id===lk.to);
      const hA=phA?cardHeight(phA):80,hB=phB?cardHeight(phB):80;
      const {p1,p2,sA,sB}=bestPorts({x:a.x,y:a.y,w:CARD_W,h:hA},{x:b.x,y:b.y,w:CARD_W,h:hB});
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('class','cvs-ov-line');
      path.setAttribute('d',pathForStyle(_lineStyle,p1.x,p1.y,p2.x,p2.y,undefined,undefined,sA,sB));
      path.setAttribute('fill','none'); path.setAttribute('stroke','var(--accent)');
      path.setAttribute('stroke-width','1.5'); path.setAttribute('stroke-opacity','0.45');
      path.setAttribute('marker-end','url(#ov-arrow)');
      svgEl.appendChild(path);
    });
  }

  function buildOverviewCard(ph,svgEl,world,phases) {
    const layout=getLayout(); const pos=layout[ph.id];
    const prog=phaseProgress(ph); const done=isComplete(ph);
    const {keys,labels}=getTaskKeys(ph); const ps=getPhaseStore(ph);
    const collapsed=!!getCollapsed()[ph.id];

    const card=document.createElement('div');
    card.className='cvs-db-card'+(done?' cvs-db-card-done':'')+(collapsed?' cvs-db-card-collapsed':'');
    card.setAttribute('data-ph',ph.id);
    card.style.cssText=`position:absolute;left:${pos.x}px;top:${pos.y}px;width:${CARD_W}px;z-index:10;`;

    // ── header ──
    const hdr=document.createElement('div');
    hdr.className='cvs-db-hdr';
    hdr.style.cssText=`background:${ph.color||'var(--accent)'};color:${ph.tc||'#080808'};`;

    const chevron=document.createElement('span');
    chevron.className='cvs-db-chevron';
    chevron.textContent=collapsed?'▸':'▾';
    chevron.title=collapsed?'Expand':'Collapse';

    const badge=document.createElement('span');  badge.className='cvs-db-hdr-badge'; badge.textContent=ph.label;
    const title=document.createElement('span');  title.className='cvs-db-hdr-title'; title.textContent=ph.title;
    const progEl=document.createElement('span'); progEl.className='cvs-db-hdr-prog'; progEl.textContent=`${prog.done}/${prog.total}`;

    // deadline dot
    const {status: phStatus, nearest: phNearest} = phaseDeadlineInfo(ph);
    const dlDot = document.createElement('span');
    dlDot.className = 'cvs-dl-dot';
    if (phStatus && DL_COLORS[phStatus]) {
      const dc = DL_COLORS[phStatus];
      dlDot.title = `${dc.label}${phNearest ? ' · ' + fmtDate(phNearest) : ''}`;
      dlDot.style.cssText = `display:inline-block;width:7px;height:7px;border-radius:50%;background:${dc.text};box-shadow:0 0 5px ${dc.text};flex-shrink:0;margin-left:2px;`;
      if (phStatus === 'overdue') dlDot.style.animation = 'cvsDlPulse 1.4s ease-in-out infinite';
    }

    // ── DELETE phase button ──
    const delPhaseBtn = document.createElement('button');
    delPhaseBtn.title = 'Delete phase';
    delPhaseBtn.textContent = '✕';
    delPhaseBtn.style.cssText = `background:none;border:none;color:${ph.tc||'#080808'};font-size:10px;cursor:pointer;padding:0 2px;opacity:.55;flex-shrink:0;line-height:1;margin-left:2px;`;
    delPhaseBtn.addEventListener('mousedown', e => e.stopPropagation());
    delPhaseBtn.addEventListener('click', e => {
      e.stopPropagation();
      openModal('Delete Phase', `<p style="color:var(--text2);font-size:13px;">Delete <strong>${escHtml(ph.title)}</strong>? This cannot be undone.</p>`,
        [{label:'Cancel',action:()=>closeModal()},{label:'Delete',cls:'btn danger',action:()=>{
          closeModal();
          if(!D.customPhases) D.customPhases={main:[],sub:[]};
          if(_canvasType==='main') D.customPhases.main = D.customPhases.main.filter(x=>x.id!==ph.id);
          else D.customPhases.sub = D.customPhases.sub.filter(x=>x.id!==ph.id);
          delete getLayout()[ph.id];
          D.canvasPhaseLinks = getPhaseLinks().filter(l=>l.from!==ph.id&&l.to!==ph.id);
          if(typeof logActivity==='function') logActivity('🗑 Phase deleted: '+ph.title+' (Canvas)','#f04a4a');
          saveAll();
          renderOverview();
        }}]
      );
    });

    hdr.appendChild(chevron); hdr.appendChild(badge); hdr.appendChild(title); hdr.appendChild(progEl);
    if (phStatus) hdr.appendChild(dlDot);
    hdr.appendChild(delPhaseBtn);
    card.appendChild(hdr);

    // progress bar
    const pbar=document.createElement('div'); pbar.style.cssText='height:2px;background:rgba(0,0,0,.18);';
    const pfill=document.createElement('div'); pfill.style.cssText=`height:2px;width:${prog.pct}%;background:${done?'var(--accent2)':ph.color||'var(--accent)'};opacity:.85;`;
    pbar.appendChild(pfill); card.appendChild(pbar);

    // ── body (hidden when collapsed) ──
    const body=document.createElement('div');
    body.className='cvs-db-body'; body.style.display=collapsed?'none':'block';

    keys.forEach((k,i)=>{
      const checked=!!ps.checks[k];
      const dl = getDeadlines(ph)[k];
      const dlStatus = deadlineStatus(dl, checked);
      const row=document.createElement('div');
      row.className='cvs-db-row'+(checked?' cvs-db-row-done':'');
      let dlHtml = '';
      if (dl) {
        const dc = DL_COLORS[dlStatus] || {};
        dlHtml = `<span class="cvs-db-row-dl" style="color:${dc.text||'var(--text3)'};border-color:${dc.border||'var(--border)'};background:${dc.bg||'transparent'};">${fmtDate(dl)}</span>`;
      }
      row.innerHTML=`<span class="cvs-db-row-icon">${checked?'✓':'○'}</span><span class="cvs-db-row-text">${escHtml(labels[i])}</span>${dlHtml}`;
      body.appendChild(row);
    });

    if(keys.length>10){
      const colBtn=document.createElement('div');
      colBtn.className='cvs-db-row cvs-db-row-more';
      colBtn.innerHTML=`<span style="color:var(--accent);font-size:9px;cursor:pointer;">▴ Collapse</span>`;
      colBtn.addEventListener('click',e=>{e.stopPropagation();toggleCollapse(ph.id,card,body,chevron,svgEl,phases);});
      body.appendChild(colBtn);
    }

    card.appendChild(body);

    // ── chevron toggle ──
    chevron.addEventListener('click',e=>{
      e.stopPropagation(); e.preventDefault();
      toggleCollapse(ph.id,card,body,chevron,svgEl,phases);
    });

    // ── drag + click-to-drill (threshold-guarded) ──
    let _mdPos=null;
    hdr.addEventListener('mousedown',e=>{
      if(e.target===chevron||e.target===delPhaseBtn) return;
      if(e.button!==0) return;
      e.preventDefault(); e.stopPropagation();
      _mdPos={x:e.clientX,y:e.clientY};
      const p=layout[ph.id]||{x:0,y:0};
      _cardDrag={card,phId:ph.id,startX:e.clientX,startY:e.clientY,origX:p.x,origY:p.y,svgEl,world,phases,moved:false};
      card.style.zIndex='50'; document.body.style.userSelect='none';
    });
    hdr.addEventListener('click',e=>{
      if(e.target===chevron||e.target===delPhaseBtn) return;
      if(_mdPos){
        const dx=e.clientX-_mdPos.x,dy=e.clientY-_mdPos.y;
        if(Math.sqrt(dx*dx+dy*dy)>5){_mdPos=null;return;}
      }
      _mdPos=null;
      drillInto(ph.id);
    });

    card.addEventListener('contextmenu',e=>{e.preventDefault();startPhaseLink(ph.id,svgEl,world,phases);});
    return card;
  }

  function toggleCollapse(phId,card,body,chevron,svgEl,phases){
    const col=getCollapsed();
    col[phId]=!col[phId];
    saveAll();
    const now=col[phId];
    card.classList.toggle('cvs-db-card-collapsed',now);
    body.style.display=now?'none':'block';
    chevron.textContent=now?'▸':'▾';
    chevron.title=now?'Expand':'Collapse';
    redrawOverviewSVG(svgEl,phases);
  }

  // ─── inter-phase link ─────────────────────────────
  let _phaseLinkFrom=null;
  function startPhaseLink(phId,svgEl,world,phases){
    _phaseLinkFrom=phId;
    toast('Right-click another table to link — Esc to cancel',1800);
    const onEsc=ev=>{if(ev.key==='Escape'){_phaseLinkFrom=null;document.removeEventListener('keydown',onEsc);}};
    document.addEventListener('keydown',onEsc);
    const finish=ev=>{
      const el=ev.target.closest('.cvs-db-card'); if(!el) return;
      const toId=el.getAttribute('data-ph');
      if(!toId||toId===_phaseLinkFrom){_phaseLinkFrom=null;document.removeEventListener('contextmenu',finish,true);return;}
      ev.preventDefault(); ev.stopPropagation();
      const links=getPhaseLinks();
      if(!links.find(l=>l.from===_phaseLinkFrom&&l.to===toId)){
        links.push({from:_phaseLinkFrom,to:toId});
        const fromPh=phases.find(p=>p.id===_phaseLinkFrom);
        const toPh=phases.find(p=>p.id===toId);
        if(typeof logActivity==='function') logActivity('🔗 Phases linked: '+(fromPh?.title||_phaseLinkFrom)+' → '+(toPh?.title||toId),'#4af0c8');
        saveAll(); redrawOverviewSVG(svgEl,phases); toast('Tables linked');
      }
      _phaseLinkFrom=null; document.removeEventListener('contextmenu',finish,true);
    };
    document.addEventListener('contextmenu',finish,true);
  }

  // ═══════════════════════════════════════════════════
  // LAYER 1 — DRILL-IN
  // ═══════════════════════════════════════════════════

  function drillInto(phId){
    _layer=1;_drillPhId=phId;
    const world=document.getElementById('canvas-world');
    if(world){
      world.style.transition='transform .25s cubic-bezier(.4,0,.2,1),opacity .2s';
      world.style.opacity='0';
      world.style.transform=`translate(${_offsetX}px,${_offsetY}px) scale(${_scale*1.5})`;
    }
    setTimeout(()=>{_scale=1;_offsetX=0;_offsetY=0;renderDrillIn(phId);},260);
  }
  function drillOut(){
    _layer=0;_drillPhId=null;_scale=1;_offsetX=0;_offsetY=0;
    renderOverview();
    setTimeout(()=>{
      const world=document.getElementById('canvas-world');
      if(world){
        world.style.transition='none';world.style.opacity='0';world.style.transform='translate(0,0) scale(0.88)';
        requestAnimationFrame(()=>{
          world.style.transition='transform .25s cubic-bezier(.4,0,.2,1),opacity .2s';
          world.style.opacity='1';world.style.transform='translate(0,0) scale(1)';
        });
      }
    },20);
  }

  function initNodePositions(keys,phId,force){
    if(!D.canvasNodeLayout) D.canvasNodeLayout={};
    if(!D.canvasNodeLayout[phId]) D.canvasNodeLayout[phId]={};
    const nl=D.canvasNodeLayout[phId];
    const {w}=vpDims();
    const cols=Math.ceil(Math.sqrt(keys.length));
    const GAP_X=snap(NODE_W+GRID*6), GAP_Y=snap(NODE_H+GRID*7);
    const startX=snap(Math.max(GRID*3,(w/2)-(cols*GAP_X/2)));
    keys.forEach((k,i)=>{
      if(force||!nl[k]){
        nl[k]={x:snap(startX+(i%cols)*GAP_X),y:snap(GRID*4+Math.floor(i/cols)*GAP_Y)};
      }
    });
  }

  function renderDrillIn(phId){
    const container=document.getElementById('canvas-container'); if(!container) return;
    container.innerHTML='';
    const phases=allPhases();
    const ph=phases.find(p=>p.id===phId); if(!ph){_layer=0;renderOverview();return;}
    container.appendChild(buildDrillToolbar(ph));

    const vp=document.createElement('div'); vp.id='canvas-vp'; container.appendChild(vp);
    vp.className='cvs-vp'+(snapOn()?' cvs-vp-grid':'');
    const world=document.createElement('div'); world.id='canvas-world'; world.style.transition='none'; vp.appendChild(world);
    const svgEl=makeSVGLayer('cvs-drill-svg'); addArrowDef(svgEl,'dr-arrow'); world.appendChild(svgEl);

    const {keys,labels}=getTaskKeys(ph); const ps=getPhaseStore(ph);
    if(!keys.length){
      world.innerHTML+=`<div style="position:absolute;top:60px;left:60px;font-size:11px;color:var(--text3);">No tasks yet.</div>`;
      setupPan(vp,world);setupZoom(vp,world);applyTransform(world);return;
    }

    initNodePositions(keys,phId,false);
    const nl=D.canvasNodeLayout[phId];

    // auto-connect sequential on first load
    const conns=getConnections(phId);
    if(conns.length===0&&keys.length>1){
      keys.forEach((k,i)=>{if(i<keys.length-1) conns.push({from:k,to:keys[i+1]});});
      saveAll();
    }

    keys.forEach((k,i)=>{
      const node=buildDrillNode(k,labels[i],!!ps.checks[k],ph,ps,phId,svgEl,world,keys);
      node.style.left=nl[k].x+'px'; node.style.top=nl[k].y+'px';
      world.appendChild(node);
    });

    redrawDrillSVG(svgEl,phId,world);
    setupPan(vp,world);setupZoom(vp,world);applyTransform(world);

    world.style.opacity='0';world.style.transform=`translate(${_offsetX}px,${_offsetY}px) scale(0.84)`;
    requestAnimationFrame(()=>{
      world.style.transition='transform .25s cubic-bezier(.4,0,.2,1),opacity .2s';
      world.style.opacity='1';world.style.transform=`translate(${_offsetX}px,${_offsetY}px) scale(${_scale})`;
      setTimeout(()=>{world.style.transition='none';},300);
    });
  }

  function buildDrillNode(key,label,checked,ph,ps,phId,svgEl,world,allKeys){
    const node=document.createElement('div');
    node.className='cvs-dn'+(checked?' cvs-dn-done':'');
    node.setAttribute('data-key',key);

    // Apply saved size (width + optional height)
    const sz = nodeSize(phId, key);
    let nodeStyle = `position:absolute;width:${sz.w}px;z-index:10;`;
    if(sz.h) nodeStyle += `height:${sz.h}px;overflow:hidden;`;
    node.style.cssText = nodeStyle;

    // ── header ──
    const hdr=document.createElement('div');
    hdr.className='cvs-dn-hdr';
    hdr.style.cssText=`background:${ph.color||'var(--accent)'};color:${ph.tc||'#080808'};`;

    // deadline status badge in header
    const deadlines = getDeadlines(ph);
    const dl = deadlines[key];
    const dlStatus = deadlineStatus(dl, checked);
    let dlBadgeHtml = '';
    if (dl && DL_COLORS[dlStatus]) {
      const dc = DL_COLORS[dlStatus];
      dlBadgeHtml = `<span class="cvs-dn-dl-badge" style="background:${dc.bg};border-color:${dc.border};color:${dc.text};">${dc.label} ${fmtDate(dl)}</span>`;
    }
    hdr.innerHTML=`<span class="cvs-dn-badge">${escHtml(ph.label)}</span>${dlBadgeHtml}`;

    // port handle
    const port=document.createElement('div'); port.className='cvs-dn-port'; port.title='Drag to connect';
    port.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();startDrawConnection(key,svgEl,world,ph,phId,allKeys);});
    hdr.appendChild(port);

    // ── DELETE node button ──
    const delNodeBtn = document.createElement('button');
    delNodeBtn.title = 'Delete task';
    delNodeBtn.textContent = '✕';
    delNodeBtn.style.cssText = `background:none;border:none;color:${ph.tc||'#080808'};font-size:9px;cursor:pointer;padding:0 3px;opacity:.55;flex-shrink:0;line-height:1;margin-left:auto;`;
    delNodeBtn.addEventListener('mousedown', e => e.stopPropagation());
    delNodeBtn.addEventListener('click', e => {
      e.stopPropagation();
      if(!confirm(`Delete task "${label}"?`)) return;
      if(key.includes('-c')){
        // custom task — remove from custom array
        const cIdx = parseInt(key.split('-c')[1],10);
        ps.custom.splice(cIdx, 1);
      } else {
        // original task — mark as removed
        const tIdx = parseInt(key.split('-t')[1],10);
        if(!ps.removed) ps.removed=[];
        if(!ps.removed.includes(tIdx)) ps.removed.push(tIdx);
      }
      // clean up connections and layout for this node
      D.canvasConnections[phId] = getConnections(phId).filter(c=>c.from!==key&&c.to!==key);
      if(D.canvasNodeLayout && D.canvasNodeLayout[phId]) delete D.canvasNodeLayout[phId][key];
      if(D.canvasNodeSizes  && D.canvasNodeSizes[phId])  delete D.canvasNodeSizes[phId][key];
      if(typeof logActivity==='function') logActivity('🗑 Task removed: '+label.substring(0,42)+' (Canvas)',ph.color);
      saveAll();
      renderDrillIn(phId);
    });
    hdr.appendChild(delNodeBtn);

    node.appendChild(hdr);

    // ── body ──
    const body=document.createElement('div'); body.className='cvs-dn-body';

    // ── REORDER handle ──
    const reorderHandle = document.createElement('div');
    reorderHandle.textContent = '⠿';
    reorderHandle.title = 'Drag to move node';
    reorderHandle.style.cssText = `font-size:11px;color:var(--text3);cursor:grab;padding:0 4px 0 0;flex-shrink:0;user-select:none;line-height:1;`;
    reorderHandle.addEventListener('mousedown', e => {
      if(e.button!==0) return;
      e.preventDefault(); e.stopPropagation();
      const nl=(D.canvasNodeLayout||{})[phId]||{};
      const pos=nl[key]||{x:0,y:0};
      _dragState={node,key,phId,svgEl,world,startX:e.clientX,startY:e.clientY,origX:pos.x,origY:pos.y};
      node.classList.add('cvs-dn-dragging');node.style.zIndex='50';document.body.style.userSelect='none';
    });

    const cbx=document.createElement('div'); cbx.className='cbx'+(checked?' on':'');
    const cbSvg=document.createElementNS('http://www.w3.org/2000/svg','svg'); cbSvg.setAttribute('viewBox','0 0 7 7');
    const pl=document.createElementNS('http://www.w3.org/2000/svg','polyline');
    pl.setAttribute('points','1,3.5 2.8,5.5 6,1.5');pl.setAttribute('stroke','#080808');pl.setAttribute('stroke-width','1.5');pl.setAttribute('fill','none');
    cbSvg.appendChild(pl);cbx.appendChild(cbSvg);

    const lbl=document.createElement('span');lbl.className='cvs-dn-lbl'+(checked?' done':'');lbl.textContent=label;
    cbx.addEventListener('click',()=>{
      ps.checks[key]=!ps.checks[key];
      cbx.classList.toggle('on',ps.checks[key]);node.classList.toggle('cvs-dn-done',ps.checks[key]);lbl.classList.toggle('done',ps.checks[key]);
      if(typeof logActivity==='function') logActivity((ps.checks[key]?'✔ Completed: ':'↩ Unchecked: ')+label.substring(0,42),ph.color);
      if(ps.checks[key]){try{const c=new(window.AudioContext||window.webkitAudioContext)();const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.setValueAtTime(880,c.currentTime);o.frequency.setValueAtTime(1100,c.currentTime+0.06);g.gain.setValueAtTime(0.12,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.18);o.start();o.stop(c.currentTime+0.18);}catch(ex){}}
      saveAll();if(typeof updateGlobal==='function')updateGlobal();
    });
    lbl.addEventListener('click',()=>cbx.click());

    const del=document.createElement('button');del.className='cvs-dn-delconn';del.title='Remove connections';del.textContent='⊗';
    del.addEventListener('click',e=>{e.stopPropagation();D.canvasConnections[phId]=getConnections(phId).filter(c=>c.from!==key&&c.to!==key);saveAll();redrawDrillSVG(svgEl,phId,world);toast('Connections removed');});

    body.appendChild(reorderHandle);
    body.appendChild(cbx);
    body.appendChild(lbl);
    body.appendChild(del);
    node.appendChild(body);

    // ── deadline date picker row ──
    const dlRow = document.createElement('div');
    dlRow.className = 'cvs-dn-dl-row';
    const dlLabel = document.createElement('span');
    dlLabel.className = 'cvs-dn-dl-label';
    dlLabel.textContent = '⏱';
    dlLabel.title = 'Set deadline';
    const dlInput = document.createElement('input');
    dlInput.type = 'date';
    dlInput.className = 'cvs-dn-dl-input';
    dlInput.title = 'Task deadline';
    if (dl) dlInput.value = dl;
    dlInput.addEventListener('mousedown', e => e.stopPropagation());
    dlInput.addEventListener('change', () => {
      const val = dlInput.value;
      const deadlines2 = getDeadlines(ph);
      if (val) deadlines2[key] = val; else delete deadlines2[key];
      saveAll();
      const newStatus = deadlineStatus(val||null, !!ps.checks[key]);
      const existBadge = hdr.querySelector('.cvs-dn-dl-badge');
      if (existBadge) existBadge.remove();
      if (val && DL_COLORS[newStatus]) {
        const dc = DL_COLORS[newStatus];
        const nb = document.createElement('span');
        nb.className = 'cvs-dn-dl-badge';
        nb.style.cssText = `background:${dc.bg};border-color:${dc.border};color:${dc.text};`;
        nb.textContent = `${dc.label} ${fmtDate(val)}`;
        // insert before port and delete button
        hdr.insertBefore(nb, port);
      }
      if (typeof updateGlobal === 'function') updateGlobal();
    });
    const dlClear = document.createElement('button');
    dlClear.className = 'cvs-dn-dl-clear';
    dlClear.textContent = '✕';
    dlClear.title = 'Clear deadline';
    dlClear.addEventListener('mousedown', e => e.stopPropagation());
    dlClear.addEventListener('click', e => {
      e.stopPropagation();
      dlInput.value = '';
      dlInput.dispatchEvent(new Event('change'));
    });
    dlRow.appendChild(dlLabel); dlRow.appendChild(dlInput); if(dl) dlRow.appendChild(dlClear);
    dlInput.addEventListener('change', () => {
      const existing = dlRow.querySelector('.cvs-dn-dl-clear');
      if (dlInput.value && !existing) dlRow.appendChild(dlClear);
      else if (!dlInput.value && existing) existing.remove();
    });
    node.appendChild(dlRow);

    // ── RESIZE handle ──
    const rzHandle = document.createElement('div');
    rzHandle.title = 'Drag to resize';
    rzHandle.style.cssText = `position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:se-resize;z-index:60;
      background:linear-gradient(135deg,transparent 40%,var(--border2,rgba(255,255,255,.2)) 40%);border-radius:0 0 2px 0;flex-shrink:0;`;
    rzHandle.addEventListener('mousedown', e => {
      if(e.button!==0) return;
      e.preventDefault(); e.stopPropagation();
      const startX=e.clientX, startY=e.clientY;
      const startW=node.offsetWidth, startH=node.offsetHeight;
      _resizeState={node,key,phId,svgEl,world,startX,startY,startW,startH};
      document.body.style.userSelect='none';
    });
    node.appendChild(rzHandle);

    // ── drag node via header ──
    hdr.addEventListener('mousedown',e=>{
      if(e.target.closest('.cvs-dn-port')) return;
      if(e.target===delNodeBtn) return;
      if(e.button!==0) return;
      e.preventDefault();e.stopPropagation();
      const nl=(D.canvasNodeLayout||{})[phId]||{};
      const pos=nl[key]||{x:0,y:0};
      _dragState={node,key,phId,svgEl,world,startX:e.clientX,startY:e.clientY,origX:pos.x,origY:pos.y};
      node.classList.add('cvs-dn-dragging');node.style.zIndex='50';document.body.style.userSelect='none';
    });

    return node;
  }

  function redrawDrillSVG(svgEl,phId,world){
    Array.from(svgEl.querySelectorAll('.cvs-dr-line')).forEach(l=>l.remove());
    Array.from((world||document).querySelectorAll('.cvs-wp-handle')).forEach(h=>h.remove());
    const conns=getConnections(phId);
    const nl=(D.canvasNodeLayout||{})[phId]||{};
    const sizes=getNodeSizes(phId);

    conns.forEach(c=>{
      const ap=nl[c.from],bp=nl[c.to]; if(!ap||!bp) return;
      const szA=sizes[c.from]||{w:NODE_W,h:NODE_H};
      const szB=sizes[c.to]  ||{w:NODE_W,h:NODE_H};
      const {p1,p2,sA,sB}=bestPorts(
        {x:ap.x,y:ap.y,w:szA.w,h:szA.h||NODE_H},
        {x:bp.x,y:bp.y,w:szB.w,h:szB.h||NODE_H}
      );
      const d=pathForStyle(_lineStyle,p1.x,p1.y,p2.x,p2.y,c.mx,c.my,sA,sB);

      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('class','cvs-dr-line');path.setAttribute('d',d);path.setAttribute('fill','none');
      path.setAttribute('stroke','var(--accent)');path.setAttribute('stroke-width','1.5');
      path.setAttribute('stroke-opacity','0.6');path.setAttribute('marker-end','url(#dr-arrow)');
      svgEl.appendChild(path);

      // hit area
      const hit=document.createElementNS('http://www.w3.org/2000/svg','path');
      hit.setAttribute('d',d);hit.setAttribute('fill','none');hit.setAttribute('stroke','transparent');
      hit.setAttribute('stroke-width','14');hit.style.pointerEvents='stroke';hit.style.cursor='pointer';
      hit.setAttribute('class','cvs-dr-line');
      hit.addEventListener('dblclick',e=>{
        e.stopPropagation();
        const vp=document.getElementById('canvas-vp');const rect=vp.getBoundingClientRect();
        const wp=toWorld(e.clientX-rect.left,e.clientY-rect.top);
        c.mx=snap(wp.x);c.my=snap(wp.y);saveAll();redrawDrillSVG(svgEl,phId,world);
      });
      hit.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();delete c.mx;delete c.my;saveAll();redrawDrillSVG(svgEl,phId,world);});
      svgEl.appendChild(hit);

      // waypoint handle
      if(c.mx!==undefined&&world){
        const h=document.createElement('div');h.className='cvs-wp-handle';
        h.style.cssText=`position:absolute;left:${c.mx-6}px;top:${c.my-6}px;width:12px;height:12px;z-index:30;cursor:move;`;
        h.title='Drag · RMB to delete';
        h.addEventListener('mousedown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();_wpDrag={conn:c,phId,svgEl,world};document.body.style.userSelect='none';});
        h.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();delete c.mx;delete c.my;saveAll();redrawDrillSVG(svgEl,phId,world);});
        world.appendChild(h);
      }
    });
  }

  function startDrawConnection(fromKey,svgEl,world,ph,phId,allKeys){
    const nl=(D.canvasNodeLayout||{})[phId]||{};
    const sizes=getNodeSizes(phId);
    const fp=nl[fromKey]; if(!fp) return;
    const szA=sizes[fromKey]||{w:NODE_W,h:NODE_H};
    const rA={x:fp.x,y:fp.y,w:szA.w,h:szA.h||NODE_H};
    const temp=document.createElementNS('http://www.w3.org/2000/svg','path');
    temp.setAttribute('fill','none');temp.setAttribute('stroke','var(--accent2)');
    temp.setAttribute('stroke-width','1.5');temp.setAttribute('stroke-dasharray','6,3');temp.setAttribute('stroke-opacity','0.85');
    temp.setAttribute('d',`M${fp.x+szA.w},${fp.y+(szA.h||NODE_H)/2} L${fp.x+szA.w},${fp.y+(szA.h||NODE_H)/2}`);
    svgEl.style.pointerEvents='all';svgEl.style.cursor='crosshair';svgEl.appendChild(temp);

    const onMove=e=>{
      const vp=document.getElementById('canvas-vp');const rect=vp.getBoundingClientRect();
      const wp=toWorld(e.clientX-rect.left,e.clientY-rect.top);
      const {p1}=bestPorts(rA,{x:wp.x-5,y:wp.y-5,w:10,h:10});
      temp.setAttribute('d',`M${p1.x},${p1.y} L${wp.x},${wp.y}`);
    };
    const onUp=e=>{
      document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);
      svgEl.style.pointerEvents='none';svgEl.style.cursor='';temp.remove();
      const vp=document.getElementById('canvas-vp');const rect=vp.getBoundingClientRect();
      const wp=toWorld(e.clientX-rect.left,e.clientY-rect.top);
      const toKey=allKeys.find(k=>{
        if(k===fromKey) return false;
        const pos=nl[k]; if(!pos) return false;
        const szK=sizes[k]||{w:NODE_W,h:NODE_H};
        return wp.x>=pos.x&&wp.x<=pos.x+szK.w&&wp.y>=pos.y&&wp.y<=pos.y+(szK.h||NODE_H);
      });
      if(toKey){const conns=getConnections(phId);if(!conns.find(c=>c.from===fromKey&&c.to===toKey)){conns.push({from:fromKey,to:toKey});saveAll();toast('Connection added');}}
      redrawDrillSVG(svgEl,phId,world);
    };
    document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
  }

  // ═══════════════════════════════════════════════════
  // SHARED — pan, zoom, global mouse
  // ═══════════════════════════════════════════════════
  function setupPan(vp,world){
    vp.addEventListener('mousedown',e=>{
      if(e.target!==vp&&e.target!==world) return;
      if(e.button!==0) return;
      e.preventDefault();
      _panState={startX:e.clientX,startY:e.clientY,origOX:_offsetX,origOY:_offsetY};
      vp.style.cursor='grabbing';
    });
  }
  function setupZoom(vp,world){
    vp.addEventListener('wheel',e=>{
      e.preventDefault();
      const rect=vp.getBoundingClientRect();
      const mx=e.clientX-rect.left,my=e.clientY-rect.top;
      const ns=Math.min(MAX_SCALE,Math.max(MIN_SCALE,_scale*(1+(-e.deltaY*0.001))));
      _offsetX=mx-(ns/_scale)*(mx-_offsetX);_offsetY=my-(ns/_scale)*(my-_offsetY);
      _scale=ns;applyTransform(world);
    },{passive:false});
  }

  document.addEventListener('mousemove',e=>{
    // ── resize ──
    if(_resizeState){
      const dx=(e.clientX-_resizeState.startX)/_scale;
      const dy=(e.clientY-_resizeState.startY)/_scale;
      const nw=Math.max(160, snap(_resizeState.startW+dx));
      const nh=Math.max(54,  snap(_resizeState.startH+dy));
      _resizeState.node.style.width  = nw+'px';
      _resizeState.node.style.height = nh+'px';
      _resizeState.node.style.overflow = 'hidden';
      const sizes=getNodeSizes(_resizeState.phId);
      sizes[_resizeState.key]={w:nw,h:nh};
      redrawDrillSVG(_resizeState.svgEl,_resizeState.phId,_resizeState.world);
    }
    // ── node drag ──
    if(_dragState){
      if(!D.canvasNodeLayout) D.canvasNodeLayout={};
      if(!D.canvasNodeLayout[_dragState.phId]) D.canvasNodeLayout[_dragState.phId]={};
      const dx=(e.clientX-_dragState.startX)/_scale,dy=(e.clientY-_dragState.startY)/_scale;
      const {x:nx,y:ny}=snapPt(_dragState.origX+dx,_dragState.origY+dy);
      _dragState.node.style.left=nx+'px';_dragState.node.style.top=ny+'px';
      D.canvasNodeLayout[_dragState.phId][_dragState.key]={x:nx,y:ny};
      redrawDrillSVG(_dragState.svgEl,_dragState.phId,_dragState.world);
    }
    // ── card drag ──
    if(_cardDrag){
      const dx=(e.clientX-_cardDrag.startX)/_scale,dy=(e.clientY-_cardDrag.startY)/_scale;
      if(Math.sqrt(dx*dx+dy*dy)>3) _cardDrag.moved=true;
      if(_cardDrag.moved){
        const {x:nx,y:ny}=snapPt(_cardDrag.origX+dx,_cardDrag.origY+dy);
        _cardDrag.card.style.left=nx+'px';_cardDrag.card.style.top=ny+'px';
        getLayout()[_cardDrag.phId]={x:nx,y:ny};
        redrawOverviewSVG(_cardDrag.svgEl,_cardDrag.phases);
      }
    }
    // ── waypoint drag ──
    if(_wpDrag){
      const vp=document.getElementById('canvas-vp');const rect=vp.getBoundingClientRect();
      const wp=toWorld(e.clientX-rect.left,e.clientY-rect.top);
      _wpDrag.conn.mx=snap(wp.x);_wpDrag.conn.my=snap(wp.y);
      redrawDrillSVG(_wpDrag.svgEl,_wpDrag.phId,_wpDrag.world);
    }
    // ── pan ──
    if(_panState){
      _offsetX=_panState.origOX+(e.clientX-_panState.startX);
      _offsetY=_panState.origOY+(e.clientY-_panState.startY);
      const world=document.getElementById('canvas-world');if(world) applyTransform(world);
    }
  });

  document.addEventListener('mouseup',()=>{
    if(_resizeState){saveAll();_resizeState=null;document.body.style.userSelect='';}
    if(_dragState){_dragState.node.classList.remove('cvs-dn-dragging');_dragState.node.style.zIndex='10';saveAll();_dragState=null;document.body.style.userSelect='';}
    if(_cardDrag){_cardDrag.card.style.zIndex='10';if(_cardDrag.moved)saveAll();_cardDrag=null;document.body.style.userSelect='';}
    if(_wpDrag){saveAll();_wpDrag=null;document.body.style.userSelect='';}
    if(_panState){const vp=document.getElementById('canvas-vp');if(vp)vp.style.cursor='';_panState=null;}
  });

  // ═══════════════════════════════════════════════════
  // TOOLBARS
  // ═══════════════════════════════════════════════════
  function snapBtn() {
    return `<button class="cvs-tbtn ${snapOn()?'cvs-tbtn-active':''}" onclick="canvasToggleSnap()" title="Toggle snap-to-grid">${snapOn()?'⊞ Snap ON':'⊡ Snap OFF'}</button>`;
  }

  function buildToolbar(){
    const tb=document.createElement('div'); tb.id='canvas-toolbar';
    tb.innerHTML=`
      <div style="display:flex;align-items:center;gap:8px;flex:1;flex-wrap:wrap;">
        <button class="cvs-tbtn ${_canvasType==='main'?'cvs-tbtn-active':''}" onclick="canvasSetType('main')">Main</button>
        <button class="cvs-tbtn ${_canvasType==='sub'?'cvs-tbtn-active':''}" onclick="canvasSetType('sub')">Sub</button>
        <div class="cvs-sep"></div>
        <button class="cvs-tbtn" onclick="canvasResetView()">⌖ Reset View</button>
        <button class="cvs-tbtn" onclick="canvasAutoArrange()">⊞ Arrange</button>
        ${snapBtn()}
        <div class="cvs-sep"></div>
        <span style="font-size:9px;color:var(--text3);letter-spacing:.06em;">LINE:</span>
        ${LINE_STYLES.map(s=>`<button class="cvs-tbtn ${_lineStyle===s?'cvs-tbtn-active':''}" onclick="canvasSetLineStyle('${s}')">${LINE_LABELS[s]}</button>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:9px;color:var(--text3);">SCROLL=ZOOM · DRAG=PAN · RMB=LINK</span>
        <button class="cvs-tbtn" onclick="nav('main-tasks')" style="border-color:var(--accent);color:var(--accent);">✕</button>
      </div>`;
    return tb;
  }

  function buildDrillToolbar(ph){
    const tb=document.createElement('div'); tb.id='canvas-toolbar';
    tb.innerHTML=`
      <div style="display:flex;align-items:center;gap:8px;flex:1;flex-wrap:wrap;">
        <button class="cvs-tbtn" onclick="canvasDrillOut()" style="border-color:var(--accent2);color:var(--accent2);">← Overview</button>
        <div class="cvs-sep"></div>
        <span class="cvs-badge" style="background:${ph.color};color:${ph.tc||'#080808'};padding:2px 7px;font-size:8px;">${escHtml(ph.label)}</span>
        <span style="font-size:10px;color:var(--text);">${escHtml(ph.title)}</span>
        <button class="cvs-tbtn" onclick="canvasResetView()">⌖ Reset View</button>
        <button class="cvs-tbtn" onclick="canvasReArrangeNodes()">⊞ Arrange</button>
        ${snapBtn()}
        <div class="cvs-sep"></div>
        <span style="font-size:9px;color:var(--text3);">LINE:</span>
        ${LINE_STYLES.map(s=>`<button class="cvs-tbtn ${_lineStyle===s?'cvs-tbtn-active':''}" onclick="canvasSetLineStyle('${s}')">${LINE_LABELS[s]}</button>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:9px;color:var(--text3);">⠿ DRAG MOVE · ◢ DRAG RESIZE · PORT=CONNECT · DBLCLICK LINE=WAYPOINT</span>
        <button class="cvs-tbtn" onclick="nav('main-tasks')" style="border-color:var(--accent);color:var(--accent);">✕</button>
      </div>`;
    return tb;
  }

  // ═══════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════
  window.initCanvas=function(type){_canvasType=type||'main';_layer=0;_drillPhId=null;_scale=1;_offsetX=0;_offsetY=0;renderOverview();};
  window.canvasSetType=function(type){_canvasType=type;_layer=0;_drillPhId=null;_scale=1;_offsetX=0;_offsetY=0;renderOverview();};
  window.canvasResetView=function(){
    _scale=1;_offsetX=0;_offsetY=0;
    const world=document.getElementById('canvas-world');if(world) applyTransform(world);
  };
  window.canvasDrillOut=function(){drillOut();};
  window.canvasAutoArrange=function(){
    const layout=getLayout();
    allPhases().forEach(ph=>{
      if(layout[ph.id]) layout[ph.id]={x:snap(layout[ph.id].x),y:snap(layout[ph.id].y)};
      else delete layout[ph.id];
    });
    initCardPositions(allPhases(),true);
    saveAll();_scale=1;_offsetX=0;_offsetY=0;renderOverview();toast('Arranged & snapped to grid');
  };
  window.canvasReArrangeNodes=function(){
    if(!_drillPhId) return;
    const {keys}=getTaskKeys(allPhases().find(p=>p.id===_drillPhId)||{tasks:[]});
    initNodePositions(keys,_drillPhId,true);
    saveAll();renderDrillIn(_drillPhId);toast('Nodes arranged & snapped');
  };
  window.canvasSetLineStyle=function(style){
    if(!LINE_STYLES.includes(style)) return;
    _lineStyle=style;
    if(_layer===1&&_drillPhId) renderDrillIn(_drillPhId); else renderOverview();
  };
  window.canvasToggleSnap=function(){toggleSnap();};

})();