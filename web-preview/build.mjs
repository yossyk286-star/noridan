// お試し版HTMLを組み立てる: src/data の JSON と script.js を template.html に埋め込む
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const data = (f) => JSON.parse(read(`../src/data/${f}`));
const DATA = { odai: data('odai.json'), events: data('events.json'), board: data('board.json'), batsu: data('batsu.json'), bombs: data('bombs.json') };

const script = (read('script.js') + '\n' + read('views.js')).replace('/*DATA*/null', JSON.stringify(DATA));
const page = read('template.html').replace('/*SCRIPT*/', () => script);
writeFileSync(join(here, 'noridan.html'), page);
console.log('built web-preview/noridan.html');

// Web公開用（Vercel）：ちゃんとしたHTMLの頭をつけて dist/ に出す。アイコン類は web-preview/public から
if (process.argv.includes('--site')) {
  const out = join(here, '..', 'dist');
  mkdirSync(out, { recursive: true });
  const head = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#141210">
<meta name="description" content="ノリで断れない、身内ノリの飲み会ゲーム。アホお題・すごろく・罰ガチャ・時限爆弾">
<meta property="og:title" content="ノリダン">
<meta property="og:description" content="ノリで断れない、身内ノリの飲み会ゲーム">
<meta property="og:image" content="/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ノリダン">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
`;
  writeFileSync(join(out, 'index.html'), head + page.replace('<div class="frame"', '</head>\n<body>\n<div class="frame"') + '\n</body>\n</html>\n');
  const pub = join(here, 'public');
  for (const f of readdirSync(pub)) copyFileSync(join(pub, f), join(out, f));
  console.log('built dist/ (site)');
}
