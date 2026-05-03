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
    </div><div class="tbv2-label">✦ Custom</div>`;
    document.getElementById('theme-grid').appendChild(btn);
  }
  THEME_DEFS.light.forEach(d=>makeBtn(d,'theme-grid-light'));
  THEME_DEFS.brand.forEach(d=>makeBtn(d,'theme-grid-brand'));
}

// =====================================================
// CUSTOM THEME BUILDER
// =====================================================
const CT_VARS=['bg','bg2','bg3','bg4','inp-bg','border','border2','text','text2','text3','accent','accent2','accent3','accent4','accent5','accent6'];

function getCustomThemeFromPickers(){
  const ct={};
  CT_VARS.forEach(k=>{
    const el=document.getElementById('ct-'+k);
    if(el) ct[k]=el.value;
  });
  return ct;
}

function applyCustomThemeCssVars(ct){
  if(!ct) return;
  Object.entries(ct).forEach(([k,v])=>{
    document.documentElement.style.setProperty('--ct-'+k, v);
  });
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
    row.innerHTML=`<div class="saved-theme-swatches">${swatches}</div><div class="saved-theme-name">${s.name}</div><button class="saved-theme-del" onclick="event.stopPropagation();deleteSavedTheme('${s.id}')">✕</button>`;
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
    previewCustomTheme();
  }
  renderSavedThemes();
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
