// LMS Dev Hub — db-adapter.js
// ========================================

// ============================================================
// SUPABASE REST HELPERS — schema-aware adapter
// Actual DB schema (snake_case) vs JS model (camelCase) translation
// ============================================================

// ---- FIELD TRANSLATORS ----
// JS → DB (for writes)
function _serverToDb(d){
  const o={};
  if(d.key!==undefined)       o.key=d.key;
  if(d.name!==undefined)      o.name=d.name;
  if(d.passHash!==undefined)  o.pass_hash=d.passHash;
  if(d.hostId!==undefined)    o.host_id=d.hostId;
  if(d.shortId!==undefined)   o.short_id=d.shortId;
  if(d.visibility!==undefined)o.visibility=d.visibility;
  if(d.deleted!==undefined)   o.deleted=d.deleted;
  if(d.deletedAt!==undefined) o.deleted_at=d.deletedAt;
  if(d.createdAt!==undefined) o.created_at=d.createdAt;
  if(d.description!==undefined) o.description=d.description;
  if(d.tags!==undefined)        o.tags=d.tags;
  if(d.hostName!==undefined)    o.host_name=d.hostName;
  return o;
}
// DB → JS (for reads)
function _serverFromDb(r){
  if(!r)return null;
  return{key:r.key,name:r.name,passHash:r.pass_hash,hostId:r.host_id,
       shortId:r.short_id,visibility:r.visibility,deleted:r.deleted,
       deletedAt:r.deleted_at,createdAt:r.created_at,
       description:r.description||'',
       tags:r.tags||[],
       hostName:r.host_name||''};
}
function _memberToDb(d){
  const o={};
  if(d.uid!==undefined)         o.uid=d.uid;
  if(d.server_key!==undefined)  o.server_key=d.server_key;
  if(d.name!==undefined)        o.name=d.name;
  if(d.displayName!==undefined) o.display_name=d.displayName;
  if(d.isHost!==undefined)      o.is_host=d.isHost;
  if(d.lastSeen!==undefined)    o.last_seen=d.lastSeen;
  if(d.activity!==undefined)    o.activity=d.activity;
  if(d.inProject!==undefined)   o.in_project=d.inProject;
  if(d.passHash!==undefined)    o.pass_hash=d.passHash;
  if(d.email!==undefined)       o.email=d.email;
  if(d.username!==undefined)    o.username=d.username;
  if(d.createdAt!==undefined)   o.created_at=d.createdAt;
  return o;
}
function _memberFromDb(r){
  if(!r)return null;
  return{uid:r.uid,server_key:r.server_key,name:r.name||r.display_name,displayName:r.display_name||r.name,username:r.username,isHost:r.is_host,lastSeen:r.last_seen,activity:r.activity,inProject:r.in_project,passHash:r.pass_hash,email:r.email,createdAt:r.created_at};
}
// Projects: the entire project payload is stored in a `data` jsonb column
// project_id = the JS-generated "proj_xxx" id
function _projectToDb(projId,serverKey,d){
  const {id,name,color,desc,description,tags,createdBy,createdByUid,createdAt,...rest}=d;
  return{
    project_id:projId||id,
    server_key:serverKey,
    name:name||d.name,
    color:color||'#4af0c8',
    description:description||desc||'',
    tags:tags||[],
    created_by:createdBy||d.createdBy,
    created_by_uid:createdByUid||d.createdByUid||'',
    created_at:createdAt||Date.now(),
    data:JSON.stringify(rest)
  };
}
function _projectFromDb(r){
  if(!r)return null;
  let data={};
  try{data=typeof r.data==='string'?JSON.parse(r.data):r.data||{};}catch(e){}
  return{id:r.project_id,name:r.name,color:r.color||'#4af0c8',desc:r.engine||'',createdBy:r.created_by,createdAt:r.created_at,...data};
}
function _chatToDb(msgId,serverKey,projId,d){
  return{msg_id:msgId,server_key:serverKey,project_id:projId,author:d.name,author_id:d.uid,text:d.text,ts:d.ts};
}
function _chatFromDb(r){
  if(!r)return null;
  return{id:r.msg_id,name:r.author,uid:r.author_id,text:r.text,ts:r.ts};
}

