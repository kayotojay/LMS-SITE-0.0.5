// LMS Dev Hub — custom-nodes.js
// =====================================================
// CUSTOM NODE SYSTEM
// Create, edit, save, export custom node templates.
// Custom nodes appear in the Scene Tree "Add Node" modal
// and in the Canvas Mode palette under a "Custom" group.
// Shared to server via Firebase when in server mode.
// =====================================================

// ── 70 available icons for custom nodes ─────────────
const CUSTOM_NODE_ICONS = [
  'node2d','node3d','sprite','animSprite','body','area','collision',
  'label','button','panel','control','camera','camera3d','audio','audioMini',
  'animation','timer','root','mesh','light','script','gear','bolt','star',
  'sparkle','link','clock','database','archive','package','trash','copy',
  'download','upload','mail','file','pen','globe','refresh','plus','minus',
  'circle','dot','lock','warning','check','play','collapse','expand','celebration',
  // new
  'shield','flame','skull','trophy','heart','diamond','magnet','scan',
  'rocket','planet','sword','map','key','eye','layers','cpu','wifi','target','compass'
];

// ── icon picker display labels ───────────────────────
const CUSTOM_NODE_ICON_LABELS = {
  node2d:'Node2D',node3d:'Node3D',sprite:'Sprite',animSprite:'AnimSprite',
  body:'Body',area:'Area',collision:'Collision',label:'Label',button:'Button',
  panel:'Panel',control:'Control',camera:'Camera',camera3d:'Camera3D',
  audio:'Audio',audioMini:'Audio2D',animation:'Anim',timer:'Timer',
  root:'Root',mesh:'Mesh',light:'Light',script:'Script',gear:'Gear',
  bolt:'Bolt',star:'Star',sparkle:'Sparkle',link:'Link',clock:'Clock',
  database:'DB',archive:'Archive',package:'Package',trash:'Trash',copy:'Copy',
  download:'Download',upload:'Upload',mail:'Mail',file:'File',pen:'Pen',
  globe:'Globe',refresh:'Refresh',plus:'Plus',minus:'Minus',circle:'Circle',
  dot:'Dot',lock:'Lock',warning:'Warning',check:'Check',play:'Play',
  collapse:'Collapse',expand:'Expand',celebration:'Party',
  shield:'Shield',flame:'Flame',skull:'Skull',trophy:'Trophy',heart:'Heart',
  diamond:'Diamond',magnet:'Magnet',scan:'Scan',rocket:'Rocket',planet:'Planet',
  sword:'Sword',map:'Map',key:'Key',eye:'Eye',layers:'Layers',
  cpu:'CPU',wifi:'WiFi',target:'Target',compass:'Compass'
};

// ── default property templates by category ──────────
const CUSTOM_PROP_PRESETS = {
  'Transform 2D': [
    {key:'position',label:'Position',type:'vector2',value:{x:0,y:0}},
    {key:'rotation',label:'Rotation',type:'float',value:0},
    {key:'scale',label:'Scale',type:'vector2',value:{x:1,y:1}},
    {key:'z_index',label:'Z-Index',type:'int',value:0},
  ],
  'Transform 3D': [
    {key:'position',label:'Position',type:'vector3',value:{x:0,y:0,z:0}},
    {key:'rotation',label:'Rotation',type:'vector3',value:{x:0,y:0,z:0}},
    {key:'scale',label:'Scale',type:'vector3',value:{x:1,y:1,z:1}},
  ],
  'Visibility': [
    {key:'visible',label:'Visible',type:'bool',value:true},
    {key:'modulate',label:'Modulate',type:'color',value:'#ffffff'},
    {key:'opacity',label:'Opacity',type:'float',value:1},
  ],
  'Physics': [
    {key:'mass',label:'Mass',type:'float',value:1},
    {key:'friction',label:'Friction',type:'float',value:1},
    {key:'bounce',label:'Bounce',type:'float',value:0},
    {key:'gravity_scale',label:'Gravity Scale',type:'float',value:1},
  ],
  'Audio': [
    {key:'volume_db',label:'Volume dB',type:'float',value:0},
    {key:'pitch_scale',label:'Pitch Scale',type:'float',value:1},
    {key:'autoplay',label:'Autoplay',type:'bool',value:false},
  ],
  'UI': [
    {key:'text',label:'Text',type:'string',value:''},
    {key:'font_size',label:'Font Size',type:'int',value:16},
    {key:'disabled',label:'Disabled',type:'bool',value:false},
  ],
};

// ── helpers ──────────────────────────────────────────
function getCustomNodes() {
  if (!D) return [];
  if (!D.customNodes) D.customNodes = [];
  return D.customNodes;
}

function getCustomNodeById(id) {
  return getCustomNodes().find(n => n.id === id) || null;
}

