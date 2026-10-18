const DATA = /*DATA*/null;
const COLORS = ["#ffd23f", "#ff5d8f", "#4dd4ff", "#7cf06b", "#ff9a3c", "#b69cff", "#ffffff", "#ff4f4f", "#3cffc8", "#f5a3ff", "#c8ff3c", "#9ab0ff"];
const LV = { yurume: "ゆるめ", futsu: "普通", jigoku: "地獄" };
const GOAL = DATA.board.length - 1;
const CHANCE = { event: 0.14, double: 0.2, minna: 0.25, bomb: 0.12, yoru: 0.35, lucky: 0.15 };

// ---------- storage (best effort) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const EXAMPLE = [
  { name: "よし" },
  { name: "たく" },
  { name: "まゆ" },
];

const S = {
  screen: "home", hist: [], ask: null,
  members: (store.get("nd_members", EXAMPLE) || EXAMPLE).map((m) => ({ name: m.name, ...(m.ng ? { ng: true } : {}) })),
  isExample: store.get("nd_members", null) === null,
  level: store.get("nd_level", "futsu"),
  night: (() => { const v = store.get("nd_night", false); return v === true ? "yoru" : v; })(), // false | "yoru" | "shinya"
  nightAsk: false,  // false | "yoru" | "shinya"（確認画面）
  whisper: Math.random() < 0.35,
  seen: store.get("nd_seen", {}) || {}, // 初登場のひとこと説明を見たかどうか
  rules: false,     // ルール早見表 // 昼間でもたまにヒントを出す（起動ごとに固定）
  sound: store.get("nd_sound", true),
  dual: store.get("nd_dual", false),   // 向かい合わせ表示
  voice: store.get("nd_voice", false), // お題の読み上げ
  step: 1,          // ホーム: 1=メンバー 2=モード選択
  sheet: false,     // 設定シート
  tut: store.get("nd_tut", false) ? null : 0, // 初回だけ遊び方
  flip: false,      // 上下反転
  menu: false,      // ゲーム中の「⋯」メニュー
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

// {P}{X}{Y} を埋める
function fill(tpl, pIdx, opts = {}) {
  const ms = S.members;
  const os = others(pIdx).filter((i) => !opts.noNg || !ms[i].ng);
  const x = pick(os);
  const y = pick(os.filter((i) => i !== x));
  return esc(tpl)
    .replaceAll("{P}", nm(pIdx))
    .replaceAll("{X}", nm(x))
    .replaceAll("{Y}", nm(y ?? x));
}
const textOf = (t) => (typeof t === "string" ? t : t?.text ?? "");
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
// お題の文から「誰が罰か」を読み取って、罰の人を選ぶ時の聞き方にする（例：一番遅い奴が罰 → 一番遅い人は？）
function penHead(tpl) {
  if (!tpl) return "アウトの人は？";
  const s = tpl.replace(/（[^）]*）/g, "");
  if (/黙秘/.test(s)) return "黙秘した人は？";
  if (/一番指された人/.test(s)) return "一番指された人は？";
  if (/一番似てない/.test(s)) return "一番似てなかった人は？";
  if (/詰まったら/.test(s)) return "詰まった人は？";
  const ok = (w) => w && !w.includes("{") && !/^(と|なら|どっち|も|なっ)/.test(w);
  let m = s.match(/([^。、！？「」\s]+?)(?:が|は)罰/);
  if (m) {
    const w = m[1].replace(/奴$/, "人").replace(/^.*?で/, "");
    if (ok(w)) return w + "は？";
  }
  m = s.match(/([^。、！？「」\s]+?)たら(?:\{[PXY]\}が)?(?:2人とも)?罰/);
  if (m) {
    const w = m[1].replace(/^.*[をがにでま]/, "");
    if (ok(w)) return w + "た人は？";
  }
  return "アウトの人は？";
}
// 番の人以外が罰になりうるお題か（勝負・多数決など）。そういう札は「アウト／セーフ」やなくて一覧から選ぶ
function needsPick(tpl) {
  if (!tpl) return true;
  if (/黙秘は罰/.test(tpl)) return false;
  return /が罰|は罰|2人とも罰|両方罰/.test(tpl) || /^\{P\}と\{X\}/.test(tpl);
}
// 勝負のお題（負けた方・先に笑った方…）は誰かが必ずアウトになる
function mustPick(tpl) {
  return !!tpl && /方が罰|2人とも罰/.test(tpl);
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
      // 深夜×地獄は全部下ネタ（深夜お題だけ）。それ以外の深夜は6割が深夜お題、4割が夜お題
      const deep = S.night === "shinya" && (S.level === "jigoku" || Math.random() < 0.6);
      const tpl = deep ? draw("shinya", DATA.odai.shinya) : draw("yoru", DATA.odai.yoru);
      if (tpl && canYoru(tpl, p)) return makeCard(deep ? "深夜お題" : "夜お題", tpl, p, { noNg: true }, { yoru: true });
    }
  }
  if (Math.random() < CHANCE.minna) { const t = draw("minna", DATA.odai.minna); if (t) return makeCard("全員参加", t, p, {}, { solo: false }); }
  return makeCard(`アホお題・${LV[S.level]}`, draw(S.level, DATA.odai[S.level]), p);
}
// 「次の自分の番まで語尾が〜」みたいな、しばらく続く罰・お題
const PERSONAL = /次の(自分の)?番まで/;
// その人の次の番が終わるまで何ターンあるか（すぐ次がその人でも、その番の間は出しとく）
function untilNext(i) { const n = S.members.length; return (((i - S.game.cur + n) % n) || n) + 1; }
function addRule(r) {
  const g = S.game;
  if (!g || !["odai", "sugoroku", "memory", "homeru"].includes(g.mode)) return;
  if (r.who != null) r = { ...r, html: r.html.replace(/次の(自分の)?番まで[、,]?/, "") }; // 「〇〇の次の番まで」は見出しに出すので本文からは省く
  g.rules = [...g.rules.filter((x) => x.html !== r.html), r].slice(-4);
}
function drawEvent(p) {
  const ev = draw("ev", DATA.events);
  const card = makeCard("緊急指令", ev.text, p, {}, { alert: true, solo: false, ruleCard: !!ev.turns });
  // 「次の自分の番まで〜」の指令も、その人の次の番まで上に出しておく（破ったら罰をつけられる）
  const personal = !ev.turns && PERSONAL.test(ev.text);
  if (personal) card.ruleCard = true;
  return { card, rule: ev.turns ? { html: card.html, left: ev.turns, card } : personal ? { html: card.html, left: S.members.length + 1, who: p, card } : null };
}

