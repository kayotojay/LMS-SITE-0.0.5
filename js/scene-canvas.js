// LMS Dev Hub — scene-canvas.js
// =====================================================
// SCENE CANVAS MODE — Blender-node / Lego-brick drag-drop scene builder
// Palette of node types on the left, infinite pan/zoom canvas on right.
// Nodes snap together into parent-child trees drawn with bezier connectors.
// All changes sync back to D.scenes[] so list view stays in sync.
// =====================================================

(function () {
  'use strict';

  // ── constants ────────────────────────────────────
  const NODE_W      = 180;
  const NODE_H      = 52;   // header only; expands with children indicator
  const GRID        = 16;
  const MIN_SCALE   = 0.12;
  const MAX_SCALE   = 2.4;
  const PORT_R      = 7;    // port hit radius

  // ── state ────────────────────────────────────────
  let _scale    = 1;
  let _ox       = 0;    // pan offset
  let _oy       = 0;
  let _pan      = null; // {startX,startY,origOX,origOY}
  let _drag     = null; // {nodeId,startX,startY,origX,origY}
  let _conn     = null; // {fromId, tempLine}
  let _sceneId  = null; // which scene we're editing

  // ── canvas settings (persisted on D) ─────────────
  // lineStyle: 'bezier' | 'straight' | 'ortho' | 'arc'
  // dynPorts:  true = perimeter-sliding, false = fixed left/right
  function getSetting(key, def) {
    if (!D.scCanvasSettings) D.scCanvasSettings = {};
    return D.scCanvasSettings[key] !== undefined ? D.scCanvasSettings[key] : def;
  }
  function setSetting(key, val) {
    if (!D.scCanvasSettings) D.scCanvasSettings = {};
    D.scCanvasSettings[key] = val;
    save();
  }

  // per-node canvas positions: D.scCanvasPos[sceneId][nodeId] = {x,y}
  function getPos(sceneId) {
    if (!D.scCanvasPos) D.scCanvasPos = {};
    if (!D.scCanvasPos[sceneId]) D.scCanvasPos[sceneId] = {};
    return D.scCanvasPos[sceneId];
  }

  function snapV(v) { return Math.round(v / GRID) * GRID; }

  // ── coordinate helpers ───────────────────────────
  function toWorld(sx, sy) {
    return { x: (sx - _ox) / _scale, y: (sy - _oy) / _scale };
  }
  function applyTransform(world) {
    world.style.transform = `translate(${_ox}px,${_oy}px) scale(${_scale})`;
  }

  // ── node color by category ───────────────────────
  const CAT_COLORS = {
    Node2D:         '#4af0c8',
    Node3D:         '#4a9af0',
    Node:           '#c8f04a',
    StaticBody2D:   '#f0a04a',
    RigidBody2D:    '#f0a04a',
    CharacterBody2D:'#f0a04a',
    Area2D:         '#f04a4a',
    CollisionShape2D:'#f04a9a',
    CollisionPolygon2D:'#f04a9a',
    Sprite2D:       '#c8f04a',
    AnimatedSprite2D:'#c8f04a',
    Label:          '#a04af0',
    Button:         '#a04af0',
    TextureButton:  '#a04af0',
    Panel:          '#4a78f0',
    HBoxContainer:  '#4a78f0',
    VBoxContainer:  '#4a78f0',
    Control:        '#4a78f0',
    Camera2D:       '#f0e04a',
    Camera3D:       '#f0e04a',
    AudioStreamPlayer: '#4af0a0',
    AudioStreamPlayer2D:'#4af0a0',
    AnimationPlayer:'#f04ac8',
    Timer:          '#f0784a',
    MeshInstance3D: '#c8f04a',
    DirectionalLight3D:'#f0e04a',
  };
  function nodeColor(type) {
    return CAT_COLORS[type] || '#4af0c8';
  }

  // ── build the full canvas UI ─────────────────────
  function initSceneCanvas(sceneId) {
    _sceneId = sceneId;
    _scale = 1; _ox = 0; _oy = 0;
    _drag = null; _conn = null; _pan = null;

    const container = document.getElementById('canvas-container');
    if (!container) return;
    container.innerHTML = '';

    const scene = (D.scenes || []).find(s => s.id === sceneId);

    // ── root wrapper ──
    const root = document.createElement('div');
    root.id = 'sc-canvas-root';
    container.appendChild(root);

    // ── toolbar ──
    const tb = buildToolbar(scene);
    root.appendChild(tb);

    // ── body: palette + viewport ──
    const body = document.createElement('div');
    body.id = 'sc-canvas-body';
    root.appendChild(body);

    // palette
    const palette = buildPalette();
    body.appendChild(palette);

    // viewport
    const vp = document.createElement('div');
    vp.id = 'sc-canvas-vp';
    body.appendChild(vp);

    const world = document.createElement('div');
    world.id = 'sc-canvas-world';
    vp.appendChild(world);

    // SVG connection layer
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.id = 'sc-canvas-svg';
    svgEl.setAttribute('style', 'position:absolute;top:0;left:0;width:8000px;height:8000px;pointer-events:none;z-index:0;overflow:visible;');
    addArrowDef(svgEl);
    world.appendChild(svgEl);

    if (scene) {
      autoLayoutNewNodes(scene);
      renderAllNodes(scene, world, svgEl);
    } else {
      world.innerHTML += `<div style="position:absolute;top:100px;left:80px;font-size:11px;color:var(--text3);">No scene selected — create or open a scene first.</div>`;
    }

    setupPan(vp, world);
    setupZoom(vp, world);
    applyTransform(world);

    // palette drag-drop onto viewport
    setupPaletteDrop(vp, world, svgEl, scene);
  }

  // ── toolbar ──────────────────────────────────────
  function buildToolbar(scene) {
    const tb = document.createElement('div');
    tb.id = 'sc-canvas-toolbar';

    const lineStyle = getSetting('lineStyle', 'bezier');
    const dynPorts  = getSetting('dynPorts', true);

    // Line-style buttons config
    const LINE_STYLES = [
      { id: 'bezier',   label: '⌒ Bezier'   },
      { id: 'straight', label: '╱ Straight'  },
      { id: 'ortho',    label: '⌐ Ortho'     },
      { id: 'arc',      label: '◡ Arc'       },
    ];

    tb.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex:1;flex-wrap:wrap;">
        <span style="font-size:9px;color:var(--text3);letter-spacing:.12em;">SCENE:</span>
        <span style="font-size:11px;color:var(--accent2);letter-spacing:.06em;">${scene ? escHtml(scene.name) : '—'}</span>
        <div style="width:1px;height:14px;background:var(--border);flex-shrink:0;"></div>
        <button class="cvs-tbtn" onclick="scCanvasResetView()">⌖ Reset</button>
        <button class="cvs-tbtn" onclick="scCanvasAutoLayout()">⊞ Auto-Layout</button>
        <div style="width:1px;height:14px;background:var(--border);flex-shrink:0;"></div>
        <span style="font-size:9px;color:var(--text3);opacity:.6;">LINES:</span>
        ${LINE_STYLES.map(s =>
          `<button class="cvs-tbtn sc-line-btn${lineStyle === s.id ? ' active' : ''}"
            data-linestyle="${s.id}"
            onclick="scCanvasSetLineStyle('${s.id}')">${s.label}</button>`
        ).join('')}
        <div style="width:1px;height:14px;background:var(--border);flex-shrink:0;"></div>
        <button class="cvs-tbtn sc-dynports-btn${dynPorts ? ' active' : ''}"
          id="sc-dynports-btn"
          onclick="scCanvasToggleDynPorts()"
          title="Toggle perimeter-sliding ports vs fixed left/right ports">⬡ Smart Ports</button>
        <button class="cvs-tbtn${getSetting('smartPath',false) ? ' active' : ''}"
          id="sc-smartpath-btn"
          onclick="scCanvasToggleSmartPath()"
          title="Route lines around nodes instead of through them">⤡ Smart Path</button>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button class="cvs-tbtn" onclick="scCanvasBack()" style="border-color:var(--accent2);color:var(--accent2);">← List View</button>
      </div>`;
    return tb;
  }

  // ── palette panel ────────────────────────────────
  const PALETTE_GROUPS = [
    { label: 'Core',      types: ['Node','Node2D','Node3D'] },
    { label: 'Physics',   types: ['StaticBody2D','RigidBody2D','CharacterBody2D','Area2D','CollisionShape2D','CollisionPolygon2D'] },
    { label: 'Visual',    types: ['Sprite2D','AnimatedSprite2D','MeshInstance3D'] },
    { label: 'UI',        types: ['Control','Label','Button','TextureButton','Panel','HBoxContainer','VBoxContainer'] },
    { label: 'Camera',    types: ['Camera2D','Camera3D','DirectionalLight3D'] },
    { label: 'Audio',     types: ['AudioStreamPlayer','AudioStreamPlayer2D'] },
    { label: 'Logic',     types: ['AnimationPlayer','AnimationPlayer','Timer'] },
  ];

  function buildPalette() {
    const pal = document.createElement('div');
    pal.id = 'sc-canvas-palette';

    const hdr = document.createElement('div');
    hdr.className = 'sc-pal-hdr';
    hdr.textContent = 'NODE PALETTE';
    pal.appendChild(hdr);

    const search = document.createElement('input');
    search.className = 'sc-pal-search';
    search.placeholder = 'Filter nodes...';
    search.setAttribute('autocomplete', 'off');
    pal.appendChild(search);

    const list = document.createElement('div');
    list.id = 'sc-pal-list';
    pal.appendChild(list);

    function renderPalette(filter) {
      list.innerHTML = '';
      PALETTE_GROUPS.forEach(group => {
        const types = filter
          ? group.types.filter(t => t.toLowerCase().includes(filter))
          : group.types;
        // dedupe
        const unique = [...new Set(types)];
        if (!unique.length) return;

        const grpLabel = document.createElement('div');
        grpLabel.className = 'sc-pal-group';
        grpLabel.textContent = group.label;
        list.appendChild(grpLabel);

        unique.forEach(type => {
          const item = document.createElement('div');
          item.className = 'sc-pal-item';
          item.setAttribute('draggable', 'true');
          item.setAttribute('data-node-type', type);
          const col = nodeColor(type);
          const ico = getNodeSVGIcon ? getNodeSVGIcon(type, 13) : '●';
          item.innerHTML = `
            <span class="sc-pal-dot" style="background:${col};box-shadow:0 0 6px ${col}44;"></span>
            <span class="sc-pal-ico">${ico}</span>
            <span class="sc-pal-name">${escHtml(type)}</span>`;
          item.title = `Drag to add ${type}`;

          item.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', type);
            e.dataTransfer.effectAllowed = 'copy';
            item.classList.add('sc-pal-item-dragging');
          });
          item.addEventListener('dragend', () => item.classList.remove('sc-pal-item-dragging'));

          list.appendChild(item);
        });
      });
    }

    renderPalette('');
    search.addEventListener('input', () => renderPalette(search.value.toLowerCase().trim()));

    return pal;
  }

  // ── drop nodes onto canvas ────────────────────────
  function setupPaletteDrop(vp, world, svgEl, scene) {
    if (!scene) return;
    vp.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    vp.addEventListener('drop', e => {
      e.preventDefault();
      const type = e.dataTransfer.getData('text/plain');
      if (!type) return;
      const rect = vp.getBoundingClientRect();
      const wp = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      const x = snapV(wp.x - NODE_W / 2);
      const y = snapV(wp.y - NODE_H / 2);

      // create node in scene data
      const node = makeNode(type, type, null);  // no parent by default
      scene.nodes[node.id] = node;

      // set canvas position
      const pos = getPos(_sceneId);
      pos[node.id] = { x, y };

      save();
      renderAllNodes(scene, world, svgEl);
      if (typeof renderNodeTree === 'function') renderNodeTree();
      toast('Added ' + type);
    });
  }

  // ── auto-layout nodes that have no position ───────
  function autoLayoutNewNodes(scene) {
    if (!scene) return;
    const pos = getPos(scene.id);
    const all = Object.keys(scene.nodes);

    // build a rough tree depth map
    function depth(nodeId, visited = new Set()) {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);
      const node = scene.nodes[nodeId];
      if (!node || !node.parentId) return 0;
      return 1 + depth(node.parentId, visited);
    }

    const placed = all.filter(id => pos[id]);
    const unplaced = all.filter(id => !pos[id]);

    let col = 0;
    unplaced.forEach((id, i) => {
      const d = depth(id);
      pos[id] = {
        x: snapV(80 + (placed.length + i) % 5 * (NODE_W + 60)),
        y: snapV(80 + d * (NODE_H + 80) + Math.floor((placed.length + i) / 5) * 40)
      };
    });
  }

  // ── render all nodes & connections ───────────────
  function renderAllNodes(scene, world, svgEl) {
    // clear existing nodes (keep svg)
    Array.from(world.children).forEach(c => {
      if (c !== svgEl) c.remove();
    });

    const pos = getPos(scene.id);

    Object.values(scene.nodes).forEach(node => {
      if (!pos[node.id]) pos[node.id] = { x: 80, y: 80 };
      const el = buildNodeCard(node, scene, world, svgEl);
      el.style.left = pos[node.id].x + 'px';
      el.style.top  = pos[node.id].y + 'px';
      world.appendChild(el);
    });

    redrawConnections(scene, svgEl, pos);
  }

  // ── single node card ─────────────────────────────
  function buildNodeCard(node, scene, world, svgEl) {
    const pos = getPos(scene.id);
    const col = nodeColor(node.type);
    const ico = getNodeSVGIcon ? getNodeSVGIcon(node.type, 14) : '●';
    const isRoot = node.id === scene.rootId;
    const hasScript = !!node.script;
    const childCount = (node.children || []).length;

    const card = document.createElement('div');
    card.className = 'sc-cvs-node' + (isRoot ? ' sc-cvs-node-root' : '');
    card.setAttribute('data-nid', node.id);
    card.style.cssText = `position:absolute;width:${NODE_W}px;z-index:10;--nc:${col};`;

    // ── header ──
    const hdr = document.createElement('div');
    hdr.className = 'sc-cvs-hdr';
    hdr.style.cssText = `border-top:2px solid ${col};`;

    // node icon + type badge
    const typeBadge = document.createElement('span');
    typeBadge.className = 'sc-cvs-type';
    typeBadge.innerHTML = ico;
    typeBadge.style.color = col;

    const nameEl = document.createElement('span');
    nameEl.className = 'sc-cvs-name';
    nameEl.textContent = node.name;
    nameEl.title = node.name + ' : ' + node.type;

    // script dot
    const scriptDot = document.createElement('span');
    scriptDot.className = 'sc-cvs-script-dot';
    scriptDot.title = hasScript ? 'Has script: ' + node.script.name : 'No script';
    scriptDot.style.background = hasScript ? col : 'var(--border)';

    // delete btn
    const delBtn = document.createElement('button');
    delBtn.className = 'sc-cvs-del';
    delBtn.title = isRoot ? 'Cannot delete root' : 'Delete node';
    delBtn.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    if (isRoot) delBtn.style.opacity = '0.2';
    delBtn.addEventListener('mousedown', e => e.stopPropagation());
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (isRoot) { toast('Cannot delete root node'); return; }
      openModal('Delete Node', `<p style="font-size:11px;color:var(--text2);">Delete <strong>${escHtml(node.name)}</strong> and all its children?</p>`, [
        { label: 'Cancel', action: closeModal },
        { label: 'Delete', cls: 'btn danger', action: () => {
          closeModal();
          deleteNodeRecursiveCanvas(node.id, scene);
          save();
          renderAllNodes(scene, world, svgEl);
          if (typeof renderNodeTree === 'function') renderNodeTree();
        }}
      ]);
    });

    hdr.appendChild(typeBadge);
    hdr.appendChild(nameEl);
    hdr.appendChild(scriptDot);
    hdr.appendChild(delBtn);
    card.appendChild(hdr);

    // ── body: type label + child count ──
    const body = document.createElement('div');
    body.className = 'sc-cvs-body';
    body.innerHTML = `<span class="sc-cvs-typestr" style="color:${col}aa;">${escHtml(node.type)}</span>
      ${childCount ? `<span class="sc-cvs-children-badge">${childCount} child${childCount > 1 ? 'ren' : ''}</span>` : ''}
      ${node.props?.node_id ? `<span class="sc-cvs-nid">#${escHtml(node.props.node_id)}</span>` : ''}`;
    card.appendChild(body);

    // ── child input port (top-left) ──
    const inPort = document.createElement('div');
    inPort.className = 'sc-cvs-port sc-cvs-port-in';
    inPort.title = 'Child input port';
    inPort.setAttribute('data-nid', node.id);
    inPort.setAttribute('data-port', 'in');
    inPort.style.borderColor = col;
    card.appendChild(inPort);

    // ── child output port (bottom-right) ──
    const outPort = document.createElement('div');
    outPort.className = 'sc-cvs-port sc-cvs-port-out';
    outPort.title = 'Drag to make child';
    outPort.setAttribute('data-nid', node.id);
    outPort.setAttribute('data-port', 'out');
    outPort.style.borderColor = col;
    outPort.style.background = col + '55';
    card.appendChild(outPort);

    // ── out-port drag to connect ──
    outPort.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      startConnectionDrag(node.id, e, world, svgEl, scene);
    });

    // ── in-port: accept drop ──
    inPort.addEventListener('mouseup', e => {
      if (!_conn) return;
      e.stopPropagation();
      finishConnection(_conn.fromId, node.id, scene, world, svgEl);
    });

    // ── click to select / inspect ──
    card.addEventListener('click', e => {
      if (e.target === delBtn || e.target.closest('.sc-cvs-port')) return;
      // sync selection to the main tree inspector
      if (typeof selectNode === 'function') {
        activeSceneId = scene.id;
        selectNode(node.id);
        // highlight
        document.querySelectorAll('.sc-cvs-node').forEach(n => n.classList.remove('sc-cvs-node-sel'));
        card.classList.add('sc-cvs-node-sel');
      }
    });

    // ── header drag to reposition ──
    hdr.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target === delBtn) return;
      e.preventDefault(); e.stopPropagation();
      const p = pos[node.id] || { x: 0, y: 0 };
      _drag = { nodeId: node.id, card, startX: e.clientX, startY: e.clientY, origX: p.x, origY: p.y, svgEl, scene, pos, world };
      card.style.zIndex = '60';
      document.body.style.userSelect = 'none';
    });

    return card;
  }

  // ── connection drawing ────────────────────────────
  const CONN_COLOR_PARENT = '#4af0a0'; // teal — parent end
  const CONN_COLOR_CHILD  = '#c84af0'; // purple — child end

  // ── port-point calculation ────────────────────────
  // Dynamic (perimeter-sliding): exit/entry slides to face nearest the other node
  function getPortPointsDynamic(pP, cP) {
    const pcx = pP.x + NODE_W / 2, pcy = pP.y + NODE_H / 2;
    const ccx = cP.x + NODE_W / 2, ccy = cP.y + NODE_H / 2;
    const dx = ccx - pcx, dy = ccy - pcy;
    const hw = NODE_W / 2, hh = NODE_H / 2;
    const horizontal = (Math.abs(dx) / hw) >= (Math.abs(dy) / hh);
    let x1, y1, x2, y2, face;
    if (horizontal) {
      if (dx >= 0) {
        face = 'right';
        const t = hw / (Math.abs(dx) || 1);
        y1 = Math.min(Math.max(pcy + dy * t, pP.y + 4), pP.y + NODE_H - 4);
        x1 = pP.x + NODE_W;
        y2 = Math.min(Math.max(ccy - dy * t, cP.y + 4), cP.y + NODE_H - 4);
        x2 = cP.x;
      } else {
        face = 'left';
        const t = hw / (Math.abs(dx) || 1);
        y1 = Math.min(Math.max(pcy + dy * t, pP.y + 4), pP.y + NODE_H - 4);
        x1 = pP.x;
        y2 = Math.min(Math.max(ccy - dy * t, cP.y + 4), cP.y + NODE_H - 4);
        x2 = cP.x + NODE_W;
      }
    } else {
      if (dy >= 0) {
        face = 'bottom';
        const t = hh / (Math.abs(dy) || 1);
        x1 = Math.min(Math.max(pcx + dx * t, pP.x + 4), pP.x + NODE_W - 4);
        y1 = pP.y + NODE_H;
        x2 = Math.min(Math.max(ccx - dx * t, cP.x + 4), cP.x + NODE_W - 4);
        y2 = cP.y;
      } else {
        face = 'top';
        const t = hh / (Math.abs(dy) || 1);
        x1 = Math.min(Math.max(pcx + dx * t, pP.x + 4), pP.x + NODE_W - 4);
        y1 = pP.y;
        x2 = Math.min(Math.max(ccx - dx * t, cP.x + 4), cP.x + NODE_W - 4);
        y2 = cP.y + NODE_H;
      }
    }
    return { x1, y1, x2, y2, face };
  }

  // Fixed: always exit right-center of parent, enter left-center of child
  function getPortPointsFixed(pP, cP) {
    return {
      x1: pP.x + NODE_W, y1: pP.y + NODE_H / 2,
      x2: cP.x,          y2: cP.y + NODE_H / 2,
      face: 'right'
    };
  }

  function getPortPoints(pP, cP) {
    return getSetting('dynPorts', true)
      ? getPortPointsDynamic(pP, cP)
      : getPortPointsFixed(pP, cP);
  }

  // ── smart obstacle-avoiding router ──────────────────
  // Proper orthogonal connector routing using a visibility-segment approach.
  // Strategy:
  //   1. Build a small set of candidate X-lanes and Y-lanes from node edges + margin
  //   2. Run Dijkstra with a TURN PENALTY so paths stay straight and clean
  //   3. Reconstruct only the CORNER waypoints (not every grid step)
  //   4. Smooth according to the chosen line style

  const ROUTE_MARGIN = 20;   // px clearance around nodes
  const TURN_PENALTY = 1200; // extra cost per direction change — keeps routes straight

  // True if the axis-aligned segment from (ax,ay)→(bx,by) clips any obstacle rect.
  // The segment must be strictly horizontal or vertical.
  function segmentHitsRect(ax, ay, bx, by, rects) {
    const lx = Math.min(ax, bx), rx = Math.max(ax, bx);
    const ly = Math.min(ay, by), ry = Math.max(ay, by);
    for (const r of rects) {
      // overlap check (shrink by 1px to allow touching edges)
      if (lx < r.r - 1 && rx > r.l + 1 && ly < r.b - 1 && ry > r.t + 1) return true;
    }
    return false;
  }

  function buildSmartPath(x1, y1, x2, y2, face, pos, skipIds) {
    const M = ROUTE_MARGIN;

    // Build obstacle rects (all nodes except the two connected ones)
    const obstacles = [];
    Object.keys(pos).forEach(id => {
      if (skipIds.has(id)) return;
      const p = pos[id];
      obstacles.push({ l: p.x - M, r: p.x + NODE_W + M, t: p.y - M, b: p.y + NODE_H + M });
    });

    // Candidate lanes: left/right edges of every obstacle + start/end coords
    const xSet = new Set([x1, x2]);
    const ySet = new Set([y1, y2]);
    for (const r of obstacles) {
      xSet.add(r.l); xSet.add(r.r);
      ySet.add(r.t); ySet.add(r.b);
    }
    const xs = [...xSet].sort((a, b) => a - b);
    const ys = [...ySet].sort((a, b) => a - b);

    const W = xs.length, H = ys.length;
    // node key: row * W + col
    const key = (c, r) => r * W + c;
    const col = v => xs.indexOf(v);
    const row = v => ys.indexOf(v);

    const sc = col(x1), sr = row(y1);
    const ec = col(x2), er = row(y2);
    if (sc < 0 || sr < 0 || ec < 0 || er < 0) return buildPath(x1, y1, x2, y2, face);

    // Dijkstra with turn penalty
    // State: (gridKey, lastDir)  lastDir: 0=none 1=H 2=V
    // We encode state as key*3 + dir
    const INF = 1e18;
    const N = W * H * 3;
    const dist  = new Float64Array(N).fill(INF);
    const prevS = new Int32Array(N).fill(-1);

    const startH = key(sc, sr) * 3 + 1; // pretend we came in horizontally
    const startV = key(sc, sr) * 3 + 2;
    dist[startH] = 0; dist[startV] = 0;

    // Min-heap via plain sorted insertions (grid is small, typically <200 nodes)
    // Use a flat array: [cost, state]
    const heap = [[0, startH], [0, startV]];
    function heapPop() {
      let bi = 0;
      for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
      const v = heap[bi]; heap.splice(bi, 1); return v;
    }

    // For each grid node, jump to every reachable node in the same row/col
    // (skip over obstacles). This gives clean long segments with no intermediate stops.
    function neighbors(c, r) {
      const nb = [];
      // right
      for (let nc = c + 1; nc < W; nc++) {
        if (segmentHitsRect(xs[c], ys[r], xs[nc], ys[r], obstacles)) break;
        nb.push({ c: nc, r, dir: 1, dist: xs[nc] - xs[c] });
      }
      // left
      for (let nc = c - 1; nc >= 0; nc--) {
        if (segmentHitsRect(xs[nc], ys[r], xs[c], ys[r], obstacles)) break;
        nb.push({ c: nc, r, dir: 1, dist: xs[c] - xs[nc] });
      }
      // down
      for (let nr = r + 1; nr < H; nr++) {
        if (segmentHitsRect(xs[c], ys[r], xs[c], ys[nr], obstacles)) break;
        nb.push({ c, r: nr, dir: 2, dist: ys[nr] - ys[r] });
      }
      // up
      for (let nr = r - 1; nr >= 0; nr--) {
        if (segmentHitsRect(xs[c], ys[nr], xs[c], ys[r], obstacles)) break;
        nb.push({ c, r: nr, dir: 2, dist: ys[r] - ys[nr] });
      }
      return nb;
    }

    let found = false;
    while (heap.length) {
      const [d, s] = heapPop();
      const dir = s % 3;
      const gk  = (s - dir) / 3;
      const r   = Math.floor(gk / W), c = gk % W;

      if (d > dist[s]) continue;
      if (c === ec && r === er) { found = true; break; }

      for (const nb of neighbors(c, r)) {
        const turn = (dir !== 0 && nb.dir !== dir) ? TURN_PENALTY : 0;
        const nd = d + nb.dist + turn;
        const nk = key(nb.c, nb.r);
        const ns = nk * 3 + nb.dir;
        if (nd < dist[ns]) {
          dist[ns] = nd;
          prevS[ns] = s;
          heap.push([nd, ns]);
        }
      }
    }

    if (!found) return buildPath(x1, y1, x2, y2, face);

    // Pick best arrival direction at end node
    const endBase = key(ec, er) * 3;
    let bestEnd = -1, bestDist = INF;
    for (let d = 1; d <= 2; d++) {
      if (dist[endBase + d] < bestDist) { bestDist = dist[endBase + d]; bestEnd = endBase + d; }
    }

    // Reconstruct — only corner points (where direction changes)
    const waypoints = [];
    let cur = bestEnd;
    while (cur !== -1) {
      const dir_ = cur % 3;
      const gk_  = (cur - dir_) / 3;
      const r_   = Math.floor(gk_ / W), c_ = gk_ % W;
      waypoints.unshift({ x: xs[c_], y: ys[r_] });
      const p = prevS[cur];
      if (p < 0) break;
      // Only add a waypoint when direction changes (i.e. it's a corner)
      const pdir = p % 3;
      if (pdir === dir_) {
        // same direction — skip intermediate, keep marching
        waypoints.shift(); // remove what we just added, we'll re-add the corner
        cur = p;
        // re-add current as corner placeholder — actually just continue
        waypoints.unshift({ x: xs[c_], y: ys[r_] });
      }
      cur = p;
    }

    // Deduplicate consecutive identical points
    const pts = [];
    for (const p of waypoints) {
      const last = pts[pts.length - 1];
      if (!last || Math.abs(last.x - p.x) > 0.5 || Math.abs(last.y - p.y) > 0.5) pts.push(p);
    }

    if (pts.length < 2) return buildPath(x1, y1, x2, y2, face);

    // Ensure start/end are exactly the port coords
    pts[0] = { x: x1, y: y1 };
    pts[pts.length - 1] = { x: x2, y: y2 };

    // Render waypoints according to line style
    return waypointsToPath(pts, face);
  }

  // Convert a list of waypoints to an SVG path string using current line style.
  function waypointsToPath(pts, face) {
    const style = getSetting('lineStyle', 'bezier');
    if (pts.length < 2) return `M${pts[0].x},${pts[0].y}`;

    if (style === 'straight') {
      return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
    }

    if (style === 'ortho') {
      // Rounded-corner ortho: short line segments with quadratic arcs at corners
      const R = 12; // corner radius
      if (pts.length === 2) {
        return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
      }
      let d = `M${pts[0].x},${pts[0].y}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i-1], b = pts[i], c = pts[i+1];
        // vector a→b and b→c
        const abLen = Math.hypot(b.x-a.x, b.y-a.y);
        const bcLen = Math.hypot(c.x-b.x, c.y-b.y);
        const r = Math.min(R, abLen / 2, bcLen / 2);
        const t1x = b.x - (b.x-a.x)/abLen * r;
        const t1y = b.y - (b.y-a.y)/abLen * r;
        const t2x = b.x + (c.x-b.x)/bcLen * r;
        const t2y = b.y + (c.y-b.y)/bcLen * r;
        d += ` L${t1x},${t1y} Q${b.x},${b.y} ${t2x},${t2y}`;
      }
      d += ` L${pts[pts.length-1].x},${pts[pts.length-1].y}`;
      return d;
    }

    if (style === 'arc') {
      let d = `M${pts[0].x},${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i-1], b = pts[i];
        const r = Math.max(Math.hypot(b.x-a.x, b.y-a.y) / 2, 20);
        d += ` A${r},${r} 0 0,1 ${b.x},${b.y}`;
      }
      return d;
    }

    // Bezier: Catmull-Rom spline through waypoints
    if (pts.length === 2) {
      return buildBezierPath(pts[0].x, pts[0].y, pts[1].x, pts[1].y, face);
    }
    const tension = 0.35;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i-1,0)];
      const p1 = pts[i];
      const p2 = pts[i+1];
      const p3 = pts[Math.min(i+2, pts.length-1)];
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

    // ── path builders by line style ───────────────────
  function buildPath(x1, y1, x2, y2, face) {
    const style = getSetting('lineStyle', 'bezier');
    if (style === 'straight') return buildStraightPath(x1, y1, x2, y2);
    if (style === 'ortho')    return buildOrthoPath(x1, y1, x2, y2, face);
    if (style === 'arc')      return buildArcPath(x1, y1, x2, y2);
    return buildBezierPath(x1, y1, x2, y2, face); // default
  }

  function buildBezierPath(x1, y1, x2, y2, face) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const cp = Math.max(dist * 0.42, 60);
    let cx1, cy1, cx2, cy2;
    switch (face) {
      case 'right':  cx1 = x1 + cp; cy1 = y1; cx2 = x2 - cp; cy2 = y2; break;
      case 'left':   cx1 = x1 - cp; cy1 = y1; cx2 = x2 + cp; cy2 = y2; break;
      case 'bottom': cx1 = x1; cy1 = y1 + cp; cx2 = x2; cy2 = y2 - cp; break;
      default:       cx1 = x1; cy1 = y1 - cp; cx2 = x2; cy2 = y2 + cp;
    }
    return `M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
  }

  function buildStraightPath(x1, y1, x2, y2) {
    return `M${x1},${y1} L${x2},${y2}`;
  }

  // Orthogonal (right-angle) routing: exit perpendicular to face, then elbow
  function buildOrthoPath(x1, y1, x2, y2, face) {
    const mid = (face === 'right' || face === 'left')
      ? (x1 + x2) / 2
      : (y1 + y2) / 2;
    if (face === 'right' || face === 'left') {
      // horizontal dominant: go to midpoint X, then vertical to target Y
      return `M${x1},${y1} L${mid},${y1} L${mid},${y2} L${x2},${y2}`;
    } else {
      // vertical dominant: go to midpoint Y, then horizontal to target X
      return `M${x1},${y1} L${x1},${mid} L${x2},${mid} L${x2},${y2}`;
    }
  }

  // Circular arc: single SVG arc sweep
  function buildArcPath(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return `M${x1},${y1} L${x2},${y2}`;
    // radius = half the distance, with a minimum
    const r = Math.max(dist / 2, 40);
    // large-arc=0, sweep=1 gives a gentle clockwise arc
    return `M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}`;
  }

  // ── SVG defs (markers) ────────────────────────────
  function addArrowDef(svg) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    function makeMarker(id, color) {
      const mk = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      mk.setAttribute('id', id);
      mk.setAttribute('markerWidth', '9'); mk.setAttribute('markerHeight', '9');
      mk.setAttribute('refX', '7'); mk.setAttribute('refY', '4');
      mk.setAttribute('orient', 'auto'); mk.setAttribute('markerUnits', 'userSpaceOnUse');
      const mp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      mp.setAttribute('d', 'M0,0 L0,8 L8,4 z');
      mp.setAttribute('fill', color); mp.setAttribute('opacity', '0.9');
      mk.appendChild(mp); defs.appendChild(mk);
    }
    makeMarker('sc-arrow-child', CONN_COLOR_CHILD);
    svg.appendChild(defs);
  }

  function redrawConnections(scene, svgEl, pos) {
    Array.from(svgEl.querySelectorAll('.sc-conn, .sc-conn-grad')).forEach(l => l.remove());
    const defs = svgEl.querySelector('defs');

    Object.values(scene.nodes).forEach(node => {
      (node.children || []).forEach(childId => {
        const child = scene.nodes[childId];
        if (!child) return;
        const pP = pos[node.id], cP = pos[childId];
        if (!pP || !cP) return;

        const { x1, y1, x2, y2, face } = getPortPoints(pP, cP);
        const skipIds = new Set([node.id, childId]);
        const d = getSetting('smartPath', false)
          ? buildSmartPath(x1, y1, x2, y2, face, pos, skipIds)
          : buildPath(x1, y1, x2, y2, face);

        // per-connection gradient
        const gradId = `scg_${node.id}_${childId}`.replace(/[^a-zA-Z0-9_]/g, '_');
        defs.querySelectorAll(`#${gradId}`).forEach(el => el.remove());
        const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        grad.setAttribute('id', gradId);
        grad.setAttribute('class', 'sc-conn-grad');
        grad.setAttribute('gradientUnits', 'userSpaceOnUse');
        grad.setAttribute('x1', x1); grad.setAttribute('y1', y1);
        grad.setAttribute('x2', x2); grad.setAttribute('y2', y2);
        const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', CONN_COLOR_PARENT);
        const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', CONN_COLOR_CHILD);
        grad.appendChild(s1); grad.appendChild(s2);
        defs.appendChild(grad);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'sc-conn');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', `url(#${gradId})`);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-opacity', '0.85');
        path.setAttribute('marker-end', 'url(#sc-arrow-child)');
        svgEl.appendChild(path);

        // wide invisible hit area for right-click disconnect
        const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hit.setAttribute('class', 'sc-conn');
        hit.setAttribute('d', d);
        hit.setAttribute('fill', 'none');
        hit.setAttribute('stroke', 'transparent');
        hit.setAttribute('stroke-width', '14');
        hit.style.pointerEvents = 'stroke';
        hit.style.cursor = 'pointer';
        hit.title = 'Right-click to disconnect';
        hit.addEventListener('contextmenu', e => {
          e.preventDefault(); e.stopPropagation();
          disconnectNodes(node.id, childId, scene, svgEl, pos);
        });
        svgEl.appendChild(hit);
      });
    });
  }

    // ── connection drag ──────────────────────────────
  function startConnectionDrag(fromId, e, world, svgEl, scene) {
    const pos = getPos(scene.id);
    const fp = pos[fromId]; if (!fp) return;
    const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempLine.setAttribute('fill', 'none');
    tempLine.setAttribute('stroke', CONN_COLOR_PARENT);
    tempLine.setAttribute('stroke-width', '2');
    tempLine.setAttribute('stroke-dasharray', '6,3');
    tempLine.setAttribute('stroke-opacity', '0.85');
    svgEl.style.pointerEvents = 'all';
    svgEl.style.cursor = 'crosshair';
    svgEl.appendChild(tempLine);
    _conn = { fromId, tempLine, scene, world, svgEl };

    const onMove = ev => {
      const vp = document.getElementById('sc-canvas-vp');
      const rect = vp.getBoundingClientRect();
      const wp = toWorld(ev.clientX - rect.left, ev.clientY - rect.top);
      const fakeCp = { x: wp.x - NODE_W / 2, y: wp.y - NODE_H / 2 };
      const { x1, y1, face } = getPortPoints(fp, fakeCp);

      const d_tmp = buildPath(x1, y1, wp.x, wp.y, face);
      tempLine.setAttribute('d', d_tmp);
    };
    const onUp = ev => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      svgEl.style.pointerEvents = 'none';
      svgEl.style.cursor = '';
      if (_conn) { tempLine.remove(); _conn = null; }
      redrawConnections(scene, svgEl, getPos(scene.id));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function finishConnection(fromId, toId, scene, world, svgEl) {
    if (!_conn) return;
    _conn.tempLine.remove();
    svgEl.style.pointerEvents = 'none';
    _conn = null;

    if (fromId === toId) return;
    // prevent circular
    if (isAncestor(toId, fromId, scene)) { toast('Cannot create circular parent'); return; }

    const parent = scene.nodes[fromId];
    const child  = scene.nodes[toId];
    if (!parent || !child) return;

    // remove child from its old parent
    if (child.parentId) {
      const oldParent = scene.nodes[child.parentId];
      if (oldParent) oldParent.children = (oldParent.children || []).filter(c => c !== toId);
    }

    if (!parent.children) parent.children = [];
    if (!parent.children.includes(toId)) parent.children.push(toId);
    child.parentId = fromId;

    save();
    renderAllNodes(scene, world, svgEl);
    if (typeof renderNodeTree === 'function') renderNodeTree();
    toast('Connected → ' + child.name + ' is now child of ' + parent.name);
  }

  function disconnectNodes(parentId, childId, scene, svgEl, pos) {
    const parent = scene.nodes[parentId];
    const child  = scene.nodes[childId];
    if (!parent || !child) return;
    parent.children = (parent.children || []).filter(c => c !== childId);
    child.parentId = null;
    save();
    redrawConnections(scene, svgEl, pos);
    if (typeof renderNodeTree === 'function') renderNodeTree();
    toast('Disconnected');
  }

  function isAncestor(potentialAncestor, nodeId, scene) {
    let cur = scene.nodes[nodeId];
    const visited = new Set();
    while (cur && cur.parentId) {
      if (visited.has(cur.id)) break;
      visited.add(cur.id);
      if (cur.parentId === potentialAncestor) return true;
      cur = scene.nodes[cur.parentId];
    }
    return false;
  }

  function deleteNodeRecursiveCanvas(nodeId, scene) {
    const node = scene.nodes[nodeId]; if (!node) return;
    (node.children || []).forEach(c => deleteNodeRecursiveCanvas(c, scene));
    Object.values(scene.nodes).forEach(n => {
      if (n.children) n.children = n.children.filter(c => c !== nodeId);
    });
    const pos = getPos(scene.id);
    delete pos[nodeId];
    delete scene.nodes[nodeId];
  }

  // ── pan ──────────────────────────────────────────
  function setupPan(vp, world) {
    vp.addEventListener('mousedown', e => {
      if (e.target !== vp && e.target !== world) return;
      if (e.button !== 0) return;
      e.preventDefault();
      _pan = { startX: e.clientX, startY: e.clientY, origOX: _ox, origOY: _oy };
      vp.style.cursor = 'grabbing';
    });
  }

  function setupZoom(vp, world) {
    vp.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, _scale * (1 + (-e.deltaY * 0.001))));
      _ox = mx - (ns / _scale) * (mx - _ox);
      _oy = my - (ns / _scale) * (my - _oy);
      _scale = ns;
      applyTransform(world);
    }, { passive: false });
  }

  // ── global mouse handlers ────────────────────────
  document.addEventListener('mousemove', e => {
    if (_drag) {
      const dx = (e.clientX - _drag.startX) / _scale;
      const dy = (e.clientY - _drag.startY) / _scale;
      const nx = snapV(_drag.origX + dx);
      const ny = snapV(_drag.origY + dy);
      _drag.card.style.left = nx + 'px';
      _drag.card.style.top  = ny + 'px';
      _drag.pos[_drag.nodeId] = { x: nx, y: ny };
      redrawConnections(_drag.scene, _drag.svgEl, _drag.pos);
    }
    if (_pan) {
      _ox = _pan.origOX + (e.clientX - _pan.startX);
      _oy = _pan.origOY + (e.clientY - _pan.startY);
      const world = document.getElementById('sc-canvas-world');
      if (world) applyTransform(world);
    }
  });

  document.addEventListener('mouseup', () => {
    if (_drag) {
      _drag.card.style.zIndex = '10';
      save();
      _drag = null;
      document.body.style.userSelect = '';
      // keep list view in sync
      if (typeof renderNodeTree === 'function') renderNodeTree();
      if (typeof renderSceneFileTree === 'function') renderSceneFileTree();
    }
    if (_pan) {
      const vp = document.getElementById('sc-canvas-vp');
      if (vp) vp.style.cursor = '';
      _pan = null;
    }
  });

  // ── public API ───────────────────────────────────
  window.openSceneCanvas = function (sceneId) {
    // Switch to canvas page and init
    const container = document.getElementById('canvas-container');
    if (!container) return;
    // make sure canvas page is visible
    document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
    const pg = document.getElementById('page-canvas');
    if (pg) { pg.style.display = 'flex'; pg.classList.add('active'); }
    // update nav active state
    document.querySelectorAll('.nav-item,.nav-subitem').forEach(n => n.classList.remove('active'));
    const ni = document.getElementById('navitem-canvas');
    if (ni) ni.classList.add('active');
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = 'Canvas Mode';
    initSceneCanvas(sceneId);
  };

  window.scCanvasResetView = function () {
    _scale = 1; _ox = 0; _oy = 0;
    const world = document.getElementById('sc-canvas-world');
    if (world) applyTransform(world);
  };

  window.scCanvasAutoLayout = function () {
    const scene = (D.scenes || []).find(s => s.id === _sceneId);
    if (!scene) return;
    const pos = getPos(_sceneId);
    // tree layout: BFS from root
    const visited = new Set();
    const levels = [];
    function bfs(nodeId, level) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      if (!levels[level]) levels[level] = [];
      levels[level].push(nodeId);
      const node = scene.nodes[nodeId];
      (node?.children || []).forEach(c => bfs(c, level + 1));
    }
    bfs(scene.rootId, 0);
    // also place orphans (no parent, not root)
    Object.keys(scene.nodes).forEach(id => {
      if (!visited.has(id)) { if (!levels[0]) levels[0] = []; levels[99] ? levels[99].push(id) : levels.push([id]); }
    });
    levels.forEach((ids, lvl) => {
      ids.forEach((id, i) => {
        pos[id] = { x: snapV(80 + lvl * (NODE_W + 100)), y: snapV(60 + i * (NODE_H + 60)) };
      });
    });
    save();
    const world = document.getElementById('sc-canvas-world');
    const svgEl = document.getElementById('sc-canvas-svg');
    if (world && svgEl) renderAllNodes(scene, world, svgEl);
    if (typeof renderNodeTree === 'function') renderNodeTree();
    toast('Auto-arranged tree layout');
  };

  window.scCanvasSetLineStyle = function (style) {
    setSetting('lineStyle', style);
    // update active button states
    document.querySelectorAll('.sc-line-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.linestyle === style);
    });
    // redraw
    const scene = (D.scenes || []).find(s => s.id === _sceneId);
    const svgEl = document.getElementById('sc-canvas-svg');
    if (scene && svgEl) redrawConnections(scene, svgEl, getPos(_sceneId));
  };

  window.scCanvasToggleDynPorts = function () {
    const cur = getSetting('dynPorts', true);
    setSetting('dynPorts', !cur);
    const btn = document.getElementById('sc-dynports-btn');
    if (btn) btn.classList.toggle('active', !cur);
    // redraw connections with new port style
    const scene = (D.scenes || []).find(s => s.id === _sceneId);
    const svgEl = document.getElementById('sc-canvas-svg');
    if (scene && svgEl) redrawConnections(scene, svgEl, getPos(_sceneId));
  };

  window.scCanvasToggleSmartPath = function () {
    const cur = getSetting('smartPath', false);
    setSetting('smartPath', !cur);
    const btn = document.getElementById('sc-smartpath-btn');
    if (btn) btn.classList.toggle('active', !cur);
    const scene = (D.scenes || []).find(s => s.id === _sceneId);
    const svgEl = document.getElementById('sc-canvas-svg');
    if (scene && svgEl) redrawConnections(scene, svgEl, getPos(_sceneId));
    toast((!cur ? 'Smart Path ON' : 'Smart Path OFF') + ' — lines route around nodes');
  };

  window.scCanvasBack = function () {
    // switch back to scene-tree page
    if (typeof nav === 'function') nav('scene-tree');
  };

  // expose so scene.js can call it from scene file list
  window.initSceneCanvas = initSceneCanvas;

})();
