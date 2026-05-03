// LMS Dev Hub — analytics.js
// ========================================

// =====================================================
// ANALYTICS / TIME TRACKER
// =====================================================
let timerInterval=null,timerStart=null,timerRunning=false;

function timerToggle(){
  if(timerRunning){
    clearInterval(timerInterval);timerRunning=false;
    const dur=Math.floor((Date.now()-timerStart)/1000);
    if(dur>10){
      if(!D.sessions)D.sessions=[];
      D.sessions.push({id:'ses_'+Date.now(),start:timerStart,duration:dur,date:new Date().toLocaleDateString(),ts:new Date().toLocaleString(),loggedBy:currentUser?(currentUser.displayName||currentUser.username):'unknown'});
      save();logActivity('Session: '+fmtDur(dur)+' ('+((currentUser&&(currentUser.displayName||currentUser.username))||'you')+')','#c8f04a');
    }
    document.getElementById('timer-start-btn').textContent='Start Session';
    document.getElementById('an-timer-display').className='timer-display';
    document.getElementById('an-timer-display').textContent='00:00:00';
    timerStart=null;renderAnalytics();
  } else {
    timerRunning=true;timerStart=Date.now();
    document.getElementById('timer-start-btn').textContent='Stop Session';
    document.getElementById('an-timer-display').className='timer-display timer-running';
    timerInterval=setInterval(()=>{
      const sec=Math.floor((Date.now()-timerStart)/1000);
      document.getElementById('an-timer-display').textContent=fmtSec(sec);
    },1000);
  }
}

function fmtSec(sec){const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function fmtDur(sec){const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);if(h>0)return`${h}h ${m}m`;return`${m}m`;}

function openLogSession(){
  openModal('Log Manual Session',`
    <label class="modal-label">Date</label>
    <input class="modal-inp" id="ms-date" type="date" value="${new Date().toISOString().slice(0,10)}">
    <label class="modal-label">Hours</label>
    <input class="modal-inp" id="ms-hours" type="number" min="0" max="24" step="0.5" placeholder="e.g. 2.5">
    <label class="modal-label">Minutes</label>
    <input class="modal-inp" id="ms-mins" type="number" min="0" max="59" step="5" placeholder="e.g. 30">
    <label class="modal-label">Notes</label>
    <input class="modal-inp" id="ms-note" placeholder="What did you work on?">
  `,[{label:'Cancel',action:closeModal},{label:'Log',action:()=>{
    const h=parseFloat(document.getElementById('ms-hours').value)||0;
    const m=parseInt(document.getElementById('ms-mins').value)||0;
    const dur=Math.round(h*3600+m*60);
    if(!dur)return;
    const dateStr=document.getElementById('ms-date').value||new Date().toLocaleDateString();
    const note=document.getElementById('ms-note').value;
    if(!D.sessions)D.sessions=[];
    const ds=new Date(dateStr);
    const loggedBy=currentUser?(currentUser.displayName||currentUser.username):'unknown';
    D.sessions.push({id:'ses_'+Date.now(),start:ds.getTime(),duration:dur,date:ds.toLocaleDateString(),ts:ds.toLocaleDateString(),note,loggedBy});
    save();closeModal();renderAnalytics();logActivity('Session logged: '+fmtDur(dur)+' by '+loggedBy,'#c8f04a');toast('Session logged: '+fmtDur(dur));
  },accent:true}]);
}

function clearAllSessions(){
  openModal('Clear Session Log',`<p style="font-size:11px;color:var(--text2);">Delete all recorded sessions for this project? This cannot be undone.</p>`,[
    {label:'Cancel',action:closeModal},{label:'Clear All',action:()=>{D.sessions=[];save();closeModal();renderAnalytics();toast('Sessions cleared');},danger:true}
  ]);
}

