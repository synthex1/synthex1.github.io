import { useState, useEffect, useRef, useMemo } from "react";

/* ------------------------------------------------------------------ */
/*  Game Theory Lab — decision-tree rollback + Nash equilibrium       */
/*  v2: named scenarios + one-way probability sensitivity analysis    */
/* ------------------------------------------------------------------ */

const C = {
  paper: "#F7F8F3",
  grid: "#E4E8DE",
  ink: "#16242C",
  inkSoft: "#5A6B72",
  card: "#FFFFFF",
  line: "#D8DED3",
  decision: "#2A4FD7",
  chance: "#C97B12",
  best: "#0E8A5F",
  warn: "#B3261E",
};
const SERIES_COLORS = [C.decision, C.chance, "#7B2D8B", C.warn, "#0E6E8A"];

const fontDisplay = "'Space Grotesk','Avenir Next',system-ui,sans-serif";
const fontMono = "'IBM Plex Mono','SF Mono',Menlo,monospace";

let _uid = 1000;
const uid = () => "n" + _uid++;
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---------------- sample data ---------------- */

const sampleTree = {
  id: "n1", type: "decision", label: "Where to hold the party?",
  children: [
    {
      id: "n2", type: "chance", label: "Outdoor park (free)", prob: null,
      children: [
        { id: "n3", type: "terminal", label: "Sunny, great day", prob: 0.60, payoff: 100, children: [] },
        { id: "n4", type: "terminal", label: "Drizzle, some bail", prob: 0.30, payoff: -20, children: [] },
        { id: "n5", type: "terminal", label: "Storm, washout", prob: 0.10, payoff: -80, children: [] },
      ],
    },
    {
      id: "n6", type: "chance", label: "Rent indoor venue", prob: null,
      children: [
        { id: "n7", type: "terminal", label: "Great turnout", prob: 0.70, payoff: 40, children: [] },
        { id: "n8", type: "terminal", label: "Low turnout", prob: 0.30, payoff: -30, children: [] },
      ],
    },
    { id: "n10", type: "terminal", label: "Postpone it", prob: null, payoff: 0, children: [] },
  ],
};

const sampleTreePurchase = {
  id: "p1", type: "decision", label: "Buy the extended warranty?",
  children: [
    { id: "p2", type: "terminal", label: "Buy warranty", prob: null, payoff: -180, children: [] },
    {
      id: "p3", type: "chance", label: "Skip warranty", prob: null,
      children: [
        { id: "p4", type: "terminal", label: "No failure", prob: 0.80, payoff: 0, children: [] },
        { id: "p5", type: "terminal", label: "Minor repair", prob: 0.12, payoff: -150, children: [] },
        { id: "p6", type: "terminal", label: "Major failure", prob: 0.08, payoff: -1100, children: [] },
      ],
    },
  ],
};

/* the classic prisoner's dilemma; payoffs are years in prison (negative) */
const sampleMatrix = {
  rowName: "You", colName: "Partner",
  rows: ["Stay silent", "Confess"],
  cols: ["Stay silent", "Confess"],
  cells: [
    [{ a: -1, b: -1 }, { a: -10, b: 0 }],
    [{ a: 0, b: -10 }, { a: -6, b: -6 }],
  ],
};
/* the pre-PD placeholder matrix, kept so old saves still read as "no game yet" */
const legacyRateMatrix = {
  rows: ["Hold rate", "Cut rate"],
  cols: ["Hold rate", "Cut rate"],
  cells: [
    [{ a: 60, b: 60 }, { a: 10, b: 80 }],
    [{ a: 80, b: 10 }, { a: 25, b: 25 }],
  ],
};

const newScenario = (name) => ({ id: uid(), name, tree: clone(sampleTree), matrix: clone(sampleMatrix), gameDefined: false });
const purchaseScenario = () => ({ id: uid(), name: "Warranty example", tree: clone(sampleTreePurchase), matrix: clone(sampleMatrix), gameDefined: false });
const blankMatrix = () => ({
  rowName: "You", colName: "Them",
  rows: ["Strategy 1", "Strategy 2"],
  cols: ["Strategy 1", "Strategy 2"],
  cells: [
    [{ a: 0, b: 0 }, { a: 0, b: 0 }],
    [{ a: 0, b: 0 }, { a: 0, b: 0 }],
  ],
});
/* legacy saves have no gameDefined flag: an untouched sample matrix means no game yet */
const matrixKey = (m) => {
  try {
    return JSON.stringify([m.rows, m.cols, m.cells.map(row => row.map(c => [num(c.a), num(c.b)]))]);
  } catch (e) { return "bad"; }
};
const isSampleMatrix = (m) => matrixKey(m) === matrixKey(sampleMatrix);
const isPlaceholderMatrix = (m) => isSampleMatrix(m) || matrixKey(m) === matrixKey(legacyRateMatrix);
const withGameFlag = (s) => (s.gameDefined == null ? { ...s, gameDefined: !isPlaceholderMatrix(s.matrix) } : s);

/* ---- normalize AI-drafted JSON into safe app data ---- */
function normalizeTree(n) {
  const kids = Array.isArray(n?.children) ? n.children : [];
  let type = ["decision", "chance", "terminal"].includes(n?.type) ? n.type : (kids.length ? "decision" : "terminal");
  if (type !== "terminal" && kids.length === 0) type = "terminal";
  return {
    id: uid(),
    type,
    label: String(n?.label ?? "Node").slice(0, 60),
    prob: n?.prob == null ? null : num(n.prob),
    payoff: num(n?.payoff),
    children: type === "terminal" ? [] : kids.map(normalizeTree),
  };
}
function normalizeMatrix(m) {
  try {
    const rows = m.rows.slice(0, 4).map(String), cols = m.cols.slice(0, 4).map(String);
    if (rows.length < 2 || cols.length < 2) throw 0;
    const cells = rows.map((_, r) => cols.map((_, c) => ({ a: num(m.cells[r][c].a), b: num(m.cells[r][c].b) })));
    return { rows, cols, cells };
  } catch (e) { return clone(sampleMatrix); }
}

/* ---------------- tree math ---------------- */

function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString();
const pct = (x) => `${Math.round(x * 1000) / 10}%`;

function evaluate(node) {
  if (node.type === "terminal" || !node.children?.length) {
    return { ...node, ev: num(node.payoff), children: [] };
  }
  const kids = node.children.map(evaluate);
  if (node.type === "decision") {
    let bestIdx = 0;
    kids.forEach((k, i) => { if (k.ev > kids[bestIdx].ev) bestIdx = i; });
    return { ...node, children: kids, ev: kids[bestIdx].ev, bestIdx };
  }
  const ev = kids.reduce((s, k) => s + num(k.prob) * k.ev, 0);
  const psum = kids.reduce((s, k) => s + num(k.prob), 0);
  return { ...node, children: kids, ev, psum };
}

