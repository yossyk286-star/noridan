// ---------- sound (WebAudio synth, no files) ----------
const SFX = (() => {
  let ctx = null;
  const ac = () => {
    try {
      if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch { return null; }
  };
  function tone(freq, dur, type = "sine", vol = 0.2, slideTo = 0, delay = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.3, cutoff = 2000, delay = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay, len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = "lowpass"; f.frequency.value = cutoff; g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start(t);
  }
  return {
    unlock: () => ac(),
    flip: () => { noise(0.09, 0.22, 3500); tone(420, 0.07, "triangle", 0.06, 700, 0.02); },
    tick: () => tone(1500, 0.025, "square", 0.04),
    coin: () => { tone(1320, 0.07, "square", 0.06); tone(1760, 0.16, "square", 0.06, 0, 0.08); },
    pop: () => { tone(500, 0.09, "sine", 0.22, 1100); tone(900, 0.12, "sine", 0.16, 1500, 0.09); },
    alarm: () => { [0, 0.18, 0.36].forEach((d) => tone(880, 0.12, "square", 0.07, 0, d)); },
    boom: () => { noise(1.1, 0.7, 700); tone(90, 0.8, "sine", 0.55, 35); },
    warn: () => { tone(660, 0.12, "sawtooth", 0.06); tone(440, 0.18, "sawtooth", 0.06, 0, 0.12); },
    lucky: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, "sine", 0.14, 0, i * 0.07)); },
    fanfare: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.45 : 0.13, "triangle", 0.16, 0, i * 0.12)); },
  };
})();
const play = (k) => { if (S.sound) try { SFX[k](); } catch {} };

