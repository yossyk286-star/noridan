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
// 保存データが壊れてても起動できるように：配列で、名前は文字列10文字まで、12人まで、同じ名前は1人だけ
const cleanMembers = (v) => {
  if (!Array.isArray(v)) return null;
  const seen = new Set(), out = [];
  for (const m of v) {
    const name = String(m?.name ?? "").trim().slice(0, 10);
    if (!name || seen.has(name)) continue;
    seen.add(name); out.push(m.ng ? { name, ng: true } : { name });
    if (out.length >= 12) break;
  }
  return out.length ? out : null;
};
const loadGroups = () => (Array.isArray(store.get("nd_groups", [])) ? store.get("nd_groups", []) : []).map(cleanMembers).filter(Boolean).slice(0, 3);
const EXAMPLE = [
  { name: "よし" },
  { name: "たく" },
  { name: "まゆ" },
];

const S = {
  screen: "home", hist: [], ask: null,
  members: cleanMembers(store.get("nd_members", null)) || EXAMPLE.map((m) => ({ ...m })),
  isExample: cleanMembers(store.get("nd_members", null)) === null,
  level: ((v) => (v in LV ? v : "futsu"))(store.get("nd_level", "futsu")),
  night: (() => { const v = store.get("nd_night", false); return v === true ? "yoru" : v === "yoru" || v === "shinya" ? v : false; })(), // false | "yoru" | "shinya"
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
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
const MODE_NAME = { odai: "アホお題", sugoroku: "すごろく", memory: "神経衰弱", ito: "価値観ナンバー", gesture: "早押しジェスチャー", homeru: "褒め殺し", ngword: "NGワード", vote: "ぶっちゃけ投票", wolf: "ワードウルフ", pittari: "ピッタリ予想", tilt: "傾けたらアウト", shake: "全力シェイク", stop: "ピタッとストップ", rtap: "ロシアンタップ", bpass: "爆弾パス", hilo: "ハイ&ロー", reflex: "反射神経バトル", voice: "声デカ選手権" };
const isStage = (sc) => sc in MODE_NAME;
// 結果画面などの「アホお題・普通・12ターン」。NGワードは地獄度を使わへん
const modeLine = (g) => g.mode === "ngword" ? `NGワード・${LV[S.level]}・アウト${g.pen.reduce((a, b) => a + b, 0)}回` : `${MODE_NAME[g.mode]}・${LV[S.level]}・${g.turn || "-"}${g.mode === "vote" || g.mode === "ito" || g.mode === "pittari" ? "問" : g.mode === "wolf" ? "回戦" : g.mode === "tilt" ? "回挑戦" : ["shake", "stop", "rtap", "bpass", "hilo", "reflex", "voice"].includes(g.mode) ? "回戦" : g.mode === "memory" ? "ペア" : g.mode === "gesture" ? "問正解" : g.mode === "homeru" ? "回" : "ターン"}`;
function newGame(mode, again = false) {
  S.scores = false; S.bombLook = 0; S.hist = []; S.ask = null; S.prevPen = null;
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
  if (mode === "wolf") { S.game.doer = -1; S.game.wf = { phase: "intro", round: 0, minutes: store.get("nd_wf_min", 3), count: store.get("nd_wf_n", 0), peace: store.get("nd_wf_peace", true), wolves: [] }; render(true); return; }
  if (mode === "rtap") { S.game.doer = -1; S.game.rt = { phase: "intro", round: 0 }; if (again) rtRound(); render(true); return; }
  if (mode === "bpass") { S.game.doer = -1; S.game.bp = { phase: "intro", round: 0 }; if (again) bpRound(); render(true); return; }
  if (mode === "hilo") { S.game.doer = -1; S.game.hl = { phase: "intro", round: 0, best: 0, hits: Array(n).fill(0) }; if (again) hlRound(); render(true); return; }
  if (mode === "reflex") { S.game.doer = -1; S.game.rf = { phase: "intro", style: store.get("nd_rfstyle", "solo") === "multi" ? "multi" : "solo", round: 0, k: 0, res: Array(n).fill(null), best: Array(n).fill(null), losers: [], timers: [] }; render(true); return; }
  if (mode === "voice") { S.game.doer = -1; S.game.vc = { phase: "intro", round: 0, k: 0, res: Array(n).fill(null), best: Array(n).fill(null), losers: [] }; render(true); return; }
  if (mode === "stop") { S.game.doer = -1; S.game.sp = { phase: "intro", dir: ((v) => (["up", "blind"].includes(v) ? v : "down"))(store.get("nd_spdir", "down")), round: 0, k: 0, res: Array(n).fill(null), best: Array(n).fill(null), exact: Array(n).fill(0), losers: [] }; render(true); return; }
  if (mode === "shake") { S.game.doer = -1; S.game.sk = { phase: "intro", round: 0, k: 0, cnt: Array(n).fill(null), best: Array(n).fill(null), tapped: Array(n).fill(false), losers: [] }; render(true); return; }
  if (mode === "tilt") { S.game.doer = -1; S.game.tl = { phase: "intro", k: 0, max: Array(n).fill(null), tries: Array(n).fill(0), outs: Array(n).fill(0) }; render(true); return; }
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
const DOUBLEABLE = /ひと口|ふた口|飲む|\d+\s*(秒|回|つ|個|件|枚|小節|連発|発|杯|周|曲|本|段|行|文字)|[一二三]回/;
const canDouble = (t) => DOUBLEABLE.test(t) && !PERSONAL.test(t);
// 罰2倍：お題の中の数を全部倍にする（「無理なら〜」の方も。「10秒以内」みたいな制限時間は倍にしたら楽になるので除く）。元の数は赤い取り消し線、倍の数を横に出す
const KAN = { 一: 1, 二: 2, 三: 3 };
const X2_RE = /(\d+)(\s*)(秒|回|つ|個|件|枚|小節|連発|発|杯|周|曲|本|段|行|文字)(?!以内)|ひと口|ふた口|([一二三])回/g;
function doubleAll(t, n = 2) {
  const out = [];
  t.replace(X2_RE, (m, num, sp, unit, kan, at) => {
    const to = num ? `${+num * n}${sp}${unit}` : m === "ひと口" ? (n === 2 ? "ふた口" : `${n}口`) : m === "ふた口" ? `${2 * n}口` : `${KAN[kan] * n}回`;
    out.push({ at, from: m, to });
    return m;
  });
  if (!out.length) { const k = t.indexOf("飲む"); if (k >= 0) out.push({ at: k, from: "飲む", to: `${n}回飲む` }); }
  return out;
}
const doubleText = (t, n = 2) => doubleAll(t, n)[0] || null;
function doubleWith(html, n, fmt) {
  if (n < 2) return html;
  let res = "", last = 0;
  doubleAll(html, n).forEach((d) => { res += html.slice(last, d.at) + fmt(d); last = d.at + d.from.length; });
  return res + html.slice(last);
}
const doubleHtml = (html, n) => doubleWith(html, n, (d) => `<s class="x2-old">${d.from}</s><ins class="x2-new">${d.to}</ins>`);
const doubledPlain = (html, n) => doubleWith(html, n, (d) => d.to);
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
function resolveCell(me, pre = "", depth = 0) {
  const g = S.game;
  const c = DATA.board[g.pos[me]];
  const head = `${pre}${g.pos[me]}マス目`;
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
    // 進むマス：進んだ先のマスのお題もやる（進んだ先がまた進む・戻るなら、そこで止まる）
    if (c.value > 0 && g.pos[me] < GOAL && !depth) { resolveCell(me, `${c.label}で+${c.value}→`, 1); return; }
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
  if (g.mode === "tilt" && g.tl) { const tl = g.tl, ok = S.members.map((_, i) => i).filter((i) => tl.tries[i] && tl.max[i] != null); if (ok.length > 1) { const m = Math.min(...ok.map((i) => tl.max[i])); add("鋼の手", ok.filter((i) => tl.max[i] === m), `最大でも ${m.toFixed(1)}°`); } }
  if (g.mode === "reflex" && g.rf) { const ok = S.members.map((_, i) => i).filter((i) => g.rf.best[i] != null); if (ok.length > 1) { const m = Math.min(...ok.map((i) => g.rf.best[i])); add("反射神経王", ok.filter((i) => g.rf.best[i] === m), `最速 ${m}ミリ秒`); } }
  if (g.mode === "voice" && g.vc) { const b = g.vc.best.map((v) => v ?? 0); const t = top(b, 1); if (t) add("声量おばけ", t, `最大 ${b[t[0]]}`); }
  if (g.mode === "hilo" && g.hl) { const t = top(g.hl.hits, 2); if (t) add("読みの達人", t, `当てた ${g.hl.hits[t[0]]}回`); }
  if (g.mode === "stop" && g.sp) { const t = top(g.sp.exact, 1); if (t) add("ピタ止め職人", t, `ピッタリ ${g.sp.exact[t[0]]}回`); }
  if (g.mode === "shake" && g.sk) { const b = g.sk.best.map((v) => v ?? 0); const t = top(b, 1); if (t && S.members.length > 1) add("シェイク王", t, `10秒で ${b[t[0]]}回`); }
  if (g.mode === "wolf") { const w = top(st.wolf, 1); if (w) add("名演技", w, `ウルフで逃げ切り ${st.wolf[w[0]]}回`); }
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
    return g.gacha.map((x) => `${S.members[x.i].name}${x.lucky ? "はセーフ。" : x.n > 1 ? "の罰、2倍。" : "の罰。"}${plain(x.lucky ? x.html : doubledPlain(x.html, x.n))}`).join("。");
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
// 残り10秒：画面のフチが赤く脈打って、1秒ごとにカチッ
let hurrySec = -1;
function hurryFx(left) {
  if (left > 10000 || left <= 0) { hurryOff(); return; }
  document.body.classList.add("hurry10");
  const sec = Math.ceil(left / 1000);
  if (sec !== hurrySec) { hurrySec = sec; play("hurry"); if (navigator.vibrate) navigator.vibrate(8); }
}
function hurryOff() { hurrySec = -1; document.body.classList.remove("hurry10"); }
const fmtTime = (ms) => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
setInterval(() => {
  const g = S.game;
  if (S.screen !== "ngword" || !g?.ng || g.ng.phase !== "play" || !g.ng.endAt) { if (!modeTimer && document.body.classList.contains("hurry10")) hurryOff(); return; }
  const left = g.ng.endAt - Date.now();
  hurryFx(left);
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
// 全員にお題。ウルフだけちょっと違うお題で、自分がどっちかは分からへん。話して投票（「ウルフはおらん」も選べる）。
// ・ウルフがおる回：一番票が多いのがウルフの誰かなら市民の勝ち（ただしウルフが市民のお題を当てたら逆転）。
//   市民・同票・「おらん」が一番なら、ウルフの勝ちで市民全員の負け
// ・全員市民の回（4人以上、たまに）：「おらん」に入れんかった人（誰かを疑った人）の負け
const WF_MIN = [2, 3, 5];
const WF_NONE = -1; // 投票の「ウルフはおらん」
const wfAuto = (n) => (n >= 10 ? 3 : n >= 7 ? 2 : 1);
const wfMax = (n) => Math.max(1, Math.min(3, Math.floor((n - 1) / 2))); // ウルフは半分未満
const wfCount = (wf, n) => Math.min(wfMax(n), wf.count || wfAuto(n));
const wfPeaceOk = (wf, n) => wf.peace && n >= 4;
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
  // 全員市民の回は6回に1回くらい
  wf.allCit = wfPeaceOk(wf, n) && Math.random() < 1 / 6;
  wf.wolves = wf.allCit ? [] : shuffle(S.members.map((_, i) => i)).slice(0, wfCount(wf, n)).sort((x, y) => x - y);
  const s0 = (wf.round - 1) % n;
  wf.order = S.members.map((_, k) => (s0 + k) % n);
  wf.viewer = wf.order[0]; wf.dealt = 0; wf.dealing = true;
  wf.votes = Array(n).fill(null); wf.k = 0;
  wf.timeUp = false; wf.endAt = 0; wf.top = []; wf.caught = false; wf.guessed = null;
  wf.phase = "hand";
  g.phase = "play"; g.gacha = []; g.doer = -1;
}
const isWolf = (i) => S.game.wf.wolves.includes(i);
const wfWord = (i) => (isWolf(i) ? S.game.wf.min : S.game.wf.maj);
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
  let none = 0;
  wf.votes.forEach((t) => { if (t === WF_NONE) none++; else if (t != null) c[t]++; });
  wf.counts = c; wf.none = none;
  const max = Math.max(...c, none);
  wf.top = c.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0);
  if (none === max) wf.top.push(WF_NONE);
  wf.caught = !wf.allCit && wf.top.length === 1 && isWolf(wf.top[0]);
  g.turn++;
  wf.phase = "reveal";
}
// 負けた人：全員市民 → 誰かを疑った人。バレて逆転できず → ウルフ。逃げ切り・逆転 → 市民全員
function wfLosers() {
  const wf = S.game.wf;
  if (wf.allCit) return S.members.map((_, i) => i).filter((i) => wf.votes[i] !== WF_NONE);
  if (wf.caught && !wf.guessed) return [...wf.wolves];
  return S.members.map((_, i) => i).filter((i) => !isWolf(i));
}
const wolfNames = () => S.game.wf.wolves.map((i) => esc(S.members[i].name)).join("・");

// 市民全員の罰：全員で同じ罰を1つ（人によって中身が変わるもの・「次の自分の番まで」系は外す）
function wfGroupBatsu() {
  if (Math.random() < CHANCE.lucky) return { lucky: true, html: esc(draw("lucky_group", DATA.batsu.lucky.filter((t) => !/\{[PXY]\}/.test(t))) || "セーフ！") };
  const pool = DATA.batsu.bad.filter((t) => !/\{[PXY]\}/.test(t) && !PERSONAL.test(t));
  return { lucky: false, html: esc(draw("batsu_group", pool) || "全員でひと口飲む（ソフドリでもOK）") };
}

// ---------- 傾けたらアウト ----------
// 画面を上にしてスマホを手のひらに乗せる。スタートした瞬間の向きを0°にして、10秒キープ。
// 地獄度の角度（ゆるめ5°・普通3°・地獄1°）を超えたらアウトで罰。周りは触らんかったら邪魔してOK
const TILT_SEC = 10;
const TILT_LIMIT = { yurume: 5, futsu: 3, jigoku: 1 };
const tiltLimit = () => TILT_LIMIT[S.level] || 4;
const tiltSensor = { beta: null, gamma: null, at: 0, on: false, perm: "unknown" }; // perm: unknown / granted / denied / none
const tiltVec = (b, g) => { const B = (b * Math.PI) / 180, G = (g * Math.PI) / 180; return [Math.cos(B) * Math.sin(G), -Math.sin(B), Math.cos(B) * Math.cos(G)]; };
const tiltAngle = (v, w) => (Math.acos(Math.max(-1, Math.min(1, v[0] * w[0] + v[1] * w[1] + v[2] * w[2]))) * 180) / Math.PI;
function tiltListen() {
  if (tiltSensor.on || typeof window.DeviceOrientationEvent === "undefined") return;
  tiltSensor.on = true;
  window.addEventListener("deviceorientation", (e) => {
    if (e.beta == null || e.gamma == null) return;
    tiltSensor.beta = e.beta; tiltSensor.gamma = e.gamma; tiltSensor.at = Date.now();
    tiltTick();
  });
}
// iPhone は押したタイミングで許可を取る必要がある
async function tiltAsk() {
  if (typeof window.DeviceOrientationEvent === "undefined") { tiltSensor.perm = "none"; return; }
  try {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      const r = await DeviceOrientationEvent.requestPermission();
      tiltSensor.perm = r === "granted" ? "granted" : "denied";
    } else tiltSensor.perm = "granted";
  } catch { tiltSensor.perm = "denied"; }
  if (tiltSensor.perm === "granted") tiltListen();
}
const tiltLive = () => tiltSensor.at && Date.now() - tiltSensor.at < 1500; // センサーの値が来てるか
function tiltBegin() {
  const tl = S.game.tl, n = S.members.length;
  tl.who = (tl.k) % n;
  tiltHeat(0);
  S.game.doer = tl.who;
  tl.phase = "hand"; tl.angle = 0; tl.peak = 0; tl.outAt = 0; tl.manual = false;
}
// 3・2・1のカウントダウン（傾けたらアウト・全力シェイク・ピタッとストップ共通）。st.n を減らして描き直し、0で go
function count3(st, go, ms) {
  st.phase = "count"; st.n = 3;
  const step = () => {
    if (!Object.values(S.game || {}).includes(st) || st.phase !== "count") return;
    st.n--;
    if (st.n <= 0) { go(); return; }
    play("tick"); render(); setTimeout(step, ms);
  };
  play("tick"); setTimeout(step, ms);
}
function tiltCount() { count3(S.game.tl, tiltGo, 800); }
function tiltGo() {
  const tl = S.game.tl;
  tl.manual = !tiltLive();
  tl.base = tl.manual ? null : tiltVec(tiltSensor.beta, tiltSensor.gamma);
  tl.phase = "play"; tl.angle = 0; tl.peak = 0; tl.startAt = Date.now();
  play("coin");
  tl.endAt = Date.now() + TILT_SEC * 1000; tl.sec = TILT_SEC;
  render(true);
  tiltClock(tl);
}
// 残り秒数：1秒ごとにドクンと跳ねて、目盛りが1個ずつ消える。ラスト3秒は赤
function tiltClock(tl) { secClock(tl, () => S.game?.tl === tl, tiltSafe); }
// 10秒の大きい時計（傾けたらアウト・全力シェイク共通）。st.endAt まで数えて onEnd
function secClock(tl, alive, onEnd) {
  stopTimer();
  const paint = () => {
    if (!alive() || tl.phase !== "play") { stopTimer(); return; }
    const left = tl.endAt - Date.now();
    if (left <= 0) { stopTimer(); onEnd(); return; }
    const sec = Math.ceil(left / 1000), clock = document.getElementById("tlClock");
    if (!clock) return;
    const s = Math.floor(left / 1000), f = Math.floor((left % 1000) / 100);
    clock.querySelector("#tlSec").textContent = s;
    clock.querySelector("#tlFrac").textContent = "." + f;
    clock.style.setProperty("--f", ((left % 1000) / 1000).toFixed(3));
    clock.querySelectorAll(".tl-pip").forEach((p, i) => { p.classList.toggle("on", i < sec - 1); p.classList.toggle("now", i === sec - 1); });
    if (sec !== tl.sec) {
      tl.sec = sec;
      clock.classList.toggle("hurry", sec <= 3);
      clock.classList.remove("beat"); void clock.offsetWidth; clock.classList.add("beat");
      play("tick");
    }
  };
  paint();
  modeTimer = setInterval(paint, 50);
}
// 角度が来るたび：表示を更新して、超えたらアウト
function tiltTick() {
  const tl = S.game?.tl;
  if (!tl || tl.phase !== "play" || !tl.base || S.screen !== "tilt") return;
  const a = tiltAngle(tl.base, tiltVec(tiltSensor.beta, tiltSensor.gamma));
  tl.angle = a; if (a > tl.peak) tl.peak = a;
  if (a > tiltLimit()) { tiltOut(); return; }
  if (!tl.raf) tl.raf = requestAnimationFrame(() => { tl.raf = 0; tiltPaint(); });
}
// 限界に近づくほど画面のフチを赤く・太く（0〜1）。0.8を超えたら画面がブルブル
let tiltHeatNow = -1;
function tiltHeat(r) {
  r = Math.max(0, Math.min(1, r));
  if (Math.abs(r - tiltHeatNow) < 0.01 && r !== 0 && r !== 1) return;
  tiltHeatNow = r;
  const b = document.body;
  b.style.setProperty("--tr", r.toFixed(3));
  b.classList.toggle("tl-hot", r > 0);
  b.classList.toggle("tl-edge", r >= 0.8 && r < 1);
}
function tiltPaint() {
  const tl = S.game?.tl; if (!tl) return;
  if (tl.phase === "play" && !tl.manual) tiltHeat(tl.angle / tiltLimit());
  const el = document.getElementById("tiltDeg"); if (el) el.textContent = tl.angle.toFixed(1);
  const dot = document.getElementById("tiltDot");
  if (dot && tl.base) {
    const lim = tiltLimit(), v = tiltVec(tiltSensor.beta, tiltSensor.gamma);
    // 0°からのずれを左右・前後に分けて、限界の角度でちょうど円のフチに来るように
    const dx = Math.asin(Math.max(-1, Math.min(1, v[0] - tl.base[0]))) * 180 / Math.PI, dy = Math.asin(Math.max(-1, Math.min(1, v[1] - tl.base[1]))) * 180 / Math.PI;
    dot.style.transform = `translate(${Math.max(-1.2, Math.min(1.2, dx / lim)) * 50}%, ${Math.max(-1.2, Math.min(1.2, -dy / lim)) * 50}%)`;
    // 限界まで残り1°でオレンジ、0.5°で赤（地獄の1°は半分ずつ：0.5°・0.25°）
    const rem = lim - tl.angle, o = Math.min(1, lim / 2), r = Math.min(0.5, lim / 4);
    dot.classList.toggle("warn", rem <= o && rem > r);
    dot.classList.toggle("crit", rem <= r);
  }
}
function tiltOut() {
  const g = S.game, tl = g.tl;
  stopTimer();
  tiltHeat(1);
  tl.phase = "judge"; tl.outAt = Date.now();
  tl.tries[tl.who]++; tl.outs[tl.who]++;
  if (!tl.manual) tl.max[tl.who] = Math.max(tl.max[tl.who] ?? 0, tl.peak);
  g.turn++;
  // ちょっとためてから判定を出す
  tl.phase = "out"; play("boom"); if (navigator.vibrate) navigator.vibrate([120, 60, 200]);
  render(true);
}
function tiltSafe() {
  const g = S.game, tl = g.tl;
  stopTimer();
  tiltHeat(0);
  tl.phase = "judge";
  tl.tries[tl.who]++;
  if (!tl.manual) tl.max[tl.who] = Math.max(tl.max[tl.who] ?? 0, tl.peak);
  g.turn++;
  tl.phase = "safe"; play("fanfare");
  render(true);
}

// ---------- 全力シェイク ----------
// 1人ずつ10秒間スマホを振って、振った回数を数える。全員振ったら一番少ない人が罰（地獄は2倍）
// 縦・横・前後どの向きでもOK。強い加速度の向きが切り返すのを見て、1往復（振り下ろして戻す）で1回。
// 激しく振ると加速度が下がりきらへんので、強さが落ちるのを待たんと向きで数える。センサーが無いスマホは画面の連打
const SK_SEC = 10;
const SK_HI = 10; // m/s²（重力ぬき）。これより強い揺れだけ数える
const SK_GAP = 70; // ms。これより短い間隔は同じ1回
const skSensor = { at: 0, on: false, perm: "unknown", g: null };
function skListen() {
  if (skSensor.on || typeof window.DeviceMotionEvent === "undefined") return;
  skSensor.on = true;
  window.addEventListener("devicemotion", (e) => {
    let a = e.acceleration, x, y, z;
    if (a && a.x != null) { x = a.x; y = a.y; z = a.z; }
    else {
      const G = e.accelerationIncludingGravity; if (!G || G.x == null) return;
      // 重力をゆっくり追いかけて引く
      const g = skSensor.g || (skSensor.g = [G.x, G.y, G.z]);
      for (let k = 0; k < 3; k++) g[k] += ([G.x, G.y, G.z][k] - g[k]) * 0.1;
      x = G.x - g[0]; y = G.y - g[1]; z = G.z - g[2];
    }
    skSensor.at = Date.now();
    skTick(x, y, z);
  });
}
async function skAsk() {
  if (typeof window.DeviceMotionEvent === "undefined") { skSensor.perm = "none"; return; }
  try {
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      const r = await DeviceMotionEvent.requestPermission();
      skSensor.perm = r === "granted" ? "granted" : "denied";
    } else skSensor.perm = "granted";
  } catch { skSensor.perm = "denied"; }
  if (skSensor.perm === "granted") skListen();
}
const skLive = () => skSensor.at && Date.now() - skSensor.at < 1500;
// 今回の順番（毎回スタートの人をずらす）
const skWho = (sk) => (sk.k + sk.round - 1) % S.members.length;
function skBegin() {
  const sk = S.game.sk;
  sk.who = skWho(sk);
  S.game.doer = sk.who;
  sk.phase = "hand"; sk.cur = 0; sk.dir = null; sk.mag = 0; sk.manual = false;
}
function skCount() { count3(S.game.sk, skGo, 800); }
function skGo() {
  const sk = S.game.sk;
  sk.manual = !skLive();
  sk.phase = "play"; sk.cur = 0; sk.dir = null; sk.flip = 0; sk.last = 0;
  sk.endAt = Date.now() + SK_SEC * 1000; sk.sec = SK_SEC;
  play("coin");
  render(true);
  secClock(sk, () => S.game?.sk === sk, skDone);
}
function skTick(x, y, z) {
  const sk = S.game?.sk;
  if (!sk || sk.phase !== "play" || sk.manual || S.screen !== "shake") return;
  const mag = Math.hypot(x, y, z);
  sk.mag = mag;
  if (mag > SK_HI && Date.now() - sk.last > SK_GAP) {
    const u = [x / mag, y / mag, z / mag], d = sk.dir;
    // 最初の1回か、前に数えた向きと逆向き（切り返し）なら1回
    if (!d) sk.dir = u;
    else if (u[0] * d[0] + u[1] * d[1] + u[2] * d[2] < -0.3) {
      // 切り返しは1往復で2回来るので、1回おきに数える
      sk.dir = u; sk.flip = (sk.flip || 0) + 1; sk.last = Date.now();
      if (sk.flip % 2 === 1) skHit();
    }
  }
  if (!sk.raf) sk.raf = requestAnimationFrame(() => { sk.raf = 0; skPaint(); });
}
function skHit() {
  const sk = S.game.sk;
  sk.cur++; sk.last = Date.now();
  const el = document.getElementById("skCnt");
  if (el) { el.textContent = sk.cur; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
  const ph = document.getElementById("skPhone");
  if (ph) ph.style.setProperty("--r", (sk.cur % 2 ? 1 : -1) * 16 + "deg");
}
function skPaint() {
  const sk = S.game?.sk; if (!sk) return;
  const m = document.getElementById("skMeter");
  if (m) m.style.setProperty("--m", Math.min(1, sk.mag / 40).toFixed(3));
}
function skDone() {
  const g = S.game, sk = g.sk;
  stopTimer();
  sk.cnt[sk.who] = sk.cur;
  if (sk.cur > (sk.best[sk.who] ?? -1)) sk.best[sk.who] = sk.cur;
  if (sk.manual) sk.tapped[sk.who] = true;
  g.turn++;
  play("fanfare"); if (navigator.vibrate) navigator.vibrate([250, 120, 250]); // タイムアップの「ブブッ」（Androidだけ。iPhoneのブラウザはバイブ不可）
  if (sk.k + 1 >= S.members.length) {
    // 全員振った：ドラムロールでためてから順位発表
    const min = Math.min(...sk.cnt);
    sk.losers = S.members.map((_, i) => i).filter((i) => sk.cnt[i] === min);
    sk.phase = "tally";
    hold("結果は…", 1800, () => { sk.phase = "rank"; g.doer = -1; });
    return;
  }
  sk.phase = "done";
  render(true);
}
function skRound() {
  const sk = S.game.sk;
  sk.round++; sk.k = 0; sk.cnt = Array(S.members.length).fill(null); sk.losers = [];
  skBegin();
}

// ---------- ピタッとストップ ----------
// 数字が減っていく（or 増えていく）のを、0（or 目標の秒数）ちょうどで止める。行き過ぎたらオーバーでアウト。
// ゆるめ＝ふつうの速さ／普通＝最初に見せた倍率（×0.5・×1.5・×2）でずっと進む／地獄＝それに加えて数字が消えたり邪魔が入ったり
// 全員1回ずつ止めたら答え合わせ：オーバーした人が罰。誰もオーバーしてへんかったら一番遠い人が罰。ピッタリが出たら罰2倍
const SP_RATES = [0.5, 1.5, 2];
const SP_OVER = 1.5; // これだけ行き過ぎたら勝手に止まる
const spLen = (sp) => sp.target; // 動く秒数（表示上）
function spRound() {
  const sp = S.game.sp;
  sp.round++; sp.k = 0; sp.res = Array(S.members.length).fill(null); sp.losers = []; sp.exactAny = false;
  spBegin();
}
const spWho = (sp) => (sp.k + sp.round - 1) % S.members.length;
function spBegin() {
  const sp = S.game.sp;
  sp.who = spWho(sp); S.game.doer = sp.who;
  // 普通・地獄はこの番の倍率を先に決めて見せる。止めるまでずっとこの倍率（体内時計はふつうの速さ）
  sp.rate = S.level === "yurume" || sp.dir === "blind" ? 1 : SP_RATES[rnd(SP_RATES.length)];
  // 目標の秒数は1人ずつ。実際にかかる時間が10秒を超えんように（×0.5の時は3〜5、それ以外は6〜10）
  sp.target = sp.rate < 1 ? 3 + rnd(3) : 6 + rnd(5);
  sp.phase = "hand";
}
function spCount() { count3(S.game.sp, spGo, 700); }
// 表示上の経過（0→target）。dir=down なら target-経過 を見せる
function spGo() {
  const sp = S.game.sp, now = performance.now();
  sp.phase = "play"; sp.el = 0; sp.t0 = now; sp.prev = now;
  sp.hideUntil = 0; sp.nextHide = now + 1400 + Math.random() * 1500;
  sp.jamUntil = 0; sp.jamVal = 0; sp.nextJam = now + 1100 + Math.random() * 1600;
  play("coin");
  render(true);
  cancelAnimationFrame(sp.raf);
  const loop = (t) => {
    if (S.game?.sp !== sp || sp.phase !== "play") return;
    const dt = (t - sp.prev) / 1000; sp.prev = t;
    sp.el += dt * sp.rate;
    if (S.level === "jigoku" && sp.dir !== "blind") {
      // 数字が消える
      if (t > sp.nextHide && sp.hideUntil < t) { sp.hideUntil = t + 600 + Math.random() * 900; sp.nextHide = sp.hideUntil + 900 + Math.random() * 1500; }
      // 邪魔：ウソの数字がチラッと出る・画面がブレる
      if (t > sp.nextJam && sp.jamUntil < t) { sp.jamUntil = t + 220 + Math.random() * 200; sp.jamVal = Math.random() * sp.target; sp.jamKind = rnd(2); sp.nextJam = sp.jamUntil + 700 + Math.random() * 1400; if (sp.jamKind === 1) play("tick"); }
    }
    if (sp.el - spLen(sp) > SP_OVER) { spStop(true); return; }
    spPaint(t);
    sp.raf = requestAnimationFrame(loop);
  };
  sp.raf = requestAnimationFrame(loop);
}
const spFmt = (v) => { const r = Math.round(v * 100) / 100; return (r < 0 ? "-" : "") + Math.abs(r).toFixed(2); }; // -0.00 にならんように
function spShown(sp, el) { return sp.dir === "down" ? sp.target - el : el; }
// 体内時計：最初だけ数字が見えて、あとは頭の中で数える（ゆるめ3秒・普通1秒・地獄0秒）
const SP_PEEK = { yurume: 3, futsu: 1, jigoku: 0 };
function spPaint(t) {
  const sp = S.game.sp, num = document.getElementById("spNum"), box = document.getElementById("spBox");
  if (!num || !box) return;
  const hide = t < sp.hideUntil || (sp.dir === "blind" && sp.el >= (SP_PEEK[S.level] ?? 1)), jam = t < sp.jamUntil;
  num.textContent = hide ? "??.??" : jam && sp.jamKind === 0 ? spFmt(spShown(sp, sp.jamVal)) : spFmt(spShown(sp, sp.el));
  box.classList.toggle("hide", hide);
  box.classList.toggle("jam", jam);
  box.classList.toggle("over", !hide && sp.el > spLen(sp));
  const badge = document.getElementById("spRate");
  if (badge) { const on = sp.rate !== 1; badge.classList.toggle("on", on); if (on) badge.textContent = `×${sp.rate}`; }
}
function spStop(auto = false) {
  const g = S.game, sp = g.sp;
  if (sp.phase !== "play") return;
  cancelAnimationFrame(sp.raf);
  sp.el += (performance.now() - sp.prev) / 1000 * sp.rate;
  const diff = Math.round((spLen(sp) - sp.el) * 100) / 100; // ＋なら手前、−ならオーバー
  const over = diff < 0, exact = diff === 0;
  sp.res[sp.who] = { v: spShown(sp, sp.el), diff, over, exact };
  if (exact) { sp.exactAny = true; sp.exact[sp.who]++; }
  if (!over && (sp.best[sp.who] == null || diff < sp.best[sp.who])) sp.best[sp.who] = diff;
  g.turn++;
  // まず止めた秒数だけ見せて、ボタンで答え合わせ
  play("pop");
  sp.phase = "check";
  sp.after = sp.k + 1 >= S.members.length ? "rank" : "done";
  if (sp.after === "rank") {
    const r = sp.res, idx = S.members.map((_, i) => i);
    const overs = idx.filter((i) => r[i].over);
    if (overs.length) sp.losers = overs;
    else { const far = Math.max(...idx.map((i) => r[i].diff)); sp.losers = far > 0 ? idx.filter((i) => r[i].diff === far) : []; }
  }
  render(true);
}

// 止めた秒数を見たあと：結果を出す
function spReveal() {
  const sp = S.game.sp, r = sp.res[sp.who];
  // ちょっとためてから判定。最後の人はそのまま順位発表まで
  const go = () => {
    if (r.over) { play("boom"); if (navigator.vibrate) navigator.vibrate([120, 60, 200]); }
    else if (sp.after !== "rank") play(r.exact ? "fanfare" : "coin");
    sp.phase = sp.after;
    if (sp.phase === "rank") S.game.doer = -1;
  };
  // 1人ずつの判定はすぐ。最後の人のあとの順位発表だけためる
  if (sp.after === "rank") hold("結果は…", 1800, go);
  else { go(); render(true); }
}

// ---------- ロシアンタップ ----------
// パネルを順番に1枚ずつめくる。1枚だけ爆弾で、めくった人が罰（地獄度でパネルの数が減る）
const RT_TILES = { yurume: 20, futsu: 12, jigoku: 8 };
function rtRound() {
  const g = S.game, rt = g.rt;
  rt.round++; rt.tiles = RT_TILES[S.level] || 12; rt.bomb = rnd(rt.tiles); rt.open = []; rt.loser = null;
  rt.who = (rt.round - 1) % S.members.length; g.doer = rt.who; rt.phase = "play";
}
function rtTap(t) {
  const g = S.game, rt = g.rt;
  if (rt.phase !== "play" || rt.open.includes(t)) return;
  rt.open.push(t); g.turn++;
  if (t === rt.bomb) {
    rt.loser = rt.who; rt.phase = "boom";
    play("boom"); if (navigator.vibrate) navigator.vibrate([120, 60, 220]);
  } else {
    play("pop"); rt.who = (rt.who + 1) % S.members.length; g.doer = rt.who;
  }
  render(true);
}

// ---------- 爆弾パス ----------
// お題に合うものを言えたら次の人へ渡す。いつ爆発するか分からん。爆発した時に持ってた人が罰
const BP_SEC = { yurume: [15, 30], futsu: [10, 24], jigoku: [6, 16] };
// お題はパスするたびに変わる。パスが進むほど かんたん → ふつう → むずい（地獄は最初から1段上）
const BP_STEP = { yurume: 5, futsu: 4, jigoku: 3 };
const BP_TIER = ["easy", "normal", "hard"], BP_TIER_LABEL = { easy: "かんたん", normal: "ふつう", hard: "むずい" };
function bpTier(bp) { return BP_TIER[Math.min(2, Math.floor(bp.passes / (BP_STEP[S.level] || 4)) + (S.level === "jigoku" ? 1 : 0))]; }
function bpTopic(bp) { bp.tier = bpTier(bp); bp.topic = draw("bpass_" + bp.tier, DATA.bpass[bp.tier]); }
function bpRound() {
  const g = S.game, bp = g.bp;
  bp.round++; bp.holder = (bp.round - 1) % S.members.length; bp.passes = 0; bp.loser = null;
  bpTopic(bp);
  g.doer = bp.holder; bp.phase = "ready";
}
function bpGo() {
  const g = S.game, bp = g.bp, [a, b] = BP_SEC[S.level] || BP_SEC.futsu;
  bp.phase = "play"; bp.startAt = Date.now(); bp.endAt = bp.startAt + (a + Math.random() * (b - a)) * 1000;
  play("coin"); render(true);
  // 爆発は裏で決めた時間ぴったりに（チクタクの間隔に関係なく）
  clearTimeout(bp.boomT);
  bp.boomT = setTimeout(() => { if (S.game?.bp === bp && bp.phase === "play") bpBoom(); }, bp.endAt - bp.startAt);
  // チクタク：経過時間でだんだん速くなる（残り時間はバレへん）
  const tick = () => {
    if (S.game?.bp !== bp || bp.phase !== "play") return;
    const now = Date.now();
    if (now >= bp.endAt) return;
    play("tick");
    const el = (now - bp.startAt) / 1000;
    bp.t = setTimeout(tick, Math.max(140, 650 - el * (S.level === "jigoku" ? 45 : 28)));
  };
  bp.t = setTimeout(tick, 400);
}
function bpPass() {
  const g = S.game, bp = g.bp;
  if (bp.phase !== "play") return;
  bp.holder = (bp.holder + 1) % S.members.length; bp.passes++; g.turn++; g.doer = bp.holder;
  bpTopic(bp); // 次の人は新しいお題
  play("pop"); render();
}
function bpBoom() {
  const g = S.game, bp = g.bp;
  clearTimeout(bp.t); clearTimeout(bp.boomT); bp.phase = "boom"; bp.loser = bp.holder; g.doer = bp.holder;
  play("boom"); if (navigator.vibrate) navigator.vibrate([200, 80, 300]);
  render(true);
}

// ---------- ハイ&ロー ----------
// 次のカードが今より大きいか小さいかを当てる。当たったら次の人。外したら罰（続いた回数が多いと罰2倍）
const HL_X2 = { yurume: 99, futsu: 5, jigoku: 3 }; // これだけ続いたあとに外したら罰2倍
const hlFace = (v) => ({ 1: "A", 11: "J", 12: "Q", 13: "K" }[v] || String(v));
function hlRound() {
  const g = S.game, hl = g.hl;
  hl.round++; hl.cur = 1 + rnd(13); hl.suit = rnd(4); hl.streak = 0; hl.loser = null;
  hl.who = (hl.round - 1) % S.members.length; g.doer = hl.who; hl.phase = "guess";
}
function hlGuess(up) {
  const g = S.game, hl = g.hl;
  if (hl.phase !== "guess") return;
  hl.next = 1 + rnd(13); hl.nsuit = rnd(4); hl.up = up; g.turn++;
  const same = hl.next === hl.cur;
  hl.same = same;
  hl.ok = same ? S.level !== "jigoku" : up ? hl.next > hl.cur : hl.next < hl.cur;
  // 1枚ごとにためると間延びするので、すぐめくる
  if (hl.ok) { hl.streak++; hl.hits[hl.who]++; if (hl.streak > hl.best) hl.best = hl.streak; play("coin"); }
  else { hl.loser = hl.who; hl.x = hl.streak >= (HL_X2[S.level] || 5) ? 2 : 1; play("boom"); if (navigator.vibrate) navigator.vibrate([120, 60, 200]); }
  hl.phase = "reveal";
  render(true);
}
function hlNext() {
  const g = S.game, hl = g.hl;
  hl.cur = hl.next; hl.suit = hl.nsuit; hl.who = (hl.who + 1) % S.members.length; g.doer = hl.who; hl.phase = "guess";
}

// ---------- 反射神経バトル ----------
// 1人ずつ。画面が緑になった瞬間にタップ。フライングした人は罰、おらんかったら一番遅い人が罰。
// 普通はたまにフェイク、地獄はフェイクが何回も（地獄でも出えへん回がある）。緑になる時間も毎回バラバラ
const RF_LATE = 1500; // これより遅かったら「遅すぎ」で打ち切り
// みんな同時：4人までの組に分けて、組ごとに画面を区切って同時に押す（5人以上は 5→3+2、9→3+3+3 みたいに均等に）
function rfHeats() {
  const n = S.members.length, k = Math.ceil(n / 4), out = [];
  let i = 0;
  for (let h = 0; h < k; h++) { const size = Math.floor(n / k) + (h < n % k ? 1 : 0); out.push(Array.from({ length: size }, () => i++)); }
  return out;
}
function rfRound() {
  const rf = S.game.rf;
  rf.round++; rf.k = 0; rf.res = Array(S.members.length).fill(null); rf.losers = [];
  if (rf.style === "multi") { rf.heats = rfHeats(); rf.h = 0; rf.phase = "mhand"; S.game.doer = -1; return; }
  rfBegin();
}
// 緑の時間とフェイク（色・出る時間）を決める。フェイクは1.5秒以上ためてから0.8秒、緑の0.4秒前までに消える
function rfPlan(level) {
  const go = 5000 + Math.random() * 10000; // 5〜15秒
  const want = level === "yurume" ? 0 : level === "futsu" ? (Math.random() < 0.55 ? 1 : 0) : [0, 1, 1, 2, 2, 3][rnd(6)];
  const fakes = [];
  for (let t = 0; t < 40 && fakes.length < want; t++) {
    const at = 1500 + Math.random() * (go - 1500 - 1200);
    if (at < 1500 || fakes.some((f) => Math.abs(f.at - at) < 1100)) continue;
    fakes.push({ at, kind: level === "futsu" ? "yellow" : ["yellow", "red", "mada"][rnd(3)] });
  }
  return { go, fakes: fakes.sort((a, b) => a.at - b.at) };
}
const rfWho = (rf) => (rf.k + rf.round - 1) % S.members.length;
function rfBegin() { const rf = S.game.rf; rf.who = rfWho(rf); S.game.doer = rf.who; rf.phase = "hand"; }
function rfGo() {
  const rf = S.game.rf, now = Date.now();
  // フェイク（緑になる前に出る）
  const W = rf.style === "multi" ? "mwait" : "wait";
  // 緑になるのは毎回バラバラ（5〜15秒のどこか）。フェイクも数・時間・色がバラバラで、緑の直前とは限らへん
  const plan = rfPlan(S.level);
  rf.phase = W; rf.color = "wait"; rf.goAt = now + plan.go; rf.timers = [];
  plan.fakes.forEach(({ kind, at }) => {
    rf.timers.push(setTimeout(() => { if (S.game?.rf !== rf || rf.phase !== W) return; rf.color = kind; rfPaint(); rf.timers.push(setTimeout(() => { if (rf.phase === W && rf.color === kind) { rf.color = "wait"; rfPaint(); } }, 800)); }, at));
  });
  rf.timers.push(setTimeout(() => { if (S.game?.rf !== rf || rf.phase !== W) return; rf.color = "go"; rf.goShown = performance.now(); rfPaint(); play("pop"); }, rf.goAt - now));
  rf.timers.push(setTimeout(() => { if (S.game?.rf === rf && rf.phase === W && rf.color === "go") { if (W === "mwait") rfHeatEnd(); else rfTap(true); } }, rf.goAt - now + RF_LATE));
  render(true);
}
const rfLabel = (c) => (c === "go" ? "今！" : c === "mada" ? "まだ！" : c === "wait" ? "待って…" : "まだやで");
function rfPaint() {
  const box = document.getElementById("rfBox"); if (!box) return;
  const rf = S.game.rf;
  box.className = "rf-box " + rf.color + (rf.style === "multi" ? " multi" : "");
  box.querySelector(".rf-label").textContent = rfLabel(rf.color);
}
function rfTap(late = false) {
  const g = S.game, rf = g.rf;
  if (rf.phase !== "wait") return;
  rf.timers.forEach(clearTimeout);
  const fly = rf.color !== "go";
  const ms = fly ? null : late ? RF_LATE : Math.round(performance.now() - rf.goShown);
  rf.res[rf.who] = { fly, ms };
  if (!fly && (rf.best[rf.who] == null || ms < rf.best[rf.who])) rf.best[rf.who] = ms;
  g.turn++;
  play(fly ? "boom" : "coin");
  if (rf.k + 1 >= S.members.length) { rfFinal(); return; }
  rf.phase = "done";
  render(true);
}

// みんな同時：自分のエリアを押した瞬間。緑になる前ならその人だけフライング
function rfZoneTap(i, ts) {
  const g = S.game, rf = g.rf;
  if (rf.phase !== "mwait" || rf.res[i] || !rf.heats[rf.h].includes(i)) return;
  const fly = rf.color !== "go";
  const ms = fly ? null : Math.max(0, Math.round((ts ?? performance.now()) - rf.goShown));
  rf.res[i] = { fly, ms: fly ? null : Math.min(ms, RF_LATE) };
  play(fly ? "boom" : "coin");
  const z = document.querySelector(`[data-zone="${i}"]`);
  if (z) { z.classList.add(fly ? "fly" : "hit"); z.querySelector(".rf-zv").textContent = fly ? "フライング" : `${rf.res[i].ms}ms`; }
  if (rf.heats[rf.h].every((j) => rf.res[j])) rfHeatEnd();
}
// 組が終わった（全員押した or 緑から1.5秒）：押してへん人は「遅すぎ」
function rfHeatEnd() {
  const g = S.game, rf = g.rf;
  if (rf.phase !== "mwait") return;
  rf.timers.forEach(clearTimeout);
  for (const j of rf.heats[rf.h]) {
    if (!rf.res[j]) rf.res[j] = { fly: false, ms: RF_LATE };
    const r = rf.res[j];
    if (!r.fly && r.ms < RF_LATE && (rf.best[j] == null || r.ms < rf.best[j])) rf.best[j] = r.ms;
  }
  g.turn++;
  if (rf.h + 1 < rf.heats.length) { rf.phase = "mdone"; render(true); return; }
  rfFinal();
}
// 全員終わった：罰の人を決めて、ドラムロールでためてから順位発表
function rfFinal() {
  const g = S.game, rf = g.rf, idx = S.members.map((_, i) => i), flyers = idx.filter((i) => rf.res[i].fly || rf.res[i].ms >= RF_LATE); // フライングと遅すぎはアウト
  if (flyers.length) rf.losers = flyers;
  else { const worst = Math.max(...idx.map((i) => rf.res[i].ms)); rf.losers = idx.filter((i) => rf.res[i].ms === worst); }
  rf.phase = "tally";
  hold("結果は…", 1800, () => { rf.phase = "rank"; g.doer = -1; });
}

// ---------- 声デカ選手権 ----------
// 1人ずつ5秒間、スマホに向かって叫ぶ。声が一番小さかった人が罰（地獄は罰2倍）。マイクが使えへん時はみんなで判定
const VC_SEC = 5;
const vcMic = { stream: null, an: null, src: null, ctx: null, buf: null, perm: "unknown" };
// iPhone は「タップの中で起こした AudioContext」やないと音が来えへん（suspended のまま0になる）ので、
// 効果音と同じ AudioContext をタップの瞬間に起こして使う。マイクを開いた後に止まることがあるのでもう一回起こす
async function vcAsk() {
  if (vcMic.an) return true;
  const ctx = SFX.ctx(); // ← await より前（タップの中）で起こす
  try {
    if (!navigator.mediaDevices?.getUserMedia || !ctx) throw new Error("no mic");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    if (ctx.state !== "running") { try { await ctx.resume(); } catch {} }
    const an = ctx.createAnalyser(); an.fftSize = 1024;
    const src = ctx.createMediaStreamSource(stream);
    src.connect(an);
    // Safari は出口（スピーカー）につながってへんと音を流さへんことがあるので、音量0でつないでおく
    const mute = ctx.createGain(); mute.gain.value = 0; an.connect(mute).connect(ctx.destination);
    Object.assign(vcMic, { stream, ctx, an, src, buf: new Uint8Array(an.fftSize), perm: "granted" });
    return true;
  } catch { vcMic.perm = "denied"; return false; }
}
function vcRelease() {
  try { vcMic.stream?.getTracks().forEach((t) => t.stop()); vcMic.src?.disconnect(); } catch {}
  Object.assign(vcMic, { stream: null, an: null, src: null, buf: null }); // AudioContext は効果音と共用なので閉じへん
}
// 今の声の大きさ 0〜100（dBFS -60〜0 をならす）
function vcLevel() {
  if (!vcMic.an) return 0;
  vcMic.an.getByteTimeDomainData(vcMic.buf); // Float版より古いiPhoneでも動く
  let sum = 0; for (const b of vcMic.buf) { const v = (b - 128) / 128; sum += v * v; }
  const db = 20 * Math.log10(Math.sqrt(sum / vcMic.buf.length) || 1e-6);
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
}
function vcRound() {
  const vc = S.game.vc;
  vc.round++; vc.k = 0; vc.res = Array(S.members.length).fill(null); vc.losers = [];
  vcBegin();
}
const vcWho = (vc) => (vc.k + vc.round - 1) % S.members.length;
function vcBegin() { const vc = S.game.vc; vc.who = vcWho(vc); S.game.doer = vc.who; vc.phase = "hand"; }
// 「叫ぶ！」を押したら3・2・1で息を吸う時間をとってからスタート
function vcCount() {
  if (vcMic.ctx?.state !== "running") vcMic.ctx?.resume(); // タップの中で起こしなおす
  count3(S.game.vc, vcGo, 800);
}
function vcGo() {
  const vc = S.game.vc;
  vc.phase = "play"; vc.peak = 0; vc.cur = 0; vc.endAt = Date.now() + VC_SEC * 1000; vc.sec = VC_SEC;
  if (vcMic.ctx?.state === "suspended") vcMic.ctx.resume();
  play("coin"); render(true);
  secClock(vc, () => S.game?.vc === vc, vcDone);
  const loop = () => {
    if (S.game?.vc !== vc || vc.phase !== "play") return;
    const lv = vcLevel();
    vc.cur = vc.cur * 0.6 + lv * 0.4; // ちょっとならす
    if (vc.cur > vc.peak) vc.peak = vc.cur;
    const m = document.getElementById("vcMeter"); if (m) m.style.setProperty("--m", (vc.cur / 100).toFixed(3));
    const p = document.getElementById("vcPeak"); if (p) p.textContent = Math.round(vc.peak);
    vc.raf = requestAnimationFrame(loop);
  };
  vc.raf = requestAnimationFrame(loop);
}
function vcDone() {
  const g = S.game, vc = g.vc;
  cancelAnimationFrame(vc.raf); stopTimer();
  const score = Math.round(vc.peak);
  vc.res[vc.who] = score;
  if (score > (vc.best[vc.who] ?? -1)) vc.best[vc.who] = score;
  g.turn++;
  if (vc.k + 1 >= S.members.length) { vc.phase = "tally"; hold("結果は…", 1800, vcRank); return; }
  play("fanfare");
  vc.phase = "done";
  render(true);
}
function vcRank() {
  const g = S.game, vc = g.vc, idx = S.members.map((_, i) => i);
  g.doer = -1; vc.phase = "rank";
  const min = Math.min(...idx.map((i) => vc.res[i]));
  vc.losers = idx.filter((i) => vc.res[i] === min);
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
function startTimer(sec, onEnd, fmt, quiet = false) {
  stopTimer();
  const endAt = Date.now() + sec * 1000;
  modeTimer = setInterval(() => {
    const left = endAt - Date.now();
    const el = document.getElementById("modeTimer");
    if (!quiet) hurryFx(left);
    if (left <= 0) { stopTimer(); if (!quiet) play("alarm"); if (navigator.vibrate) navigator.vibrate([80, 40, 160]); onEnd(); return; }
    if (el) { el.textContent = fmt ? fmt(left) : Math.ceil(left / 1000); el.classList.toggle("hurry", left < (fmt ? 30000 : 10000)); }
  }, 200);
  return endAt;
}
function stopTimer() { if (modeTimer) { clearInterval(modeTimer); modeTimer = null; } hurryOff(); }

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
// 番の人だけお題を見て、声を出さずに体で伝える。当てた人と演じた人に1点。
// 1人演じ終わるごとに罰：ノルマ（持ち時間15秒ごとに1問）に届かんかったら演じた人、届いたら当てた数が一番少ない人
const gsQuota = (sec) => Math.max(1, Math.round(sec / 15));
function gsWord() {
  let key = S.level;
  if (S.night && !S.members.some((m) => m.ng) && Math.random() < (S.night === "shinya" ? 0.4 : 0.25)) key = S.night === "shinya" && Math.random() < 0.6 ? "shinya" : "yoru";
  return { text: draw("gs_" + key, DATA.gesture[key]), night: key === "yoru" || key === "shinya" ? key : false };
}
function gsStart() {
  const g = S.game, gs = g.gs;
  gs.phase = "act"; gs.got = 0; gs.word = gsWord(); gs.turnHits = Array(S.members.length).fill(0);
  gs.endAt = startTimer(gs.sec, () => { gs.phase = "timeup"; render(true); });
}
function gsHit(i) {
  const g = S.game, gs = g.gs;
  gs.score[i]++; gs.score[gs.actor]++; gs.got++; g.turn++;
  gs.turnHits[i]++;
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
// このターンの罰の人：ノルマ未達なら演じた人、達成なら当てた数が一番少ない人（当てる側）
function gsTurnLosers() {
  const gs = S.game.gs, n = S.members.length;
  if (gs.got < gsQuota(gs.sec)) return { why: "quota", who: [gs.actor] };
  const guessers = S.members.map((_, i) => i).filter((i) => i !== gs.actor);
  const m = Math.min(...guessers.map((i) => gs.turnHits[i]));
  return { why: "few", who: guessers.filter((i) => gs.turnHits[i] === m), min: m, n };
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
