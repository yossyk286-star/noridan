const DATA = /*DATA*/null;
const COLORS = ["#ffd23f", "#ff5d8f", "#4dd4ff", "#7cf06b", "#ff9a3c", "#b69cff", "#ffffff", "#ff4f4f", "#3cffc8", "#f5a3ff", "#c8ff3c", "#9ab0ff"];
const LV = { yurume: "ゆるめ", futsu: "普通", jigoku: "地獄" };
const GOAL = DATA.board.length - 1;
const CHANCE = { event: 0.14, double: 0.2, minna: 0.18, neta: 0.22, bomb: 0.12, yoru: 0.35, lucky: 0.15 };

// ---------- storage (best effort) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const EXAMPLE = [
  { name: "よし", neta: "すぐ寝る" },
  { name: "たく", neta: "遅刻常習犯" },
  { name: "まゆ", neta: "" },
];

const S = {
  screen: "home",
  members: store.get("nd_members", EXAMPLE),
  isExample: store.get("nd_members", null) === null,
  level: store.get("nd_level", "futsu"),
  shake: store.get("nd_shake", true),
  night: (() => { const v = store.get("nd_night", false); return v === true ? "yoru" : v; })(), // false | "yoru" | "shinya"
  nightAsk: false,  // false | "yoru" | "shinya"（確認画面）
  whisper: Math.random() < 0.35, // 昼間でもたまにヒントを出す（起動ごとに固定）
  sound: store.get("nd_sound", true),
  dual: store.get("nd_dual", false),   // 向かい合わせ表示
  voice: store.get("nd_voice", false), // お題の読み上げ
  step: 1,          // ホーム: 1=メンバー 2=モード選択
  sheet: false,     // 設定シート
  tut: store.get("nd_tut", false) ? null : 0, // 初回だけ遊び方
  flip: false,      // 上下反転
  menu: false,      // ゲーム中の「⋯」メニュー
  editing: null,    // イジりネタを編集中のメンバー
  shareMsg: "",
  navKey: "",
};

// ---------- helpers ----------
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const colorOf = (i) => COLORS[i % COLORS.length];
const nm = (i) => `<mark style="--mc:${colorOf(i)}">${esc(S.members[i]?.name ?? "誰か")}</mark>`;
const others = (i) => S.members.map((_, j) => j).filter((j) => j !== i);

// {P}{X}{Y}{NETA} を埋める
function fill(tpl, pIdx, opts = {}) {
  const ms = S.members;
  const os = others(pIdx).filter((i) => !opts.noNg || !ms[i].ng);
  let pool = opts.needNeta ? os.filter((i) => ms[i].neta) : os;
  if (!pool.length) pool = os;
  const x = pick(pool);
  const y = pick(os.filter((i) => i !== x));
  return esc(tpl)
    .replaceAll("{P}", nm(pIdx))
    .replaceAll("{X}", nm(x))
    .replaceAll("{Y}", nm(y ?? x))
    .replaceAll("{NETA}", esc(ms[x]?.neta || "アレ"));
}
const textOf = (t) => (typeof t === "string" ? t : t.text);
// 3人以上おらんと成立せえへんお題（2人やと必ず引き分け・全員該当になる）
const NEEDS_3 = /少数派|被らんかった|多数決|一番指された|指差せ|一番似てない|一番低い点|ひとりぼっち|被ったら/;
function usable(t) {
  const s = textOf(t), n = S.members.length;
  if (NEEDS_3.test(s) && n < 3) return false;
  if (s.includes("{Y}") && n < 3) return false;
  if (s.includes("{X}") && n < 2) return false;
  return true;
}

// 人によっては当てはまらんお題（恋人・経験・その場の状況など）。この時だけ「当てはまらん」ボタンを出す
const SITUATIONAL = /元恋人|恋人|キス|初体験|ラブホ|ワンナイト|付き合|好きやった|ドキッとした相手|グイグイ|トイレ|親に|寝言|夢/;
const isSituational = (tpl) => !!tpl && SITUATIONAL.test(tpl);

