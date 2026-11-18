// ===== 第4弾：動きと演出（実況ひとこと・ガチャのレア演出・手触り・選手入場・スマホを動かす・罰の瞬間カメラ・盛り上がりメーター・夜で変わる画面） =====
// アプリ版は src/lib/live.ts と src/components/Live.tsx（同じ考え方）

S.jikkyo = store.get("nd_jikkyo", true) !== false;
S.entrance = store.get("nd_entrance", true) !== false;
S.faceDeal = store.get("nd_facedeal", false) === true;
S.spinGacha = store.get("nd_spingacha", false) === true;
S.camera = store.get("nd_camera", false) === true;
S.meter = store.get("nd_meter", false) === true;
S.photos = [];
S.lv = null;
const LIVE = DATA.live;
// 黄色い四角の顔（ノリダンのキャラ）
const HOST_FACE = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="2" y="2" width="36" height="36" rx="11" fill="#ffd23f" stroke="#141210" stroke-width="2.5"/><circle cx="14" cy="18" r="3.2" fill="#141210"/><circle cx="26" cy="18" r="3.2" fill="#141210"/><path d="M12.5 26q7.5 6.5 15 0" stroke="#141210" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M9 10.5l6.5 2.8M31 10.5l-6.5 2.8" stroke="#141210" stroke-width="3" stroke-linecap="round"/></svg>`;

// ゲームが始まる時：実況・写真を数え直し、選手入場
const _newGame0 = newGame;
newGame = function (mode, again = false) {
  S.lv = { n: 0, last: -9, lead: -1, clean: new Set() };
  S.photos = [];
  spunGacha = new WeakSet();
  _newGame0(mode, again);
  if (!again) entranceFx(mode);
  if (S.meter) meterStart();
  if (S.faceDeal) tiltListenIfOk();
};

// ---------- 20 実況ひとこと ----------
const fillP = (t, i) => t.replace(/\{P\}/g, i != null && S.members[i] ? S.members[i].name : "");
// 罰ガチャが決まった時に1回だけ呼ぶ。言うことがあれば文字を返す（続けては言わへん）
function jikkyoPick(gs, streak) {
  const g = S.game, L = S.lv || (S.lv = { n: 0, last: -9, lead: -1, clean: new Set() });
  L.n++;
  const lucky = gs.every((x) => x.lucky);
  const pen = g.pen.slice();
  gs.forEach((x) => { if (!x.lucky && x.i >= 0) pen[x.i] = (pen[x.i] || 0) + (x.n || 1); });
  const max = Math.max(0, ...pen), tops = pen.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0);
  const top = max > 0 && tops.length === 1 ? tops[0] : -1;
  const prevLead = L.lead;
  if (top >= 0) L.lead = top;
  if (!S.jikkyo || L.n - L.last < 2) return null;
  const J = LIVE.jikkyo;
  let line = null;
  if (capOf(gs).fake && !lucky) line = pick(J.fake);
  else if (streak && (streak.n >= 3 || Math.random() < 0.35)) line = fillP(pick(J.streak), streak.i);
  else if (top >= 0 && prevLead >= 0 && prevLead !== top && max >= 3) line = fillP(pick(J.lead), top);
  else if (lucky && S.level === "jigoku" && Math.random() < 0.6) line = pick(J.angel);
  else if (pen.reduce((a, b) => a + b, 0) >= 6 && S.members.length >= 3) {
    const c = pen.map((v, i) => (v === 0 && !L.clean.has(i) ? i : -1)).filter((i) => i >= 0);
    if (c.length === 1) { L.clean.add(c[0]); line = fillP(pick(J.clean), c[0]); }
  }
  if (line) L.last = L.n;
  return line;
}
// 画面の下にキャラのツッコミ（3.4秒・タップで消える）
function hostSay(text) {
  if (!isStage(S.screen) || !text) return;
  document.querySelector(".host-say")?.remove();
  const el = document.createElement("button");
  el.className = "host-say";
  el.innerHTML = `<i>${HOST_FACE}</i><span>${esc(text)}</span>`;
  el.onclick = () => el.remove();
  document.body.appendChild(el);
  play("pop");
  setTimeout(() => el.classList.add("out"), 3400);
  setTimeout(() => el.remove(), 3800);
}