function makeCustomNodeId() {
  return 'cn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function makeCustomPropId() {
  return 'cp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
}

// Build default props object from a custom node definition's props array
function buildCustomNodeDefaultProps(cnDef) {
  const base = { visible: true, process_mode: 'inherit', groups: [], script: null };
  (cnDef.props || []).forEach(p => {
    const keys = p.key.split('.');
    let obj = base;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    // deep-clone default value
    obj[keys[keys.length - 1]] = typeof p.value === 'object' && p.value !== null
      ? JSON.parse(JSON.stringify(p.value)) : p.value;
  });
  return base;
}

// ── render the Custom Nodes page ─────────────────────
function renderCustomNodesPage() {
  const el = document.getElementById('custom-nodes-list');
  if (!el) return;
  const nodes = getCustomNodes();
  if (!nodes.length) {
    el.innerHTML = '<div class="no-sel-msg" style="padding:30px 0;font-size:11px;">No custom nodes yet.<br>Click <b>New Custom Node</b> to create one.</div>';
    return;
  }
  el.innerHTML = '';
  nodes.forEach(cn => {
    const col = cn.color || '#4af0c8';
    const ico = lmsIcon(cn.icon || 'root', col, 14);
    const card = document.createElement('div');
    card.className = 'cn-card';
    card.innerHTML = `
      <div class="cn-card-hdr" style="border-left:3px solid ${col};">
        <span class="cn-card-ico">${ico}</span>
        <span class="cn-card-name">${escHtml(cn.name)}</span>
        <span class="cn-card-base" style="color:var(--text3);">${escHtml(cn.baseType || 'Node2D')}</span>
        <div class="cn-card-actions">
          <button class="nav-tiny-btn" title="Edit" onclick="openEditCustomNodeModal('${cn.id}')">${lmsIcon('pen','var(--icon-dim)',10)}</button>
          <button class="nav-tiny-btn" title="Duplicate" onclick="duplicateCustomNode('${cn.id}')">${lmsIcon('copy','var(--icon-dim)',10)}</button>
          <button class="nav-tiny-btn" title="Export" onclick="exportSingleCustomNode('${cn.id}')">${lmsIcon('download','var(--icon-dim)',10)}</button>
          <button class="nav-tiny-btn" title="Delete" onclick="deleteCustomNode('${cn.id}')" style="color:var(--accent3);">${lmsIcon('trash','var(--accent3)',10)}</button>
        </div>
      </div>
      <div class="cn-card-body">
        <div class="cn-card-meta">
          <span class="pill" style="color:${col};border-color:${col};">${escHtml(cn.category||'Custom')}</span>
          ${cn.script ? `<span class="pill" style="color:var(--icon-mid);border-color:var(--icon-mid);">${lmsIcon('script','var(--icon-mid)',8)} script</span>` : ''}
          ${(cn.props||[]).length ? `<span class="pill">${(cn.props||[]).length} props</span>` : ''}
        </div>
        ${cn.description ? `<div class="cn-card-desc">${escHtml(cn.description)}</div>` : ''}
        ${(cn.props||[]).length ? `<div class="cn-props-preview">${(cn.props||[]).slice(0,6).map(p=>`<span class="cn-prop-chip">${escHtml(p.label||p.key)}: <em>${escHtml(p.type)}</em></span>`).join('')}${(cn.props||[]).length>6?`<span class="cn-prop-chip">+${(cn.props||[]).length-6} more</span>`:''}</div>` : ''}
      </div>`;
    el.appendChild(card);
  });
}

// ── open create/edit modal ────────────────────────────
function openNewCustomNodeModal() {
  openCustomNodeModal(null);
}

function openEditCustomNodeModal(id) {
  openCustomNodeModal(id);
}

