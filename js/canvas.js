// LMS Dev Hub — canvas.js
// =====================================================
// CANVAS MODE — Obsidian-style draggable phase cards
// =====================================================
// State: positions stored in D.canvasLayout = { [ph.id]: {x,y,w,h} }
// Expanded card = one card fills canvas, others minimised behind it
// Completing a task in canvas syncs back to phases.js data (D.mainTasks / D.subTasks)
// Toggling back to list view calls buildPhaseGrids() — fully in sync

(function(){
  // ─── internal state ──────────────────────────────
  let _canvasType = 'main'; // 'main' | 'sub'
  let _expandedId = null;
  let _dragState  = null;   // {cardEl, phId, startX, startY, origX, origY}
  let _panState   = null;   // {startX, startY, origOX, origOY}
  let _scale      = 1;
  let _offsetX    = 0;
  let _offsetY    = 0;
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 2;
  const CARD_W    = 260;
  const CARD_H_COLLAPSED = 48;

  // ─── helpers ─────────────────────────────────────
  function getLayout(){
    if(!D.canvasLayout) D.canvasLayout={};
    return D.canvasLayout;
  }
  function saveLayout(){ save(); }

  function getPhaseStore(ph){
    const storeKey = ph._subPhase ? 'subTasks' : 'mainTasks';
    if(!D[storeKey][ph.id]) D[storeKey][ph.id]={checks:{},custom:[],removed:[]};
    const ps = D[storeKey][ph.id];
    if(!ps.removed) ps.removed=[];
    return ps;
  }

  function allPhases(){
    const p = getPhases();
    return _canvasType==='main' ? p.main : p.sub;
  }

  function phaseProgress(ph){
    const ps = getPhaseStore(ph);
    const r  = ps.removed||[];
    const keys=[
      ...(ph.tasks||[]).map((_,i)=>ph.id+'-t'+i).filter((_,i)=>!r.includes(i)),
      ...(ps.custom||[]).map((_,i)=>ph.id+'-c'+i)
    ];
    const done = keys.filter(k=>ps.checks[k]).length;
    return {done, total:keys.length, pct: keys.length ? Math.round(done/keys.length*100) : 0};
  }

  function isComplete(ph){
    const {done,total}=phaseProgress(ph);
    return total>0 && done===total;
  }

  // ─── auto-layout ─────────────────────────────────
  function autoLayout(phases){
    const layout=getLayout();
    const cols=Math.max(2,Math.ceil(Math.sqrt(phases.length)));
    const GAP=30;
    phases.forEach((ph,i)=>{
      if(!layout[ph.id]){
        layout[ph.id]={
          x: 40 + (i%cols)*(CARD_W+GAP),
          y: 40 + Math.floor(i/cols)*(CARD_H_COLLAPSED+GAP+160)
        };
      }
    });
    saveLayout();
  }

  // ─── transform helpers ───────────────────────────
  function applyTransform(world){
    world.style.transform=`translate(${_offsetX}px,${_offsetY}px) scale(${_scale})`;
  }

  function screenToWorld(sx,sy,canvasRect){
    return {
      x:(sx - canvasRect.left - _offsetX)/_scale,
      y:(sy - canvasRect.top  - _offsetY)/_scale
    };
  }

  // ─── render canvas ───────────────────────────────
  function renderCanvas(){
    const container=document.getElementById('canvas-container');
    if(!container) return;
    container.innerHTML='';

    // toolbar
    const tb=document.createElement('div');
    tb.id='canvas-toolbar';
    tb.innerHTML=`
      <div style="display:flex;align-items:center;gap:8px;flex:1;">
        <button class="cvs-tbtn ${_canvasType==='main'?'cvs-tbtn-active':''}" onclick="canvasSetType('main')">Main Phases</button>
        <button class="cvs-tbtn ${_canvasType==='sub'?'cvs-tbtn-active':''}" onclick="canvasSetType('sub')">Sub Phases</button>
        <div style="width:1px;height:16px;background:var(--border);margin:0 4px;"></div>
        <button class="cvs-tbtn" onclick="canvasResetView()" title="Reset pan/zoom">⌖ Reset</button>
        <button class="cvs-tbtn" onclick="canvasAutoArrange()" title="Auto-arrange cards">⊞ Arrange</button>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:9px;color:var(--text3);letter-spacing:.1em;">SCROLL=ZOOM · DRAG BG=PAN · DRAG CARD HEADER=MOVE</span>
        <button class="cvs-tbtn" onclick="nav('main-tasks')" title="Back to list view" style="border-color:var(--accent);color:var(--accent);">✕ Exit Canvas</button>
      </div>
    `;
    container.appendChild(tb);

    // canvas viewport
    const vp=document.createElement('div');
    vp.id='canvas-vp';
    container.appendChild(vp);

    // world (transformed layer)
    const world=document.createElement('div');
    world.id='canvas-world';
    vp.appendChild(world);

    const phases=allPhases();
    if(!phases.length){
      world.innerHTML=`<div style="position:absolute;top:80px;left:80px;font-size:11px;color:var(--text3);">No phases yet. Create some in Main Phases or Sub Phases first.</div>`;
      setupCanvasPan(vp,world);
      return;
    }

    autoLayout(phases);
    const layout=getLayout();

    phases.forEach(ph=>{
      const pos=layout[ph.id]||{x:40,y:40};
      const card=buildCanvasCard(ph, pos);
      world.appendChild(card);
    });

    setupCanvasPan(vp,world);
    setupCanvasZoom(vp,world);
    applyTransform(world);

    // restore expanded state
    if(_expandedId){
      const ph=phases.find(p=>p.id===_expandedId);
      if(ph) _doExpand(_expandedId,world,phases);
      else _expandedId=null;
    }
  }

  // ─── build one canvas card ────────────────────────
  function buildCanvasCard(ph, pos){
    const prog=phaseProgress(ph);
    const done=isComplete(ph);
    const ps=getPhaseStore(ph);

    const card=document.createElement('div');
    card.className='cvs-card'+(done?' cvs-card-done':'');
    card.id='cvs-card-'+ph.id;
    card.style.left=pos.x+'px';
    card.style.top=pos.y+'px';
    card.style.width=CARD_W+'px';

    // ── header (drag handle + collapse toggle)
    const hdr=document.createElement('div');
    hdr.className='cvs-card-hdr';
    hdr.innerHTML=`
      <span class="cvs-badge" style="background:${ph.color};color:${ph.tc||'#080808'}">${escHtml(ph.label)}</span>
      <span class="cvs-title">${escHtml(ph.title)}</span>
      <span class="cvs-prog ${done?'cvs-prog-done':''}">${done?'✓':prog.done+'/'+prog.total}</span>
      <button class="cvs-expand-btn" title="Expand card" onclick="canvasExpandCard('${ph.id}')">⤢</button>
    `;
    card.appendChild(hdr);

    // progress bar
    const pbWrap=document.createElement('div');
    pbWrap.className='cvs-pb-wrap';
    const pb=document.createElement('div');
    pb.className='cvs-pb';
    pb.style.width=prog.pct+'%';
    if(done) pb.classList.add('cvs-pb-done');
    pbWrap.appendChild(pb);
    card.appendChild(pbWrap);

    // body (task list)
    const body=document.createElement('div');
    body.className='cvs-body';
    body.id='cvs-body-'+ph.id;

    renderCanvasBody(ph,ps,body,prog);
    card.appendChild(body);

    // drag on header
    setupCardDrag(card,ph,hdr);

    return card;
  }

  function renderCanvasBody(ph, ps, body, prog){
    body.innerHTML='';
    const r=ps.removed||[];

    // default tasks
    (ph.tasks||[]).forEach((t,i)=>{
      if(r.includes(i)) return;
      const key=ph.id+'-t'+i;
      const checked=!!ps.checks[key];
      const row=makeTaskRow(key,t,checked,ph,ps,()=>refreshCard(ph));
      body.appendChild(row);
    });

    // custom tasks
    (ps.custom||[]).forEach((t,i)=>{
      const key=ph.id+'-c'+i;
      const checked=!!ps.checks[key];
      const row=makeTaskRow(key,t,checked,ph,ps,()=>refreshCard(ph));
      body.appendChild(row);
    });

    // add task row
    const ar=document.createElement('div');
    ar.className='cvs-add-row';
    ar.innerHTML=`<input class="add-inp" placeholder="Add task…" style="font-size:10px;padding:4px 6px;">
      <button class="cvs-add-btn">+</button>`;
    const inp=ar.querySelector('input');
    const btn=ar.querySelector('button');
    btn.addEventListener('click',()=>{
      const v=inp.value.trim();
      if(!v) return;
      ps.custom.push(v);
      inp.value='';
      save();
      refreshCard(ph);
      updateGlobal();
    });
    inp.addEventListener('keydown',e=>{if(e.key==='Enter') btn.click();});
    body.appendChild(ar);
  }

  function makeTaskRow(key,label,checked,ph,ps,onChanged){
    const row=document.createElement('div');
    row.className='cvs-task-row'+(checked?' cvs-task-done':'');

    const cbx=document.createElement('div');
    cbx.className='cbx'+(checked?' on':'');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 7 7');
    const pl=document.createElementNS('http://www.w3.org/2000/svg','polyline');
    pl.setAttribute('points','1,3.5 2.8,5.5 6,1.5');
    pl.setAttribute('stroke','#080808');
    pl.setAttribute('stroke-width','1.5');
    pl.setAttribute('fill','none');
    svg.appendChild(pl); cbx.appendChild(svg);

    cbx.addEventListener('click',()=>{
      ps.checks[key]=!ps.checks[key];
      cbx.classList.toggle('on',ps.checks[key]);
      row.classList.toggle('cvs-task-done',ps.checks[key]);
      lbl.classList.toggle('done',ps.checks[key]);
      save();
      if(ps.checks[key]&&(typeof SETTINGS==='undefined'||SETTINGS.soundOnComplete)){
        try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator();const g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(880,ctx.currentTime);o.frequency.setValueAtTime(1100,ctx.currentTime+0.06);g.gain.setValueAtTime(0.12,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.18);o.start();o.stop(ctx.currentTime+0.18);}catch(e){}
      }
      onChanged();
      updateGlobal();
    });

    const lbl=document.createElement('span');
    lbl.className='t-lbl'+(checked?' done':'');
    lbl.textContent=label;
    lbl.style.fontSize='10px';
    lbl.addEventListener('click',()=>cbx.click());

    row.appendChild(cbx);
    row.appendChild(lbl);
    return row;
  }

  function refreshCard(ph){
    const ps=getPhaseStore(ph);
    const prog=phaseProgress(ph);
    const done=isComplete(ph);

    const card=document.getElementById('cvs-card-'+ph.id);
    if(!card) return;

    // update completion class
    card.classList.toggle('cvs-card-done',done);

    // update progress display in header
    const progEl=card.querySelector('.cvs-prog');
    if(progEl){ progEl.textContent=done?'✓':prog.done+'/'+prog.total; progEl.classList.toggle('cvs-prog-done',done); }

    // update progress bar
    const pb=card.querySelector('.cvs-pb');
    if(pb){ pb.style.width=prog.pct+'%'; pb.classList.toggle('cvs-pb-done',done); }

    // re-render body
    const body=document.getElementById('cvs-body-'+ph.id);
    if(body) renderCanvasBody(ph,ps,body,prog);
  }

  // ─── expand / collapse ────────────────────────────
  function _doExpand(phId, world, phases){
    _expandedId=phId;
    const vp=document.getElementById('canvas-vp');
    if(!vp) return;
    const vpW=vp.clientWidth;
    const vpH=vp.clientHeight;

    phases.forEach(ph=>{
      const card=document.getElementById('cvs-card-'+ph.id);
      if(!card) return;
      if(ph.id===phId){
        card.classList.add('cvs-card-expanded');
        card.style.left=(vpW/2-340)+'px';
        card.style.top='40px';
        card.style.width='680px';
        card.style.zIndex='100';
        const body=document.getElementById('cvs-body-'+ph.id);
        if(body) body.style.maxHeight='70vh';
      } else {
        card.classList.add('cvs-card-dimmed');
        card.style.pointerEvents='none';
      }
    });

    // close button
    const closeBtn=document.createElement('button');
    closeBtn.id='cvs-close-expanded';
    closeBtn.className='cvs-tbtn';
    closeBtn.style.cssText='position:absolute;top:8px;right:16px;z-index:200;border-color:var(--accent3);color:var(--accent3);';
    closeBtn.textContent='✕ Collapse';
    closeBtn.addEventListener('click',()=>canvasCollapseCard());
    world.appendChild(closeBtn);
  }

  window.canvasExpandCard=function(phId){
    if(_expandedId) canvasCollapseCard();
    const world=document.getElementById('canvas-world');
    if(!world) return;
    // re-centre view
    _offsetX=0; _offsetY=0; _scale=1;
    applyTransform(world);
    _doExpand(phId, world, allPhases());
  };

  window.canvasCollapseCard=function(){
    _expandedId=null;
    const layout=getLayout();
    allPhases().forEach(ph=>{
      const card=document.getElementById('cvs-card-'+ph.id);
      if(!card) return;
      card.classList.remove('cvs-card-expanded','cvs-card-dimmed');
      card.style.pointerEvents='';
      card.style.zIndex='';
      card.style.width=CARD_W+'px';
      const pos=layout[ph.id]||{x:40,y:40};
      card.style.left=pos.x+'px';
      card.style.top=pos.y+'px';
      const body=document.getElementById('cvs-body-'+ph.id);
      if(body) body.style.maxHeight='';
    });
    const closeBtn=document.getElementById('cvs-close-expanded');
    if(closeBtn) closeBtn.remove();
  };

  // ─── drag cards ──────────────────────────────────
  function setupCardDrag(card,ph,hdr){
    hdr.addEventListener('mousedown',e=>{
      if(e.target.closest('button')) return; // don't drag when clicking buttons
      if(_expandedId) return;
      e.preventDefault();
      const layout=getLayout();
      const pos=layout[ph.id]||{x:0,y:0};
      _dragState={card, phId:ph.id, startX:e.clientX, startY:e.clientY, origX:pos.x, origY:pos.y};
      card.classList.add('cvs-card-dragging');
      document.body.style.userSelect='none';
    });
  }

  // ─── pan canvas ──────────────────────────────────
  function setupCanvasPan(vp, world){
    vp.addEventListener('mousedown',e=>{
      if(e.target!==vp&&e.target!==world) return;
      if(_expandedId) return;
      e.preventDefault();
      _panState={startX:e.clientX,startY:e.clientY,origOX:_offsetX,origOY:_offsetY};
      vp.style.cursor='grabbing';
    });
  }

  function setupCanvasZoom(vp, world){
    vp.addEventListener('wheel',e=>{
      if(_expandedId) return;
      e.preventDefault();
      const rect=vp.getBoundingClientRect();
      const mx=e.clientX-rect.left;
      const my=e.clientY-rect.top;
      const delta=-e.deltaY*0.001;
      const newScale=Math.min(MAX_SCALE,Math.max(MIN_SCALE,_scale*(1+delta)));
      // zoom toward cursor
      _offsetX=mx-(_scale===0?1:newScale/_scale)*(mx-_offsetX);
      _offsetY=my-(_scale===0?1:newScale/_scale)*(my-_offsetY);
      _scale=newScale;
      applyTransform(world);
    },{passive:false});
  }

  // ─── global mouse handlers ────────────────────────
  document.addEventListener('mousemove',e=>{
    if(_dragState){
      const layout=getLayout();
      const dx=(e.clientX-_dragState.startX)/_scale;
      const dy=(e.clientY-_dragState.startY)/_scale;
      const nx=_dragState.origX+dx;
      const ny=_dragState.origY+dy;
      _dragState.card.style.left=nx+'px';
      _dragState.card.style.top=ny+'px';
      layout[_dragState.phId]={x:nx,y:ny};
    }
    if(_panState){
      const dx=e.clientX-_panState.startX;
      const dy=e.clientY-_panState.startY;
      _offsetX=_panState.origOX+dx;
      _offsetY=_panState.origOY+dy;
      const world=document.getElementById('canvas-world');
      if(world) applyTransform(world);
    }
  });

  document.addEventListener('mouseup',()=>{
    if(_dragState){
      _dragState.card.classList.remove('cvs-card-dragging');
      saveLayout();
      _dragState=null;
      document.body.style.userSelect='';
    }
    if(_panState){
      const vp=document.getElementById('canvas-vp');
      if(vp) vp.style.cursor='';
      _panState=null;
    }
  });

  // ─── public API ──────────────────────────────────
  window.initCanvas=function(type){
    _canvasType=type||'main';
    _expandedId=null;
    renderCanvas();
  };

  window.canvasSetType=function(type){
    _canvasType=type;
    _expandedId=null;
    _scale=1; _offsetX=0; _offsetY=0;
    renderCanvas();
  };

  window.canvasResetView=function(){
    _scale=1; _offsetX=0; _offsetY=0;
    const world=document.getElementById('canvas-world');
    if(world) applyTransform(world);
  };

  window.canvasAutoArrange=function(){
    const layout=getLayout();
    const phases=allPhases();
    phases.forEach(ph=>{ delete layout[ph.id]; });
    saveLayout();
    canvasResetView();
    renderCanvas();
    toast('Canvas rearranged');
  };

})();
