import fs from 'fs';
const css = fs.readFileSync('fonts.css','utf8');
const blocks = css.match(/@font-face\s*{[^}]*}/g);
const latin = blocks.filter(b => b.includes('U+0000-00FF'));
// dedupe by (family, weight, url)
const seen = new Set(); const out = [];
for (const b of latin) {
  const url = b.match(/url\((https:[^)]+)\)/)[1];
  const fam = b.match(/font-family: '([^']+)'/)[1];
  const wt = b.match(/font-weight: ([0-9 ]+);/)[1];
  const key = fam+wt+url;
  if (seen.has(key)) continue; seen.add(key);
  out.push({b, url});
}
const cache = {};
for (const o of out) {
  if (!cache[o.url]) {
    const res = await fetch(o.url);
    const buf = Buffer.from(await res.arrayBuffer());
    cache[o.url] = 'data:font/woff2;base64,' + buf.toString('base64');
    console.log(o.url, buf.length);
  }
}
const final = out.map(o => o.b.replace(/url\(https:[^)]+\)/, `url(${cache[o.url]})`).replace(/src: [^;]+;/, m => m.replace(/ format\('woff2'\)/, " format('woff2')"))).join('\n');
fs.writeFileSync('fonts-inline.css', final);
console.log('blocks:', out.length, 'bytes:', final.length);