// 山札：同じお題が続かないように
const decks = {};
function draw(key, list) {
  if (!decks[key] || !decks[key].length) decks[key] = shuffle(list.filter(usable));
  return decks[key].pop(); // 人数的に使えるお題が無ければ undefined
}

// solo=true のカードは「その人がやるお題」= リベンジ・ダブルアップの対象
function makeCard(kind, tpl, p, opts = {}, extra = {}) {
  return { kind, tpl, opts, html: fill(tpl, p, opts), solo: tpl.includes("{P}"), ...extra };
}
// 夜お題に巻き込める人（下ネタNGの人は外す）
const okForYoru = (i) => !S.members[i].ng;
function canYoru(tpl, p) {
  // 全員参加の夜お題は、NGの人も指差される側に入ってしまうので、NGが1人でもいたら出さない
  if (tpl.startsWith("全員") && S.members.some((m) => m.ng)) return false;
  const ok = others(p).filter(okForYoru).length;
  if (tpl.includes("{Y}") && ok < 2) return false;
  if (tpl.includes("{X}") && ok < 1) return false;
  return true;
}
function drawOdai(p) {
  // 夜は3回に1回くらい、深夜は毎回下ネタ（NGの人の番だけ普通のお題）
  const rate = S.night === "shinya" ? 1 : CHANCE.yoru;
  if (S.night && okForYoru(p) && Math.random() < rate) {
    for (let k = 0; k < 4; k++) {
      const deep = S.night === "shinya" && Math.random() < 0.6;
      const tpl = deep ? draw("shinya", DATA.odai.shinya) : draw("yoru", DATA.odai.yoru);
      if (tpl && canYoru(tpl, p)) return makeCard(deep ? "深夜お題" : "夜お題", tpl, p, { noNg: true }, { yoru: true });
    }
  }
  const hasNeta = S.members.some((m, i) => i !== p && m.neta);
  const r = Math.random();
  if (hasNeta && r < CHANCE.neta) { const t = draw("neta", DATA.odai.neta); if (t) return makeCard("イジりお題", t, p, { needNeta: true }); }
  if (r < CHANCE.neta + CHANCE.minna) { const t = draw("minna", DATA.odai.minna); if (t) return makeCard("全員参加", t, p, {}, { solo: false }); }
  return makeCard(`アホお題・${LV[S.level]}`, draw(S.level, DATA.odai[S.level]), p);
}
function drawEvent(p) {
  const ev = draw("ev", DATA.events);
  const card = makeCard("【緊急】割り込み", ev.text, p, {}, { alert: true, solo: false });
  return { card, rule: ev.turns ? { html: card.html, left: ev.turns } : null };
}

// ---------- game state ----------
function newGame(mode) {
  const n = S.members.length;
  S.game = {
    mode, turn: 0, cur: 0, doer: 0,
    pen: Array(n).fill(0), rev: Array(n).fill(false),
    add: new Map(), rule: null, card: null, pending: null,
    phase: "play", double: false, gacha: [],
    pos: Array(n).fill(0), vpos: Array(n).fill(0), skip: Array(n).fill(false), hopping: false,
    rolled: false, rolling: false, die: 0, done: false,
    bomb: null, bombJust: false, cards: 0,
    // 称号用の記録
    st: { lucky: Array(n).fill(0), pass: Array(n).fill(0), rev: Array(n).fill(0), hit: Array(n).fill(0), dbl: Array(n).fill(0), dwin: Array(n).fill(0), notme: Array(n).fill(0), solo: Array(n).fill(0) },
  };
  askMotion();
  S.screen = mode;
  if (mode === "odai") startOdaiTurn();
  else S.game.card = { kind: "すごろく", html: `${nm(0)}からスタート。サイコロ振れ！` };
  render(true);
}

// 引いたカードを出す。たまにダブルアップチャンスを挟む
function present(card) {
  const g = S.game;
  g.double = false;
  if (card.solo && g.turn > 1 && Math.random() < CHANCE.double) {
    g.pending = card;
    g.phase = "offer";
    g.card = { kind: "ダブルアップチャンス", html: `${nm(g.doer)}、お題を見る前に倍プッシュするか？` };
  } else {
    g.phase = "play";
    g.card = card;
  }
}