// ---------- game state ----------
const MODE_NAME = { odai: "アホお題", sugoroku: "すごろく", memory: "神経衰弱", ito: "価値観ナンバー", gesture: "早押しジェスチャー", homeru: "褒め殺し", ngword: "NGワード", vote: "ぶっちゃけ投票", wolf: "ワードウルフ", pittari: "ピッタリ予想" };
const isStage = (sc) => sc in MODE_NAME;
// 結果画面などの「アホお題・普通・12ターン」。NGワードは地獄度を使わへん
const modeLine = (g) => g.mode === "ngword" ? `NGワード・${LV[S.level]}・アウト${g.pen.reduce((a, b) => a + b, 0)}回` : `${MODE_NAME[g.mode]}・${LV[S.level]}・${g.turn || "-"}${g.mode === "vote" || g.mode === "ito" || g.mode === "pittari" ? "問" : g.mode === "wolf" ? "回戦" : g.mode === "memory" ? "ペア" : g.mode === "gesture" ? "問正解" : g.mode === "homeru" ? "回" : "ターン"}`;
function newGame(mode, again = false) {
  S.scores = false; S.bombLook = 0; S.hist = []; S.ask = null;
  const n = S.members.length;
  S.game = {
    mode, turn: 0, cur: 0, doer: 0,
    pen: Array(n).fill(0), rev: Array(n).fill(false),
    add: new Map(), rules: [], card: null, pending: null,
    phase: "play", double: false, gacha: [],
    pos: Array(n).fill(0), vpos: Array(n).fill(0), skip: Array(n).fill(false), hopping: false,
    rolled: false, rolling: false, die: 0, done: false,
    bomb: null, bombJust: false, cards: 0,
    // 称号用の記録
    st: { lucky: Array(n).fill(0), pass: Array(n).fill(0), rev: Array(n).fill(0), hit: Array(n).fill(0), dbl: Array(n).fill(0), dwin: Array(n).fill(0), notme: Array(n).fill(0), solo: Array(n).fill(0), votes: Array(n).fill(0), exact: Array(n).fill(0), wolf: Array(n).fill(0), why: Array.from({ length: n }, () => ({})) },
  };
  S.ruleSheet = null;
  S.screen = mode;
  if (mode === "ngword") { S.game.doer = -1; S.game.ng = { phase: "setup", minutes: store.get("nd_ng_min", 10), words: [], viewer: 0, dealing: false, out: null, res: null, left: 0, endAt: 0, topic: null }; render(true); return; }
  if (mode === "vote") { S.game.doer = -1; S.game.vt = { phase: "intro", round: 0 }; if (again) startVoteRound(); render(true); return; }
  if (mode === "memory") { mmDeal(); render(true); return; }
  if (mode === "wolf") { S.game.doer = -1; S.game.wf = { phase: "intro", round: 0, minutes: store.get("nd_wf_min", 3) }; render(true); return; }
  if (mode === "pittari") { S.game.doer = -1; S.game.pt = { phase: "intro", round: 0 }; if (again) ptRound(); render(true); return; }
  if (mode === "ito") { S.game.doer = -1; S.game.it = { phase: "intro", round: 0 }; render(true); return; }
  if (mode === "gesture") { S.game.doer = 0; S.game.gs = { phase: "intro", sec: store.get("nd_gs_sec", 60), score: Array(n).fill(0), actor: 0, acted: 0, word: null, got: 0, endAt: 0 }; render(true); return; }
  if (mode === "homeru") { S.game.doer = 0; S.game.hm = { phase: "intro", sec: 30, praiser: 0, target: 1, theme: null, endAt: 0, loser: null }; render(true); return; }
  S.game.intro = !again; // 始める前の説明（「もう一回」の時は出さへん）
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
    g.card = { kind: "倍プッシュのチャンス", html: `${nm(g.doer)}、お題を見る前に倍プッシュするか？` };
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
    if (e.rule) addRule(e.rule);
    g.double = false; g.phase = "play"; g.card = e.card;
  } else {
    present(drawOdai(g.cur));
  }
}

