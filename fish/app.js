/* Fathom — game logic. Static, no backend of its own: the daily fish is
   derived from the date, and progress is saved as described under "state". */
(function () {
  'use strict';
  const { AREAS, REGIONS, DIETS, RARITY, FISH, ORIGINAL_COUNT } = window.FATHOM_DATA;
  const { DECOR, TANKS, RODS, FLOATS } = window.FathomScene;
  const LOOKS = { rod: RODS, float: FLOATS };
  const BY_ID = {}, AREA = {};
  FISH.forEach(f => { BY_ID[f.id] = f; });
  AREAS.forEach((a, i) => { a.i = i; AREA[a.id] = a; });
  const SORTED = FISH.slice().sort((a, b) => a.name.localeCompare(b.name));

  const MAX_GUESSES = 6;
  const EPOCH = new Date(2026, 10, 26); // Daily Catch #1, local time
  const KEY = 'fathom.v1';
  const GEAR = [
    { id: 'rod', name: 'Rod', desc: 'Widens the green zone on the tension bar.' },
    { id: 'reel', name: 'Reel', desc: 'Brings fish in faster.' },
    { id: 'line', name: 'Line', desc: 'Takes more strain before it snaps.' },
    { id: 'lure', name: 'Lures', desc: 'Rarer fish bite more often.' }
  ];
  const GEAR_COST = [120, 450, 1400, 4000];

  const $ = id => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- state ----------------
     Progress is kept in two places. localStorage is instant but a browser or
     app can empty it at any time. Where the page runs as a Claude artifact
     and the player is signed in, a private per-player document is the durable
     copy, and the two are merged whenever the page loads. */
  function fresh() {
    return {
      v: 1, t: 0, base: null, pending: null, rev: '', seenHelp: false,
      daily: { days: {}, stats: { played: 0, wins: 0, streak: 0, best: 0, lastWin: 0, dist: [0, 0, 0, 0, 0, 0] } },
      col: { coins: 0, bait: 0, useBait: false, caught: {}, seen: {}, unlocked: ['pond'], area: 'pond', gear: { rod: 0, reel: 0, line: 0, lure: 0 } },
      tank: { size: 0, fish: [], decor: {}, set: false },
      style: { rod: 'classic', float: 'classic', own: {} },
      bounty: { day: 0, id: '', done: false }
    };
  }
  const num = (v, d, lo, hi) => { v = Number(v); return Number.isFinite(v) ? clamp(v, lo, hi) : d; };
  const int = (v, d, lo, hi) => Math.floor(num(v, d, lo, hi));
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

  /* Rebuild a save from stored data, keeping only what is well-formed. */
  function adopt(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
    const o = fresh(), d = obj(raw.daily), c = obj(raw.col), days = obj(d.days), st = obj(d.stats);
    o.t = num(raw.t, 0, 0, 1e15);
    o.seenHelp = !!raw.seenHelp;
    for (const k of Object.keys(days)) {
      const n = Number(k), x = days[k];
      if (!Number.isInteger(n) || !x || !BY_ID[x.a] || !Array.isArray(x.g)) continue;
      const day = { a: x.a, g: x.g.filter(id => typeof id === 'string' && BY_ID[id]).slice(0, MAX_GUESSES), done: !!x.done, won: !!x.won };
      if (x.reward && typeof x.reward === 'object') day.reward = { coins: int(x.reward.coins, 0, 0, 1e6), bait: int(x.reward.bait, 0, 0, 100) };
      o.daily.days[n] = day;
    }
    ['played', 'wins', 'streak', 'best', 'lastWin'].forEach(k => { o.daily.stats[k] = int(st[k], 0, 0, 1e7); });
    if (Array.isArray(st.dist)) o.daily.stats.dist = o.daily.stats.dist.map((_, n) => int(st.dist[n], 0, 0, 1e7));
    o.col.coins = int(c.coins, 0, 0, 1e12);
    o.col.bait = int(c.bait, 0, 0, 1e6);
    o.col.useBait = !!c.useBait;
    const caught = obj(c.caught), seen = obj(c.seen), unlocked = Array.isArray(c.unlocked) ? c.unlocked : [];
    for (const id of Object.keys(caught)) if (BY_ID[id] && caught[id]) o.col.caught[id] = { n: int(caught[id].n, 1, 1, 1e9), best: num(caught[id].best, 0.3, 0, 1), g: int(caught[id].g, 0, 0, 1e9) };
    for (const id of Object.keys(seen)) if (BY_ID[id] && seen[id]) o.col.seen[id] = true;
    o.col.unlocked = AREAS.filter(x => x.id === 'pond' || unlocked.includes(x.id)).map(x => x.id);
    GEAR.forEach(g => { o.col.gear[g.id] = int(obj(c.gear)[g.id], 0, 0, GEAR_COST.length); });
    o.col.area = AREA[c.area] && o.col.unlocked.includes(c.area) ? c.area : 'pond';
    const tk = obj(raw.tank), dc = obj(tk.decor), bo = obj(raw.bounty);
    o.tank.size = int(tk.size, 0, 0, TANKS.length - 1);
    o.tank.fish = (Array.isArray(tk.fish) ? tk.fish : []).filter((id, n, arr) => typeof id === 'string' && BY_ID[id] && arr.indexOf(id) === n).slice(0, 40);
    DECOR.forEach(x => { if (x.id in dc) o.tank.decor[x.id] = dc[x.id] ? 1 : 0; });
    o.tank.set = !!tk.set;
    const sty = obj(raw.style), own = obj(sty.own);
    ['rod', 'float'].forEach(kind => {
      LOOKS[kind].forEach(x => { if (x.cost && own[kind + ':' + x.id]) o.style.own[kind + ':' + x.id] = 1; });
      const pick = LOOKS[kind].find(x => x.id === sty[kind]);
      if (pick && (!pick.cost || o.style.own[kind + ':' + pick.id])) o.style[kind] = pick.id;
    });
    if (BY_ID[bo.id]) o.bounty = { day: int(bo.day, 0, 0, 1e7), id: bo.id, done: !!bo.done };
    if (raw.base && typeof raw.base === 'object') o.base = { coins: int(raw.base.coins, 0, 0, 1e12), bait: int(raw.base.bait, 0, 0, 1e6) };
    const pd = raw.pending;
    if (pd && typeof pd === 'object' && typeof pd.rev === 'string') o.pending = { rev: pd.rev.slice(0, 40), coins: int(pd.coins, 0, 0, 1e12), bait: int(pd.bait, 0, 0, 1e6) };
    if (typeof raw.rev === 'string') o.rev = raw.rev.slice(0, 40);
    return o;
  }
  function load() {
    try { return adopt(JSON.parse(localStorage.getItem(KEY))) || fresh(); }
    catch (e) { return fresh(); } // storage unavailable or corrupt
  }
  const S = load();
  function save() {
    const keys = Object.keys(S.daily.days).map(Number).sort((x, y) => x - y);
    while (keys.length > 40) delete S.daily.days[keys.shift()];
    S.t = Date.now();
    saveLocal();
    queuePush();
  }
  function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  /* Combine this device's save (L) with the account's (R) so that nothing
     earned on either side is lost. Collections are unioned. Coins and bait
     can go down as well as up, so the account's figure is taken and whatever
     this device earned or spent since it last synced is applied on top. */
  function mergeStates(L, R, keepArea, fromBackup) {
    const M = fresh(), c = M.col, base = L.base || { coins: 0, bait: 0 };
    M.t = Math.max(L.t, R.t);
    M.seenHelp = L.seenHelp || R.seenHelp;
    for (const src of [L, R]) {
      for (const k of Object.keys(src.daily.days)) {
        const d = src.daily.days[k], cur = M.daily.days[k];
        if (!cur || (d.done && !cur.done) || (d.done === cur.done && d.g.length > cur.g.length)) M.daily.days[k] = d;
      }
      for (const id of Object.keys(src.col.caught)) {
        const e = src.col.caught[id], cur = c.caught[id];
        c.caught[id] = cur ? { n: Math.max(cur.n, e.n), best: Math.max(cur.best, e.best), g: Math.max(cur.g || 0, e.g || 0) } : { n: e.n, best: e.best, g: e.g || 0 };
      }
      Object.assign(c.seen, src.col.seen);
    }
    const sl = L.daily.stats, sr = R.daily.stats;
    M.daily.stats = sr.played > sl.played || (sr.played === sl.played && sr.best > sl.best) ? sr : sl;
    c.unlocked = AREAS.filter(x => L.col.unlocked.includes(x.id) || R.col.unlocked.includes(x.id)).map(x => x.id);
    GEAR.forEach(g => { c.gear[g.id] = Math.max(L.col.gear[g.id], R.col.gear[g.id]); });
    // a backup code is a snapshot rather than a live copy, so there the larger figure wins
    c.coins = fromBackup ? Math.max(L.col.coins, R.col.coins) : Math.max(0, R.col.coins + L.col.coins - base.coins);
    c.bait = fromBackup ? Math.max(L.col.bait, R.col.bait) : Math.max(0, R.col.bait + L.col.bait - base.bait);
    c.useBait = L.col.useBait && c.bait > 0;
    // a device that has never synced opens where the account had got to
    c.area = !keepArea && !L.base && AREA[R.col.area].i > AREA[L.col.area].i ? R.col.area : L.col.area;
    // aquarium: everything bought on either side is kept; the layout is this device's
    M.tank.size = Math.max(L.tank.size, R.tank.size);
    DECOR.forEach(x => { if (x.id in L.tank.decor) M.tank.decor[x.id] = L.tank.decor[x.id]; else if (x.id in R.tank.decor) M.tank.decor[x.id] = R.tank.decor[x.id]; });
    M.tank.fish = (L.tank.fish.length || L.tank.set ? L.tank.fish : R.tank.fish).filter(id => c.caught[id]);
    M.tank.set = L.tank.set || R.tank.set;
    // rod and float looks: everything bought is kept; what is fitted is this device's choice
    Object.assign(M.style.own, R.style.own, L.style.own);
    ['rod', 'float'].forEach(kind => { M.style[kind] = !L.base && L.style[kind] === 'classic' ? R.style[kind] : L.style[kind]; });
    M.bounty = R.bounty.day > L.bounty.day ? R.bounty : L.bounty.day > R.bounty.day ? L.bounty : { day: L.bounty.day, id: L.bounty.id, done: L.bounty.done || R.bounty.done };
    M.base = fromBackup ? L.base : { coins: R.col.coins, bait: R.col.bait };
    return M;
  }

  /* --- the account copy --- */
  const SLOT_KEY = 'fathom.slot';
  let cloudRef = null, cloudDb = null, cloudKind = 'local', cloudOn = false, canName = false, slot = '', cloudBusy = false, cloudDirty = false, pushTimer = null, pushQueued = false, lastPull = 0;
  const bodyOf = X => ({ v: 1, t: X.t, seenHelp: X.seenHelp, daily: X.daily, col: X.col, tank: X.tank, bounty: X.bounty, style: X.style });
  const cloudBody = () => JSON.parse(JSON.stringify(bodyOf(S)));
  function applyMerged(M) { S.base = M.base; S.seenHelp = M.seenHelp; S.daily = M.daily; S.col = M.col; S.tank = M.tank; S.bounty = M.bounty; S.style = M.style; }
  const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x));
  const within = (p, ms) => Promise.race([p, new Promise((res, rej) => setTimeout(() => rej({ code: 'unavailable' }), ms))]);
  /* kind: 'account' (the player's private save), 'named' (a save the player
     names, for people who can write here but have no personal id), or 'local'. */
  function setCloud(kind) {
    cloudOn = kind !== 'local';
    const el = $('save-note');
    if (!el) return;
    el.textContent = kind === 'account' ? 'Progress is saved to your Claude account.'
      : kind === 'named' ? `Progress is saved here as "${slot}".`
      : canName ? 'Progress is not backed up yet. Tap to set a save name.'
      : 'Progress is saved in this browser only. Tap for backup options.';
  }
  function queuePush() {
    if (!cloudRef) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushCloud, 1200);
    pushQueued = true;
  }
  /* Reading and writing the account copy never overlap: a read that was in
     flight while a write landed would merge against a stale copy. */
  async function pushCloud() {
    clearTimeout(pushTimer);
    pushQueued = false;
    if (!cloudRef) return;
    if (cloudBusy) { cloudDirty = true; return; }
    cloudBusy = true;
    const body = cloudBody();
    // Tag the write and note it locally first. If the page closes after the
    // write lands but before that is recorded, the tag shows on the next load
    // that this device's changes are already in the account copy.
    body.rev = Math.random().toString(36).slice(2) + Date.now().toString(36);
    S.pending = { rev: body.rev, coins: body.col.coins, bait: body.col.bait };
    saveLocal();
    try {
      await within(cloudRef.set(body), 15000);
      S.base = { coins: body.col.coins, bait: body.col.bait };
      S.pending = null;
      saveLocal();
      setCloud(cloudKind);
    } catch (e) {
      // "unavailable" is a passing fault and the next save tries again; anything
      // else means this player cannot write here, so stay on browser storage
      if (!e || e.code !== 'unavailable') { cloudRef = null; canName = false; setCloud('local'); }
    }
    cloudBusy = false;
    if (cloudDirty) { cloudDirty = false; queuePush(); }
  }
  async function pullCloud() {
    if (!cloudRef || cloudBusy) return;
    cloudBusy = true;
    lastPull = Date.now();
    let needPush = false;
    try {
      const snap = await within(cloudRef.get(), 10000);
      const R = snap && snap.exists ? adopt(snap.data()) : null;
      if (!R) { needPush = !!S.t; if (!needPush) setCloud(cloudKind); }
      else {
        if (S.pending && R.rev && R.rev === S.pending.rev) S.base = { coins: S.pending.coins, bait: S.pending.bait };
        S.pending = null;
        const before = canon(cloudBody());
        const M = mergeStates(S, R, fs.phase !== 'idle');
        S.t = M.t; applyMerged(M);
        saveLocal();
        setCloud(cloudKind);
        const after = canon(cloudBody());
        if (after !== before) refreshView();
        needPush = after !== canon(bodyOf(R));
      }
    } catch (e) { /* could not reach it this time; the browser copy carries on */ }
    cloudBusy = false;
    if (needPush || cloudDirty) { cloudDirty = false; await pushCloud(); }
  }
  const slug = s => String(s || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  async function initCloud() {
    try {
      if (!window.claude || typeof window.claude.use !== 'function') return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db) return;
      const uid = user ? await user.id() : null;
      if (uid) {
        cloudKind = 'account';
        cloudRef = db.doc('data/users/' + uid + '/save');
        await pullCloud();
        return;
      }
      // Signed in and allowed to write, but with no personal id (the platform
      // gives none to some invited editors): they keep a save under a name.
      if (user && (await user.can('data.write')) === false) return;
      cloudDb = db; canName = true;
      let stored = '';
      try { stored = slug(localStorage.getItem(SLOT_KEY)); } catch (e) { /* ignore */ }
      if (stored.length >= 2) await useSlot(stored);
      else { setCloud('local'); toast('Set a save name at the bottom of the page to keep your progress'); }
    } catch (e) { /* no account copy on this view */ }
  }
  async function useSlot(name) {
    let prev = '';
    try { prev = slug(localStorage.getItem(SLOT_KEY)); localStorage.setItem(SLOT_KEY, name); } catch (e) { /* ignore */ }
    slot = name; cloudKind = 'named';
    cloudRef = cloudDb.doc('saves/' + name);
    if (name !== prev) { S.base = null; S.pending = null; } // a different save: this device has synced nothing with it yet
    await pullCloud();
    if (cloudRef) await pushCloud(); // one write up front proves this save can be kept
  }

  /* --- backup codes: the whole save as text, for anywhere nothing else is durable --- */
  const b64 = { enc: s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), dec: s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))) };
  const backupCode = () => 'FATHOM1.' + b64.enc(JSON.stringify(cloudBody()));
  function restoreBackup(code) {
    let R = null;
    try { const m = /FATHOM1\.([A-Za-z0-9_-]+)/.exec(String(code).replace(/\s+/g, '')); R = m && adopt(JSON.parse(b64.dec(m[1]))); } catch (e) { R = null; }
    if (!R) return false;
    const M = mergeStates(S, R, fs.phase !== 'idle', true);
    applyMerged(M);
    save();
    refreshView();
    return true;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (pushQueued) pushCloud(); } // flush a waiting change, never re-send an old copy
    else if (cloudRef && Date.now() - lastPull > 60000) pullCloud();
  });

  /* ---------------- formatting ---------------- */
  const trim = (n, d) => String(+n.toFixed(d));
  function fmtLen(cm) { return cm >= 1000 ? trim(cm / 100, 1) + ' m' : Math.round(cm) + ' cm'; }
  function fmtKg(kg) {
    if (kg < 1) return Math.round(kg * 1000) + ' g';
    if (kg >= 1000) return trim(kg / 1000, 1) + ' t';
    return trim(kg, 1) + ' kg';
  }
  function fmtCatchLen(cm) { return cm >= 100 ? trim(cm / 100, 2) + ' m' : trim(cm, 1) + ' cm'; }
  function fmtCatchKg(kg) {
    if (kg < 1) return Math.max(1, Math.round(kg * 1000)) + ' g';
    if (kg >= 1000) return trim(kg / 1000, 2) + ' t';
    return trim(kg, kg < 10 ? 2 : 1) + ' kg';
  }
  const rangeShort = f => f.range.map(r => REGIONS[r][0]).join(' · ');
  const rangeLong = f => f.range.map(r => REGIONS[r][1]).join(', ');

  /* ---------------- toast + modal ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  let modalOnClose = null;
  function openModal(html, onClose) {
    $('modal-body').innerHTML = html;
    $('modal').hidden = false;
    modalOnClose = onClose || null;
  }
  function closeModal() {
    if ($('modal').hidden) return;
    $('modal').hidden = true;
    const cb = modalOnClose;
    modalOnClose = null;
    if (cb) cb();
  }
  $('modal-close').addEventListener('click', closeModal);
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });

  /* =====================================================================
     DAILY CATCH
     ===================================================================== */
  function dayNum(d) {
    d = d || new Date();
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((t - EPOCH) / 864e5) + 1;
  }
  function answerFor(n) {
    // Days 1-91 run through the original species in their original order, so
    // adding species later never changes a puzzle that is already scheduled.
    const first = n >= 1 && n <= ORIGINAL_COUNT, pool = first ? FISH.slice(0, ORIGINAL_COUNT) : FISH, N = pool.length;
    const m = first ? n : n - ORIGINAL_COUNT, pos = (((m - 1) % N) + N) % N, cycle = first ? 0 : 1 + Math.floor((m - 1) / N);
    const rand = window.FishArt.rng(0xF47 + cycle * 7919);
    const order = pool.map((_, k) => k);
    for (let k = N - 1; k > 0; k--) {
      const r = Math.floor(rand() * (k + 1));
      const tmp = order[k]; order[k] = order[r]; order[r] = tmp;
    }
    return pool[order[pos]].id;
  }
  let today = dayNum();
  function dayState() {
    let d = S.daily.days[today];
    if (!d || !BY_ID[d.a]) {
      d = S.daily.days[today] = { a: answerFor(today), g: [], done: false, won: false };
    }
    d.g = d.g.filter(id => BY_ID[id]);
    return d;
  }

  function numState(g, a) {
    if (g === a) return 'hit';
    const r = g / a;
    return r >= 0.8 && r <= 1.25 ? 'near' : 'miss';
  }
  function compare(g, a) {
    const overlap = g.range.filter(r => a.range.includes(r)).length;
    const same = overlap === g.range.length && overlap === a.range.length;
    const arrow = (x, y) => (y > x ? '↑' : y < x ? '↓' : '');
    return [
      { k: 'Habitat', v: AREA[g.area].name, s: g.area === a.area ? 'hit' : AREA[g.area].water === AREA[a.area].water ? 'near' : 'miss' },
      { k: 'Family', v: g.group, s: g.group === a.group ? 'hit' : 'miss' },
      { k: 'Range', v: rangeShort(g), s: same ? 'hit' : overlap ? 'near' : 'miss', title: rangeLong(g) },
      { k: 'Diet', v: DIETS[g.diet], s: g.diet === a.diet ? 'hit' : 'miss' },
      { k: 'Length', v: fmtLen(g.len), s: numState(g.len, a.len), dir: arrow(g.len, a.len) },
      { k: 'Weight', v: fmtKg(g.kg), s: numState(g.kg, a.kg), dir: arrow(g.kg, a.kg) }
    ];
  }

  function rowHtml(g, a, isNew) {
    const cells = compare(g, a).map(c =>
      `<div class="cell ${c.s}"${c.title ? ` title="${esc(c.title)}"` : ''}><span>${c.k}</span><b>${esc(c.v)}${c.dir ? `<em aria-label="${c.dir === '↑' ? 'answer is higher' : 'answer is lower'}">${c.dir}</em>` : ''}</b></div>`
    ).join('');
    return `<div class="row${isNew ? ' new' : ''}"><div class="row-name">${esc(g.name)}<small>${esc(g.sci)}</small></div><div class="cells">${cells}</div></div>`;
  }

  function renderDaily(animateLatest) {
    const d = dayState(), a = BY_ID[d.a];
    $('daily-title').textContent = 'Daily Catch #' + today;
    $('daily-sub').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

    let pips = '';
    for (let i = 0; i < MAX_GUESSES; i++) {
      const won = d.won && i === d.g.length - 1;
      pips += `<i class="${won ? 'won' : i < d.g.length ? 'used' : ''}"></i>`;
    }
    $('pips').innerHTML = pips;

    const n = d.g.length;
    $('rows').innerHTML = d.g.map((id, i) => rowHtml(BY_ID[id], a, animateLatest && i === n - 1)).reverse().join('');
    $('daily-empty').hidden = n > 0;

    const showResult = d.done && !animateLatest;
    $('guess-box').hidden = d.done;
    $('hints').hidden = showResult;
    const h1 = n >= 3 || d.done, h2 = n >= 5 || d.done;
    $('hints').innerHTML =
      `<div class="hint${h1 ? ' open' : ''}"><b>Field note</b>${h1 ? esc(a.clue) : 'Unlocks after 3 guesses'}</div>` +
      `<div class="hint${h2 ? ' open' : ''}"><b>Silhouette</b>${h2 ? window.FishArt.svg(a, { silhouette: true }) : 'Unlocks after 5 guesses'}</div>`;

    $('result').hidden = !showResult;
    if (showResult) renderResult(d, a);
  }

  function renderResult(d, a) {
    const reward = d.reward ? `<p class="reward">+${d.reward.coins} coins and +${d.reward.bait} lucky bait for Fishing</p>` : '';
    $('result').innerHTML =
      `<p class="muted">${d.won ? `Landed in ${d.g.length} of ${MAX_GUESSES}` : 'It got away. The fish was…'}</p>` +
      window.FishArt.svg(a) +
      `<h3>${esc(a.name)}</h3><p class="sci">${esc(a.sci)}</p>` +
      `<p class="fact">${esc(a.clue)}</p>${reward}` +
      `<div class="actions"><button class="btn" id="btn-share">Share result</button><button class="btn ghost" id="btn-gofish">Go fishing</button></div>` +
      `<p class="muted next">Next fish in <b id="countdown"></b></p>`;
    $('btn-share').addEventListener('click', share);
    $('btn-gofish').addEventListener('click', () => showTab('fish'));
    tickCountdown();
  }

  function tickCountdown() {
    const el = $('countdown');
    if (!el) return;
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    const p = x => String(x).padStart(2, '0');
    el.textContent = `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
  }
  setInterval(() => {
    if (dayNum() !== today) { today = dayNum(); refreshView(); }
    tickCountdown();
  }, 1000);

  function submitGuess(id) {
    const d = dayState(), a = BY_ID[d.a];
    if (d.done || !BY_ID[id] || d.g.includes(id)) return;
    d.g.push(id);
    const won = id === a.id, out = !won && d.g.length >= MAX_GUESSES;
    if (won || out) finishDay(d, won);
    save();
    $('guess-input').value = '';
    hideList();
    renderDaily(true);
    if (d.done) setTimeout(() => { renderDaily(false); $('result').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 1300);
  }

  function finishDay(d, won) {
    const st = S.daily.stats;
    d.done = true; d.won = won;
    st.played++;
    if (won) {
      st.wins++;
      st.dist[d.g.length - 1]++;
      st.streak = st.lastWin === today - 1 ? st.streak + 1 : 1;
      st.lastWin = today;
      st.best = Math.max(st.best, st.streak);
    } else {
      st.streak = 0;
    }
    d.reward = won ? { coins: 40 + 10 * (MAX_GUESSES - d.g.length), bait: 2 } : { coins: 15, bait: 1 };
    S.col.coins += d.reward.coins;
    S.col.bait += d.reward.bait;
    S.col.seen[d.a] = true;
  }

  function shareText() {
    const d = dayState(), a = BY_ID[d.a];
    const sq = { hit: '🟩', near: '🟨', miss: '⬛' };
    const grid = d.g.map(id => compare(BY_ID[id], a).map(c => sq[c.s]).join('')).join('\n');
    // only append a link when the page is on its public home, not a preview or embed
    const link = location.hostname.endsWith('github.io') ? '\n' + location.origin + location.pathname : '';
    return `Fathom #${today} 🎣 ${d.won ? d.g.length : 'X'}/${MAX_GUESSES}\n${grid}${link}`;
  }
  function share() {
    const text = shareText();
    const done = () => toast('Result copied to clipboard');
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Could not copy'); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  /* --- guess input with browsable list --- */
  const input = $('guess-input'), list = $('guess-list');
  let matches = [], active = 0;
  function showList() {
    const d = dayState(), q = input.value.trim().toLowerCase();
    matches = SORTED.filter(f => !d.g.includes(f.id) && (!q || f.name.toLowerCase().includes(q) || f.sci.toLowerCase().includes(q)));
    active = clamp(active, 0, Math.max(0, matches.length - 1));
    list.innerHTML = `<li class="list-head" role="presentation"><span>${matches.length} fish</span><button type="button" id="list-close">Close</button></li>` + (matches.length
      ? matches.map((f, i) => `<li role="option" data-id="${f.id}" class="${i === active ? 'active' : ''}"><span>${esc(f.name)}</span>${S.col.caught[f.id] ? '<small>in journal</small>' : ''}</li>`).join('')
      : '<li class="none">No fish by that name</li>');
    list.hidden = false;
    // keep the highlighted row in view by scrolling the list only, never the page
    const el = list.querySelector('.active'), head = list.querySelector('.list-head');
    if (el) {
      const top = el.offsetTop - head.offsetHeight, bottom = el.offsetTop + el.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    }
  }
  function hideList() { list.hidden = true; }
  function dismissList() { hideList(); input.blur(); }
  input.addEventListener('focus', () => { active = 0; showList(); });
  // a phone keeps the box focused after the list is closed, so a tap must reopen it
  input.addEventListener('click', () => { if (list.hidden) { active = 0; showList(); } });
  // phones do not take focus away when you tap empty space, so close on any tap outside
  document.addEventListener('pointerdown', e => { if (!list.hidden && !e.target.closest('#guess-box')) dismissList(); });
  input.addEventListener('input', () => { active = 0; showList(); });
  input.addEventListener('blur', () => setTimeout(hideList, 120));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) showList(); else { active = Math.min(matches.length - 1, active + 1); showList(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); showList(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (!list.hidden && matches[active]) submitGuess(matches[active].id); }
    else if (e.key === 'Escape') { e.stopPropagation(); hideList(); }
  });
  list.addEventListener('mousedown', e => e.preventDefault()); // keep focus so the click lands
  list.addEventListener('click', e => {
    if (e.target.closest('#list-close')) { dismissList(); return; }
    const li = e.target.closest('li[data-id]');
    if (li) { submitGuess(li.dataset.id); input.blur(); }
  });

  /* --- help + stats --- */
  function showHelp() {
    openModal(
      `<h2>How to play</h2>
       <p>Guess the mystery fish in <b>${MAX_GUESSES}</b> tries. After each guess, six clues show how your fish compares with the answer.</p>
       <div class="legend">
         <i style="background:var(--hit)"></i><span>Exact match.</span>
         <i style="background:var(--near)"></i><span>Close: same kind of water (fresh or salt), an overlapping range, or a size within about 20%.</span>
         <i style="background:var(--miss)"></i><span>No match.</span>
         <i style="background:var(--miss);display:grid;place-items:center;font-style:normal;font-weight:800">↑</i><span>The mystery fish is bigger (↑) or smaller (↓) than your guess.</span>
       </div>
       <h3>The clues</h3>
       <p><b>Habitat</b> is where you would catch it. <b>Family</b> is its broad group. <b>Range</b> lists the continents (for freshwater) or oceans it is native to. <b>Length</b> and <b>Weight</b> are rough record sizes.</p>
       <p>A field note unlocks after 3 guesses and a silhouette after 5.</p>
       <h3>Fishing</h3>
       <p>No timer, no daily limit. Cast, hook the bite, then <b>hold to reel</b> and keep the marker in the green zone. Fill your journal to unlock new waters, and spend coins on better tackle. Finishing the Daily Catch earns coins and lucky bait.</p>
       <p>Bigger catches earn bronze, silver and gold <b>medals</b>, about one catch in thirty is a <b>golden</b> fish worth five times the coins, and each day there is a <b>bounty</b> on one fish.</p>
       <h3>Aquarium</h3>
       <p>The fish you catch can live in your tank. Tap the water to feed them, and spend coins on a bigger tank and decorations.</p>
       <button class="btn" id="help-ok" style="width:100%;margin-top:8px">Let's fish</button>`,
      () => { S.seenHelp = true; save(); });
    $('help-ok').addEventListener('click', closeModal);
  }
  function showStats() {
    const st = S.daily.stats, d = dayState();
    const streak = st.lastWin >= today - 1 ? st.streak : 0;
    const max = Math.max(1, ...st.dist);
    const dist = st.dist.map((n, i) =>
      `<span>${i + 1}</span><div><i class="${d.won && d.g.length === i + 1 ? 'me' : ''}" style="width:${Math.max(8, n / max * 100)}%">${n}</i></div>`).join('');
    const caught = Object.keys(S.col.caught).length;
    openModal(
      `<h2>Statistics</h2>
       <div class="statgrid">
         <div><b>${st.played}</b><span>Played</span></div>
         <div><b>${st.played ? Math.round(st.wins / st.played * 100) : 0}</b><span>Win %</span></div>
         <div><b>${streak}</b><span>Streak</span></div>
         <div><b>${st.best}</b><span>Best streak</span></div>
       </div>
       <h3>Guess distribution</h3><div class="dist">${dist}</div>
       <h3>Journal</h3><p>${caught} of ${FISH.length} species caught.</p>`);
  }
  function showSaves() {
    const status = cloudKind === 'account' && cloudOn ? 'Your progress is saved to your Claude account and follows you between devices.'
      : cloudKind === 'named' && cloudOn ? 'Your progress is saved on this page under the name below. Type the same name on another device to carry on there.'
      : canName ? 'Give your save a name and your progress is kept on this page, not just in this browser.'
      : 'Your progress is kept in this browser. A backup code lets you restore it if the browser ever forgets.';
    openModal(
      `<h2>Your save</h2><p id="sv-status"></p>
       ${canName ? `<h3>Save name</h3>
         <div class="sv-row"><input id="sv-name" type="text" maxlength="40" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="for example sydney" aria-label="Save name"><button class="btn small" id="sv-use">Use</button></div>
         <p class="muted" id="sv-name-msg">Letters and numbers. Anyone you share this game with could load a save if they know its name.</p>` : ''}
       <h3>Backup code</h3>
       <p class="muted">Copy this code somewhere safe, such as a note. Pasting it back restores everything.</p>
       <div class="sv-row"><button class="btn small" id="sv-copy">Copy backup code</button></div>
       <textarea id="sv-code" rows="3" spellcheck="false" autocapitalize="off" placeholder="Paste a backup code here" aria-label="Backup code"></textarea>
       <div class="sv-row"><button class="btn small ghost" id="sv-restore">Restore from code</button><span class="muted" id="sv-msg"></span></div>`);
    $('sv-status').textContent = status;
    if (canName) {
      $('sv-name').value = slot;
      $('sv-use').addEventListener('click', async () => {
        const name = slug($('sv-name').value);
        if (name.length < 2) { $('sv-name-msg').textContent = 'Use at least two letters or numbers.'; return; }
        $('sv-use').disabled = true; $('sv-name-msg').textContent = 'Saving…';
        await useSlot(name);
        if ($('sv-name-msg')) $('sv-name-msg').textContent = cloudOn ? `Saved as "${name}". Use this name on any device.` : 'That did not work here, so progress stays in this browser. A backup code still works.';
        if ($('sv-use')) $('sv-use').disabled = false;
      });
    }
    $('sv-copy').addEventListener('click', () => {
      const code = backupCode(), box = $('sv-code');
      const shown = () => { box.value = code; box.focus(); box.select(); $('sv-msg').textContent = 'Code is in the box. Copy it from there.'; };
      try { navigator.clipboard.writeText(code).then(() => { $('sv-msg').textContent = 'Backup code copied.'; }, shown); } catch (e) { shown(); }
    });
    $('sv-restore').addEventListener('click', () => {
      const ok = restoreBackup($('sv-code').value);
      if (ok) { closeModal(); toast('Progress restored'); } else $('sv-msg').textContent = 'That is not a Fathom backup code.';
    });
  }
  $('save-note').addEventListener('click', showSaves);
  $('btn-help').addEventListener('click', showHelp);
  $('btn-stats').addEventListener('click', showStats);

  /* =====================================================================
     FREE FISHING
     ===================================================================== */
  const scene = $('scene'), actBtn = $('btn-act');
  let fs = { phase: 'idle' }, timer = null, raf = 0, holding = false, sceneArea = null, pendingCatch = null, landTimer = null;
  const fx = new window.FathomScene.Fx($('fx'), () => fs);

  function areaCaught(areaId) { return FISH.filter(f => f.area === areaId && S.col.caught[f.id]).length; }
  function areaTotal(areaId) { return FISH.filter(f => f.area === areaId).length; }
  /* Ordinary areas open from the one before; expeditions open from the size of the whole journal. */
  function unlockInfo(a) {
    const coinsOk = S.col.coins >= a.cost;
    if (a.needTotal) {
      const have = Object.keys(S.col.caught).filter(id => BY_ID[id]).length, speciesOk = have >= a.needTotal;
      return { prev: null, prevOpen: true, need: a.needTotal, have, speciesOk, coinsOk, ok: speciesOk && coinsOk };
    }
    const prev = AREAS[a.i - 1], have = prev ? areaCaught(prev.id) : 0, speciesOk = have >= a.need;
    const prevOpen = !prev || S.col.unlocked.includes(prev.id);
    return { prev, prevOpen, need: a.need, have, speciesOk, coinsOk, ok: speciesOk && coinsOk && prevOpen };
  }

  /* --- medals, golden fish, bounties --- */
  const MEDALS = [['gold', 0.9, 'Gold'], ['silver', 0.75, 'Silver'], ['bronze', 0.55, 'Bronze']];
  const medalOf = best => { const m = MEDALS.find(x => best >= x[1]); return m ? { id: m[0], at: m[1], name: m[2] } : null; };
  const goldenChance = useBait => (1 / 30) * (1 + 0.1 * S.col.gear.lure) * (useBait ? 3 : 1);
  const BOUNTY_FRAC = 0.5;
  const bountyReward = f => Math.round(120 * Math.pow(AREA[f.area].mult, 0.8) / 10) * 10;
  function ensureBounty() {
    if (S.bounty.day === today && BY_ID[S.bounty.id]) return S.bounty;
    const pool = FISH.filter(f => S.col.unlocked.includes(f.area) && (f.rarity === 'common' || f.rarity === 'uncommon'));
    const rand = window.FishArt.rng((today * 7919 + 13) >>> 0);
    S.bounty = { day: today, id: pool[Math.floor(rand() * pool.length)].id, done: false };
    saveLocal();
    return S.bounty;
  }
  function renderBounty() {
    const b = ensureBounty(), f = BY_ID[b.id], el = $('bounty');
    el.className = 'bounty' + (b.done ? ' done' : '');
    el.innerHTML = window.FishArt.svg(f) +
      `<span class="bt"><b>${b.done ? 'Bounty landed' : 'Today\'s bounty'}</b><span>${b.done ? `${esc(f.name)} is in. A new bounty arrives tomorrow.` : `${esc(f.name)}, ${fmtCatchLen(f.len * BOUNTY_FRAC)} or longer · ${AREA[f.area].name}`}</span></span>` +
      (b.done ? '<em class="tick">✓</em>' : `<em><i class="coin"></i>${bountyReward(f)}</em>`);
  }

  function pickFish(areaId, useBait, rand) {
    const pool = FISH.filter(f => f.area === areaId), lure = S.col.gear.lure;
    const tier = {
      common: RARITY.common.weight,
      uncommon: RARITY.uncommon.weight * (1 + 0.12 * lure),
      rare: RARITY.rare.weight * (1 + 0.3 * lure),
      legendary: RARITY.legendary.weight * (1 + 0.4 * lure)
    };
    if (useBait) { tier.common *= 0.2; tier.uncommon *= 0.8; tier.rare *= 3; tier.legendary *= 4; }
    const count = {};
    pool.forEach(f => { count[f.rarity] = (count[f.rarity] || 0) + 1; });
    const wanted = S.bounty.day === today && !S.bounty.done ? S.bounty.id : '';
    const w = pool.map(f => tier[f.rarity] / count[f.rarity] * (S.col.caught[f.id] ? 1 : 1.6) * (f.id === wanted ? 3 : 1));
    let r = (rand || Math.random)() * w.reduce((x, y) => x + y, 0);
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }

  /* The fight is a pure simulation so it can be tested without the DOM. */
  function fightInit(fish, gear, rand) {
    const diff = RARITY[fish.rarity].diff + AREA[fish.area].i * 0.04;
    return {
      diff,
      width: clamp(38 / Math.pow(diff, 0.8) + gear.rod * 3.5, 14, 60),
      gain: 13 * (1 + 0.15 * gear.reel) / Math.pow(diff, 0.7),
      loss: 9 * diff,
      strainRate: 42 * (1 - 0.14 * gear.line),
      drift: 6 + 10 * (diff - 1),
      driftSpeed: 0.8 + 0.5 * (diff - 1),
      surgeForce: Math.min(62, 40 + 25 * (diff - 1)),
      T: 30, P: 32, strain: 0, t: 0, zc: 52, where: 0,
      phase: rand() * Math.PI * 2, surge: 0, nextSurge: 1.6 + rand() * 1.5, rand
    };
  }
  function fightStep(f, dt, hold) {
    f.t += dt;
    if (f.surge > 0) f.surge -= dt;
    else {
      f.nextSurge -= dt;
      if (f.nextSurge <= 0) { f.surge = 0.5 + f.rand() * 0.6; f.nextSurge = (1.6 + f.rand() * 2.2) / Math.sqrt(f.diff); }
    }
    f.T = clamp(f.T + ((hold ? 58 : -52) + (f.surge > 0 ? f.surgeForce : 0)) * dt, 0, 100);
    f.zc = 52 + f.drift * Math.sin(f.t * f.driftSpeed + f.phase);
    const lo = f.zc - f.width / 2, hi = f.zc + f.width / 2;
    if (f.T > hi) {
      f.where = 1;
      f.strain += f.strainRate * (1 + (f.T - hi) / 25) * dt;
    } else {
      f.strain = Math.max(0, f.strain - 38 * dt);
      if (f.T < lo) { f.where = -1; if (f.t > 1.2) f.P -= f.loss * dt; }
      else { f.where = 0; f.P += f.gain * dt; }
    }
    if (f.strain >= 100) return 'snap';
    if (f.P >= 100) return 'caught';
    if (f.P <= 0) return 'escaped';
    return null;
  }

  function setPhase(phase, status) {
    fs.phase = phase;
    scene.classList.remove('idle', 'wait', 'bite', 'fight', 'land', 'shake');
    scene.classList.add(phase);
    actBtn.classList.remove('hook', 'wait');
    $('alert').hidden = phase !== 'bite';
    $('fight').hidden = phase !== 'fight';
    if (phase === 'idle') actBtn.textContent = 'Cast';
    if (phase === 'wait') { actBtn.textContent = 'Wait for it…'; actBtn.classList.add('wait'); }
    if (phase === 'bite') { actBtn.textContent = 'Hook it!'; actBtn.classList.add('hook'); }
    if (phase === 'fight') actBtn.textContent = 'Hold to reel';
    if (phase === 'land') { actBtn.textContent = 'Got it!'; actBtn.classList.add('wait'); }
    if (status) $('status').textContent = status;
  }
  function resetFishing(status) {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    holding = false;
    actBtn.classList.remove('down');
    setPhase('idle', status || 'Cast your line.');
    renderNote();
  }

  function cast() {
    setPhase('wait', 'Waiting for a bite…');
    fx.cast();
    timer = setTimeout(() => {
      setPhase('bite', 'Bite! Hook it!');
      timer = setTimeout(() => resetFishing('Too slow. It stole the bait.'), 1400);
    }, 1100 + Math.random() * 2600);
  }

  function hook() {
    clearTimeout(timer);
    const useBait = S.col.useBait && S.col.bait > 0;
    const fish = pickFish(S.col.area, useBait);
    if (useBait) { S.col.bait--; if (!S.col.bait) S.col.useBait = false; save(); renderWallet(); }
    fs.fish = fish;
    fs.golden = Math.random() < goldenChance(useBait);
    fx.hook(fish, fs.golden);
    fs.f = fightInit(fish, S.col.gear, Math.random);
    fs.last = performance.now();
    const feel = fs.golden ? 'Something glints below!' : { common: 'A light tug', uncommon: 'A solid pull', rare: 'Something strong!', legendary: 'A monster on the line!' }[fish.rarity];
    $('fight-feel').textContent = feel;
    setPhase('fight');
    $('area-note').textContent = 'Keep the marker in the green. Too far right snaps the line, too far left lets the fish go.';
    drawFight();
    raf = requestAnimationFrame(loop);
  }

  function drawFight() {
    const f = fs.f;
    $('needle').style.left = f.T + '%';
    $('zone').style.left = (f.zc - f.width / 2) + '%';
    $('zone').style.width = f.width + '%';
    $('prog').style.width = clamp(f.P, 0, 100) + '%';
    $('tension').classList.toggle('strain', f.where === 1);
    const warn = f.strain > 30 ? 'Line straining!' : f.where === -1 ? 'Too slack' : '';
    $('strain-txt').textContent = warn;
    $('fight-feel').hidden = !!warn;
    scene.classList.toggle('shake', f.surge > 0);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - fs.last) / 1000);
    fs.last = now;
    const out = fightStep(fs.f, dt, holding);
    drawFight();
    if (!out) { raf = requestAnimationFrame(loop); return; }
    if (out === 'caught') {
      // The catch is saved straight away; the leap is only for show.
      pendingCatch = recordCatch(fs.fish, fs.golden);
      holding = false; actBtn.classList.remove('down');
      setPhase('land', 'Got it!');
      fx.caught(finishLanding);
      landTimer = setTimeout(finishLanding, 1500);
    } else {
      fx.lost(out);
      resetFishing(out === 'snap' ? 'Snap! Too much tension and the line broke.' : 'Too slack. It threw the hook and got away.');
    }
  }
  function finishLanding() {
    clearTimeout(landTimer);
    if (!pendingCatch) return;
    const c = pendingCatch; pendingCatch = null;
    resetFishing('Nice catch. Cast again when you are ready.');
    renderFishing();
    showCatch(c);
  }

  function recordCatch(fish, golden) {
    const frac = 0.3 + 0.7 * Math.pow(Math.random(), 2.2);
    const area = AREA[fish.area], rec = S.col.caught[fish.id];
    const isNew = !rec, isRecord = !!rec && frac > rec.best, before = rec ? medalOf(rec.best) : null;
    let coins = Math.round(RARITY[fish.rarity].coins * area.mult * (0.6 + 0.8 * frac));
    if (isNew) coins *= 2;
    if (golden) coins *= 5;
    const entry = S.col.caught[fish.id] = { n: (rec ? rec.n : 0) + 1, best: rec ? Math.max(rec.best, frac) : frac, g: (rec ? rec.g || 0 : 0) + (golden ? 1 : 0) };
    const medal = medalOf(entry.best), newMedal = medal && (!before || before.id !== medal.id) ? medal : null;
    let bounty = 0;
    const b = S.bounty;
    if (b.day === today && !b.done && b.id === fish.id && frac >= BOUNTY_FRAC) { b.done = true; bounty = bountyReward(fish); S.col.coins += bounty; S.col.bait += 1; }
    S.col.coins += coins;
    save();
    return { fish, frac, coins, isNew, isRecord, golden: !!golden, firstGolden: !!golden && !(rec && rec.g), newMedal, bounty };
  }
  function showCatch(c) {
    const { fish, frac, coins, isNew, isRecord, golden, newMedal, bounty } = c;
    const badges = (golden ? '<span class="badge gold">Golden · 5× coins</span>' : '') +
      (isNew ? '<span class="badge">New species · double coins</span>' : '') +
      (newMedal ? `<span class="badge m-${newMedal.id}">${newMedal.name} medal</span>` : '') +
      (isRecord && !newMedal ? '<span class="badge">Personal best</span>' : '') +
      (bounty ? `<span class="badge">Bounty complete · +${bounty} coins, +1 bait</span>` : '');
    openModal(
      `<div class="catch">${badges ? `<div>${badges}</div>` : ''}
        ${window.FishArt.svg(fish, { golden })}
        <h2 style="padding:0">${golden ? 'Golden ' : ''}${esc(fish.name)}</h2>
        <p class="muted"><i>${esc(fish.sci)}</i> · <span class="rar r-${fish.rarity}">${RARITY[fish.rarity].name}</span></p>
        <p class="size">${fmtCatchLen(fish.len * frac)} · ${fmtCatchKg(fish.kg * Math.pow(frac, 3))}</p>
        <p><i class="coin"></i> +${coins} coins</p>
        <p class="muted" style="margin:10px 0 14px">${esc(fish.clue)}</p>
        <button class="btn" id="catch-ok" style="width:100%">Keep fishing</button>
      </div>`);
    $('catch-ok').addEventListener('click', closeModal);
  }

  /* --- input: one big button, hold-to-reel during the fight --- */
  function press() {
    if (!$('modal').hidden) return;
    if (fs.phase === 'idle') cast();
    else if (fs.phase === 'wait') resetFishing('You pulled too early and spooked it.');
    else if (fs.phase === 'bite') { holding = true; hook(); }
    else if (fs.phase === 'fight') holding = true;
    actBtn.classList.add('down');
  }
  function release() { holding = false; actBtn.classList.remove('down'); }
  [actBtn, scene].forEach(el => el.addEventListener('pointerdown', e => { e.preventDefault(); press(); }));
  ['pointerup', 'pointercancel', 'blur'].forEach(ev => window.addEventListener(ev, release));
  // Phones treat a long press as "select text" or "open the context menu".
  // Cancelling the touch itself stops that; pointer events still fire.
  actBtn.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  // Once a fish is biting, the whole fishing view is the button: a thumb that
  // drifts off it still reels, and a long press anywhere here selects nothing.
  const fishView = $('view-fish');
  fishView.addEventListener('pointerdown', e => { if (fs.phase === 'bite' || fs.phase === 'fight') { e.preventDefault(); press(); } });
  fishView.addEventListener('touchstart', e => { if (fs.phase !== 'idle') e.preventDefault(); }, { passive: false });
  fishView.addEventListener('contextmenu', e => { if (fs.phase !== 'idle' || e.target.closest('#btn-act, #scene')) e.preventDefault(); });
  document.addEventListener('selectstart', e => { if (currentTab === 'fish' && !e.target.closest?.('input, textarea')) e.preventDefault(); });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); return; }
    if (currentTab !== 'fish' || (e.key !== ' ' && e.key !== 'Enter')) return;
    if (e.target !== actBtn && e.target.closest && e.target.closest('input, button, #modal')) return;
    e.preventDefault();
    if (!e.repeat) press();
  });
  window.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') release(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (fs.phase === 'land') finishLanding();
    else if (fs.phase !== 'idle') resetFishing('The fish got away while you were gone.');
  });

  /* --- areas, wallet, shop --- */
  function renderWallet() {
    $('coins').textContent = S.col.coins.toLocaleString();
    $('bait').textContent = S.col.bait;
    const b = $('btn-bait');
    b.disabled = S.col.bait < 1;
    b.classList.toggle('on', S.col.useBait && S.col.bait > 0);
    b.setAttribute('aria-pressed', S.col.useBait && S.col.bait > 0);
  }
  $('btn-bait').addEventListener('click', () => {
    if (fs.phase !== 'idle') return;
    S.col.useBait = !S.col.useBait; save(); renderWallet();
    toast(S.col.useBait ? 'Lucky bait on: your next hooked fish is far more likely to be rare' : 'Lucky bait off');
  });

  function renderFishing() {
    renderWallet();
    const cur = AREA[S.col.area];
    $('areas').innerHTML = AREAS.map(a => {
      const open = S.col.unlocked.includes(a.id);
      const ready = !open && unlockInfo(a).ok;
      return `<button data-area="${a.id}" class="${a.id === cur.id ? 'on' : ''}${open ? '' : ' locked'}${ready ? ' ready' : ''}">${open ? '' : '🔒 '}${a.name}</button>`;
    }).join('');
    scene.style.setProperty('--sky1', cur.sky[0]);
    scene.style.setProperty('--sky2', cur.sky[1]);
    scene.style.setProperty('--sea1', cur.sea[0]);
    scene.style.setProperty('--sea2', cur.sea[1]);
    scene.classList.toggle('night', cur.id === 'deep' || cur.id === 'polar');
    if (sceneArea !== cur.id) {
      sceneArea = cur.id;
      $('backdrop').innerHTML = window.FathomScene.backdrop(cur.id);
      fx.setArea(cur.id);
    }
    fx.setStyle(S.style.rod, S.style.float);
    renderBounty();
    renderNote();
  }
  function renderNote() {
    const cur = AREA[S.col.area], next = AREAS.find(x => x.i > cur.i && !S.col.unlocked.includes(x.id));
    let note = `${cur.name} journal: ${areaCaught(cur.id)} of ${areaTotal(cur.id)} species.`;
    if (next && next.needTotal) note += ` ${next.name} needs ${next.needTotal} species in your journal and ${next.cost.toLocaleString()} coins.`;
    else if (next && next.i === cur.i + 1) note += ` ${next.name} needs ${next.need} of them and ${next.cost.toLocaleString()} coins.`;
    $('area-note').textContent = note;
  }

  $('areas').addEventListener('click', e => {
    const b = e.target.closest('button[data-area]');
    if (!b) return;
    const a = AREA[b.dataset.area];
    if (fs.phase !== 'idle') return; // not mid-cast
    if (S.col.unlocked.includes(a.id)) {
      if (a.id === S.col.area) return;
      S.col.area = a.id; save();
      resetFishing(a.blurb);
      renderFishing();
    } else showUnlock(a);
  });

  function showUnlock(a) {
    const u = unlockInfo(a), got = `(${Math.min(u.have, u.need)}/${u.need})`;
    openModal(
      `<h2>${a.name}</h2><p>${esc(a.blurb)}</p>
       <ul class="req">
         <li class="${u.speciesOk ? 'ok' : 'no'}">${u.speciesOk ? '✓' : '○'} ${a.needTotal ? `Catch ${u.need} different species in total ${got}` : `Catch ${u.need} different species in the ${u.prev.name} ${got}`}</li>
         <li class="${u.coinsOk ? 'ok' : 'no'}">${u.coinsOk ? '✓' : '○'} ${a.cost.toLocaleString()} coins for the licence (you have ${S.col.coins.toLocaleString()})</li>
       </ul>
       ${u.prevOpen ? '' : `<p class="muted">Unlock the ${u.prev.name} first.</p>`}
       <button class="btn" id="unlock-go" style="width:100%" ${u.ok ? '' : 'disabled'}>Unlock ${a.name}</button>`);
    $('unlock-go').addEventListener('click', () => {
      if (!unlockInfo(a).ok) return;
      S.col.coins -= a.cost;
      S.col.unlocked.push(a.id);
      S.col.area = a.id;
      save();
      closeModal();
      resetFishing(a.blurb);
      renderFishing();
      toast(a.name + ' unlocked');
    });
  }

  function showShop() {
    const items = GEAR.map(g => {
      const lv = S.col.gear[g.id], maxed = lv >= GEAR_COST.length, cost = GEAR_COST[lv];
      const pips = GEAR_COST.map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
      return `<div class="shop-item"><div><b>${g.name}</b><span class="lv">${pips}</span><p>${g.desc}</p></div>
        <button class="btn small" data-gear="${g.id}" ${maxed || S.col.coins < cost ? 'disabled' : ''}>${maxed ? 'Maxed' : cost.toLocaleString()}</button></div>`;
    }).join('');
    const looks = (kind, title, what) => `<h3>${title}</h3>` + LOOKS[kind].map(x => {
      const key = kind + ':' + x.id, own = !x.cost || S.style.own[key], on = S.style[kind] === x.id;
      const pic = kind === 'rod' ? `<span class="rod-sw" style="background:${x.sw}"></span>` : `<canvas class="float-pic" width="84" height="84" data-fpic="${x.id}"></canvas>`;
      return `<div class="shop-item"><div class="deco-row">${pic}<div><b>${x.name}</b><p>${on ? 'In use' : own ? 'Owned' : what}</p></div></div>` +
        (on ? '<button class="btn small ghost" disabled>In use</button>'
          : own ? `<button class="btn small ghost" data-look="${key}">Use</button>`
          : `<button class="btn small" data-look="${key}" ${S.col.coins < x.cost ? 'disabled' : ''}>${x.cost.toLocaleString()}</button>`) + '</div>';
    }).join('');
    const top = $('modal').hidden ? 0 : $('modal-body').parentNode.scrollTop;
    openModal(`<h2>Tackle shop</h2><p class="muted"><i class="coin"></i> ${S.col.coins.toLocaleString()} coins</p><h3>Upgrades</h3>${items}` +
      looks('rod', 'Rod finish', 'Changes how your rod looks') + looks('float', 'Float', 'Changes your float'));
    $('modal-body').parentNode.scrollTop = top; // buying something should not jump back to the top
    $('modal-body').querySelectorAll('[data-fpic]').forEach(c => {
      const x = c.getContext('2d');
      x.translate(42, 50); x.scale(3.4, 3.4);
      window.FathomScene.drawFloat(x, c.dataset.fpic);
    });
    $('modal-body').querySelectorAll('button[data-gear]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.gear, cost = GEAR_COST[S.col.gear[id]];
      if (cost === undefined || S.col.coins < cost) return;
      S.col.coins -= cost; S.col.gear[id]++; save();
      renderFishing(); showShop();
    }));
    $('modal-body').querySelectorAll('button[data-look]').forEach(b => b.addEventListener('click', () => {
      const key = b.dataset.look, kind = key.split(':')[0], x = LOOKS[kind].find(y => y.id === key.split(':')[1]);
      if (x.cost && !S.style.own[key]) { if (S.col.coins < x.cost) return; S.col.coins -= x.cost; S.style.own[key] = 1; }
      S.style[kind] = x.id; save();
      renderFishing(); showShop();
    }));
  }
  $('btn-shop').addEventListener('click', () => { if (fs.phase === 'idle') showShop(); });
  $('bounty').addEventListener('click', () => {
    const f = BY_ID[S.bounty.id];
    if (!f || S.bounty.done || fs.phase !== 'idle' || f.area === S.col.area || !S.col.unlocked.includes(f.area)) return;
    S.col.area = f.area; save();
    resetFishing(AREA[f.area].blurb);
    renderFishing();
  });

  /* =====================================================================
     JOURNAL
     ===================================================================== */
  function renderJournal() {
    const total = Object.keys(S.col.caught).filter(id => BY_ID[id]).length;
    const tally = { gold: 0, silver: 0, bronze: 0, golden: 0 };
    Object.keys(S.col.caught).forEach(id => { const c = S.col.caught[id], m = BY_ID[id] && medalOf(c.best); if (m) tally[m.id]++; if (BY_ID[id] && c.g) tally.golden++; });
    let html = `<div class="j-total"><b>${total}</b> <span class="muted">of ${FISH.length} species caught</span>` +
      (total ? `<p class="j-medals"><span><i class="medal m-gold"></i>${tally.gold}</span><span><i class="medal m-silver"></i>${tally.silver}</span><span><i class="medal m-bronze"></i>${tally.bronze}</span><span><i class="gstar">★</i>${tally.golden} golden</span></p>` : '') + '</div>';
    AREAS.forEach(a => {
      const fishes = FISH.filter(f => f.area === a.id), got = areaCaught(a.id);
      const open = S.col.unlocked.includes(a.id);
      html += `<div class="j-area"><h3>${a.name}<small>${open ? `${got} / ${fishes.length}` : '🔒 locked'}</small></h3>` +
        `<div class="meter"><i style="width:${got / fishes.length * 100}%"></i></div><div class="grid">` +
        fishes.map(f => {
          const c = S.col.caught[f.id], known = c || S.col.seen[f.id];
          return `<button class="card${known ? '' : ' unknown'}" data-fish="${f.id}">` +
            `<i class="dot r-${f.rarity}" title="${RARITY[f.rarity].name}"></i>` +
            (c ? `<span class="tag">${c.g ? '<i class="gstar">★</i>' : ''}${medalOf(c.best) ? `<i class="medal m-${medalOf(c.best).id}"></i>` : ''}×${c.n}</span>` : '') +
            window.FishArt.svg(f, { silhouette: !c }) +
            (known ? esc(f.name) : '???') + '</button>';
        }).join('') + '</div></div>';
    });
    $('journal').innerHTML = html;
  }
  $('journal').addEventListener('click', e => {
    const b = e.target.closest('[data-fish]');
    if (b) showFish(BY_ID[b.dataset.fish]);
  });

  function nextMedal(f, best) {
    const next = MEDALS.slice().reverse().find(m => best < m[1]);
    return next ? `<br><span class="muted">${next[2]} at ${fmtCatchLen(f.len * next[1])}</span>` : '';
  }
  function showFish(f) {
    const c = S.col.caught[f.id], seen = S.col.seen[f.id], a = AREA[f.area];
    const rar = `<span class="rar r-${f.rarity}">${RARITY[f.rarity].name}</span>`;
    if (!c && !seen) {
      openModal(`${window.FishArt.svg(f, { silhouette: true })}<h2>Not caught yet</h2>
        <p>Something ${RARITY[f.rarity].name.toLowerCase()} that lives in the <b>${a.name}</b>.</p>
        <p class="muted">Catch it in Fishing to add its full entry to your journal.</p>`);
      return;
    }
    openModal(
      `${window.FishArt.svg(f, { silhouette: !c, golden: !!(c && c.g) })}
       <h2>${esc(f.name)}</h2><p class="muted"><i>${esc(f.sci)}</i> · ${rar}</p>
       <p>${esc(f.clue)}</p>
       <table class="facts">
         <tr><td>Habitat</td><td>${a.name}</td></tr>
         <tr><td>Family</td><td>${esc(f.group)}</td></tr>
         <tr><td>Native range</td><td>${esc(rangeLong(f))}</td></tr>
         <tr><td>Diet</td><td>${DIETS[f.diet]}</td></tr>
         <tr><td>Record size</td><td>${fmtLen(f.len)} · ${fmtKg(f.kg)}</td></tr>
         ${c ? `<tr><td>Your catches</td><td>${c.n}</td></tr><tr><td>Your biggest</td><td>${fmtCatchLen(f.len * c.best)} · ${fmtCatchKg(f.kg * Math.pow(c.best, 3))}</td></tr>` +
               `<tr><td>Medal</td><td>${medalOf(c.best) ? `<i class="medal m-${medalOf(c.best).id}"></i> ${medalOf(c.best).name}` : 'None yet'}${nextMedal(f, c.best)}</td></tr>` +
               `<tr><td>Golden</td><td>${c.g ? `<i class="gstar">★</i> Caught ${c.g}` : 'Not yet. About 1 catch in 30 is golden.'}</td></tr>`
             : '<tr><td>Status</td><td>Seen in the Daily Catch, not caught yet</td></tr>'}
       </table>`);
  }

  /* =====================================================================
     AQUARIUM
     ===================================================================== */
  const tank = new window.FathomScene.Tank($('tank'));
  const tankCap = () => TANKS[S.tank.size].fish;
  const RANK = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
  function renderTank() {
    const cap = tankCap();
    let ids = S.tank.fish.filter(id => S.col.caught[id]).slice(0, cap);
    if (!S.tank.set && ids.length < cap) {
      // until the player chooses for themselves, show off their best catches
      const rest = Object.keys(S.col.caught).filter(id => BY_ID[id] && !ids.includes(id))
        .sort((x, y) => RANK[BY_ID[x].rarity] - RANK[BY_ID[y].rarity] || BY_ID[y].len - BY_ID[x].len);
      ids = ids.concat(rest).slice(0, cap);
    }
    S.tank.fish = ids;
    tank.setFish(ids.map(id => ({ fish: BY_ID[id], golden: (S.col.caught[id].g || 0) > 0 })));
    tank.setDecor(DECOR.filter(d => S.tank.decor[d.id] === 1).map(d => d.id));
    $('tank-coins').textContent = S.col.coins.toLocaleString();
    $('tank-info').textContent = `${ids.length} of ${cap} fish`;
    $('tank-empty').hidden = ids.length > 0;
    $('btn-stock').disabled = !Object.keys(S.col.caught).length;
  }

  function showStock() {
    const cap = tankCap(), sel = S.tank.fish.slice();
    const mine = FISH.filter(f => S.col.caught[f.id]);
    const count = () => { $('stock-count').textContent = `${sel.length} of ${cap} chosen. Your ${TANKS[S.tank.size].name.toLowerCase()} holds ${cap}.`; };
    openModal(
      `<h2>Choose fish</h2><p class="muted" id="stock-count"></p><div class="grid stock">` +
      mine.map(f => `<button class="card pick" data-pick="${f.id}" aria-pressed="${sel.includes(f.id)}">${window.FishArt.svg(f, { golden: S.col.caught[f.id].g > 0 })}${esc(f.name)}</button>`).join('') +
      '</div><button class="btn" id="stock-ok" style="width:100%;margin-top:14px">Done</button>',
      () => { S.tank.fish = sel; S.tank.set = true; save(); renderTank(); });
    count();
    $('modal-body').querySelector('.stock').addEventListener('click', e => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      const id = b.dataset.pick, at = sel.indexOf(id);
      if (at >= 0) sel.splice(at, 1);
      else if (sel.length < cap) sel.push(id);
      else { $('stock-count').textContent = `The tank is full at ${cap}. Take one out first, or buy a bigger tank.`; return; }
      b.setAttribute('aria-pressed', at < 0);
      count();
    });
    $('stock-ok').addEventListener('click', closeModal);
  }

  function showTankShop() {
    const next = TANKS[S.tank.size + 1];
    const size = `<div class="shop-item"><div><b>${next ? 'Bigger tank' : TANKS[S.tank.size].name}</b><p>${next ? `Yours holds ${tankCap()} fish. The ${next.name.toLowerCase()} holds ${next.fish}.` : `Holds ${tankCap()} fish. This is the biggest tank.`}</p></div>` +
      `<button class="btn small" id="buy-tank" ${!next || S.col.coins < next.cost ? 'disabled' : ''}>${next ? next.cost.toLocaleString() : 'Maxed'}</button></div>`;
    const items = DECOR.map(d => {
      const own = d.id in S.tank.decor, on = S.tank.decor[d.id] === 1;
      return `<div class="shop-item"><div class="deco-row"><span class="deco-pic">${window.FathomScene.decorSvg(d)}</span><div><b>${d.name}</b><p>${own ? (on ? 'In your tank' : 'Put away') : 'Decoration'}</p></div></div>` +
        (own ? `<button class="btn small ghost" data-deco="${d.id}">${on ? 'Put away' : 'Put back'}</button>`
             : `<button class="btn small" data-deco="${d.id}" ${S.col.coins < d.cost ? 'disabled' : ''}>${d.cost.toLocaleString()}</button>`) + '</div>';
    }).join('');
    openModal(`<h2>Tank shop</h2><p class="muted"><i class="coin"></i> ${S.col.coins.toLocaleString()} coins</p>${size}${items}`);
    $('buy-tank').addEventListener('click', () => {
      if (!next || S.col.coins < next.cost) return;
      S.col.coins -= next.cost; S.tank.size++; save();
      renderTank(); showTankShop();
    });
    $('modal-body').querySelectorAll('[data-deco]').forEach(b => b.addEventListener('click', () => {
      const d = DECOR.find(x => x.id === b.dataset.deco);
      if (d.id in S.tank.decor) S.tank.decor[d.id] = S.tank.decor[d.id] ? 0 : 1;
      else { if (S.col.coins < d.cost) return; S.col.coins -= d.cost; S.tank.decor[d.id] = 1; }
      save(); renderTank(); showTankShop();
    }));
  }
  $('btn-stock').addEventListener('click', showStock);
  $('btn-tankshop').addEventListener('click', showTankShop);

  /* =====================================================================
     TABS + BOOT
     ===================================================================== */
  let currentTab = 'daily';
  function showTab(tab) {
    if (currentTab === 'fish' && tab !== 'fish') {
      if (fs.phase === 'land') finishLanding();
      else if (fs.phase !== 'idle') resetFishing();
    }
    currentTab = tab;
    if (tab === 'fish') fx.start(); else fx.stop();
    if (tab === 'tank') tank.start(); else tank.stop();
    document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
    ['daily', 'fish', 'journal', 'tank'].forEach(t => { $('view-' + t).hidden = t !== tab; });
    if (tab === 'daily') renderDaily();
    if (tab === 'fish') renderFishing();
    if (tab === 'journal') renderJournal();
    if (tab === 'tank') renderTank();
    window.scrollTo(0, 0);
  }
  document.querySelector('.tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (b) showTab(b.dataset.tab);
  });

  function refreshView() {
    if (currentTab === 'daily') renderDaily();
    if (currentTab === 'fish') renderFishing();
    if (currentTab === 'journal') renderJournal();
    if (currentTab === 'tank') renderTank();
    if (S.seenHelp && $('help-ok')) closeModal();
  }

  setPhase('idle');
  renderDaily();
  setCloud('local');
  if (!S.seenHelp) showHelp();
  initCloud();

  // exposed for automated tests
  window.__fathom = { get S() { return S; }, FISH, compare, answerFor, dayNum, fightInit, fightStep, pickFish, shareText, save, BY_ID, mergeStates, adopt, fresh, backupCode, restoreBackup, medalOf, unlockInfo, recordCatch, tank, get today() { return today; } };
})();