function mapNode(node, id, fn) {
  if (node.id === id) return fn(node);
  return { ...node, children: node.children.map(k => mapNode(k, id, fn)) };
}
function pruneNode(node, id) {
  if (node.id === id) return null;
  return { ...node, children: node.children.map(k => pruneNode(k, id)).filter(Boolean) };
}
function findNode(node, id) {
  if (node.id === id) return node;
  for (const k of node.children) { const f = findNode(k, id); if (f) return f; }
  return null;
}
function collectChance(node, out = []) {
  if (node.type === "chance" && node.children.length >= 2) out.push(node);
  node.children.forEach(k => collectChance(k, out));
  return out;
}
/* set child prob to p, rescale siblings proportionally to sum 1 */
function withProb(tree, nodeId, childId, p) {
  return mapNode(clone(tree), nodeId, n => {
    const others = n.children.filter(k => k.id !== childId);
    const sumO = others.reduce((s, k) => s + num(k.prob), 0);
    const children = n.children.map(k => {
      if (k.id === childId) return { ...k, prob: p };
      const share = sumO > 0 ? num(k.prob) / sumO : 1 / Math.max(others.length, 1);
      return { ...k, prob: (1 - p) * share };
    });
    return { ...n, children };
  });
}

/* layout: leaves stacked, parents centered on children */
function layoutTree(root) {
  let leaf = 0;
  const nodes = [], edges = [];
  function walk(n, depth, onBestPath) {
    n.depth = depth;
    if (!n.children.length) { n.row = leaf++; }
    else {
      n.children.forEach((k, i) => {
        const childBest = onBestPath && (n.type === "chance" || i === n.bestIdx);
        walk(k, depth + 1, childBest);
        edges.push({ from: n, to: k, best: childBest });
      });
      n.row = n.children.reduce((s, k) => s + k.row, 0) / n.children.length;
    }
    n.onBest = onBestPath;
    nodes.push(n);
  }
  walk(root, 0, true);
  return { nodes, edges, leaves: leaf };
}

/* ---------------- nash math ---------------- */

function solveNash(m) {
  const R = m.rows.length, Cn = m.cols.length;
  const bestA = Array.from({ length: R }, () => Array(Cn).fill(false));
  const bestB = Array.from({ length: R }, () => Array(Cn).fill(false));
  for (let c = 0; c < Cn; c++) {
    const max = Math.max(...m.cells.map(row => num(row[c].a)));
    for (let r = 0; r < R; r++) if (num(m.cells[r][c].a) === max) bestA[r][c] = true;
  }
  for (let r = 0; r < R; r++) {
    const max = Math.max(...m.cells[r].map(cell => num(cell.b)));
    for (let c = 0; c < Cn; c++) if (num(m.cells[r][c].b) === max) bestB[r][c] = true;
  }
  const pure = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++)
    if (bestA[r][c] && bestB[r][c]) pure.push([r, c]);

  /* Pareto efficiency: a cell is efficient if no other cell leaves one player
     better off without leaving the other worse off */
  const dominates = (r2, c2, r, c) => {
    const a = num(m.cells[r][c].a), b = num(m.cells[r][c].b);
    const a2 = num(m.cells[r2][c2].a), b2 = num(m.cells[r2][c2].b);
    return a2 >= a && b2 >= b && (a2 > a || b2 > b);
  };
  const pareto = Array.from({ length: R }, () => Array(Cn).fill(true));
  for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++)
    for (let r2 = 0; r2 < R && pareto[r][c]; r2++) for (let c2 = 0; c2 < Cn; c2++)
      if (dominates(r2, c2, r, c)) { pareto[r][c] = false; break; }
  /* for an inefficient cell, the improvement to point at (prefer strictly better for both) */
  const betterThan = (r, c) => {
    const a = num(m.cells[r][c].a), b = num(m.cells[r][c].b);
    let some = null;
    for (let r2 = 0; r2 < R; r2++) for (let c2 = 0; c2 < Cn; c2++) {
      if (!dominates(r2, c2, r, c)) continue;
      const both = num(m.cells[r2][c2].a) > a && num(m.cells[r2][c2].b) > b;
      if (both) return { r: r2, c: c2, both: true };
      if (!some) some = { r: r2, c: c2, both: false };
    }
    return some;
  };

  let mixed = null;
  if (R === 2 && Cn === 2) {
    const a = (r, c) => num(m.cells[r][c].a), b = (r, c) => num(m.cells[r][c].b);
    const pDen = b(0, 0) - b(0, 1) - b(1, 0) + b(1, 1);
    const qDen = a(0, 0) - a(0, 1) - a(1, 0) + a(1, 1);
    if (pDen !== 0 && qDen !== 0) {
      const p = (b(1, 1) - b(1, 0)) / pDen;
      const q = (a(1, 1) - a(0, 1)) / qDen;
      if (p > 0 && p < 1 && q > 0 && q < 1) mixed = { p, q };
    }
  }
  return { bestA, bestB, pure, mixed, pareto, betterThan };
}

/* ================================================================== */