function renderAnalytics(){
  if(!document.getElementById('page-analytics'))return;
  if(!D||!D.sessions)return;
  const sessions=D.sessions;
  const totalSec=sessions.reduce((a,s)=>a+s.duration,0);
  const now=new Date();
  const todayStr=now.toLocaleDateString();
  const todaySessions=sessions.filter(s=>s.date===todayStr);
  const todaySec=todaySessions.reduce((a,s)=>a+s.duration,0);
  // week
  const weekStart=new Date(now);weekStart.setDate(now.getDate()-now.getDay());weekStart.setHours(0,0,0,0);
  const weekSessions=sessions.filter(s=>new Date(s.start)>=weekStart);
  const weekSec=weekSessions.reduce((a,s)=>a+s.duration,0);
  const avgSec=sessions.length?Math.round(totalSec/sessions.length):0;
  // streak
  let streak=0;const d=new Date();
  while(true){const ds=d.toLocaleDateString();if(!sessions.some(s=>s.date===ds))break;streak++;d.setDate(d.getDate()-1);}
  const el=id=>document.getElementById(id);
  if(el('an-total-time'))el('an-total-time').textContent=totalSec>=3600?`${Math.floor(totalSec/3600)}h`:`${Math.floor(totalSec/60)}m`;
  if(el('an-total-sub'))el('an-total-sub').textContent=sessions.length+' sessions total';
  if(el('an-today'))el('an-today').textContent=todaySec>=3600?`${Math.floor(todaySec/3600)}h`:`${Math.floor(todaySec/60)}m`;
  if(el('an-today-sub'))el('an-today-sub').textContent=todaySessions.length+' sessions';
  if(el('an-week'))el('an-week').textContent=weekSec>=3600?`${Math.floor(weekSec/3600)}h`:`${Math.floor(weekSec/60)}m`;
  if(el('an-week-sub'))el('an-week-sub').textContent=weekSessions.length+' sessions';
  if(el('an-avg'))el('an-avg').textContent=avgSec>=3600?`${Math.floor(avgSec/3600)}h`:`${Math.floor(avgSec/60)}m`;
  if(el('an-streak'))el('an-streak').textContent=streak+' day streak';
  renderBarChart(sessions);
  renderHeatmap(sessions);
  renderSessionList(sessions);
}

function renderBarChart(sessions){
  const el=document.getElementById('an-bar-chart');if(!el)return;
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const now=new Date();const buckets=Array(7).fill(0);
  sessions.forEach(s=>{const d=new Date(s.start);const diff=Math.floor((now-d)/86400000);if(diff<7){const di=(now.getDay()-diff+7)%7;buckets[di]+=s.duration;}});
  const maxSec=Math.max(...buckets,1);
  el.innerHTML='';
  for(let i=0;i<7;i++){
    const di=(now.getDay()-6+i+7)%7;
    const col=document.createElement('div');col.className='bar-col';
    const fill=document.createElement('div');fill.className='bar-fill';
    fill.style.height=Math.round(buckets[di]/maxSec*70)+'px';
    const lbl=document.createElement('div');lbl.className='bar-lbl';lbl.textContent=days[di];
    col.appendChild(fill);col.appendChild(lbl);el.appendChild(col);
  }
}

function renderHeatmap(sessions){
  const el=document.getElementById('an-heatmap');if(!el)return;
  const map={};sessions.forEach(s=>{const d=new Date(s.start);const k=d.toDateString();map[k]=(map[k]||0)+s.duration;});
  el.innerHTML='';
  const now=new Date();
  for(let i=363;i>=0;i--){
    const d=new Date(now);d.setDate(d.getDate()-i);
    const sec=map[d.toDateString()]||0;
    let v=0;if(sec>0)v=1;if(sec>3600)v=2;if(sec>7200)v=3;if(sec>14400)v=4;
    const cell=document.createElement('div');cell.className='heatmap-cell';cell.setAttribute('data-v',v);
    cell.title=d.toLocaleDateString()+': '+fmtDur(sec);
    el.appendChild(cell);
  }
}

function renderSessionList(sessions){
  const el=document.getElementById('an-session-list');if(!el)return;
  if(!sessions.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);">No sessions recorded. Click Start Session to begin tracking.</div>';return;}
  el.innerHTML='';
  sessions.slice().reverse().slice(0,30).forEach(s=>{
    const row=document.createElement('div');row.className='session-row';
    row.innerHTML=`<div class="session-dot"></div><span class="session-proj">${escHtml(s.note||'Dev session')}</span><span class="session-dur">${fmtDur(s.duration)}</span><span class="session-date">${s.date}</span>${s.loggedBy?`<span style="font-size:9px;color:var(--text3);letter-spacing:.05em;">by ${escHtml(s.loggedBy)}</span>`:''}<button class="xbtn" onclick="deleteSession('${s.id}')">x</button>`;
    el.appendChild(row);
  });
}

function deleteSession(id){if(!D.sessions)return;D.sessions=D.sessions.filter(s=>s.id!==id);save();renderAnalytics();}