function openCustomNodeModal(editId) {
  const existing = editId ? getCustomNodeById(editId) : null;
  const isEdit = !!existing;

  // State for the modal (props list, script)
  let modalProps = existing ? JSON.parse(JSON.stringify(existing.props || [])) : [];
  let modalScript = existing ? (existing.script ? JSON.parse(JSON.stringify(existing.script)) : null) : null;
  let selectedIcon = existing ? (existing.icon || 'root') : 'root';
  let selectedColor = existing ? (existing.color || '#4af0c8') : '#4af0c8';

  // Build icon picker HTML
  function buildIconPicker() {
    return `<div class="cn-icon-picker" id="cn-icon-picker">
      ${CUSTOM_NODE_ICONS.map(ico => `
        <div class="cn-icon-opt${selectedIcon===ico?' selected':''}" data-ico="${ico}" title="${CUSTOM_NODE_ICON_LABELS[ico]||ico}"
          onclick="cnSelectIcon('${ico}')">
          ${lmsIcon(ico, selectedIcon===ico ? selectedColor : 'var(--icon-dim)', 14)}
        </div>`).join('')}
    </div>`;
  }

  function buildPropsEditor() {
    if (!modalProps.length) return '<div style="font-size:10px;color:var(--text3);padding:6px 0;">No properties yet. Add from presets or create custom.</div>';
    return modalProps.map((p, i) => `
      <div class="cn-prop-row" id="cnpr-${p.id}">
        <input class="insp-inp" style="width:90px;" placeholder="key" value="${escHtml(p.key)}" onchange="cnPropChange('${p.id}','key',this.value)">
        <input class="insp-inp" style="width:80px;" placeholder="label" value="${escHtml(p.label||'')}" onchange="cnPropChange('${p.id}','label',this.value)">
        <select class="modal-select" style="width:80px;" onchange="cnPropChange('${p.id}','type',this.value)">
          ${['string','int','float','bool','color','vector2','vector3','enum'].map(t=>`<option value="${t}"${p.type===t?' selected':''}>${t}</option>`).join('')}
        </select>
        <input class="insp-inp" style="flex:1;" placeholder="default" value="${escHtml(typeof p.value==='object'?JSON.stringify(p.value):String(p.value??''))}" onchange="cnPropChange('${p.id}','value',this.value)">
        <button class="nav-tiny-btn" style="color:var(--accent3);" onclick="cnRemoveProp('${p.id}')">${lmsIcon('cross','var(--accent3)',9)}</button>
      </div>`).join('');
  }

  function buildScriptSection() {
    if (modalScript) {
      return `<div class="insp-row" style="flex-wrap:wrap;gap:4px;">
        <span class="insp-key">Attached:</span>
        <span class="script-badge" onclick="cnEditScript()">${lmsIcon('script','var(--icon-mid)',10)} ${escHtml(modalScript.name||'script.gd')}</span>
        <button class="btn" style="font-size:9px;" onclick="cnEditScript()">Edit</button>
        <button class="btn danger" style="font-size:9px;" onclick="cnDetachScript()">Detach</button>
      </div>`;
    }
    return `<button class="btn accent" style="font-size:9px;" onclick="cnAttachScript()">Attach Script</button>`;
  }

  const baseTypeOpts = [
    'Node','Node2D','Node3D','Sprite2D','AnimatedSprite2D',
    'StaticBody2D','RigidBody2D','CharacterBody2D','Area2D',
    'CollisionShape2D','Label','Button','Control','Panel',
    'Camera2D','Camera3D','AudioStreamPlayer','AnimationPlayer','Timer'
  ].map(t=>`<option value="${t}"${(existing?.baseType||'Node2D')===t?' selected':''}>${t}</option>`).join('');

  const presetOpts = ['— add preset props —', ...Object.keys(CUSTOM_PROP_PRESETS)].map((k,i)=>`<option value="${i===0?'':k}">${k}</option>`).join('');

  const content = `
    <div class="cn-modal-grid">
      <!-- Left: identity -->
      <div class="cn-modal-col">
        <div class="cn-modal-section-title">Identity</div>
        <label class="modal-label">Name</label>
        <input class="modal-inp" id="cn-name" placeholder="e.g. PlayerBody, EnemySpawner" value="${escHtml(existing?.name||'')}">
        <label class="modal-label">Category (palette group)</label>
        <input class="modal-inp" id="cn-category" placeholder="e.g. Custom, Game, UI" value="${escHtml(existing?.category||'Custom')}">
        <label class="modal-label">Base Type (extends)</label>
        <select class="modal-select" id="cn-base-type">${baseTypeOpts}</select>
        <label class="modal-label">Description</label>
        <textarea class="modal-inp" id="cn-desc" style="min-height:48px;resize:vertical;">${escHtml(existing?.description||'')}</textarea>
        <div class="cn-modal-section-title" style="margin-top:12px;">Appearance</div>
        <label class="modal-label">Color</label>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <input type="color" id="cn-color" value="${selectedColor}" style="width:36px;height:28px;border:none;background:none;cursor:pointer;padding:0;" onchange="cnColorChange(this.value)">
          <span id="cn-color-label" style="font-size:10px;color:var(--text2);">${selectedColor}</span>
        </div>
        <label class="modal-label">Icon (${CUSTOM_NODE_ICONS.length} available)</label>
        <div id="cn-icon-picker-wrap">${buildIconPicker()}</div>
        <div class="cn-modal-section-title" style="margin-top:12px;">Script</div>
        <div id="cn-script-section">${buildScriptSection()}</div>
      </div>
      <!-- Right: properties -->
      <div class="cn-modal-col">
        <div class="cn-modal-section-title">Properties</div>
        <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
          <select class="modal-select" id="cn-preset-sel" style="flex:1;min-width:140px;">${presetOpts}</select>
          <button class="btn" style="font-size:9px;" onclick="cnAddPreset()">Add Preset</button>
          <button class="btn accent" style="font-size:9px;" onclick="cnAddBlankProp()">+ Blank</button>
        </div>
        <div style="font-size:9px;color:var(--text3);margin-bottom:6px;display:grid;grid-template-columns:90px 80px 80px 1fr 20px;gap:4px;padding:0 2px;">
          <span>Key</span><span>Label</span><span>Type</span><span>Default</span><span></span>
        </div>
        <div id="cn-props-list">${buildPropsEditor()}</div>
        <div class="cn-modal-section-title" style="margin-top:14px;">Preview</div>
        <div id="cn-preview-wrap" style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:10px;min-height:60px;">
          ${buildPreview()}
        </div>
        <div class="cn-modal-section-title" style="margin-top:14px;">Sharing</div>
        <div style="font-size:10px;color:var(--text2);line-height:1.5;">
          ${isEdit ? 'Saved to project. In server mode, custom nodes sync to all members automatically.' : 'After saving, this node will appear in the palette and Add Node dialog for everyone on the server.'}
        </div>
      </div>
    </div>`;

  function buildPreview() {
    const name = document.getElementById('cn-name')?.value || existing?.name || 'MyNode';
    const col = selectedColor;
    return `<div style="display:flex;align-items:center;gap:8px;border-top:2px solid ${col};background:var(--bg3);border-radius:4px;padding:8px 10px;">
      <span>${lmsIcon(selectedIcon, col, 16)}</span>
      <span style="font-size:11px;font-weight:600;color:var(--text);">${escHtml(name)}</span>
      <span style="font-size:9px;color:${col};margin-left:4px;">[Custom]</span>
    </div>`;
  }

  openModal((isEdit ? 'Edit' : 'New') + ' Custom Node', content, [
    { label: 'Cancel', action: closeModal },
    { label: isEdit ? 'Save Changes' : 'Create', action: () => {
      const name = document.getElementById('cn-name').value.trim();
      if (!name) { toast('Name is required'); return; }
      const cn = isEdit ? existing : { id: makeCustomNodeId() };
      cn.name = name;
      cn.category = document.getElementById('cn-category').value.trim() || 'Custom';
      cn.baseType = document.getElementById('cn-base-type').value;
      cn.description = document.getElementById('cn-desc').value.trim();
      cn.color = selectedColor;
      cn.icon = selectedIcon;
      cn.props = JSON.parse(JSON.stringify(modalProps));
      cn.script = modalScript ? JSON.parse(JSON.stringify(modalScript)) : null;
      cn.modified = new Date().toLocaleDateString();
      if (!isEdit) {
        cn.created = cn.modified;
        if (!D.customNodes) D.customNodes = [];
        D.customNodes.push(cn);
      }
      save();
      closeModal();
      renderCustomNodesPage();
      // Refresh palette in canvas mode if open
      if (typeof refreshCanvasPalette === 'function') refreshCanvasPalette();
      toast((isEdit ? 'Updated' : 'Created') + ': ' + name);
    }, accent: true }
  ]);

  // Expose mutation helpers to modal scope
  window.cnSelectIcon = function(ico) {
    selectedIcon = ico;
    document.querySelectorAll('.cn-icon-opt').forEach(el => {
      const isSelected = el.dataset.ico === ico;
      el.classList.toggle('selected', isSelected);
      el.innerHTML = lmsIcon(ico === el.dataset.ico ? ico : el.dataset.ico,
        (el.dataset.ico === ico) ? selectedColor : 'var(--icon-dim)', 14);
    });
    refreshPreview();
  };

  window.cnColorChange = function(val) {
    selectedColor = val;
    document.getElementById('cn-color-label').textContent = val;
    // Rerender icon picker with new color for selected icon
    document.querySelectorAll('.cn-icon-opt').forEach(el => {
      el.innerHTML = lmsIcon(el.dataset.ico, el.dataset.ico === selectedIcon ? selectedColor : 'var(--icon-dim)', 14);
    });
    refreshPreview();
  };

  window.cnPropChange = function(propId, field, value) {
    const p = modalProps.find(p => p.id === propId);
    if (!p) return;
    if (field === 'value') {
      // Try parsing as number/bool/object
      if (value === 'true') p.value = true;
      else if (value === 'false') p.value = false;
      else if (!isNaN(value) && value !== '') p.value = Number(value);
      else { try { p.value = JSON.parse(value); } catch { p.value = value; } }
    } else {
      p[field] = value;
    }
    refreshPropsPreview();
  };

  window.cnRemoveProp = function(propId) {
    modalProps = modalProps.filter(p => p.id !== propId);
    document.getElementById('cn-props-list').innerHTML = buildPropsEditor();
    refreshPropsPreview();
  };

  window.cnAddBlankProp = function() {
    modalProps.push({ id: makeCustomPropId(), key: 'my_prop', label: 'My Prop', type: 'string', value: '' });
    document.getElementById('cn-props-list').innerHTML = buildPropsEditor();
    refreshPropsPreview();
  };

  window.cnAddPreset = function() {
    const sel = document.getElementById('cn-preset-sel').value;
    if (!sel || !CUSTOM_PROP_PRESETS[sel]) return;
    CUSTOM_PROP_PRESETS[sel].forEach(p => {
      if (!modalProps.find(mp => mp.key === p.key)) {
        modalProps.push({ id: makeCustomPropId(), ...JSON.parse(JSON.stringify(p)) });
      }
    });
    document.getElementById('cn-props-list').innerHTML = buildPropsEditor();
    refreshPropsPreview();
  };

  window.cnAttachScript = function() {
    const defaultName = (document.getElementById('cn-name')?.value?.trim() || 'Custom') + '.gd';
    openModal('Attach Script to Custom Node', `
      <label class="modal-label">Script Name</label>
      <input class="modal-inp" id="cns-name" value="${escHtml(defaultName)}">
      <label class="modal-label">Code</label>
      <textarea class="modal-inp" id="cns-code" style="min-height:140px;font-family:var(--font);font-size:10px;color:#9fe1cb;"
        placeholder="extends Node2D&#10;&#10;func _ready():&#10;  pass&#10;&#10;func _process(delta):&#10;  pass"></textarea>
    `, [
      { label: 'Back', action: () => { closeModal(); openCustomNodeModal(editId); } },
      { label: 'Attach', action: () => {
        modalScript = { name: document.getElementById('cns-name').value.trim() || defaultName, code: document.getElementById('cns-code').value, created: new Date().toLocaleDateString() };
        closeModal();
        openCustomNodeModal(editId);
      }, accent: true }
    ]);
    // Pre-fill if we already have one
    if (modalScript) {
      document.getElementById('cns-name').value = modalScript.name || defaultName;
      document.getElementById('cns-code').value = modalScript.code || '';
    }
  };

  window.cnEditScript = function() {
    if (!modalScript) { cnAttachScript(); return; }
    openModal('Edit Script: ' + escHtml(modalScript.name), `
      <input class="modal-inp" id="cns-edit-name" value="${escHtml(modalScript.name)}">
      <textarea class="modal-inp" id="cns-edit-code" style="min-height:220px;font-family:var(--font);font-size:10px;color:#9fe1cb;">${escHtml(modalScript.code||'')}</textarea>
    `, [
      { label: 'Back', action: () => { closeModal(); openCustomNodeModal(editId); } },
      { label: 'Save', action: () => {
        modalScript.name = document.getElementById('cns-edit-name').value.trim() || modalScript.name;
        modalScript.code = document.getElementById('cns-edit-code').value;
        modalScript.modified = new Date().toLocaleDateString();
        closeModal();
        openCustomNodeModal(editId);
      }, accent: true }
    ]);
  };

  window.cnDetachScript = function() {
    modalScript = null;
    document.getElementById('cn-script-section').innerHTML = buildScriptSection();
  };

  function refreshPreview() {
    const wrap = document.getElementById('cn-preview-wrap');
    if (wrap) wrap.innerHTML = buildPreview();
  }

  function refreshPropsPreview() {
    const wrap = document.getElementById('cn-preview-wrap');
    if (wrap) wrap.innerHTML = buildPreview();
  }
}

