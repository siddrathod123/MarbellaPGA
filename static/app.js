const $ = (selector) => document.querySelector(selector);
const app = $('#app');
let state = null;
let leaderboard = [];
let view = 'score';
let selectedPlayer = '';
let selectedHole = 1;
let selectedStrokes = 4;
let selectedDrinks = 0;
let refreshTimer = null;

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: {'Content-Type': 'application/json'},
    ...options,
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error || 'Request failed');
  return data;
}

async function load(showToast = false) {
  const data = await api('/api/state');
  state = data.state;
  leaderboard = data.leaderboard;
  $('#gameTitle').textContent = state.game_name;
  if (!selectedPlayer && state.players.length) selectedPlayer = state.players[0].name;
  render();
  if (showToast) toast('Refreshed');
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1300);
}

function netClass(value) {
  if (value < 0) return 'under';
  if (value > 0) return 'over';
  return 'even';
}
function fmtVsPar(value) {
  if (value === 0) return 'E';
  return value > 0 ? `+${value}` : `${value}`;
}
function currentEntry() {
  return state?.scores?.[selectedPlayer]?.[selectedHole - 1] || null;
}
function setView(next) {
  view = next;
  document.querySelectorAll('.nav').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  render();
  window.scrollTo({top: 0, behavior: 'smooth'});
}

document.querySelectorAll('.nav').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
$('#refreshBtn').addEventListener('click', () => load(true));

function render() {
  if (!state) return;
  if (view === 'score') renderScore();
  if (view === 'leaderboard') renderLeaderboard();
  if (view === 'setup') renderSetup();
  if (view === 'card') renderCard();
}

function renderScore() {
  const par = Number(state.pars[selectedHole - 1]);
  const existing = currentEntry();
  if (existing) {
    selectedStrokes = Number(existing.strokes);
    selectedDrinks = Number(existing.drinks);
  } else if (selectedStrokes < 1) {
    selectedStrokes = par;
  }
  const net = selectedStrokes - selectedDrinks;
  const vsPar = net - par;

  app.innerHTML = `
    <section class="hero">
      <h2>Simple rule: drink = discount</h2>
      <p>Enter strokes and drinks for each hole. One drink removes one stroke. No Send It. No Double Down.</p>
    </section>

    <div class="grid">
      <div class="stat"><b>${selectedHole}</b><span>Hole</span></div>
      <div class="stat"><b>${par}</b><span>Par</span></div>
      <div class="stat"><b>${selectedStrokes}</b><span>Strokes</span></div>
      <div class="stat"><b>${selectedDrinks}</b><span>Drinks</span></div>
    </div>

    <div class="section-title"><h3>Record score</h3><small>${selectedPlayer}</small></div>
    <div class="card score-panel">
      <label>Player
        <select id="playerSelect">
          ${state.players.map(p => `<option value="${escapeHtml(p.name)}" ${p.name === selectedPlayer ? 'selected' : ''}>${escapeHtml(p.name)} · Group ${p.group}</option>`).join('')}
        </select>
      </label>

      <label>Hole
        <select id="holeSelect">
          ${Array.from({length: 18}, (_, i) => `<option value="${i + 1}" ${i + 1 === selectedHole ? 'selected' : ''}>Hole ${i + 1} · Par ${state.pars[i]}</option>`).join('')}
        </select>
      </label>

      <div>
        <label>Strokes</label>
        <div class="quick" id="strokesQuick">
          ${[1,2,3,4,5,6,7,8,9,10].map(n => `<button data-value="${n}" class="${n === selectedStrokes ? 'active' : ''}">${n}</button>`).join('')}
        </div>
      </div>

      <div>
        <label>Drinks</label>
        <div class="quick" id="drinksQuick">
          ${[0,1,2,3,4,5,6,7,8,9].map(n => `<button data-value="${n}" class="${n === selectedDrinks ? 'active' : ''}">${n}</button>`).join('')}
        </div>
      </div>

      <div class="net-preview ${netClass(vsPar)}">Net ${net} · ${fmtVsPar(vsPar)}</div>
      <button class="btn full" id="saveScore">Save hole</button>
      <button class="btn secondary full" id="clearScore">Clear this hole</button>
    </div>
  `;

  $('#playerSelect').addEventListener('change', e => { selectedPlayer = e.target.value; renderScore(); });
  $('#holeSelect').addEventListener('change', e => { selectedHole = Number(e.target.value); renderScore(); });
  $('#strokesQuick').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => { selectedStrokes = Number(btn.dataset.value); renderScore(); }));
  $('#drinksQuick').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => { selectedDrinks = Number(btn.dataset.value); renderScore(); }));
  $('#saveScore').addEventListener('click', saveScore);
  $('#clearScore').addEventListener('click', clearScore);
}

async function saveScore() {
  const data = await api('/api/score', {
    method: 'POST',
    body: JSON.stringify({player: selectedPlayer, hole: selectedHole, strokes: selectedStrokes, drinks: selectedDrinks})
  });
  state = data.state;
  leaderboard = data.leaderboard;
  toast('Score saved');
  if (selectedHole < 18) selectedHole += 1;
  render();
}

async function clearScore() {
  const data = await api('/api/score', {
    method: 'POST',
    body: JSON.stringify({player: selectedPlayer, hole: selectedHole, clear: true})
  });
  state = data.state;
  leaderboard = data.leaderboard;
  toast('Hole cleared');
  render();
}

