// LMS Dev Hub — scene.js
// ========================================

// =====================================================
// SCENE TREE SYSTEM (Godot-style)
// =====================================================
let activeSceneId=null,selectedNodeId=null;

const NODE_TYPES=[
  {type:'Node2D',icon:'node2d',cls:'nt-node2d'},
  {type:'Sprite2D',icon:'sprite',cls:'nt-sprite'},
  {type:'AnimatedSprite2D',icon:'animSprite',cls:'nt-anim'},
  {type:'StaticBody2D',icon:'body',cls:'nt-body'},
  {type:'RigidBody2D',icon:'gear',cls:'nt-body'},
  {type:'CharacterBody2D',icon:'body',cls:'nt-body'},
  {type:'Area2D',icon:'area',cls:'nt-area'},
  {type:'CollisionShape2D',icon:'collision',cls:'nt-collision'},
  {type:'CollisionPolygon2D',icon:'collision',cls:'nt-collision'},
  {type:'Label',icon:'label',cls:'nt-label'},
  {type:'Button',icon:'button',cls:'nt-button'},
  {type:'TextureButton',icon:'button',cls:'nt-button'},
  {type:'Panel',icon:'panel',cls:'nt-ctrl'},
  {type:'HBoxContainer',icon:'panel',cls:'nt-ctrl'},
  {type:'VBoxContainer',icon:'panel',cls:'nt-ctrl'},
  {type:'Control',icon:'control',cls:'nt-ctrl'},
  {type:'Camera2D',icon:'camera',cls:'nt-camera'},
  {type:'AudioStreamPlayer',icon:'audio',cls:'nt-audio'},
  {type:'AudioStreamPlayer2D',icon:'audioMini',cls:'nt-audio'},
  {type:'AnimationPlayer',icon:'animation',cls:'nt-anim'},
  {type:'Timer',icon:'timer',cls:'nt-timer'},
  {type:'Node',icon:'root',cls:'nt-root'},
  {type:'Node3D',icon:'node3d',cls:'nt-node2d'},
  {type:'MeshInstance3D',icon:'mesh',cls:'nt-sprite'},
  {type:'DirectionalLight3D',icon:'light',cls:'nt-camera'},
  {type:'Camera3D',icon:'camera3d',cls:'nt-camera'},
];

function getNodeTypeDef(type){return NODE_TYPES.find(t=>t.type===type)||{type,icon:'⭕',cls:'nt-root'};}

function defaultNodeProps(type){
  const base={visible:true,process_mode:'inherit',groups:[],script:null};
  if(type.includes('2D')||type==='Node2D'){return{...base,position:{x:0,y:0},rotation:0,scale:{x:1,y:1},z_index:0};}
  if(type==='Label')return{...base,text:'Label',font_size:16,h_align:'left'};
  if(type==='Button'||type==='TextureButton')return{...base,text:'Button',disabled:false};
  if(type==='AudioStreamPlayer'||type==='AudioStreamPlayer2D')return{...base,autoplay:false,volume_db:0,pitch_scale:1};
  if(type==='Timer')return{...base,wait_time:1,one_shot:false,autostart:false};
  if(type==='Camera2D')return{...base,current:false,zoom:{x:1,y:1}};
  return base;
}

