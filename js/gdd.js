// LMS Dev Hub — gdd.js
// ========================================

// =====================================================
// GAME DESIGN DOC
// =====================================================
const GDD_DEFAULTS=[
  'Game Concept','Core Mechanics','Player Experience','Art Direction','Audio Design','Level Design','Progression System','Technical Notes'
];

function renderGDD(){
  const el=document.getElementById('gdd-sections-list');if(!el)return;
  if(!D||!D.gddSections)return;
  el.innerHTML='';
  D.gddSections.forEach((sec,i)=>{
    const div=document.createElement('div');div.className='gdd-section';
    const hdr=document.createElement('div');hdr.className='gdd-sec-hdr';
    hdr.innerHTML=`<input class="insp-inp" style="flex:1;border:none;background:none;font-size:11px;color:var(--text);padding:0;" value="${escHtml(sec.title||'')}" onchange="D.gddSections[${i}].title=this.value;save();" placeholder="Section title"><button class="xbtn" onclick="deleteGDDSection(${i})">×</button>`;
    const body=document.createElement('div');body.className='gdd-sec-body';
    const ta=document.createElement('textarea');ta.className='gdd-textarea';ta.value=sec.content||'';ta.placeholder='Write your '+( sec.title||'notes')+'...';
    ta.oninput=()=>{D.gddSections[i].content=ta.value;save();};
    body.appendChild(ta);div.appendChild(hdr);div.appendChild(body);el.appendChild(div);
  });
  if(!D.gddSections.length){
    el.innerHTML='<div style="font-size:11px;color:var(--text3);padding:20px 0;">No GDD sections yet. Click Add Section or generate defaults.</div>';
    const btn=document.createElement('button');btn.className='btn accent';btn.textContent='Generate Default Sections';
    btn.onclick=()=>{D.gddSections=GDD_DEFAULTS.map(t=>({id:'gdd_'+Date.now()+Math.random(),title:t,content:''}));save();renderGDD();};
    el.appendChild(btn);
  }
}

function addGDDSection(){
  if(!D.gddSections)D.gddSections=[];
  D.gddSections.push({id:'gdd_'+Date.now(),title:'New Section',content:''});
  save();renderGDD();toast('Section added');
}

function deleteGDDSection(i){D.gddSections.splice(i,1);save();renderGDD();}

function exportGDD(){
  if(!D.gddSections||!D.gddSections.length){toast('No GDD content');return;}
  let out='# Game Design Document\n# Project: '+(D.name||'Project')+'\n# '+new Date().toLocaleDateString()+'\n\n';
  D.gddSections.forEach(s=>{out+='## '+s.title+'\n\n'+(s.content||'(empty)')+'\n\n---\n\n';});
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([out],{type:'text/plain'}));a.download='GDD.md';a.click();toast('GDD exported as markdown');
}
