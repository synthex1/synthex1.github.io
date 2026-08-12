/* Assembles public/index.html from the bundled app and inlined fonts.
   Run from the project root: npm run build:app */
import fs from 'fs';
const fonts = fs.readFileSync('src/fonts-inline.css', 'utf8');
const js = fs.readFileSync('src/bundle.js', 'utf8');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Game Theory Lab</title>
<meta name="theme-color" content="#F7F8F3">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="GT Lab">
<style>
${fonts}
html, body { margin: 0; padding: 0; background: #F7F8F3; }
</style>
</head>
<body>
<div id="root"></div>
<script>
${js}
</script>
</body>
</html>
`;
fs.writeFileSync('public/index.html', html);
console.log('wrote public/index.html,', html.length, 'bytes');