function startOdaiTurn() {
  const g = S.game;
  g.turn++;
  g.doer = g.cur;
  if (g.turn > 2 && Math.random() < CHANCE.event) {
    const e = drawEvent(g.cur);
    if (e.rule) g.rule = e.rule;
    g.double = false; g.phase = "play"; g.card = e.card;
  } else {
    present(drawOdai(g.cur));
  }
}

function tickRule() {
  const g = S.game;
  if (g.rule) { g.rule.left--; if (g.rule.left <= 0) g.rule = null; }
}
function addPen(i, n = 1) { const g = S.game; g.add.set(i, (g.add.get(i) || 0) + n); }

// 罰が出たら罰ガチャを挟む。なければそのまま次へ
function finishCard() {
  const g = S.game;
  if (g.card?.solo && g.st) g.st.solo[g.doer]++;
  if (g.add.size) {
    // たまにラッキー（天使）で帳消し
    g.gacha = [...g.add].map(([i, n]) => {
      const lucky = Math.random() < CHANCE.lucky;
      return { i, n, lucky, html: fill(lucky ? draw("lucky", DATA.batsu.lucky) : draw("batsu", DATA.batsu.bad), i) };
    });
    g.phase = "batsu";
    render(true);
  } else advance();
}
function applyAdds() {
  const g = S.game;
  const saved = new Set((g.gacha || []).filter((x) => x.lucky).map((x) => x.i)); // ラッキーの人は罰なし
  saved.forEach((i) => { if (g.st) g.st.lucky[i]++; });
  g.add.forEach((n, i) => { if (saved.has(i)) return; g.pen[i] += n; g.rev[i] = true; });
  g.add = new Map();
}
// カード1枚が終わったあと。時限爆弾の爆発・設置をここで挟む
function advance() {
  const g = S.game;
  applyAdds();
  g.gacha = [];
  g.cards++;
  if (!g.bombJust && g.bomb) {
    if (--g.bomb.left <= 0) {
      const b = g.bomb;
      g.bomb = null; g.bombJust = true;
      g.doer = b.owner; g.double = false; g.phase = "play";
      g.card = { kind: "時限爆弾 ドカン！", bomb: true, alert: true, solo: false,
        html: `仕掛け人${nm(b.owner)}が発表！爆弾が仕掛けられてから<mark>${esc(b.cond)}</mark>奴は全員罰。自首するか告発しろ` };
      render(true); return;
    }
  } else if (!g.bombJust && !g.done && g.cards >= 2 && Math.random() < CHANCE.bomb) {
    const owner = rnd(S.members.length);
    g.bomb = { cond: draw("bomb", DATA.bombs), owner, left: 3 + rnd(3) };
    g.bombJust = true; g.doer = owner; g.double = false; g.phase = "bombSet";
    g.card = { kind: "時限爆弾セット", bomb: true, alert: true, html: `${nm(owner)}だけ画面を見ろ。他の奴は目そらせ！` };
    render(true); return;
  }
  g.bombJust = false;
  proceed();
}
function proceed() {
  const g = S.game;
  if (g.mode === "odai") {
    tickRule();
    g.cur = (g.cur + 1) % S.members.length;
    startOdaiTurn();
    render(true);
  } else sugoNext();
}

// sugoroku
function rollDice() {
  const g = S.game;
  if (g.rolling || g.rolled) return;
  g.doer = g.cur;
  if (g.skip[g.cur]) {
    g.skip[g.cur] = false;
    g.rolled = true; g.phase = "play";
    g.card = { kind: "1回休み", html: `${nm(g.cur)}は休み。おとなしく見とけ` };
    render(true); return;
  }
  g.rolling = true; render();
  let k = 0;
  const t = setInterval(() => {
    g.die = 1 + rnd(6); paintDie();
    if (++k >= 10) { clearInterval(t); g.rolling = false; land(g.die); }
  }, 75);
}
// コマを1マスずつ動かす（表示用の vpos を target まで進める）
function hop(me, target, done) {
  const g = S.game;
  const step = () => {
    if (g.vpos[me] === target) { done(); return; }
    g.vpos[me] += target > g.vpos[me] ? 1 : -1;
    play("tick");
    paintBoard();
    setTimeout(step, 260);
  };
  setTimeout(step, 200);
}
// 止まったマスの上に吹き出しを出す（−3マス戻る！など）
function callout(text, at, kind) {
  const b = document.getElementById("board");
  if (!b) return;
  const el = document.createElement("div");
  const { x, y } = pct(at);
  el.className = "sg-callout " + kind;
  el.textContent = text;
  el.style.left = x + "%";
  el.style.top = y + "%";
  // 端のマスでは吹き出しが盤の外にはみ出さんように寄せる
  const tx = x > 66 ? 82 : x < 34 ? 18 : 50;
  el.style.setProperty("--tx", `-${tx}%`);
  el.style.setProperty("--ax", `${tx}%`);
  b.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}
