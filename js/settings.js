// LMS Dev Hub — settings.js
// ========================================

// =====================================================
// SETTINGS
// =====================================================
function loadSettings(){
  try{const s=localStorage.getItem(SETTINGS_SK);if(s)SETTINGS={...SETTINGS,...JSON.parse(s)};}catch(e){}
  // Reapply custom theme CSS vars if needed
  if(SETTINGS.customTheme && SETTINGS.theme==='custom'){
    applyCustomThemeCssVars(SETTINGS.customTheme);
  }
  applySettings();
}
function saveSettings(){try{localStorage.setItem(SETTINGS_SK,JSON.stringify(SETTINGS));}catch(e){}}

function applySettings(){
  document.documentElement.setAttribute('data-theme',SETTINGS.theme||'');
  document.documentElement.setAttribute('data-font',SETTINGS.font||'mono');
  document.documentElement.setAttribute('data-layout',SETTINGS.layout||'');
  document.documentElement.setAttribute('data-nav-pos',SETTINGS.navPos||'left');
  if(SETTINGS.accentOverridden && SETTINGS.accent){
    document.documentElement.style.setProperty('--accent',SETTINGS.accent);
  } else {
    document.documentElement.style.removeProperty('--accent');
  }
  // Sidebar width
  if(SETTINGS.sidebarWidth&&!SETTINGS.compact){
    document.documentElement.style.setProperty('--sidebar',SETTINGS.sidebarWidth+'px');
  }
  document.getElementById('scanline-overlay').style.display=SETTINGS.scanlines?'block':'none';
  const compactW=SETTINGS.compact?'170px':(SETTINGS.sidebarWidth?SETTINGS.sidebarWidth+'px':'220px');
  document.documentElement.style.setProperty('--sidebar',compactW);
  document.querySelectorAll('.theme-btn').forEach(b=>b.classList.toggle('active',b.dataset.t===(SETTINGS.theme||'')));
  document.querySelectorAll('.font-btn').forEach(b=>b.classList.toggle('active',b.dataset.f===(SETTINGS.font||'mono')));
  document.querySelectorAll('.layout-btn').forEach(b=>b.classList.toggle('active',b.dataset.l===(SETTINGS.layout||'')));
  document.querySelectorAll('.nav-pos-btn').forEach(b=>b.classList.toggle('active',b.dataset.p===(SETTINGS.navPos||'left')));
  const ap=document.getElementById('accent-color-pick');if(ap)ap.value=SETTINGS.accent||'#c8f04a';
  const ts=document.getElementById('toggle-scanlines');if(ts)ts.classList.toggle('on',SETTINGS.scanlines);
  const tc=document.getElementById('toggle-compact');if(tc)tc.classList.toggle('on',SETTINGS.compact);
  // Update v2 theme grid active states
  document.querySelectorAll('.theme-btn-v2').forEach(b=>b.classList.toggle('active',b.dataset.t===(SETTINGS.theme||'')));
  // Apply cards per row
  applyCardsPerRow();
  // Card animations
  const style=document.getElementById('lms-dyn-styles')||document.createElement('style');
  style.id='lms-dyn-styles';
  if(SETTINGS.animateCards===false){style.textContent='.root-card{animation:none!important;}';}
  else{style.textContent='';}
  if(!style.parentNode)document.head.appendChild(style);
}

function setTheme(t){SETTINGS.theme=t;saveSettings();applySettings();}
function setAccent(v){SETTINGS.accent=v;SETTINGS.accentOverridden=true;saveSettings();applySettings();}
function clearAccentOverride(){SETTINGS.accentOverridden=false;saveSettings();applySettings();}
function toggleScanlines(el){SETTINGS.scanlines=!SETTINGS.scanlines;saveSettings();applySettings();}
function toggleCompact(el){SETTINGS.compact=!SETTINGS.compact;saveSettings();applySettings();}
function setFont(f){SETTINGS.font=f;saveSettings();applySettings();}
function setLayout(l){SETTINGS.layout=l;saveSettings();applySettings();}
function setNavPos(p){if(p==='top'||p==='bottom')p='left';SETTINGS.navPos=p;saveSettings();applySettings();}

