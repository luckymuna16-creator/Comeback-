(() => {
'use strict';

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const key = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const doy = () => { const n = new Date(); return Math.floor((n - new Date(n.getFullYear(), 0, 0)) / 864e5); };
const fmtClock = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtTimer = ms => { const s = Math.floor(ms / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };

/* ---------- content ---------- */
const QUOTES = [
  'Nobody is coming. Go anyway.',
  'Show up before you feel ready.',
  'Ten minutes beats zero. Every time.',
  'Your old self is a story. Write the next page today.',
  'Discipline is a promise you keep when no one is watching.',
  'The shoes do not care how you feel. Put them on.',
  'Quiet mornings build loud results.',
  'You were built for the start line.',
  'Comfort is a slow way to lose.',
  'Do not negotiate with the alarm.',
  'Small steps, taken daily, get loud.',
  'Proof beats promises. Collect proof today.',
  'Nobody is watching as closely as you think. Run anyway.',
  'Be the person who already did it.',
  'The first mile is an argument with your mind. Win it.',
  'Rest is part of the work. Quitting is not.',
  'Today\u2019s effort is tomorrow\u2019s identity.',
  'Start in the dark. Finish in the light.',
  'One more day of proof.',
  'Slow is still moving.',
  'You have done hard things before. Do one now.',
  'Be the champion in the room, even when the room is empty.',
  'Get up. Lace up. Show up.',
  'Motivation starts it. Discipline repeats it.',
  'Every morning you rise is a vote for who you are becoming.'
];

const PUSHES = [
  'Walk or run for 10 minutes. Nothing more is required.',
  'Lay out your running shoes tonight so tomorrow has no excuses.',
  'Run where people can see you. Let them.',
  'Greet one person you pass on the road.',
  'Do 20 push-ups before breakfast.',
  'Drink a full glass of water before you touch your phone.',
  'Run 5 minutes easy, then 5 minutes a little faster.',
  'Stretch for 10 minutes. Legs first.',
  'Keep your phone away for the first 30 minutes of the day.',
  'Write down one thing you did that the old you would have skipped.',
  'Jog one slow kilometre. Pace does not matter.',
  'Tell one person about your running goal.',
  'Hold a one-minute plank.',
  'Splash cold water on your face, then go outside.'
];

const DEFAULTS = {
  why: 'I was a champion. I am coming back.',
  habits: [
    { id: 'h1', name: 'Up early' },
    { id: 'h2', name: 'Water before phone' },
    { id: 'h3', name: 'Moved my body' },
    { id: 'h4', name: 'No phone for 30 minutes' },
    { id: 'h5', name: 'Stretched' }
  ],
  quotes: [],
  alarms: [{ id: 'a1', time: '05:30', label: 'Get up. Lace up.', days: [0, 1, 2, 3, 4, 5, 6], on: false }],
  days: {},
  heroId: null,
  seeded: false,
  bw: true,
  timerStart: null,
  lastRing: ''
};

/* ---------- state ---------- */
const LS = 'comeback.v1';
let S;
try { S = { ...structuredClone(DEFAULTS), ...JSON.parse(localStorage.getItem(LS) || '{}') }; }
catch { S = structuredClone(DEFAULTS); }
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch {} };
const dayRec = k => (S.days[k] ||= {});
const allQuotes = () => QUOTES.concat(S.quotes);

/* ---------- picture storage (IndexedDB) ---------- */
const idb = new Promise((res, rej) => {
  const r = indexedDB.open('comeback', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('pics', { keyPath: 'id' });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => {
  const db = await idb;
  return new Promise((res, rej) => {
    const t = db.transaction('pics', mode);
    const rq = fn(t.objectStore('pics'));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = () => rej(t.error);
  });
};
let PICS = [];
async function loadPics() {
  PICS.forEach(p => URL.revokeObjectURL(p.url));
  let all = [];
  try { all = await tx('readonly', s => s.getAll()); } catch {}
  all.sort((a, b) => a.added - b.added);
  PICS = all.map(p => ({ id: p.id, added: p.added, url: URL.createObjectURL(p.blob) }));
}
async function seedPics() {
  if (S.seeded) return;
  const seeds = ['assets/seed-panther.jpg', 'assets/seed-comeback.jpg', 'assets/seed-collage.jpg'];
  try {
    let t = Date.now();
    for (const url of seeds) {
      const blob = await (await fetch(url)).blob();
      await tx('readwrite', s => s.put({ id: uid(), blob, added: t++ }));
    }
    S.seeded = true; save();
  } catch {}
}
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file);
    const sc = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  } catch { return file; }
}

/* ---------- streaks ---------- */
function streaks() {
  let cur = 0;
  const d = new Date();
  if (S.days[key(d)]?.productive === undefined) d.setDate(d.getDate() - 1);
  while (S.days[key(d)]?.productive === true) { cur++; d.setDate(d.getDate() - 1); }
  const keys = Object.keys(S.days).filter(k => S.days[k].productive === true).sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    const t = new Date(k + 'T00:00:00');
    run = prev && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = t;
  }
  return { cur, best };
}

/* ---------- toast ---------- */
let toastT;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------- hero picture ---------- */
let heroOffset = 0;
function heroPic() {
  if (!PICS.length) return null;
  const pinned = PICS.find(p => p.id === S.heroId);
  if (pinned && !heroOffset) return pinned;
  return PICS[(doy() + heroOffset) % PICS.length];
}

/* ---------- TODAY ---------- */
let timerInt = null;
function renderToday() {
  const k = key(), d = S.days[k] || {};
  const { cur, best } = streaks();
  const pic = heroPic();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const done = S.habits.filter(h => d.habits?.[h.id]).length;
  const running = !!S.timerStart;

  $('#v-today').innerHTML = `
    <div class="hero" data-act="heroNext">
      <div class="hero-img ${pic ? '' : 'empty'}" ${pic ? `style="background-image:url('${pic.url}')"` : ''}></div>
      <div class="hero-text">
        <p class="hero-date">${greet}. ${esc(dateStr)}</p>
        <h1 data-act="editWhy">${esc(S.why)}</h1>
        <div class="hero-stats">
          <div><b>${cur}</b><span>Day streak</span></div>
          <div><b>${best}</b><span>Best</span></div>
          <div><b>${d.minutes || 0}</b><span>Minutes today</span></div>
        </div>
      </div>
    </div>

    <div class="stack">
      <section class="card">
        <h2>Today\u2019s push</h2>
        <p>${esc(PUSHES[doy() % PUSHES.length])}</p>
        ${running
          ? `<div class="timer" id="tmr">${fmtTimer(Date.now() - S.timerStart)}</div>
             <button class="btn block" data-act="timerStop">Finish and log it</button>`
          : `<button class="btn block" data-act="timerStart">Start the 10-minute rule</button>`}
      </section>

      <section class="card">
        <div class="head"><h2>Morning checklist</h2><small>${done} of ${S.habits.length}</small></div>
        ${S.habits.map(h => `
          <button class="row ${d.habits?.[h.id] ? 'on' : ''}" data-act="habit" data-id="${h.id}">
            <i class="box"></i><span>${esc(h.name)}</span>
          </button>`).join('') || '<p>Add habits in settings.</p>'}
      </section>

      <section class="card">
        <h2>Move log</h2>
        <div class="two">
          <label class="f">Minutes moved
            <input type="number" inputmode="numeric" min="0" id="mv-min" value="${d.minutes || ''}" placeholder="0">
          </label>
          <label class="f">Distance in km
            <input type="number" inputmode="decimal" min="0" step="0.1" id="mv-km" value="${d.km || ''}" placeholder="0.0">
          </label>
        </div>
      </section>

      <section class="card">
        <h2>Did you make today productive?</h2>
        <div class="yn">
          <button data-act="yes" class="${d.productive === true ? 'on' : ''}">Yes</button>
          <button data-act="no" class="no ${d.productive === false ? 'on' : ''}">No</button>
        </div>
        <textarea id="note" placeholder="One line: what made it count?">${esc(d.note || '')}</textarea>
      </section>
    </div>`;

  clearInterval(timerInt);
  if (running) timerInt = setInterval(() => {
    const el = $('#tmr'); if (el) el.textContent = fmtTimer(Date.now() - S.timerStart);
  }, 1000);
}

/* ---------- WALL ---------- */
function renderWall() {
  $('#v-wall').innerHTML = `
    <h1>Wall</h1>
    <p class="sub">Pictures that pull you out of bed. Tap one to open it.</p>
    <button class="btn block" data-act="addPics" style="margin-top:0">Add pictures</button>
    ${PICS.length
      ? `<div class="grid">${PICS.map(p => `
          <button class="tile ${p.id === S.heroId ? 'pin' : ''}" data-act="openPic" data-id="${p.id}">
            <img src="${p.url}" alt="Motivation picture" loading="lazy">
          </button>`).join('')}</div>`
      : `<div class="empty-note"><b>Your wall is empty</b>Add the pictures that make you want to move.</div>`}`;
}

let vi = 0;
function openViewer(id) {
  vi = Math.max(0, PICS.findIndex(p => p.id === id));
  showViewer(); $('#viewer').hidden = false;
}
function showViewer() {
  if (!PICS.length) { $('#viewer').hidden = true; return; }
  vi = (vi + PICS.length) % PICS.length;
  $('#viewer img').src = PICS[vi].url;
}

/* ---------- PROGRESS ---------- */
function renderProgress() {
  const { cur, best } = streaks();
  let yes30 = 0, totalMin = 0, totalKm = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (S.days[key(d)]?.productive === true) yes30++;
  }
  Object.values(S.days).forEach(r => { totalMin += +r.minutes || 0; totalKm += +r.km || 0; });

  // heatmap: five weeks, Monday first, ending this week
  const mon = new Date(today);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) - 28);
  let cells = '';
  for (let i = 0; i < 35; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    const k = key(d), r = S.days[k];
    const cls = d > today && k !== key(today) ? 'f' : r?.productive === true ? 'y' : r?.productive === false ? 'n' : '';
    cells += `<div class="cell ${cls} ${k === key(today) ? 't' : ''}" title="${k}"></div>`;
  }

  // last 7 days of movement
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    week.push({ l: d.toLocaleDateString(undefined, { weekday: 'narrow' }), m: +S.days[key(d)]?.minutes || 0 });
  }
  const mx = Math.max(30, ...week.map(w => w.m));
  const notes = Object.keys(S.days).filter(k => S.days[k].note).sort().reverse().slice(0, 5);

  $('#v-progress').innerHTML = `
    <h1>Progress</h1>
    <p class="sub">Proof of what you have actually done.</p>
    <div class="stats">
      <div class="stat"><b>${cur}</b><span>Day streak</span></div>
      <div class="stat"><b>${best}</b><span>Best streak</span></div>
      <div class="stat"><b>${yes30}</b><span>Yes days, last 30</span></div>
    </div>
    <div class="stats">
      <div class="stat"><b>${Math.round(totalMin)}</b><span>Minutes moved</span></div>
      <div class="stat"><b>${totalKm.toFixed(1)}</b><span>Kilometres</span></div>
      <div class="stat"><b>${Object.values(S.days).filter(r => r.productive === true).length}</b><span>Yes days total</span></div>
    </div>
    <section class="card" style="margin-bottom:14px">
      <div class="head"><h2>Last five weeks</h2><small>Filled is yes, outlined is no</small></div>
      <div class="heat">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<div class="wd">${x}</div>`).join('')}${cells}</div>
    </section>
    <section class="card" style="margin-bottom:14px">
      <div class="head"><h2>This week\u2019s movement</h2><small>Minutes</small></div>
      <div class="bars">${week.map(w => `
        <div class="bar"><em>${w.m || ''}</em><i class="${w.m ? '' : 'z'}" style="height:${w.m ? Math.max(4, w.m / mx * 80) : 3}%"></i><span>${w.l}</span></div>`).join('')}
      </div>
    </section>
    ${notes.length ? `<section class="card"><h2>Your own words</h2>${notes.map(k => `
      <div class="note"><small>${new Date(k + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</small>${esc(S.days[k].note)}</div>`).join('')}</section>` : ''}`;
}

/* ---------- ALARMS ---------- */
const DAY_L = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
function renderAlarm() {
  $('#v-alarm').innerHTML = `
    <h1>Alarm</h1>
    <p class="sub">No snooze. You hold a button to prove you are up.</p>
    <div class="warn"><b>Be honest with yourself:</b> an installed web app cannot ring while the phone is locked or the app is closed. For a sure wake-up, tap <b>Arm for tonight</b> before bed and keep the phone charging. Also keep your normal phone alarm as a backup.</div>
    <button class="btn block" data-act="arm" style="margin:0 0 16px">Arm for tonight</button>
    ${S.alarms.map(a => `
      <div class="alarm ${a.on ? '' : 'off'}">
        <div class="top">
          <input type="time" value="${a.time}" data-aid="${a.id}" data-f="time" aria-label="Alarm time">
          <button class="sw ${a.on ? 'on' : ''}" data-act="alarmToggle" data-aid="${a.id}" aria-label="Turn alarm on or off" aria-pressed="${a.on}"></button>
        </div>
        <input type="text" class="lbl" value="${esc(a.label)}" data-aid="${a.id}" data-f="label" placeholder="What is this alarm for?">
        <div class="days">${DAY_L.map((l, i) => `<button class="${a.days.includes(i) ? 'on' : ''}" data-act="alarmDay" data-aid="${a.id}" data-d="${i}">${l}</button>`).join('')}</div>
        <div class="foot"><button class="link" data-act="alarmDel" data-aid="${a.id}">Delete alarm</button></div>
      </div>`).join('')}
    <button class="btn ghost block" data-act="alarmAdd" style="margin-top:0">Add alarm</button>
    <button class="link" data-act="testRing" style="margin-top:12px">Test the alarm sound</button>`;
}

let AC = null;
function unlockAudio() {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
  } catch {}
}
document.addEventListener('pointerdown', unlockAudio);

function beep() {
  if (!AC) return;
  const t = AC.currentTime;
  [0, 0.2, 0.4].forEach((o, i) => {
    const osc = AC.createOscillator(), g = AC.createGain();
    osc.type = 'square'; osc.frequency.value = 760 + i * 200;
    g.gain.setValueAtTime(0.0001, t + o);
    g.gain.exponentialRampToValueAtTime(0.3, t + o + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.16);
    osc.connect(g); g.connect(AC.destination);
    osc.start(t + o); osc.stop(t + o + 0.18);
  });
}

let ringInt = null, ringing = false;
function ring(a) {
  if (ringing) return;
  ringing = true;
  const now = new Date();
  $('#ring-time').textContent = fmtClock(now);
  $('#ring-label').textContent = a.label || 'Get up.';
  const q = allQuotes();
  $('#ring-quote').textContent = q[Math.floor(Math.random() * q.length)];
  $('#ring').hidden = false;
  unlockAudio(); beep();
  ringInt = setInterval(() => { beep(); navigator.vibrate?.([300, 150, 300]); }, 1200);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready.then(r => r.showNotification('Comeback', {
      body: a.label || 'Get up.', tag: 'alarm', requireInteraction: true, vibrate: [300, 150, 300], icon: 'icons/icon-192.png'
    })).catch(() => {});
  }
}
function stopRing() {
  clearInterval(ringInt); ringing = false;
  $('#ring').hidden = true;
  navigator.vibrate?.(0);
  showTab('today');
  toast('You are up. The hardest part is done.');
}

// hold-to-stop
let holdT = null;
const hold = $('#hold');
const holdStart = e => {
  e.preventDefault(); unlockAudio();
  hold.classList.add('holding');
  clearTimeout(holdT); holdT = setTimeout(() => { hold.classList.remove('holding'); stopRing(); }, 2500);
};
const holdEnd = () => { clearTimeout(holdT); hold.classList.remove('holding'); };
hold.addEventListener('pointerdown', holdStart);
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => hold.addEventListener(ev, holdEnd));

// check alarms every second; also catches an alarm missed in the last 20 minutes
function tick() {
  const n = new Date();
  const nowMin = n.getHours() * 60 + n.getMinutes();
  for (const a of S.alarms) {
    if (!a.on || !a.days.includes(n.getDay())) continue;
    const [h, m] = a.time.split(':').map(Number);
    const diff = nowMin - (h * 60 + m);
    const stamp = key(n) + a.id + a.time;
    if (diff >= 0 && diff < 20 && S.lastRing !== stamp && !ringing) {
      S.lastRing = stamp; save(); ring(a);
    }
  }
  if (!$('#armed').hidden) {
    $('#armed-clock').textContent = fmtClock(n);
  }
}
setInterval(tick, 1000);

function nextAlarm() {
  const now = new Date(); let best = null;
  for (const a of S.alarms) {
    if (!a.on || !a.days.length) continue;
    const [h, m] = a.time.split(':').map(Number);
    for (let o = 0; o < 8; o++) {
      const d = new Date(now); d.setDate(now.getDate() + o); d.setHours(h, m, 0, 0);
      if (d > now && a.days.includes(d.getDay())) { if (!best || d < best.d) best = { d, a }; break; }
    }
  }
  return best;
}

let wl = null, armed = false;
async function lockOn() { try { wl = await navigator.wakeLock?.request('screen'); } catch {} }
async function arm() {
  unlockAudio();
  if (!S.alarms.some(a => a.on)) { toast('Turn on an alarm first.'); return; }
  if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch {} }
  armed = true; await lockOn();
  const nx = nextAlarm();
  $('#armed-next').textContent = nx
    ? `Next alarm ${fmtClock(nx.d)}. Keep the phone charging and this screen open.`
    : 'No upcoming alarm.';
  $('#armed-clock').textContent = fmtClock(new Date());
  $('#armed').hidden = false;
}
function disarm() {
  armed = false; wl?.release?.(); wl = null; $('#armed').hidden = true;
}
document.addEventListener('visibilitychange', () => {
  if (armed && document.visibilityState === 'visible') lockOn();
  tick();
});

/* ---------- quote bar ---------- */
let qi = doy() % allQuotes().length;
function showQuote(next) {
  const a = allQuotes(); if (next) qi = (qi + 1) % a.length;
  const el = $('#quote span');
  el.classList.add('out');
  setTimeout(() => { el.textContent = a[qi % a.length]; el.classList.remove('out'); }, 250);
}
setInterval(() => showQuote(true), 15000);

/* ---------- settings sheet ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

function renderSheet() {
  $('#sheet').innerHTML = `
    <div class="panel">
      <div class="line" style="border:0;padding-top:0"><h2>Settings</h2><button class="x" data-act="closeSheet">Done</button></div>

      <h3>Your why</h3>
      <textarea id="s-why" rows="2">${esc(S.why)}</textarea>

      <h3>Pictures</h3>
      <div class="line"><span>Show pictures in black and white</span>
        <button class="sw ${S.bw ? 'on' : ''}" data-act="bw" aria-label="Black and white pictures" aria-pressed="${S.bw}"></button></div>

      <h3>Morning checklist</h3>
      ${S.habits.map(h => `<div class="line"><span>${esc(h.name)}</span><button class="x" data-act="delHabit" data-id="${h.id}">Remove</button></div>`).join('')}
      <div class="add"><input type="text" id="s-habit" placeholder="New habit"><button data-act="addHabit">Add</button></div>

      <h3>Your own quotes</h3>
      ${S.quotes.map((q, i) => `<div class="line"><span>${esc(q)}</span><button class="x" data-act="delQuote" data-i="${i}">Remove</button></div>`).join('')}
      <div class="add"><input type="text" id="s-quote" placeholder="Write a line that moves you"><button data-act="addQuote">Add</button></div>

      <h3>Install and backup</h3>
      <div class="btnrow">
        <button class="btn" data-act="install">Install app</button>
        <button class="btn ghost" data-act="export">Export data</button>
        <button class="btn ghost" data-act="import">Import data</button>
      </div>
      <p class="sub" style="margin:10px 0 0">Export saves your progress, alarms and settings. Pictures stay on this device.</p>

      <h3>Reset</h3>
      <button class="btn ghost" data-act="reset" style="margin-top:0">Erase progress and start fresh</button>
    </div>`;
}
function openSheet() { renderSheet(); $('#sheet').hidden = false; }
function closeSheet() {
  const w = $('#s-why'); if (w && w.value.trim()) S.why = w.value.trim();
  save(); $('#sheet').hidden = true; refresh();
}

/* ---------- navigation ---------- */
let tab = 'today';
function showTab(t) {
  tab = t;
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + t));
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  refresh();
  window.scrollTo(0, 0);
}
function refresh() {
  ({ today: renderToday, wall: renderWall, progress: renderProgress, alarm: renderAlarm })[tab]();
  document.body.classList.toggle('bw', S.bw);
}

/* ---------- actions ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, id = el.dataset.id, aid = el.dataset.aid;
  const k = key();

  switch (act) {
    case 'tab': showTab(el.dataset.tab); break;
    case 'settings': openSheet(); break;
    case 'closeSheet': closeSheet(); break;
    case 'quoteNext': showQuote(true); break;

    case 'editWhy': {
      const v = prompt('Why are you doing this?', S.why);
      if (v && v.trim()) { S.why = v.trim(); save(); renderToday(); }
      break;
    }
    case 'heroNext': {
      if (!PICS.length) break;
      heroOffset++;
      const p = heroPic();
      $('.hero-img').style.backgroundImage = `url('${p.url}')`;
      break;
    }

    case 'timerStart': S.timerStart = Date.now(); save(); renderToday(); break;
    case 'timerStop': {
      const mins = Math.max(1, Math.round((Date.now() - S.timerStart) / 60000));
      S.timerStart = null;
      const r = dayRec(k); r.minutes = (+r.minutes || 0) + mins; save(); renderToday();
      toast(`${mins} min logged. That counts.`); break;
    }
    case 'habit': {
      const r = dayRec(k); r.habits ||= {}; r.habits[id] = !r.habits[id]; save(); renderToday(); break;
    }
    case 'yes': case 'no': {
      const r = dayRec(k); r.productive = act === 'yes'; save(); renderToday();
      toast(act === 'yes' ? `Proof collected. Streak: ${streaks().cur}` : 'Tomorrow is a clean page. Be here in the morning.');
      break;
    }

    case 'addPics': $('#pic-input').click(); break;
    case 'openPic': openViewer(id); break;
    case 'closeViewer': $('#viewer').hidden = true; refresh(); break;
    case 'viewPrev': vi--; showViewer(); break;
    case 'viewNext': vi++; showViewer(); break;
    case 'pinPic': S.heroId = PICS[vi].id; heroOffset = 0; save(); toast('Set as your home picture.'); break;
    case 'delPic': {
      if (!confirm('Delete this picture?')) break;
      const p = PICS[vi]; await tx('readwrite', s => s.delete(p.id));
      if (S.heroId === p.id) S.heroId = null; save();
      await loadPics(); vi = Math.min(vi, PICS.length - 1); showViewer(); refresh(); break;
    }

    case 'alarmAdd': S.alarms.push({ id: uid(), time: '06:00', label: '', days: [1, 2, 3, 4, 5, 6, 0], on: true }); save(); renderAlarm(); break;
    case 'alarmDel': S.alarms = S.alarms.filter(a => a.id !== aid); save(); renderAlarm(); break;
    case 'alarmToggle': { const a = S.alarms.find(a => a.id === aid); a.on = !a.on; save(); renderAlarm(); break; }
    case 'alarmDay': {
      const a = S.alarms.find(a => a.id === aid), d = +el.dataset.d;
      a.days = a.days.includes(d) ? a.days.filter(x => x !== d) : [...a.days, d]; save(); renderAlarm(); break;
    }
    case 'arm': arm(); break;
    case 'disarm': disarm(); break;
    case 'testRing': unlockAudio(); ring({ label: 'This is a test. Hold the button to stop.' }); break;

    case 'bw': S.bw = !S.bw; save(); renderSheet(); document.body.classList.toggle('bw', S.bw); break;
    case 'addHabit': {
      const v = $('#s-habit').value.trim(); if (!v) break;
      S.habits.push({ id: uid(), name: v }); save(); renderSheet(); break;
    }
    case 'delHabit': S.habits = S.habits.filter(h => h.id !== id); save(); renderSheet(); break;
    case 'addQuote': {
      const v = $('#s-quote').value.trim(); if (!v) break;
      S.quotes.push(v); save(); renderSheet(); break;
    }
    case 'delQuote': S.quotes.splice(+el.dataset.i, 1); save(); renderSheet(); break;

    case 'install':
      if (installEvt) { installEvt.prompt(); installEvt = null; }
      else if (matchMedia('(display-mode: standalone)').matches) toast('Already installed.');
      else toast('Open your browser menu and choose Add to Home Screen.');
      break;
    case 'export': {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `comeback-backup-${key()}.json`; a.click(); break;
    }
    case 'import': $('#import-input').click(); break;
    case 'reset':
      if (confirm('Erase all progress, alarms and settings? Pictures stay.')) {
        const seeded = S.seeded; S = { ...structuredClone(DEFAULTS), seeded }; save(); $('#sheet').hidden = true; refresh();
      }
      break;
  }
});

document.addEventListener('change', async e => {
  const t = e.target;
  const k = key();
  if (t.id === 'mv-min') { dayRec(k).minutes = Math.max(0, +t.value || 0); save(); }
  else if (t.id === 'mv-km') { dayRec(k).km = Math.max(0, +t.value || 0); save(); }
  else if (t.id === 'note') { dayRec(k).note = t.value.trim(); save(); }
  else if (t.dataset.aid) {
    const a = S.alarms.find(a => a.id === t.dataset.aid);
    if (a) { a[t.dataset.f] = t.value; save(); }
  } else if (t.id === 'pic-input') {
    const files = [...t.files]; if (!files.length) return;
    toast('Adding pictures\u2026');
    let time = Date.now();
    for (const f of files) {
      const blob = await shrink(f);
      await tx('readwrite', s => s.put({ id: uid(), blob, added: time++ }));
    }
    t.value = ''; await loadPics(); refresh(); toast(`${files.length} added to your wall.`);
  } else if (t.id === 'import-input') {
    const f = t.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      S = { ...structuredClone(DEFAULTS), ...data, seeded: S.seeded }; save(); $('#sheet').hidden = true; refresh(); toast('Data imported.');
    } catch { toast('That file could not be read.'); }
    t.value = '';
  }
});

/* ---------- boot ---------- */
(async function init() {
  document.body.classList.toggle('bw', S.bw);
  $('#quote span').textContent = allQuotes()[qi];
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  await seedPics();
  await loadPics();
  refresh();
})();
})();