function land(n) {
  const g = S.game, me = g.cur;
  g.turn++;
  g.hopping = true; render();
  const target = Math.min(GOAL, g.pos[me] + n);
  hop(me, target, () => {
    g.pos[me] = target;
    resolveCell(me); // 進む・戻る・入れ替えで pos が変わることがある
    const after = g.pos.slice();
    // 入れ替えで動いた人はワープ、自分は続けてピョンピョン
    // （入れ替えの相手も吹き出しの後で動かす）
    const finish = () => { g.hopping = false; g.rolled = true; render(true); };
    const c = DATA.board[target];
    if (g.vpos[me] !== after[me] || c.type === "swap") {
      // マイナス・プラス・入れ替えは、いったん止まって吹き出しを出してから動く
      const diff = after[me] - target;
      const text = c.type === "swap" ? "入れ替え！" : diff > 0 ? `+${diff}マス進む！` : `${diff}マス戻る…`;
      callout(text, target, c.type === "swap" ? "swap" : diff > 0 ? "plus" : "minus");
      play(diff < 0 ? "warn" : "coin");
      if (navigator.vibrate) navigator.vibrate(diff < 0 ? [60, 40, 60] : 40);
      const wait = 1200;
      if (c.type === "swap" || Math.abs(diff) > 6) {
        setTimeout(() => { g.vpos = after.slice(); paintBoard(); setTimeout(finish, 450); }, wait);
      } else setTimeout(() => hop(me, after[me], finish), wait);
    } else setTimeout(finish, 350);
  });
}
function resolveCell(me) {
  const g = S.game;
  const c = DATA.board[g.pos[me]];
  const head = `${g.pos[me]}マス目`;
  const show = (card) => { g.phase = "play"; g.double = false; g.card = card; };
  if (c.type === "goal") {
    g.done = true;
    show({ kind: "GOAL", html: `${nm(me)}がゴール！最後に罰が一番多い奴は誰や` });
  } else if (c.type === "odai") {
    const o = drawOdai(me); o.kind = `${head}・${o.kind}`; present(o);
  } else if (c.type === "event") {
    const e = drawEvent(me); if (e.rule) g.rule = e.rule; e.card.kind = `${head}・${e.card.kind}`; show(e.card);
  } else if (c.type === "move") {
    g.pos[me] = Math.max(0, Math.min(GOAL, g.pos[me] + c.value));
    const card = { kind: `${head}・${c.label}`, html: fill(c.text, me) };
    if (g.pos[me] === GOAL) { g.done = true; card.html += "　そのままゴール！"; }
    show(card);
  } else if (c.type === "skip") {
    g.skip[me] = true; show({ kind: `${head}・${c.label}`, html: fill(c.text, me) });
  } else if (c.type === "swap") {
    const x = pick(others(me));
    [g.pos[me], g.pos[x]] = [g.pos[x], g.pos[me]];
    show({ kind: `${head}・${c.label}`, html: esc(c.text).replace("{X}", nm(x)) });
  } else if (!usable(c.text)) {
    // 2人やと成立せんマス（指差しとか）は普通のお題に差し替え
    const o = drawOdai(me); o.kind = `${head}・${o.kind}`; present(o);
  } else {
    show(makeCard(`${head}・${c.label}`, c.text, me));
  }
}
function sugoNext() {
  const g = S.game;
  if (g.done) { S.screen = "result"; render(true); return; }
  tickRule();
  g.cur = (g.cur + 1) % S.members.length;
  g.doer = g.cur;
  g.rolled = false; g.die = 0; g.phase = "play"; g.double = false;
  g.card = { kind: "すごろく", html: `次は${nm(g.cur)}の番。サイコロ振れ！` };
  render(true);
}