export default function GameTheoryLab() {
  const [mode, setMode] = useState("tree");
  const [scenarios, setScenarios] = useState([newScenario("Party planning example"), purchaseScenario()]);
  const [curId, setCurId] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [armDelete, setArmDelete] = useState(false);
  const loaded = useRef(false);
  const timer = useRef(null);

  const cur = scenarios.find(s => s.id === curId) || scenarios[0];

  /* load once — v2, else migrate v1, else default */
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("gt-lab-v2");
        if (res?.value) {
          const d = JSON.parse(res.value);
          if (d.uid) _uid = d.uid;
          if (d.scenarios?.length) {
            let list = (d.purchaseAdded ? d.scenarios : [...d.scenarios, purchaseScenario()]).map(withGameFlag);
            if (!d.partyAdded) list = [...list, newScenario("Party planning example")];
            setScenarios(list); setCurId(d.curId || list[0].id); loaded.current = true; return;
          }
        }
      } catch (e) { /* fall through */ }
      try {
        const v1 = await window.storage.get("gt-lab-v1");
        if (v1?.value) {
          const d = JSON.parse(v1.value);
          if (d.uid) _uid = Math.max(_uid, d.uid);
          const s = withGameFlag({ id: uid(), name: "Scenario 1", tree: d.tree || clone(sampleTree), matrix: d.matrix || clone(sampleMatrix) });
          setScenarios([s]); setCurId(s.id);
        }
      } catch (e) { /* no saved data — fine */ }
      loaded.current = true;
    })();
  }, []);

  /* autosave (debounced) */
  useEffect(() => {
    if (!loaded.current) return;
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await window.storage.set("gt-lab-v2", JSON.stringify({ scenarios, curId: cur?.id, uid: _uid, purchaseAdded: true, partyAdded: true }));
        setSaveState("saved");
      } catch (e) { setSaveState("local"); }
    }, 800);
    return () => clearTimeout(timer.current);
  }, [scenarios, curId]);

  const patchCur = (patch) =>
    setScenarios(list => list.map(s => (s.id === cur.id ? { ...s, ...patch } : s)));
  const setTree = (fn) => patchCur({ tree: typeof fn === "function" ? fn(cur.tree) : fn });
  const setMatrix = (fn) => patchCur({ matrix: typeof fn === "function" ? fn(cur.matrix) : fn });

  const addScenario = () => {
    const s = newScenario(`Scenario ${scenarios.length + 1}`);
    setScenarios(list => [...list, s]); setCurId(s.id);
  };
  const duplicateScenario = () => {
    const s = { ...clone(cur), id: uid(), name: cur.name + " copy" };
    setScenarios(list => [...list, s]); setCurId(s.id);
  };
  const deleteScenario = () => {
    if (!armDelete) { setArmDelete(true); setTimeout(() => setArmDelete(false), 2500); return; }
    setArmDelete(false);
    setScenarios(list => {
      const rest = list.filter(s => s.id !== cur.id);
      const next = rest.length ? rest : [newScenario("Scenario 1")];
      setCurId(next[0].id);
      return next;
    });
  };
  const resetCur = () => patchCur(mode === "tree" ? { tree: clone(sampleTree) } : { matrix: clone(sampleMatrix), gameDefined: true });

  const addDraft = (d) => {
    const s = {
      id: uid(),
      name: String(d?.name || "Drafted scenario").slice(0, 40),
      tree: d?.tree ? normalizeTree(d.tree) : clone(sampleTree),
      matrix: normalizeMatrix(d?.matrix),
      gameDefined: !!d?.matrix,
    };
    setScenarios(list => [...list, s]);
    setCurId(s.id);
    if (d?.tree) setMode("tree"); else if (d?.matrix) setMode("nash");
  };

  if (!cur) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: fontDisplay, paddingBottom: 48 }}>
      <style>{`
        * { box-sizing: border-box; }
        input, select, button { font-family: inherit; }
        input:focus, select:focus, button:focus-visible { outline: 2px solid ${C.decision}; outline-offset: 1px; }
        @media (prefers-reduced-motion: no-preference) {
          .bestEdge { stroke-dasharray: 400; stroke-dashoffset: 400; animation: draw 0.9s ease forwards; }
          @keyframes draw { to { stroke-dashoffset: 0; } }
        }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <header style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Game Theory Lab</h1>
          <span style={{ fontFamily: fontMono, fontSize: 11, color: saveState === "local" ? C.warn : C.inkSoft }}>
            {saveState === "saving" ? "saving…" : saveState === "saved" ? "saved" : saveState === "local" ? "not saved" : ""}
          </span>
        </div>

        {/* scenario bar */}
        <div style={{ display: "flex", gap: 6, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select value={cur.id} onChange={e => { setCurId(e.target.value); setArmDelete(false); }}
            style={{ flex: "1 1 120px", minWidth: 0, fontSize: 13, padding: "8px 6px", borderRadius: 8, border: `1px solid ${C.line}`, background: C.card, fontWeight: 600 }}>
            {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={addScenario} style={barBtn(C.decision)} aria-label="New scenario">+ new</button>
          <button onClick={duplicateScenario} style={barBtn(C.ink)} aria-label="Duplicate scenario">copy</button>
          <button onClick={deleteScenario} style={barBtn(C.warn)} aria-label="Delete scenario">
            {armDelete ? "sure?" : "delete"}
          </button>
        </div>
        <input value={cur.name} onChange={e => patchCur({ name: e.target.value })}
          aria-label="Scenario name"
          style={{ marginTop: 8, width: "100%", fontSize: 13, padding: "7px 8px", borderRadius: 8, border: `1px dashed ${C.line}`, background: "transparent", fontWeight: 600, color: C.inkSoft }} />

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {[["tree", "Decision tree"], ["nash", "Nash equilibrium"]].map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 14, fontWeight: 600,
                border: `1.5px solid ${mode === k ? C.ink : C.line}`,
                background: mode === k ? C.ink : C.card, color: mode === k ? C.paper : C.ink,
              }}>{label}</button>
          ))}
        </div>
      </header>

      <DraftAI onCreate={addDraft} />

      {mode === "tree"
        ? <TreeMode tree={cur.tree} setTree={setTree} />
        : <NashMode matrix={cur.matrix} setMatrix={setMatrix} defined={!!cur.gameDefined}
            define={(kind) => patchCur({ gameDefined: true, matrix: kind === "blank" ? blankMatrix() : clone(sampleMatrix) })} />}

      <div style={{ padding: "24px 16px 0", textAlign: "center" }}>
        <button onClick={resetCur} style={{ background: "none", border: "none", color: C.inkSoft, fontSize: 12, textDecoration: "underline" }}>
          Reset this scenario's {mode === "tree" ? "tree" : "game"} to example
        </button>
      </div>
    </div>
  );
}

const barBtn = (color) => ({
  fontSize: 12, fontWeight: 700, color, background: "none",
  border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px",
});

/* ================= AI DRAFTING ================= */
/* Drafting goes through /api/draft (serverless proxy that holds the API key
   and the prompt). Access is gated by a passphrase, asked for once and kept
   in localStorage; a rejected passphrase clears it and asks again. */

const PASS_KEY = "gt-lab-passphrase";
const getPass = () => { try { return window.localStorage.getItem(PASS_KEY) || ""; } catch (e) { return ""; } };
const setPassStore = (p) => { try { window.localStorage.setItem(PASS_KEY, p); } catch (e) { /* in-memory session only */ } };
const clearPassStore = () => { try { window.localStorage.removeItem(PASS_KEY); } catch (e) { /* ignore */ } };

function DraftAI({ onCreate }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pass, setPass] = useState("");
  const [hasPass, setHasPass] = useState(() => !!getPass());

  const run = async () => {
    if (!text.trim() || busy) return;
    const passphrase = hasPass ? getPass() : pass.trim();
    if (!passphrase) { setErr("Enter the passphrase to use AI drafting."); return; }
    setBusy(true); setErr("");
    try {
      let res;
      try {
        res = await fetch("/api/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario: text, passphrase }),
        });
      } catch (e) {
        setErr("Couldn't reach the drafting service — check your connection and try again.");
        return;
      }
      if (res.status === 401) {
        clearPassStore(); setHasPass(false); setPass("");
        setErr("That passphrase wasn't accepted — check it and try again.");
        return;
      }
      if (!res.ok) {
        setErr("The drafting service had a problem — try again in a moment.");
        return;
      }
      let parsed;
      try {
        const data = await res.json();
        const raw = String(data.text || "");
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      } catch (e) {
        setErr("The draft came back malformed — try again or add a bit more detail.");
        return;
      }
      setPassStore(passphrase); setHasPass(true); setPass("");
      onCreate(parsed);
      setText(""); setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: "10px 12px 0" }}>
      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{ width: "100%", padding: "10px 0", borderRadius: 10, fontSize: 13.5, fontWeight: 600, border: `1.5px dashed ${C.decision}`, background: "transparent", color: C.decision }}>
          ✦ Draft a scenario with AI
        </button>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 10 }}>
          <SectionTitle>Describe your scenario</SectionTitle>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
            placeholder="e.g. Should I fix my 9-year-old car's transmission for $2,800 or put that toward a newer used car?"
            style={{ width: "100%", marginTop: 6, fontSize: 14, padding: 8, borderRadius: 8, border: `1px solid ${C.line}`, background: C.paper, color: C.ink, resize: "vertical", fontFamily: fontDisplay }} />
          {!hasPass && (
            <input type="password" value={pass} onChange={e => setPass(e.target.value)}
              placeholder="Passphrase" aria-label="Drafting passphrase" autoComplete="current-password"
              style={{ width: "100%", marginTop: 6, fontSize: 14, padding: 8, borderRadius: 8, border: `1px solid ${C.line}`, background: C.paper, color: C.ink, fontFamily: fontDisplay }} />
          )}
          {err && <p style={{ margin: "6px 0 0", fontSize: 12, color: C.warn }}>{err}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={run} disabled={busy || !text.trim()}
              style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13.5, fontWeight: 700, border: "none", background: busy ? C.inkSoft : C.decision, color: C.paper, opacity: text.trim() ? 1 : 0.5 }}>
              {busy ? "Drafting…" : "Draft it"}
            </button>
            <button onClick={() => { setOpen(false); setErr(""); }} style={barBtn(C.inkSoft)}>cancel</button>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11.5, color: C.inkSoft, lineHeight: 1.4 }}>
            The draft is added as a regular scenario — edit the probabilities and payoffs, rename it, or delete it anytime.
          </p>
        </div>
      )}
    </div>
  );
}

/* ================= TREE MODE ================= */

function TreeMode({ tree, setTree }) {
  const solved = useMemo(() => evaluate(clone(tree)), [tree]);

  const update = (id, patch) => setTree(t => mapNode(t, id, n => ({ ...n, ...patch })));
  const addChild = (id) => setTree(t => mapNode(t, id, n => ({
    ...n,
    type: n.type === "terminal" ? "decision" : n.type,
    children: [...n.children, { id: uid(), type: "terminal", label: "New outcome", prob: n.type === "chance" ? 0 : null, payoff: 0, children: [] }],
  })));
  const remove = (id) => setTree(t => pruneNode(t, id) || t);
  const setType = (id, type) => setTree(t => mapNode(t, id, n => ({
    ...n, type, children: type === "terminal" ? [] : n.children,
  })));
  /* keep this child's p as typed, redistribute the remainder across siblings */
  const rescale = (parentId, childId) => setTree(t => {
    const p = Math.min(Math.max(num(findNode(t, childId)?.prob), 0), 1);
    return withProb(t, parentId, childId, p);
  });

  return (
    <div>
      <TreeCanvas solved={solved} />
      <section style={{ padding: "8px 12px 0" }}>
        <SectionTitle>Structure & inputs</SectionTitle>
        <p style={{ margin: "0 0 10px", fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5 }}>
          Squares are your decisions, circles are chance. EVs roll back from the outcomes; the green path is the optimal strategy.
        </p>
        <NodeCard node={tree} solvedRoot={solved} parent={null} depth={0}
          update={update} addChild={addChild} remove={remove} setType={setType} rescale={rescale} />
      </section>
      <Sensitivity tree={tree} solved={solved} />
    </div>
  );
}

/* ---------- sensitivity analysis ---------- */

function Sensitivity({ tree, solved }) {
  const chanceNodes = useMemo(() => collectChance(tree), [tree]);
  const [sel, setSel] = useState("");

  const options = [];
  chanceNodes.forEach(n => n.children.forEach(k =>
    options.push({ value: `${n.id}|${k.id}`, label: `${n.label} — vary “${k.label}”` })
  ));

  useEffect(() => {
    if (!options.some(o => o.value === sel)) setSel(options[0]?.value || "");
  }, [tree]); // eslint-disable-line

  const data = useMemo(() => {
    if (!sel) return null;
    const [nodeId, childId] = sel.split("|");
    const parent = findNode(tree, nodeId);
    const child = parent && findNode(parent, childId);
    if (!parent || !child) return null;

    const root = tree;
    const seriesLabels = (root.type === "decision" && root.children.length >= 2)
      ? root.children.map(k => k.label)
      : ["Overall EV"];
    const N = 51;
    const ps = Array.from({ length: N }, (_, i) => i / (N - 1));
    const series = seriesLabels.map(label => ({ label, vals: [] }));
    ps.forEach(p => {
      const ev = evaluate(withProb(tree, nodeId, childId, p));
      if (series.length === 1 && seriesLabels[0] === "Overall EV") series[0].vals.push(ev.ev);
      else ev.children.forEach((k, i) => series[i].vals.push(k.ev));
    });
    /* best-choice switch points (only meaningful with a decision root) */
    const switches = [];
    if (series.length > 1) {
      const argmax = i => series.reduce((b, s, j) => (s.vals[i] > series[b].vals[i] ? j : b), 0);
      let prev = argmax(0);
      for (let i = 1; i < N; i++) {
        const a = argmax(i);
        if (a !== prev) { switches.push({ p: (ps[i - 1] + ps[i]) / 2, from: prev, to: a }); prev = a; }
      }
    }
    return { ps, series, switches, currentP: num(child.prob), parentLabel: parent.label, childLabel: child.label };
  }, [tree, sel]);

  if (!options.length) return (
    <section style={{ padding: "20px 12px 0" }}>
      <SectionTitle>Sensitivity</SectionTitle>
      <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "4px 0 0" }}>
        Add a chance node with two or more branches to run sensitivity analysis.
      </p>
    </section>
  );

  return (
    <section style={{ padding: "20px 12px 0" }}>
      <SectionTitle>Sensitivity</SectionTitle>
      <p style={{ margin: "2px 0 8px", fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5 }}>
        Sweep one probability from 0 to 1 (siblings rescale proportionally) and see how each option's EV responds.
      </p>
      <select value={sel} onChange={e => setSel(e.target.value)}
        style={{ width: "100%", fontSize: 13, padding: "8px 6px", borderRadius: 8, border: `1px solid ${C.line}`, background: C.card, fontWeight: 600 }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {data && <SensitivityChart data={data} />}

      {data?.switches.length > 0 && (
        <div style={{ marginTop: 10, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 10 }}>
          {data.switches.map((s, i) => (
            <p key={i} style={{ margin: i ? "6px 0 0" : 0, fontSize: 13, lineHeight: 1.5 }}>
              Best choice switches from <strong>{data.series[s.from].label}</strong> to <strong>{data.series[s.to].label}</strong> at p ≈ <span style={{ fontFamily: fontMono, fontWeight: 600 }}>{fmt(s.p)}</span>
            </p>
          ))}
        </div>
      )}
      {data && data.series.length > 1 && data.switches.length === 0 && (
        <p style={{ marginTop: 10, fontSize: 12.5, color: C.inkSoft }}>
          The best choice doesn't change anywhere in this range — the decision is robust to this probability.
        </p>
      )}
      {data && <SensWorkings tree={tree} sel={sel} data={data} />}
    </section>
  );
}

/* ---------- collapsible workings ---------- */

const wHead = { margin: "12px 0 2px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkSoft };
const wLine = { margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.55 };
const wMono = { fontFamily: fontMono, fontSize: 11.5 };

function Workings({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 14 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, border: `1px dashed ${C.line}`, background: "transparent", color: C.inkSoft }}>
        {open ? "Hide the workings" : "Show the workings"}
      </button>
      {open && <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginTop: 8 }}>{children}</div>}
    </div>
  );
}

function SensWorkings({ tree, sel, data }) {
  const [nodeId, childId] = sel.split("|");
  const parent = findNode(tree, nodeId);
  if (!parent) return null;
  const siblings = parent.children.filter(k => k.id !== childId);
  const sumO = siblings.reduce((s, k) => s + num(k.prob), 0);
  const N = data.ps.length;
  const single = data.series.length === 1;
  return (
    <Workings>
      <p style={{ ...wHead, marginTop: 0 }}>1 · What's swept</p>
      <p style={wLine}>
        p = P(<strong>{data.childLabel}</strong>) under <strong>{data.parentLabel}</strong> runs from 0 to 1
        across {N} grid points. Every other number in the tree stays fixed. The dashed "now" line marks the
        current value, p = <span style={wMono}>{fmt(data.currentP)}</span>.
      </p>
      <p style={wHead}>2 · Rescaling the siblings</p>
      <p style={wLine}>
        The other branches of that chance node share what's left (1 − p), keeping their current ratio:
      </p>
      {siblings.map(k => (
        <p key={k.id} style={{ ...wLine, ...wMono }}>
          {truncate(k.label, 24)}: (1 − p) × {sumO > 0 ? pct(num(k.prob) / sumO) : pct(1 / Math.max(siblings.length, 1))}
        </p>
      ))}
      <p style={wHead}>3 · Re-rolling the tree</p>
      <p style={wLine}>
        At each grid point the whole tree is re-evaluated by rollback — a chance node's EV is the
        probability-weighted sum of its branches, a decision node takes the best branch. Each{" "}
        {single ? "EV" : "option's EV"} is a straight line in p:
      </p>
      {data.series.map((s, j) => (
        <p key={j} style={{ ...wLine, ...wMono }}>
          {truncate(s.label, 24)}: EV {fmt(s.vals[0])} at p = 0 → EV {fmt(s.vals[N - 1])} at p = 1
        </p>
      ))}
      <p style={wHead}>4 · Finding the switch</p>
      {single ? (
        <p style={wLine}>With a single option there's nothing to switch between — the chart just shows how the overall EV responds to p.</p>
      ) : data.switches.length === 0 ? (
        <p style={wLine}>The same option has the highest EV at all {N} grid points, so the lines never cross inside the range and no switch is reported.</p>
      ) : (
        <>
          <p style={wLine}>The best option is compared at every grid point; where the leader changes between two neighbouring points, the crossing is reported at their midpoint:</p>
          {data.switches.map((s, i) => {
            const idx = Math.min(Math.max(Math.ceil(s.p * (N - 1)), 1), N - 1);
            return (
              <p key={i} style={{ ...wLine, ...wMono }}>
                p = {fmt(data.ps[idx - 1])}: {truncate(data.series[s.from].label, 18)} leads ({fmt(data.series[s.from].vals[idx - 1])} vs {fmt(data.series[s.to].vals[idx - 1])}) ·
                p = {fmt(data.ps[idx])}: {truncate(data.series[s.to].label, 18)} leads ({fmt(data.series[s.to].vals[idx])} vs {fmt(data.series[s.from].vals[idx])}) → switch at p ≈ {fmt(s.p)}
              </p>
            );
          })}
        </>
      )}
    </Workings>
  );
}

function SensitivityChart({ data }) {
  const W = 340, H = 190, padL = 44, padR = 12, padT = 14, padB = 26;
  const all = data.series.flatMap(s => s.vals);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const X = p => padL + p * (W - padL - padR);
  const Y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", marginTop: 10, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10 }}>
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <line key={p} x1={X(p)} y1={padT} x2={X(p)} y2={H - padB} stroke={C.grid} strokeWidth="1" />
        ))}
        {[lo, (lo + hi) / 2, hi].map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={Y(v)} x2={W - padR} y2={Y(v)} stroke={C.grid} strokeWidth="1" />
            <text x={padL - 5} y={Y(v) + 3} textAnchor="end" fontSize="9" fontFamily={fontMono} fill={C.inkSoft}>{fmt(v)}</text>
          </g>
        ))}
        {/* zero line if in range */}
        {lo < 0 && hi > 0 && <line x1={padL} y1={Y(0)} x2={W - padR} y2={Y(0)} stroke={C.inkSoft} strokeWidth="1" strokeDasharray="3 3" />}
        {/* current p marker */}
        <line x1={X(data.currentP)} y1={padT} x2={X(data.currentP)} y2={H - padB} stroke={C.ink} strokeWidth="1.5" strokeDasharray="4 3" />
        <text x={X(data.currentP)} y={padT - 3} textAnchor="middle" fontSize="9" fontFamily={fontMono} fill={C.ink}>now</text>
        {/* series */}
        {data.series.map((s, j) => (
          <path key={j} fill="none" stroke={SERIES_COLORS[j % SERIES_COLORS.length]} strokeWidth="2.5"
            d={s.vals.map((v, i) => `${i ? "L" : "M"}${X(data.ps[i])},${Y(v)}`).join(" ")} />
        ))}
        {/* switch markers */}
        {data.switches.map((s, i) => (
          <circle key={i} cx={X(s.p)} cy={Y(data.series[s.to].vals[Math.round(s.p * 50)])} r="4" fill={C.best} stroke={C.card} strokeWidth="1.5" />
        ))}
        {/* x labels */}
        {[0, 0.5, 1].map(p => (
          <text key={p} x={X(p)} y={H - 8} textAnchor="middle" fontSize="9" fontFamily={fontMono} fill={C.inkSoft}>{p}</text>
        ))}
        <text x={(padL + W - padR) / 2} y={H - 8} textAnchor="middle" fontSize="9" fontFamily={fontMono} fill={C.inkSoft} dy="0" dx="60"></text>
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
        {data.series.map((s, j) => (
          <span key={j} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
            <span style={{ width: 14, height: 3, background: SERIES_COLORS[j % SERIES_COLORS.length], borderRadius: 2 }} />
            {s.label}
          </span>
        ))}
        <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: fontMono }}>x = p({truncate(data.childLabel, 16)})</span>
      </div>
    </div>
  );
}

/* ---------- node editor ---------- */

function NodeCard({ node, solvedRoot, parent, depth, update, addChild, remove, setType, rescale }) {
  const s = findNode(solvedRoot, node.id) || {};
  const isChanceChild = parent?.type === "chance";
  const color = node.type === "decision" ? C.decision : node.type === "chance" ? C.chance : C.ink;
  const badPsum = node.type === "chance" && node.children.length > 0 && Math.abs((s.psum ?? 1) - 1) > 0.001;
  const parentSumOff = isChanceChild && parent.children.length > 1 &&
    Math.abs((findNode(solvedRoot, parent.id)?.psum ?? 1) - 1) > 0.001;

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 14, borderLeft: depth === 0 ? "none" : `2px solid ${C.line}`, paddingLeft: depth === 0 ? 0 : 10, marginBottom: 8 }}>
      <div style={{ background: C.card, border: `1px solid ${s.onBest ? C.best : C.line}`, borderRadius: 10, padding: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <NodeGlyph type={node.type} size={14} />
          <input value={node.label} onChange={e => update(node.id, { label: e.target.value })}
            style={{ flex: 1, minWidth: 0, border: "none", borderBottom: `1px solid ${C.line}`, background: "transparent", fontSize: 14, fontWeight: 600, color: C.ink, padding: "2px 0" }} />
          <span style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600, color: s.onBest ? C.best : C.inkSoft, whiteSpace: "nowrap" }}>
            EV {fmt(s.ev ?? 0)}
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
          <select value={node.type} onChange={e => setType(node.id, e.target.value)}
            style={{ fontSize: 12, padding: "5px 6px", borderRadius: 6, border: `1px solid ${C.line}`, color, fontWeight: 600, background: C.card }}>
            <option value="decision">Decision</option>
            <option value="chance">Chance</option>
            <option value="terminal">Outcome</option>
          </select>

          {isChanceChild && (
            <label style={{ fontSize: 12, color: C.inkSoft, display: "flex", alignItems: "center", gap: 4 }}>
              p =
              <input type="number" inputMode="decimal" step="0.05" min="0" max="1" value={node.prob ?? 0}
                onChange={e => update(node.id, { prob: e.target.value })}
                style={numStyle(64)} />
            </label>
          )}
          {parentSumOff && (
            <button onClick={() => rescale(parent.id, node.id)} style={miniBtn(C.chance)}
              title="Keep this probability and rescale the other branches so they sum to 1">
              ⚖ rescale others
            </button>
          )}

          {node.type === "terminal" && (
            <label style={{ fontSize: 12, color: C.inkSoft, display: "flex", alignItems: "center", gap: 4 }}>
              payoff
              <input type="number" value={node.payoff ?? 0}
                onChange={e => update(node.id, { payoff: e.target.value })}
                style={numStyle(80)} />
            </label>
          )}

          <span style={{ flex: 1 }} />
          <button onClick={() => addChild(node.id)} style={miniBtn(node.type === "terminal" ? C.inkSoft : C.decision)}>+ branch</button>
          {parent && <button onClick={() => remove(node.id)} style={miniBtn(C.warn)}>delete</button>}
        </div>

        {badPsum && (
          <div style={{ marginTop: 6, fontSize: 12, color: C.warn, fontFamily: fontMono }}>
            probabilities sum to {fmt(s.psum)} — should be 1
          </div>
        )}
      </div>

      {node.children.map(k => (
        <NodeCard key={k.id} node={k} solvedRoot={solvedRoot} parent={node} depth={depth + 1}
          update={update} addChild={addChild} remove={remove} setType={setType} rescale={rescale} />
      ))}
    </div>
  );
}

const numStyle = (w) => ({
  width: w, fontFamily: fontMono, fontSize: 13, padding: "4px 6px",
  borderRadius: 6, border: `1px solid ${C.line}`, background: C.card, color: C.ink,
});
const miniBtn = (color) => ({
  fontSize: 12, fontWeight: 600, color, background: "none",
  border: `1px solid ${C.line}`, borderRadius: 6, padding: "5px 8px",
});

function NodeGlyph({ type, size }) {
  if (type === "decision") return <span style={{ width: size, height: size, background: C.decision, borderRadius: 2, flexShrink: 0 }} />;
  if (type === "chance") return <span style={{ width: size, height: size, background: C.chance, borderRadius: "50%", flexShrink: 0 }} />;
  return <span style={{ width: 0, height: 0, borderTop: `${size / 2}px solid transparent`, borderBottom: `${size / 2}px solid transparent`, borderLeft: `${size - 2}px solid ${C.ink}`, flexShrink: 0 }} />;
}

function TreeCanvas({ solved }) {
  const { nodes, edges, leaves } = useMemo(() => layoutTree(clone(solved)), [solved]);
  const colW = 180, rowH = 60, padX = 24, padY = 30;
  const maxDepth = Math.max(...nodes.map(n => n.depth));
  const W = padX * 2 + colW * maxDepth + 140;
  const H = padY * 2 + rowH * Math.max(leaves - 1, 1) + 20;
  const X = n => padX + n.depth * colW;
  const Y = n => padY + n.row * rowH;

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", borderBottom: `1px solid ${C.line}`, background: `repeating-linear-gradient(0deg, transparent, transparent 19px, ${C.grid} 19px, ${C.grid} 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, ${C.grid} 19px, ${C.grid} 20px), ${C.paper}` }}>
      <svg width={W} height={H} style={{ display: "block" }}>
        {edges.map((e, i) => {
          const x1 = X(e.from) + 10, y1 = Y(e.from), x2 = X(e.to) - 8, y2 = Y(e.to);
          const mx = (x1 + x2) / 2;
          const label = e.from.type === "chance" ? `p=${fmt(num(e.to.prob))}` : e.to.label;
          return (
            <g key={i}>
              <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                fill="none"
                className={e.best ? "bestEdge" : undefined}
                stroke={e.best ? C.best : C.line}
                strokeWidth={e.best ? 3 : 1.5} />
              <text x={mx} y={(y1 + y2) / 2 - 6} textAnchor="middle"
                fontSize="10" fontFamily={fontMono}
                fill={e.best ? C.best : C.inkSoft}>
                {truncate(label, 20)}
              </text>
            </g>
          );
        })}
        {nodes.map(n => (
          <g key={n.id}>
            {n.type === "decision" && <rect x={X(n) - 8} y={Y(n) - 8} width={16} height={16} fill={C.decision} rx={2} />}
            {n.type === "chance" && <circle cx={X(n)} cy={Y(n)} r={8} fill={C.chance} />}
            {n.type === "terminal" && <path d={`M${X(n) - 7},${Y(n) - 7} L${X(n) + 7},${Y(n)} L${X(n) - 7},${Y(n) + 7} Z`} fill={C.ink} />}
            <text x={X(n)} y={Y(n) + 24} textAnchor="middle" fontSize="11" fontWeight="600" fontFamily={fontMono}
              fill={n.onBest ? C.best : C.inkSoft}>
              {fmt(n.ev)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

/* ================= NASH MODE ================= */

function NashMode({ matrix, setMatrix, defined, define }) {
  const sol = useMemo(() => solveNash(matrix), [matrix]);

  if (!defined) return (
    <div style={{ padding: "16px 12px 0" }}>
      <SectionTitle>Payoff matrix</SectionTitle>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, marginTop: 6 }}>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
          No game defined for this scenario yet.
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5 }}>
          This tab is for strategic games: two players each pick a strategy, and every cell holds both payoffs.
          A one-player decision like this scenario's tree doesn't need one.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={() => define("blank")}
            style={{ flex: 1, minWidth: 130, padding: "9px 0", borderRadius: 8, fontSize: 13.5, fontWeight: 700, border: "none", background: C.decision, color: C.paper }}>
            Start a blank game
          </button>
          <button onClick={() => define("example")} style={{ ...barBtn(C.ink), flex: 1, minWidth: 130 }}>
            Load the prisoner's dilemma
          </button>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 11.5, color: C.inkSoft, lineHeight: 1.4 }}>
          Or describe a two-player situation in "Draft with AI" — drafts that involve two players arrive with a matrix filled in.
        </p>
      </div>
    </div>
  );
  const R = matrix.rows.length, Cn = matrix.cols.length;

  const setCell = (r, c, k, v) => setMatrix(m => {
    const cells = m.cells.map(row => row.map(cell => ({ ...cell })));
    cells[r][c][k] = v;
    return { ...m, cells };
  });
  const setStrat = (axis, i, v) => setMatrix(m => {
    const arr = [...m[axis]]; arr[i] = v; return { ...m, [axis]: arr };
  });
  const resize = (axis, delta) => setMatrix(m => {
    const rows = [...m.rows], cols = [...m.cols];
    let cells = m.cells.map(row => row.map(cell => ({ ...cell })));
    if (axis === "rows") {
      if (delta > 0 && rows.length < 4) { rows.push(`Strategy ${rows.length + 1}`); cells.push(cols.map(() => ({ a: 0, b: 0 }))); }
      if (delta < 0 && rows.length > 2) { rows.pop(); cells.pop(); }
    } else {
      if (delta > 0 && cols.length < 4) { cols.push(`Strategy ${cols.length + 1}`); cells = cells.map(row => [...row, { a: 0, b: 0 }]); }
      if (delta < 0 && cols.length > 2) { cols.pop(); cells = cells.map(row => row.slice(0, -1)); }
    }
    return { ...m, rows, cols, cells };
  });

  return (
    <div style={{ padding: "16px 12px 0" }}>
      <SectionTitle>Payoff matrix</SectionTitle>
      <p style={{ margin: "0 0 10px", fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5 }}>
        Each cell is <span style={{ fontFamily: fontMono, color: C.decision }}>your payoff</span> / <span style={{ fontFamily: fontMono, color: C.chance }}>theirs</span>. Best responses are underlined; a cell where both are underlined is a Nash equilibrium. A corner dot marks Pareto-efficient cells — no other cell helps one player without hurting the other.
      </p>

      {isSampleMatrix(matrix) && (
        <div style={{ background: C.card, border: `1px dashed ${C.line}`, borderRadius: 10, padding: 10, marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55 }}>
            <strong>The prisoner's dilemma.</strong> You and a partner are arrested and questioned separately;
            payoffs are years in prison, so less negative is better. Whatever your partner does, confessing
            leaves <em>you</em> better off — so you both confess (the highlighted cell) and get −6 each, even
            though both staying silent (−1 each) would beat it for both of you. That gap between individual
            logic and the best joint outcome is what makes this game famous — notice the corner dots:
            every cell is Pareto-efficient except the equilibrium itself, the one outcome the two of you
            could jointly improve on.
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: C.inkSoft, lineHeight: 1.4 }}>
            Edit any number or name to make this game your own — this note disappears once you do.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Stepper label={`${R} rows`} onDown={() => resize("rows", -1)} onUp={() => resize("rows", 1)} />
        <Stepper label={`${Cn} cols`} onDown={() => resize("cols", -1)} onUp={() => resize("cols", 1)} />
      </div>

      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 120 + Cn * 110 }}>
          <thead>
            <tr>
              <th style={thStyle}></th>
              {matrix.cols.map((c, i) => (
                <th key={i} style={thStyle}>
                  <input value={c} onChange={e => setStrat("cols", i, e.target.value)} style={stratInput(C.chance)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((rName, r) => (
              <tr key={r}>
                <th style={thStyle}>
                  <input value={rName} onChange={e => setStrat("rows", r, e.target.value)} style={stratInput(C.decision)} />
                </th>
                {matrix.cols.map((_, c) => {
                  const isNE = sol.pure.some(([pr, pc]) => pr === r && pc === c);
                  return (
                    <td key={c} style={{
                      border: `1px solid ${C.line}`, padding: 6, textAlign: "center",
                      background: isNE ? "#E4F3EC" : C.card,
                      boxShadow: isNE ? `inset 0 0 0 2px ${C.best}` : "none",
                      position: "relative",
                    }}>
                      {sol.pareto[r][c] && (
                        <span title="Pareto-efficient" style={{
                          position: "absolute", top: 4, right: 4, width: 6, height: 6,
                          borderRadius: "50%", background: C.ink, opacity: 0.45,
                        }} />
                      )}
                      <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center", fontFamily: fontMono }}>
                        <input type="number" value={matrix.cells[r][c].a}
                          onChange={e => setCell(r, c, "a", e.target.value)}
                          style={{ ...cellInput, color: C.decision, textDecoration: sol.bestA[r][c] ? "underline" : "none" }} />
                        <span style={{ color: C.inkSoft }}>/</span>
                        <input type="number" value={matrix.cells[r][c].b}
                          onChange={e => setCell(r, c, "b", e.target.value)}
                          style={{ ...cellInput, color: C.chance, textDecoration: sol.bestB[r][c] ? "underline" : "none" }} />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
        <SectionTitle>Result</SectionTitle>
        {sol.pure.length > 0 ? (
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
            {sol.pure.map(([r, c], i) => {
              const eff = sol.pareto[r][c];
              const dom = eff ? null : sol.betterThan(r, c);
              return (
                <li key={i}>
                  Pure Nash equilibrium: <strong>{matrix.rows[r]}</strong> vs <strong>{matrix.cols[c]}</strong>
                  <span style={{ fontFamily: fontMono, color: C.inkSoft }}> ({fmt(num(matrix.cells[r][c].a))} / {fmt(num(matrix.cells[r][c].b))})</span>
                  {eff ? (
                    <span style={{ color: C.best }}> — Pareto-efficient</span>
                  ) : dom && (
                    <span style={{ color: C.warn }}> — not Pareto-efficient: <strong>{matrix.rows[dom.r]}</strong> vs <strong>{matrix.cols[dom.c]}</strong> {dom.both ? "makes both players better off" : "makes one player better off without hurting the other"}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p style={{ margin: "6px 0 0", fontSize: 13.5 }}>No pure-strategy Nash equilibrium.</p>
        )}
        {sol.mixed && (
          <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.6 }}>
            Mixed equilibrium: you play <strong>{matrix.rows[0]}</strong> {pct(sol.mixed.p)} / <strong>{matrix.rows[1]}</strong> {pct(1 - sol.mixed.p)}; they play <strong>{matrix.cols[0]}</strong> {pct(sol.mixed.q)} / <strong>{matrix.cols[1]}</strong> {pct(1 - sol.mixed.q)}.
          </p>
        )}
        {!sol.mixed && sol.pure.length === 0 && (R > 2 || Cn > 2) && (
          <p style={{ margin: "8px 0 0", fontSize: 12.5, color: C.inkSoft }}>
            Mixed-strategy solving is available for 2×2 games.
          </p>
        )}
      </div>
      <NashWorkings matrix={matrix} sol={sol} />
    </div>
  );
}

function NashWorkings({ matrix, sol }) {
  const R = matrix.rows.length, Cn = matrix.cols.length;
  const a = (r, c) => num(matrix.cells[r][c].a), b = (r, c) => num(matrix.cells[r][c].b);
  return (
    <Workings>
      <p style={{ ...wHead, marginTop: 0 }}>1 · Best responses</p>
      <p style={wLine}>Hold the other side's strategy fixed and pick the payoff you like best (ties all count). These are the underlines in the matrix.</p>
      {matrix.cols.map((cn, c) => (
        <p key={"c" + c} style={wLine}>
          If they play <strong>{cn}</strong>, you get <span style={wMono}>{matrix.rows.map((rn, r) => `${rn} ${fmt(a(r, c))}`).join(", ")}</span> → you'd pick <strong>{matrix.rows.filter((_, r) => sol.bestA[r][c]).join(" / ")}</strong>.
        </p>
      ))}
      {matrix.rows.map((rn, r) => (
        <p key={"r" + r} style={wLine}>
          If you play <strong>{rn}</strong>, they get <span style={wMono}>{matrix.cols.map((cn, c) => `${cn} ${fmt(b(r, c))}`).join(", ")}</span> → they'd pick <strong>{matrix.cols.filter((_, c) => sol.bestB[r][c]).join(" / ")}</strong>.
        </p>
      ))}
      <p style={wHead}>2 · Pure equilibria</p>
      <p style={wLine}>
        {sol.pure.length > 0 ? (
          <>A cell where both answers point at each other is an equilibrium — neither player gains by
          switching alone. Here: <strong>{sol.pure.map(([r, c]) => `${matrix.rows[r]} vs ${matrix.cols[c]}`).join("; ")}</strong>.</>
        ) : (
          <>No cell is a best response for both players at once, so this game has no pure-strategy equilibrium.</>
        )}
      </p>
      <p style={wHead}>3 · Pareto check</p>
      <p style={wLine}>A cell is Pareto-efficient (corner dot) unless some other cell pays both players at least as much and one of them strictly more:</p>
      {matrix.rows.map((rn, r) => matrix.cols.map((cn, c) => {
        const d = sol.pareto[r][c] ? null : sol.betterThan(r, c);
        return (
          <p key={r + "." + c} style={wLine}>
            <span style={wMono}>{rn} vs {cn} ({fmt(a(r, c))}/{fmt(b(r, c))})</span> — {sol.pareto[r][c]
              ? "efficient"
              : d && <>dominated by <strong>{matrix.rows[d.r]} vs {matrix.cols[d.c]}</strong> <span style={wMono}>({fmt(a(d.r, d.c))}/{fmt(b(d.r, d.c))})</span></>}
          </p>
        );
      }))}
      <p style={wHead}>4 · Mixed strategy</p>
      {R === 2 && Cn === 2 ? (
        sol.mixed ? (
          <>
            <p style={wLine}>Each player mixes so the <em>other</em> can't gain by leaning either way. p = P(you play <strong>{matrix.rows[0]}</strong>) makes them indifferent between their two strategies:</p>
            <p style={{ ...wLine, ...wMono, overflowX: "auto", whiteSpace: "nowrap" }}>
              p·({fmt(b(0, 0))}) + (1−p)·({fmt(b(1, 0))}) = p·({fmt(b(0, 1))}) + (1−p)·({fmt(b(1, 1))}) → p = {fmt(sol.mixed.p)}
            </p>
            <p style={wLine}>q = P(they play <strong>{matrix.cols[0]}</strong>) makes you indifferent:</p>
            <p style={{ ...wLine, ...wMono, overflowX: "auto", whiteSpace: "nowrap" }}>
              q·({fmt(a(0, 0))}) + (1−q)·({fmt(a(0, 1))}) = q·({fmt(a(1, 0))}) + (1−q)·({fmt(a(1, 1))}) → q = {fmt(sol.mixed.q)}
            </p>
          </>
        ) : (
          <p style={wLine}>Solving the indifference equations here doesn't give p and q strictly between 0 and 1, so there's no mixed equilibrium beyond the pure analysis above — typical when a player has a dominant strategy.</p>
        )
      ) : (
        <p style={wLine}>Mixed-strategy workings are shown for 2×2 games only.</p>
      )}
    </Workings>
  );
}

const thStyle = { border: "none", padding: 4 };
const stratInput = (color) => ({
  width: 96, fontSize: 12.5, fontWeight: 600, color, textAlign: "center",
  border: `1px dashed ${C.line}`, borderRadius: 6, padding: "4px 2px", background: "transparent",
});
const cellInput = {
  width: 44, fontFamily: fontMono, fontSize: 13, textAlign: "center",
  border: "none", background: "transparent", padding: 2,
};

function Stepper({ label, onDown, onUp }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${C.line}`, borderRadius: 8, padding: "4px 6px", background: C.card }}>
      <button onClick={onDown} style={{ ...miniBtn(C.ink), border: "none", padding: "2px 8px", fontSize: 15 }}>−</button>
      <span style={{ fontFamily: fontMono, fontSize: 12 }}>{label}</span>
      <button onClick={onUp} style={{ ...miniBtn(C.ink), border: "none", padding: "2px 8px", fontSize: 15 }}>+</button>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkSoft }}>{children}</h2>;
}