// ---- PATH PARSER ----
// Returns {table, filter, single, _meta}
function _pathToSupabase(path){
  const parts=path.replace(/^\/+/,'').split('/');
  if(parts[0]==='accounts'){
    if(parts[1]) return{table:'members',filter:'uid=eq.'+parts[1],single:true,_type:'account'};
    return{table:'members',filter:'username=not.is.null',single:false,_type:'account'}; }
  if(parts[0]==='emailIndex'){
    const email=parts[1].replace(/__at__/g,'@').replace(/_/g,'.');
    return{table:'members',filter:'email=eq.'+encodeURIComponent(email),single:true,_type:'account'};
  }
  if(parts[0]==='servers'){
    const key=parts[1];
    if(!key) return{table:'servers',filter:'',single:false,_type:'server'};
    if(!parts[2]||parts[2]==='meta') return{table:'servers',filter:'key=eq.'+key,single:true,_type:'server'};
    if(parts[2]==='members'){
      if(parts[3]) return{table:'members',filter:'server_key=eq.'+key+'&uid=eq.'+parts[3],single:true,_type:'member',_serverKey:key,_uid:parts[3]};
      return{table:'members',filter:'server_key=eq.'+key,single:false,_type:'member',_serverKey:key};
    }
    if(parts[2]==='projects'){
      const projId=parts[3]||null;
      const subField=parts[4]||null;  // tasks, notes, bugs, versions, chat, phaseData...
      const subId=parts[5]||null;
      if(projId) return{table:'projects',filter:'server_key=eq.'+key+'&project_id=eq.'+projId,single:true,_type:'project',_serverKey:key,_projId:projId,_subField:subField,_subId:subId};
      return{table:'projects',filter:'server_key=eq.'+key,single:false,_type:'project',_serverKey:key};
    }
    // Legacy: /servers/{key}/chat used directly (server-level chat)
    if(parts[2]==='chat'){
      return{table:'chat',filter:'server_key=eq.'+key,single:false,_type:'chat',_serverKey:key};
    }
  }
  if(parts[0]==='serverIds'){
    return{table:'server_ids',filter:'short_id=eq.'+parts[1],single:true,_type:'serverId'};
  }
  if(parts[0]==='emailCodes'){
    if(parts[1]) return{table:'email_codes',filter:'email_key=eq.'+encodeURIComponent(parts[1]),single:true,_type:'emailCode'};
    return{table:'email_codes',filter:'',single:false,_type:'emailCode'};
  }
  return{table:parts[0],filter:'',single:false,_type:'raw'};
}

// ---- READ — translate DB rows → JS objects ----
function _fromDb(meta,row){
  if(!row)return null;
  if(meta._type==='server') return _serverFromDb(row);
  if(meta._type==='member'||meta._type==='account') return _memberFromDb(row);
  if(meta._type==='project') return _projectFromDb(row);
  if(meta._type==='chat') return _chatFromDb(row);
  return row;
}

async function fbGet(path){
  try{
    const meta=_pathToSupabase(path);
    const {table,filter,single}=meta;
    const url=getSrvDbUrl()+'/rest/v1/'+table+(filter?'?'+filter:'');
    const r=await fetch(url,{headers:sbHeaders({'Accept':'application/json'})});
    if(!r.ok) return null;
    const j=await r.json();
    if(!Array.isArray(j)) return _fromDb(meta,j);
    if(j.length===0) return null;
    if(single) return _fromDb(meta,j[0]);
    // Return as object keyed by the logical ID
    if(meta._type==='member'||meta._type==='account'){
      const out={};
      j.forEach(row=>{const m=_memberFromDb(row);if(m&&m.uid)out[m.uid]=m;});
      return Object.keys(out).length?out:null;
    }
    if(meta._type==='project'){
      const out={};
      j.forEach(row=>{const p=_projectFromDb(row);if(p&&p.id)out[p.id]=p;});
      return Object.keys(out).length?out:null;
    }
    if(meta._type==='chat'){
      const out={};
      j.forEach(row=>{const m=_chatFromDb(row);if(m&&m.id)out[m.id]=m;});
      return Object.keys(out).length?out:null;
    }
    if(meta._type==='server'){
      const out={};
      j.forEach(row=>{const s=_serverFromDb(row);if(s&&s.key)out[s.key]=s;});
      return Object.keys(out).length?out:null;
    }
    return j.length===1?j[0]:Object.fromEntries(j.map(row=>[row.uid||row.key||row.project_id||row.id,row]));
  }catch(e){console.warn('fbGet error',path,e);return null;}
}

