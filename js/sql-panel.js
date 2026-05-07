// LMS Dev Hub — sql-panel.js

// =====================================================
// SQL PANEL UI
// =====================================================
function renderSqlPanels(){
  const freshLoad=document.getElementById('sql-fresh-loading');
  const freshWrap=document.getElementById('sql-fresh-wrap');
  const freshPre=document.getElementById('sql-pre-fresh');
  const updateLoad=document.getElementById('sql-update-loading');
  const updateWrap=document.getElementById('sql-update-wrap');
  const updatePre=document.getElementById('sql-pre-update');
  if(!freshLoad||!freshWrap||!freshPre||!updateLoad||!updateWrap||!updatePre) return;

  if(_cfgSql.fresh){
    freshLoad.style.display='none';
    freshWrap.style.display='block';
    freshPre.textContent=_cfgSql.fresh;
  } else {
    freshLoad.style.display='block';
    freshWrap.style.display='none';
    // Try to fetch and re-render
    fetchSqlScripts().then(()=>{
      if(_cfgSql.fresh){freshLoad.style.display='none';freshWrap.style.display='block';freshPre.textContent=_cfgSql.fresh;}
    });
  }
  if(_cfgSql.update){
    updateLoad.style.display='none';
    updateWrap.style.display='block';
    updatePre.textContent=_cfgSql.update;
  } else {
    updateLoad.style.display='block';
    updateWrap.style.display='none';
    fetchSqlScripts().then(()=>{
      if(_cfgSql.update){updateLoad.style.display='none';updateWrap.style.display='block';updatePre.textContent=_cfgSql.update;}
    });
  }
}

function switchSqlTab(tab){
  const freshPanel=document.getElementById('sql-panel-fresh');
  const updatePanel=document.getElementById('sql-panel-update');
  const freshBtn=document.getElementById('sql-tab-fresh');
  const updateBtn=document.getElementById('sql-tab-update');
  if(!freshPanel||!updatePanel) return;
  if(tab==='fresh'){
    freshPanel.style.display='block';
    updatePanel.style.display='none';
    if(freshBtn){freshBtn.style.background='rgba(74,240,200,.1)';freshBtn.style.color='var(--accent2)';}
    if(updateBtn){updateBtn.style.background='var(--bg3)';updateBtn.style.color='var(--text3)';}
  } else {
    freshPanel.style.display='none';
    updatePanel.style.display='block';
    if(updateBtn){updateBtn.style.background='rgba(240,160,74,.1)';updateBtn.style.color='var(--accent4)';}
    if(freshBtn){freshBtn.style.background='var(--bg3)';freshBtn.style.color='var(--text3)';}
  }
}

function copySql(type){
  const sql=type==='fresh'?_cfgSql.fresh:_cfgSql.update;
  if(!sql){toast('SQL not loaded yet');return;}
  navigator.clipboard.writeText(sql).then(()=>{
    const btn=document.getElementById('sql-copy-btn-'+type);
    if(btn){const orig=btn.textContent;btn.textContent='Copied!';setTimeout(()=>{btn.textContent=orig;},1500);}
    toast('SQL copied to clipboard');
  }).catch(()=>toast('Copy failed — select and copy manually'));
}