// =====================================================
// THEME GRID RENDERER (swatch cards)
// =====================================================
function renderThemeGrid(){
  function makeBtn(def, containerId){
    const cont = document.getElementById(containerId);
    if(!cont) return;
    const btn = document.createElement('button');
    btn.className = 'theme-btn-v2' + ((SETTINGS.theme||'')=== def.id ? ' active' : '');
    btn.dataset.t = def.id;
    btn.onclick = ()=>{ setTheme(def.id); document.querySelectorAll('.theme-btn-v2').forEach(b=>b.classList.toggle('active',b.dataset.t===def.id)); };
    btn.innerHTML = `<div class="tbv2-swatches">
      <div class="tbv2-swatch" style="background:${def.bg};flex:2;"></div>
      <div class="tbv2-swatch" style="background:${def.bg2};flex:1;"></div>
      <div class="tbv2-swatch" style="background:${def.accent};flex:1;"></div>
      <div class="tbv2-swatch" style="background:${def.accent2};flex:1;"></div>
      <div class="tbv2-swatch" style="background:${def.accent3};flex:1;"></div>
    </div><div class="tbv2-label">${def.label}</div>`;
    cont.appendChild(btn);
  }
  const gd=document.getElementById('theme-grid');
  const gl=document.getElementById('theme-grid-light');
  const gb=document.getElementById('theme-grid-brand');
  if(gd) gd.innerHTML='';
  if(gl) gl.innerHTML='';
  if(gb) gb.innerHTML='';
  THEME_DEFS.dark.forEach(d=>makeBtn(d,'theme-grid'));
  // Custom theme entry
  if(document.getElementById('theme-grid')){
    const btn=document.createElement('button');
    btn.className='theme-btn-v2'+((SETTINGS.theme||'')==='custom'?' active':'');
    btn.dataset.t='custom';
    btn.onclick=()=>{if(SETTINGS.customTheme){setTheme('custom');document.querySelectorAll('.theme-btn-v2').forEach(b=>b.classList.toggle('active',b.dataset.t==='custom'));}else{toast('Build a custom theme first');}};
    const ct=SETTINGS.customTheme||{bg:'#07080d',accent:'#c8f04a',accent2:'#4af0c8',accent3:'#f0504a'};
    btn.innerHTML=`<div class="tbv2-swatches">
      <div class="tbv2-swatch" style="background:${ct.bg||'#07080d'};flex:2;"></div>
      <div class="tbv2-swatch" style="background:${ct.accent||'#c8f04a'};flex:1;"></div>
      <div class="tbv2-swatch" style="background:${ct.accent2||'#4af0c8'};flex:1;"></div>
      <div class="tbv2-swatch" style="background:${ct.accent3||'#f0504a'};flex:1;"></div>
      <div class="tbv2-swatch" style="background:linear-gradient(135deg,#888,#444);flex:1;"></div>
    </div><div class="tbv2-label"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="display:inline-block;vertical-align:middle;margin-right:4px;"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/></svg>Custom</div>`;
    document.getElementById('theme-grid').appendChild(btn);
  }
  THEME_DEFS.light.forEach(d=>makeBtn(d,'theme-grid-light'));
  THEME_DEFS.brand.forEach(d=>makeBtn(d,'theme-grid-brand'));
}

// =====================================================
// CUSTOM THEME BUILDER
// =====================================================
const CT_VARS=['bg','bg2','bg3','bg4','inp-bg','border','border2','text','text2','text3','accent','accent2','accent3','accent4','accent5','accent6','icon-hi','icon-mid','icon-dim'];

function getCustomThemeFromPickers(){
  const ct={};
  CT_VARS.forEach(k=>{
    const el=document.getElementById('ct-'+k);
    if(el) ct[k]=el.value;
  });
  // Capture icon accent pickers (stored separately from CT_VARS)
  const hi=document.getElementById('ct-icon-hi');
  const mid=document.getElementById('ct-icon-mid');
  const dim=document.getElementById('ct-icon-dim');
  if(hi) ct['icon-hi']=hi.value;
  if(mid) ct['icon-mid']=mid.value;
  if(dim) ct['icon-dim']=dim.value;
  return ct;
}