function tickRule() {
  const g = S.game;
  g.rules = g.rules.map((r) => ({ ...r, left: r.left - 1 })).filter((r) => r.left > 0);
}
function addPen(i, n = 1) { const g = S.game; g.add.set(i, (g.add.get(i) || 0) + n); }

// 罰が出たら罰ガチャを挟む。なければそのまま次へ
function finishCard() {
  const g = S.game;
  if (g.card?.solo && g.st) g.st.solo[g.doer]++;
  // 「次の自分の番まで〜」のお題をやり切った（セーフ）なら、その人の次の番までルールとして上に出す
  const c = g.card;
  if (c?.tpl && c.solo && !c.alert && PERSONAL.test(c.tpl) && !g.add.has(g.doer)) addRule({ html: c.html, left: untilNext(g.doer), who: g.doer, card: c });
  if (g.add.size) {
    // たまにラッキー（天使）で帳消し
    g.gacha = [...g.add].map(([i, n]) => ({ i, n, ...drawBatsu(i, n) }));
    g.phase = "batsu";
    render(true);
  } else advance();
}
// 罰ガチャの中身を1つ引く。夜・深夜は罰も過激に（下ネタNGの人には普通の罰）
// 罰2倍（×2）の時は、2倍にしても意味が通る罰だけ（「ひと口飲む」「10秒」「3つ言う」みたいに数があるやつ）
const DOUBLEABLE = /ひと口|ふた口|飲む|\d+\s*(秒|回|つ|個|件|枚|小節|発)|[一二三]回/;
const canDouble = (t) => DOUBLEABLE.test(t) && !PERSONAL.test(t);
function drawBatsuFrom(key, list, n) {
  if (n < 2) return draw(key, list);
  const pool = list.filter(canDouble);
  return pool.length ? draw(key + "_x2", pool) : draw(key, list);
}
function drawBatsu(i, n = 1) {
  if (Math.random() < CHANCE.lucky) return { lucky: true, html: fill(draw("lucky", DATA.batsu.lucky), i) };
  let list = "bad";
  if (S.night && !S.members[i].ng) {
    const r = Math.random();
    list = S.night === "shinya" ? (S.level === "jigoku" || r < 0.65 ? "shinya" : r < 0.85 ? "yoru" : "bad") : r < 0.4 ? "yoru" : "bad";
  }
  if (list !== "bad") {
    const tpl = drawBatsuFrom("batsu_" + list, DATA.batsu[list], n);
    // 巻き込む相手（{X}）も下ネタNGやない人だけ。おらんかったら普通の罰
    if (tpl && (!tpl.includes("{X}") || others(i).some(okForYoru))) return { lucky: false, night: list, html: fill(tpl, i, { noNg: true }) };
  }
  return { lucky: false, html: fill(drawBatsuFrom("batsu", DATA.batsu.bad, n), i) };
}
function applyAdds() {
  const g = S.game;
  const saved = new Set((g.gacha || []).filter((x) => x.lucky).map((x) => x.i)); // ラッキーの人は罰なし
  saved.forEach((i) => { if (g.st) g.st.lucky[i]++; });
  // 罰の理由（結果発表の内訳用）
  const why = g.addReason || (g.card?.bomb ? "bomb" : "out");
  // 「次の自分の番まで語尾が〜」の罰は、その人の次の番まで上に出す
  (g.gacha || []).forEach((x) => { if (!x.lucky && PERSONAL.test(x.html)) addRule({ html: `${nm(x.i)}の罰：${x.html}`, left: untilNext(x.i), who: x.i }); });
  g.add.forEach((n, i) => {
    if (saved.has(i)) return;
    g.pen[i] += n; g.rev[i] = true;
    if (g.st) g.st.why[i][why] = (g.st.why[i][why] || 0) + n;
  });
  g.add = new Map();
  g.addReason = null;
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
      g.card = { kind: "時限爆弾 ドカン！", bomb: true, alert: true, solo: false, bombCond: b.cond,
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
  if (c.type === "start") {
    show({ kind: "START", html: `${nm(me)}はスタートに戻った。次の番まで待機` });
  } else if (c.type === "goal") {
    g.done = true;
    show({ kind: "GOAL", html: `${nm(me)}がゴール！最後に罰が一番多い奴は誰や` });
  } else if (c.type === "odai") {
    const o = drawOdai(me); o.kind = `${head}・${o.kind}`; present(o);
  } else if (c.type === "event") {
    const e = drawEvent(me); if (e.rule) addRule(e.rule); e.card.kind = `${head}・${e.card.kind}`; show(e.card);
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
  if (g.mode === "pittari") { const e = top(st.exact, 1); if (e) add("ピッタリ職人", e, `ピッタリ ${st.exact[e[0]]}回`); }
  if (g.mode === "wolf") { const w = top(st.wolf, 1); if (w) add("名演技", w, `少数派で逃げ切り ${st.wolf[w[0]]}回`); }
  if (g.mode === "vote" && st.votes) { const v = top(st.votes, 2); if (v) add("みんなの的", v, `合計 ${st.votes[v[0]]}票`); }
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
  const want = isStage(S.screen) && document.visibilityState === "visible";
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

// ---------- NGワード ----------
// 1人ずつスマホを回して「自分以外のNGワード」を覚える。自分のワードは自分だけ知らん。言わされたらアウト
// 地獄度で言葉の言いやすさが変わる（ゆるめ=たまにしか言わん、地獄=絶対言うてまう口ぐせ）。
// 夜・深夜は恋愛・下ネタ寄りのワードも混ざる（下ネタNGの人には配らへん）
const NG_LV = { yurume: "たまにしか言わん言葉", futsu: "そこそこ言う言葉", jigoku: "絶対言うてまう口ぐせ" };
function ngPick(exclude, i) {
  const used = new Set(exclude);
  let key = S.level;
  if (S.night && i != null && okForYoru(i) && Math.random() < (S.night === "shinya" ? 0.5 : 0.3)) {
    key = S.night === "shinya" && Math.random() < 0.6 ? "shinya" : "yoru";
  }
  const list = DATA.ngwords.words[key];
  for (let k = 0; k < 50; k++) { const w = draw("ngw_" + key, list); if (w && !used.has(w)) return w; }
  return pick(DATA.ngwords.words[S.level].filter((w) => !used.has(w)));
}
function ngDeal() {
  const ng = S.game.ng;
  ng.words = [];
  S.members.forEach((_, i) => ng.words.push(ngPick(ng.words, i)));
  ng.dealing = true; ng.viewer = 0; ng.phase = "hand";
  ng.left = ng.minutes * 60000;
}
// プレイ中だけ時計が進む（見直し・アウト処理の間は止める）
function ngPlay() {
  const ng = S.game.ng;
  ng.phase = "play";
  ng.endAt = ng.minutes ? Date.now() + ng.left : 0;
}
function ngPause() {
  const ng = S.game.ng;
  if (ng.phase === "play" && ng.endAt) ng.left = Math.max(0, ng.endAt - Date.now());
  ng.endAt = 0;
}
function ngOut(i) {
  const g = S.game, ng = g.ng;
  ng.out = i;
  ng.res = drawBatsu(i);
  if (ng.res.lucky) g.st.lucky[i]++;
  else { g.pen[i]++; g.st.why[i].ng = (g.st.why[i].ng || 0) + 1; }
  g.turn++;
  ng.phase = "out";
}
const fmtTime = (ms) => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
setInterval(() => {
  const g = S.game;
  if (S.screen !== "ngword" || !g?.ng || g.ng.phase !== "play" || !g.ng.endAt) return;
  const left = g.ng.endAt - Date.now();
  const el = document.getElementById("ngTimer");
  if (left <= 0) { g.ng.left = 0; g.ng.endAt = 0; g.ng.phase = "over"; render(true); return; }
  if (el) { el.textContent = fmtTime(left); el.classList.toggle("hurry", left < 30000); }
}, 250);

// ---------- ぶっちゃけ投票 ----------
// 「この中で一番○○なのは？」に全員がこっそり投票。一番票を集めた人が罰
function startVoteRound() {
  const g = S.game, vt = g.vt, n = S.members.length;
  vt.round++;
  const okIdx = S.members.map((_, i) => i).filter(okForYoru);
  let key = S.level;
  if (S.night && okIdx.length >= 3 && Math.random() < (S.night === "shinya" ? 0.75 : 0.35)) {
    key = S.night === "shinya" && (S.level === "jigoku" || Math.random() < 0.6) ? "shinya" : "yoru";
  }
  vt.night = key === "yoru" || key === "shinya" ? key : false;
  const q = draw("vote_" + key, DATA.vote[key]);
  vt.q = textOf(q);
  vt.good = typeof q === "object" && !!q.good; // 褒める系は票が一番少ない人、イジる系は一番多い人が罰
  // 夜の質問は下ネタNGの人を候補から外す
  vt.cands = S.members.map((_, i) => i).filter((i) => !vt.night || okForYoru(i));
  vt.votes = Array(n).fill(null);
  const s0 = (vt.round - 1) % n;
  vt.order = S.members.map((_, k) => (s0 + k) % n);
  vt.k = 0; vt.phase = "q";
  g.phase = "play"; g.gacha = [];
}
function voteCounts() {
  const vt = S.game.vt, c = Array(S.members.length).fill(0);
  vt.votes.forEach((t) => { if (t != null) c[t]++; });
  return c;
}
function voteReveal() {
  const g = S.game, c = voteCounts();
  c.forEach((v, i) => (g.st.votes[i] += v));
  g.turn++;
  const vt = g.vt, cv = vt.cands.map((i) => c[i]);
  const goal = vt.good ? Math.min(...cv) : Math.max(...cv);
  vt.top = vt.cands.filter((i) => c[i] === goal);
  g.vt.phase = "reveal";
}

// 文字列やないお題（ワードウルフの組・ピッタリ予想）用の山札
function deckPop(key, list) {
  if (!decks[key] || !decks[key].length) decks[key] = shuffle(list);
  return decks[key].pop();
}

// ---------- ワードウルフ ----------
// 全員にお題。1人（少数派）だけちょっと違うお題で、自分がどっちかは分からへん。話して投票、
// 少数派が一番票を集めたら少数派の負け（ただし多数派のお題を当てたら逆転）。外したら・同票なら多数派全員の負け
const WF_MIN = [2, 3, 5];
function wfRound() {
  const g = S.game, wf = g.wf, n = S.members.length;
  wf.round++;
  let key = S.level;
  if (S.night && !S.members.some((m) => m.ng) && Math.random() < (S.night === "shinya" ? 0.5 : 0.3)) key = S.night === "shinya" && Math.random() < 0.6 ? "shinya" : "yoru";
  wf.night = key === "yoru" || key === "shinya" ? key : false;
  const pair = deckPop("wolf_" + key, DATA.wolf[key]);
  const sw = Math.random() < 0.5;
  wf.maj = sw ? pair[1] : pair[0];
  wf.min = sw ? pair[0] : pair[1];
  wf.wolf = rnd(n);
  const s0 = (wf.round - 1) % n;
  wf.order = S.members.map((_, k) => (s0 + k) % n);
  wf.viewer = wf.order[0]; wf.dealt = 0; wf.dealing = true;
  wf.votes = Array(n).fill(null); wf.k = 0;
  wf.timeUp = false; wf.endAt = 0; wf.top = []; wf.caught = false; wf.guessed = null;
  wf.phase = "hand";
  g.phase = "play"; g.gacha = []; g.doer = -1;
}
const wfWord = (i) => (i === S.game.wf.wolf ? S.game.wf.min : S.game.wf.maj);
function wfTalk() {
  const wf = S.game.wf;
  wf.phase = "talk"; wf.dealing = false;
  if (wf.endAt || wf.timeUp) return; // 見直しから戻った時はタイマーそのまま
  wf.endAt = startTimer(wf.minutes * 60, () => { wf.timeUp = true; wf.endAt = 0; if (S.game?.wf === wf) render(); }, fmtTime);
}
function wfReveal() {
  const g = S.game, wf = g.wf, n = S.members.length;
  stopTimer(); wf.endAt = 0;
  const c = Array(n).fill(0);
  wf.votes.forEach((t) => { if (t != null) c[t]++; });
  wf.counts = c;
  const max = Math.max(...c);
  wf.top = c.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0);
  wf.caught = wf.top.length === 1 && wf.top[0] === wf.wolf;
  g.turn++;
  wf.phase = "reveal";
}
// 負けた人：バレて逆転できず → 少数派だけ。逃げ切り・逆転 → 多数派全員
function wfLosers() {
  const wf = S.game.wf;
  if (wf.caught && !wf.guessed) return [wf.wolf];
  return S.members.map((_, i) => i).filter((i) => i !== wf.wolf);
}

// 多数派全員の罰：全員で同じ罰を1つ（人によって中身が変わるもの・「次の自分の番まで」系は外す）
function wfGroupBatsu() {
  if (Math.random() < CHANCE.lucky) return { lucky: true, html: esc(draw("lucky_group", DATA.batsu.lucky.filter((t) => !/\{[PXY]\}/.test(t))) || "セーフ！") };
  const pool = DATA.batsu.bad.filter((t) => !/\{[PXY]\}/.test(t) && !PERSONAL.test(t));
  return { lucky: false, html: esc(draw("batsu_group", pool) || "全員でひと口飲む（ソフドリでもOK）") };
}

// ---------- ピッタリ予想 ----------
// 数字のお題に1人ずつこっそり予想を入れる。答え合わせで一番遠い人が罰。誰かがピッタリなら罰2倍
function ptRound() {
  const g = S.game, pt = g.pt, n = S.members.length;
  pt.round++;
  const q = deckPop("pit_" + S.level, DATA.pittari[S.level]);
  pt.q = q.t; pt.u = q.u;
  pt.who = q.t.includes("{P}") ? (pt.round - 1) % n : -1; // 答える人（予想はせえへん）
  const all = S.members.map((_, k) => (pt.round - 1 + k) % n);
  pt.order = all.filter((i) => i !== pt.who);
  pt.guess = Array(n).fill(null);
  pt.k = 0; pt.input = ""; pt.answer = null; pt.losers = []; pt.exact = [];
  pt.phase = "q";
  g.phase = "play"; g.gacha = []; g.doer = pt.who;
}
const PT_MAX = 7; // 入力できる桁数
function ptKey(v) {
  const pt = S.game.pt;
  if (v === "del") pt.input = pt.input.slice(0, -1);
  else if (v === "clr") pt.input = "";
  else if (pt.input.length < PT_MAX) pt.input = pt.input === "0" ? v : pt.input + v;
}
function ptReveal() {
  const g = S.game, pt = g.pt;
  const d = pt.order.map((i) => Math.abs(pt.guess[i] - pt.answer));
  const max = Math.max(...d);
  pt.exact = pt.order.filter((i) => pt.guess[i] === pt.answer);
  pt.exact.forEach((i) => g.st.exact[i]++);
  // 全員同じ距離（全員ピッタリ含む）なら罰なし
  pt.losers = d.every((x) => x === max) ? [] : pt.order.filter((i, k) => d[k] === max);
  g.turn++;
  pt.phase = "reveal";
}

// ---------- 神経衰弱 ----------
// 裏向きのカードに「お題に関係するマーク」だけ（スマホのマークならスマホ系のお題）。同じお題の2枚を揃えたら全文が出て、答えたら+1点でもう1回。
// 答えられへんかったら罰ガチャ。ドクロはめくった瞬間に罰ガチャ（天使なら続けてめくれる）。最後に点数が一番低い人が罰
const MM_PAIRS = 7, MM_SKULLS = 2;
// マークにできるお題：「{P}、」で始まる1人用のお題で、マーク表のどれかの言葉が入ってるもの
const MARK_RE = DATA.marks.map(([re, m]) => [new RegExp(re), m]);
function markOf(t) {
  const s = t.replace(/\{[PXY]\}/g, "誰か");
  const hit = MARK_RE.find(([re]) => re.test(s));
  return hit ? hit[1] : null;
}
const mmOk = (t) => /^\{P\}、/.test(t) && usable(t) && !!markOf(t);
function mmDeal() {
  const g = S.game, n = S.members.length;
  g.doer = 0; g.cur = 0;
  // 夜・深夜はお題も夜寄りに混ぜる（下ネタNGの人がおる時は、誰が揃えるか分からんので混ぜへん）
  const pools = [DATA.odai[S.level]];
  if (S.night && !S.members.some((m) => m.ng)) pools.push(DATA.odai.yoru);
  if (S.night === "shinya" && !S.members.some((m) => m.ng)) pools.push(DATA.odai.shinya, DATA.odai.shinya);
  const used = new Set(), pairs = [];
  for (let k = 0; k < 400 && pairs.length < MM_PAIRS; k++) {
    const pool = pick(pools), t = pick(pool);
    if (!mmOk(t)) continue;
    const ch = markOf(t);
    if (used.has(ch)) continue;
    used.add(ch);
    pairs.push({ tpl: t, ch, yoru: pool === DATA.odai.yoru || pool === DATA.odai.shinya, deep: pool === DATA.odai.shinya });
  }
  const cards = [];
  pairs.forEach((p, id) => { cards.push({ id, ...p }, { id, ...p }); });
  for (let k = 0; k < MM_SKULLS; k++) cards.push({ id: -1 - k, skull: true, ch: "" });
  g.mm = { phase: "intro", cards: shuffle(cards).map((c) => ({ ...c, up: false, gone: false, owner: null })), open: [], score: Array(n).fill(0), pairs: pairs.length, done: 0, card: null, res: null, turns: 0 };
  g.turn = 0;
}
function mmNextPlayer() {
  const g = S.game;
  tickRule();
  g.cur = (g.cur + 1) % S.members.length;
  g.doer = g.cur;
  g.mm.turns++;
  g.mm.open = [];
  g.mm.phase = "pick";
}
function mmFlip(k) {
  const g = S.game, mm = g.mm, c = mm.cards[k];
  if (mm.phase !== "pick" || c.up || c.gone) return;
  c.up = true;
  mm.open.push(k);
  if (c.skull) {
    // ドクロ：その場で罰ガチャ。開いてた1枚目は裏に戻す
    c.gone = true;
    mm.open.filter((x) => x !== k).forEach((x) => (mm.cards[x].up = false));
    mm.open = [];
    g.add = new Map([[g.doer, 1]]); g.addReason = "skull";
    g.gacha = [{ i: g.doer, n: 1, ...drawBatsu(g.doer) }];
    g.phase = "batsu"; mm.phase = "skull";
    return;
  }
  if (mm.open.length < 2) return;
  const [a, b] = mm.open.map((x) => mm.cards[x]);
  if (a.id === b.id) {
    // 揃った！お題の全文を出す（{P}はめくった人）
    mm.card = makeCard(a.deep ? "深夜お題" : a.yoru ? "夜お題" : `アホお題・${LV[S.level]}`, a.tpl, g.doer, { noNg: a.yoru }, { yoru: a.yoru });
    mm.phase = "match";
  } else mm.phase = "miss";
}
// 揃ったお題の結果。答えたら+1点でもう1回、答えられへんかったら罰ガチャで次の人へ
function mmAnswer(ok) {
  const g = S.game, mm = g.mm;
  mm.open.forEach((x) => { mm.cards[x].gone = true; mm.cards[x].owner = ok ? g.doer : -1; });
  mm.done++; g.turn = mm.done;
  if (ok) {
    mm.score[g.doer]++;
    // 「次の自分の番まで〜」のお題は上に出す
    if (PERSONAL.test(mm.card.tpl)) addRule({ html: mm.card.html, left: untilNext(g.doer), who: g.doer });
    mm.open = []; mm.card = null;
    mm.phase = mm.done >= mm.pairs ? "over" : "pick";
  } else {
    mm.open = [];
    g.add = new Map([[g.doer, 1]]); g.addReason = "mfail";
    g.gacha = [{ i: g.doer, n: 1, ...drawBatsu(g.doer) }];
    g.phase = "batsu"; mm.phase = "fail";
  }
}
// 罰ガチャを受け入れた後
function mmAfterBatsu() {
  const g = S.game, mm = g.mm;
  const lucky = g.gacha.every((x) => x.lucky);
  applyAdds();
  g.gacha = []; g.phase = "play";
  if (mm.phase === "low") { mm.phase = "end"; return; }
  if (mm.done >= mm.pairs) { mm.phase = "over"; return; }
  // ドクロで天使が出たら、そのまま続けてめくれる
  if (mm.phase === "skull" && lucky) { mm.phase = "pick"; mm.open = []; return; }
  mmNextPlayer();
}
// 全部揃ったら、点数が一番低い人が罰ガチャ
function mmLowest() {
  const sc = S.game.mm.score, m = Math.min(...sc);
  return sc.map((v, i) => (v === m ? i : -1)).filter((i) => i >= 0);
}

// ---------- 価値観ナンバー ----------
// 全員にこっそり1〜100の数字。お題（例：怖いもの）に合わせて自分の数字っぽいものを言って、全員で小さい順に並べる。
// 答え合わせで、隣どうしの順番が逆になってた2人が罰
function itRound() {
  const g = S.game, it = g.it, n = S.members.length;
  it.round++;
  // 夜・深夜はお題も夜寄りに（下ネタNGの人がおる時は混ぜへん）
  let key = S.level;
  if (S.night && !S.members.some((m) => m.ng) && Math.random() < (S.night === "shinya" ? 0.6 : 0.3)) key = S.night === "shinya" && Math.random() < 0.6 ? "shinya" : "yoru";
  it.night = key === "yoru" || key === "shinya" ? key : false;
  it.topic = itTopic(key);
  const nums = shuffle(Array.from({ length: 100 }, (_, i) => i + 1)).slice(0, n);
  it.nums = nums;
  it.order = [];
  it.dealing = true;
  it.viewer = (it.round - 1) % n; // 配る順番も毎回ずらす
  it.seen = 0;
  it.phase = "hand";
  it.bad = [];
}
// お題の山札（文字列やないので普通の draw は使わへん）
function itTopic(key) {
  const k = "ito_" + key;
  if (!decks[k] || !decks[k].length) decks[k] = shuffle(DATA.ito[key]);
  return decks[k].pop();
}
// 並べた順で、隣どうしの数字が逆になってる2人
function itCheck() {
  const it = S.game.it, bad = new Set();
  for (let k = 1; k < it.order.length; k++) {
    const a = it.order[k - 1], b = it.order[k];
    if (it.nums[a] > it.nums[b]) { bad.add(a); bad.add(b); }
  }
  it.bad = [...bad];
  it.phase = "reveal";
  S.game.turn++;
}

// ---------- 時計（ジェスチャー・褒め殺し共通） ----------
// endAt まで数えて、0になったら onEnd を呼ぶ。画面は #modeTimer の数字だけ書き換える
let modeTimer = null;
function startTimer(sec, onEnd, fmt) {
  stopTimer();
  const endAt = Date.now() + sec * 1000;
  modeTimer = setInterval(() => {
    const left = endAt - Date.now();
    const el = document.getElementById("modeTimer");
    if (left <= 0) { stopTimer(); play("alarm"); if (navigator.vibrate) navigator.vibrate([80, 40, 160]); onEnd(); return; }
    if (el) { el.textContent = fmt ? fmt(left) : Math.ceil(left / 1000); el.classList.toggle("hurry", left < (fmt ? 30000 : 10000)); }
  }, 200);
  return endAt;
}
function stopTimer() { if (modeTimer) { clearInterval(modeTimer); modeTimer = null; } }

// ---------- 最初の人ルーレット（ジェスチャー・褒め殺し） ----------
// 名前のタイルを光らせながら回して、だんだん遅くなって1人に止まる
function spinRoulette(onDone) {
  S.spinning = true;
  const n = S.members.length, goal = rnd(n);
  const base = 16 + rnd(n);
  const steps = base + ((goal - (base % n) + n) % n); // steps % n === goal で止まる
  let k = 0, idx = 0;
  const tick = () => {
    idx = k % n;
    document.querySelectorAll(".roul-chip").forEach((el, j) => el.classList.toggle("on", j === idx));
    play("tick");
    if (navigator.vibrate) navigator.vibrate(5);
    if (k >= steps) { setTimeout(() => { S.spinning = false; onDone(idx); }, 450); return; }
    k++;
    const p = k / steps;
    setTimeout(tick, 55 + p * p * 330);
  };
  tick();
}

// ---------- 早押しジェスチャー ----------
// 番の人だけお題を見て、声を出さずに体で伝える。当てた人と演じた人に1点。全員1回ずつ演じたら終わり、点数が一番低い人が罰
function gsWord() {
  let key = S.level;
  if (S.night && !S.members.some((m) => m.ng) && Math.random() < (S.night === "shinya" ? 0.4 : 0.25)) key = S.night === "shinya" && Math.random() < 0.6 ? "shinya" : "yoru";
  return { text: draw("gs_" + key, DATA.gesture[key]), night: key === "yoru" || key === "shinya" ? key : false };
}
function gsStart() {
  const g = S.game, gs = g.gs;
  gs.phase = "act"; gs.got = 0; gs.word = gsWord();
  gs.endAt = startTimer(gs.sec, () => { gs.phase = "timeup"; render(true); });
}
function gsHit(i) {
  const g = S.game, gs = g.gs;
  gs.score[i]++; gs.score[gs.actor]++; gs.got++; g.turn++;
  gs.last = i;
  gs.word = gsWord();
}
function gsNextActor() {
  const g = S.game, gs = g.gs;
  gs.acted++;
  if (gs.acted >= S.members.length) { gs.phase = "over"; return; }
  gs.actor = (gs.actor + 1) % S.members.length;
  g.doer = g.cur = gs.actor;
  gs.phase = "hand";
}
function gsLowest() {
  const sc = S.game.gs.score, m = Math.min(...sc);
  return sc.map((v, i) => (v === m ? i : -1)).filter((i) => i >= 0);
}

// ---------- 褒め殺し ----------
// 番の人がランダムな1人を褒め続ける。褒められた側が笑ったり照れたりしたら褒められた側の負け、時間いっぱい耐えたら褒めた側の負け
function hmRound() {
  const g = S.game, hm = g.hm;
  hm.target = pick(others(hm.praiser));
  const night = S.night && okForYoru(hm.target) && okForYoru(hm.praiser) && Math.random() < (S.night === "shinya" ? 0.5 : 0.3);
  const key = night ? (S.night === "shinya" && Math.random() < 0.6 ? "shinya" : "yoru") : "normal";
  hm.theme = draw("hm_" + key, DATA.homeru[key]);
  hm.night = key === "normal" ? false : key;
  hm.loser = null;
  hm.phase = "ready";
  g.doer = g.cur = hm.praiser;
}
function hmLose(i) {
  const g = S.game, hm = g.hm;
  stopTimer();
  hm.loser = i;
  g.turn++;
  g.add = new Map([[i, 1]]); g.addReason = i === hm.target ? "hmlaugh" : "hmfail";
  g.gacha = [{ i, n: 1, ...drawBatsu(i) }];
  g.phase = "batsu"; hm.phase = "batsu";
}