// ---- READ — translate DB rows → JS objects ----
function _fromDb(meta,row){
  if(!row)return null;
  if(meta._type==='server') return _serverFromDb(row);
  if(meta._type==='member'||meta._type==='account') return _memberFromDb(row);
  if(meta._type==='project') return _projectFromDb(row);
  return row;
}

// ---- HELPER: read raw project data jsonb ----
async function _getProjectData(serverKey,projId){
  const url=getSrvDbUrl()+'/rest/v1/projects?server_key=eq.'+serverKey+'&project_id=eq.'+projId;
  const r=await fetch(url,{headers:sbHeaders({'Accept':'application/json'})});
  if(!r.ok) return null;
  const j=await r.json();
  if(!j||!j.length) return null;
  const row=j[0];
  let data={};
  try{data=typeof row.data==='string'?JSON.parse(row.data):(row.data||{});}catch(e){}
  return{row,data};
}
async function _patchProjectDataJsonb(serverKey,projId,mergeFn){
  const got=await _getProjectData(serverKey,projId);
  const data=got?got.data:{};
  mergeFn(data);
  const url=getSrvDbUrl()+'/rest/v1/projects?server_key=eq.'+serverKey+'&project_id=eq.'+projId;
  await fetch(url,{method:'PATCH',headers:sbHeaders({'Prefer':'return=minimal'}),body:JSON.stringify({data:JSON.stringify(data)})});
}

async function fbGet(path){
  try{
    const meta=_pathToSupabase(path);
    const {table,filter,single}=meta;
    // Sub-field read (e.g. /servers/key/projects/id/chat)
    if(meta._type==='project'&&meta._projId&&meta._subField){
      const got=await _getProjectData(meta._serverKey,meta._projId);
      if(!got) return null;
      const val=got.data[meta._subField];
      if(val===undefined||val===null) return null;
      if(meta._subId) return val[meta._subId]||null;
      return val;
    }
    const url=getSrvDbUrl()+'/rest/v1/'+table+(filter?'?'+filter:'');
    const r=await fetch(url,{headers:sbHeaders({'Accept':'application/json'})});
    if(!r.ok) return null;
    const j=await r.json();
    if(!Array.isArray(j)) return _fromDb(meta,j);
    if(j.length===0) return null;
    if(single) return _fromDb(meta,j[0]);
    if(meta._type==='member'||meta._type==='account'){
      const out={};
      j.forEach(row=>{const m=_memberFromDb(row);if(m&&m.uid)out[m.uid]=m;});
      return Object.keys(out).length?out:null;
    }
    if(meta._type==='project'){
      const out={};
      j.forEach(row=>{const p=_projectFromDb(row);if(p&&p.id)out[p.id]=p;});
      return Object.keys(out).length?out:null;
    }
    if(meta._type==='server'){
      const out={};
      j.forEach(row=>{const s=_serverFromDb(row);if(s&&s.key)out[s.key]=s;});
      return Object.keys(out).length?out:null;
    }
    return j.length===1?j[0]:Object.fromEntries(j.map(row=>[row.uid||row.key||row.project_id||row.id,row]));
  }catch(e){console.warn('fbGet error',path,e);return null;}
}

