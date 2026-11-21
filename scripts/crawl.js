// 全ゲームを自動で押して回る通し確認（Playwright）。node scripts/crawl.js [出力先] [odai,king,...]
// 環境変数 STEPS=押す回数（既定60）、MEM=2 で2人（デートモード）。JSエラー・44px未満のボタン・12px未満の字・「？」だけの行を report_*.json に出す
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const HTML = 'file://' + path.join(__dirname, '..', 'web-preview', 'noridan.html');
const OUT = process.argv[2] || path.join(require('os').tmpdir(), 'noridan-crawl');
const only = process.argv[3] ? process.argv[3].split(',') : null;
const STEPS = +(process.env.STEPS || 60);
const MODES = ["odai","king","sugoroku","memory","tilt","shake","stop","reflex","voice","rtap","yama","nyok","bpass","deko","whack","ngword","doubt","homeru","gesture","face","draw","wolf","quiz","ito","hilo","pittari","vote"];
fs.mkdirSync(OUT, { recursive: true });
const AUDIT = () => {
  const r = { small: [], tiny: [], ovf: [], hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
  const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && b.bottom > 0 && b.top < innerHeight; };
  for (const e of document.querySelectorAll('button,[data-act],input,a')) {
    if (!vis(e) || e.closest('[aria-hidden="true"]')) continue;
    const b = e.getBoundingClientRect();
    const cx=b.left+b.width/2, cy=b.top+b.height/2; const hit=(x,y)=>{ if(x<0||y<0||x>=innerWidth||y>=innerHeight) return true; const t=document.elementFromPoint(x,y); return !!t && (t===e||e.contains(t)); };
    const okW = b.width>=44 || (hit(cx-21,cy)&&hit(cx+21,cy)); const okH = b.height>=44 || (hit(cx,cy-21)&&hit(cx,cy+21));
    if (!okW || !okH) r.small.push(`${(e.getAttribute('data-act')||e.tagName)}:${(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,14)} ${b.width|0}x${b.height|0}`);
    if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible') r.ovf.push((e.innerText||'').trim().slice(0,20));
  }
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) { const t = n.textContent.trim(); if (!t) continue; const p = n.parentElement; if (!p || p.closest('[aria-hidden="true"],svg,script,style')) continue; if (!vis(p)) continue; const fs = parseFloat(getComputedStyle(p).fontSize); if (fs < 12) r.tiny.push(`${t.slice(0,12)}(${fs})`); }
  r.orphan = [];
  for (const el of document.querySelectorAll('p,b,span,small,em,h1,h2,button,dt,dd,li,strong,i')) {
    if (!vis(el) || el.closest('[aria-hidden="true"],svg')) continue;
    const tn = [...el.childNodes].filter((c) => c.nodeType === 3 && c.textContent.trim());
    if (!tn.length) continue;
    const lines = new Map();
    for (const t of tn) for (let k = 0; k < t.textContent.length; k++) { const ch = t.textContent[k]; if (/\s|\u200b/.test(ch)) continue; const rg = document.createRange(); rg.setStart(t, k); rg.setEnd(t, k + 1); const rc = rg.getClientRects()[0]; if (!rc || !rc.width) continue; const key = Math.round(rc.top / 4); if (!lines.has(key)) lines.set(key, ''); lines.set(key, lines.get(key) + ch); }
    const L = [...lines.entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    if (L.length < 2) continue;
    const last = L[L.length - 1];
    const bad = L.some((l, i) => i > 0 && /^[、。？！?!」』）ーっゃゅょ]/.test(l)) || [...last].length === 1;
    if (bad) r.orphan.push(L.join(' / ').slice(0, 80));
  }
  r.orphan = [...new Set(r.orphan)];
  r.small = [...new Set(r.small)]; r.tiny = [...new Set(r.tiny)]; r.ovf = [...new Set(r.ovf)];
  return r;
};
(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const m of (only || MODES)) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('console', (c) => { if (c.type() === 'error') errs.push('console: ' + c.text()); });
    await page.addInitScript(() => { let s = 12345; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647); });
    await page.goto(HTML);
    await page.waitForTimeout(800);
    const shots = []; const seen = new Set(); const audits = {};
    const snap = async (tag) => {
      const txt = await page.evaluate(() => document.body.innerText.replace(/\d+/g, '#').slice(0, 400));
      const key = txt;
      if (seen.has(key)) return; seen.add(key);
      const f = `${m}_${String(shots.length).padStart(2, '0')}_${tag}.png`;
      await page.screenshot({ path: path.join(OUT, f) }); shots.push(f);
      audits[f] = await page.evaluate(AUDIT);
      audits[f].text = (await page.evaluate(() => document.body.innerText)).slice(0, 600);
    };
    try {
      for (const nm of (process.env.MEM === '2' ? ['ゆう', 'あや'] : ['たろう', 'はなこ', 'じろう', 'さくら'])) { await page.fill('#inName', nm); await page.press('#inName', 'Enter'); await page.waitForTimeout(80); }
      await page.click('[data-act=step2]');
      await page.waitForTimeout(400);
      await snap('home2');
      await page.click(`[data-act=start][data-m=${m}]`, { timeout: 3000 });
      await page.waitForTimeout(600);
      await snap('start');
      for (let i = 0; i < STEPS; i++) {
        const cands = await page.evaluate(() => {
          const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && b.bottom > 0 && b.top < innerHeight && !e.disabled; };
          return [...document.querySelectorAll('[data-act],button')].filter(vis).map((e, k) => { e.setAttribute('data-crawl', k); return { k, act: e.getAttribute('data-act') || '', t: (e.innerText || '').trim().slice(0, 12) }; });
        });
        const pool = cands.filter((c) => !/^(quit|home|menu|sheet|step1|reset|endGame|toHome|back|endArm|members|again|other|share|qr|nextPick|scores|undo)$/i.test(c.act) && !/やめる|ホーム/.test(c.t));
        if (!pool.length) { await page.waitForTimeout(1500); await snap('wait'); continue; }
        const c = pool[Math.floor(Math.random() * pool.length)];
        try { await page.click(`[data-crawl="${c.k}"]`, { timeout: 1500, force: true }); } catch {}
        await page.waitForTimeout(350);
        await snap(c.act || 'btn');
      }
    } catch (e) { errs.push('crawl: ' + e.message.split('\n')[0]); }
    report[m] = { errs: [...new Set(errs)], shots, audits };
    console.log(m, shots.length, 'shots', errs.length, 'errs');
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'report_'+(only?only[0]:'all')+'.json'), JSON.stringify(report, null, 1));
  await browser.close();
})();