function applyCustomThemeCssVars(ct){
  if(!ct) return;
  Object.entries(ct).forEach(([k,v])=>{
    document.documentElement.style.setProperty('--ct-'+k, v);
  });
  if(typeof applyIconAccentVars==='function') applyIconAccentVars(ct);
}

function previewCustomTheme(){
  const ct=getCustomThemeFromPickers();
  applyCustomThemeCssVars(ct);
  // Update the live swatch row
  const sw=document.getElementById('ct-accent-swatches');
  if(sw){
    sw.innerHTML=['accent','accent2','accent3','accent4','accent5','accent6'].map(k=>
      `<div style="width:14px;height:14px;border-radius:2px;background:${ct[k]||'#888'};title=${k}"></div>`
    ).join('');
  }
}

function applyCustomTheme(){
  const ct=getCustomThemeFromPickers();
  SETTINGS.customTheme=ct;
  applyCustomThemeCssVars(ct);
  setTheme('custom');
  renderThemeGrid();
  toast('Custom theme applied');
}

function saveCustomTheme(){
  const name=(document.getElementById('ct-save-name')?.value||'').trim()||('Custom '+Date.now());
  const ct=getCustomThemeFromPickers();
  let saved=[];
  try{const s=localStorage.getItem(SAVED_THEMES_SK);if(s)saved=JSON.parse(s);}catch(e){}
  saved.push({id:'ct_'+Date.now(), name, theme:ct});
  try{localStorage.setItem(SAVED_THEMES_SK,JSON.stringify(saved));}catch(e){}
  renderSavedThemes();
  const inp=document.getElementById('ct-save-name');if(inp)inp.value='';
  toast('Theme "'+name+'" saved');
}

function loadSavedThemesFromStorage(){
  try{const s=localStorage.getItem(SAVED_THEMES_SK);return s?JSON.parse(s):[];}catch(e){return[];}
}