// ---------- 21 罰ガチャのレア演出：カプセルの色 ----------
// 白=ふつう・赤=重め（2倍・深夜・地獄）・金=ラッキーかも（たまにガセ）・虹=地獄のいちばん重い罰（めったに出ん）
const capCache = new WeakMap();
function capOf(gs) {
  if (!gs || !gs.length) return { c: "white" };
  if (capCache.has(gs)) return capCache.get(gs);
  const lucky = gs.every((x) => x.lucky), r = Math.random();
  const heavy = gs.some((x) => !x.lucky && ((x.n || 1) > 1 || x.night === "shinya")) || S.level === "jigoku";
  const v = lucky ? { c: "gold" }
    : S.level === "jigoku" && gs.some((x) => (x.n || 1) > 1 || x.night) && r < 0.25 ? { c: "rainbow" }
    : r < 0.1 ? { c: "gold", fake: true }
    : { c: heavy ? "red" : "white" };
  capCache.set(gs, v);
  return v;
}
const CAP_LABEL = { gold: "金カプセル！", rainbow: "虹カプセル！" };

// ---------- 22 手触り ----------
// ボタンを押した瞬間にコツッ（Android のみ。iPhone のブラウザは振動できへん）
document.addEventListener("pointerdown", (e) => { if (e.target.closest?.("button:not(:disabled)")) vib(8); }, { passive: true });
// 罰が出た瞬間：札が0.15秒だけ揺れる
function hitFx() {
  const c = document.getElementById("card");
  if (!c) return;
  c.classList.remove("hit"); void c.offsetWidth; c.classList.add("hit");
}
// レアのカプセルが割れる瞬間に白く光る
function rareFlash() {
  const el = document.createElement("div");
  el.className = "rareflash"; el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 500);
  vib([20, 30, 60]);
}

// ---------- 23 選手入場 ----------
function nickList() {
  const t = tallyGet(S.members), N = LIVE.nick, used = new Set();
  const any = shuffle(N.any);
  const pickU = (list) => { const l = shuffle(list).find((x) => !used.has(x)) || list[0]; used.add(l); return l; };
  const penTop = t && t.games >= 2 ? (() => { const v = S.members.map((m) => t.pen[m.name] || 0), mx = Math.max(...v); return mx > 0 && v.filter((x) => x === mx).length === 1 ? v.indexOf(mx) : -1; })() : -1;
  const luckTop = t && t.games >= 2 ? (() => { const v = S.members.map((m) => t.lucky[m.name] || 0), mx = Math.max(...v); return mx >= 2 && v.filter((x) => x === mx).length === 1 ? v.indexOf(mx) : -1; })() : -1;
  return S.members.map((m, i) => {
    if (t && t.last?.names?.includes(m.name)) return pickU(N.last);
    if (i === penTop) return pickU(N.pen).replace("{N}", t.pen[m.name]);
    if (i === luckTop) return pickU(N.lucky).replace("{N}", t.lucky[m.name]);
    if (t && t.pen[m.name] == null) return pickU(N.first);
    return any.find((x) => !used.has(x) && used.add(x)) || pick(N.any);
  });
}
function entranceFx(mode) {
  if (!S.entrance || S.members.length < 2 || S.isExample === "shot") return;
  document.getElementById("entrance")?.remove();
  const n = S.members.length, step = n > 6 ? 0.18 : 0.32, nicks = nickList();
  const el = document.createElement("button");
  el.id = "entrance"; el.className = "entrance" + (n > 6 ? " many" : "");
  el.setAttribute("aria-label", "選手入場（タップで飛ばす）");
  el.innerHTML = `<small>${esc(MODE_NAME[mode] || "")}</small><b class="en-h">選手入場</b>
    <div class="en-list">${S.members.map((m, i) => `<div class="en-row ${i % 2 ? "r" : "l"}" style="--mc:${colorOf(i)};--d:${(0.45 + i * step).toFixed(2)}s"><span class="en-av">${ini(i)}</span><span class="en-tx"><b>${esc(m.name)}</b><em>${esc(nicks[i])}</em></span></div>`).join("")}</div>
    <span class="en-skip">タップで飛ばす</span>`;
  const close = () => { if (!el.isConnected) return; el.classList.add("out"); setTimeout(() => el.remove(), 260); };
  el.onclick = close;
  document.body.appendChild(el);
  play("drumroll");
  S.members.forEach((_, i) => setTimeout(() => { if (el.isConnected) { play("tick"); vib(10); } }, (0.45 + i * step) * 1000));
  setTimeout(() => { if (el.isConnected) play("fanfare"); }, (0.55 + n * step) * 1000);
  setTimeout(close, (1.9 + n * step) * 1000);
}