// ── duplicate ─────────────────────────────────────────
function duplicateCustomNode(id) {
  const cn = getCustomNodeById(id);
  if (!cn) return;
  const copy = JSON.parse(JSON.stringify(cn));
  copy.id = makeCustomNodeId();
  copy.name = cn.name + ' Copy';
  copy.created = new Date().toLocaleDateString();
  copy.modified = copy.created;
  if (!D.customNodes) D.customNodes = [];
  D.customNodes.push(copy);
  save();
  renderCustomNodesPage();
  toast('Duplicated: ' + copy.name);
}

// ── delete ────────────────────────────────────────────
function deleteCustomNode(id) {
  const cn = getCustomNodeById(id);
  if (!cn) return;
  openModal('Delete Custom Node', `<p style="font-size:11px;color:var(--text2);">Delete <b>${escHtml(cn.name)}</b>? This won't affect nodes already placed in scenes.</p>`, [
    { label: 'Cancel', action: closeModal },
    { label: 'Delete', action: () => {
      D.customNodes = D.customNodes.filter(n => n.id !== id);
      save();
      closeModal();
      renderCustomNodesPage();
      if (typeof refreshCanvasPalette === 'function') refreshCanvasPalette();
      toast('Deleted: ' + cn.name);
    }, danger: true }
  ]);
}