// ---------- icons ----------
const ICON = {
  cards: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="3" width="13" height="17" rx="2.5"/><path d="M3.5 7.5v11A2.5 2.5 0 0 0 6 21h9"/><path d="M10 9h5M10 13h5"/></svg>`,
  dice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M9 7h6M9 11h6"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  flip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M7 4 3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`,
  more: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  flag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>`,
  exit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h4v16h-4M10 16l4-4-4-4M14 12H4"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13v7h16v-7M12 3v12M7 8l5-5 5 5"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.5-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c1.9.7 3.1 2.5 3.5 5.4"/></svg>`,
  next: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`,
};
const BOMB_ART = `<svg class="bomb-art" viewBox="0 0 96 96" aria-hidden="true">
  <circle cx="42" cy="56" r="30" fill="#1a1a1a" stroke="#ff7a1a" stroke-width="3"/>
  <circle cx="32" cy="46" r="7" fill="#fff" opacity=".25"/>
  <rect x="50" y="20" width="14" height="12" rx="3" transform="rotate(35 57 26)" fill="#555"/>
  <path d="M60 22 C 64 14, 68 18, 70 14" fill="none" stroke="#c9a46a" stroke-width="3" stroke-linecap="round"/>
  <g class="spark"><circle cx="70" cy="14" r="6" fill="#ffd23f"/><path d="M70 2v6M70 20v6M58 14h6M76 14h6M62 6l4 4M74 18l4 4M62 22l4-4M74 10l4-4" stroke="#ff7a1a" stroke-width="2.5" stroke-linecap="round"/></g>
</svg>`;

const MOON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const SKULL = `<svg class="skull" viewBox="0 0 100 100" aria-hidden="true">
  <path d="M50 6C25 6 10 23 10 45c0 14 8 23 17 27v11c0 4 3 7 7 7h32c4 0 7-3 7-7V72c9-4 17-13 17-27C90 23 75 6 50 6z" fill="#f7f3ea" stroke="#141210" stroke-width="3"/>
  <ellipse class="eye" cx="33" cy="47" rx="11" ry="12" fill="#e8202a"/>
  <ellipse class="eye" cx="67" cy="47" rx="11" ry="12" fill="#e8202a"/>
  <path d="M50 58l-6 10h12z" fill="#141210"/>
  <path d="M40 76v14M50 76v14M60 76v14" stroke="#141210" stroke-width="3"/>
</svg>`;

const ANGEL = `<svg class="angel" viewBox="0 0 120 100" aria-hidden="true">
  <ellipse class="halo" cx="60" cy="14" rx="22" ry="6" fill="none" stroke="#ffd23f" stroke-width="5"/>
  <path d="M38 52C20 36 4 40 6 56c2 12 18 18 32 10z" fill="#fff" stroke="#9ab0ff" stroke-width="2.5"/>
  <path d="M82 52c18-16 34-12 32 4-2 12-18 18-32 10z" fill="#fff" stroke="#9ab0ff" stroke-width="2.5"/>
  <circle cx="60" cy="54" r="27" fill="#fff3d6" stroke="#141210" stroke-width="3"/>
  <path d="M46 52q5-6 10 0M64 52q5-6 10 0" fill="none" stroke="#141210" stroke-width="3" stroke-linecap="round"/>
  <path d="M50 64q10 9 20 0" fill="none" stroke="#141210" stroke-width="3" stroke-linecap="round"/>
  <circle cx="44" cy="62" r="4" fill="#ff9ab8" opacity=".7"/><circle cx="76" cy="62" r="4" fill="#ff9ab8" opacity=".7"/>
</svg>`;

// ---------- views: home ----------
const LV_SUB = { yurume: "初手はこれ", futsu: "いつもの", jigoku: "覚悟しろ" };
const dot = (i, size = "") => `<span class="dot" style="background:${colorOf(i)}">${esc(S.members[i].name.slice(0, 1))}</span>`;

function vHome() {
  if (S.nightAsk) return vNightAsk();
  return S.step === 2 ? vHome2() : vHome1();
}
function logoBlock() {
  const night = S.night === "shinya" ? "is-night is-deep" : S.night ? "is-night" : "";
  const sub = S.night === "shinya" ? "深夜モード 発動中" : S.night ? "夜モード 発動中" : "ノリで断れない飲み会ゲーム";
  return `<div><h1 class="logo ${night}" id="logo"><button class="logo-btn" data-act="logo" aria-label="ノリダン">ノリダン</button></h1><p class="catch">${sub}</p>${whisper()}</div>`;
}
// 隠しモードのヒント（ささやき）。夜モード前は「ロゴに秘密がある」、夜モード中は「まだ奥がある」
function whisper() {
  const h = new Date().getHours();
  const late = h >= 21 || h < 5;
  let t = "";
  if (S.night === "yoru") t = "まだ奥がある…ロゴをもう一回";
  else if (!S.night && late) t = "夜が更けてきた…ロゴ、連打してみ？";
  else if (!S.night && S.whisper) t = "ロゴには秘密があるらしい";
  return t ? `<p class="whisper ${S.night === "yoru" ? "deep" : ""}">${MOON}<span>${t}</span></p>` : "";
}
function vHome1() {
  const ms = S.members, ok = ms.length >= 2;
  const groups = (store.get("nd_groups", []) || []).filter((g) => g.map((m) => m.name).join() !== ms.map((m) => m.name).join());
  return `
  <div class="home-top">${logoBlock()}<button class="icon-btn" data-act="sheet" aria-label="設定">${ICON.gear}</button></div>
  <div class="step-dots"><i class="on"></i><i></i><span>メンバー</span></div>
  ${S.seen.members ? "" : `<div class="home-coach" role="note">
    <b>遊ぶメンバーを入れよう</b>
    <ol>
      <li>名前を入れて「＋」（何人でも）</li>
      <li>名前をタップで<b>イジりネタ</b>を追加。お題に混ざる</li>
      <li>2人以上で次へ</li>
    </ol>
    <button data-act="coachOk" data-k="members">わかった</button>
  </div>`}
  <div class="mem-head"><p class="step-h"><span class="num">①</span>メンバー<small>${ms.length}人</small></p>${S.isExample ? `<button class="text-btn" data-act="clearAll">例を全部消す</button>` : ""}</div>
  <form class="add1" id="addForm">
    <input id="inName" maxlength="10" placeholder="名前を入れて＋（続けて入れられる）" autocomplete="off" enterkeyhint="done">
    <button class="add-btn" type="submit" aria-label="追加">${ICON.plus}</button>
  </form>
  <section class="members" aria-label="メンバー">
    ${S.isExample ? `<p class="note">↓は例。自分らの名前に入れ替えてな</p>` : ""}
    ${ms.map((m, i) => S.editing === i ? `
      <form class="mem editing" id="netaForm" data-i="${i}">
        ${dot(i)}
        <div class="nm"><b>${esc(m.name)}</b><input id="inNeta" maxlength="20" value="${esc(m.neta || "")}" placeholder="イジりネタ（例：すぐ寝る）" autocomplete="off" enterkeyhint="done"></div>
        <button class="ok-btn" type="submit">完了</button>
      </form>` : `
      <div class="mem">
        ${dot(i)}
        <button class="nm" data-act="edit" data-i="${i}" aria-label="${esc(m.name)}のイジりネタを編集"><b>${esc(m.name)}</b><span>${m.neta ? esc(m.neta) : "タップでイジりネタを追加"}</span></button>
        ${S.night ? `<button class="ng" data-act="ng" data-i="${i}" aria-pressed="${!!m.ng}">${m.ng ? "下ネタNG" : "下ネタOK"}</button>` : "<span></span>"}
        <button class="x" data-act="del" data-i="${i}" aria-label="${esc(m.name)}を外す">${ICON.close}</button>
      </div>`).join("")}
  </section>
  ${groups.length ? `<section class="groups">
    <p class="h2">前回のメンバー</p>
    ${groups.map((g, k) => `<button class="group" data-act="loadGroup" data-i="${k}">${ICON.users}<span>${g.map((m) => esc(m.name)).join("・")}</span></button>`).join("")}
  </section>` : ""}
  <div class="dock">
    <button class="big" data-act="step2" ${ok ? "" : "disabled"}>${ok ? `この${ms.length}人で遊ぶ` : "2人以上入れてな"}</button>
  </div>`;
}

function vHome2() {
  return `
  <div class="home-top">
    <button class="icon-btn" data-act="step1" aria-label="メンバーに戻る">${ICON.back}</button>
    <div class="step-dots"><i class="on"></i><i class="on"></i><span>モード</span></div>
    <button class="icon-btn" data-act="sheet" aria-label="設定">${ICON.gear}</button>
  </div>
  <div class="mchips">${S.members.map((m, i) => `<span class="mchip">${dot(i)}${esc(m.name)}</span>`).join("")}</div>
  ${S.seen.mode ? "" : `<div class="home-coach" role="note">
    <b>地獄度と遊び方を選ぼう</b>
    <ol>
      <li>迷ったら地獄度は「普通」</li>
      <li><b>アホお題</b>：好きなとこで「⋯」→結果発表</li>
      <li><b>すごろく</b>：1番にゴールしたら終了</li>
    </ol>
    <button data-act="coachOk" data-k="mode">わかった</button>
  </div>`}
  <section style="display:flex;flex-direction:column;gap:10px">
    <p class="step-h"><span class="num">②</span>地獄度<small>お題の攻め具合</small></p>
    <div class="levels">
      ${Object.entries(LV).map(([k, v]) => `<button class="lv" data-act="lv" data-v="${k}" aria-pressed="${S.level === k}">${v}<small>${LV_SUB[k]}</small></button>`).join("")}
    </div>
  </section>
  <section style="display:flex;flex-direction:column;gap:10px">
    <p class="step-h"><span class="num">③</span>遊び方</p>
    <div class="modes">
      <button class="mode" data-act="start" data-m="odai"><i class="mode-ic">${ICON.cards}</i><b>アホお題</b><span>出たお題を順番にやるだけ</span><em class="go">開始</em></button>
      <button class="mode" data-act="start" data-m="sugoroku"><i class="mode-ic">${ICON.dice}</i><b>すごろく</b><span>サイコロで進む。1番にゴールで終了</span><em class="go">開始</em></button>
    </div>
  </section>
  ${S.night ? `<section class="night-switch">
    <p class="h2">夜の深さ</p>
    <div class="night-lv">
      <button data-act="nightPick" data-v="yoru" aria-pressed="${S.night === "yoru"}">夜<small>たまに下ネタ</small></button>
      <button data-act="nightPick" data-v="shinya" aria-pressed="${S.night === "shinya"}">深夜<small>${S.night === "shinya" ? "全部下ネタ" : "？？？"}</small></button>
    </div>
  </section>` : ""}
  <p class="note">お酒は20歳になってから。飲めへん人はソフドリでOK、無理は絶対させんこと。</p>`;
}

function vNightAsk() {
  if (S.nightAsk === "shinya") return `
  <div class="night-ask deep">
    <p class="h2">さらに奥へ…</p>
    <h1 class="night-title is-deep">深夜モード</h1>
    <p class="night-lead">お題が<b>全部</b>下ネタになる。ハグや手つなぎくらいの軽いタッチもあり（脱ぐ系はなし）。嫌なお題は罰なしでパスできる。</p>
    <ul class="night-rules">
      <li>全員20歳以上で、全員がOKしてること</li>
      <li>触られるのが嫌な人は「下ネタNG」に。NGの人には振られへん</li>
      <li>戻りたくなったらモード選択の「夜」で戻れる</li>
    </ul>
    <div class="row2"><button class="ghost" data-act="nightCancel">やめとく</button><button class="big" data-act="nightOn">全員OK</button></div>
  </div>`;
  return `
  <div class="night-ask">
    <p class="h2">隠しコマンド発動</p>
    <h1 class="night-title">夜モード</h1>
    <p class="night-lead">恋愛・下ネタ寄りのお題が混ざるモード。夜はしゃべるだけ、深夜はハグや手つなぎくらいの軽いタッチもあり（脱ぐ系はなし）。嫌なお題は罰なしでパスできる。</p>
    <ul class="night-rules">
      <li>全員20歳以上で、全員がOKしてること</li>
      <li>夜お題は「無理」を押したら罰なしでパスできる</li>
      <li>メンバーごとに「下ネタNG」にできる。NGの人には振られへん</li>
    </ul>
    <div class="row2"><button class="ghost" data-act="nightCancel">やめとく</button><button class="big" data-act="nightOn">全員OK</button></div>
  </div>`;
}

function vSheet() {
  return `
  <div class="sheet-back" data-act="sheetClose">
    <div class="sheet" role="dialog" aria-label="設定" data-stop>
      <div class="sheet-grip"></div>
      <h2>設定</h2>
      <button class="toggle" data-act="shake" aria-pressed="${S.shake}"><span>振ってルーレット<small>振ったら次のお題・サイコロへ</small></span><b>${S.shake ? "ON" : "OFF"}</b></button>
      <button class="toggle" data-act="sound" aria-pressed="${S.sound}"><span>効果音<small>めくる音・ガチャ・爆発</small></span><b>${S.sound ? "ON" : "OFF"}</b></button>
      <button class="toggle" data-act="voice" aria-pressed="${S.voice}"><span>お題の読み上げ<small>札が出たら声で読む（爆弾の中身は読まへん）</small></span><b>${S.voice ? "ON" : "OFF"}</b></button>
      <button class="toggle" data-act="dual" aria-pressed="${S.dual}"><span>向かい合わせ表示<small>机の真ん中に置いて両側から読める</small></span><b>${S.dual ? "ON" : "OFF"}</b></button>
      ${S.night ? `<div class="night-box">
        <p class="h2">夜モード</p>
        <div class="night-lv">
          <button data-act="nightLv" data-v="yoru" aria-pressed="${S.night === "yoru"}">夜<small>たまに下ネタ</small></button>
          <button data-act="nightLv" data-v="shinya" aria-pressed="${S.night === "shinya"}">深夜<small>全部下ネタ</small></button>
        </div>
        <p class="note">夜はしゃべるだけ、深夜は軽いタッチあり（脱ぐは無し）。下ネタNGの人には振られへん。夜お題は「無理」で罰なしパス。</p>
        <button class="ghost" data-act="nightOff">夜モードをやめる</button>
      </div>` : ""}
      <button class="ghost" data-act="tut">遊び方を見る</button>
      <button class="ghost" data-act="sheetClose">閉じる</button>
    </div>
  </div>`;
}

// ---------- views: tutorial ----------
const TUT = [
  {
    step: "1 / 3",
    title: "お題をやって、<br>セーフかアウトか",
    text: "スマホをテーブルの真ん中に置くか、順番に回す。画面のフチの色が<b>いまの番の人の色</b>。出たお題をやって、やり切ったら<b>セーフ</b>、逃げたりできんかったら<b>アウト</b>。",
    art: () => `<div class="tut-play">
      <div class="mini-card"><small><i class="tag">ひとり</i></small><b><mark style="--mc:var(--yuru)">たく</mark>、今日のMVPを発表しろ</b><span class="swipe-arrows"><em>← アウト</em><em>セーフ →</em></span></div>
      <div class="mini-verdict"><span class="ng">アウト<small>たくに罰</small></span><span class="ok">セーフ！<small>→ 次へ</small></span></div>
    </div>`,
  },
  {
    step: "2 / 3",
    title: "罰はガチャで決まる",
    text: "アウトの人は<b>罰ガチャ</b>で中身が決まる。ドクロなら罰、たまに出る天使なら帳消し。ドクロを引いた人は<b>リベンジ権 ↺</b>をゲットして、次の自分のお題を1回だけ誰かに押し付けられる。札を右にスワイプでセーフ、左でアウトでもOK。",
    art: () => `<div class="gacha" style="max-width:280px"><div class="gacha-item" style="--d:.1s;--mc:var(--futsu)"><div class="capsule"><i class="top"></i><i class="bot"></i></div><div class="gacha-txt"><b>まゆの罰</b><p>次の番まで語尾が「ござる」</p></div></div></div>`,
  },
  {
    step: "3 / 3",
    title: "たまに起きること",
    text: "この4つは突然やってくる。初めて出た時は画面にひとこと説明が出るから安心してな。スマホを<b>振っても</b>次に進める。",
    art: () => `<div class="tut-icons">
      <div><b>倍プッシュ</b><span>お題を見る前に賭ける。勝てば誰かに罰</span></div>
      <div><b>時限爆弾</b><span>仕掛け人だけが知るNG行動。やったら爆発で罰</span></div>
      <div><b>緊急指令</b><span>数ターン続くルール。破った人は「違反者に罰」</span></div>
      <div><b>当てはまらん</b><span>恋人おらん等のお題は、罰なしで誰かに回せる</span></div>
    </div>`,
  },
];
function vTut() {
  const t = TUT[S.tut], last = S.tut === TUT.length - 1;
  return `
  <div class="tut" role="dialog" aria-label="遊び方">
    <div class="tut-in">
      <div class="tut-top"><div class="tut-dots">${TUT.map((_, i) => `<i class="${i <= S.tut ? "on" : ""}"></i>`).join("")}</div><button class="tut-skip" data-act="tutEnd">スキップ</button></div>
      <div class="tut-art" key="${S.tut}">${t.art()}</div>
      <div class="tut-step">${t.step}</div>
      <h2>${t.title}</h2>
      <p>${t.text}</p>
      <button class="big" data-act="${last ? "tutEnd" : "tutNext"}">${last ? "はじめる" : "次へ"}</button>
    </div>
  </div>`;
}

// ---------- views: stage ----------
function vChips(head, act, list, showCount = true) {
  const g = S.game;
  return `
  <div class="pen">
    <h3>${head}</h3>
    <div class="chips">
      ${list.map((i) => {
        const on = g.add.has(i) && act === "pen";
        return `<button class="chip" style="--mc:${colorOf(i)}" data-act="${act}" data-i="${i}" aria-pressed="${on}"><span class="dot"></span>${esc(S.members[i].name)}${showCount ? `<span class="n">${g.pen[i]}</span>` : ""}${g.rev[i] ? `<span class="rv" title="リベンジ権あり">↺</span>` : ""}</button>`;
      }).join("")}
    </div>
  </div>`;
}

// 罰をつける人を選ぶタイル。押すと赤くなって「罰」のハンコ
// 罰の人を選ぶ時の聞き方（お題に合わせる）
function penQuestion() {
  const g = S.game, c = g.card || {};
  if (c.bombCond) return `${c.bombCond}人は？`;
  if (g.penOpen === c && c.solo && !needsPick(c.tpl)) return "罰をつける人は？";
  return penHead(c.tpl);
}
function vPenGrid() {
  const g = S.game;
  return `
  <div class="pen-grid-wrap">
    <p class="pen-q">${esc(penQuestion())}<span>タップで罰</span></p>
    <div class="pen-grid ${S.members.length > 6 ? "many" : ""}">
      ${S.members.map((m, i) => {
        const on = g.add.has(i);
        return `<button class="pen-tile ${i === g.doer ? "is-doer" : ""}" style="--mc:${colorOf(i)}" data-act="pen" data-i="${i}" aria-pressed="${on}">
          <span class="bar"></span>
          <span class="nm">${esc(m.name)}</span>
          <span class="meta">${i === g.doer ? `<span class="doer-lbl">いまの番</span>` : ""}${g.rev[i] ? " ↺" : ""}<em>罰${g.pen[i]}</em></span>
          ${on ? `<span class="stamp">罰</span>` : ""}
        </button>`;
      }).join("")}
    </div>
  </div>`;
}
function nextText(base) {
  const g = S.game;
  if (!g.add.size && mustPick(g.card?.tpl)) return `${penHead(g.card.tpl).replace(/は？$/, "")}を選んで`;
  if (!g.add.size) return `アウトなし → ${base}`;
  const names = [...g.add.keys()].map((i) => S.members[i].name);
  return `${names.length > 2 ? names.slice(0, 2).join("・") + ` ほか${names.length - 2}人` : names.join("・")}に罰 → ${base}`;
}

function vControls() {
  const g = S.game, all = S.members.map((_, i) => i);
  const nextLabel = g.mode === "sugoroku" ? (g.done ? "結果発表へ" : "次の人へ") : "次へ";
  switch (g.phase) {
    case "offer":
      return `<div class="choices">
        <button class="choice hot" data-act="double" data-v="1">倍プッシュ<small>成功で誰かに罰／失敗で罰2倍</small></button>
        <button class="choice" data-act="double" data-v="0">普通に見る<small>いつも通り</small></button>
      </div>`;
    case "revenge":
      return `${vChips(`${esc(S.members[g.doer].name)}のリベンジ。誰に押し付ける？`, "revTo", others(g.doer).filter((i) => !g.card.yoru || okForYoru(i)), false)}
        <button class="ghost" data-act="revCancel">やっぱやめる</button>`;
    case "push":
      return vChips("成功！罰を押し付ける相手をタップ", "pushTo", others(g.doer), false);
    case "batsu":
      return `<button class="big" data-act="accept" data-shake>${g.gacha.every((x) => x.lucky) ? "ラッキー！" : "受け入れた"} → ${nextLabel}</button>${shakeHint()}`;
    case "bombSet":
      return `<button class="big" data-act="bombPeek">${esc(S.members[g.doer].name)}が見る</button>`;
    case "bombPeek":
      return `<button class="big" data-act="bombHide">見た！隠して続ける</button>`;
    default: {
      if (g.double) {
        return `<div class="choices">
          <button class="choice hot" data-act="dWin">成功！<small>誰かに罰を押し付ける</small></button>
          <button class="choice" data-act="dLose">失敗…<small>罰2倍</small></button>
        </div>`;
      }
      const subs = [
        g.card.solo && !g.card.passed && isSituational(g.card.tpl) ? `<button data-act="notme">当てはまらん → 誰かに回す</button>` : "",
        g.card.yoru ? `<button data-act="pass">無理！罰なしでパス</button>` : "",
        g.card.solo && g.rev[g.doer] ? `<button class="revenge" data-act="revenge">↺ リベンジ権を使う</button>` : "",
      ].join("");
      // 1人用のお題は「やった／できんかった」の2択（札のスワイプでもOK）。他の人に罰をつけたい時だけ一覧を開く
      if (g.card.solo && !needsPick(g.card.tpl) && g.penOpen !== g.card) {
        return `
        ${subs ? `<div class="sub-acts">${subs}</div>` : ""}
        <div class="verdict">
          <button class="vd ng" data-act="fail"><b>アウト</b><small>${esc(S.members[g.doer].name)}に罰</small></button>
          <button class="vd ok" data-act="clear" data-shake><b>セーフ！</b><small>→ ${nextLabel}</small></button>
        </div>
        <p class="swipe-hint">${earlyTurns() ? `<span>← アウト</span>` : ""}<button class="link" data-act="penOpen">他の人に罰をつける</button>${earlyTurns() ? `<span>セーフ →</span>` : ""}</p>${shakeHint()}`;
      }
      return `
        ${subs ? `<div class="sub-acts">${subs}</div>` : ""}
        ${vPenGrid()}
        <button class="big ${g.add.size ? "has-pen" : ""}" data-act="next" ${!g.add.size && mustPick(g.card.tpl) ? "disabled" : "data-shake"}>${nextText(nextLabel)}</button>${shakeHint()}`;
    }
  }
}
// 操作のヒントは最初の3枚だけ（慣れたら消えてスッキリ）
const earlyTurns = () => (S.game?.cards ?? 0) < 3;
const shakeHint = () => (S.shake && S.motionOk && earlyTurns() ? `<p class="hint">スマホを振っても進む</p>` : "");

function cardClass(c) {
  if (c.bomb) return "bombc";
  if (c.kind?.includes("深夜")) return "deep";
  if (c.yoru) return "yoru";
  if (c.alert) return "event";
  return "";
}
function vCard() {
  const g = S.game, anim = S.anim ? (g.card?.alert ? "shake" : "in") : "";
  if (g.phase === "batsu") {
    const allLucky = g.gacha.every((x) => x.lucky);
    const mixed = !allLucky && g.gacha.some((x) => x.lucky);
    return `<div class="odai ${allLucky ? "lucky" : "batsu"} ${anim}" id="card">
      <div class="head"><span>罰ガチャ</span></div>
      ${S.dual ? `<div class="mirror-list">${g.gacha.map((x) => `<p><b>${esc(S.members[x.i].name)}${x.lucky ? "はセーフ" : "の罰"}</b>${x.html}</p>`).join("")}</div><hr class="dual-line">` : ""}
      <div class="skull-wrap">${allLucky ? `${ANGEL}<b>ラッキー！セーフ</b>` : `${SKULL}<b>罰ゲーム確定</b>`}</div>
      <div class="gacha">${g.gacha.map((x, k) => `
        <div class="gacha-item ${x.night ? "night " + x.night : ""}" style="--d:${(k * 0.35).toFixed(2)}s;--mc:${colorOf(x.i)}">
          <div class="capsule"><i class="top"></i><i class="bot"></i><i class="res ${x.lucky ? "ok" : ""}">${x.lucky ? "天" : "罰"}</i></div>
          <div class="gacha-txt"><b>${mixed ? `<span class="mark ${x.lucky ? "ok" : "ng"}">${x.lucky ? "天使" : "ドクロ"}</span>` : ""}${esc(S.members[x.i].name)}${x.lucky ? "はセーフ" : x.night === "shinya" ? "の深夜の罰" : x.night ? "の夜の罰" : "の罰"} ${x.n > 1 && !x.lucky ? `<span class="badge">×${x.n}</span>` : ""}</b><p>${x.html}</p></div>
        </div>`).join("")}</div>
    </div>`;
  }
  const c = g.card;
  const badge = g.double && g.phase === "play" ? `<span class="badge">倍プッシュ中</span>` : "";
  const art = g.phase === "bombSet" || g.phase === "bombPeek" ? BOMB_ART
    : g.phase === "offer" ? `<div class="coin-wrap"><div class="coin">倍</div></div>` : "";
  // 向かい合わせ：同じお題を上下逆さにもう1枚（仕掛け人だけが見る爆弾の中身は出さない）
  const dual = S.dual && g.phase !== "bombPeek" && g.phase !== "bombSet";
  return `<div class="odai ${cardClass(c)} ${anim}" id="card">
    <div class="head">${vWho()}<span class="meta">${plainKind(c) ? "" : `<span class="kind">${esc(c.kind)}</span>`}${cardTag(c) && g.phase === "play" ? `<i class="tag">${cardTag(c)}</i>` : ""}${badge}</span></div>
    ${c.solo && !needsPick(c.tpl) && g.phase === "play" && !g.double ? `<i class="sw-stamp ok">セーフ</i><i class="sw-stamp ng">アウト</i>` : ""}
    ${art}
    ${dual ? `<p class="txt mirror" aria-hidden="true" style="font-size:${fitSize(c.html, g.mode === "sugoroku", 0.74)}"><span>${c.html}</span></p><hr class="dual-line">` : ""}
    <p class="txt" style="font-size:${fitSize(c.html, g.mode === "sugoroku", dual ? 0.74 : 1)}"><span>${c.html}</span></p>
  </div>`;
}
// お題の長さで文字サイズを決める（短いほど大きく）
function fitSize(html, small, scale = 1) {
  const n = html.replace(/<[^>]+>/g, "").length;
  const px = n <= 12 ? 46 : n <= 20 ? 40 : n <= 30 ? 34 : n <= 42 ? 29 : n <= 56 ? 25 : 22;
  const v = (small ? px * 0.88 : px) * scale;
  return `clamp(${Math.round(v * 0.62)}px, ${(v / 3.9).toFixed(1)}vw, ${Math.round(v)}px)`;
}
function vRule() {
  const g = S.game, r = g.rule;
  const bomb = g.bomb && !g.phase.startsWith("bomb")
    ? `<div class="rule bomb"><span class="fuse" aria-hidden="true"></span><span><b>時限爆弾 作動中</b><br><span class="nowrap">仕掛け人：${esc(S.members[g.bomb.owner].name)}</span></span></div>` : "";
  // ルールが出た札そのものを見てる間は、上の枠は出さへん（同じ文が2回並ぶので）
  const same = g.card?.ruleCard && g.phase === "play";
  return bomb + (r && !same ? `<div class="rule"><b>発動中 残り${r.left}ターン</b><span>${r.html}</span><button class="rule-out" data-act="ruleOpen">違反者に罰</button></div>` : "");
}
// 誰の番か（札の上に1行でまとめる）
function vWho() {
  const g = S.game;
  const label = g.card?.bomb ? "が仕掛け人" : g.card?.passed ? "に回ってきた" : g.doer !== g.cur ? "に押し付けられた" : "の番";
  return `<span class="who" style="--mc:${colorOf(g.doer)}"><i></i><b>${esc(S.members[g.doer].name)}</b><small>${label}</small></span>`;
}
// 上のバー：左に罰スコアの顔アイコン列、右に「⋯」メニューだけ
function vBar() {
  const g = S.game;
  return `<div class="bar">
    <div class="score" aria-label="罰スコア">${S.members.map((m, i) => `
      <span class="av ${i === g.doer ? "is-turn" : ""}" style="--mc:${colorOf(i)}" title="${esc(m.name)} 罰${g.pen[i]}">
        ${esc(m.name.slice(0, 1))}${g.pen[i] ? `<b class="cnt">${g.pen[i]}</b>` : ""}${g.rev[i] ? `<i class="rv">↺</i>` : ""}
      </span>`).join("")}</div>
    <button class="icon-btn menu-btn" data-act="menu" aria-label="メニュー">${ICON.more}</button>
  </div>`;
}
function vMenu() {
  const g = S.game;
  return `
  <div class="sheet-back" data-act="menuClose">
    <div class="sheet menu" role="dialog" aria-label="メニュー" data-stop>
      <div class="sheet-grip"></div>
      <p class="menu-meta">${g.mode === "odai" ? "アホお題" : "すごろく"}・${LV[S.level]}・${g.turn}ターン</p>
      <button class="menu-item" data-act="flip">${ICON.flip}<span>上下反転<small>向かいの人に見せる</small></span><b>${S.flip ? "ON" : "OFF"}</b></button>
      <button class="menu-item" data-act="rules">${ICON.book}<span>ルール早見表<small>倍プッシュ・時限爆弾・リベンジ権…</small></span></button>
      <button class="menu-item" data-act="end">${ICON.flag}<span>結果発表<small>ここで終わって戦犯を発表</small></span></button>
      <button class="menu-item" data-act="sheet">${ICON.gear}<span>設定<small>振る・効果音・遊び方</small></span></button>
      <button class="menu-item danger" data-act="home">${ICON.exit}<span>ゲームをやめる<small>罰の記録は消える</small></span></button>
      <button class="ghost" data-act="menuClose">閉じる</button>
    </div>
  </div>`;
}
// ---------- 分かりやすさ ----------
// 普通のお題は種類名を出さへん（地獄度は画面の色で分かる）。夜・緊急・押し付けなどの時だけ出す
function plainKind(c) {
  return !!c.kind && !c.kind.includes("（") && /^(\d+マス目・)?(アホお題|イジりお題|全員参加)/.test(c.kind);
}
// 札の種類タグ（誰が動くお題か）
function cardTag(c) {
  if (!c || c.bomb || !c.tpl) return "";
  if (c.ruleCard) return "ルール";
  if (c.alert) return "緊急";
  if (mustPick(c.tpl)) return "勝負";
  if (!c.solo) return "全員";
  return needsPick(c.tpl) ? "みんなで判定" : "ひとり";
}
// 初めて出てきた仕組みだけ、札の下にひとこと説明（1回見たら二度と出えへん）
const COACH = {
  double: "倍プッシュ：成功で誰かに罰、失敗で罰2倍",
  bomb: "時限爆弾：仕掛け人だけNG行動を知ってる。爆発したら、やった人全員が罰",
  rule: "ルールは数ターン続く。破った人は「違反者に罰」",
  event: "緊急指令：アウトの人を下から選ぶ",
  contest: "負けた人を下から選んでから次へ",
  swipe: "やったらセーフ、逃げたらアウト。スワイプでもOK",
  notme: "当てはまらん時は、罰なしで誰かに回せる",
  pass: "夜お題は「無理！」で罰なしパスできる",
  revenge: "リベンジ権 ↺：このお題を1回だけ誰かに押し付けられる",
};
function coachKey() {
  const g = S.game, c = g.card || {};
  const keys = [];
  if (g.phase === "offer") keys.push("double");
  if (g.phase === "bombSet") keys.push("bomb");
  if (g.phase === "play" && !g.double) {
    if (c.ruleCard) keys.push("rule");
    else if (c.alert && !c.bomb) keys.push("event");
    if (mustPick(c.tpl)) keys.push("contest");
    if (c.solo && !needsPick(c.tpl) && g.penOpen !== c) keys.push("swipe");
    if (c.solo && !c.passed && isSituational(c.tpl)) keys.push("notme");
    if (c.yoru) keys.push("pass");
    if (c.solo && g.rev[g.doer]) keys.push("revenge");
  }
  return keys.find((k) => !S.seen[k]) || null;
}
function vCoach() {
  const k = coachKey();
  if (!k) return "";
  return `<div class="coach" role="note"><span>${esc(COACH[k])}</span><button data-act="coachOk" data-k="${k}">わかった</button></div>`;
}
// ルール早見表（⋯メニューから）
function vRules() {
  const items = [
    ["セーフ／アウト", "やり切ったらセーフ、逃げたりできんかったらアウト。札を右・左にスワイプでもOK"],
    ["罰ガチャ", "アウトの人は罰ガチャで中身が決まる。だいたい7回に1回は天使が出て帳消し"],
    ["リベンジ権 ↺", "ドクロを引いた人がもらえる。次の自分のお題を1回だけ誰かに押し付けられる"],
    ["倍プッシュ", "たまに来る。お題を見る前に賭けて、成功したら誰かに罰、失敗したら罰2倍"],
    ["緊急指令", "急に割り込むお題。数ターン続くルールは、破った人に「違反者に罰」でいつでも罰"],
    ["時限爆弾", "仕掛け人だけがNG行動を知る。数ターン後に爆発して、やってた奴は全員罰"],
    ["当てはまらん", "恋人おらん等でお題が当てはまらん時は、罰なしで誰かに回せる（1枚1回）"],
    ["本日の戦犯", "最後に罰が一番多い人を発表。称号もつく"],
  ];
  if (S.night) items.push(["夜モード", "夜お題は「無理！」で罰なしパス。下ネタNGの人には振られへん。罰も夜仕様になる"]);
  return `
  <div class="sheet-back" data-act="rulesClose">
    <div class="sheet rules-sheet" role="dialog" aria-label="ルール早見表" data-stop>
      <div class="sheet-grip"></div>
      <h2>ルール早見表</h2>
      <dl class="rules">${items.map(([h, t]) => `<div><dt>${h}</dt><dd>${t}</dd></div>`).join("")}</dl>
      <button class="ghost" data-act="rulesClose">閉じる</button>
    </div>
  </div>`;
}
// 結果発表の罰の内訳
const WHY = { out: "アウト", rule: "違反", double: "倍プッシュ失敗", push: "押し付けられ", bomb: "爆弾" };
function whyText(i) {
  const w = S.game.st?.why?.[i];
  if (!w) return "";
  return Object.entries(WHY).filter(([k]) => w[k]).map(([k, l]) => `${l}${w[k]}`).join("・");
}
// ルール違反：いつでも誰かに罰をつけられるシート（その場で罰ガチャ）
function vRuleSheet() {
  const g = S.game, r = S.ruleSheet;
  if (r === "pick") return `
  <div class="sheet-back" data-act="ruleClose">
    <div class="sheet rule-sheet" role="dialog" aria-label="ルール違反" data-stop>
      <div class="sheet-grip"></div>
      <p class="h2">ルール違反</p>
      <p class="rule-now">${g.rule ? g.rule.html : ""}</p>
      <h2>破ったのは誰？</h2>
      <div class="chips">${S.members.map((m, i) => `<button class="chip" style="--mc:${colorOf(i)}" data-act="ruleTo" data-i="${i}"><span class="dot"></span>${esc(m.name)}</button>`).join("")}</div>
      <button class="ghost" data-act="ruleClose">やっぱやめる</button>
    </div>
  </div>`;
  return `
  <div class="sheet-back" data-act="ruleClose">
    <div class="sheet rule-sheet ${r.lucky ? "lucky" : "out"}" role="dialog" aria-label="ルール違反の罰" data-stop>
      <div class="skull-wrap">${r.lucky ? `${ANGEL}<b>天使が出た！セーフ</b>` : `${SKULL}<b>${esc(S.members[r.i].name)}、ルール違反</b>`}</div>
      <p class="rule-pen">${r.html}</p>
      <button class="big" data-act="ruleClose">${r.lucky ? "ラッキー！" : "受け入れた"}</button>
    </div>
  </div>`;
}
const nextIdx = () => (S.game.cur + 1) % S.members.length;
function vNextUp() {
  const n = nextIdx();
  return `<p class="next-up">次の番 ${ICON.next}<span class="av sm" style="--mc:${colorOf(n)}">${esc(S.members[n].name.slice(0, 1))}</span>${esc(S.members[n].name)}</p>`;
}

function vOdai() {
  const g = S.game;
  return `<div id="stage" class="${S.flip ? "flipped" : ""}">
    ${vBar()}
    ${vRule()}
    <div class="deck">${vCard()}</div>
    ${vCoach()}
    ${vControls()}
  </div>`;
}

// ---------- すごろく盤 ----------
const COLS = 6;
const ROWS = Math.ceil(DATA.board.length / COLS);
// ヘビ型：偶数行は左→右、奇数行は右→左
const cellXY = (i) => { const r = Math.floor(i / COLS), c = r % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS); return { r, c }; };
const pct = (i) => { const { r, c } = cellXY(i); return { x: ((c + 0.5) / COLS) * 100, y: ((r + 0.5) / ROWS) * 100 }; };
function cellFace(c) {
  switch (c.type) {
    case "start": return { cls: "c-start", g: "START" };
    case "goal": return { cls: "c-goal", g: "GOAL" };
    case "odai": return { cls: "c-odai", g: "お題" };
    case "move": return { cls: c.value > 0 ? "c-plus" : "c-minus", g: (c.value > 0 ? "+" : "−") + Math.abs(c.value) };
    case "skip": return { cls: "c-skip", g: "休" };
    case "swap": return { cls: "c-swap", g: "⇄" };
    case "event": return { cls: "c-event", g: "！" };
    default: return { cls: "c-text", g: c.short || c.label };
  }
}
function tokenStyle(i) {
  const g = S.game, p = g.vpos[i];
  const same = g.vpos.map((q, k) => (q === p ? k : -1)).filter((k) => k >= 0);
  const k = same.indexOf(i), n = same.length;
  // STARTはコマを下に横並び（「START」の字が隠れんように）。それ以外は重なったら少しずらす
  const off = p === 0 ? [(k - (n - 1) / 2) * Math.min(14, 44 / Math.max(1, n - 1)), 18]
    : n === 1 ? [0, 0] : [((k % 2) - 0.5) * 18, (Math.floor(k / 2) - (n > 2 ? 0.5 : 0)) * 18];
  const { x, y } = pct(p);
  return `left:calc(${x}% + ${off[0]}px);top:calc(${y}% + ${off[1]}px);--mc:${colorOf(i)}${p === 0 ? ";--s:.62" : ""}`;
}
function vBoard() {
  const g = S.game;
  const pts = DATA.board.map((_, i) => { const { x, y } = pct(i); return `${x * 6},${y * ROWS}`; }).join(" ");
  return `<div class="sg-board" id="board" style="aspect-ratio:${COLS}/${ROWS};--rows:${ROWS}" aria-label="すごろく盤">
    <svg class="sg-path" viewBox="0 0 600 ${ROWS * 100}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>
    ${DATA.board.map((c, i) => {
      const { r, c: col } = cellXY(i), f = cellFace(c);
      return `<div class="sg-cell ${f.cls}" style="left:${(col / COLS) * 100}%;top:${(r / ROWS) * 100}%;width:${100 / COLS}%;height:${100 / ROWS}%" title="${esc(c.label || "お題")}">
        <div class="in"><span class="no">${c.type === "start" || c.type === "goal" ? "" : i}</span><b>${esc(f.g)}</b></div></div>`;
    }).join("")}
    ${S.members.map((m, i) => `<div class="sg-tok ${i === g.cur ? "is-cur" : ""}" id="tok${i}" style="${tokenStyle(i)}">${esc(m.name.slice(0, 1))}</div>`).join("")}
  </div>`;
}
// コマだけ動かす（DOMを作り直さないのでスッと動く）
function paintBoard() {
  S.members.forEach((_, i) => {
    const el = document.getElementById("tok" + i);
    if (!el) return;
    el.setAttribute("style", tokenStyle(i));
    if (i === S.game.cur) { el.classList.remove("hop"); void el.offsetWidth; el.classList.add("hop"); }
  });
  const r = document.getElementById("ranks");
  if (r) r.outerHTML = vRanks();
}
function vRanks() {
  const g = S.game;
  const order = S.members.map((m, i) => ({ m, i, p: g.vpos[i] })).sort((a, b) => b.p - a.p);
  return `<div class="sg-ranks ${S.members.length > 6 ? "many" : ""}" id="ranks">${order.map((o) => `
    <div class="sg-rank ${o.i === g.cur ? "is-cur" : ""}" style="--mc:${colorOf(o.i)}">
      <span class="nm">${esc(o.m.name)}${g.skip[o.i] ? "<small>休</small>" : ""}</span>
      <span class="bar"><i style="width:${(o.p / GOAL) * 100}%"></i></span>
      <span class="ps">${o.p === GOAL ? "GOAL" : o.p}</span>
    </div>`).join("")}</div>`;
}
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const dieFace = (n) => (n ? Array.from({ length: 9 }, (_, k) => `<i class="${PIPS[n].includes(k) ? "on" : ""}"></i>`).join("") : `<em>?</em>`);
function vSugo() {
  const g = S.game;
  const busy = g.rolling || g.hopping;
  const sheet = g.rolled && !g.hopping;
  const label = g.rolling ? "コロコロ…" : g.hopping ? `${g.die}マス進む！` : g.skip[g.cur] ? "1回休み（タップで確認）" : "タップで振る";
  return `<div id="stage" class="sugo2 ${S.flip ? "flipped" : ""}">
    ${vBar()}
    ${vRule()}
    ${vBoard()}
    ${vRanks()}
    <div class="dice-dock">
      <button class="die3d ${g.rolling ? "roll" : ""}" id="die" data-act="roll" data-shake ${busy || g.rolled ? "disabled" : ""} aria-label="サイコロを振る">${dieFace(g.die)}</button>
      <div class="dice-txt"><span class="who" style="--mc:${colorOf(g.cur)}"><i></i><b>${esc(S.members[g.cur].name)}</b><small>の番</small></span><b>${label}</b>${!busy && !g.rolled ? shakeHint().replace('class="hint"', 'class="hint" style="margin:0;text-align:left"') : ""}</div>
    </div>
  </div>
  ${sheet ? `<div class="sg-sheet-back"></div><div class="sg-sheet ${S.flip ? "flipped" : ""}">
    <div class="deck">${vCard()}</div>
    ${vCoach()}
    ${vControls()}
  </div>` : ""}`;
}

function vResult() {
  const g = S.game;
  const rows = S.members.map((m, i) => ({ m, i, n: g.pen[i] })).sort((a, b) => b.n - a.n);
  const top = rows[0];
  const tie = rows.filter((r) => r.n === top.n);
  const who = top.n === 0 ? "該当者なし" : tie.map((r) => r.m.name).join("・");
  return `<div class="result">
  <h1 class="res-head">本日の戦犯</h1>
  <p class="res-sub">${g.mode === "odai" ? "アホお題" : "すごろく"}・${LV[S.level]}・${g.turn || "-"}ターン</p>
  <div class="mvp"><small>MVP（悪い意味で）</small><b>${esc(who)}</b><span>${top.n === 0 ? "全員セーフ。平和すぎる" : `罰 ${top.n}回`}</span></div>
  ${(() => { const ts = titles(); return ts.length ? `<h2 class="res-h2">称号</h2><ul class="titles">${ts.map((t, k) => `<li style="--d:${(0.3 + k * 0.12).toFixed(2)}s"><small>${esc(t.title)}</small><b>${esc(titleNames(t))}</b><span>${esc(t.desc)}</span></li>`).join("")}</ul>` : ""; })()}
  <h2 class="res-h2">罰ランキング</h2>
  <ol class="rank">${rows.map((r, k) => `<li><span class="no">${k + 1}</span><i class="pc" style="background:${colorOf(r.i)}"></i><span class="nm">${esc(r.m.name)}${whyText(r.i) ? `<small>${esc(whyText(r.i))}</small>` : ""}</span><span class="ct">${r.n}</span></li>`).join("")}</ol>
  <p class="tip">${MOON}<span>${esc(resultTip())}</span></p>
  <button class="share-btn" data-act="share">${ICON.share}<span>画像で保存・シェア</span></button>
  ${S.shareMsg ? `<p class="note" role="status">${esc(S.shareMsg)}</p>` : ""}
  <div class="row2"><button class="ghost" data-act="home">メンバー変更</button><button class="big" data-act="again">もう一回</button></div>
  </div>`;
}

// 結果画面のひとこと。夜モードに入ってない人には噂として隠しモードをにおわせる
const TIPS = ["罰ガチャの天使はだいたい7回に1回", "リベンジ権は罰を食らった人だけのご褒美", "倍プッシュは勝てば誰かに罰、負けたら罰2倍", "スマホを振っても次のお題に進める", "設定の「向かい合わせ表示」で机の真ん中に置ける"];
let tipCache = null;
function resultTip() {
  if (tipCache && tipCache.key === S.game) return tipCache.t;
  let t;
  if (!S.night && Math.random() < 0.6) t = "噂：ロゴを3回連打すると、何かが起きるらしい";
  else if (S.night === "yoru" && Math.random() < 0.6) t = "噂：夜の、さらに奥があるらしい";
  else t = "豆知識：" + pick(TIPS);
  tipCache = { key: S.game, t };
  return t;
}
// 結果を1枚の画像にする（インスタのストーリーに貼れる縦長）
function resultImage() {
  const g = S.game, W = 1080, H = 1920;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  const disp = '"Dela Gothic One", "Hiragino Sans", "Yu Gothic", sans-serif';
  const body = '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic", sans-serif';
  x.fillStyle = "#141210"; x.fillRect(0, 0, W, H);
  // 斜めのストライプ
  x.save(); x.globalAlpha = 0.06; x.fillStyle = "#ffd23f";
  for (let k = -H; k < W + H; k += 120) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 60, 0); x.lineTo(k + 60 - H, H); x.lineTo(k - H, H); x.fill(); }
  x.restore();
  x.fillStyle = "#ffd23f"; x.font = `110px ${disp}`; x.fillText("ノリダン", 90, 200);
  x.fillStyle = "#8d857a"; x.font = `900 40px ${body}`;
  x.fillText(`${g.mode === "odai" ? "アホお題" : "すごろく"}・${LV[S.level]}・${g.turn}ターン`, 90, 270);
  x.fillStyle = "#ff2a2a"; x.font = `150px ${disp}`; x.fillText("本日の戦犯", 90, 470);
  const rows = S.members.map((m, i) => ({ m, i, n: g.pen[i] })).sort((a, b) => b.n - a.n);
  const top = rows[0], who = top.n === 0 ? "該当者なし" : rows.filter((r) => r.n === top.n).map((r) => r.m.name).join("・");
  // MVPカード
  x.fillStyle = "rgba(0,0,0,.4)"; roundRect(x, 90, 560, W - 180, 380, 40); x.fill();
  x.fillStyle = "#ffd23f"; roundRect(x, 90, 540, W - 180, 380, 40); x.fill();
  x.fillStyle = "#141210"; x.font = `900 40px ${body}`; x.fillText("MVP（悪い意味で）", 150, 630);
  let size = 130; x.font = `${size}px ${disp}`;
  while (x.measureText(who).width > W - 300 && size > 60) { size -= 6; x.font = `${size}px ${disp}`; }
  x.fillText(who, 150, 790);
  x.font = `900 48px ${body}`; x.fillText(top.n === 0 ? "全員セーフ。平和すぎる" : `罰 ${top.n}回`, 150, 870);
  // ランキング（称号がある時は詰める）
  const ts = titles().slice(0, 4);
  const step = ts.length ? 76 : 100;
  let y = 1040;
  rows.slice(0, ts.length ? 6 : 8).forEach((r, k) => {
    x.fillStyle = "#8d857a"; x.font = `900 46px ${body}`; x.fillText(String(k + 1), 110, y);
    x.fillStyle = colorOf(r.i); x.beginPath(); x.arc(205, y - 16, 22, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#f7f3ea"; x.font = `900 54px ${body}`; x.fillText(r.m.name, 260, y);
    x.font = `60px ${disp}`; const s = String(r.n); x.fillText(s, W - 110 - x.measureText(s).width, y);
    x.fillStyle = "rgba(247,243,234,.15)"; x.fillRect(110, y + 26, W - 220, 3);
    y += step;
  });
  // 称号
  if (ts.length) {
    y += 40;
    x.fillStyle = "#ffd23f"; x.font = `56px ${disp}`; x.fillText("称号", 90, y);
    y += 30;
    ts.forEach((t, k) => {
      const cx = 90 + (k % 2) * ((W - 200) / 2 + 20), cy = y + Math.floor(k / 2) * 150;
      const w = (W - 200) / 2;
      x.fillStyle = "rgba(247,243,234,.08)"; roundRect(x, cx, cy, w, 130, 24); x.fill();
      x.fillStyle = "#ffd23f"; x.font = `900 32px ${body}`; x.fillText(t.title, cx + 28, cy + 50);
      let fs = 48; x.font = `900 ${fs}px ${body}`;
      const nmz = titleNames(t);
      while (x.measureText(nmz).width > w - 56 && fs > 26) { fs -= 4; x.font = `900 ${fs}px ${body}`; }
      x.fillStyle = "#f7f3ea"; x.fillText(nmz, cx + 28, cy + 108);
    });
  }
  x.fillStyle = "#8d857a"; x.font = `900 36px ${body}`;
  x.fillText("ノリで断れない飲み会ゲーム", 90, H - 60);
  return new Promise((res) => cv.toBlob(res, "image/png"));
}
function roundRect(x, l, t, w, h, r) {
  x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
}
async function shareResult() {
  const blob = await resultImage();
  const name = `noridan-${new Date().toISOString().slice(0, 10)}.png`;
  const say = (m) => { S.shareMsg = m; render(); };
  try {
    const dl = window.claude?.use ? await window.claude.use("downloads") : null;
    if (dl) { await dl.save({ filename: name, data: blob }); say("保存したで。ストーリーに貼ってな"); return; }
  } catch (e) { if (e?.code === "declined") return; }
  try {
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "本日の戦犯" }); return; }
  } catch { return; }
  // 共有できへんブラウザ（パソコン等）は画像をダウンロード
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    say("画像を保存したで"); return;
  } catch {}
  say("この画面では保存できへんかった。スクショで撮ってな");
}

// ---------- render ----------
const app = document.getElementById("app");
const overlay = document.getElementById("overlay");
let lastSoundKey = "";
function render(anim) {
  const sc = S.screen;
  const onStage = sc === "odai" || sc === "sugoroku";
  document.body.dataset.level = S.level;
  document.body.classList.toggle("stage", onStage);
  if (onStage) document.body.style.setProperty("--pc", colorOf(S.game.doer));
  // 夜お題の間だけ照明が落ちてネオン看板に。ホームも夜モード中はネオン
  const c = onStage ? S.game.card : null;
  const neon = !!(c && c.yoru && S.game.phase !== "batsu");
  document.body.classList.toggle("neon", neon);
  // 画面の外側（下のホームバーの所など）も同じ色にして、黒い帯が出んようにする
  document.documentElement.style.backgroundColor = getComputedStyle(document.body).getPropertyValue("--bg").trim() || "";
  document.body.classList.toggle("night-home", sc === "home" && !!(S.night || S.nightAsk));
  document.body.classList.toggle("deep", (neon && c.kind?.includes("深夜")) || (sc === "home" && (S.nightAsk ? S.nightAsk === "shinya" : S.night === "shinya")));
  S.anim = !!anim;
  // 画面が変わった時だけスライドして入ってくる
  const key = sc === "home" ? (S.nightAsk ? "night" : "home" + S.step) : sc;
  const ORDER = { home1: 0, night: 1, home2: 1, odai: 2, sugoroku: 2, result: 3 };
  const moved = S.navKey && S.navKey !== key;
  const dir = moved && ORDER[key] < ORDER[S.navKey] ? "back" : "fwd";
  S.navKey = key;
  app.innerHTML = sc === "home" ? vHome() : sc === "odai" ? vOdai() : sc === "sugoroku" ? vSugo() : vResult();
  if (moved) { app.classList.remove("enter-fwd", "enter-back"); void app.offsetWidth; app.classList.add("enter-" + dir); window.scrollTo(0, 0); }
  overlay.innerHTML = S.tut !== null ? vTut() : S.sheet ? vSheet() : S.menu ? vMenu() : S.ruleSheet && onStage ? vRuleSheet() : S.rules ? vRules() : "";
  if (onStage) { fixHeight(); fitCard(); }
  if (anim) { window.scrollTo(0, 0); cue(); speakNow(); }
  if (!onStage && sc !== "result") stopSpeak();
  syncWake();
  const f = document.getElementById("addForm");
  if (f) f.addEventListener("submit", onAdd);
  const nf = document.getElementById("netaForm");
  if (nf) { nf.addEventListener("submit", onNeta); const ni = document.getElementById("inNeta"); ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); }
}
// 画面が変わった時の効果音と演出
function cue() {
  const sc = S.screen;
  if (sc === "result") { play("fanfare"); return; }
  if (sc !== "odai" && sc !== "sugoroku") return;
  const g = S.game, c = g.card || {};
  if (sc === "sugoroku" && !g.rolled) return; // サイコロ待ちの時は鳴らさない
  if (g.phase === "batsu") play(g.gacha.every((x) => x.lucky) ? "lucky" : "pop");
  else if (c.kind?.includes("ドカン")) { play("boom"); boomFlash(); }
  else if (g.phase === "bombSet") play("alarm");
  else if (g.phase === "offer") play("coin");
  else if (c.alert) play("warn");
  else play("flip");
}
// 1画面に固定してるので、お題が札からはみ出す時は文字を小さくして収める
function fitCard() {
  document.querySelectorAll("#card .txt").forEach((t) => {
    let px = parseFloat(getComputedStyle(t).fontSize);
    let guard = 0;
    while (t.scrollHeight > t.clientHeight + 1 && px > 13 && guard++ < 30) { px -= 1.5; t.style.fontSize = px + "px"; }
  });
}
window.addEventListener("resize", () => { if (document.body.classList.contains("stage")) { document.querySelectorAll("#card .txt").forEach((t) => (t.style.fontSize = "")); render(); } });
// 札が変わった時に声で読む
function speakNow() {
  if (!S.voice) return;
  if (S.screen === "result") {
    const g = S.game, m = Math.max(...g.pen);
    speak(m === 0 ? "本日の戦犯は、該当者なし。平和すぎる" : `本日の戦犯は、${S.members.filter((_, i) => g.pen[i] === m).map((x) => x.name).join("と")}。罰${m}回`);
  } else if (S.screen === "odai" || S.screen === "sugoroku") speak(cardSpeech());
}
function boomFlash() {
  const el = document.createElement("div");
  el.className = "flash";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
  if (navigator.vibrate) navigator.vibrate([80, 40, 160]);
}
function paintDie() { const d = document.getElementById("die"); if (d) d.innerHTML = dieFace(S.game.die); play("tick"); }

function saveMembers() { S.isExample = false; store.set("nd_members", S.members); }
function onAdd(e) {
  e.preventDefault();
  const name = document.getElementById("inName").value.trim();
  if (!name) return;
  if (S.isExample) S.members = [];
  if (S.members.length >= 12) return;
  S.members.push({ name, neta: "" });
  saveMembers(); play("tick"); render();
  document.getElementById("inName").focus();
}
function onNeta(e) {
  e.preventDefault();
  const i = +e.target.dataset.i;
  S.members[i].neta = document.getElementById("inNeta").value.trim();
  S.editing = null; saveMembers(); render();
}
// ゲームを始めた時のメンバーを「前回のメンバー」として3組まで覚えておく
function rememberGroup() {
  if (S.isExample) return;
  const key = S.members.map((m) => m.name).join();
  const gs = (store.get("nd_groups", []) || []).filter((g) => g.map((m) => m.name).join() !== key);
  gs.unshift(S.members.map((m) => ({ ...m })));
  store.set("nd_groups", gs.slice(0, 3));
}

function onClick(e) {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  // シートの中身をタップしても閉じないように
  if ((b.dataset.act === "sheetClose" || b.dataset.act === "menuClose") && b.classList.contains("sheet-back") && e.target.closest("[data-stop]")) return;
  SFX.unlock();
  if (navigator.vibrate && b.tagName === "BUTTON") navigator.vibrate(6); // 押した手応え（Androidのみ）
  const act = b.dataset.act, g = S.game, i = +b.dataset.i;
  switch (act) {
    // home
    case "del": S.members.splice(i, 1); saveMembers(); render(); break;
    case "lv": S.level = b.dataset.v; store.set("nd_level", S.level); render(); break;
    case "step1": S.step = 1; render(); break;
    case "step2": S.step = 2; render(); window.scrollTo(0, 0); break;
    case "start": rememberGroup(); newGame(b.dataset.m); break;
    case "home": S.menu = false; S.screen = "home"; S.step = 2; render(); break;
    case "again": S.shareMsg = ""; newGame(g.mode); break;
    case "end": S.menu = false; applyAdds(); S.shareMsg = ""; S.screen = "result"; render(true); break;
    case "menu": S.menu = true; render(); break;
    case "menuClose": S.menu = false; render(); break;
    case "share": shareResult(); break;
    case "edit": S.editing = i; render(); break;
    case "clearAll": S.members = []; saveMembers(); render(); document.getElementById("inName")?.focus(); break;
    case "loadGroup": {
      const gs = (store.get("nd_groups", []) || []).filter((x) => x.map((m) => m.name).join() !== S.members.map((m) => m.name).join());
      if (gs[i]) { S.members = gs[i].map((m) => ({ ...m })); saveMembers(); render(); }
      break;
    }

    // settings / tutorial
    case "sheet": S.menu = false; S.sheet = true; render(); break;
    case "sheetClose": S.sheet = false; render(); break;
    case "shake": S.shake = !S.shake; store.set("nd_shake", S.shake); render(); break;
    case "sound": S.sound = !S.sound; store.set("nd_sound", S.sound); render(); if (S.sound) play("pop"); break;
    case "voice": S.voice = !S.voice; store.set("nd_voice", S.voice); render(); if (S.voice) speak("読み上げオン"); else stopSpeak(); break;
    case "dual": S.dual = !S.dual; store.set("nd_dual", S.dual); render(); break;
    case "tut": S.sheet = false; S.tut = 0; render(); break;
    case "tutNext": S.tut++; render(); break;
    case "tutEnd": S.tut = null; store.set("nd_tut", true); render(); break;
    case "flip": S.flip = !S.flip; S.menu = false; render(); break;

    // play
    case "pen": {
      g.add.has(i) ? g.add.delete(i) : g.add.set(i, 1);
      play(g.add.has(i) ? "warn" : "tick");
      if (navigator.vibrate && g.add.has(i)) navigator.vibrate(30);
      const y = window.scrollY;
      render(); window.scrollTo(0, y);
      break;
    }
    case "next": finishCard(); break;
    case "coachOk": S.seen[b.dataset.k] = 1; store.set("nd_seen", S.seen); render(); break;
    case "rules": S.menu = false; S.rules = true; render(); break;
    case "rulesClose": S.rules = false; render(); break;
    case "ruleOpen": S.ruleSheet = "pick"; render(); break;
    case "ruleClose": S.ruleSheet = null; render(); break;
    case "ruleTo": {
      const { lucky, html } = drawBatsu(i);
      if (lucky) g.st.lucky[i]++;
      else { g.pen[i]++; g.rev[i] = true; g.st.why[i].rule = (g.st.why[i].rule || 0) + 1; }
      S.ruleSheet = { i, lucky, html };
      play(lucky ? "lucky" : "pop");
      if (navigator.vibrate) navigator.vibrate(lucky ? 30 : [60, 40, 60]);
      render(); break;
    }
    case "clear": g.add = new Map(); finishCard(); break;
    case "fail": g.add = new Map([[g.doer, 1]]); finishCard(); break;
    case "penOpen": g.penOpen = g.card; render(); break;
    case "accept": advance(); break;
    case "roll": rollDice(); break;

    // ダブルアップ
    case "double":
      g.double = b.dataset.v === "1";
      if (g.double) g.st.dbl[g.doer]++;
      g.card = g.pending; g.pending = null; g.phase = "play";
      render(true); break;
    case "dWin": g.st.dwin[g.doer]++; g.phase = "push"; render(); break;
    case "dLose": g.addReason = "double"; addPen(g.doer, 2); finishCard(); break;
    case "pushTo": g.st.hit[i]++; g.addReason = "push"; addPen(i, 1); finishCard(); break;

    // 夜モード
    case "logo": {
      const now = Date.now();
      S.taps = (S.taps || []).filter((x) => now - x < 2500).concat(now);
      const lg = document.getElementById("logo");
      // 1回タップするごとにロゴが震えて光る（何か起きそう）
      if (lg && S.taps.length < 3) { lg.classList.remove("tease"); void lg.offsetWidth; lg.classList.add("tease"); play("tick"); }
      if (S.taps.length >= 3) {
        S.taps = [];
        if (!S.night) S.nightAsk = "yoru";
        else if (S.night === "yoru") S.nightAsk = "shinya";
        else break; // 深夜はもう一番奥
        play("warn"); render(); window.scrollTo(0, 0);
      }
      break;
    }
    case "nightPick":
      if (b.dataset.v === "shinya" && S.night !== "shinya") { S.nightAsk = "shinya"; render(); window.scrollTo(0, 0); }
      else { S.night = b.dataset.v; store.set("nd_night", S.night); render(); }
      break;
    case "nightOn": S.night = S.nightAsk || "yoru"; S.nightAsk = false; store.set("nd_night", S.night); render(); break;
    case "nightLv": S.night = b.dataset.v; store.set("nd_night", S.night); render(); break;
    case "nightOff": S.night = false; S.nightAsk = false; S.sheet = false; store.set("nd_night", false); render(); break;
    case "nightCancel": S.nightAsk = false; render(); break;
    case "ng": S.members[i].ng = !S.members[i].ng; saveMembers(); render(); break;
    case "pass": g.st.pass[g.doer]++; g.add = new Map(); advance(); break;

    // 時限爆弾
    case "bombPeek":
      g.phase = "bombPeek";
      g.card = { kind: `${S.members[g.doer].name}だけ見てええ`, bomb: true,
        html: `今から<mark style="--mc:#ff7a1a">${esc(g.bomb.cond)}</mark>奴を、こっそり監視しろ。爆発したら発表してもらう` };
      render(true); break;
    case "bombHide": g.bombJust = false; proceed(); break;

    // 当てはまらん → ランダムで別の人に回す（1枚につき1回、NGの人には夜お題を回さない）
    case "notme": {
      const c = g.card, from = g.doer;
      const pool = others(from).filter((j) => !c.yoru || okForYoru(j));
      if (!pool.length || !c.tpl) break;
      const to = pick(pool);
      g.st.notme[from]++;
      g.doer = to;
      g.card = makeCard(c.kind.replace(/（.*）$/, "") + `（${S.members[from].name}は当てはまらん）`, c.tpl, to, c.opts, { yoru: c.yoru, passed: true });
      render(true); break;
    }

    // リベンジ権
    case "revenge": g.phase = "revenge"; render(); break;
    case "revCancel": g.phase = "play"; render(); break;
    case "revTo": {
      const from = g.doer, c = g.card;
      g.rev[from] = false;
      g.st.rev[from]++; g.st.hit[i]++;
      g.doer = i;
      g.card = makeCard(c.kind.replace(/（.*押し付け）$/, "") + `（${S.members[from].name}から押し付け）`, c.tpl, i, c.opts, { alert: true, yoru: c.yoru });
      g.phase = "play";
      render(true); break;
    }
  }
}
app.addEventListener("click", onClick);

// ---------- 画面の高さ ----------
// ホーム画面に追加して全画面で開くと、iPhoneが高さを時計の分だけ短く数えることがある。
// 時計の裏まで描いてる時（上の安全領域がある時）は、画面そのものの高さを使う
function fixHeight() {
  let h = window.innerHeight;
  try {
    const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;height:0;padding-top:env(safe-area-inset-top,0px);visibility:hidden";
    document.body.appendChild(probe);
    const top = probe.offsetHeight; probe.remove();
    const portrait = window.innerHeight > window.innerWidth;
    if (standalone && top > 0 && portrait) h = Math.max(h, screen.height);
  } catch {}
  document.documentElement.style.setProperty("--app-h", h + "px");
}
// 起動直後は上の安全領域がまだ0のことがあるので、少し後にも測り直す
fixHeight();
[150, 600, 1500].forEach((ms) => setTimeout(fixHeight, ms));
window.addEventListener("resize", fixHeight);
window.addEventListener("pageshow", fixHeight);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(fixHeight, 100); });
window.addEventListener("orientationchange", () => setTimeout(fixHeight, 300));

// ---------- 札のスワイプ：右でクリア、左で番の人に罰 ----------
let drag = null;
const canSwipe = () => {
  const g = S.game;
  return g && (S.screen === "odai" || S.screen === "sugoroku") && g.phase === "play" && !g.double && g.card?.solo && !needsPick(g.card.tpl) && g.penOpen !== g.card && !(S.screen === "sugoroku" && !g.rolled);
};
app.addEventListener("pointerdown", (e) => {
  const card = e.target.closest("#card");
  if (!card || !canSwipe() || e.target.closest("button")) return;
  drag = { x: e.clientX, y: e.clientY, card, dx: 0, on: false };
});
window.addEventListener("pointermove", (e) => {
  if (!drag) return;
  let dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (!drag.on) {
    if (Math.abs(dx) < 8) return;
    if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // 縦の動きはスワイプ扱いしない
    drag.on = true; drag.card.classList.add("dragging");
  }
  if (S.flip) dx = -dx; // 上下反転中は左右も逆
  drag.dx = dx;
  const p = Math.max(-1, Math.min(1, dx / 110));
  drag.card.style.transform = `translateX(${S.flip ? -dx : dx}px) rotate(${(S.flip ? -dx : dx) / 18}deg)`;
  drag.card.style.setProperty("--ok", Math.max(0, p).toFixed(2));
  drag.card.style.setProperty("--ng", Math.max(0, -p).toFixed(2));
});
const endDrag = () => {
  if (!drag) return;
  const { card, dx, on } = drag;
  drag = null;
  card.classList.remove("dragging");
  if (!on) return;
  if (Math.abs(dx) > 90) {
    const g = S.game;
    const out = (S.flip ? -dx : dx) > 0 ? 1 : -1;
    card.style.transition = "transform .22s ease-in";
    card.style.transform = `translateX(${out * 520}px) rotate(${out * 24}deg)`;
    if (navigator.vibrate) navigator.vibrate(dx > 0 ? 20 : [30, 30, 30]);
    setTimeout(() => { g.add = dx > 0 ? new Map() : new Map([[g.doer, 1]]); finishCard(); }, 200);
  } else {
    card.style.transition = "transform .3s cubic-bezier(.3,1.6,.5,1)";
    card.style.transform = "";
    card.style.setProperty("--ok", 0); card.style.setProperty("--ng", 0);
  }
};
window.addEventListener("pointerup", endDrag);
window.addEventListener("pointercancel", endDrag);
overlay.addEventListener("click", onClick);

// ---------- 振ってルーレット ----------
// iPhoneは許可が要るので、ゲーム開始のタップで1回だけ聞く。使えない環境ではボタンで進める
function askMotion() {
  try {
    if (S.shake && typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      DeviceMotionEvent.requestPermission().catch(() => {});
    }
  } catch {}
}
let lastShake = 0;
window.addEventListener("devicemotion", (e) => {
  if (!S.shake || S.screen === "home" || S.screen === "result") return;
  const a = e.accelerationIncludingGravity;
  if (!a || a.x == null) return;
  S.motionOk = true; // センサーが生きてる時だけ「振っても進む」を出す
  const force = Math.hypot(a.x, a.y, a.z);
  const now = Date.now();
  if (force > 24 && now - lastShake > 1200) {
    lastShake = now;
    const b = document.querySelector("[data-shake]:not([disabled])");
    if (b) { if (navigator.vibrate) navigator.vibrate(40); b.click(); }
  }
});

render();
