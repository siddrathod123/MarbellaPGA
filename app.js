const names = ["Elijah","James","Ben","Sam","Sidd K","Sidd R","Nick","Matt"];
const courses = [
  { id:"atalaya", name:"Atalaya New Course", holes:[4,4,3,5,4,4,3,5,4,4,5,3,4,4,4,5,3,4] },
  { id:"dona", name:"Doña Julia", holes:[4,5,4,3,4,4,5,3,4,4,4,3,5,4,4,3,5,4] },
  { id:"arqueros", name:"Los Arqueros", holes:[4,4,3,5,4,4,3,4,5,4,3,4,5,4,4,3,5,4] },
  { id:"higueron", name:"Higuerón", holes:[4,3,4,5,4,4,3,5,4,4,4,3,5,4,3,4,5,4] }
];
const formats = ["Singles Matchplay", "Fourball Better Ball", "Alternate Shot", "Scramble", "Stableford", "Skins", "Vegas / Wolf"];
const $ = (s) => document.querySelector(s);
const app = $("#app");
const storeKey = "marbella-pga-app-v2";
let state = JSON.parse(localStorage.getItem(storeKey) || "null") || {
  view:"home", selectedTeam:"Pink", selectedCourse:"atalaya", currentFormat:"Singles Matchplay",
  players:names.map(n=>({name:n, team:"", handicap:"", joined:false})),
  scores:{}, drinks:{}, bets:[], notes:[]
};
if(!state.drinks) state.drinks = {};
courses.forEach(c=>{
  if(!state.scores[c.id]) state.scores[c.id] = {};
  if(!state.drinks[c.id]) state.drinks[c.id] = {};
  names.forEach(n=>{
    if(!state.scores[c.id][n]) state.scores[c.id][n] = Array(18).fill("");
    if(!state.drinks[c.id][n]) state.drinks[c.id][n] = Array(18).fill("");
  });
});
function save(){ localStorage.setItem(storeKey, JSON.stringify(state)); }
function toast(msg){ let el = document.querySelector('.toast'); if(!el){el=document.createElement('div');el.className='toast';document.body.appendChild(el)} el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1400); }
function navigate(view){ state.view=view; save(); document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===view)); render(); window.scrollTo({top:0,behavior:'smooth'}); }
document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.view)));
function scoreNet(strokes, drinks){
  const s = Number(strokes) || 0;
  const d = Number(drinks) || 0;
  return s ? s - d : 0;
}
function totalFor(name){
  let gross=0, drinks=0, net=0, played=0;
  courses.forEach(c=>state.scores[c.id][name].forEach((v,i)=>{
    const s=Number(v);
    const d=Number(state.drinks[c.id][name][i]) || 0;
    if(s){ gross+=s; drinks+=d; net+=scoreNet(s,d); played++; }
  }));
  return {total:net, gross, drinks, played};
}
function teamPoints(){ const pink = state.players.filter(p=>p.team==='Pink').reduce((a,p)=>a+totalFor(p.name).total,0); const purple = state.players.filter(p=>p.team==='Purple').reduce((a,p)=>a+totalFor(p.name).total,0); return {pink,purple}; }
function render(){
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===state.view));
  if(state.view==='home') return home();
  if(state.view==='teams') return teams();
  if(state.view==='scores') return scores();
  if(state.view==='bets') return bets();
  if(state.view==='summary') return summary();
}
function home(){
  const tp = teamPoints();
  app.innerHTML = `<section class="hero"><h2>Marbella Matchplay</h2><p>Pink vs Purple. Four courses, live scores, drink deductions, questionable bets, and absolutely no gimmes unless witnessed.</p><div class="hero-grid"><div class="stat"><b>${state.players.filter(p=>p.joined).length}/8</b><span>Players joined</span></div><div class="stat"><b>${state.currentFormat.split(' ')[0]}</b><span>Current format</span></div><div class="stat"><b>${tp.pink || '—'}</b><span>Pink net</span></div><div class="stat"><b>${tp.purple || '—'}</b><span>Purple net</span></div></div></section>
  <div class="section-title"><h3>Today’s format</h3><small>Change anytime</small></div><div class="card format-banner"><select id="formatSelect">${formats.map(f=>`<option ${f===state.currentFormat?'selected':''}>${f}</option>`).join('')}</select><span class="format-badge">Active</span></div>
  <div class="section-title"><h3>Marbella courses</h3><small>4 rounds</small></div><div class="stack">${courses.map((c,i)=>`<div class="card course-card"><div style="display:flex;gap:12px;align-items:center"><div class="flag">${i+1}</div><div><h4>${c.name}</h4><p>Par ${c.holes.reduce((a,b)=>a+b,0)} • scorecard ready</p></div></div><button class="btn secondary" onclick="state.selectedCourse='${c.id}';navigate('scores')">Open</button></div>`).join('')}</div>`;
  $('#formatSelect').addEventListener('change', e=>{state.currentFormat=e.target.value;save();toast('Format updated')});
}
function teams(){
  app.innerHTML = `<div class="section-title"><h3>Player check-in</h3><small>Choose side</small></div><div class="card"><div class="form-grid"><label>Name<select id="playerName">${names.map(n=>`<option>${n}</option>`).join('')}</select></label><label>Handicap<input id="hcp" inputmode="decimal" placeholder="e.g. 14.2"></label><div class="team-toggle"><div class="team-option pink active" data-team="Pink">Pink Team</div><div class="team-option purple" data-team="Purple">Purple Team</div></div><button class="btn" id="joinBtn">Save Player</button><p class="tiny">This saves on this device for preview. Once hosted with Firebase, everyone’s updates can sync live.</p></div></div>
  <div class="section-title"><h3>Team rooms</h3><small>Pink v Purple</small></div><div class="team-board"><div class="card team-col"><h3 class="pink-text">Pink</h3>${teamList('Pink')}</div><div class="card team-col"><h3 class="purple-text">Purple</h3>${teamList('Purple')}</div></div>`;
  let chosen='Pink'; document.querySelectorAll('.team-option').forEach(t=>t.addEventListener('click',()=>{chosen=t.dataset.team;document.querySelectorAll('.team-option').forEach(x=>x.classList.remove('active'));t.classList.add('active')}));
  $('#joinBtn').addEventListener('click',()=>{ const p=state.players.find(x=>x.name===$('#playerName').value); p.team=chosen; p.handicap=$('#hcp').value; p.joined=true; save(); toast('Player saved'); teams(); });
}
function teamList(team){ const ps=state.players.filter(p=>p.team===team); return ps.length?ps.map(p=>`<div class="player-chip"><span>${p.name}</span><b>${p.handicap || '—'}</b></div>`).join(''):`<p class="muted">No players yet</p>`; }
function scores(){ const c = courses.find(x=>x.id===state.selectedCourse); const player = state.scorePlayer || names[0]; state.scorePlayer=player;
  app.innerHTML = `<div class="section-title"><h3>Scorecards</h3><small>Gross minus drinks</small></div><div class="tabs">${courses.map(c=>`<button class="tab ${c.id===state.selectedCourse?'active':''}" data-course="${c.id}">${c.name}</button>`).join('')}</div><div class="card" style="margin-top:10px"><div class="form-grid"><label>Player<select id="scorePlayer">${names.map(n=>`<option ${n===player?'selected':''}>${n}</option>`).join('')}</select></label><p class="tiny">Simple rule: 1 drink removes 1 stroke from that hole’s score.</p><div class="divider"></div><div class="score-head"><div>Hole</div><div>Par</div><div>Shot</div><div>Drink</div><div>Net</div></div><div id="scoreRows">${c.holes.map((par,i)=>row(c,player,i,par)).join('')}</div></div></div>`;
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{state.selectedCourse=t.dataset.course;save();scores()}));
  $('#scorePlayer').addEventListener('change', e=>{state.scorePlayer=e.target.value;save();scores()});
  document.querySelectorAll('.scoreInput').forEach(inp=>inp.addEventListener('input',e=>{ const i=Number(e.target.dataset.i); state.scores[c.id][player][i]=e.target.value; save(); updateNets(c,player); }));
  document.querySelectorAll('.drinkInput').forEach(inp=>inp.addEventListener('input',e=>{ const i=Number(e.target.dataset.i); state.drinks[c.id][player][i]=e.target.value; save(); updateNets(c,player); }));
}
function row(c,player,i,par){
  const v=state.scores[c.id][player][i]||'';
  const drinks=state.drinks[c.id][player][i]||'';
  const net=v?scoreNet(v,drinks):'';
  const vsPar=net!==''?net-par:'';
  const netText=net===''?'—':`${net} (${vsPar>0?'+'+vsPar:vsPar})`;
  return `<div class="score-row"><div class="hole">${i+1}</div><div class="par">Par ${par}</div><input class="scoreInput" data-i="${i}" inputmode="numeric" value="${v}" placeholder="-"><input class="drinkInput" data-i="${i}" inputmode="numeric" value="${drinks}" placeholder="0"><div class="par net" data-i="${i}">${netText}</div></div>`;
}
function updateNets(c,player){
  document.querySelectorAll('.net').forEach(el=>{
    const i=Number(el.dataset.i), s=Number(state.scores[c.id][player][i]), d=Number(state.drinks[c.id][player][i]) || 0;
    if(!s){ el.textContent='—'; return; }
    const net=scoreNet(s,d), vsPar=net-c.holes[i];
    el.textContent=`${net} (${vsPar>0?'+'+vsPar:vsPar})`;
  });
}
function bets(){
 app.innerHTML = `<div class="section-title"><h3>Betting board</h3><small>Track the damage</small></div><div class="card"><div class="form-grid"><label>Players involved<input id="betPlayers" placeholder="e.g. James v Nick"></label><label>The bet<textarea id="betText" placeholder="e.g. Lowest net score at Los Arqueros"></textarea></label><label>Duration<input id="betDuration" placeholder="One round / whole trip / front 9"></label><label>Value<input id="betValue" placeholder="£10 / dinner / round of beers"></label><button class="btn" id="addBet">Log Bet</button></div></div><div class="section-title"><h3>Open bets</h3><small>${state.bets.length} logged</small></div><div class="stack">${state.bets.length?state.bets.map((b,i)=>`<div class="card bet"><div class="bet-top"><b>${b.players}</b><span class="value">${b.value}</span></div><span>${b.text}</span><small class="muted">${b.duration}</small><button class="btn secondary" onclick="state.bets.splice(${i},1);save();bets()">Settle / Remove</button></div>`).join(''):'<div class="card muted">No bets yet. Weak.</div>'}</div>`;
 $('#addBet').addEventListener('click',()=>{state.bets.unshift({players:$('#betPlayers').value||'Unnamed degenerates',text:$('#betText').value||'Mystery bet',duration:$('#betDuration').value||'Unknown duration',value:$('#betValue').value||'Pride'});save();toast('Bet logged');bets();});
}
function summary(){ const leaders=names.map(n=>({name:n,...totalFor(n),team:(state.players.find(p=>p.name===n)||{}).team})).sort((a,b)=>(a.total||9999)-(b.total||9999)); const tp=teamPoints();
 app.innerHTML = `<section class="hero"><h2>Live Standings</h2><p>PGA-style trip centre. Lower net total leads; net score is gross strokes minus drinks.</p><div class="hero-grid"><div class="stat"><b>${tp.pink||'—'}</b><span>Pink net</span></div><div class="stat"><b>${tp.purple||'—'}</b><span>Purple net</span></div><div class="stat"><b>${state.bets.length}</b><span>Open bets</span></div><div class="stat"><b>${state.currentFormat}</b><span>Format</span></div></div></section><div class="section-title"><h3>Leaderboard</h3><small>Net score</small></div><div class="stack">${leaders.map((p,i)=>`<div class="card leader"><div class="rank">${i+1}</div><div><b>${p.name}</b><br><small class="muted">${p.team || 'No team'} • ${p.played} holes • ${p.gross || 0} gross • ${p.drinks || 0} drinks</small></div><b>${p.total || '—'}</b></div>`).join('')}</div>`;
}
render();