// ---------- 24 スマホを動かす ----------
// (1) アホお題：伏せて置いて、起こしたらお題が出る
function tiltListenIfOk() {
  if (typeof window.DeviceOrientationEvent === "undefined") return;
  if (typeof DeviceOrientationEvent.requestPermission !== "function") { tiltSensor.perm = "granted"; tiltListen(); }
  else if (tiltSensor.perm === "granted") tiltListen();
}
function faceTick() {
  const g = S.game;
  if (S.screen !== "odai" || !g?.face || g.intro || g.handoff) return;
  const b = tiltSensor.beta, gm = tiltSensor.gamma;
  if (b == null) return;
  const down = Math.abs(b) > 140, up = Math.abs(b) < 40 && Math.abs(gm) < 40;
  if (g.face === "down" && down) { g.face = "up"; play("pop"); vib(30); render(); }
  else if (g.face === "up" && up) faceGo();
}
function faceGo() { const g = S.game; if (!g?.face) return; g.face = null; vib([20, 30, 60]); render(true); }
function vFaceDeal() {
  const g = S.game, up = g.face === "up";
  const sensor = tiltLive() || (tiltSensor.perm === "granted" && typeof DeviceOrientationEvent !== "undefined");
  const ask = !sensor && typeof window.DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
  const card = `<div class="odai mode-card center face-card ${up ? "up" : ""}" id="card">
    <p class="prog">${g.turn}枚目・${mName(g.doer)}の番</p>
    <div class="face-art" aria-hidden="true"><i class="ph down">伏せる</i>${ICON.next}<i class="ph upc">お題</i></div>
    <p class="face-h">${up ? "せーので<br>起こして！" : "スマホを伏せて<br>机に置いてな"}</p>
    <p class="hand-note">${up ? "画面を上に向けたらお題がバン！と出る" : `${mName(g.doer)}が「せーの」で起こしたら、お題が出る`}</p>
    ${ask ? `<button class="text-btn" data-act="faceAsk">動きのセンサーを使う（iPhone）</button>` : ""}
  </div>`;
  return stageWrap(card, `<button class="big" data-act="faceGo">ボタンで出す</button>`);
}
// (2) 罰ガチャを振って回す
let spunGacha = new WeakSet();
function spinWaitNow(gs) { return S.spinGacha && gs && gs.length && !spunGacha.has(gs) && !cuedGacha.has(gs) && !S.dual; }
function spinTick(x, y, z) {
  const g = S.game;
  if (!S.spinWait || !g?.gacha?.length) return;
  if (Math.hypot(x, y, z) > 13) spinGo();
}
function spinGo() {
  const g = S.game;
  if (!g?.gacha?.length || spunGacha.has(g.gacha)) return;
  spunGacha.add(g.gacha);
  S.spinWait = false;
  render(true);
}
function vSpinWait(allLucky) {
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission !== "function") { skSensor.perm = "granted"; skListen(); }
  else if (skSensor.perm === "granted") skListen();
  const who = S.game.gacha.map((x) => mName(x.i)).join("・");
  return `<div class="odai batsu spin-wait" id="card">
    <div class="head"><span>罰ガチャ</span></div>
    <div class="sw-art" aria-hidden="true">${ICON.shake}</div>
    <p class="sw-h">振って回せ！</p>
    <p class="hand-note">${who}がスマホを振る。落とさんようにしっかり持ってな</p>
    <button class="big" data-act="spinGo">押して回す</button>
  </div>`;
}

