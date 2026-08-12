import { createRoot } from "react-dom/client";
import GameTheoryLab from "./app.jsx";

/* window.storage shim: use the platform's storage if present; otherwise
   persist to localStorage, falling back to in-memory if that's blocked. */
if (!window.storage) {
  const mem = new Map();
  let ls = null;
  try {
    const t = "__gt_probe__";
    window.localStorage.setItem(t, "1");
    window.localStorage.removeItem(t);
    ls = window.localStorage;
  } catch (e) { /* storage unavailable — stay in memory */ }
  window.storage = {
    async get(key) {
      if (ls) { const v = ls.getItem(key); return v == null ? null : { key, value: v }; }
      return mem.has(key) ? { key, value: mem.get(key) } : null;
    },
    async set(key, value) {
      if (ls) { ls.setItem(key, String(value)); return { key, value: String(value) }; }
      mem.set(key, String(value));
      return { key, value: String(value) };
    },
    async delete(key) { if (ls) ls.removeItem(key); mem.delete(key); return { key, deleted: true }; },
  };
}

createRoot(document.getElementById("root")).render(<GameTheoryLab />);
