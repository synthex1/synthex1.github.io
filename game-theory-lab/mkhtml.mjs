import fs from 'fs';
const fonts = fs.readFileSync('fonts-inline.css','utf8');
const js = fs.readFileSync('bundle.js','utf8');
const html = `<title>Game Theory Lab</title>
<style>
${fonts}
html, body { margin: 0; padding: 0; background: #F7F8F3; }
</style>
<div id="root"></div>
<script>
${js}
</script>
`;
fs.writeFileSync('game-theory-lab.html', html);
console.log('bytes:', html.length);