// ---------- 25 罰の瞬間カメラ ----------
const cam = { stream: null, facing: "user", t: [] };
async function camOpen(k) {
  const g = S.game, x = g?.gacha?.[k];
  if (!x || x.lucky) return;
  camClose();
  const el = document.createElement("div");
  el.id = "camBox"; el.className = "cam-box";
  el.innerHTML = `<video playsinline muted autoplay></video>
    <div class="cam-top"><small>${mName(x.i)}の罰</small><b>${esc(doubledPlain(x.html, x.n).replace(/<[^>]+>/g, ""))}</b></div>
    <b class="cam-count"></b>
    <div class="cam-bar"><button data-cam="no">撮らん</button><button class="cam-shot" data-cam="shot" aria-label="撮る"><i></i></button><button data-cam="flip">切替</button></div>`;
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cam]"); if (!b) return;
    if (b.dataset.cam === "no") camClose();
    else if (b.dataset.cam === "shot") camShoot(k);
    else { cam.facing = cam.facing === "user" ? "environment" : "user"; camStart(el); }
  });
  document.body.appendChild(el);
  if (!(await camStart(el))) { camClose(); toast("カメラが使えへんかった"); return; }
  // 3・2・1で自動で撮る
  [3, 2, 1].forEach((n, j) => cam.t.push(setTimeout(() => { const c = el.querySelector(".cam-count"); if (c) { c.textContent = n; c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); play("tick"); } }, 400 + j * 900)));
  cam.t.push(setTimeout(() => camShoot(k), 400 + 3 * 900));
}
async function camStart(el) {
  try {
    cam.stream?.getTracks().forEach((t) => t.stop());
    if (!navigator.mediaDevices?.getUserMedia) return false;
    cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cam.facing, width: { ideal: 960 } }, audio: false });
    const v = el.querySelector("video"); v.srcObject = cam.stream; v.classList.toggle("mirror", cam.facing === "user");
    await v.play().catch(() => {});
    return true;
  } catch { return false; }
}
function camShoot(k) {
  const el = document.getElementById("camBox"), g = S.game, x = g?.gacha?.[k];
  const v = el?.querySelector("video");
  if (!v || !x || !v.videoWidth) { camClose(); return; }
  const W = 480, H = Math.round((W * v.videoHeight) / v.videoWidth);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  if (cam.facing === "user") { c.translate(W, 0); c.scale(-1, 1); }
  c.drawImage(v, 0, 0, W, H);
  const url = cv.toDataURL("image/jpeg", 0.78), img = new Image(); img.src = url;
  S.photos = [...S.photos.filter((p) => p.key !== x), { key: x, i: x.i, txt: doubledPlain(x.html, x.n).replace(/<[^>]+>/g, ""), url, img }].slice(-8);
  x.photo = true;
  play("chin"); vib(40);
  el.classList.add("flash");
  setTimeout(() => { camClose(); render(); }, 260);
}
function camClose() {
  cam.t.forEach(clearTimeout); cam.t = [];
  cam.stream?.getTracks().forEach((t) => t.stop()); cam.stream = null;
  document.getElementById("camBox")?.remove();
}
function vPhotos() {
  if (!S.photos.length) return "";
  return `<h2 class="res-h2">罰の瞬間</h2><div class="polas">${S.photos.map((p, k) => `<figure class="pola" style="--r:${[-4, 3, -2, 5, -3, 2, -5, 4][k % 8]}deg"><img src="${p.url}" alt="${esc(S.members[p.i]?.name || "")}の罰の写真"><figcaption><b>${esc(S.members[p.i]?.name || "")}</b><small>${esc(p.txt)}</small></figcaption></figure>`).join("")}</div>
  <p class="note">写真はこのスマホの中だけ。シェアする前に、写ってる人に「ええ？」って聞いてな</p>`;
}
// 結果画像（1080×1920）に写真を3枚までポラロイドで並べる。y から描いて、使った高さを返す
function drawPolas(x, y, W) {
  const ps = S.photos.filter((p) => p.img?.complete && p.img.naturalWidth).slice(-3);
  if (!ps.length) return 0;
  x.fillStyle = "#ffd23f"; x.font = `48px "Dela Gothic One", sans-serif`; x.fillText("罰の瞬間", 90, y);
  const pw = 250, ph = 180, gap = (W - 180 - pw * 3) / 2;
  ps.forEach((p, k) => {
    x.save(); x.translate(90 + k * (pw + gap) + pw / 2, y + 60 + ph / 2 + 40); x.rotate([-0.06, 0.04, -0.03][k]);
    x.fillStyle = "rgba(0,0,0,.45)"; x.fillRect(-pw / 2 + 8, -ph / 2 - 20 + 12, pw, ph + 90);
    x.fillStyle = "#fff"; x.fillRect(-pw / 2, -ph / 2 - 20, pw, ph + 90);
    const iw = pw - 24, ih = ph - 10, r = Math.max(iw / p.img.naturalWidth, ih / p.img.naturalHeight);
    const sw = iw / r, sh = ih / r;
    x.drawImage(p.img, (p.img.naturalWidth - sw) / 2, (p.img.naturalHeight - sh) / 2, sw, sh, -iw / 2, -ph / 2 - 8, iw, ih);
    x.fillStyle = "#141210"; x.font = `900 30px "Zen Kaku Gothic New", sans-serif`;
    x.fillText(S.members[p.i]?.name || "", -iw / 2, ph / 2 + 30);
    x.fillStyle = "rgba(20,18,16,.6)"; x.font = `900 20px "Zen Kaku Gothic New", sans-serif`;
    const t = p.txt.length > 13 ? p.txt.slice(0, 12) + "…" : p.txt; x.fillText(t, -iw / 2, ph / 2 + 58);
    x.restore();
  });
  return ph + 200;
}