function renderSavedThemes(){
  const list=document.getElementById('saved-themes-list');
  if(!list) return;
  const saved=loadSavedThemesFromStorage();
  if(!saved.length){list.innerHTML='<div style="font-size:10px;color:var(--text3);text-align:center;padding:12px 0;">No saved themes yet</div>';return;}
  list.innerHTML='';
  saved.forEach(s=>{
    const row=document.createElement('div');
    row.className='saved-theme-row'+(SETTINGS.theme==='custom'&&JSON.stringify(SETTINGS.customTheme)===JSON.stringify(s.theme)?' active-saved':'');
    const swatches=['accent','accent2','accent3','bg'].map(k=>`<div class="saved-theme-swatch" style="background:${s.theme[k]||'#888'};"></div>`).join('');
    row.innerHTML=`<div class="saved-theme-swatches">${swatches}</div><div class="saved-theme-name">${s.name}</div><button class="saved-theme-del" onclick="event.stopPropagation();deleteSavedTheme('${s.id}')"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="display:inline-block;vertical-align:middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
    row.onclick=()=>loadSavedTheme(s);
    list.appendChild(row);
  });
}

function loadSavedTheme(s){
  // Populate pickers
  CT_VARS.forEach(k=>{
    const el=document.getElementById('ct-'+k);
    if(el&&s.theme[k]) el.value=s.theme[k];
  });
  // Restore icon pickers (with fallback for themes saved before icon-hi/mid/dim existed)
  const hi=document.getElementById('ct-icon-hi');
  const mid=document.getElementById('ct-icon-mid');
  const dim=document.getElementById('ct-icon-dim');
  if(hi) hi.value=s.theme['icon-hi']||s.theme.accent||'#c8f04a';
  if(mid) mid.value=s.theme['icon-mid']||s.theme.accent2||'#4af0c8';
  if(dim) dim.value=s.theme['icon-dim']||s.theme.text3||'#4a5278';
  SETTINGS.customTheme=s.theme;
  applyCustomThemeCssVars(s.theme);
  setTheme('custom');
  renderThemeGrid();
  renderSavedThemes();
  previewCustomTheme();
  toast('Loaded: '+s.name);
}

function deleteSavedTheme(id){
  let saved=loadSavedThemesFromStorage();
  saved=saved.filter(s=>s.id!==id);
  try{localStorage.setItem(SAVED_THEMES_SK,JSON.stringify(saved));}catch(e){}
  renderSavedThemes();
}

function clearAllSavedThemes(){
  if(!confirm('Delete all saved themes?')) return;
  try{localStorage.removeItem(SAVED_THEMES_SK);}catch(e){}
  renderSavedThemes();
}

function exportCustomTheme(){
  const ct=getCustomThemeFromPickers();
  const name=(document.getElementById('ct-save-name')?.value||'custom-theme').trim();
  const blob=new Blob([JSON.stringify({name,theme:ct},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name.replace(/\s+/g,'-')+'.json';a.click();
}

// Sync pickers to current custom theme values when settings page opens
function syncCustomThemePickers(){
  if(SETTINGS.customTheme){
    CT_VARS.forEach(k=>{
      const el=document.getElementById('ct-'+k);
      if(el&&SETTINGS.customTheme[k]) el.value=SETTINGS.customTheme[k];
    });
    // Sync icon pickers too
    const hi=document.getElementById('ct-icon-hi');
    const mid=document.getElementById('ct-icon-mid');
    const dim=document.getElementById('ct-icon-dim');
    if(hi&&SETTINGS.customTheme['icon-hi']) hi.value=SETTINGS.customTheme['icon-hi'];
    if(mid&&SETTINGS.customTheme['icon-mid']) mid.value=SETTINGS.customTheme['icon-mid'];
    if(dim&&SETTINGS.customTheme['icon-dim']) dim.value=SETTINGS.customTheme['icon-dim'];
    previewCustomTheme();
  }
  renderSavedThemes();
  renderPresetGrid();
}

// =====================================================
// PALETTE IMPORTER
// =====================================================
function handlePaletteFile(ev){
  const file=ev.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(data.theme){
        // It's a saved theme file
        CT_VARS.forEach(k=>{const el=document.getElementById('ct-'+k);if(el&&data.theme[k])el.value=data.theme[k];});
        previewCustomTheme();
        const nameInp=document.getElementById('palette-import-name');if(nameInp)nameInp.value=data.name||file.name.replace('.json','');
        showPalettePreview(Object.values(data.theme).filter(v=>v&&v.startsWith('#')));
        toast('Theme file loaded — click Apply or Save');
      } else {
        // Try to extract colors from arbitrary JSON
        const colors=extractColorsFromJson(data);
        if(colors.length){loadColorsIntoPalettePicker(colors);}
        else{toast('No recognizable colors in file');}
      }
    }catch(err){toast('Could not parse JSON file');}
  };
  reader.readAsText(file);
  ev.target.value='';
}

function handlePaletteDrop(ev){
  ev.preventDefault();
  document.getElementById('palette-drop-zone').classList.remove('drag-over');
  const file=ev.dataTransfer.files[0];
  if(!file) return;
  const inp=document.getElementById('palette-file-inp');
  // Simulate file selection via DataTransfer
  const dt=new DataTransfer();dt.items.add(file);inp.files=dt.files;
  handlePaletteFile({target:inp});
}

function extractColorsFromJson(obj, found=[]){
  if(typeof obj==='string'&&/^#[0-9a-fA-F]{3,8}$/.test(obj)){found.push(obj);}
  else if(typeof obj==='object'&&obj!==null){Object.values(obj).forEach(v=>extractColorsFromJson(v,found));}
  return [...new Set(found)];
}

function loadColorsIntoPalettePicker(colors){
  const ta=document.getElementById('palette-paste-inp');
  if(ta){ta.value=colors.join('\n');previewPastedPalette();}
}

function previewPastedPalette(){
  const raw=(document.getElementById('palette-paste-inp')?.value||'');
  const colors=parseHexList(raw);
  showPalettePreview(colors);
}

function parseHexList(raw){
  return raw.split(/[\n,\s]+/).map(s=>s.trim()).filter(s=>/^#[0-9a-fA-F]{3,8}$/.test(s));
}

function showPalettePreview(colors){
  const bar=document.getElementById('palette-preview-bar');
  const sw=document.getElementById('palette-preview-swatches');
  if(!bar||!sw) return;
  if(!colors.length){bar.style.display='none';return;}
  bar.style.display='block';
  sw.innerHTML=colors.map(c=>`<div style="width:20px;height:20px;border-radius:2px;background:${c};border:1px solid rgba(255,255,255,.1);" title="${c}"></div>`).join('');
}

function applyPastedPalette(){
  const raw=(document.getElementById('palette-paste-inp')?.value||'');
  const colors=parseHexList(raw);
  if(colors.length<2){toast('Need at least 2 hex colors');return;}
  // Map colors intelligently: sort by luminance
  const sorted=[...colors].sort((a,b)=>luminance(a)-luminance(b));
  const darkest=sorted.slice(0,Math.min(5,Math.ceil(sorted.length*0.4)));
  const lightest=sorted.slice(sorted.length-Math.max(1,Math.ceil(sorted.length*0.2)));
  const mids=sorted.slice(darkest.length, sorted.length-lightest.length);
  const ct={
    'bg':       darkest[0]||colors[0],
    'bg2':      darkest[1]||colors[0],
    'bg3':      darkest[2]||colors[1]||colors[0],
    'bg4':      darkest[3]||colors[1]||colors[0],
    'inp-bg':   darkest[0]||colors[0],
    'border':   mids[0]||darkest[darkest.length-1]||colors[0],
    'border2':  mids[1]||mids[0]||darkest[darkest.length-1]||colors[0],
    'text':     lightest[lightest.length-1]||colors[colors.length-1],
    'text2':    lightest[lightest.length-2]||lightest[0]||colors[colors.length-1],
    'text3':    mids[mids.length-1]||colors[Math.floor(colors.length/2)],
    'accent':   mids[0]||colors[Math.floor(colors.length/2)],
    'accent2':  mids[1]||mids[0]||colors[Math.floor(colors.length/2)],
    'accent3':  mids[2]||mids[0]||colors[Math.floor(colors.length/2)],
    'accent4':  mids[3]||mids[0]||colors[Math.floor(colors.length/2)],
    'accent5':  mids[4]||mids[0]||colors[Math.floor(colors.length/2)],
    'accent6':  mids[5]||mids[0]||colors[Math.floor(colors.length/2)],
  };
  CT_VARS.forEach(k=>{const el=document.getElementById('ct-'+k);if(el&&ct[k])el.value=ct[k];});
  // Also auto-set icon accent pickers from the derived accent colours
  const hi=document.getElementById('ct-icon-hi');
  const mid=document.getElementById('ct-icon-mid');
  const dim=document.getElementById('ct-icon-dim');
  if(hi) hi.value=ct.accent||'#c8f04a';
  if(mid) mid.value=ct.accent2||'#4af0c8';
  if(dim) dim.value=ct.text3||'#4a5278';
  ct['icon-hi']=ct.accent||'#c8f04a';
  ct['icon-mid']=ct.accent2||'#4af0c8';
  ct['icon-dim']=ct.text3||'#4a5278';
  applyCustomThemeCssVars(ct);
  SETTINGS.customTheme=ct;
  previewCustomTheme();
  setTheme('custom');
  renderThemeGrid();
  toast('Palette applied as custom theme');
}

function savePastedPalette(){
  const raw=(document.getElementById('palette-paste-inp')?.value||'');
  const colors=parseHexList(raw);
  if(colors.length<2){toast('Need at least 2 hex colors');return;}
  applyPastedPalette();
  const name=(document.getElementById('palette-import-name')?.value||'').trim()||('Imported '+Date.now());
  const ct=getCustomThemeFromPickers();
  let saved=loadSavedThemesFromStorage();
  saved.push({id:'ct_'+Date.now(), name, theme:ct});
  try{localStorage.setItem(SAVED_THEMES_SK,JSON.stringify(saved));}catch(e){}
  renderSavedThemes();
  toast('Saved: '+name);
}

function luminance(hex){
  const r=parseInt(hex.slice(1,3),16)/255;
  const g=parseInt(hex.slice(3,5),16)/255;
  const b=parseInt(hex.slice(5,7),16)/255;
  return 0.2126*r+0.7152*g+0.0722*b;
}

// =====================================================
// ICON ACCENT PICKERS — applies immediately to whole app
// regardless of which theme is active
// =====================================================
function applyIconAccentVarsFromPickers(){
  const hi=document.getElementById('ct-icon-hi');
  const mid=document.getElementById('ct-icon-mid');
  const dim=document.getElementById('ct-icon-dim');
  const root=document.documentElement;
  if(hi&&hi.value)  root.style.setProperty('--icon-hi',  hi.value);
  if(mid&&mid.value) root.style.setProperty('--icon-mid', mid.value);
  if(dim&&dim.value) root.style.setProperty('--icon-dim', dim.value);
  // Also update the little indicator svgs in the pickers themselves
  document.querySelectorAll('[fill="var(--icon-hi)"]').forEach(el=>el.setAttribute('fill',hi?.value||'var(--icon-hi)'));
  document.querySelectorAll('[fill="var(--icon-mid)"]').forEach(el=>el.setAttribute('fill',mid?.value||'var(--icon-mid)'));
  document.querySelectorAll('[fill="var(--icon-dim)"]').forEach(el=>el.setAttribute('fill',dim?.value||'var(--icon-dim)'));
}

// =====================================================
// PRESET THEME GRID — load any preset as custom base
// =====================================================
// Full colour data for all presets (mirrors themes.css)
const PRESET_FULL = {
  '':{bg:'#07080d',bg2:'#0d0f18',bg3:'#131622',bg4:'#191d2e','inp-bg':'#07080d',border:'#1f2438',border2:'#2e354f',text:'#d4d8f0',text2:'#8892b8',text3:'#4a5278',accent:'#c8f04a',accent2:'#4af0c8',accent3:'#f0504a',accent4:'#f0a84a',accent5:'#a04af0',accent6:'#4a9af0'},
  slate:{bg:'#090c14',bg2:'#101520',bg3:'#171e2e',bg4:'#1e273c','inp-bg':'#070a10',border:'#242e44',border2:'#334158',text:'#c8d4e8',text2:'#7888aa',text3:'#445068',accent:'#60a0f8',accent2:'#9060f0',accent3:'#f05060',accent4:'#f0b040',accent5:'#40d0b0',accent6:'#e060c0'},
  midnight:{bg:'#0c0c0e',bg2:'#141416',bg3:'#1c1c20',bg4:'#24242a','inp-bg':'#090910',border:'#2a2a34',border2:'#3c3c4e',text:'#e4e0f4',text2:'#9088c0',text3:'#554e80',accent:'#e040c0',accent2:'#f0c040',accent3:'#f04060',accent4:'#40d0a0',accent5:'#4080f0',accent6:'#c840f0'},
  abyss:{bg:'#060608',bg2:'#0c0c10',bg3:'#121218',bg4:'#181820','inp-bg':'#040406',border:'#1e1e28',border2:'#2c2c40',text:'#e8e0d8',text2:'#a09488',text3:'#605850',accent:'#ff6b6b',accent2:'#4ecdc4',accent3:'#ffe66d',accent4:'#a29bfe',accent5:'#fd79a8',accent6:'#55efc4'},
  forest:{bg:'#060d08',bg2:'#0c160e',bg3:'#121e14',bg4:'#18281a','inp-bg':'#040a06',border:'#1e3020',border2:'#2c4830',text:'#c4dcc8',text2:'#7aaa80',text3:'#3a6040',accent:'#80e840',accent2:'#f0cc40',accent3:'#f04048',accent4:'#40d8c0',accent5:'#d040c0',accent6:'#4098f0'},
  ember:{bg:'#0e0804',bg2:'#180e06',bg3:'#22140a',bg4:'#2c1c0e','inp-bg':'#0a0602',border:'#38240e',border2:'#543618',text:'#f0dcc0',text2:'#c09060',text3:'#805838',accent:'#ff8c20',accent2:'#ffd040',accent3:'#ff4040',accent4:'#40d8a0',accent5:'#a040e0',accent6:'#40a8f0'},
  void:{bg:'#060408',bg2:'#0e080f',bg3:'#160c18',bg4:'#1e1022','inp-bg':'#040206',border:'#2a1438',border2:'#401e54',text:'#d8c4f0',text2:'#9870c8',text3:'#604880',accent:'#b060f8',accent2:'#f040a0',accent3:'#f04040',accent4:'#f0c040',accent5:'#40c8f0',accent6:'#80f040'},
  steel:{bg:'#080c10',bg2:'#101520',bg3:'#182030',bg4:'#202c3e','inp-bg':'#060a0e',border:'#28384e',border2:'#3a5068',text:'#c8d8e8',text2:'#7898b8',text3:'#445870',accent:'#38b8e8',accent2:'#ff8040',accent3:'#f04050',accent4:'#f0d040',accent5:'#8040e0',accent6:'#40e0a0'},
  matrix:{bg:'#010800',bg2:'#021200',bg3:'#041c02',bg4:'#062804','inp-bg':'#010600',border:'#0a3208',border2:'#145010',text:'#20f060',text2:'#10a040',text3:'#0a6028',accent:'#00ff80',accent2:'#aaff00',accent3:'#ff4040',accent4:'#ffdd00',accent5:'#00ccff',accent6:'#ff80ff'},
  sakura:{bg:'#0c0610',bg2:'#160c1e',bg3:'#1e1228',bg4:'#261832','inp-bg':'#0a040e',border:'#321c40',border2:'#4e2a5e',text:'#f4d0f0',text2:'#d080c0',text3:'#904880',accent:'#ff50c0',accent2:'#d060ff',accent3:'#ff5050',accent4:'#ffd060',accent5:'#50d0ff',accent6:'#50ffa0'},
  solar:{bg:'#0e0800',bg2:'#180e00',bg3:'#221600',bg4:'#2c1e00','inp-bg':'#0a0600',border:'#402c00',border2:'#604400',text:'#fff4c0',text2:'#e8c840',text3:'#a08820',accent:'#ffd000',accent2:'#ff7800',accent3:'#ff3838',accent4:'#38d8b0',accent5:'#8038e0',accent6:'#38a8ff'},
  nord:{bg:'#1a1e26',bg2:'#22272e',bg3:'#2c313a',bg4:'#363d48','inp-bg':'#161a20',border:'#3e4655',border2:'#525d6e',text:'#d8dee9',text2:'#8fbcbb',text3:'#4c566a',accent:'#88c0d0',accent2:'#a3be8c',accent3:'#bf616a',accent4:'#ebcb8b',accent5:'#b48ead',accent6:'#5e81ac'},
  dracula:{bg:'#191a21',bg2:'#21222c',bg3:'#282a36',bg4:'#313442','inp-bg':'#141419',border:'#3c3f52',border2:'#535674',text:'#f8f8f2',text2:'#6272a4',text3:'#44475a',accent:'#50fa7b',accent2:'#ff79c6',accent3:'#ff5555',accent4:'#f1fa8c',accent5:'#bd93f9',accent6:'#8be9fd'},
  parchment:{bg:'#faf6ee',bg2:'#f2ece0',bg3:'#e8e0d0',bg4:'#ddd4c0','inp-bg':'#fdfaf4',border:'#c8bc9e',border2:'#a89870',text:'#241c10',text2:'#4e3c22',text3:'#8a6e48',accent:'#b84000',accent2:'#006878',accent3:'#c82040',accent4:'#787000',accent5:'#604880',accent6:'#107a40'},
  chalk:{bg:'#f8f8f8',bg2:'#f0f0f2',bg3:'#e6e6ec',bg4:'#dcdce4','inp-bg':'#ffffff',border:'#c8c8d4',border2:'#a8a8bc',text:'#141420',text2:'#38384e',text3:'#707088',accent:'#3454d1',accent2:'#e8433a',accent3:'#0aa884',accent4:'#e8860a',accent5:'#8034d4',accent6:'#0894d0'},
  linen:{bg:'#f5f0e8',bg2:'#ede7d8',bg3:'#e2dac8',bg4:'#d6cdb8','inp-bg':'#faf7f2',border:'#beb49e',border2:'#9e9280',text:'#1c1810',text2:'#3c3428',text3:'#786850',accent:'#2a7a3a',accent2:'#a0281e',accent3:'#c8780a',accent4:'#205878',accent5:'#783878',accent6:'#106840'},
  arctic:{bg:'#f0f6fa',bg2:'#e4eef8',bg3:'#d6e6f4',bg4:'#c8dced','inp-bg':'#f8fcff',border:'#aac8e0',border2:'#80a8c8',text:'#0c2030',text2:'#1c4060',text3:'#4878a0',accent:'#005fa8',accent2:'#e85800',accent3:'#c02040',accent4:'#007858',accent5:'#6030b8',accent6:'#008888'},
  youtube:{bg:'#0a0000',bg2:'#110000',bg3:'#1a0000',bg4:'#220505','inp-bg':'#080000',border:'#2a0808',border2:'#500a0a',text:'#ffffff',text2:'#cccccc',text3:'#888888',accent:'#ff0000',accent2:'#ff4444',accent3:'#ffaa00',accent4:'#ff6600',accent5:'#ffffff',accent6:'#cc0000'},
  discord:{bg:'#0e0f11',bg2:'#1e1f22',bg3:'#2b2d31',bg4:'#313338','inp-bg':'#1e1f22',border:'#23252a',border2:'#3f4147',text:'#dbdee1',text2:'#b5bac1',text3:'#80848e',accent:'#5865f2',accent2:'#7289da',accent3:'#57f287',accent4:'#fee75c',accent5:'#eb459e',accent6:'#ed4245'},
  twitter:{bg:'#000000',bg2:'#0a0a0a',bg3:'#111111',bg4:'#181818','inp-bg':'#000000',border:'#1c1c1c',border2:'#2f3336',text:'#e7e9ea',text2:'#8b98a5',text3:'#536471',accent:'#1d9bf0',accent2:'#00ba7c',accent3:'#f4212e',accent4:'#ffd400',accent5:'#7856ff',accent6:'#ff7a00'},
  spacex:{bg:'#000000',bg2:'#050508',bg3:'#0a0a10',bg4:'#0f0f18','inp-bg':'#030305',border:'#111118',border2:'#1c1c2e',text:'#e8eaf0',text2:'#9098b0',text3:'#505870',accent:'#ffffff',accent2:'#a0b8e0',accent3:'#4080ff',accent4:'#00d4ff',accent5:'#ff6030',accent6:'#60a0ff'},
};

function renderPresetGrid(){
  const grid=document.getElementById('ct-preset-grid');
  if(!grid) return;
  grid.innerHTML='';
  const allThemes=[
    ...THEME_DEFS.dark,
    ...THEME_DEFS.light,
    ...THEME_DEFS.brand
  ];
  allThemes.forEach(def=>{
    const btn=document.createElement('button');
    btn.className='theme-btn-v2';
    btn.style.cssText='font-size:8px;';
    btn.title='Load '+def.label+' as base';
    btn.innerHTML=`<div class="tbv2-swatches">
      <div class="tbv2-swatch" style="background:${def.bg};flex:2;"></div>
      <div class="tbv2-swatch" style="background:${def.accent};flex:1;"></div>
      <div class="tbv2-swatch" style="background:${def.accent2};flex:1;"></div>
    </div><div class="tbv2-label" style="font-size:7px;padding:3px 5px;">${def.label}</div>`;
    btn.onclick=()=>loadPresetIntoCustomBuilder(def.id);
    grid.appendChild(btn);
  });
}

function loadPresetIntoCustomBuilder(themeId){
  const data=PRESET_FULL[themeId];
  if(!data){toast('Preset data not found');return;}
  CT_VARS.forEach(k=>{
    const el=document.getElementById('ct-'+k);
    if(el&&data[k]) el.value=data[k];
  });
  // Also set icon accents to match preset accents
  const hi=document.getElementById('ct-icon-hi');
  const mid=document.getElementById('ct-icon-mid');
  const dim=document.getElementById('ct-icon-dim');
  if(hi) hi.value=data.accent||'#c8f04a';
  if(mid) mid.value=data.accent2||'#4af0c8';
  if(dim) dim.value=data.text3||'#4a5278';
  applyCustomThemeCssVars({...data,'icon-hi':data.accent,'icon-mid':data.accent2,'icon-dim':data.text3});
  SETTINGS.customTheme={...data,'icon-hi':data.accent,'icon-mid':data.accent2,'icon-dim':data.text3};
  previewCustomTheme();
  setTheme('custom');
  renderThemeGrid();
  const name=THEME_DEFS.dark.concat(THEME_DEFS.light,THEME_DEFS.brand).find(d=>d.id===themeId)?.label||themeId||'Obsidian';
  toast('Loaded '+name+' — now customize it');
}