function renderLeaderboard() {
  const groupOne = leaderboard.filter(p => p.group === 1).reduce((a, p) => a + (p.played ? p.net : 0), 0);
  const groupTwo = leaderboard.filter(p => p.group === 2).reduce((a, p) => a + (p.played ? p.net : 0), 0);
  app.innerHTML = `
    <section class="hero">
      <h2>Live leaderboard</h2>
      <p>Lowest net score leads. Net score is gross strokes minus drinks.</p>
    </section>
    <div class="grid two">
      <div class="stat"><b>${groupOne || '—'}</b><span>Group 1 net</span></div>
      <div class="stat"><b>${groupTwo || '—'}</b><span>Group 2 net</span></div>
    </div>
    <div class="section-title"><h3>Players</h3><small>Tap refresh for latest</small></div>
    <div class="player-list">
      ${leaderboard.map((p, i) => `
        <div class="leader-row">
          <div class="rank">${i + 1}</div>
          <div>
            <b>${escapeHtml(p.name)}</b><br>
            <span class="badge ${p.group === 1 ? 'g1' : 'g2'}">Group ${p.group}</span>
            <small class="muted"> ${p.played}/18 holes · ${p.drinks} drinks</small>
          </div>
          <div class="score-big ${netClass(p.versus_par)}">${p.played ? p.net : '—'}<br><small>${p.played ? fmtVsPar(p.versus_par) : ''}</small></div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSetup() {
  app.innerHTML = `
    <section class="hero"><h2>Game setup</h2><p>Set player names, groups, and the par for every hole.</p></section>
    <div class="card form">
      <label>Game name <input id="gameName" value="${escapeAttr(state.game_name)}"></label>
      <div class="section-title"><h3>Players</h3><small>Max 8</small></div>
      <div id="playersSetup" class="form">
        ${state.players.map((p, i) => `
          <div class="grid two">
            <label>Player ${i + 1}<input class="playerName" data-i="${i}" value="${escapeAttr(p.name)}"></label>
            <label>Group<select class="playerGroup" data-i="${i}"><option value="1" ${p.group === 1 ? 'selected' : ''}>Group 1</option><option value="2" ${p.group === 2 ? 'selected' : ''}>Group 2</option></select></label>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="section-title"><h3>Hole pars</h3><small>3 to 6</small></div>
    <div class="card">
      <div class="par-grid">
        ${state.pars.map((par, i) => `<label class="par-cell"><span>Hole ${i + 1}</span><input class="parInput" data-i="${i}" inputmode="numeric" value="${par}"></label>`).join('')}
      </div>
      <br>
      <button class="btn full" id="saveSettings">Save setup</button>
      <br><br>
      <button class="btn secondary full" id="resetScores">Reset scores only</button>
      <br><br>
      <button class="btn danger full" id="resetAll">Reset everything</button>
    </div>
  `;
  $('#saveSettings').addEventListener('click', saveSettings);
  $('#resetScores').addEventListener('click', async () => {
    if (!confirm('Reset all scores?')) return;
    const data = await api('/api/reset_scores', {method: 'POST'});
    state = data.state; leaderboard = data.leaderboard; toast('Scores reset'); render();
  });
  $('#resetAll').addEventListener('click', async () => {
    if (!confirm('Reset the whole game?')) return;
    const data = await api('/api/reset_all', {method: 'POST'});
    state = data.state; leaderboard = data.leaderboard; toast('Game reset'); render();
  });
}

async function saveSettings() {
  const players = state.players.map((p, i) => ({
    name: document.querySelector(`.playerName[data-i="${i}"]`).value,
    group: Number(document.querySelector(`.playerGroup[data-i="${i}"]`).value),
  }));
  const pars = Array.from(document.querySelectorAll('.parInput')).map(input => Number(input.value || 4));
  const data = await api('/api/settings', {
    method: 'POST',
    body: JSON.stringify({game_name: $('#gameName').value, players, pars})
  });
  state = data.state;
  leaderboard = data.leaderboard;
  selectedPlayer = state.players[0]?.name || '';
  toast('Setup saved');
  render();
}

function renderCard() {
  app.innerHTML = `
    <section class="hero"><h2>Full scorecard</h2><p>Gross / drinks / net for every player and hole.</p></section>
    <div class="card table">
      <table class="scorecard">
        <thead>
          <tr><th>Player</th>${Array.from({length: 18}, (_, i) => `<th>H${i+1}<br><small>Par ${state.pars[i]}</small></th>`).join('')}<th>Total</th></tr>
        </thead>
        <tbody>
          ${state.players.map(player => {
            const holes = state.scores[player.name] || [];
            const row = leaderboard.find(x => x.name === player.name) || {net: 0, played: 0};
            return `<tr class="data"><td><b>${escapeHtml(player.name)}</b><br><small>Group ${player.group}</small></td>${holes.map(entry => `<td>${entry ? `${entry.strokes}/${entry.drinks}<br><b>${entry.net}</b>` : '—'}</td>`).join('')}<td><b>${row.played ? row.net : '—'}</b></td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function escapeAttr(value) { return escapeHtml(value); }

load();
refreshTimer = setInterval(() => load(false), 15000);