// ---------- 26 盛り上がりメーター ----------
// マイクで場の声の大きさだけを1秒ごとに見る（録音はせえへん）。静かな時間が続いたら地獄度を上げるか聞く
const meter = { stream: null, an: null, buf: null, t: null, start: 0, asked: 0, smooth: 0 };
S.mlog = [];
async function meterStart() {
  if (meter.an) { meterLoop(); return true; }
  const ctx = SFX.ctx();
  try {
    if (!navigator.mediaDevices?.getUserMedia || !ctx) throw 0;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    if (ctx.state !== "running") { try { await ctx.resume(); } catch {} }
    const an = ctx.createAnalyser(); an.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(an);
    const mute = ctx.createGain(); mute.gain.value = 0; an.connect(mute).connect(ctx.destination);
    Object.assign(meter, { stream, an, buf: new Uint8Array(an.fftSize), start: meter.start || Date.now() });
    meterLoop();
    return true;
  } catch { S.meter = false; store.set("nd_meter", false); toast("マイクが使えへんかったので、盛り上がりメーターはオフにした"); render(); return false; }
}
function meterStop() {
  clearInterval(meter.t); meter.t = null;
  try { meter.stream?.getTracks().forEach((t) => t.stop()); } catch {}
  Object.assign(meter, { stream: null, an: null, buf: null });
  document.getElementById("meterStrip")?.remove();
}
function meterLevel() {
  meter.an.getByteTimeDomainData(meter.buf);
  let sum = 0; for (const b of meter.buf) { const v = (b - 128) / 128; sum += v * v; }
  const db = 20 * Math.log10(Math.sqrt(sum / meter.buf.length) || 1e-6);
  return Math.max(0, Math.min(100, ((db + 62) / 50) * 100));
}
function meterLoop() {
  if (meter.t) return;
  let acc = [];
  meter.t = setInterval(() => {
    if (!meter.an || !S.meter) return;
    const onStage = isStage(S.screen) && S.screen !== "voice"; // 声デカの最中は数えへん
    let strip = document.getElementById("meterStrip");
    if (!onStage) { strip?.remove(); return; }
    // 細かく見て、1秒の平均にする
    acc.push(meterLevel());
    if (acc.length < 4) return;
    const v = acc.reduce((a, b) => a + b, 0) / acc.length; acc = [];
    meter.smooth = meter.smooth * 0.7 + v * 0.3;
    S.mlog.push({ t: Date.now(), v: Math.round(v), m: S.screen });
    if (S.mlog.length > 4 * 3600) S.mlog.shift();
    if (!strip) { strip = document.createElement("div"); strip.id = "meterStrip"; strip.setAttribute("aria-hidden", "true"); strip.innerHTML = "<i></i>"; document.body.appendChild(strip); }
    strip.firstChild.style.width = `${Math.max(4, meter.smooth)}%`;
    strip.dataset.hot = meter.smooth > 55 ? "1" : "";
    meterQuiet();
  }, 250);
}
// 6分以上たって、ここ5分の平均が小さかったら1回だけ聞く（次は20分あける）
function meterQuiet() {
  const now = Date.now(), last5 = S.mlog.filter((p) => now - p.t < 5 * 60e3);
  if (now - meter.start < 6 * 60e3 || now - meter.asked < 20 * 60e3 || last5.length < 200) return;
  if (S.game?.phase === "batsu" || S.inout || S.menu || document.getElementById("quietBox")) return;
  const avg = last5.reduce((a, p) => a + p.v, 0) / last5.length;
  if (avg > 24) return;
  meter.asked = now;
  const up = S.level === "yurume" ? "futsu" : S.level === "futsu" ? "jigoku" : null;
  const el = document.createElement("div");
  el.id = "quietBox"; el.className = "quiet-box";
  el.innerHTML = `<div class="qb-in"><div class="qb-host"><i>${HOST_FACE}</i><span>${esc(pick(LIVE.meter.quiet))}<small>ここ5分、声が小さめ</small></span></div>
    <b class="qb-h">${up ? `地獄度、<br>「${LV[up]}」に上げる？` : "声を出す系のゲームも<br>おすすめやで"}</b>
    <p>${up ? "それか、声を出す系のゲーム（声デカ選手権・山手線ゲーム・たけのこニョッキ）もええで" : "声デカ選手権・山手線ゲーム・たけのこニョッキは、結果発表のあとに選べる"}</p>
    <div class="qb-btns"><button data-q="no">このまま</button>${up ? `<button class="hot" data-q="up">${LV[up]}にする</button>` : ""}</div></div>`;
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-q]"); if (!b && e.target !== el) return;
    if (b?.dataset.q === "up" && up) { S.level = up; store.set("nd_level", up); play("warn"); toast(`地獄度を「${LV[up]}」にした`); render(); }
    el.remove();
  });
  document.body.appendChild(el);
  play("warn");
}
// 結果発表：今日の盛り上がりグラフ（30秒ずつの平均）といちばんの瞬間
function vMeterResult() {
  if (S.mlog.length < 60) return "";
  const B = 30e3, t0 = S.mlog[0].t, bins = [];
  S.mlog.forEach((p) => { const k = Math.floor((p.t - t0) / B); (bins[k] ||= { s: 0, n: 0, t: p.t, m: p.m }).s += p.v; bins[k].n++; });
  const pts = bins.filter(Boolean).map((b) => ({ v: b.s / b.n, t: b.t, m: b.m }));
  if (pts.length < 3) return "";
  const W = 320, H = 120, mx = Math.max(30, ...pts.map((p) => p.v));
  const xy = pts.map((p, k) => [(k / (pts.length - 1)) * W, H - (p.v / mx) * (H - 14) - 4]);
  const d = xy.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const pk = pts.reduce((a, p, k) => (p.v > pts[a].v ? k : a), 0), [px, py] = xy[pk];
  const hm = (t) => { const z = new Date(t); return `${z.getHours()}:${String(z.getMinutes()).padStart(2, "0")}`; };
  return `<h2 class="res-h2">今日の盛り上がり</h2>
  <div class="mgraph"><svg viewBox="0 -4 ${W} ${H + 8}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}L${W} ${H}L0 ${H}Z" fill="rgba(255,93,143,.22)"/><path d="${d}" fill="none" stroke="#ff5d8f" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>
  <i class="mg-pk" style="left:calc(12px + (100% - 24px) * ${(px / W).toFixed(3)});top:${(14 + ((py + 4) / (H + 8)) * 120).toFixed(1)}px"></i>
  <div class="mg-ax"><span>${hm(pts[0].t)}</span><span>${hm(pts[pts.length - 1].t)}</span></div></div>
  <div class="note-box"><b>いちばん盛り上がった瞬間</b><span>${hm(pts[pk].t)}　${esc(MODE_NAME[pts[pk].m] || "")}</span></div>`;
}

