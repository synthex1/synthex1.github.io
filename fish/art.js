/* Fathom — procedural fish illustrations. Every fish is drawn from a small
   spec (shape archetype, colours, pattern) so no image files are needed. */
window.FishArt = (function () {
  let uid = 0;
  const CY = 60;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const r1 = n => Math.round(n * 10) / 10;
  const P = p => r1(p.x) + ',' + r1(p.y);
  function bz(c, t) {
    const u = 1 - t;
    return {
      x: u * u * u * c[0].x + 3 * u * u * t * c[1].x + 3 * u * t * t * c[2].x + t * t * t * c[3].x,
      y: u * u * u * c[0].y + 3 * u * u * t * c[1].y + 3 * u * t * t * c[2].y + t * t * t * c[3].y
    };
  }

  const SHAPES = {
    classic:  { nx: 28, px: 176, h: 25, b: 24, ph: 6,   tail: 'fork',   th: 22, dorsal: 'two',   eye: 4.2 },
    deep:     { nx: 46, px: 180, h: 38, b: 36, ph: 6,   tail: 'fan',    th: 20, dorsal: 'long',  eye: 4.6 },
    torpedo:  { nx: 20, px: 186, h: 19, b: 18, ph: 3.5, tail: 'fork',   th: 22, dorsal: 'one',   eye: 3.8 },
    tuna:     { nx: 20, px: 192, h: 23, b: 22, ph: 2.5, tail: 'lunate', th: 30, dorsal: 'tuna',  eye: 4.2 },
    long:     { nx: 12, px: 192, h: 11, b: 11, ph: 4.5, tail: 'fork',   th: 16, dorsal: 'back',  eye: 3.4 },
    shark:    { nx: 12, px: 188, h: 18, b: 14, ph: 3.5, tail: 'shark',  th: 30, dorsal: 'shark', eye: 2.6, nose: -3, noGill: true, slits: true },
    bill:     { nx: 46, px: 194, h: 19, b: 16, ph: 2.5, tail: 'lunate', th: 30, dorsal: 'marlin', eye: 3.8, bill: 38 },
    catfish:  { nx: 24, px: 180, h: 20, b: 20, ph: 6,   tail: 'fan',    th: 18, dorsal: 'cat',   eye: 3, barbels: 3 },
    sturgeon: { nx: 24, px: 190, h: 12, b: 11, ph: 3.5, tail: 'shark',  th: 24, dorsal: 'back',  eye: 2.8, barbels: 2, scutes: true, nose: 4 }
  };

  function fin(A, B, h, lean, dir) {
    const px = A.x + (B.x - A.x) * lean;
    const py = (dir < 0 ? Math.min(A.y, B.y) : Math.max(A.y, B.y)) + dir * h;
    return 'M' + P(A) + ' Q' + r1(A.x + (px - A.x) * 0.35) + ',' + r1(py) + ' ' + r1(px) + ',' + r1(py) +
      ' Q' + r1(px + (B.x - px) * 0.3) + ',' + r1(py + (B.y - py) * 0.8) + ' ' + P(B) + ' Z';
  }

  function tailPath(type, sx, tx, ph, th) {
    const m = tx - sx;
    switch (type) {
      case 'fan':
        return `M${sx},${CY - ph} L${tx - 6},${CY - th} Q${tx + 5},${CY} ${tx - 6},${CY + th} L${sx},${CY + ph} Z`;
      case 'lunate':
        return `M${sx},${CY - ph} Q${sx + 14},${CY - ph - 6} ${tx},${CY - th} Q${r1(sx + m * 0.42)},${CY} ${tx},${CY + th} Q${sx + 14},${CY + ph + 6} ${sx},${CY + ph} Z`;
      case 'shark':
        return `M${sx},${CY - ph} L${tx},${CY - th - 4} Q${tx - 14},${CY - 6} ${tx - 20},${CY + 2} L${tx - 9},${CY + th * 0.55} Q${tx - 26},${CY + 8} ${sx},${CY + ph} Z`;
      case 'lobed':
        return `M${sx},${CY - ph} Q${sx + m * 0.5},${CY - th} ${tx - 12},${CY - th * 0.6} L${tx - 10},${CY - 4} L${tx + 2},${CY} L${tx - 10},${CY + 4} L${tx - 12},${CY + th * 0.6} Q${sx + m * 0.5},${CY + th} ${sx},${CY + ph} Z`;
      default: // fork
        return `M${sx},${CY - ph} Q${r1(sx + m * 0.5)},${CY - ph - 3} ${tx},${CY - th} L${r1(tx - m * 0.42)},${CY} L${tx},${CY + th} Q${r1(sx + m * 0.5)},${CY + ph + 3} ${sx},${CY + ph} Z`;
    }
  }

  function pattern(a, S, rand, box) {
    const { nx, px, h, b } = S, w = px - nx, pc = a.pc || '#000';
    let o = '';
    const n = S.n;
    switch (a.p) {
      case 'bars':
      case 'backbars':
      case 'fullbars': {
        const k = n || 6, full = a.p === 'fullbars', back = a.p === 'backbars';
        for (let i = 0; i < k; i++) {
          const x = nx + w * (0.24 + 0.66 * i / (k - 1));
          const ry = full ? h + b : back ? h * 0.6 : h * 0.95;
          const cy = full ? CY : back ? CY - h * 0.7 : CY - h * 0.25;
          o += `<ellipse cx="${r1(x)}" cy="${r1(cy)}" rx="${r1(w * 0.02 + 1.3)}" ry="${r1(ry)}" fill="${pc}" opacity="${full ? 0.85 : 0.6}" transform="rotate(${back ? 14 : 0} ${r1(x)} ${r1(cy)})"/>`;
        }
        break;
      }
      case 'bands':
        [0.2, 0.5, 0.86].forEach((f, i) => {
          const x = nx + w * f, ww = i === 1 ? 13 : 9;
          o += `<rect x="${r1(x - ww / 2)}" y="0" width="${ww}" height="120" fill="${pc}" stroke="#1a1a1a" stroke-width="1.6"/>`;
        });
        break;
      case 'spots':
      case 'rearspots':
      case 'bellyspots': {
        const k = n || 34, rear = a.p === 'rearspots', belly = a.p === 'bellyspots';
        for (let i = 0; i < k; i++) {
          const x = nx + w * ((rear ? 0.5 : 0.16) + rand() * (rear ? 0.5 : 0.84));
          const y = belly ? CY + 4 + rand() * b : CY - h + rand() * (h + b * (rear ? 1 : 0.45));
          const r = belly ? 3 + rand() * 2.5 : 0.9 + rand() * 1.5;
          o += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${pc}" opacity=".9"/>`;
        }
        break;
      }
      case 'bigspots':
        for (let i = 0; i < (n || 22); i++) {
          const x = nx + w * (0.2 + rand() * 0.8), y = CY - h * 0.8 + rand() * (h + b) * 0.8;
          o += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(2.2 + rand() * 1.8)}" ry="${r1(1.4 + rand() * 1.2)}" fill="${pc}" opacity=".85"/>`;
        }
        break;
      case 'mottle':
        for (let i = 0; i < (n || 18); i++) {
          const x = box.x0 + rand() * (box.x1 - box.x0), y = box.y0 + rand() * (box.y1 - box.y0) * 0.75;
          o += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(4 + rand() * 7)}" ry="${r1(2 + rand() * 3.5)}" fill="${pc}" opacity=".45" transform="rotate(${r1(rand() * 40 - 20)} ${r1(x)} ${r1(y)})"/>`;
        }
        break;
      case 'hstripes':
      case 'bellystripes': {
        const k = n || 5, belly = a.p === 'bellystripes';
        for (let i = 0; i < k; i++) {
          const y = belly ? CY + 3 + i * (b * 0.2) : CY - h * 0.62 + i * ((h + b) * 0.9 / k);
          o += `<path d="M${r1(nx + w * 0.2)},${r1(y)} Q${r1(nx + w * 0.6)},${r1(y + (belly ? 4 : 0))} ${px},${r1(CY + (y - CY) * 0.25)}" fill="none" stroke="${pc}" stroke-width="${belly ? 1.5 : 1.6}" opacity=".85"/>`;
        }
        break;
      }
      case 'stripe':
        o += `<path d="M${r1(nx + w * 0.1)},${CY} L${px + 4},${CY}" stroke="${pc}" stroke-width="4.5" opacity=".8" stroke-dasharray="${a.s === 'classic' && !S.nose ? '9 3' : 'none'}"/>`;
        break;
      case 'palette':
        o += `<path d="M${r1(nx + w * 0.2)},${r1(CY - h * 0.45)} Q${r1(nx + w * 0.55)},${r1(CY - h * 1.0)} ${px},${CY - 3} L${px},${CY + 2} Q${r1(nx + w * 0.7)},${r1(CY - h * 0.1)} ${r1(nx + w * 0.42)},${r1(CY + 2)} Q${r1(nx + w * 0.3)},${r1(CY - h * 0.2)} ${r1(nx + w * 0.2)},${r1(CY - h * 0.45)} Z" fill="${pc}"/>` +
          `<ellipse cx="${r1(nx + w * 0.5)}" cy="${r1(CY - h * 0.28)}" rx="${r1(w * 0.1)}" ry="${r1(h * 0.14)}" fill="${a.c}"/>`;
        break;
    }
    if (S.stripe) o += `<path d="M${r1(nx + w * 0.14)},${CY + 1} L${px + 4},${CY}" stroke="${S.stripe}" stroke-width="6" opacity=".75"/>`;
    return o;
  }

  function shell(id, defs, back, bodyD, a, inner, front, box) {
    const stroke = 'rgba(8,20,30,.45)';
    return `<defs><clipPath id="c${id}"><path d="${bodyD}"/></clipPath>` +
      `<linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset=".42" stop-color="${a.b || a.c}" stop-opacity="0"/><stop offset=".86" stop-color="${a.b || a.c}"/></linearGradient>` +
      `<linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset=".4" stop-color="#000" stop-opacity="0"/></linearGradient>${defs || ''}</defs>` +
      `<g stroke="${stroke}" stroke-width="1" stroke-linejoin="round">${back}</g>` +
      `<g clip-path="url(#c${id})"><rect width="240" height="120" fill="${a.c}"/>${inner}` +
      `<rect x="0" y="${r1(box.y0)}" width="240" height="${r1(box.y1 - box.y0)}" fill="url(#g${id})"/>` +
      `<rect x="0" y="${r1(box.y0)}" width="240" height="${r1(box.y1 - box.y0)}" fill="url(#s${id})"/></g>` +
      `<path d="${bodyD}" fill="none" stroke="${stroke}" stroke-width="1.2"/>${front}`;
  }

  function eyeSvg(x, y, r, col) {
    return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${col || '#f6f1dc'}" stroke="rgba(8,20,30,.5)" stroke-width=".8"/>` +
      `<circle cx="${r1(x - r * 0.12)}" cy="${r1(y)}" r="${r1(r * 0.55)}" fill="#0b1118"/>` +
      `<circle cx="${r1(x - r * 0.35)}" cy="${r1(y - r * 0.3)}" r="${r1(r * 0.2)}" fill="#fff" opacity=".9"/>`;
  }

  /* ---------- generic side-on fish ---------- */
  function profile(a, id, rand) {
    const S = Object.assign({}, SHAPES[a.s] || SHAPES.classic, a.x || {});
    const { nx, px, h, b, ph } = S, w = px - nx, tx = 230;
    const nose = { x: nx, y: CY + (S.nose || 0) };
    const k1 = S.blunt ? 0.015 : 0.1, hk = S.hump ? 1.5 : 1.32;
    const top = [nose, { x: nx + w * k1, y: CY - h * hk }, { x: nx + w * 0.62, y: CY - h * 1.3 }, { x: px, y: CY - ph }];
    const bot = [nose, { x: nx + w * k1, y: CY + b * 1.32 }, { x: nx + w * 0.62, y: CY + b * 1.3 }, { x: px, y: CY + ph }];
    const bodyD = `M${P(nose)} C${P(top[1])} ${P(top[2])} ${P(top[3])} L${P(bot[3])} C${P(bot[2])} ${P(bot[1])} ${P(nose)} Z`;
    const T = t => bz(top, t), B = t => bz(bot, t);
    const fc = a.f || a.c, tailC = S.tailC || fc;
    let back = '', front = '';

    // snouts and bills sit behind the head
    if (S.bill) back += `<path d="M${nx + 8},${CY - 4} L${nx - S.bill},${CY - 1} L${nx + 8},${CY + 3} Z" fill="${a.c}"/>`;
    if (S.snout === 'gar') back += `<path d="M${nx + 6},${CY - 5} L${nx - 26},${CY - 2.5} Q${nx - 30},${CY} ${nx - 26},${CY + 2.5} L${nx + 6},${CY + 5} Z" fill="${a.c}"/>`;
    if (S.snout === 'paddle') back += `<path d="M${nx + 6},${CY - 3} L${nx - 34},${CY - 5} Q${nx - 50},${CY - 1} ${nx - 34},${CY + 3} L${nx + 6},${CY + 6} Z" fill="${a.c}"/>`;
    if (S.snout === 'blade') back += `<path d="M${nx + 10},${CY - 9} L${nx - 30},${CY - 9} Q${nx - 34},${CY - 7} ${nx - 28},${CY - 5} L${nx + 6},${CY} Z" fill="${a.c}"/>`;

    back += `<path d="${tailPath(S.tail, px - 5, tx, ph, S.th)}" fill="${tailC}"/>`;

    const F = (curve, t0, t1, hh, lean, dir, col) =>
      `<path d="${fin(curve(t0), curve(t1), hh, lean, dir)}" fill="${col || fc}"/>`;
    switch (S.dorsal) {
      case 'one': back += F(T, 0.4, 0.6, 13, 0.3, -1); break;
      case 'two': back += F(T, 0.3, 0.52, 13, 0.35, -1) + F(T, 0.55, 0.74, 11, 0.3, -1); break;
      case 'twofar': back += F(T, 0.36, 0.46, 9, 0.3, -1) + F(T, 0.7, 0.8, 9, 0.3, -1); break;
      case 'three': back += F(T, 0.26, 0.42, 11, 0.35, -1) + F(T, 0.45, 0.63, 11, 0.35, -1) + F(T, 0.67, 0.84, 9, 0.35, -1); break;
      case 'long': back += F(T, 0.26, 0.86, 12, 0.5, -1); break;
      case 'ridge': back += F(T, 0.34, 0.95, 8, 0.6, -1); break;
      case 'crest': back += F(T, 0.06, 0.94, 12, 0.25, -1); break;
      case 'back': back += F(T, 0.72, 0.9, 12, 0.35, -1); break;
      case 'whip': back += F(T, 0.2, 0.3, 8, 0.3, -1) + `<path d="M${P(T(0.22))} Q${P({ x: T(0.3).x, y: CY - h - 26 })} ${P({ x: T(0.5).x, y: CY - h - 18 })}" fill="none" stroke="${fc}" stroke-width="1.2"/>`; break;
      case 'tiny': back += F(T, 0.26, 0.31, 7, 0.4, -1); break;
      case 'cat': back += F(T, 0.3, 0.44, 13, 0.3, -1) + F(T, 0.74, 0.84, 5, 0.6, -1); break;
      case 'shark': back += F(T, 0.36, 0.52, 22, 0.85, -1) + F(T, 0.8, 0.86, 5, 0.8, -1); break;
      case 'sharksmall': back += F(T, 0.46, 0.56, 9, 0.8, -1) + F(T, 0.76, 0.84, 7, 0.8, -1); break;
      case 'sharkback': back += F(T, 0.58, 0.68, 10, 0.8, -1) + F(T, 0.8, 0.88, 8, 0.8, -1); break;
      case 'tuna': back += F(T, 0.3, 0.44, 12, 0.25, -1) + F(T, 0.52, 0.6, S.longfins ? 24 : 14, 1.3, -1); break;
      case 'marlin': back += F(T, 0.1, 0.34, 20, 0.2, -1) + F(T, 0.34, 0.8, 4, 0.5, -1); break;
      case 'sail': back += `<path d="M${P(T(0.08))} C${P({ x: T(0.1).x, y: 4 })} ${P({ x: T(0.6).x, y: -2 })} ${P({ x: T(0.76).x + 6, y: 20 })} L${P(T(0.76))} Z" fill="${fc}"/>`; break;
      case 'sailsmall': back += `<path d="M${P(T(0.32))} C${P({ x: T(0.34).x, y: CY - h - 22 })} ${P({ x: T(0.6).x, y: CY - h - 24 })} ${P({ x: T(0.66).x + 5, y: CY - h - 10 })} L${P(T(0.64))} Z" fill="${fc}"/>`; break;
    }
    if (S.adipose) back += F(T, 0.8, 0.86, 4.5, 0.7, -1);
    if (S.lobed) back += F(T, 0.3, 0.44, 12, 0.4, -1) + F(T, 0.62, 0.76, 11, 0.5, -1) + F(B, 0.62, 0.76, 11, 0.5, 1);

    // underside fins
    if (a.s === 'shark') {
      back += F(B, 0.56, 0.64, 8, 0.8, 1) + F(B, 0.78, 0.84, 6, 0.8, 1);
    } else if (S.dorsal === 'tuna') {
      back += F(B, 0.56, 0.64, S.longfins ? 22 : 12, 1.3, 1);
    } else if (S.anal === 'long' || S.dorsal === 'ridge') {
      back += F(B, 0.36, 0.42, 8, 0.5, 1) + F(B, 0.5, 0.95, 8, 0.6, 1);
    } else if (S.dorsal === 'crest') {
      back += F(B, 0.3, 0.38, 14, 0.9, 1) + F(B, 0.5, 0.92, 7, 0.4, 1);
    } else if (S.dorsal === 'back' || S.dorsal === 'whip') {
      back += F(B, 0.42, 0.5, 8, 0.6, 1) + F(B, 0.72, 0.9, 11, 0.35, 1);
    } else {
      back += F(B, 0.36, 0.46, 10, 0.7, 1) + F(B, 0.6, 0.78, a.s === 'deep' ? 12 : 9, 0.4, 1);
    }
    if (S.finlets) {
      for (let i = 0; i < 6; i++) {
        const t = 0.66 + i * 0.05, p = T(t), q = B(t);
        back += `<path d="M${P(p)} l5,-4.5 l2,5 Z" fill="${S.finlets}" stroke="none"/><path d="M${P(q)} l5,4.5 l2,-5 Z" fill="${S.finlets}" stroke="none"/>`;
      }
    }
    if (S.spines) {
      for (let i = 0; i < 11; i++) {
        const p = T(0.22 + i * 0.055);
        back += `<path d="M${P(p)} L${r1(p.x + 2 + i * 0.8)},${r1(p.y - 26 + Math.abs(i - 4) * 1.6)}" stroke="${fc}" stroke-width="2.2" stroke-linecap="round"/>`;
      }
      for (let i = 0; i < 7; i++) {
        const ang = 0.5 + i * 0.26, ox = nx + w * 0.3, oy = CY + b * 0.2;
        back += `<path d="M${r1(ox)},${r1(oy)} L${r1(ox + Math.cos(ang) * 44)},${r1(oy + Math.sin(ang) * 44)}" stroke="${fc}" stroke-width="2.4" stroke-linecap="round"/>`;
      }
    }

    const box = { x0: nx, x1: px, y0: CY - h * 1.05, y1: CY + b * 1.05 };
    let inner = pattern(a, S, rand, box);
    if (S.mask) inner += `<path d="M${nx},${CY - h} L${nx + w * 0.26},${CY - h} Q${nx + w * 0.2},${CY} ${nx + w * 0.26},${CY + b} L${nx},${CY + b} Z" fill="${S.mask}" opacity=".85"/>`;
    if (S.scutes) for (let i = 0; i < 12; i++) inner += `<path d="M${r1(nx + w * (0.2 + i * 0.065))},${CY - 1} l4,-3 l4,3 l-4,3 Z" fill="rgba(255,255,255,.35)"/>`;
    if (S.photophores) for (let i = 0; i < 16; i++) inner += `<circle cx="${r1(nx + w * (0.16 + i * 0.05))}" cy="${r1(B(0.16 + i * 0.05).y - 3)}" r="1.1" fill="#8fe6ff"/>`;

    // head details
    const ex = nx + w * 0.085 + S.eye, ey = CY + (S.nose || 0) * 0.6 - h * 0.24;
    if (!S.noGill) front += `<path d="M${r1(nx + w * 0.21)},${r1(CY - h * 0.55)} Q${r1(nx + w * 0.25)},${CY} ${r1(nx + w * 0.2)},${r1(CY + b * 0.6)}" fill="none" stroke="rgba(8,20,30,.3)" stroke-width="1.2"/>`;
    if (S.slits) for (let i = 0; i < 5; i++) front += `<path d="M${r1(nx + w * (0.2 + i * 0.018))},${CY - 5} l-1,9" stroke="rgba(8,20,30,.4)" stroke-width="1"/>`;
    if (S.wing) front += `<path d="M${r1(nx + w * 0.24)},${CY} C${r1(nx + w * 0.4)},${CY - 40} ${r1(nx + w * 0.7)},${CY - 44} ${r1(nx + w * 0.78)},${CY - 36} Q${r1(nx + w * 0.5)},${CY - 10} ${r1(nx + w * 0.24)},${CY} Z" fill="${fc}" stroke="rgba(8,20,30,.45)" stroke-width="1" opacity=".92"/>`;
    else if (a.s === 'shark') front += `<path d="M${r1(nx + w * 0.3)},${r1(CY + b * 0.5)} L${r1(nx + w * 0.42)},${r1(CY + b + 16)} Q${r1(nx + w * 0.42)},${r1(CY + b * 0.9)} ${r1(nx + w * 0.44)},${r1(CY + b * 0.6)} Z" fill="${fc}" stroke="rgba(8,20,30,.45)" stroke-width="1"/>`;
    else front += `<path d="M${r1(nx + w * 0.27)},${r1(CY + b * 0.18)} q${r1(w * 0.09)},1 ${r1(w * 0.12)},${r1(b * 0.42)} q${r1(-w * 0.09)},-1 ${r1(-w * 0.12)},${r1(-b * 0.42)} Z" fill="${fc}" stroke="rgba(8,20,30,.4)" stroke-width="1" opacity=".9"/>`;
    if (S.tips) {
      const d = T(0.47);
      front += `<path d="M${r1(d.x + 6)},${r1(d.y - 21)} l6,7 l-10,-1 Z" fill="${S.tips}"/><path d="M${tx},${CY - S.th - 4} l-10,12 l8,-4 Z" fill="${S.tips}"/>`;
    }
    front += eyeSvg(ex, ey, S.eye, S.eyeC);
    const my = CY + (S.nose || 0) + 3;
    front += `<path d="M${nx + 1},${my} Q${nx + 6},${my + 2.5} ${r1(nx + 5 + h * 0.3)},${my + 1}" fill="none" stroke="rgba(8,20,30,.55)" stroke-width="1.2" stroke-linecap="round"/>`;
    if (S.lips) front += `<ellipse cx="${nx + 4}" cy="${my}" rx="5" ry="4" fill="${S.lips}"/>`;
    if (S.teeth || S.fangs) {
      const len = S.fangs ? 9 : 3.5;
      for (let i = 0; i < 5; i++) {
        front += `<path d="M${r1(nx + 2 + i * 3)},${my + 1} l1.2,${-len} l1.2,${len} Z" fill="#fff" stroke="rgba(8,20,30,.4)" stroke-width=".4"/>`;
        if (S.fangs && i < 4) front += `<path d="M${r1(nx + 3.5 + i * 3)},${my - 1} l1.2,${len * 0.7} l1.2,${-len * 0.7} Z" fill="#fff" stroke="rgba(8,20,30,.4)" stroke-width=".4"/>`;
      }
    }
    for (let i = 0; i < (S.barbels || 0); i++) {
      front += `<path d="M${nx + 3 + i * 3},${my + 2} q${-10 - i * 3},${6 + i * 3} ${-16 + i * 6},${14 + i * 2}" fill="none" stroke="${a.c}" stroke-width="1.6" stroke-linecap="round"/>`;
      if (a.s === 'catfish') front += `<path d="M${nx + 3},${my - 4} q${-14},${-8 - i * 5} ${-18 + i * 4},${-16 - i * 2}" fill="none" stroke="${a.c}" stroke-width="1.4" stroke-linecap="round"/>`;
    }
    (S.marks || []).forEach(m => {
      const x = nx + w * m[0], y = CY + m[1];
      if (m[4]) front += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${m[2] + 1.6}" fill="${m[4]}"/>`;
      front += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${m[2]}" fill="${m[3]}"/>`;
    });
    return shell(id, '', back, bodyD, a, inner, front, box);
  }

  /* ---------- eels, ribbons and rattails ---------- */
  function eel(a, id, rand) {
    const S = Object.assign({ A: 13, W: 9, freq: 1.25 }, a.x || {});
    const N = 60, top = [], bot = [], crest = [], under = [];
    let head = null;
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = 16 + 208 * u;
      const y = CY + S.A * Math.sin(Math.PI * 2 * S.freq * u + 0.6) * (0.25 + 0.75 * u);
      let wd;
      if (S.gulper) wd = S.W * (0.3 + 2.6 * Math.exp(-Math.pow((u - 0.1) / 0.075, 2))) * (1 - 0.75 * u);
      else if (S.rattail) wd = S.W * (u < 0.14 ? 0.55 + 0.45 * Math.sin(Math.PI * u / 0.28) : Math.pow(1 - (u - 0.14) / 0.86, 1.25) + 0.03);
      else wd = S.W * (1 - 0.78 * Math.pow(u, 1.7)) * (u < 0.05 ? 0.55 + 9 * u : 1);
      top.push({ x, y: y - wd }); bot.push({ x, y: y + wd });
      const fh = S.crest ? 7 : S.rattail ? 3 : 4;
      if (u >= (S.crest ? 0.02 : 0.2)) crest.push({ x, y: y - wd - fh * (S.crest ? 1 : Math.min(1, (u - 0.2) * 6)) });
      if (u >= 0.3) under.push({ x, y: y + wd + (S.under ? 6 : 3.5) * Math.min(1, (u - 0.3) * 6) });
      if (i === 3) head = { x, y, wd };
    }
    const line = pts => pts.map(P).join(' L');
    const bodyD = `M${r1(top[0].x - 4)},${r1((top[0].y + bot[0].y) / 2)} L${line(top)} L${line(bot.slice().reverse())} Z`;
    const iTop = S.crest ? 1 : Math.round(N * 0.2), iBot = Math.round(N * 0.3);
    let back = `<path d="M${P(top[iTop])} L${line(crest)} L${P(top[N])} Z" fill="${a.f}"/>` +
      `<path d="M${P(bot[iBot])} L${line(under)} L${P(bot[N])} Z" fill="${a.f}"/>`;
    if (S.crest) for (let i = 0; i < 6; i++) back += `<path d="M${r1(top[1].x + i * 2.5)},${r1(top[1].y)} q${r1(4 + i * 3)},${-22 + i * 2} ${r1(14 + i * 5)},${-26 + i * 3}" fill="none" stroke="${a.f}" stroke-width="1.4"/>`;
    const SS = { nx: 16, px: 224, h: S.W, b: S.W, n: S.crest ? 7 : 40 };
    const box = { x0: 16, x1: 224, y0: CY - S.A - S.W * (S.gulper ? 3 : 1), y1: CY + S.A + S.W * (S.gulper ? 3 : 1) };
    let inner = '';
    if (a.p === 'spots') for (let i = 0; i < 70; i++) inner += `<circle cx="${r1(16 + rand() * 208)}" cy="${r1(box.y0 + rand() * (box.y1 - box.y0))}" r="${r1(0.8 + rand() * 1.4)}" fill="${a.pc}" opacity=".8"/>`;
    else if (a.p) inner = pattern(a, Object.assign(SS, { h: S.A + S.W, b: S.A + S.W }), rand, box);
    let front = eyeSvg(head.x + (S.rattail ? 6 : 1), head.y - head.wd * (S.gulper ? 0.2 : 0.35), S.rattail ? 4.6 : S.gulper ? 1.6 : 2.4);
    if (S.gulper) front += `<path d="M${r1(top[0].x - 3)},${r1(head.y + 1)} Q${r1(head.x + 16)},${r1(head.y + 3)} ${r1(head.x + 26)},${r1(head.y + 9)}" fill="none" stroke="#5a5566" stroke-width="1.3"/><circle cx="224" cy="${r1(top[N].y)}" r="2.6" fill="#ff8fb0"/>`;
    else front += `<path d="M${r1(top[0].x - 3)},${r1(head.y + head.wd * 0.3)} l${S.rattail ? 12 : 9},1.5" stroke="rgba(8,20,30,.5)" stroke-width="1.1" stroke-linecap="round"/>`;
    return shell(id, '', back, bodyD, a, inner, front, box);
  }

  /* ---------- flatfish, seen from above ---------- */
  function flat(a, id, rand) {
    const S = Object.assign({ rx: 68, ry: 28 }, a.x || {}), cx = 104;
    const bodyD = `M${cx - S.rx},${CY} C${cx - S.rx * 0.7},${CY - S.ry * 1.35} ${cx + S.rx * 0.5},${CY - S.ry * 1.3} ${cx + S.rx},${CY - 5} L${cx + S.rx},${CY + 5} C${cx + S.rx * 0.5},${CY + S.ry * 1.3} ${cx - S.rx * 0.7},${CY + S.ry * 1.35} ${cx - S.rx},${CY} Z`;
    let back = `<path d="M${cx - S.rx * 0.75},${CY} C${cx - S.rx * 0.5},${CY - S.ry * 2.1} ${cx + S.rx * 0.6},${CY - S.ry * 1.9} ${cx + S.rx},${CY} C${cx + S.rx * 0.6},${CY + S.ry * 1.9} ${cx - S.rx * 0.5},${CY + S.ry * 2.1} ${cx - S.rx * 0.75},${CY} Z" fill="${a.f}"/>` +
      `<path d="${tailPath('fan', cx + S.rx - 4, 228, 5, 17)}" fill="${a.f}"/>`;
    const box = { x0: cx - S.rx, x1: cx + S.rx, y0: CY - S.ry, y1: CY + S.ry };
    let inner = '';
    for (let i = 0; i < (a.p === 'spots' ? 16 : 22); i++) {
      const x = box.x0 + 14 + rand() * (S.rx * 2 - 20), y = box.y0 + 4 + rand() * (S.ry * 2 - 8);
      inner += a.p === 'spots'
        ? `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(2 + rand() * 1.6)}" fill="${a.pc}"/>`
        : `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(3 + rand() * 6)}" ry="${r1(2 + rand() * 3)}" fill="${a.pc}" opacity=".5"/>`;
    }
    inner += `<path d="M${cx - S.rx * 0.5},${CY - 2} Q${cx},${CY - 9} ${cx + S.rx},${CY}" fill="none" stroke="rgba(8,20,30,.35)" stroke-width="1"/>`;
    const front = eyeSvg(cx - S.rx * 0.72, CY - 7, 3.4) + eyeSvg(cx - S.rx * 0.6, CY + 5, 3.4) +
      `<path d="M${cx - S.rx + 1},${CY + 3} q6,5 12,6" fill="none" stroke="rgba(8,20,30,.5)" stroke-width="1.2" stroke-linecap="round"/>`;
    const aa = Object.assign({}, a, { b: a.c });
    return shell(id, '', back, bodyD, aa, inner, front, { x0: 0, x1: 240, y0: 0, y1: 120 });
  }

  /* ---------- rays, seen from above ---------- */
  function ray(a, id, rand) {
    const S = a.x || {};
    const bodyD = S.manta
      ? 'M56,46 L40,40 Q44,50 54,54 Q51,60 54,66 Q44,70 40,80 L56,74 Q96,94 138,116 Q138,84 160,60 Q138,36 138,4 Q96,26 56,46 Z'
      : 'M42,60 Q72,26 118,12 Q134,40 152,60 Q134,80 118,108 Q72,94 42,60 Z';
    const tail = S.manta
      ? `<path d="M156,60 L230,61" stroke="${a.c}" stroke-width="2.2" stroke-linecap="round"/>`
      : `<path d="M146,56 L228,60 L146,64 Z" fill="${a.c}"/><path d="M170,58 l6,-6 l3,6 Z M190,58.6 l5,-5 l3,5 Z" fill="${a.c}"/>`;
    let inner = '';
    if (S.manta) inner += '<path d="M70,44 Q92,40 104,22 Q110,44 86,54 Z M70,76 Q92,80 104,98 Q110,76 86,66 Z" fill="#e9eef2" opacity=".9"/>';
    else for (let i = 0; i < 46; i++) inner += `<circle cx="${r1(48 + rand() * 100)}" cy="${r1(16 + rand() * 88)}" r="${r1(1 + rand() * 2)}" fill="${rand() > 0.3 ? a.pc : '#3d321f'}" opacity=".8"/>`;
    const front = S.manta ? eyeSvg(58, 47, 2) + eyeSvg(58, 73, 2) : eyeSvg(66, 52, 2.6) + eyeSvg(66, 68, 2.6);
    const aa = Object.assign({}, a, { b: a.c });
    return shell(id, '', tail, bodyD, aa, inner, front, { x0: 0, x1: 240, y0: 0, y1: 120 });
  }

  function seahorse(a) {
    const s = 'rgba(8,20,30,.45)';
    let o = `<path d="M150,62 q14,-8 16,6 q-6,6 -16,2 Z" fill="${a.f}" stroke="${s}" stroke-width="1"/>`;
    o += `<path d="M124,96 C126,112 146,114 146,100 C146,91 134,90 133,98" fill="none" stroke="${s}" stroke-width="8.5" stroke-linecap="round"/>`;
    o += `<path d="M116,30 C142,34 152,58 138,74 C128,84 122,88 124,98" fill="none" stroke="${s}" stroke-width="20" stroke-linecap="round"/>`;
    o += `<path d="M124,96 C126,112 146,114 146,100 C146,91 134,90 133,98" fill="none" stroke="${a.c}" stroke-width="6.5" stroke-linecap="round"/>`;
    o += `<path d="M116,30 C142,34 152,58 138,74 C128,84 122,88 124,98" fill="none" stroke="${a.c}" stroke-width="18" stroke-linecap="round"/>`;
    o += `<ellipse cx="132" cy="58" rx="11" ry="15" fill="${a.c}"/><ellipse cx="128" cy="60" rx="7" ry="12" fill="#f6e3a0" opacity=".55"/>`;
    for (let i = 0; i < 7; i++) o += `<path d="M${124 + i * 0.6},${42 + i * 8} q10,3 20,${i < 4 ? 0 : -2}" fill="none" stroke="${a.f}" stroke-width="1.3" opacity=".8"/>`;
    o += `<path d="M110,16 l3,-8 l3,7 l4,-6 l1,9 Z" fill="${a.f}" stroke="${s}" stroke-width="1"/>`;
    o += `<path d="M112,26 L84,33 L84,39 L112,36 Z" fill="${a.c}" stroke="${s}" stroke-width="1"/>`;
    o += `<circle cx="114" cy="27" r="11.5" fill="${a.c}" stroke="${s}" stroke-width="1"/>` + eyeSvg(111, 25, 3.4);
    return o;
  }

  function angler(a, id, rand) {
    const S = a.x || {}, s = 'rgba(8,20,30,.45)';
    const bodyD = 'M56,58 C52,22 118,14 152,40 C170,52 182,55 194,56 L194,66 C182,68 170,72 152,84 C118,106 56,100 56,58 Z';
    let back = `<path d="${tailPath('fan', 190, 226, 5, 18)}" fill="${a.f}"/>` +
      `<path d="${fin({ x: 132, y: 30 }, { x: 166, y: 48 }, 10, 0.5, -1)}" fill="${a.f}"/>` +
      `<path d="${fin({ x: 132, y: 92 }, { x: 166, y: 74 }, 10, 0.5, 1)}" fill="${a.f}"/>`;
    back += `<path d="M104,22 Q92,-4 62,10" fill="none" stroke="${a.c}" stroke-width="2.2" stroke-linecap="round"/>`;
    let inner = '';
    if (!S.glow) for (let i = 0; i < 18; i++) inner += `<ellipse cx="${r1(60 + rand() * 130)}" cy="${r1(22 + rand() * 50)}" rx="${r1(4 + rand() * 6)}" ry="${r1(2 + rand() * 3)}" fill="#4a3c26" opacity=".5"/>`;
    let front = '<path d="M55,48 Q88,60 104,64 Q84,76 58,84 Q50,66 55,48 Z" fill="#12090a" stroke="' + s + '" stroke-width="1"/>';
    for (let i = 0; i < 6; i++) {
      front += `<path d="M${58 + i * 7},${50 + i * 2.2} l2.4,11 l2.6,-9.5 Z" fill="#f4f1e6"/>`;
      front += `<path d="M${60 + i * 6.5},${82 - i * 2.6} l2.4,-11 l2.6,9.5 Z" fill="#f4f1e6"/>`;
    }
    front += eyeSvg(112, 44, S.glow ? 3 : 4.4);
    front += `<path d="M124,62 q14,2 18,14 q-14,0 -18,-14 Z" fill="${a.f}" stroke="${s}" stroke-width="1"/>`;
    front += S.glow
      ? '<circle cx="62" cy="10" r="9" fill="#bff3ff" opacity=".25"/><circle cx="62" cy="10" r="4.5" fill="#e9fbff" stroke="#7fd8f0" stroke-width="1"/>'
      : `<path d="M62,10 l-8,-4 l2,6 l-4,4 Z" fill="${a.c}" stroke="${s}" stroke-width="1"/>`;
    const aa = Object.assign({}, a, { b: S.glow ? a.c : '#cdbb94' });
    return shell(id, '', back, bodyD, aa, inner, front, { x0: 0, x1: 240, y0: 14, y1: 104 });
  }

  function mola(a, id, rand) {
    const s = 'rgba(8,20,30,.45)';
    const bodyD = 'M58,60 C60,30 108,24 150,30 Q170,36 172,60 Q170,84 150,90 C108,96 60,90 58,60 Z';
    const back = `<path d="M118,30 Q136,8 156,1 Q162,18 156,34 Z" fill="${a.f}"/><path d="M118,90 Q136,112 156,119 Q162,102 156,86 Z" fill="${a.f}"/>` +
      `<path d="M160,34 q14,3 18,10 q4,8 3,16 q1,8 -3,16 q-4,7 -18,10 Z" fill="${a.f}"/>`;
    let inner = '';
    for (let i = 0; i < 30; i++) inner += `<circle cx="${r1(64 + rand() * 104)}" cy="${r1(30 + rand() * 60)}" r="${r1(1 + rand() * 2.4)}" fill="#fff" opacity=".28"/>`;
    const front = eyeSvg(84, 52, 4.4) + `<ellipse cx="60" cy="61" rx="3" ry="4" fill="#3b4148" stroke="${s}" stroke-width="1"/>` +
      `<path d="M104,56 q10,-4 12,6 q-6,6 -12,-6 Z" fill="${a.f}" stroke="${s}" stroke-width="1"/>`;
    return shell(id, '', back, bodyD, a, inner, front, { x0: 0, x1: 240, y0: 24, y1: 96 });
  }

  function blob(a, id) {
    const s = 'rgba(8,20,30,.45)';
    const bodyD = 'M38,70 C36,36 90,26 140,36 C180,43 204,54 212,66 C200,80 172,88 140,92 C100,97 40,104 38,70 Z';
    const back = `<path d="${tailPath('fan', 206, 230, 4, 11)}" fill="#d99d9a"/><path d="M118,84 q10,14 26,12 q-4,-10 -8,-14 Z" fill="#d99d9a"/>`;
    const inner = '<ellipse cx="90" cy="46" rx="40" ry="10" fill="#fff" opacity=".18"/>';
    const front = `<ellipse cx="60" cy="76" rx="15" ry="11" fill="#f2c9c4" stroke="${s}" stroke-width="1"/>` +
      '<circle cx="74" cy="54" r="3.2" fill="#0b1118"/><circle cx="44" cy="58" r="2.6" fill="#0b1118"/>' +
      `<path d="M46,94 Q66,84 96,95" fill="none" stroke="#8a4f4c" stroke-width="2.2" stroke-linecap="round"/>` +
      `<path d="M66,49 q8,-5 15,-2 M38,54 q5,-4 10,-2" fill="none" stroke="${s}" stroke-width="1.2" stroke-linecap="round"/>`;
    const aa = Object.assign({}, a, { b: '#f4d2ce' });
    return shell(id, '', back, bodyD, aa, inner, front, { x0: 0, x1: 240, y0: 28, y1: 100 });
  }

  const SPECIAL = { eel, flat, ray, angler, mola, blob };

  function svg(fish, opts) {
    opts = opts || {};
    const a = fish.art, id = 'f' + (++uid), rand = rng(hash(fish.id));
    let body;
    if (a.s === 'seahorse') body = seahorse(a);
    else if (SPECIAL[a.s]) body = SPECIAL[a.s](a, id, rand);
    else body = profile(a, id, rand);
    const cls = 'fish-art' + (opts.silhouette ? ' sil' : '') + (opts.cls ? ' ' + opts.cls : '');
    const label = opts.silhouette ? 'Mystery fish silhouette' : fish.name;
    return `<svg class="${cls}" viewBox="0 0 240 120" role="img" aria-label="${label}">${body}</svg>`;
  }

  return { svg, rng, hash };
})();