// ---- WRITE — translate JS objects → DB rows ----
function _toDb(meta,data){
  if(meta._type==='server') return _serverToDb(data);
  if(meta._type==='member'||meta._type==='account') return _memberToDb(data);
  if(meta._type==='project'){
    if(data&&data._dataOnly) return{data:data.data};
    const projId=meta._projId||data.id;
    const serverKey=meta._serverKey;
    return _projectToDb(projId,serverKey,data);
  }
  return data;
}

async function fbSet(path,data){
  try{
    const meta=_pathToSupabase(path);
    const {table}=meta;
    // Sub-field write: merge into project data jsonb
    if(meta._type==='project'&&meta._projId&&meta._subField){
      await _patchProjectDataJsonb(meta._serverKey,meta._projId,d=>{
        if(meta._subId){if(!d[meta._subField])d[meta._subField]={};d[meta._subField][meta._subId]=data;}
        else d[meta._subField]=data;
      });
      return true;
    }
    const dbData=_toDb(meta,data);
    let conflictCol='';
    if(table==='members') conflictCol=(meta._type==='member'?'uid,server_key':'uid');
    else if(table==='projects') conflictCol='project_id';
    else if(table==='servers') conflictCol='key';
    else if(table==='server_ids') conflictCol='short_id';
    else if(table==='email_codes') conflictCol='email_key';
    const url=getSrvDbUrl()+'/rest/v1/'+table+(conflictCol?'?on_conflict='+conflictCol:'');
    const r=await fetch(url,{method:'POST',headers:sbHeaders({'Prefer':'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify(dbData)});
    if(!r.ok&&r.status!==201&&r.status!==204){
      const errText=await r.text().catch(()=>'');
      console.warn('fbSet failed',path,'status:',r.status,errText);
    }
    return r.ok||r.status===201||r.status===204;
  }catch(e){console.warn('fbSet error',path,e);return false;}
}

async function fbPatch(path,data){
  try{
    const meta=_pathToSupabase(path);
    const {table,filter}=meta;
    // Project sub-field patch
    if(meta._type==='project'&&meta._projId){
      if(meta._subField){
        await _patchProjectDataJsonb(meta._serverKey,meta._projId,d=>{
          if(meta._subId){if(!d[meta._subField])d[meta._subField]={};d[meta._subField][meta._subId]={...(d[meta._subField][meta._subId]||{}),...data};}
          else d[meta._subField]={...(d[meta._subField]||{}),...data};
        });
        return true;
      } else {
        // Top-level project patch
        if(data&&data._dataOnly){
          const url=getSrvDbUrl()+'/rest/v1/projects?server_key=eq.'+meta._serverKey+'&project_id=eq.'+meta._projId;
          const r=await fetch(url,{method:'PATCH',headers:sbHeaders({'Prefer':'return=minimal'}),body:JSON.stringify({data:data.data})});
          return r.ok||r.status===204;
        }
        await _patchProjectDataJsonb(meta._serverKey,meta._projId,d=>{Object.assign(d,data);});
        return true;
      }
    }
    const dbData=_toDb(meta,data);
    const url=getSrvDbUrl()+'/rest/v1/'+table+(filter?'?'+filter:'');
    const r=await fetch(url,{method:'PATCH',headers:sbHeaders({'Prefer':'return=minimal'}),body:JSON.stringify(dbData)});
    return r.ok||r.status===204;
  }catch(e){console.warn('fbPatch error',path,e);return false;}
}

async function fbPush(path,data){
  try{
    const meta=_pathToSupabase(path);
    const {table}=meta;
    const dbData=_toDb(meta,data);
    const url=getSrvDbUrl()+'/rest/v1/'+table;
    const r=await fetch(url,{method:'POST',headers:sbHeaders({'Prefer':'return=minimal'}),body:JSON.stringify(dbData)});
    return r.ok||r.status===201||r.status===204;
  }catch(e){console.warn('fbPush error',path,e);return false;}
}

async function fbDelete(path){
  try{
    const meta=_pathToSupabase(path);
    const {table,filter}=meta;
    // Sub-field delete: remove key from project data jsonb
    if(meta._type==='project'&&meta._projId&&meta._subField){
      await _patchProjectDataJsonb(meta._serverKey,meta._projId,d=>{
        if(meta._subId&&d[meta._subField]) delete d[meta._subField][meta._subId];
        else delete d[meta._subField];
      });
      return true;
    }
    if(!filter){console.warn('fbDelete: no filter, skipping to avoid wiping table',path);return false;}
    const url=getSrvDbUrl()+'/rest/v1/'+table+'?'+filter;
    await fetch(url,{method:'DELETE',headers:sbHeaders()});
    return true;
  }catch(e){console.warn('fbDelete error',path,e);return false;}
}

// ---- SERVER TYPE SELECTION ----
function selectSrvType(type){
  document.getElementById('host-server-type').value=type;
  const pubBtn=document.getElementById('srv-type-public');
  const privBtn=document.getElementById('srv-type-private');
  const desc=document.getElementById('srv-type-desc');
  const activeStyle='background:linear-gradient(135deg,rgba(74,240,200,.15),rgba(74,240,200,.07));color:var(--accent2);';
  const inactiveStyle='background:var(--bg3);color:var(--text3);';
  if(type==='public'){
    pubBtn.style.cssText=pubBtn.style.cssText.replace(/background:[^;]+;color:[^;]+;/,'')+activeStyle;
    privBtn.style.cssText=privBtn.style.cssText.replace(/background:[^;]+;color:[^;]+;/,'')+inactiveStyle;
    desc.innerHTML='<strong style="color:var(--accent2);">Public:</strong> Share with your team. Others can join with the server name + password.';
  } else {
    privBtn.style.cssText=privBtn.style.cssText.replace(/background:[^;]+;color:[^;]+;/,'')+activeStyle.replace('var(--accent2)','var(--accent5)');
    pubBtn.style.cssText=pubBtn.style.cssText.replace(/background:[^;]+;color:[^;]+;/,'')+inactiveStyle;
    desc.innerHTML='<strong style="color:var(--accent5);">Private Cloud:</strong> Just for you. Acts as your personal cloud backup — only accessible with your credentials. Perfect for solo projects you want synced across devices.';
  }
}

// ---- JOIN METHOD TOGGLE ----
function switchJoinMethod(method){
  const nameFields=document.getElementById('join-name-fields');
  const idFields=document.getElementById('join-id-fields');
  const nameBtn=document.getElementById('join-by-name-btn');
  const idBtn=document.getElementById('join-by-id-btn');
  const submitBtn=document.getElementById('join-submit-btn');
  const activeStyle='flex:1;background:linear-gradient(135deg,rgba(74,240,200,.1),rgba(74,240,200,.05));border:none;border-right:1px solid var(--border);color:var(--accent2);font-family:var(--font);font-size:9px;padding:8px;cursor:pointer;letter-spacing:.08em;';
  const inactiveStyle='flex:1;background:var(--bg3);border:none;border-right:1px solid var(--border);color:var(--text3);font-family:var(--font);font-size:9px;padding:8px;cursor:pointer;letter-spacing:.08em;';
  if(method==='name'){
    nameFields.style.display='block';idFields.style.display='none';
    nameBtn.style.cssText=activeStyle;idBtn.style.cssText=inactiveStyle.replace('border-right:1px solid var(--border);','');
    submitBtn.textContent='→ Join by Name';submitBtn.onclick=joinServer;
  } else {
    nameFields.style.display='none';idFields.style.display='block';
    idBtn.style.cssText=activeStyle.replace('border-right:1px solid var(--border);','');nameBtn.style.cssText=inactiveStyle;
    submitBtn.textContent='→ Join by ID';submitBtn.onclick=joinServerById;
  }
}

// ---- COPY SERVER ID ----
function copyServerId(){
  const id=srvState.shortId;if(!id)return;
  navigator.clipboard.writeText(id).then(()=>toast('Server ID copied: '+id)).catch(()=>{
    // Fallback
    const ta=document.createElement('textarea');ta.value=id;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);toast('Server ID copied: '+id);
  });
}