// ---------- 27 夜が深まると画面も変わる ----------
// 17〜21時「はじまり」、21〜24時「まだまだ」、0〜5時「もう深夜」。昼間はいつも通り
function todNow() {
  const h = new Date().getHours();
  const k = h >= 17 && h < 21 ? "early" : h >= 21 ? "peak" : h < 5 ? "late" : null;
  return k ? { k, ...LIVE.night[k] } : null;
}
function todHero() {
  const t = todNow();
  if (!t || t.hero === "odai") return { m: "odai", label: "迷ったらこれ" };
  const e = MODE_LIST.find((x) => x.m === t.hero);
  if (!e || (e.min && S.members.length < e.min)) return { m: "odai", label: "迷ったらこれ" };
  return { m: t.hero, label: t.k === "late" ? "深夜のおすすめ" : "今の時間のおすすめ" };
}

// ---------- 設定とボタン ----------
function vLiveSettings() {
  const tg = (act, on, t, s) => `<button class="toggle" data-act="${act}" aria-pressed="${on}"><span>${t}<small>${s}</small></span><b>${on ? "ON" : "OFF"}</b></button>`;
  return `<p class="sheet-sec">演出</p>
    ${tg("jikkyo", S.jikkyo, "実況ひとこと", "連続の罰や首位交代に、ノリダンがツッコむ")}
    ${tg("entrance", S.entrance, "選手入場", "ゲームの最初に、二つ名つきでメンバー紹介")}
    ${tg("faceDeal", S.faceDeal, "伏せて出す", "アホお題：伏せたスマホを起こしたらお題が出る")}
    ${tg("spinGacha", S.spinGacha, "振ってガチャ", "罰ガチャをスマホを振って回す（ボタンでもOK）")}
    ${tg("camera", S.camera, "罰の瞬間カメラ", "罰が出たら写真を撮れる。写真はこのスマホの中だけ")}
    ${tg("meter", S.meter, "盛り上がりメーター", "マイクで声の大きさだけ見る（録音はせえへん）")}`;
}
function liveClick(act, b, g, i) {
  const flip = (key, store_, after) => { S[key] = !S[key]; store.set(store_, S[key]); after?.(); render(); return true; };
  switch (act) {
    case "jikkyo": return flip("jikkyo", "nd_jikkyo");
    case "entrance": return flip("entrance", "nd_entrance");
    case "faceDeal": return flip("faceDeal", "nd_facedeal", () => { if (S.faceDeal) tiltAsk(); });
    case "spinGacha": return flip("spinGacha", "nd_spingacha", () => { if (S.spinGacha) skAsk(); });
    case "camera": return flip("camera", "nd_camera");
    case "meter": return flip("meter", "nd_meter", () => { if (S.meter) { meter.start = Date.now(); meterStart(); } else meterStop(); });
    case "faceGo": faceGo(); return true;
    case "faceAsk": tiltAsk().then(() => render()); return true;
    case "spinGo": spinGo(); return true;
    case "camShot": camOpen(i >= 0 ? i : +b.dataset.k); return true;
  }
  return false;
}