// ---------- 称号 ----------
// 結果発表で戦犯以外にもあだ名をつける。同点は並べる
function titles() {
  const g = S.game, st = g.st, n = S.members.length;
  if (!st) return [];
  const out = [];
  const top = (arr, min) => {
    const m = Math.max(...arr);
    if (m < min) return null;
    return arr.map((v, i) => (v === m ? i : -1)).filter((i) => i >= 0);
  };
  const add = (title, idx, desc) => { if (idx && idx.length && idx.length < n) out.push({ title, idx, desc }); };
  // 逃げ切り王：罰が一番少ない（誰かは罰を食らってる時だけ）
  // ノリの化身：パスも当てはまらんも使わず、3枚以上やって罰ゼロ
  const brave = S.members.map((_, i) => i).filter((i) => g.pen[i] === 0 && st.pass[i] === 0 && st.solo[i] >= 3 && !st.notme[i]);
  if (brave.length) add("ノリの化身", brave, "全部やり切って罰ゼロ");
  const maxPen = Math.max(...g.pen), minPen = Math.min(...g.pen);
  const esc2 = g.pen.map((v, i) => (v === minPen && !brave.includes(i) ? i : -1)).filter((i) => i >= 0);
  if (maxPen > 0) add("逃げ切り王", esc2, `罰 ${minPen}回で逃げ切った`);
  const l = top(st.lucky, 1); if (l) add("天使に愛された人", l, `天使 ${st.lucky[l[0]]}回`);
  const r = top(st.rev, 1); if (r) add("リベンジの鬼", r, `押し付け ${st.rev[r[0]]}回`);
  const h = top(st.hit, 2); if (h) add("押し付けられ体質", h, `押し付けられ ${st.hit[h[0]]}回`);
  const d = top(st.dbl, 1); if (d) add("ギャンブラー", d, `倍プッシュ ${st.dbl[d[0]]}回（成功${st.dwin[d[0]]}）`);
  const p = top(st.pass, 2); if (p) add("パス魔", p, `パス ${st.pass[p[0]]}回`);
  const nm2 = top(st.notme, 2); if (nm2) add("当てはまらん人生", nm2, `当てはまらん ${st.notme[nm2[0]]}回`);
  return out.slice(0, 6);
}
const titleNames = (t) => t.idx.map((i) => S.members[i].name).join("・");

// ---------- 画面スリープ防止 ----------
// ゲーム中だけ画面を消さない（対応してないブラウザでは何もしない）
let wakeLock = null;
async function syncWake() {
  const want = (S.screen === "odai" || S.screen === "sugoroku") && document.visibilityState === "visible";
  try {
    if (want && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!want && wakeLock) { const w = wakeLock; wakeLock = null; await w.release(); }
  } catch { wakeLock = null; }
}
document.addEventListener("visibilitychange", () => { syncWake(); });

// ---------- お題の読み上げ ----------
const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
function speak(text) {
  if (!S.voice || !text) return;
  try {
    const sy = window.speechSynthesis;
    if (!sy) return;
    sy.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP"; u.rate = 1.05; u.pitch = 1.1;
    const v = sy.getVoices().find((x) => x.lang?.startsWith("ja"));
    if (v) u.voice = v;
    sy.speak(u);
  } catch {}
}
function stopSpeak() { try { window.speechSynthesis?.cancel(); } catch {} }
// 今の札の読み上げ用テキスト（仕掛け人だけが見る爆弾の中身は絶対読まない）
function cardSpeech() {
  const g = S.game;
  if (!g) return "";
  if (g.phase === "bombPeek") return "";
  if (g.phase === "batsu") {
    return g.gacha.map((x) => `${S.members[x.i].name}${x.lucky ? "はセーフ。" : "の罰。"}${plain(x.html)}`).join("。");
  }
  return g.card ? plain(g.card.html) : "";
}
