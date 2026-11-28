/* Fathom — illustrated fishing scenes.
   Two layers: an SVG backdrop per area (scenery, ambient CSS animation) and a
   canvas on top for everything that reacts to play (rod, line, float, ripples,
   splashes, the fish). The backdrop is drawn on an 800x320 stage whose
   horizon sits at y=140; it scales by height and crops at the sides, so the
   horizon is always the same fraction of the scene and the canvas can rely on it. */
window.FathomScene = (function () {
  'use strict';
  const rng = window.FishArt.rng;
  const HZ = 140, VW = 800, VH = 320;
  const r1 = n => Math.round(n * 10) / 10;
  const still = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const tm = (R, min, max) => `animation-duration:${r1(min + R() * (max - min))}s;animation-delay:-${r1(R() * max)}s`;
  let uid = 0;

  /* ---------------- building blocks ---------------- */
  function cloud(R, x, y, s, col, op) {
    return `<g class="sc-cloud" style="${tm(R, 50, 90)}" fill="${col}" opacity="${op}">` +
      `<ellipse cx="${x}" cy="${y}" rx="${r1(34 * s)}" ry="${r1(10 * s)}"/><ellipse cx="${r1(x - 20 * s)}" cy="${r1(y + 3 * s)}" rx="${r1(22 * s)}" ry="${r1(8 * s)}"/>` +
      `<ellipse cx="${r1(x + 22 * s)}" cy="${r1(y + 2 * s)}" rx="${r1(26 * s)}" ry="${r1(9 * s)}"/><ellipse cx="${r1(x + 3 * s)}" cy="${r1(y - 8 * s)}" rx="${r1(19 * s)}" ry="${r1(10 * s)}"/></g>`;
  }
  function sun(x, y, r, col, glow) {
    return `<circle cx="${x}" cy="${y}" r="${r * 2.6}" fill="${glow}" opacity=".18"/><circle cx="${x}" cy="${y}" r="${r * 1.6}" fill="${glow}" opacity=".25"/><circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/>`;
  }
  function roundTree(x, y, s, c, light) {
    return `<rect x="${r1(x - 1.6)}" y="${r1(y - s * 0.7)}" width="3.2" height="${r1(s * 0.7)}" fill="#6b4a2f"/>` +
      `<circle cx="${r1(x - s * 0.36)}" cy="${r1(y - s * 0.78)}" r="${r1(s * 0.42)}" fill="${c}"/><circle cx="${r1(x + s * 0.38)}" cy="${r1(y - s * 0.74)}" r="${r1(s * 0.4)}" fill="${c}"/>` +
      `<circle cx="${x}" cy="${r1(y - s * 1.05)}" r="${r1(s * 0.55)}" fill="${c}"/><circle cx="${r1(x - s * 0.16)}" cy="${r1(y - s * 1.2)}" r="${r1(s * 0.26)}" fill="${light}" opacity=".55"/>`;
  }
  function pine(x, y, h, c) {
    const w = h * 0.24;
    return `<rect x="${r1(x - 1.2)}" y="${r1(y - h * 0.12)}" width="2.4" height="${r1(h * 0.12)}" fill="#5a4030"/>` +
      `<path d="M${x},${r1(y - h)} l${r1(w * 0.6)},${r1(h * 0.36)} h${r1(-w * 1.2)}Z M${x},${r1(y - h * 0.78)} l${r1(w * 0.85)},${r1(h * 0.4)} h${r1(-w * 1.7)}Z M${x},${r1(y - h * 0.52)} l${r1(w)},${r1(h * 0.42)} h${r1(-w * 2)}Z" fill="${c}"/>`;
  }
  function mountain(x, w, h, col, snow) {
    const b = HZ;
    return `<path d="M${x - w / 2},${b} L${r1(x - w * 0.13)},${r1(b - h * 0.76)} L${x},${b - h} L${r1(x + w * 0.17)},${r1(b - h * 0.68)} L${x + w / 2},${b}Z" fill="${col}"/>` +
      (snow ? `<path d="M${r1(x - w * 0.085)},${r1(b - h * 0.84)} L${x},${b - h} L${r1(x + w * 0.1)},${r1(b - h * 0.82)} L${r1(x + w * 0.04)},${r1(b - h * 0.75)} L${r1(x - w * 0.005)},${r1(b - h * 0.83)} L${r1(x - w * 0.05)},${r1(b - h * 0.74)}Z" fill="${snow}" opacity=".92"/>` : '');
  }
  function shimmer(R, n, col) {
    let o = '';
    for (let i = 0; i < n; i++) {
      const d = Math.pow(R(), 1.5), y = HZ + 5 + d * (VH - HZ - 12);
      const len = 6 + d * 44 * (0.4 + R() * 0.6), x = R() * (VW - len);
      o += `<path class="sc-shim" style="${tm(R, 3, 6.5)}" d="M${r1(x)},${r1(y)} h${r1(len)}" stroke="${col}" stroke-width="${r1(0.7 + d * 1.5)}" stroke-linecap="round"/>`;
    }
    return o;
  }
  function glitter(R, x, col) {
    let o = '';
    for (let k = 0; k < 16; k++) {
      const y = HZ + 4 + k * 8 + R() * 3, w = 8 + k * 2.4 + R() * 10;
      o += `<path class="sc-twk" style="${tm(R, 1.6, 3.4)}" d="M${r1(x - w / 2 + (R() - 0.5) * 8)},${r1(y)} h${r1(w)}" stroke="${col}" stroke-width="${r1(1.2 + k * 0.08)}" stroke-linecap="round"/>`;
    }
    return o;
  }
  /* rolling bands of sea, each sliding by exactly one wavelength so the loop is seamless */
  function swells(n, cols, crest, a0, l0, y0, gap) {
    let o = '';
    for (let i = 0; i < n; i++) {
      const y = y0 + gap * Math.pow(i, 1.45), a = a0 + i * 1.5, l = l0 + i * 34;
      let d = `M${-2 * l},${r1(y)}`;
      for (let x = -2 * l; x < VW + 2 * l; x += l) d += ` q${r1(l / 4)},${r1(-a)} ${r1(l / 2)},0 q${r1(l / 4)},${r1(a)} ${r1(l / 2)},0`;
      o += `<g class="sc-swell" style="--l:${i % 2 ? l : -l}px;animation-duration:${r1(7 + i * 2.2)}s">` +
        `<path d="${d} V${VH + 6} H${-2 * l}Z" fill="${cols[Math.min(i, cols.length - 1)]}"/><path d="${d}" fill="none" stroke="${crest}" stroke-width="${r1(0.8 + i * 0.25)}" opacity="${r1(0.25 + i * 0.07)}"/></g>`;
    }
    return o;
  }
  function boulder(R, x, y, r, col, foam) {
    return `<path d="M${r1(x - r)},${y} Q${r1(x - r * 0.95)},${r1(y - r * 0.85)} ${r1(x - r * 0.1)},${r1(y - r)} Q${r1(x + r * 0.9)},${r1(y - r * 0.85)} ${r1(x + r * 1.1)},${y}Z" fill="${col}"/>` +
      `<path d="M${r1(x - r * 0.6)},${r1(y - r * 0.55)} Q${r1(x - r * 0.2)},${r1(y - r * 0.92)} ${r1(x + r * 0.3)},${r1(y - r * 0.8)}" fill="none" stroke="#fff" stroke-width="1.4" opacity=".25" stroke-linecap="round"/>` +
      (foam ? `<path class="sc-shim" style="${tm(R, 2, 3.5)}" d="M${r1(x - r * 1.5)},${y + 1.5} q${r1(r * 0.5)},-3.5 ${r1(r)},0 q${r1(r * 0.5)},3 ${r1(r)},0 q${r1(r * 0.4)},-3 ${r1(r * 0.9)},0" fill="none" stroke="#fff" stroke-width="1.6" opacity=".7" stroke-linecap="round"/>` : '');
  }
  function stage(P, far, water) {
    const id = ++uid;
    return `<svg class="sc-main" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>` +
      `<linearGradient id="sk${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky[0]}"/><stop offset="1" stop-color="${P.sky[1]}"/></linearGradient>` +
      `<linearGradient id="wt${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.water[0]}"/><stop offset=".4" stop-color="${P.water[1]}"/><stop offset="1" stop-color="${P.water[2]}"/></linearGradient>` +
      `<clipPath id="wc${id}"><rect y="${HZ}" width="${VW}" height="${VH - HZ}"/></clipPath></defs>` +
      `<rect width="${VW}" height="${HZ + 2}" fill="url(#sk${id})"/><g id="far${id}">${far}</g>` +
      `<rect y="${HZ}" width="${VW}" height="${VH - HZ}" fill="url(#wt${id})"/>` +
      `<g clip-path="url(#wc${id})" opacity="${P.refl}"><use href="#far${id}" transform="translate(0,${2 * HZ}) scale(1,-1)"/></g>` +
      `<rect y="${HZ}" width="${VW}" height="4" fill="#fff" opacity=".12"/>${water}</svg>`;
  }

  /* ---------------- foreground pieces, pinned to the scene's corners ---------------- */
  function reeds(R, side, cols, heads) {
    let o = `<svg class="sc-fg ${side}" viewBox="0 0 120 170" aria-hidden="true">`;
    for (let i = 0; i < 11; i++) {
      const bx = 8 + R() * 104, h = 60 + R() * 100, lean = (R() - 0.5) * 34, tx = bx + lean, ty = 170 - h;
      const head = heads && i % 3 === 0;
      o += `<g class="sc-sway" style="transform-origin:${r1(bx)}px 170px;${tm(R, 3.2, 5.5)}">` +
        `<path d="M${r1(bx)},172 Q${r1(bx + lean * 0.25)},${r1(170 - h * 0.6)} ${r1(tx)},${r1(ty)}" fill="none" stroke="${cols[i % cols.length]}" stroke-width="${r1(2.6 + R() * 2.2)}" stroke-linecap="round"/>` +
        (head ? `<rect x="${r1(tx - 3.4)}" y="${r1(ty + 4)}" width="6.8" height="22" rx="3.4" fill="#6b4226" transform="rotate(${r1(lean * 0.5)} ${r1(tx)} ${r1(ty + 15)})"/>` : '') + '</g>';
    }
    return o + '</svg>';
  }
  function bankRocks(R, side, cols) {
    let o = `<svg class="sc-fg ${side}" viewBox="0 0 120 170" aria-hidden="true">`;
    [[40, 170, 46], [92, 172, 30], [10, 172, 24]].forEach((b, i) => { o += boulder(R, b[0], b[1], b[2], cols[i % cols.length], false); });
    for (let i = 0; i < 7; i++) {
      const bx = 6 + R() * 108, h = 30 + R() * 40;
      o += `<path class="sc-sway" style="transform-origin:${r1(bx)}px 150px;${tm(R, 3, 5)}" d="M${r1(bx)},150 q${r1((R() - 0.5) * 14)},${r1(-h * 0.6)} ${r1((R() - 0.5) * 22)},${r1(-h)}" fill="none" stroke="#4f8f4c" stroke-width="2.4" stroke-linecap="round"/>`;
    }
    return o + '</svg>';
  }
  function dock(side) {
    return `<svg class="sc-fg ${side}" viewBox="0 0 120 170" aria-hidden="true">` +
      '<path d="M0,92 L84,78 L120,90 L24,112Z" fill="#a47c52"/><path d="M0,92 L24,112 V124 L0,104Z" fill="#7d5c3b"/><path d="M24,112 L120,90 V101 L24,124Z" fill="#8c6843"/>' +
      '<path d="M22,88.5 L50,108 M44,84.5 L74,101 M66,81 L98,95" stroke="#7d5c3b" stroke-width="1.2"/>' +
      '<rect x="86" y="70" width="11" height="104" rx="2" fill="#6b4e33"/><rect x="85" y="68" width="13" height="6" rx="2" fill="#8c6843"/><rect x="18" y="108" width="10" height="66" rx="2" fill="#5d432c"/></svg>';
  }
  function pier(side) {
    return `<svg class="sc-fg ${side}" viewBox="0 0 120 170" aria-hidden="true">` +
      '<rect x="26" y="34" width="30" height="140" rx="4" fill="#6a4a33"/><rect x="26" y="34" width="9" height="140" fill="#fff" opacity=".1"/><rect x="23" y="28" width="36" height="10" rx="4" fill="#83603f"/>' +
      '<path d="M24,70 q17,9 34,0 M24,78 q17,9 34,0" fill="none" stroke="#e3d2a8" stroke-width="3.4" stroke-linecap="round"/>' +
      '<rect x="78" y="78" width="22" height="96" rx="3" fill="#5b3f2b"/><rect x="76" y="73" width="26" height="8" rx="3" fill="#73533a"/></svg>';
  }
  function gunwale(side, hull, trim, lantern) {
    return `<svg class="sc-fg ${side}" viewBox="0 0 120 170" aria-hidden="true">` +
      `<path d="M0,84 Q64,78 120,124 V172 H0Z" fill="${hull}"/><path d="M0,84 Q64,78 120,124 V131 Q64,86 0,92Z" fill="${trim}"/>` +
      '<path d="M30,84 v-12 h14 v12" fill="none" stroke="#9aa3ab" stroke-width="3.2" stroke-linecap="round"/>' +
      (lantern ? '<circle class="sc-twk" style="animation-duration:3.2s" cx="72" cy="66" r="26" fill="#ffc76a" opacity=".22"/><path d="M72,96 V70" stroke="#333a44" stroke-width="2.4"/><rect x="65" y="56" width="14" height="17" rx="3" fill="#ffd98a" stroke="#333a44" stroke-width="2"/>' : '') + '</svg>';
  }
  function frond(R) {
    let o = '<svg class="sc-fg t" viewBox="0 0 200 130" aria-hidden="true">';
    [[150, 88, 62, '#2f8f52'], [176, 42, 26, '#3aa35c'], [104, 116, 96, '#27804a'], [190, 8, 4, '#46b26a']].forEach(f => {
      o += `<path class="sc-sway" style="transform-origin:0 0;${tm(R, 4, 6.5)}" d="M-8,-8 Q${r1(f[0] * 0.5)},${r1(f[1] * 0.16)} ${f[0]},${f[1]} Q${r1(f[0] * 0.45)},${r1(f[2] * 0.75)} -8,${r1(f[2] * 0.42)}Z" fill="${f[3]}"/>`;
    });
    return o + '</svg>';
  }

  function roots(R, side) {
    let o = `<svg class="sc-fg ${side}" viewBox="0 0 120 170" aria-hidden="true">`;
    [[8, 0, 30], [44, 10, 78], [44, 10, 18], [70, 0, 110], [70, 30, 56]].forEach((p, i) => {
      o += `<path d="M${p[0]},${p[1]} Q${r1((p[0] + p[2]) / 2 + (i % 2 ? 16 : -12))},90 ${p[2]},176" fill="none" stroke="${i % 2 ? '#4a3826' : '#5a4632'}" stroke-width="${r1(7 - i * 0.6)}" stroke-linecap="round"/>`;
    });
    for (let i = 0; i < 7; i++) o += `<ellipse class="sc-sway" style="transform-origin:${r1(20 + i * 14)}px 0;${tm(R, 3.5, 6)}" cx="${r1(10 + i * 16)}" cy="${r1(6 + R() * 16)}" rx="${r1(16 + R() * 8)}" ry="${r1(8 + R() * 4)}" fill="${['#2f6b45', '#3a7a4f', '#44875a'][i % 3]}"/>`;
    return o + '</svg>';
  }
  function kelpStalks(R, side) {
    let o = `<svg class="sc-fg ${side}" viewBox="0 0 120 170" aria-hidden="true">`;
    for (let i = 0; i < 4; i++) {
      const bx = 14 + i * 28 + R() * 8, h = 110 + R() * 55;
      o += `<g class="sc-sway" style="transform-origin:${r1(bx)}px 170px;${tm(R, 4, 6.5)}"><path d="M${r1(bx)},172 Q${r1(bx + 10)},${r1(170 - h * 0.5)} ${r1(bx - 4)},${r1(170 - h)}" fill="none" stroke="#6a5a22" stroke-width="3"/>`;
      for (let k = 1; k < 6; k++) {
        const y = 170 - h * k / 6, x = bx + Math.sin(k * 1.1) * 6, d = k % 2 ? 1 : -1;
        o += `<path d="M${r1(x)},${r1(y)} q${12 * d},-12 ${26 * d},-6 q${-10 * d},10 ${-26 * d},6Z" fill="${k % 2 ? '#8a7a2e' : '#75661f'}"/><circle cx="${r1(x)}" cy="${r1(y)}" r="2.4" fill="#b39a45"/>`;
      }
      o += '</g>';
    }
    return o + '</svg>';
  }
  function iceShelf(side) {
    return `<svg class="sc-fg ${side}" viewBox="0 0 120 170" aria-hidden="true">` +
      '<path d="M0,96 L70,88 L120,104 L96,116 L0,124Z" fill="#f4fbff"/><path d="M0,124 L96,116 L120,104 V176 H0Z" fill="#a9cfe3"/><path d="M96,116 V176" stroke="#8fbbd2" stroke-width="1.5"/><path d="M14,104 q20,-6 40,-2" stroke="#d6ecf6" stroke-width="2" fill="none"/></svg>';
  }

  /* ---------------- the areas ---------------- */
  const AREAS = {
    pond(R) {
      const P = { sky: ['#9fd3ec', '#e9f5e2'], water: ['#9ccfb4', '#3f8a70', '#1c4f41'], refl: 0.3 };
      let far = sun(566, 46, 17, '#fff6cf', '#fff2b0') + cloud(R, 250, 40, 1, '#fff', 0.85) + cloud(R, 430, 26, 0.7, '#fff', 0.7) + cloud(R, 660, 58, 0.8, '#fff', 0.75);
      far += '<path d="M0,118 Q150,66 310,104 T610,90 T800,106 V142 H0Z" fill="#a6cf9f"/><path d="M0,128 Q120,100 260,122 T520,112 T800,124 V142 H0Z" fill="#86bb88"/>';
      const greens = ['#4f9a5b', '#5aa866', '#3f8a55', '#6bb36a', '#478f58'];
      for (let x = 14; x < VW; x += 26 + R() * 22) far += roundTree(r1(x), 139, r1(15 + R() * 13), greens[Math.floor(R() * greens.length)], '#a9dd8f');
      far += '<rect x="276" y="118" width="28" height="19" fill="#9a6b45"/><path d="M271,119.5 L290,104 L309,119.5Z" fill="#7a3b30"/><rect x="287" y="124" width="6.5" height="8" fill="#ffe9a6"/>';
      far += '<path d="M0,135 Q200,131 400,136 T800,133 V143 H0Z" fill="#437d4c"/>';
      let water = '<path d="M304,141 h34" stroke="#7a5a3c" stroke-width="3"/><path d="M312,141 v6 M330,141 v6" stroke="#5d432c" stroke-width="2"/>';
      water += shimmer(R, 46, 'rgba(255,255,255,.5)') + glitter(R, 566, 'rgba(255,246,207,.55)');
      [[236, 204, 19, 1], [282, 220, 15, 0], [196, 228, 13, 0], [606, 252, 21, 1], [118, 262, 20, 0], [704, 206, 16, 1], [352, 262, 15, 0], [660, 172, 11, 0], [150, 180, 12, 1], [560, 296, 22, 0]].forEach(p => {
        const x = p[0], y = p[1], rx = p[2];
        water += `<g class="sc-bob" style="${tm(R, 3, 5)}"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${r1(rx * 0.33)}" fill="#58a868" stroke="#3a7f4b" stroke-width=".9"/>` +
          `<path d="M${x},${y} l${r1(rx * 0.95)},${r1(-rx * 0.1)} l${r1(-rx * 0.08)},${r1(rx * 0.22)}Z" fill="#2f725e"/>` +
          (p[3] ? `<circle cx="${r1(x - rx * 0.35)}" cy="${r1(y - 2.5)}" r="3.6" fill="#f7b9d3"/><circle cx="${r1(x - rx * 0.35)}" cy="${r1(y - 2.8)}" r="1.5" fill="#fff0a8"/>` : '') + '</g>';
      });
      water += '<g transform="translate(326,161) scale(.72)"><g class="sc-glide"><g class="sc-bob" style="animation-duration:1.6s">' +
        '<path d="M-13,.5 l-16,3 M-13,.5 l-14,-1.5" stroke="#fff" stroke-width="1.2" opacity=".5" stroke-linecap="round"/>' +
        '<path d="M-12,0 Q-15,-7 -4,-8 Q4,-9 8,-5 L10,-11 Q10,-16 15,-16 Q20,-16 20,-11 L20,-8 Q19,-2 12,0Z" fill="#fbfbf5"/><path d="M20,-11.5 L26,-10 L20,-8.4Z" fill="#f2a23a"/>' +
        '<path d="M-6,-5 q6,-3 11,0 q-5,3 -11,0z" fill="#dcdccf"/><circle cx="16.6" cy="-12.6" r=".95" fill="#222"/></g></g></g>';
      if (!still()) water += '<g><animateMotion dur="13s" repeatCount="indefinite" path="M300,118 C350,96 390,128 440,106 S520,124 470,150 S330,160 300,118"/>' +
        '<path d="M-6,0 h12" stroke="#2c6fa8" stroke-width="1.8" stroke-linecap="round"/><ellipse class="sc-flap" cx="0" cy="-2.6" rx="2" ry="5" fill="#fff" opacity=".7"/></g>';
      return stage(P, far, water) + reeds(R, 'l', ['#3f8f4f', '#2f7a45', '#58a85a'], true) + reeds(R, 'r', ['#3f8f4f', '#4a9a55', '#2f7a45'], true);
    },

    river(R) {
      const P = { sky: ['#93cdea', '#e4f2ee'], water: ['#a5d3d6', '#3f8ea3', '#174a5d'], refl: 0.26 };
      let far = sun(250, 40, 15, '#fffbe6', '#fff6c8') + cloud(R, 470, 34, 1, '#fff', 0.85) + cloud(R, 660, 22, 0.7, '#fff', 0.7) + cloud(R, 130, 60, 0.75, '#fff', 0.7);
      far += mountain(170, 300, 96, '#93a9c7', '#fff') + mountain(450, 380, 118, '#7f97ba', '#fff') + mountain(700, 300, 88, '#9db1cc', '#fff');
      far += '<path d="M0,124 Q160,104 330,120 T640,114 T800,122 V142 H0Z" fill="#5f9478"/>';
      for (let x = 6; x < VW; x += 13 + R() * 9) far += pine(r1(x), 138, r1(24 + R() * 18), R() > 0.5 ? '#2f6b53' : '#3a7a5c');
      for (let x = 0; x < VW; x += 10 + R() * 7) far += pine(r1(x), 141, r1(16 + R() * 12), R() > 0.5 ? '#1f5443' : '#27604b');
      far += '<path d="M0,137 Q200,134 400,138 T800,136 V143 H0Z" fill="#7d8587"/>';
      let water = '';
      for (let i = 0; i < 12; i++) {
        const d = Math.pow((i + 0.5) / 12, 1.4), y = HZ + 8 + d * (VH - HZ - 16);
        water += `<path class="sc-flow" style="animation-duration:${r1(5.5 - d * 3.2)}s" d="M-20,${r1(y)} Q200,${r1(y - 3 - d * 4)} 420,${r1(y)} T820,${r1(y)}" fill="none" stroke="#fff" stroke-width="${r1(0.8 + d * 1.5)}" opacity="${r1(0.22 + d * 0.2)}" stroke-dasharray="${r1(18 + d * 30)} ${r1(82 - d * 30)}" stroke-linecap="round"/>`;
      }
      water += shimmer(R, 22, 'rgba(255,255,255,.45)');
      water += boulder(R, 232, 206, 17, '#6f7478', true) + boulder(R, 640, 236, 22, '#62676b', true) + boulder(R, 150, 268, 26, '#72777b', true) + boulder(R, 586, 172, 10, '#7b8083', true) + boulder(R, 350, 286, 20, '#666b6f', true);
      return stage(P, far, water) + bankRocks(R, 'l', ['#7b8083', '#6a6f73', '#84898c']) + bankRocks(R, 'r', ['#6f7478', '#80868a', '#666b6f']);
    },

    lake(R) {
      const P = { sky: ['#8fbfe8', '#e6f0f4'], water: ['#b3d2e6', '#3f7fa6', '#143a59'], refl: 0.34 };
      let far = sun(600, 44, 16, '#fffdf0', '#fff7d6') + cloud(R, 180, 30, 1.1, '#fff', 0.9) + cloud(R, 400, 52, 0.8, '#fff', 0.75) + cloud(R, 720, 70, 0.7, '#fff', 0.7);
      far += mountain(120, 360, 112, '#8f9fc4', '#fff') + mountain(380, 460, 132, '#7387b3', '#fff') + mountain(640, 380, 104, '#8696be', '#fff') + mountain(800, 260, 80, '#99a8c9', '#fff');
      far += '<path d="M0,126 Q140,108 300,122 T600,116 T800,124 V142 H0Z" fill="#4f7f78"/>';
      for (let x = 4; x < VW; x += 11 + R() * 8) far += pine(r1(x), 140, r1(15 + R() * 13), R() > 0.5 ? '#24584f' : '#2f6a5c');
      far += '<path d="M0,137 Q200,135 400,138 T800,136 V143 H0Z" fill="#3b6a5f"/><rect y="116" width="800" height="26" fill="#fff" opacity=".2"/>';
      let water = shimmer(R, 54, 'rgba(255,255,255,.5)') + glitter(R, 600, 'rgba(255,250,225,.5)');
      water += '<g transform="translate(250,152)"><g class="sc-glide" style="animation-duration:150s"><g class="sc-bob" style="animation-duration:4s">' +
        '<path d="M-11,0 h22 l-4,5 h-14Z" fill="#7d4a34"/><path d="M0,-1 V-24 L12,-2Z" fill="#fff"/><path d="M-1.5,-1 V-19 L-9,-2Z" fill="#f1ede2"/></g></g></g>';
      return stage(P, far, water) + dock('l') + reeds(R, 'r', ['#4a8f6a', '#3b7a5a', '#5a9f78'], false);
    },

    coast(R) {
      const P = { sky: ['#f0a074', '#fde2b4'], water: ['#f2c59a', '#4d8f9c', '#143f52'], refl: 0.3 };
      let far = sun(292, 116, 24, '#ffe7a8', '#ffc978') + cloud(R, 150, 46, 1.2, '#fbd0b0', 0.9) + cloud(R, 450, 30, 0.9, '#fbd6ba', 0.8) + cloud(R, 660, 64, 1, '#f8c6a6', 0.8);
      far += '<path d="M470,140 Q500,118 548,112 Q600,98 660,100 Q740,96 800,84 V142 H470Z" fill="#6f5670"/><path d="M560,140 Q640,116 800,108 V142 H560Z" fill="#584460"/>';
      far += '<path d="M538,112 l3,-34 h10 l3,34Z" fill="#fbf6ee"/><path d="M539.4,97 h13.2 l.6,7 h-14.4Z" fill="#c9483e"/><rect x="539" y="71" width="14" height="8" fill="#3a3340"/><path d="M538,71 l8,-7 l8,7Z" fill="#c9483e"/>' +
        '<circle class="sc-blink" cx="546" cy="75" r="9" fill="#fff3b8" opacity=".5"/><circle class="sc-blink" cx="546" cy="75" r="2.6" fill="#fffbe0"/>';
      for (let i = 0; i < 4; i++) {
        const x = 330 + i * 46 + R() * 20, y = 44 + R() * 40, s = 0.7 + R() * 0.5;
        far += `<g transform="translate(${r1(x)},${r1(y)}) scale(${r1(s)})"><g class="sc-cloud" style="${tm(R, 16, 26)}"><path class="sc-flap" style="${tm(R, 0.5, 0.8)}" d="M-7,0 Q-3.5,-5 0,0 Q3.5,-5 7,0" fill="none" stroke="#4a3c48" stroke-width="1.6" stroke-linecap="round"/></g></g>`;
      }
      const water = glitter(R, 292, 'rgba(255,231,168,.7)') + swells(5, ['rgba(70,140,150,.25)', 'rgba(52,118,132,.4)', 'rgba(38,98,114,.5)', 'rgba(26,80,98,.6)', 'rgba(18,62,80,.7)'], '#fff', 2, 70, HZ + 14, 16) + shimmer(R, 20, 'rgba(255,240,210,.5)');
      return stage(P, far, water) + pier('l') + bankRocks(R, 'r', ['#5d5560', '#6f6672', '#4f4853']);
    },

    reef(R) {
      const P = { sky: ['#6fcdef', '#e6f9f3'], water: ['#b6efe2', '#34b9bd', '#0d5b74'], refl: 0.28 };
      let far = sun(180, 44, 18, '#fffbe6', '#fff3b0') + cloud(R, 330, 34, 1.3, '#fff', 0.95) + cloud(R, 560, 54, 1, '#fff', 0.9) + cloud(R, 720, 28, 0.8, '#fff', 0.85) + cloud(R, 80, 76, 0.8, '#fff', 0.8);
      far += '<ellipse cx="560" cy="140" rx="74" ry="9" fill="#f3e2b3"/><ellipse cx="560" cy="137" rx="52" ry="8" fill="#56a866"/>';
      [[540, 137, -14, 44], [572, 136, 12, 54], [592, 138, 22, 36]].forEach(p => {
        const x = p[0], y = p[1], tx = x + p[2], ty = y - p[3];
        far += `<path d="M${x},${y} Q${r1(x + p[2] * 0.2)},${r1(y - p[3] * 0.6)} ${tx},${ty}" fill="none" stroke="#8a6a45" stroke-width="3" stroke-linecap="round"/>`;
        [[-22, 4], [-16, -9], [0, -14], [16, -9], [22, 4], [-9, 9], [9, 9]].forEach(f => {
          far += `<path class="sc-sway" style="transform-origin:${tx}px ${ty}px;${tm(R, 3.5, 5.5)}" d="M${tx},${ty} Q${r1(tx + f[0] * 0.5)},${r1(ty + f[1] - 5)} ${tx + f[0]},${ty + f[1]} Q${r1(tx + f[0] * 0.5)},${r1(ty + f[1] * 0.5 + 2)} ${tx},${ty}Z" fill="#2f9455"/>`;
        });
      });
      far += '<ellipse cx="250" cy="140" rx="34" ry="5" fill="#f3e2b3"/><ellipse cx="250" cy="138" rx="20" ry="4.5" fill="#56a866"/>';
      let water = '';
      const corals = ['#1c7f8f', '#7a4f8f', '#c9675a', '#2a8f7a', '#d9a04a'];
      for (let i = 0; i < 16; i++) {
        const y = 196 + R() * 118, x = R() * VW;
        water += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(26 + R() * 44)}" ry="${r1(6 + R() * 9)}" fill="${corals[i % corals.length]}" opacity="${r1(0.16 + R() * 0.16)}"/>`;
      }
      water += shimmer(R, 60, 'rgba(255,255,255,.6)') + glitter(R, 180, 'rgba(255,251,230,.55)');
      for (let i = 0; i < 14; i++) {
        const x = R() * VW, y = HZ + 14 + R() * 150, s = 2 + R() * 3;
        water += `<path class="sc-twk" style="${tm(R, 1.4, 3)}" d="M${r1(x)},${r1(y - s)} l${r1(s * 0.25)},${r1(s * 0.75)} l${r1(s * 0.75)},${r1(s * 0.25)} l${r1(-s * 0.75)},${r1(s * 0.25)} l${r1(-s * 0.25)},${r1(s * 0.75)} l${r1(-s * 0.25)},${r1(-s * 0.75)} l${r1(-s * 0.75)},${r1(-s * 0.25)} l${r1(s * 0.75)},${r1(-s * 0.25)}Z" fill="#fff"/>`;
      }
      return stage(P, far, water) + frond(R) + bankRocks(R, 'r', ['#c9b48a', '#b8a076', '#d6c49c']);
    },

    ocean(R) {
      const P = { sky: ['#5fa8e2', '#d6ebf8'], water: ['#8fc0e8', '#2267ad', '#082453'], refl: 0.2 };
      let far = sun(610, 50, 17, '#fffef2', '#fff6cc');
      [[120, 122, 1.5], [330, 126, 1.9], [520, 124, 1.4], [720, 127, 1.7]].forEach(c => { far += cloud(R, c[0], c[1], c[2], '#fff', 0.92); });
      far += cloud(R, 240, 50, 0.9, '#fff', 0.7) + cloud(R, 460, 30, 0.7, '#fff', 0.6);
      far += '<g transform="translate(300,139)"><g class="sc-glide" style="animation-duration:260s"><path d="M-16,0 h32 l-3,4 h-26Z" fill="#4a566b"/><path d="M-8,0 v-6 h14 v6 M-2,-6 v-5 h4 v5" fill="#69758a"/></g></g>';
      const water = glitter(R, 610, 'rgba(255,254,242,.55)') + swells(6, ['rgba(40,110,180,.3)', 'rgba(30,94,166,.45)', 'rgba(22,78,148,.55)', 'rgba(15,62,126,.62)', 'rgba(10,48,104,.7)', 'rgba(7,36,84,.78)'], '#fff', 2.5, 84, HZ + 12, 13) + shimmer(R, 18, 'rgba(255,255,255,.4)');
      return stage(P, far, water) + gunwale('l', '#f2efe6', '#2a4f86', false);
    },

    deep(R) {
      const P = { sky: ['#060b20', '#1c2a55'], water: ['#243a6e', '#0d1c40', '#02040b'], refl: 0.3 };
      let far = '';
      for (let i = 0; i < 80; i++) far += `<circle ${i % 2 ? `class="sc-twk" style="${tm(R, 1.8, 4.5)}" ` : ''}cx="${r1(R() * VW)}" cy="${r1(R() * 128)}" r="${r1(0.4 + R() * 0.9)}" fill="#fff" opacity="${r1(0.5 + R() * 0.5)}"/>`;
      far += '<circle cx="540" cy="52" r="44" fill="#c9d6ff" opacity=".1"/><circle cx="540" cy="52" r="28" fill="#c9d6ff" opacity=".14"/><circle cx="540" cy="52" r="17" fill="#f1f4ff"/>' +
        '<circle cx="534" cy="47" r="3.6" fill="#d6dcf2"/><circle cx="546" cy="57" r="2.6" fill="#d6dcf2"/><circle cx="545" cy="44" r="1.6" fill="#d6dcf2"/>';
      far += cloud(R, 200, 70, 1.3, '#2a3a66', 0.7) + cloud(R, 660, 92, 1.1, '#2a3a66', 0.6) + cloud(R, 400, 110, 0.9, '#33457a', 0.5);
      let water = glitter(R, 540, 'rgba(210,222,255,.55)') + swells(5, ['rgba(20,34,74,.4)', 'rgba(14,26,60,.55)', 'rgba(9,18,46,.65)', 'rgba(5,11,32,.75)', 'rgba(2,6,20,.85)'], '#9fb4ff', 2.2, 90, HZ + 14, 15);
      for (let i = 0; i < 30; i++) water += `<circle class="sc-twk" style="${tm(R, 2.5, 6)}" cx="${r1(R() * VW)}" cy="${r1(172 + R() * 140)}" r="${r1(0.8 + R() * 1.3)}" fill="#7ff5e6"/>`;
      water += '<g class="sc-bob" style="animation-duration:3.4s"><path d="M262,151 l3,-11 h6 l3,11Z" fill="#a8362f"/><path d="M268,140 v-5" stroke="#555" stroke-width="1.4"/>' +
        '<circle class="sc-blink" cx="268" cy="133" r="8" fill="#ff5a4a" opacity=".35"/><circle class="sc-blink" cx="268" cy="133" r="2.2" fill="#ff8a7a"/></g>';
      return stage(P, far, water) + gunwale('l', '#39424f', '#1d232c', true);
    },

    mangrove(R) {
      const P = { sky: ['#bfe0c8', '#f3f0c4'], water: ['#b9c48a', '#5f7a4a', '#22331f'], refl: 0.3 };
      const greens = ['#2f6b45', '#3a7a4f', '#27603f', '#44875a'];
      let far = sun(420, 44, 18, '#fff7cc', '#fff0a8') + cloud(R, 180, 36, 1, '#fff', 0.7) + cloud(R, 640, 54, 0.9, '#fff', 0.6);
      far += '<path d="M0,126 Q200,112 400,124 T800,118 V142 H0Z" fill="#8fb38a"/>';
      for (let x = 0; x < VW; x += 38) far += `<ellipse cx="${r1(x)}" cy="${r1(112 + R() * 10)}" rx="${r1(24 + R() * 14)}" ry="${r1(13 + R() * 8)}" fill="${greens[Math.floor(R() * greens.length)]}"/>`;
      for (let x = 6; x < VW; x += 21) far += `<path d="M${r1(x)},${r1(122 + R() * 6)} V133 M${r1(x)},128 q-7,6 -10,13 M${r1(x)},130 q6,5 9,11" fill="none" stroke="#5a4632" stroke-width="1.7" stroke-linecap="round"/>`;
      far += '<path d="M0,137 Q200,134 400,138 T800,136 V143 H0Z" fill="#6a5a3e"/>';
      let water = shimmer(R, 34, 'rgba(255,255,220,.4)') + glitter(R, 420, 'rgba(255,247,204,.45)');
      const near = (x0, x1) => {
        let o = '';
        for (let x = x0; x < x1; x += 30) o += `<path d="M${r1(x)},${r1(96 + R() * 10)} C${r1(x - 14)},130 ${r1(x - 20)},150 ${r1(x - 24 + R() * 8)},${r1(168 + R() * 10)} M${r1(x)},100 C${r1(x + 10)},132 ${r1(x + 16)},150 ${r1(x + 18)},${r1(166 + R() * 10)}" fill="none" stroke="#4a3826" stroke-width="3.2" stroke-linecap="round"/>`;
        for (let x = x0; x < x1; x += 26) o += `<ellipse class="sc-sway" style="transform-origin:${r1(x)}px 110px;${tm(R, 4, 7)}" cx="${r1(x)}" cy="${r1(74 + R() * 22)}" rx="${r1(34 + R() * 16)}" ry="${r1(20 + R() * 10)}" fill="${greens[Math.floor(R() * greens.length)]}"/>`;
        return o;
      };
      water += near(-10, 170) + near(650, 810);
      for (let i = 0; i < 9; i++) water += `<ellipse class="sc-bob" style="${tm(R, 3, 5)}" cx="${r1(190 + R() * 440)}" cy="${r1(160 + R() * 130)}" rx="${r1(4 + R() * 4)}" ry="${r1(1.6 + R())}" fill="#c9c05a" opacity=".8"/>`;
      water += '<g class="sc-bob" style="animation-duration:5s"><path d="M236,150 v11 M241,150 v11" stroke="#3a3a3a" stroke-width="1"/><ellipse cx="238" cy="145" rx="8" ry="5" fill="#fff"/><path d="M243,143 q5,-8 2,-14" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M245,128.4 l8,1.6 l-8,1.2Z" fill="#e8b23a"/></g>';
      return stage(P, far, water) + roots(R, 'l') + roots(R, 'r');
    },

    kelp(R) {
      const P = { sky: ['#9bbfd2', '#e9eff0'], water: ['#a9c9c9', '#2f7a72', '#0c3336'], refl: 0.26 };
      let far = sun(180, 50, 15, '#fbfbf0', '#ffffff') + cloud(R, 330, 40, 1.4, '#fff', 0.8) + cloud(R, 560, 28, 1.1, '#f4f7f8', 0.75) + cloud(R, 90, 82, 0.9, '#fff', 0.6);
      far += '<path d="M430,140 L450,96 Q470,84 500,86 L560,70 Q620,60 690,66 L800,52 V142 H430Z" fill="#6f6a5a"/><path d="M450,96 Q470,84 500,86 L560,70 Q620,60 690,66 L800,52 V64 Q700,76 640,74 L560,82 L505,97 Q475,96 458,106Z" fill="#7f9a5f"/>';
      for (let x = 530; x < VW; x += 30 + R() * 22) far += pine(r1(x), r1(82 - (x - 520) * 0.11), r1(20 + R() * 12), '#35573f');
      far += '<path d="M250,140 L258,112 Q266,100 276,110 L286,140Z" fill="#5d5a4e"/><path d="M330,140 L336,122 Q342,114 350,124 L356,140Z" fill="#6a6658"/><path d="M90,140 L100,104 Q112,90 124,102 L138,140Z" fill="#646052"/>';
      let water = swells(4, ['rgba(40,120,112,.25)', 'rgba(30,100,96,.4)', 'rgba(20,80,78,.5)', 'rgba(12,60,60,.6)'], '#fff', 1.6, 90, HZ + 16, 20) + shimmer(R, 24, 'rgba(255,255,255,.4)') + glitter(R, 180, 'rgba(255,255,255,.35)');
      const patch = (cx, cy, k) => {
        let o = `<g class="sc-bob" style="${tm(R, 3, 5)}">`;
        for (let i = 0; i < 9; i++) {
          const x = cx + (R() - 0.5) * 90 * k, y = cy + (R() - 0.5) * 16 * k;
          o += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1((10 + R() * 14) * k)}" ry="${r1((2.4 + R() * 2) * k)}" fill="${R() > 0.5 ? '#7a6a2a' : '#8f7f33'}" transform="rotate(${r1((R() - 0.5) * 30)} ${r1(x)} ${r1(y)})"/><circle cx="${r1(x + (R() - 0.5) * 10)}" cy="${r1(y)}" r="${r1(1.8 * k)}" fill="#b39a45"/>`;
        }
        return o + '</g>';
      };
      water += patch(250, 172, 0.7) + patch(640, 190, 0.9) + patch(120, 226, 1.1) + patch(700, 262, 1.3) + patch(330, 292, 1.3) + patch(560, 160, 0.6);
      water += '<g transform="translate(318,214)"><g class="sc-bob" style="animation-duration:2.6s"><ellipse cx="0" cy="0" rx="19" ry="5.5" fill="#6b4a33"/><ellipse cx="2" cy="-1.5" rx="12" ry="3.2" fill="#8a6548"/><circle cx="-17" cy="-3.5" r="5.6" fill="#7a573d"/><circle cx="-18.5" cy="-4.5" r="3.4" fill="#d9c4a8"/>' +
        '<circle cx="-19.6" cy="-5.6" r=".8" fill="#222"/><circle cx="-16.8" cy="-6" r=".8" fill="#222"/><circle cx="-18.4" cy="-3.8" r="1" fill="#3a2a20"/><path d="M-6,-3 q3,-4 6,-1 M18,0 q7,-2 9,-6" fill="none" stroke="#6b4a33" stroke-width="2.6" stroke-linecap="round"/></g></g>';
      return stage(P, far, water) + kelpStalks(R, 'l') + bankRocks(R, 'r', ['#5d5a4e', '#6a6658', '#55524a']);
    },

    polar(R) {
      const P = { sky: ['#0d1f44', '#7fb0c4'], water: ['#9fc8d6', '#2f6f96', '#082238'], refl: 0.3 };
      let far = '';
      for (let i = 0; i < 44; i++) far += `<circle ${i % 2 ? `class="sc-twk" style="${tm(R, 2, 5)}" ` : ''}cx="${r1(R() * VW)}" cy="${r1(R() * 72)}" r="${r1(0.4 + R() * 0.8)}" fill="#fff" opacity="${r1(0.4 + R() * 0.5)}"/>`;
      [['#5ff0b0', 30, 0.34], ['#7fe0ff', 46, 0.24], ['#a8ffb0', 16, 0.2]].forEach((a, i) => {
        const y = a[1];
        far += `<path class="sc-twk" style="animation-duration:${6 + i * 2.5}s" d="M-20,${y + 30} C150,${y - 24} 300,${y + 34} 460,${y} S720,${y - 18} 820,${y + 22} L820,${y + 52} C700,${y + 12} 600,${y + 40} 460,${y + 30} S150,${y + 10} -20,${y + 64}Z" fill="${a[0]}" opacity="${a[2]}"/>`;
      });
      far += mountain(140, 320, 60, '#8fa9c2', '#fff') + mountain(420, 380, 74, '#7f9bb8', '#fff') + mountain(700, 300, 56, '#9ab3ca', '#fff');
      far += '<path d="M0,132 Q200,126 400,133 T800,130 V142 H0Z" fill="#e6f1f6"/>';
      const berg = (x, w, h) => `<path d="M${x},140 L${r1(x + w * 0.12)},${r1(140 - h * 0.6)} L${r1(x + w * 0.34)},${140 - h} L${r1(x + w * 0.52)},${r1(140 - h * 0.72)} L${r1(x + w * 0.7)},${r1(140 - h * 0.86)} L${x + w},140Z" fill="#f4fbff"/>` +
        `<path d="M${r1(x + w * 0.34)},${140 - h} L${r1(x + w * 0.52)},${r1(140 - h * 0.72)} L${r1(x + w * 0.7)},${r1(140 - h * 0.86)} L${x + w},140 H${r1(x + w * 0.5)}Z" fill="#b9d9ea"/>`;
      far += berg(250, 90, 46) + berg(560, 120, 62) + berg(40, 60, 28);
      let water = shimmer(R, 40, 'rgba(255,255,255,.5)');
      const floe = (x, y, w, extra) => `<g class="sc-bob" style="${tm(R, 3.5, 6)}"><path d="M${x},${y + 3} l${r1(w * 0.5)},${r1(w * 0.07)} l${r1(w * 0.5)},${r1(-w * 0.04)} v${r1(w * 0.05)} l${r1(-w * 0.5)},${r1(w * 0.06)} l${r1(-w * 0.5)},${r1(-w * 0.07)}Z" fill="#8fbbd2"/>` +
        `<path d="M${x},${y} l${r1(w * 0.3)},${r1(-w * 0.05)} l${r1(w * 0.5)},${r1(w * 0.02)} l${r1(w * 0.2)},${r1(w * 0.06)} l${r1(-w * 0.5)},${r1(w * 0.06)} l${r1(-w * 0.5)},${r1(-w * 0.07)}Z" fill="#f4fbff"/>${extra || ''}</g>`;
      const seal = '<path d="M632,186 q10,-12 26,-7 q9,2 13,7 l7,-3 l-2,6Z" fill="#7f8a94"/><circle cx="634" cy="182" r="5" fill="#8a959f"/><circle cx="632.4" cy="181" r=".9" fill="#222"/><path d="M629.6,183.4 h-3" stroke="#222" stroke-width=".8"/>';
      water += floe(170, 170, 70) + floe(600, 186, 96, seal) + floe(380, 160, 46) + floe(70, 236, 110) + floe(680, 270, 130) + floe(290, 290, 100);
      return stage(P, far, water) + iceShelf('l') + iceShelf('r');
    }
  };

  function backdrop(areaId) {
    const fn = AREAS[areaId] || AREAS.pond;
    return fn(rng(window.FishArt.hash('scene:' + areaId)));
  }

  /* Fish drawings as images for the canvas layers, with a dark cut-out for shadows. */
  const artCache = {};
  function artImage(fish, golden) {
    const key = fish.id + (golden ? '*' : '');
    if (artCache[key]) return artCache[key];
    const o = artCache[key] = { img: new Image(), sil: null };
    o.img.onload = () => {
      const c = document.createElement('canvas'); c.width = 240; c.height = 120;
      const x = c.getContext('2d');
      x.drawImage(o.img, 0, 0, 240, 120);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = '#04141f'; x.fillRect(0, 0, 240, 120);
      o.sil = c;
    };
    o.img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      window.FishArt.svg(fish, { golden: !!golden }).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240" '));
    return o;
  }

  /* =====================================================================
     The play layer
     ===================================================================== */
  function Fx(canvas, getState) {
    const ctx = canvas.getContext('2d');
    const lerp = (a, b, u) => a + (b - a) * u;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
    let W = 320, H = 300, dpr = 1, raf = 0, last = 0, t = 0, running = false;
    let night = false, calm = true;
    let ripples = [], drops = [];
    let castT = -99, landed = true, prevPhase = 'idle', nextRing = 0, nextAmbient = 2;
    let fx = 0, fy = 0, prevFx = 0, face = 1, surging = false, leap = null, fishArt = null;
    function resize() {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      W = r.width; H = r.height; dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    const spots = () => ({
      butt: { x: -W * 0.05, y: H * 0.86 },
      tip: { x: Math.min(W * 0.27, 190), y: H * 0.1 },
      fl: { x: W * 0.62, y: H * 0.55 },
      hz: H * (HZ / VH)
    });

    function ring(x, y, max, a) { ripples.push({ x, y, r: 2, max: max || 26, a: a || 0.7 }); }
    function splash(x, y, n, power) {
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.9, sp = power * (0.45 + Math.random() * 0.7);
        drops.push({ x, y, y0: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 1 + Math.random() * 1.8, a: 1 });
      }
      ring(x, y, 20 + power * 0.14, 0.85);
    }

    function drawRod(g, tip, target, bend) {
      const len = Math.hypot(tip.x - g.butt.x, tip.y - g.butt.y);
      let tx = tip.x, ty = tip.y;
      if (bend > 0 && target) {
        const dx = target.x - tip.x, dy = target.y - tip.y, d = Math.hypot(dx, dy) || 1;
        tx += dx / d * bend * len * 0.27; ty += dy / d * bend * len * 0.27;
      }
      const cx = lerp(g.butt.x, tip.x, 0.66), cy = lerp(g.butt.y, tip.y, 0.66);
      const at = u => { const a = 1 - u; return { x: a * a * g.butt.x + 2 * a * u * cx + u * u * tx, y: a * a * g.butt.y + 2 * a * u * cy + u * u * ty }; };
      const wood = night ? '#8a6a4a' : '#3b2a1c', N = 20;
      ctx.lineCap = 'round';
      let p = at(0);
      for (let i = 1; i <= N; i++) {
        const u = i / N, q = at(u);
        ctx.strokeStyle = u < 0.16 ? (night ? '#5b4636' : '#1c1410') : wood;
        ctx.lineWidth = (u < 0.16 ? 9 : 6.4 - 5 * u);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        p = q;
      }
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); p = at(0.18); ctx.moveTo(p.x - 1.5, p.y - 1.5);
      for (let i = 4; i <= N; i++) { const q = at(i / N); ctx.lineTo(q.x - 1.2, q.y - 1.2); }
      ctx.stroke();
      const reel = at(0.2);
      ctx.fillStyle = '#c9ced3'; ctx.strokeStyle = '#59626a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(reel.x + 5, reel.y + 7, 7, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#59626a'; ctx.beginPath(); ctx.arc(reel.x + 5, reel.y + 7, 2.2, 0, 7); ctx.fill();
      [0.42, 0.62, 0.8, 0.93].forEach(u => { const q = at(u); ctx.strokeStyle = night ? '#c9ced3' : '#59626a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(q.x + 1.5, q.y + 2, 2, 0, 7); ctx.stroke(); });
      return { x: tx, y: ty };
    }
    function drawLine(a, b, sag, strain) {
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 + sag;
      const path = () => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cx, cy, b.x, b.y); };
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,25,35,.28)'; ctx.lineWidth = 2.4; path(); ctx.stroke();
      const s = clamp(strain || 0, 0, 1);
      ctx.strokeStyle = `rgba(255,${Math.round(255 - 150 * s)},${Math.round(255 - 170 * s)},.95)`; ctx.lineWidth = 1.1; path(); ctx.stroke();
    }
    function float(x, wy, sub, tilt) {
      const s = clamp(W / 400, 0.95, 1.3);
      const body = () => {
        ctx.save(); ctx.translate(x, wy - 1 + sub); ctx.rotate(tilt); ctx.scale(s, s);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, 5.4, 7.6, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#e2483d'; ctx.beginPath(); ctx.ellipse(0, 0, 5.4, 7.6, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, 5.4, 7.6, 0, 0, 7); ctx.stroke();
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -7.6); ctx.lineTo(0, -13); ctx.stroke();
        ctx.restore();
      };
      ctx.save(); ctx.beginPath(); ctx.rect(x - 30, wy - 60, 60, 60); ctx.clip(); body(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(x - 30, wy, 60, 40); ctx.clip(); ctx.globalAlpha = 0.28; body(); ctx.restore();
    }
    function hanging(x, y) {
      ctx.save(); ctx.translate(x, y); ctx.scale(0.9, 0.9);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e2483d'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 7, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, 5, 7, 0, 0, 7); ctx.stroke();
      ctx.restore();
    }

    function frame(now) {
      raf = running ? requestAnimationFrame(frame) : 0;
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; t += dt;
      const st = getState(), phase = st.phase, f = st.f, g = spots();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // things that happen when the phase changes
      if (phase !== prevPhase) {
        if (prevPhase === 'bite' && phase === 'fight') splash(g.fl.x, g.fl.y, 14, 170);
        if ((prevPhase === 'wait' || prevPhase === 'bite') && phase === 'idle' && landed) ring(g.fl.x, g.fl.y, 22, 0.6);
        if (phase === 'bite') { splash(g.fl.x, g.fl.y, 7, 110); nextRing = 0; }
        prevPhase = phase;
      }

      let tip = { x: g.tip.x, y: g.tip.y }, target = null, bend = 0, lineTo = null, sag = 0, strain = 0, showFloat = null, hang = null, shadow = null;
      if (phase === 'idle') {
        hang = { x: tip.x + Math.sin(t * 1.6) * 2.5, y: tip.y + 26 };
      } else if (phase === 'wait') {
        const a = t - castT;
        const back = { x: g.tip.x - W * 0.1, y: g.tip.y + H * 0.03 }, fwd = { x: g.tip.x + W * 0.07, y: g.tip.y + H * 0.11 };
        if (a < 0.22) { const u = ease(a / 0.22); tip = { x: lerp(g.tip.x, back.x, u), y: lerp(g.tip.y, back.y, u) }; }
        else if (a < 0.42) { const u = Math.pow((a - 0.22) / 0.2, 2); tip = { x: lerp(back.x, fwd.x, u), y: lerp(back.y, fwd.y, u) }; }
        else if (a < 0.95) { const u = ease((a - 0.42) / 0.53); tip = { x: lerp(fwd.x, g.tip.x, u), y: lerp(fwd.y, g.tip.y, u) }; }
        if (a < 0.34) hang = { x: tip.x, y: tip.y + 22 };
        else {
          const u = clamp((a - 0.34) / 0.5, 0, 1);
          if (u < 1) {
            const p = { x: lerp(fwd.x, g.fl.x, u), y: lerp(fwd.y + 20, g.fl.y, u) - Math.sin(Math.PI * u) * H * 0.2 };
            lineTo = p; sag = 10; hang = p;
          } else {
            if (!landed) { landed = true; splash(g.fl.x, g.fl.y, 9, 120); nextRing = t + 2.2; }
            const bob = Math.sin(t * 2.4) * 1.6;
            showFloat = { sub: bob, tilt: Math.sin(t * 1.7) * 0.07 };
            lineTo = { x: g.fl.x, y: g.fl.y - 13 + bob }; sag = H * 0.085;
            if (t > nextRing) { ring(g.fl.x, g.fl.y, 20, 0.5); nextRing = t + 2.6; }
          }
        }
      } else if (phase === 'bite') {
        const dip = 8 + Math.sin(t * 24) * 3.5;
        showFloat = { sub: dip, tilt: Math.sin(t * 19) * 0.22 };
        lineTo = { x: g.fl.x, y: g.fl.y - 12 + dip }; sag = 4; bend = 0.2; target = lineTo;
        if (t > nextRing) { ring(g.fl.x, g.fl.y, 26, 0.75); nextRing = t + 0.3; }
      } else if (phase === 'fight' && f) {
        const P = f.P / 100, amp = W * 0.085 * (1 - 0.35 * P);
        prevFx = fx;
        fx = W * (0.64 - 0.15 * P) + Math.sin(f.t * 1.7 + f.phase) * amp + Math.sin(f.t * 4.3) * amp * 0.22 + (f.surge > 0 ? Math.sin(f.t * 15) * 4 : 0);
        fy = H * (0.545 + 0.03 * P) + Math.sin(f.t * 2.3 + 1) * H * 0.012;
        if (Math.abs(fx - prevFx) > 0.15) face = fx > prevFx ? -1 : 1;
        target = lineTo = { x: fx, y: fy }; bend = 0.22 + 0.78 * (f.T / 100); strain = f.strain / 100;
        if (strain > 0.3) lineTo = { x: fx + Math.sin(t * 60) * 1.2, y: fy };
        shadow = { x: fx + face * 6, y: fy + 9 };
        if (f.surge > 0 && !surging) splash(fx, fy, 16, 190);
        surging = f.surge > 0;
        if (t > nextRing) { ring(fx, fy, 18 + f.T * 0.12, 0.55); nextRing = t + (surging ? 0.22 : 0.55); }
      } else if (phase === 'land' && leap) {
        const u = (t - leap.t0) / 0.85;
        const p = { x: leap.x0 - W * 0.1 * u, y: leap.y0 - Math.sin(Math.PI * clamp(u, 0, 1)) * H * 0.3 };
        target = lineTo = p; bend = 0.35;
        leap.p = p; leap.u = u;
        if (u >= 1 && !leap.done) { leap.done = true; splash(p.x, leap.y0, 12, 150); const cb = leap.cb; setTimeout(cb, 0); }
      }

      // water effects sit under everything else
      if (calm && phase !== 'fight' && t > nextAmbient) {
        ring(W * (0.08 + Math.random() * 0.84), lerp(g.hz + 12, H * 0.6, Math.random()), 10 + Math.random() * 8, 0.4);
        nextAmbient = t + 2.5 + Math.random() * 5;
      }
      ripples = ripples.filter(r => r.a > 0.02);
      for (const r of ripples) {
        r.r += (r.max - r.r) * dt * 2.2 + dt * 6; r.a -= dt * 0.55;
        ctx.strokeStyle = `rgba(255,255,255,${clamp(r.a, 0, 1)})`; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.3, 0, 0, 7); ctx.stroke();
        if (r.r > 8) { ctx.strokeStyle = `rgba(255,255,255,${clamp(r.a * 0.5, 0, 1)})`; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * 0.55, r.r * 0.165, 0, 0, 7); ctx.stroke(); }
      }
      if (shadow) {
        const o = fishArt, w = clamp(W * 0.2, 64, 124) * (o ? o.scale : 1);
        ctx.save(); ctx.translate(shadow.x, shadow.y); ctx.scale(face, 0.52); ctx.rotate(Math.sin(t * 9) * 0.07); ctx.globalAlpha = 0.36;
        if (o && o.sil) ctx.drawImage(o.sil, -w / 2, -w / 4, w, w / 2);
        else { ctx.fillStyle = '#04141f'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.4, w * 0.16, 0, 0, 7); ctx.fill(); }
        ctx.restore();
      }
      if (showFloat) float(g.fl.x, g.fl.y, showFloat.sub, showFloat.tilt);

      const tipNow = drawRod(g, tip, target, bend);
      if (lineTo) drawLine(tipNow, lineTo, sag, strain);
      else if (hang) drawLine(tipNow, { x: hang.x, y: hang.y - 6 }, 0, 0);
      if (hang) hanging(hang.x, hang.y);

      if (phase === 'land' && leap && leap.u < 1 && leap.p) {
        const o = fishArt, w = clamp(W * 0.3, 104, 176) * (o ? o.scale : 1);
        ctx.save(); ctx.translate(leap.p.x, leap.p.y); ctx.rotate(-0.95 + 1.5 * leap.u);
        if (o && o.img.complete && o.img.naturalWidth) ctx.drawImage(o.img, -w * 0.12, -w / 4, w, w / 2);
        ctx.restore();
      }

      drops = drops.filter(d => d.a > 0.02 && !(d.vy > 0 && d.y > d.y0 + 3));
      ctx.fillStyle = '#fff';
      for (const d of drops) {
        d.vy += 560 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.a -= dt * 0.9;
        ctx.globalAlpha = clamp(d.a, 0, 1); ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);

    return {
      start() { if (running) return; running = true; resize(); last = performance.now(); raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); },
      setArea(id) { night = id === 'deep' || id === 'polar'; calm = id === 'pond' || id === 'lake' || id === 'reef' || id === 'mangrove'; ripples = []; drops = []; },
      cast() { castT = t; landed = false; },
      hook(fish, golden) {
        fishArt = artImage(fish, golden);
        fishArt.scale = 0.78 + 0.5 * clamp(Math.log10(fish.len) / 3.3, 0, 1);
        const g = spots(); fx = prevFx = g.fl.x; fy = g.fl.y; surging = false; nextRing = 0;
      },
      caught(cb) { leap = { t0: t, x0: fx, y0: fy, cb, done: false, u: 0 }; splash(fx, fy, 18, 210); },
      lost(kind) { if (kind === 'snap') splash(fx, fy, 10, 130); else { ring(fx, fy, 30, 0.8); ring(fx, fy, 16, 0.6); } }
    };
  }

  /* =====================================================================
     The aquarium
     ===================================================================== */
  /* Decorations are small drawings stood on the sand. `at` is where along the
     tank they sit, `w` their width as a share of it, `back` puts them in the
     far row behind the fish. */
  const DECOR = [
    { id: 'grass', name: 'Sea grass', cost: 150, at: [0.05, 0.6, 0.96], w: 0.13,
      svg: '<path d="M54,120 Q40,70 30,14 Q52,66 62,120Z" fill="#2f9a5a"/><path d="M62,120 Q64,60 60,4 Q74,60 70,120Z" fill="#3fb06a"/><path d="M68,120 Q82,76 94,30 Q80,80 76,120Z" fill="#2a8a50"/><path d="M48,120 Q30,90 16,56 Q40,88 56,120Z" fill="#37a561"/>' },
    { id: 'rocks', name: 'Rock pile', cost: 300, at: [0.7], w: 0.24,
      svg: '<path d="M8,120 Q10,70 44,66 Q74,64 80,120Z" fill="#6f7780"/><path d="M52,120 Q58,86 84,84 Q110,86 114,120Z" fill="#59616a"/><path d="M30,120 Q34,98 52,98 Q66,100 68,120Z" fill="#7f8891"/><path d="M20,86 q14,-12 30,-10" stroke="#fff" opacity=".2" fill="none" stroke-width="3" stroke-linecap="round"/>' },
    { id: 'coral', name: 'Coral garden', cost: 600, at: [0.3], w: 0.2,
      svg: '<path d="M60,120 V70 M60,96 Q40,86 36,58 M60,88 Q82,78 86,50 M36,74 Q24,66 22,48 M86,66 Q98,58 100,42 M60,70 Q56,50 62,30" fill="none" stroke="#f0708f" stroke-width="9" stroke-linecap="round"/><path d="M24,120 Q20,96 30,90 Q44,96 40,120Z M84,120 Q82,100 94,98 Q104,104 100,120Z" fill="#f2a23a"/>' },
    { id: 'bubbler', name: 'Bubble stone', cost: 900, at: [0.52], w: 0.1,
      svg: '<path d="M30,120 Q34,96 60,94 Q88,96 92,120Z" fill="#8a929a"/><circle cx="50" cy="104" r="3" fill="#5a626a"/><circle cx="68" cy="108" r="3" fill="#5a626a"/><circle cx="60" cy="100" r="2.4" fill="#5a626a"/>' },
    { id: 'castle', name: 'Castle', cost: 1500, at: [0.4], w: 0.3, back: true,
      svg: '<rect x="20" y="62" width="80" height="58" fill="#b9a98a"/><rect x="10" y="40" width="26" height="80" fill="#c9b99a"/><rect x="84" y="40" width="26" height="80" fill="#c9b99a"/><path d="M10,40 v-10 h6 v6 h4 v-6 h6 v6 h4 v-6 h6 v10Z M84,40 v-10 h6 v6 h4 v-6 h6 v6 h4 v-6 h6 v10Z" fill="#c9b99a"/>' +
        '<path d="M20,62 v-8 h8 v5 h8 v-5 h8 v5 h8 v-5 h8 v5 h8 v-5 h8 v5 h8 v-5 h8 v8Z" fill="#b9a98a"/><path d="M48,120 V96 Q60,80 72,96 V120Z" fill="#3a3028"/><rect x="18" y="58" width="9" height="13" rx="4" fill="#3a3028"/><rect x="93" y="58" width="9" height="13" rx="4" fill="#3a3028"/><path d="M23,30 V12 l14,5 l-14,5" fill="#e2574c" stroke="#7a6a50" stroke-width="1.5"/>' },
    { id: 'helmet', name: 'Diving helmet', cost: 2500, at: [0.86], w: 0.15,
      svg: '<circle cx="60" cy="74" r="40" fill="#c98a3a"/><rect x="30" y="104" width="60" height="16" rx="4" fill="#a86f2a"/><circle cx="60" cy="72" r="20" fill="#16405f" stroke="#e9c27a" stroke-width="6"/><circle cx="26" cy="74" r="9" fill="#16405f" stroke="#e9c27a" stroke-width="4"/><circle cx="94" cy="74" r="9" fill="#16405f" stroke="#e9c27a" stroke-width="4"/><path d="M48,62 q8,-8 18,-4" stroke="#fff" opacity=".4" fill="none" stroke-width="3" stroke-linecap="round"/>' },
    { id: 'chest', name: 'Treasure chest', cost: 4000, at: [0.17], w: 0.17,
      svg: '<rect x="18" y="74" width="84" height="46" rx="4" fill="#8a5a2e"/><path d="M18,74 Q20,44 60,44 Q100,44 102,74Z" fill="#a06a36"/><path d="M18,74 H102" stroke="#e9c24a" stroke-width="6"/><rect x="38" y="44" width="8" height="76" fill="#e9c24a"/><rect x="74" y="44" width="8" height="76" fill="#e9c24a"/><rect x="52" y="66" width="16" height="18" rx="3" fill="#e9c24a"/><circle cx="60" cy="76" r="3" fill="#6a4a1e"/>' },
    { id: 'wreck', name: 'Shipwreck', cost: 7000, at: [0.76], w: 0.44, back: true, vw: 200,
      svg: '<path d="M10,120 Q6,84 30,70 L150,52 Q184,56 192,96 L186,120Z" fill="#5a4636"/><path d="M30,70 L150,52 L148,62 L34,80Z" fill="#7a6048"/><path d="M60,66 L52,10 M110,58 L116,4" stroke="#4a382a" stroke-width="5" stroke-linecap="round"/><path d="M52,14 L92,30 L56,40Z" fill="#c9c2b0" opacity=".7"/>' +
        '<circle cx="70" cy="94" r="7" fill="#1f2a33"/><circle cx="104" cy="90" r="7" fill="#1f2a33"/><circle cx="138" cy="86" r="7" fill="#1f2a33"/><path d="M40,120 q6,-22 26,-18 M150,120 q4,-16 20,-12" stroke="#3fa56a" stroke-width="5" fill="none" stroke-linecap="round"/>' }
  ];
  const TANKS = [
    { name: 'Small tank', fish: 6, cost: 0 },
    { name: 'Medium tank', fish: 12, cost: 800 },
    { name: 'Large tank', fish: 20, cost: 3000 },
    { name: 'Grand tank', fish: 30, cost: 9000 }
  ];
  const decorSvg = d => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.vw || 120} 120">${d.svg}</svg>`;

  function Tank(canvas) {
    const ctx = canvas.getContext('2d');
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const rnd = (a, b) => a + Math.random() * (b - a);
    let W = 320, H = 380, dpr = 1, raf = 0, last = 0, t = 0, running = false;
    let fishes = [], owned = new Set(), bubbles = [], food = [], label = null, nextBubble = 0, nextBurst = 4;
    const img = {};
    DECOR.forEach(d => {
      const im = new Image();
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(decorSvg(d).replace('<svg ', `<svg width="${(d.vw || 120) * 2}" height="240" `));
      img[d.id] = im;
    });
    const sand = () => H * 0.87;
    const span = () => Math.min(W, 620);

    function resize() {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const first = W === 320 && H === 380;
      W = r.width; H = r.height; dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      if (first) fishes.forEach(e => { e.x = rnd(40, W - 40); aim(e); });
    }
    function width(e) { return span() * e.rel * (0.8 + 0.35 * e.z) * (fishes.length > 18 ? 0.8 : fishes.length > 10 ? 0.9 : 1); }
    function aim(e) {
      const w = width(e);
      e.tx = rnd(w * 0.5, Math.max(w * 0.5 + 1, W - w * 0.5));
      e.ty = e.low ? rnd(sand() - H * 0.17, sand() - 12) : rnd(H * 0.1, sand() - H * 0.12);
      e.rest = Math.random() < 0.22 ? rnd(1, 3) : 0;
    }
    function setFish(list) {
      const old = {};
      fishes.forEach(e => { old[e.key] = e; });
      fishes = list.map(it => {
        const key = it.fish.id + (it.golden ? '*' : '');
        if (old[key]) return old[key];
        const s = it.fish.art.s;
        const e = {
          key, fish: it.fish, golden: !!it.golden, art: artImage(it.fish, it.golden),
          rel: clamp(0.1 + 0.1 * (Math.log10(it.fish.len) - 1), 0.09, 0.34),
          low: s === 'flat' || s === 'ray' || s === 'angler' || s === 'blob' || s === 'catfish' || s === 'sturgeon' || s === 'eel',
          z: Math.random(), ph: Math.random() * 6.28, x: rnd(40, W - 40), y: rnd(H * 0.2, H * 0.7),
          vx: (Math.random() < 0.5 ? -1 : 1) * 14, vy: 0, turn: 0, tx: 0, ty: 0, rest: 0, happy: 0
        };
        e.turn = e.vx > 0 ? -1 : 1;
        if (e.low) e.y = rnd(sand() - H * 0.17, sand() - 12);
        aim(e);
        return e;
      });
      if (label && !fishes.includes(label.e)) label = null;
    }
    function bubble(x, y, r) { bubbles.push({ x, y, r: r || rnd(1.5, 4), vy: rnd(26, 46), ph: Math.random() * 6.28 }); }

    function frame(now) {
      raf = running ? requestAnimationFrame(frame) : 0;
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; t += dt;
      const sy = sand(), sp = span();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // water
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#38b3cf'); g.addColorStop(0.55, '#1a7fa6'); g.addColorStop(1, '#0b3f63');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 5; i++) {
        const x = W * (0.08 + i * 0.22) + Math.sin(t * 0.25 + i) * 14, a = 0.05 + 0.04 * Math.sin(t * 0.6 + i * 1.7);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, a)})`;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + W * 0.09, 0); ctx.lineTo(x + W * 0.09 - H * 0.22, sy); ctx.lineTo(x - W * 0.05 - H * 0.22, sy); ctx.closePath(); ctx.fill();
      }
      // sand
      ctx.fillStyle = '#d9c79a';
      ctx.beginPath(); ctx.moveTo(0, sy + 4);
      for (let x = 0; x <= W + 24; x += 24) ctx.lineTo(x, sy + Math.sin(x * 0.03) * 3 + Math.sin(x * 0.011 + 2) * 3);
      ctx.lineTo(W + 24, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(120,96,50,.25)';
      for (let i = 0; i < 26; i++) ctx.fillRect((i * 97.3) % W, sy + 10 + ((i * 53) % Math.max(8, H - sy - 14)), 3, 1.5);

      const deco = back => {
        DECOR.forEach(d => {
          if (!owned.has(d.id) || !!d.back !== back || !img[d.id].complete || !img[d.id].naturalWidth) return;
          const w = sp * d.w, h = w * 120 / (d.vw || 120), x0 = (W - sp) / 2;
          d.at.forEach((u, i) => {
            const x = x0 + sp * u - w / 2, y = sy + (back ? -2 : 6) - h;
            ctx.globalAlpha = back ? 0.8 : 1;
            if (d.id === 'grass') { ctx.save(); ctx.translate(x + w / 2, y + h); ctx.rotate(Math.sin(t * 0.9 + i * 2) * 0.05); ctx.drawImage(img[d.id], -w / 2, -h, w, h); ctx.restore(); }
            else ctx.drawImage(img[d.id], x, y, w, h);
          });
        });
        ctx.globalAlpha = 1;
      };
      deco(true);

      // bubbles: a few everywhere, a steady stream from the bubble stone, a puff from the chest
      const x0 = (W - sp) / 2;
      if (t > nextBubble) { bubble(rnd(10, W - 10), sy - 2); nextBubble = t + rnd(0.5, 1.4); if (owned.has('bubbler')) bubble(x0 + sp * 0.52 + rnd(-5, 5), sy - sp * 0.07, rnd(2, 5)); }
      if (owned.has('bubbler') && Math.random() < dt * 5) bubble(x0 + sp * 0.52 + rnd(-6, 6), sy - sp * 0.07, rnd(1.5, 4));
      if (owned.has('chest') && t > nextBurst) { for (let i = 0; i < 9; i++) bubble(x0 + sp * 0.17 + rnd(-12, 12), sy - sp * 0.1 - rnd(0, 10)); nextBurst = t + rnd(5, 9); }

      // food sinks, then rests on the sand for a while
      food = food.filter(p => p.life > 0);
      for (const p of food) { if (p.y < sy - 3) p.y += 22 * dt; else p.life -= dt; p.x += Math.sin(t * 2 + p.ph) * 4 * dt; }

      // fish
      for (const e of fishes) {
        const w = width(e), cruise = (22 + 34 * (1 - e.rel * 2.6));
        let tx = e.tx, ty = e.ty, speed = cruise, chasing = null, best = W * 0.55;
        for (const p of food) { const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < best) { best = d; chasing = p; } }
        if (chasing) { tx = chasing.x; ty = chasing.y; speed = cruise * 2.2; e.rest = 0; }
        if (e.rest > 0) { e.rest -= dt; speed = 0; }
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
        if (chasing && d < Math.max(12, w * 0.28)) { chasing.life = 0; e.happy = 1.4; bubble(e.x, e.y - 4, 2); aim(e); }
        else if (!chasing && d < 14 && e.rest <= 0) aim(e);
        const k = Math.min(1, dt * 1.7);
        e.vx += (dx / d * speed - e.vx) * k; e.vy += (dy / d * speed * 0.6 - e.vy) * k;
        e.x += e.vx * dt; e.y += e.vy * dt + Math.sin(t * 1.4 + e.ph) * 5 * dt;
        e.y = clamp(e.y, H * 0.06, sy - 6);
        if (Math.abs(e.vx) > 3) e.turn += ((e.vx > 0 ? -1 : 1) - e.turn) * Math.min(1, dt * 7);
        if (e.happy > 0) e.happy -= dt;
      }
      const drawFish = e => {
        const w = width(e), o = e.art;
        if (!o.img.complete || !o.img.naturalWidth) return;
        const sx = Math.abs(e.turn) < 0.14 ? (e.turn < 0 ? -0.14 : 0.14) : e.turn;
        ctx.save(); ctx.translate(e.x, e.y);
        ctx.rotate(clamp(e.vy / 60, -0.35, 0.35) * (e.turn < 0 ? 1 : -1) + Math.sin(t * 5 + e.ph) * 0.025);
        ctx.scale(sx, 1); ctx.globalAlpha = 0.7 + 0.3 * e.z;
        ctx.drawImage(o.img, -w / 2, -w / 4, w, w / 2);
        ctx.restore();
        if (e.happy > 0) {
          const a = Math.min(1, e.happy), hy = e.y - w * 0.3 - (1.4 - e.happy) * 16;
          ctx.fillStyle = `rgba(255,120,150,${a})`; ctx.beginPath();
          ctx.moveTo(e.x, hy + 4); ctx.bezierCurveTo(e.x - 9, hy - 3, e.x - 4, hy - 9, e.x, hy - 4); ctx.bezierCurveTo(e.x + 4, hy - 9, e.x + 9, hy - 3, e.x, hy + 4); ctx.fill();
        }
      };
      const order = fishes.slice().sort((a, b) => a.z - b.z);
      order.filter(e => e.z < 0.45).forEach(drawFish);
      deco(false);
      order.filter(e => e.z >= 0.45).forEach(drawFish);

      ctx.fillStyle = '#c98a4a';
      for (const p of food) { ctx.globalAlpha = Math.min(1, p.life); ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      bubbles = bubbles.filter(b => b.y > -8);
      ctx.lineWidth = 1;
      for (const b of bubbles) {
        b.y -= b.vy * dt; b.x += Math.sin(t * 3 + b.ph) * 10 * dt;
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.fillStyle = 'rgba(255,255,255,.14)';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
      }
      if (label && t < label.until && fishes.includes(label.e)) {
        const e = label.e, text = (e.golden ? 'Golden ' : '') + e.fish.name;
        ctx.font = '700 13px ui-rounded, system-ui, sans-serif';
        const tw = ctx.measureText(text).width + 18, lx = clamp(e.x - tw / 2, 6, W - tw - 6), ly = Math.max(6, e.y - width(e) * 0.3 - 30);
        ctx.fillStyle = 'rgba(7,26,43,.85)';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx, ly, tw, 24, 12) : ctx.rect(lx, ly, tw, 24); ctx.fill();
        ctx.fillStyle = e.golden ? '#f6d461' : '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(text, lx + 9, ly + 12.5);
      }
    }

    canvas.addEventListener('click', ev => {
      const r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      const hit = fishes.slice().sort((a, b) => b.z - a.z).find(e => Math.abs(x - e.x) < width(e) * 0.5 && Math.abs(y - e.y) < width(e) * 0.27);
      if (hit) { label = { e: hit, until: t + 3 }; return; }
      if (y < sand() && fishes.length) for (let i = 0; i < 4; i++) food.push({ x: clamp(x + rnd(-14, 14), 6, W - 6), y: Math.max(4, y + rnd(-8, 8)), life: 7, ph: Math.random() * 6.28 });
    });
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);

    return {
      start() { if (running) return; running = true; resize(); last = performance.now(); raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); },
      setFish,
      setDecor(ids) { owned = new Set(ids); },
      peek: () => ({ fish: fishes.length, food: food.length, bubbles: bubbles.length, label: label && label.e.fish.id, pos: fishes.map(e => [Math.round(e.x), Math.round(e.y)]) })
    };
  }

  return { backdrop, Fx, Tank, DECOR, TANKS, decorSvg };
})();