function makeNode(type,name,parentId){
  return{id:'nd_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),type,name:name||type,parentId:parentId||null,children:[],collapsed:false,props:defaultNodeProps(type),script:null};
}

function makeScene(name,rootType){
  const root=makeNode(rootType||'Node2D','Root',null);
  return{id:'sc_'+Date.now(),name:name||'New Scene',rootId:root.id,nodes:{[root.id]:root},folderId:null};
}

function openNewSceneModal(){
  const typeOpts=NODE_TYPES.map(t=>`<option value="${t.type}">${t.type}</option>`).join('');
  openModal('New Scene',`
    <label class="modal-label">Scene Name</label>
    <input class="modal-inp" id="ns-name" placeholder="e.g. GameWorld, PlayerScene, HUD">
    <label class="modal-label">Root Node Type</label>
    <select class="modal-select" id="ns-root-type">${typeOpts}</select>
    <label class="modal-label">Save in Folder (optional)</label>
    <select class="modal-select" id="ns-folder">
      <option value="">Root (no folder)</option>
      ${(D.sceneFolders||[]).map(f=>`<option value="${f.id}">${escHtml(f.name)}</option>`).join('')}
    </select>
  `,[{label:'Cancel',action:closeModal},{label:'Create',action:()=>{
    const name=document.getElementById('ns-name').value.trim();if(!name)return;
    const rootType=document.getElementById('ns-root-type').value;
    const folderId=document.getElementById('ns-folder').value||null;
    const scene=makeScene(name,rootType);
    scene.folderId=folderId;
    if(!D.scenes)D.scenes=[];
    D.scenes.push(scene);
    save();closeModal();
    renderSceneFileTree();
    setActiveScene(scene.id);
    toast('Scene created: '+name);
  },accent:true}]);
}

function openNewFolderModal(){
  const parentOpts=`<option value="">Root</option>`+(D.sceneFolders||[]).map(f=>`<option value="${f.id}">${escHtml(f.name)}</option>`).join('');
  openModal('New Scene Folder',`
    <label class="modal-label">Folder Name</label>
    <input class="modal-inp" id="nf-name" placeholder="e.g. Levels, UI, Characters">
    <label class="modal-label">Parent Folder</label>
    <select class="modal-select" id="nf-parent">${parentOpts}</select>
  `,[{label:'Cancel',action:closeModal},{label:'Create',action:()=>{
    const name=document.getElementById('nf-name').value.trim();if(!name)return;
    const parentId=document.getElementById('nf-parent').value||null;
    if(!D.sceneFolders)D.sceneFolders=[];
    D.sceneFolders.push({id:'sf_'+Date.now(),name,parentId,collapsed:false});
    save();closeModal();renderSceneFileTree();toast('Folder created: '+name);
  },accent:true}]);
}

function renderSceneFileTree(){
  const el=document.getElementById('scene-file-tree');if(!el)return;
  if(!D){el.innerHTML='';return;}
  if(!D.scenes)D.scenes=[];if(!D.sceneFolders)D.sceneFolders=[];
  el.innerHTML='';
  // Build tree: folders then loose scenes
  function renderFolder(parentId,depth){
    const folders=(D.sceneFolders||[]).filter(f=>(f.parentId||null)===(parentId||null));
    const scenes=(D.scenes||[]).filter(s=>(s.folderId||null)===(parentId||null));
    folders.forEach(folder=>{
      const div=document.createElement('div');div.className='sft-folder';
      const hdr=document.createElement('div');hdr.className='sft-folder-hdr';
      hdr.style.paddingLeft=(depth*12+8)+'px';
      const arr=document.createElement('span');arr.className='sft-arr'+(folder.collapsed?'':' open');arr.innerHTML=lmsIcon('chevRight','var(--icon-dim)',10);
      const icon=document.createElement('span');icon.className='sft-folder-icon';icon.innerHTML=lmsIcon('folder','var(--icon-mid)',12);
      const name=document.createElement('span');name.className='sft-folder-name';name.textContent=folder.name;
      const del=document.createElement('button');del.className='nav-tiny-btn';del.innerHTML=lmsIcon('cross','var(--icon-dim)',9);del.title='Delete folder';
      del.onclick=e=>{e.stopPropagation();deleteSceneFolder(folder.id);};
      hdr.appendChild(arr);hdr.appendChild(icon);hdr.appendChild(name);hdr.appendChild(del);
      const children=document.createElement('div');children.className='sft-folder-children'+(folder.collapsed?'':' open');
      hdr.onclick=()=>{folder.collapsed=!folder.collapsed;arr.classList.toggle('open',!folder.collapsed);children.classList.toggle('open',!folder.collapsed);save();};
      el.appendChild(div);div.appendChild(hdr);div.appendChild(children);
      // Fill children container
      const subFolders=(D.sceneFolders||[]).filter(f=>(f.parentId||null)===folder.id);
      const subScenes=(D.scenes||[]).filter(s=>(s.folderId||null)===folder.id);
      subFolders.forEach(sf=>{buildFolderItem(sf,depth+1,children);});
      subScenes.forEach(sc=>{children.appendChild(buildSceneItem(sc,depth+1));});
    });
    scenes.forEach(sc=>{el.appendChild(buildSceneItem(sc,depth));});
  }
  renderFolder(null,0);
}

function buildFolderItem(folder,depth,container){
  const div=document.createElement('div');div.className='sft-folder';
  const hdr=document.createElement('div');hdr.className='sft-folder-hdr';
  hdr.style.paddingLeft=(depth*12+8)+'px';
  const arr=document.createElement('span');arr.className='sft-arr'+(folder.collapsed?'':' open');arr.innerHTML=lmsIcon('chevRight','var(--icon-dim)',10);
  const icon=document.createElement('span');icon.className='sft-folder-icon';icon.innerHTML=lmsIcon('folder','var(--icon-mid)',12);
  const name=document.createElement('span');name.className='sft-folder-name';name.textContent=folder.name;
  const del=document.createElement('button');del.className='nav-tiny-btn';del.innerHTML=lmsIcon('cross','var(--icon-dim)',9);
  del.onclick=e=>{e.stopPropagation();deleteSceneFolder(folder.id);};
  hdr.appendChild(arr);hdr.appendChild(icon);hdr.appendChild(name);hdr.appendChild(del);
  const children=document.createElement('div');children.className='sft-folder-children'+(folder.collapsed?'':' open');
  hdr.onclick=()=>{folder.collapsed=!folder.collapsed;arr.classList.toggle('open',!folder.collapsed);children.classList.toggle('open',!folder.collapsed);save();};
  div.appendChild(hdr);div.appendChild(children);
  const subFolders=(D.sceneFolders||[]).filter(f=>(f.parentId||null)===folder.id);
  const subScenes=(D.scenes||[]).filter(s=>(s.folderId||null)===folder.id);
  subFolders.forEach(sf=>buildFolderItem(sf,depth+1,children));
  subScenes.forEach(sc=>children.appendChild(buildSceneItem(sc,depth+1)));
  container.appendChild(div);
}

function buildSceneItem(scene,depth){
  const rootNode=scene.nodes?.[scene.rootId];
  const def=rootNode?getNodeTypeDef(rootNode.type):{icon:'file',cls:'nt-root'};
  const item=document.createElement('div');item.className='sft-scene'+(activeSceneId===scene.id?' active-scene':'');
  item.style.paddingLeft=(depth*12+8)+'px';
  const svgIco=getNodeSVGIcon(rootNode?rootNode.type:'Node',13);
  item.innerHTML=`<span class="sft-scene-icon ${def.cls}">${svgIco}</span><span style="flex:1;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(scene.name)}</span><button class="nav-tiny-btn" title="Open in Canvas" onclick="event.stopPropagation();openSceneCanvas('${scene.id}')" style="color:var(--accent2);">${lmsIcon('node2d','var(--accent2)',9)}</button><button class="nav-tiny-btn" onclick="event.stopPropagation();renameScene('${scene.id}')" title="Rename">${lmsIcon('pen','var(--icon-dim)',9)}</button><button class="nav-tiny-btn" onclick="event.stopPropagation();deleteScene('${scene.id}')" title="Delete">${lmsIcon('cross','var(--icon-dim)',9)}</button>`;
  item.onclick=()=>setActiveScene(scene.id);
  return item;
}

function deleteSceneFolder(id){
  if(!confirm){}
  D.sceneFolders=(D.sceneFolders||[]).filter(f=>f.id!==id);
  // Move scenes to root
  (D.scenes||[]).forEach(s=>{if(s.folderId===id)s.folderId=null;});
  save();renderSceneFileTree();toast('Folder deleted');
}

function renameScene(id){
  const scene=(D.scenes||[]).find(s=>s.id===id);if(!scene)return;
  openModal('Rename Scene',`<input class="modal-inp" id="ren-name" value="${escHtml(scene.name)}">`,[
    {label:'Cancel',action:closeModal},{label:'Rename',action:()=>{scene.name=document.getElementById('ren-name').value.trim()||scene.name;save();renderSceneFileTree();closeModal();toast('Renamed');},accent:true}
  ]);
}

function deleteScene(id){
  openModal('Delete Scene',`<p style="font-size:11px;color:var(--text2);">Delete this scene and all its nodes?</p>`,[
    {label:'Cancel',action:closeModal},{label:'Delete',action:()=>{D.scenes=(D.scenes||[]).filter(s=>s.id!==id);if(activeSceneId===id){activeSceneId=null;selectedNodeId=null;}save();closeModal();renderSceneFileTree();renderNodeTree();renderInspector();toast('Scene deleted');},danger:true}
  ]);
}

function setActiveScene(sceneId){
  activeSceneId=sceneId;selectedNodeId=null;
  renderSceneFileTree();renderNodeTree();renderInspector();
  const scene=(D.scenes||[]).find(s=>s.id===sceneId);
  const titleEl=document.getElementById('st-panel-title');
  if(titleEl)titleEl.textContent=(scene?scene.name:'NODE TREE').toUpperCase();
  const addBtn=document.getElementById('st-add-node-btn');
  const delBtn=document.getElementById('st-del-node-btn');
  if(addBtn){addBtn.disabled=false;addBtn.style.opacity='1';}
  if(delBtn){delBtn.disabled=true;delBtn.style.opacity='.4';}
}

function getActiveScene(){return(D.scenes||[]).find(s=>s.id===activeSceneId)||null;}

function renderNodeTree(){
  const el=document.getElementById('scene-node-tree');if(!el)return;
  const scene=getActiveScene();
  if(!scene){el.innerHTML='<div class="no-sel-msg" style="padding:20px;font-size:10px;">No scene selected.<br>Create or select a scene.</div>';return;}
  el.innerHTML='';
  function buildNode(nodeId,depth){
    const node=scene.nodes[nodeId];if(!node)return;
    const def=getNodeTypeDef(node.type);
    const wrapper=document.createElement('div');wrapper.className='st-node';
    const row=document.createElement('div');row.className='st-node-row'+(selectedNodeId===nodeId?' selected':'');
    row.style.paddingLeft=(depth*14+6)+'px';
    const hasChildren=node.children&&node.children.length>0;
    const arr=document.createElement('span');arr.className='st-node-arr'+(hasChildren?'':' leaf')+((!node.collapsed&&hasChildren)?' open':'');
    arr.innerHTML=lmsIcon('chevRight','var(--icon-dim)',9);
    const ico=document.createElement('span');ico.className='st-node-icon '+def.cls;ico.innerHTML=getNodeSVGIcon(node.type,12);
    const nm=document.createElement('span');nm.className='st-node-name'+(node.script?' has-script':'');nm.textContent=node.name;
    const nid=document.createElement('span');nid.className='st-node-id';nid.textContent=node.props?.node_id||'';
    row.appendChild(arr);row.appendChild(ico);row.appendChild(nm);row.appendChild(nid);
    row.onclick=()=>selectNode(nodeId);
    if(hasChildren){
      arr.onclick=e=>{e.stopPropagation();node.collapsed=!node.collapsed;save();renderNodeTree();};
    }
    wrapper.appendChild(row);
    if(hasChildren&&!node.collapsed){
      const children=document.createElement('div');children.className='st-node-children open';
      node.children.forEach(cid=>buildNode(cid,depth+1,children));
      wrapper.appendChild(children);
      node.children.forEach(cid=>{const cn=buildNode(cid,depth+1);if(cn)children.appendChild(cn);});
    }
    return wrapper;
  }
  // Rebuild using return pattern
  el.innerHTML='';
  function buildNodeEl(nodeId,depth){
    const node=scene.nodes[nodeId];if(!node)return null;
    const def=getNodeTypeDef(node.type);
    const wrapper=document.createElement('div');wrapper.className='st-node';
    const row=document.createElement('div');row.className='st-node-row'+(selectedNodeId===nodeId?' selected':'');
    row.style.paddingLeft=(depth*14+6)+'px';
    const hasChildren=node.children&&node.children.length>0;
    const arr=document.createElement('span');arr.className='st-node-arr'+(hasChildren?((!node.collapsed)?' open':''):' leaf');
    arr.innerHTML=lmsIcon('chevRight','var(--icon-dim)',9);
    const ico=document.createElement('span');ico.className='st-node-icon '+def.cls;ico.innerHTML=getNodeSVGIcon(node.type,12);
    const nm=document.createElement('span');nm.className='st-node-name'+(node.script?' has-script':'');nm.textContent=node.name;
    const nid=document.createElement('span');nid.className='st-node-id';nid.style.fontSize='8px';nid.style.color='var(--text3)';nid.textContent=node.props?.node_id?'#'+node.props.node_id:'';
    row.appendChild(arr);row.appendChild(ico);row.appendChild(nm);row.appendChild(nid);
    row.onclick=e=>{e.stopPropagation();selectNode(nodeId);};
    if(hasChildren){arr.onclick=e=>{e.stopPropagation();node.collapsed=!node.collapsed;save();renderNodeTree();};}
    wrapper.appendChild(row);
    if(hasChildren&&!node.collapsed){
      node.children.forEach(cid=>{const cn=buildNodeEl(cid,depth+1);if(cn)wrapper.appendChild(cn);});
    }
    return wrapper;
  }
  const rootEl=buildNodeEl(scene.rootId,0);
  if(rootEl)el.appendChild(rootEl);
}

function selectNode(nodeId){
  selectedNodeId=nodeId;
  renderNodeTree();renderInspector();
  const delBtn=document.getElementById('st-del-node-btn');
  const scene=getActiveScene();
  if(delBtn){const isRoot=scene&&nodeId===scene.rootId;delBtn.disabled=!!isRoot;delBtn.style.opacity=isRoot?'.4':'1';}
}

function renderInspector(){
  const el=document.getElementById('inspector-body');if(!el)return;
  const scene=getActiveScene();
  if(!scene||!selectedNodeId){el.innerHTML='<div class="no-sel-msg">Select a node<br>to view &amp; edit properties</div>';return;}
  const node=scene.nodes[selectedNodeId];if(!node){el.innerHTML='<div class="no-sel-msg">Node not found</div>';return;}
  const def=getNodeTypeDef(node.type);
  function inp(label,key,type='text',extraAttrs=''){
    const val=key.split('.').reduce((o,k)=>o&&o[k],node.props)??'';
    return `<div class="insp-row"><span class="insp-key">${label}</span><div class="insp-val"><input class="insp-inp" type="${type}" value="${escHtml(String(val))}" ${extraAttrs} onchange="setNodeProp('${key}',this.value)"></div></div>`;
  }
  function chk(label,key){
    const val=key.split('.').reduce((o,k)=>o&&o[k],node.props)??false;
    return `<div class="insp-row"><span class="insp-key">${label}</span><div class="insp-val"><div class="insp-check${val?' on':''}" onclick="toggleNodeProp('${key}',this)">${val?lmsIcon('check','var(--icon-hi)',9):''}</div></div></div>`;
  }
  let propsHtml='';
  // Common
  propsHtml+=`<div class="insp-section"><div class="insp-section-title">Node</div>`;
  propsHtml+=`<div class="insp-row"><span class="insp-key">Name</span><div class="insp-val"><input class="insp-inp" value="${escHtml(node.name)}" onchange="setNodeName(this.value)"></div></div>`;
  propsHtml+=`<div class="insp-row"><span class="insp-key">Type</span><div class="insp-val"><span style="font-size:10px;color:var(--text2);display:flex;align-items:center;gap:4px;">${getNodeSVGIcon(node.type,11)} ${escHtml(node.type)}</span></div></div>`;
  propsHtml+=`<div class="insp-row"><span class="insp-key">Node ID</span><div class="insp-val"><input class="insp-inp" placeholder="e.g. player, enemy_01" value="${escHtml(node.props?.node_id||'')}" onchange="setNodeProp('node_id',this.value)"></div></div>`;
  propsHtml+=chk('Visible','visible');
  propsHtml+=`</div>`;
  // Transform
  if(node.props?.position!==undefined){
    propsHtml+=`<div class="insp-section"><div class="insp-section-title">Transform</div>`;
    propsHtml+=`<div class="insp-row"><span class="insp-key">Position X</span><div class="insp-val"><input class="insp-inp" type="number" value="${node.props.position?.x??0}" onchange="setNodeProp('position.x',parseFloat(this.value))"></div></div>`;
    propsHtml+=`<div class="insp-row"><span class="insp-key">Position Y</span><div class="insp-val"><input class="insp-inp" type="number" value="${node.props.position?.y??0}" onchange="setNodeProp('position.y',parseFloat(this.value))"></div></div>`;
    if(node.props.rotation!==undefined)propsHtml+=`<div class="insp-row"><span class="insp-key">Rotation</span><div class="insp-val"><input class="insp-inp" type="number" step="0.01" value="${node.props.rotation??0}" onchange="setNodeProp('rotation',parseFloat(this.value))"></div></div>`;
    if(node.props.scale)propsHtml+=`<div class="insp-row"><span class="insp-key">Scale X</span><div class="insp-val"><input class="insp-inp" type="number" step="0.01" value="${node.props.scale?.x??1}" onchange="setNodeProp('scale.x',parseFloat(this.value))"></div></div><div class="insp-row"><span class="insp-key">Scale Y</span><div class="insp-val"><input class="insp-inp" type="number" step="0.01" value="${node.props.scale?.y??1}" onchange="setNodeProp('scale.y',parseFloat(this.value))"></div></div>`;
    if(node.props.z_index!==undefined)propsHtml+=`<div class="insp-row"><span class="insp-key">Z-Index</span><div class="insp-val"><input class="insp-inp" type="number" value="${node.props.z_index??0}" onchange="setNodeProp('z_index',parseInt(this.value))"></div></div>`;
    propsHtml+=`</div>`;
  }
  // Type-specific
  if(node.type==='Label'){
    propsHtml+=`<div class="insp-section"><div class="insp-section-title">Label</div>`;
    propsHtml+=inp('Text','text');propsHtml+=inp('Font Size','font_size','number');propsHtml+=`</div>`;
  }
  if(node.type==='Button'||node.type==='TextureButton'){
    propsHtml+=`<div class="insp-section"><div class="insp-section-title">Button</div>`;
    propsHtml+=inp('Text','text');propsHtml+=chk('Disabled','disabled');propsHtml+=`</div>`;
  }
  if(node.type.includes('AudioStream')){
    propsHtml+=`<div class="insp-section"><div class="insp-section-title">Audio</div>`;
    propsHtml+=chk('Autoplay','autoplay');propsHtml+=inp('Volume dB','volume_db','number');propsHtml+=inp('Pitch Scale','pitch_scale','number');propsHtml+=`</div>`;
  }
  if(node.type==='Timer'){
    propsHtml+=`<div class="insp-section"><div class="insp-section-title">Timer</div>`;
    propsHtml+=inp('Wait Time','wait_time','number');propsHtml+=chk('One Shot','one_shot');propsHtml+=chk('Autostart','autostart');propsHtml+=`</div>`;
  }
  if(node.type==='Camera2D'){
    propsHtml+=`<div class="insp-section"><div class="insp-section-title">Camera</div>`;
    propsHtml+=chk('Current','current');propsHtml+=inp('Zoom X','zoom.x','number');propsHtml+=inp('Zoom Y','zoom.y','number');propsHtml+=`</div>`;
  }
  // Script section
  propsHtml+=`<div class="insp-section"><div class="insp-section-title">Script</div>`;
  if(node.script){
    propsHtml+=`<div class="insp-row"><span class="insp-key">Attached</span><div class="insp-val"><div class="script-badge" onclick="openNodeScript('${selectedNodeId}')">${lmsIcon('script','var(--icon-mid)',10)} ${escHtml(node.script.name||'script.gd')}</div></div></div>`;
    propsHtml+=`<div class="insp-row"><span class="insp-key"></span><div class="insp-val"><button class="btn" style="font-size:9px;" onclick="openNodeScript('${selectedNodeId}')">Edit Script</button> <button class="btn danger" style="font-size:9px;" onclick="detachScript('${selectedNodeId}')">Detach</button></div></div>`;
  } else {
    propsHtml+=`<div class="insp-row"><span class="insp-key">No script</span><div class="insp-val"><button class="btn accent" style="font-size:9px;" onclick="attachScript('${selectedNodeId}')">Attach Script</button></div></div>`;
  }
  propsHtml+=`</div>`;
  // Groups
  propsHtml+=`<div class="insp-section"><div class="insp-section-title">Groups</div>`;
  propsHtml+=`<div id="insp-groups">`+(node.props.groups||[]).map((g,i)=>`<span class="pill" style="color:var(--accent2);border-color:var(--accent2);margin:2px;">${escHtml(g)} <span onclick="removeGroup(${i})" style="cursor:pointer;color:var(--accent3);margin-left:3px;">×</span></span>`).join('')+`</div>`;
  propsHtml+=`<div class="insp-row" style="margin-top:6px;"><input class="insp-inp" id="group-inp" placeholder="Add group..." style="margin-right:4px;"><button class="btn" style="font-size:9px;" onclick="addGroup()">Add</button></div>`;
  propsHtml+=`</div>`;
  // Notes
  propsHtml+=`<div class="insp-section"><div class="insp-section-title">Notes</div>`;
  propsHtml+=`<textarea class="insp-inp" style="min-height:60px;resize:vertical;width:100%;font-size:10px;" placeholder="Designer notes..." onchange="setNodeProp('_notes',this.value)">${escHtml(node.props?._notes||'')}</textarea>`;
  propsHtml+=`</div>`;
  el.innerHTML=propsHtml;
}

function setNodeProp(keyPath,value){
  const scene=getActiveScene();if(!scene||!selectedNodeId)return;
  const node=scene.nodes[selectedNodeId];if(!node)return;
  const keys=keyPath.split('.');
  let obj=node.props;
  for(let i=0;i<keys.length-1;i++){if(!obj[keys[i]])obj[keys[i]]={};obj=obj[keys[i]];}
  obj[keys[keys.length-1]]=value;
  save();renderNodeTree();
}

function toggleNodeProp(keyPath,el){
  const scene=getActiveScene();if(!scene||!selectedNodeId)return;
  const node=scene.nodes[selectedNodeId];if(!node)return;
  const keys=keyPath.split('.');let obj=node.props;
  for(let i=0;i<keys.length-1;i++){if(!obj[keys[i]])obj[keys[i]]={};obj=obj[keys[i]];}
  const cur=obj[keys[keys.length-1]];obj[keys[keys.length-1]]=!cur;
  el.classList.toggle('on',!cur);el.innerHTML=!cur?lmsIcon('check','var(--icon-hi)',9):'';
  save();
}

function setNodeName(val){
  const scene=getActiveScene();if(!scene||!selectedNodeId)return;
  const node=scene.nodes[selectedNodeId];if(!node)return;
  node.name=val||node.name;save();renderNodeTree();
}

function addGroup(){
  const inp=document.getElementById('group-inp');if(!inp)return;
  const g=inp.value.trim();if(!g)return;
  const scene=getActiveScene();if(!scene||!selectedNodeId)return;
  const node=scene.nodes[selectedNodeId];if(!node)return;
  if(!node.props.groups)node.props.groups=[];
  if(!node.props.groups.includes(g))node.props.groups.push(g);
  inp.value='';save();renderInspector();
}

function removeGroup(i){
  const scene=getActiveScene();if(!scene||!selectedNodeId)return;
  const node=scene.nodes[selectedNodeId];if(!node||!node.props.groups)return;
  node.props.groups.splice(i,1);save();renderInspector();
}

function openAddNodeModal(){
  const scene=getActiveScene();if(!scene)return;
  const parentOpts=Object.values(scene.nodes).map(n=>`<option value="${n.id}"${n.id===selectedNodeId?' selected':''}>${escHtml(n.name)} (${n.type})</option>`).join('');
  const typeOpts=NODE_TYPES.map(t=>`<option value="${t.type}">${t.type}</option>`).join('');
  openModal('Add Node',`
    <label class="modal-label">Node Type</label>
    <select class="modal-select" id="an-type">${typeOpts}</select>
    <label class="modal-label">Name</label>
    <input class="modal-inp" id="an-name" placeholder="e.g. Player, Enemy, HUD">
    <label class="modal-label">Node ID (unique identifier)</label>
    <input class="modal-inp" id="an-nid" placeholder="e.g. player, button_jump, health_bar">
    <label class="modal-label">Parent Node</label>
    <select class="modal-select" id="an-parent">${parentOpts}</select>
  `,[{label:'Cancel',action:closeModal},{label:'Add Node',action:()=>{
    const type=document.getElementById('an-type').value;
    const name=document.getElementById('an-name').value.trim()||type;
    const nid=document.getElementById('an-nid').value.trim();
    const parentId=document.getElementById('an-parent').value;
    const node=makeNode(type,name,parentId);
    if(nid)node.props.node_id=nid;
    scene.nodes[node.id]=node;
    const parent=scene.nodes[parentId];
    if(parent){if(!parent.children)parent.children=[];parent.children.push(node.id);}
    save();closeModal();renderNodeTree();selectNode(node.id);toast('Node added: '+name);
  },accent:true}]);
}

function deleteSelectedNode(){
  const scene=getActiveScene();if(!scene||!selectedNodeId)return;
  if(selectedNodeId===scene.rootId){toast('Cannot delete root node');return;}
  function deleteNodeRecursive(nodeId){
    const node=scene.nodes[nodeId];if(!node)return;
    (node.children||[]).forEach(c=>deleteNodeRecursive(c));
    delete scene.nodes[nodeId];
  }
  // Remove from parent
  Object.values(scene.nodes).forEach(n=>{if(n.children)n.children=n.children.filter(c=>c!==selectedNodeId);});
  deleteNodeRecursive(selectedNodeId);
  selectedNodeId=null;save();renderNodeTree();renderInspector();
  const delBtn=document.getElementById('st-del-node-btn');if(delBtn){delBtn.disabled=true;delBtn.style.opacity='.4';}
  toast('Node deleted');
}

function attachScript(nodeId){
  const scene=getActiveScene();if(!scene)return;
  const node=scene.nodes[nodeId];if(!node)return;
  const vaultScripts=D.scripts||[];
  const vaultOpts=vaultScripts.length
    ? vaultScripts.map(s=>`<option value="${s.id}">${escHtml(s.name)} ${escHtml(s.version||'')}</option>`).join('')
    : '';
  const vaultSection=vaultScripts.length
    ? `<label class="modal-label" style="margin-top:12px;">— OR IMPORT FROM SCRIPT VAULT —</label>
       <select class="modal-select" id="scr-vault-pick" onchange="(function(){const v=document.getElementById('scr-vault-pick').value;if(!v)return;const s=D.scripts.find(x=>x.id===v);if(s){document.getElementById('scr-name').value=s.name;document.getElementById('scr-code').value=s.code||'';}})()">
         <option value="">— Pick from vault —</option>${vaultOpts}
       </select>`
    : `<div style="font-size:9px;color:var(--text3);margin-top:8px;">No scripts in vault yet — write one below or add to Script Vault first.</div>`;
  openModal('Attach Script',`
    <label class="modal-label">Script Name</label>
    <input class="modal-inp" id="scr-name" placeholder="e.g. Player.gd, EnemyAI.gd" value="${escHtml(node.name+'.gd')}">
    ${vaultSection}
    <label class="modal-label" style="margin-top:12px;">Code</label>
    <textarea class="modal-inp" id="scr-code" style="min-height:120px;font-family:var(--font);font-size:10px;" placeholder="extends ${escHtml(node.type)}&#10;&#10;func _ready():&#10;  pass&#10;&#10;func _process(delta):&#10;  pass"></textarea>
  `,[{label:'Cancel',action:closeModal},{label:'Attach',action:()=>{
    const name=document.getElementById('scr-name').value.trim()||node.name+'.gd';
    const code=document.getElementById('scr-code').value;
    node.script={name,code,created:new Date().toLocaleDateString()};
    save();closeModal();renderInspector();renderNodeTree();toast('Script attached: '+name);
  },accent:true}]);
}

function detachScript(nodeId){
  const scene=getActiveScene();if(!scene)return;
  const node=scene.nodes[nodeId];if(!node)return;
  openModal('Detach Script',`<p style="font-size:11px;color:var(--text2);">Detach and remove script from ${escHtml(node.name)}?</p>`,[
    {label:'Cancel',action:closeModal},{label:'Detach',action:()=>{node.script=null;save();closeModal();renderInspector();renderNodeTree();toast('Script detached');},danger:true}
  ]);
}

function openNodeScript(nodeId){
  const scene=getActiveScene();if(!scene)return;
  const node=scene.nodes[nodeId];if(!node||!node.script)return;
  openModal('Script: '+escHtml(node.script.name),`
    <input class="modal-inp" id="scr-edit-name" value="${escHtml(node.script.name)}">
    <textarea class="modal-inp" id="scr-edit-code" style="min-height:280px;font-family:var(--font);font-size:10px;color:#9fe1cb;">${escHtml(node.script.code||'')}</textarea>
  `,[{label:'Cancel',action:closeModal},{label:'Save',action:()=>{
    node.script.name=document.getElementById('scr-edit-name').value.trim()||node.script.name;
    node.script.code=document.getElementById('scr-edit-code').value;
    node.script.modified=new Date().toLocaleDateString();
    save();closeModal();renderInspector();toast('Script saved');
  },accent:true}]);
}

function exportSceneTree(){
  const scene=getActiveScene();if(!scene){toast('No scene selected');return;}
  let out='# Scene: '+scene.name+'\n';
  out+='# Exported: '+new Date().toLocaleString()+'\n\n';
  function printNode(nodeId,depth){
    const node=scene.nodes[nodeId];if(!node)return;
    const pad=' '.repeat(depth*2);
    out+=pad+'[node name="'+node.name+'" type="'+node.type+'"'+(node.props?.node_id?' id="'+node.props.node_id+'"':'')+']\n';
    if(node.script)out+=pad+'  script = ExtResource("'+node.script.name+'")\n';
    (node.children||[]).forEach(c=>printNode(c,depth+1));
  }
  printNode(scene.rootId,0);
  const blob=new Blob([out],{type:'text/plain'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=scene.name.replace(/\s/g,'_')+'.tscn_txt';a.click();
  toast('Scene exported');
}