// ── export single custom node ─────────────────────────
function exportSingleCustomNode(id) {
  const cn = getCustomNodeById(id);
  if (!cn) return;
  const blob = new Blob([JSON.stringify(cn, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = cn.name.replace(/\s/g, '_') + '.customnode.json';
  a.click();
  toast('Exported: ' + cn.name);
}

// ── export all custom nodes ───────────────────────────
function exportAllCustomNodes() {
  const nodes = getCustomNodes();
  if (!nodes.length) { toast('No custom nodes to export'); return; }
  const blob = new Blob([JSON.stringify({ customNodes: nodes, exported: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'custom_nodes_export.json';
  a.click();
  toast('Exported ' + nodes.length + ' custom nodes');
}

// ── import custom nodes from JSON ─────────────────────
function importCustomNodes() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        let toImport = [];
        if (Array.isArray(data)) toImport = data;
        else if (data.customNodes) toImport = data.customNodes;
        else if (data.id && data.name) toImport = [data]; // single node
        if (!toImport.length) { toast('No custom nodes found in file'); return; }
        if (!D.customNodes) D.customNodes = [];
        let added = 0;
        toImport.forEach(cn => {
          if (!cn.name) return;
          // Assign new ID to avoid collisions
          cn.id = makeCustomNodeId();
          cn.imported = new Date().toLocaleDateString();
          D.customNodes.push(cn);
          added++;
        });
        save();
        renderCustomNodesPage();
        if (typeof refreshCanvasPalette === 'function') refreshCanvasPalette();
        toast('Imported ' + added + ' custom node(s)');
      } catch (err) {
        toast('Import failed: invalid JSON');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ── integrate with scene.js "Add Node" modal ─────────
// Called from scene.js openAddNodeModal — adds custom types to the type select
function injectCustomNodeTypes() {
  const sel = document.getElementById('an-type');
  if (!sel) return;
  const nodes = getCustomNodes();
  if (!nodes.length) return;
  // Add separator + custom options
  const sep = document.createElement('option');
  sep.disabled = true;
  sep.textContent = '── Custom Nodes ──';
  sel.appendChild(sep);
  nodes.forEach(cn => {
    const opt = document.createElement('option');
    opt.value = '__custom__' + cn.id;
    opt.textContent = cn.name + ' (Custom)';
    sel.appendChild(opt);
  });
}

// Patch makeNode to handle custom node types
const _origMakeNode = window.makeNode;
window.makeNode = function(type, name, parentId) {
  if (type && type.startsWith('__custom__')) {
    const cnId = type.replace('__custom__', '');
    const cn = getCustomNodeById(cnId);
    if (cn) {
      const node = {
        id: 'nd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        type: cn.name,
        name: name || cn.name,
        parentId: parentId || null,
        children: [],
        collapsed: false,
        props: buildCustomNodeDefaultProps(cn),
        script: cn.script ? JSON.parse(JSON.stringify(cn.script)) : null,
        _customNodeId: cn.id,
        _isCustom: true,
      };
      return node;
    }
  }
  return _origMakeNode(type, name, parentId);
};

// Patch getNodeTypeDef to handle custom nodes
const _origGetNodeTypeDef = window.getNodeTypeDef;
window.getNodeTypeDef = function(type) {
  const nodes = getCustomNodes();
  const cn = nodes.find(n => n.name === type);
  if (cn) {
    return { type: cn.name, icon: cn.icon || 'root', cls: 'nt-custom', color: cn.color || '#4af0c8', _isCustom: true, _cnDef: cn };
  }
  return _origGetNodeTypeDef(type);
};

// Patch getNodeSVGIcon to handle custom nodes
const _origGetNodeSVGIcon = window.getNodeSVGIcon;
window.getNodeSVGIcon = function(nodeType, size) {
  const nodes = getCustomNodes();
  const cn = nodes.find(n => n.name === nodeType);
  if (cn) {
    return lmsIcon(cn.icon || 'root', cn.color || 'var(--icon-hi)', size || 13);
  }
  return _origGetNodeSVGIcon(nodeType, size);
};

// Patch renderInspector to show custom node properties
const _origRenderInspector = window.renderInspector;
window.renderInspector = function() {
  _origRenderInspector();
  // After base render, inject custom props section if applicable
  const scene = typeof getActiveScene === 'function' ? getActiveScene() : null;
  const nodeId = typeof selectedNodeId !== 'undefined' ? selectedNodeId : null;
  if (!scene || !nodeId) return;
  const node = scene.nodes[nodeId];
  if (!node || !node._isCustom) return;
  const cn = getCustomNodeById(node._customNodeId);
  if (!cn || !(cn.props || []).length) return;
  const el = document.getElementById('inspector-body');
  if (!el) return;
  // Add custom props section at the top after Node section
  const customSection = document.createElement('div');
  customSection.className = 'insp-section';
  customSection.style.borderLeft = '3px solid ' + (cn.color || '#4af0c8');
  customSection.style.paddingLeft = '8px';
  let html = `<div class="insp-section-title" style="color:${cn.color||'var(--accent2)'};">${escHtml(cn.name)} Properties</div>`;
  cn.props.forEach(p => {
    const val = node.props[p.key] !== undefined ? node.props[p.key] : p.value;
    if (p.type === 'bool') {
      const isOn = !!val;
      html += `<div class="insp-row"><span class="insp-key">${escHtml(p.label||p.key)}</span><div class="insp-val"><div class="insp-check${isOn?' on':''}" onclick="toggleNodeProp('${p.key}',this)">${isOn?lmsIcon('check','var(--icon-hi)',9):''}</div></div></div>`;
    } else if (p.type === 'color') {
      html += `<div class="insp-row"><span class="insp-key">${escHtml(p.label||p.key)}</span><div class="insp-val"><div style="display:flex;align-items:center;gap:6px;"><input type="color" value="${escHtml(String(val||'#ffffff'))}" style="width:28px;height:22px;border:none;background:none;padding:0;cursor:pointer;" onchange="setNodeProp('${p.key}',this.value)"><input class="insp-inp" value="${escHtml(String(val||'#ffffff'))}" style="width:70px;" onchange="setNodeProp('${p.key}',this.value)"></div></div></div>`;
    } else if (p.type === 'vector2') {
      const v = typeof val === 'object' ? val : {x:0,y:0};
      html += `<div class="insp-row"><span class="insp-key">${escHtml(p.label||p.key)} X</span><div class="insp-val"><input class="insp-inp" type="number" step="0.01" value="${v.x??0}" onchange="setNodeProp('${p.key}.x',parseFloat(this.value))"></div></div>`;
      html += `<div class="insp-row"><span class="insp-key">${escHtml(p.label||p.key)} Y</span><div class="insp-val"><input class="insp-inp" type="number" step="0.01" value="${v.y??0}" onchange="setNodeProp('${p.key}.y',parseFloat(this.value))"></div></div>`;
    } else if (p.type === 'vector3') {
      const v = typeof val === 'object' ? val : {x:0,y:0,z:0};
      html += `<div class="insp-row"><span class="insp-key">${escHtml(p.label||p.key)} X</span><div class="insp-val"><input class="insp-inp" type="number" step="0.01" value="${v.x??0}" onchange="setNodeProp('${p.key}.x',parseFloat(this.value))"></div></div>`;
      html += `<div class="insp-row"><span class="insp-key">${escHtml(p.label||p.key)} Y</span><div class="insp-val"><input class="insp-inp" type="number" step="0.01" value="${v.y??0}" onchange="setNodeProp('${p.key}.y',parseFloat(this.value))"></div></div>`;
      html += `<div class="insp-row"><span class="insp-key">${escHtml(p.label||p.key)} Z</span><div class="insp-val"><input class="insp-inp" type="number" step="0.01" value="${v.z??0}" onchange="setNodeProp('${p.key}.z',parseFloat(this.value))"></div></div>`;
    } else {
      const inputType = (p.type === 'int' || p.type === 'float') ? 'number' : 'text';
      const step = p.type === 'float' ? ' step="0.01"' : '';
      html += `<div class="insp-row"><span class="insp-key">${escHtml(p.label||p.key)}</span><div class="insp-val"><input class="insp-inp" type="${inputType}"${step} value="${escHtml(String(val??''))}" onchange="setNodeProp('${p.key}',${inputType==='number'?'(this.value==\'\'?0:'+(p.type==='float'?'parseFloat':'parseInt')+'(this.value))':'this.value'})"></div></div>`;
    }
  });
  customSection.innerHTML = html;
  // Insert after first section (Node section)
  const firstSection = el.querySelector('.insp-section');
  if (firstSection && firstSection.nextSibling) {
    el.insertBefore(customSection, firstSection.nextSibling);
  } else {
    el.insertBefore(customSection, el.firstChild);
  }
};

// ── canvas palette refresh ────────────────────────────
window.refreshCanvasPalette = function() {
  // The canvas palette re-renders on next initSceneCanvas call.
  // If canvas is currently open, we need to rebuild the palette list.
  const palList = document.getElementById('sc-pal-list');
  if (!palList) return;
  // Find/rebuild the Custom group
  const existing = palList.querySelector('.sc-pal-group-custom');
  if (existing) {
    // Remove old custom group items
    let el = existing;
    while (el) {
      const next = el.nextSibling;
      if (next && next.classList && next.classList.contains('sc-pal-group')) break;
      if (next && next.classList && next.classList.contains('sc-pal-group-custom')) { el = next; continue; }
      el.remove();
      el = next;
    }
    existing.remove();
  }
  buildCustomPaletteGroup(palList);
};

function buildCustomPaletteGroup(list) {
  const nodes = getCustomNodes();
  if (!nodes.length) return;
  const grpLabel = document.createElement('div');
  grpLabel.className = 'sc-pal-group sc-pal-group-custom';
  grpLabel.textContent = 'Custom';
  list.appendChild(grpLabel);
  nodes.forEach(cn => {
    const item = document.createElement('div');
    item.className = 'sc-pal-item sc-pal-item-custom';
    item.setAttribute('draggable', 'true');
    item.setAttribute('data-node-type', '__custom__' + cn.id);
    const col = cn.color || '#4af0c8';
    const ico = lmsIcon(cn.icon || 'root', col, 13);
    item.innerHTML = `
      <span class="sc-pal-dot" style="background:${col};box-shadow:0 0 6px ${col}44;"></span>
      <span class="sc-pal-ico">${ico}</span>
      <span class="sc-pal-name">${escHtml(cn.name)}</span>`;
    item.title = cn.description ? cn.description : 'Custom: ' + cn.name;
    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', '__custom__' + cn.id);
      e.dataTransfer.effectAllowed = 'copy';
      item.classList.add('sc-pal-item-dragging');
    });
    item.addEventListener('dragend', () => item.classList.remove('sc-pal-item-dragging'));
    list.appendChild(item);
  });
}

// Patch the canvas palette builder to include custom nodes
// We hook into the palette search re-render
document.addEventListener('DOMContentLoaded', () => {
  // Intercept sc-pal-list population
  const origBuildPalette = window.buildCustomPaletteGroup;
  // After canvas opens, custom nodes are added to palette
  const _obsTarget = document.getElementById('sc-pal-list');
  if (_obsTarget) {
    const obs = new MutationObserver(() => {
      if (!document.getElementById('sc-pal-list')?.querySelector('.sc-pal-group-custom')) {
        buildCustomPaletteGroup(document.getElementById('sc-pal-list'));
      }
    });
    obs.observe(_obsTarget, { childList: true });
  }
});

// Also hook openAddNodeModal to inject custom node types
const _origOpenAddNodeModal = window.openAddNodeModal;
window.openAddNodeModal = function() {
  _origOpenAddNodeModal();
  // After modal opens, inject custom types into the type select
  requestAnimationFrame(injectCustomNodeTypes);
};

// Patch canvas drop handler for custom node types
// The existing drop handler calls makeNode(type,...) which we've already patched.
// We also need nodeColor to work for custom types:
const _origNodeColor = window.nodeColor;
if (typeof _origNodeColor !== 'undefined') {
  window.nodeColor = function(type) {
    const nodes = getCustomNodes();
    const cn = nodes.find(n => n.name === type || ('__custom__'+n.id) === type);
    if (cn) return cn.color || '#4af0c8';
    return _origNodeColor(type);
  };
}

// ── sync custom nodes to/from save payload ────────────
// Patch save() in roots.js is not possible directly, but D.customNodes
// persists automatically since save() does JSON.stringify(D) in solo mode
// and we add it to fbData in server mode via the patch below:
const _origSave = window.save;
window.save = function() {
  // Ensure customNodes is always initialized
  if (D && !D.customNodes) D.customNodes = [];
  _origSave();
};

// Server sync patch — inject customNodes into fbData
// We achieve this by patching fbPatch to include it inline since
// we can't easily modify the save function internals. Instead,
// we store customNodes in D and rely on the full D serialization in solo mode.
// For server mode, we add a secondary sync call:
const _origSaveForServer = window.save;
window.save = function() {
  if (D) {
    if (!D.customNodes) D.customNodes = [];
  }
  _origSaveForServer();
  // Server: push customNodes as a separate path so all members receive it
  if (D && typeof srvState !== 'undefined' && srvState.activeProjId && srvState.serverKey) {
    try {
      const _svUrl = CFG_URL; const _svKey = CFG_KEY;
      if (typeof _withServerCreds === 'function' && typeof fbPatch === 'function') {
        _withServerCreds(_svUrl, _svKey, () =>
          fbPatch('/servers/' + srvState.serverKey + '/projects/' + srvState.activeProjId + '/customNodes',
            D.customNodes || []));
      }
    } catch(e) {}
  }
};

// ── page render hook ──────────────────────────────────
// Called by nav.js when switching to custom-nodes page
window.renderCustomNodesPage = renderCustomNodesPage;
window.openNewCustomNodeModal = openNewCustomNodeModal;
window.openEditCustomNodeModal = openEditCustomNodeModal;
window.duplicateCustomNode = duplicateCustomNode;
window.deleteCustomNode = deleteCustomNode;
window.exportSingleCustomNode = exportSingleCustomNode;
window.exportAllCustomNodes = exportAllCustomNodes;
window.importCustomNodes = importCustomNodes;
window.buildCustomPaletteGroup = buildCustomPaletteGroup;
