// LMS Dev Hub — assets.js
// ========================================

// =====================================================
// ASSET TRACKER
// =====================================================
const ASSET_TYPES={sprite:{label:'Sprite',color:'#4af0c8'},audio:{label:'Audio',color:'#c8f04a'},model:{label:'3D Model',color:'#a04af0'},fx:{label:'VFX/Shader',color:'#f04a4a'},anim:{label:'Animation',color:'#f0a04a'},ui:{label:'UI',color:'#4a9af0'},tileset:{label:'Tileset',color:'#f04ac8'},font:{label:'Font',color:'#aaaaaa'}};

function renderAssets(){
  const el=document.getElementById('asset-grid');if(!el)return;if(!D||!D.assets)return;
  const tf=document.getElementById('asset-filter')?.value||'all';
  const sf=document.getElementById('asset-status-filter')?.value||'all';
  let assets=D.assets;
  if(tf!=='all')assets=assets.filter(a=>a.type===tf);
  if(sf!=='all')assets=assets.filter(a=>a.status===sf);
  if(!assets.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);grid-column:1/-1;padding:20px 0;">No assets yet. Click Add Asset to start tracking.</div>';return;}
  el.innerHTML='';
  assets.forEach((asset,i)=>{
    const orig_i=D.assets.indexOf(asset);
    const td=ASSET_TYPES[asset.type]||{label:asset.type,color:'#888'};
    const card=document.createElement('div');card.className='asset-card';
    card.innerHTML=`<div class="asset-type-badge" style="background:${td.color}22;color:${td.color};border:1px solid ${td.color}44;">${td.label}</div><div class="asset-name">${escHtml(asset.name)}</div><div class="asset-status ${asset.status}">${asset.status.toUpperCase()}</div>${asset.notes?`<div style="font-size:9px;color:var(--text3);margin-top:4px;line-height:1.4;">${escHtml(asset.notes)}</div>`:''}<div style="display:flex;gap:4px;margin-top:8px;"><button class="btn" style="flex:1;font-size:9px;" onclick="cycleAssetStatus(${orig_i})">Cycle Status</button><button class="btn danger" style="font-size:9px;" onclick="deleteAsset(${orig_i})">×</button></div>`;
    el.appendChild(card);
  });
}

function openAddAsset(){
  const typeOpts=Object.entries(ASSET_TYPES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
  openModal('Add Asset',`
    <label class="modal-label">Asset Name</label>
    <input class="modal-inp" id="na-name" placeholder="e.g. player_run.png, jump_sfx.wav">
    <label class="modal-label">Type</label>
    <select class="modal-select" id="na-type">${typeOpts}</select>
    <label class="modal-label">Status</label>
    <select class="modal-select" id="na-status"><option value="todo">To Do</option><option value="wip">In Progress</option><option value="done">Done</option></select>
    <label class="modal-label">Notes</label>
    <input class="modal-inp" id="na-notes" placeholder="Dimensions, source, format...">
  `,[{label:'Cancel',action:closeModal},{label:'Add',action:()=>{
    const name=document.getElementById('na-name').value.trim();if(!name)return;
    if(!D.assets)D.assets=[];
    D.assets.push({id:'ast_'+Date.now(),name,type:document.getElementById('na-type').value,status:document.getElementById('na-status').value,notes:document.getElementById('na-notes').value});
    save();closeModal();renderAssets();toast('Asset added: '+name);
  },accent:true}]);
}

function cycleAssetStatus(i){
  const statuses=['todo','wip','done'];
  const asset=D.assets[i];if(!asset)return;
  const cur=statuses.indexOf(asset.status);
  asset.status=statuses[(cur+1)%statuses.length];
  save();renderAssets();
}

function deleteAsset(i){D.assets.splice(i,1);save();renderAssets();}
