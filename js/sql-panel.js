// LMS Dev Hub — sql-panel.js
// SQL Schema Tab UI

/* ---- SQL tab UI ---- */
function switchSqlTab(tab){
  var pF=document.getElementById('sql-panel-fresh');
  var pU=document.getElementById('sql-panel-update');
  var tF=document.getElementById('sql-tab-fresh');
  var tU=document.getElementById('sql-tab-update');
  if(tab==='fresh'){
    pF.style.display='block'; pU.style.display='none';
    tF.style.background='rgba(74,240,200,.15)'; tF.style.color='var(--accent2)'; tF.style.borderColor='var(--accent2)';
    tU.style.background='var(--bg3)'; tU.style.color='var(--text3)'; tU.style.borderColor='var(--border2)';
  } else {
    pF.style.display='none'; pU.style.display='block';
    tU.style.background='rgba(240,160,74,.12)'; tU.style.color='var(--accent4)'; tU.style.borderColor='var(--accent4)';
    tF.style.background='var(--bg3)'; tF.style.color='var(--text3)'; tF.style.borderColor='var(--border2)';
  }
}

/* Called when the setup modal opens — render whatever we have (or re-fetch) */
function renderSqlPanels(){
  function show(which, sql){
    var loading=document.getElementById('sql-'+which+'-loading');
    var wrap=document.getElementById('sql-'+which+'-wrap');
    var pre=document.getElementById('sql-pre-'+which);
    if(!sql){
      if(loading) loading.textContent='Could not load script — check your config project connection.';
      return;
    }
    if(loading) loading.style.display='none';
    if(wrap) wrap.style.display='block';
    if(pre) pre.textContent=sql;
  }
  show('fresh',  _cfgSql.fresh);
  show('update', _cfgSql.update);
  /* If still null, do a live fetch then re-render */
  if(!_cfgSql.fresh || !_cfgSql.update){
    fetchSqlScripts().then(function(){
      show('fresh',  _cfgSql.fresh  || '-- Script not found in config table (type = "fresh")');
      show('update', _cfgSql.update || '-- Script not found in config table (type = "update")');
    });
  }
}

function copySql(which){
  var pre=document.getElementById('sql-pre-'+which);
  var btn=document.getElementById('sql-copy-btn-'+which);
  var accent=which==='update'?'var(--accent4)':'var(--accent2)';
  if(!pre) return;
  var flash=function(){btn.textContent='Copied!';btn.style.background='var(--accent)';setTimeout(function(){btn.textContent='Copy';btn.style.background=accent;},2000);};
  navigator.clipboard.writeText(pre.textContent).then(flash).catch(function(){
    var ta=document.createElement('textarea');ta.value=pre.textContent;
    document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);flash();
  });
}

function validateDbInputs(){
  var url=(document.getElementById('supabase-url-input')?.value||'').trim();
  var key=(document.getElementById('supabase-key-input')?.value||'').trim();
  var urlErr=document.getElementById('url-err');
  var keyErr=document.getElementById('key-err');
  var btn=document.getElementById('db-save-btn');
  var ok=true;
  if(url&&!url.startsWith('https://')){urlErr.textContent='Must start with https://';ok=false;}
  else if(url&&!url.includes('.supabase.co')){urlErr.textContent='Should be a .supabase.co URL';ok=false;}
  else{urlErr.textContent='';}
  if(key&&!key.startsWith('eyJ')){keyErr.textContent='Anon key should start with eyJ... — make sure you copied the right one';ok=false;}
  else if(key&&key.length<100){keyErr.textContent='Key looks too short — did you copy the full key?';ok=false;}
  else{keyErr.textContent='';}
  var ready=url.startsWith('https://')&&url.includes('.supabase.co')&&key.startsWith('eyJ')&&key.length>=100;
  btn.disabled=!ready;
  btn.style.background=ready?'linear-gradient(135deg,rgba(240,160,74,.15),rgba(200,240,74,.08))':'linear-gradient(135deg,rgba(240,160,74,.08),rgba(200,240,74,.05))';
  btn.style.borderColor=ready?'var(--accent4)':'var(--border2)';
  btn.style.color=ready?'var(--accent4)':'var(--text3)';
  btn.style.cursor=ready?'pointer':'not-allowed';
}