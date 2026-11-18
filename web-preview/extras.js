// ===== 第3弾：飲み会の流れに寄り添う道具 =====
// チーム戦・途中参加/先に帰る・終電アラートとお水タイム・幹事の道具・隣の人にQR・メンバーの通算・大画面モード
// ※ views.js より前に読み込む。ここのトップレベルでは views.js の const（ICON など）を触らんこと

// ---------- 14 チーム戦 ----------
// 4人以上で「チーム戦」をオンにすると、赤と青に分かれる。結果はチームの罰の合計（人数が違う時は1人あたり）で勝負
S.team = store.get("nd_team", false) === true;
S.teams = []; // メンバーの順番どおりに 0=赤 1=青
const TEAM = [{ name: "赤", color: "#ff3b3b" }, { name: "青", color: "#3d7bff" }];
function teamOn() { return S.team && S.members.length >= 4; }
function makeTeams() {
  const idx = shuffle(S.members.map((_, i) => i));
  S.teams = Array(S.members.length).fill(0);
  idx.forEach((i, k) => (S.teams[i] = k % 2));
  S.teamKey = S.members.map((m) => m.name).join();
}
function teamOf(i) {
  if (!teamOn()) return -1;
  if (S.teamKey !== S.members.map((m) => m.name).join() || S.teams.length !== S.members.length) makeTeams();
  return S.teams[i];
}
function teamScore(pen) {
  return [0, 1].map((t) => {
    const who = S.members.map((_, i) => i).filter((i) => teamOf(i) === t);
    const sum = who.reduce((a, i) => a + (pen[i] || 0), 0);
    return { t, who, sum, avg: who.length ? sum / who.length : 0 };
  });
}
function vTeamPick() {
  if (S.members.length < 4) return "";
  const on = teamOn();
  return `<section class="team-box ${on ? "on" : ""}">
    <button class="toggle" data-act="team" aria-pressed="${on}"><span>チーム戦<small>赤と青に分かれて、チームの罰の合計で勝負</small></span><b>${on ? "ON" : "OFF"}</b></button>
    ${on ? `<div class="team-cols">${[0, 1].map((t) => `<div class="team-col" style="--tc:${TEAM[t].color}"><b>${TEAM[t].name}チーム</b>${S.members.map((m, i) => (teamOf(i) === t ? `<span>${esc(m.name)}</span>` : "")).join("")}</div>`).join("")}</div>
    <button class="text-btn" data-act="teamShuffle">チームを組み直す</button>` : ""}
  </section>`;
}
// ホームのチーム戦：ONの時だけ、分かれ方を出す（ON/OFFは上の細いボタンで）
function vTeamCols() {
  return `<section class="team-box on">
    <div class="team-cols">${[0, 1].map((t) => `<div class="team-col" style="--tc:${TEAM[t].color}"><b>${TEAM[t].name}チーム</b>${S.members.map((m, i) => (teamOn() && teamOf(i) === t ? `<span>${esc(m.name)}</span>` : "")).join("")}</div>`).join("")}</div>
    <button class="text-btn" data-act="teamShuffle">チームを組み直す</button>
  </section>`;
}
function vTeamResult() {
  if (!teamOn()) return "";
  const g = S.game, sc = teamScore(g.pen), uneven = sc[0].who.length !== sc[1].who.length;
  const v = (x) => (uneven ? Math.round(x.avg * 10) / 10 : x.sum);
  const lose = v(sc[0]) === v(sc[1]) ? -1 : v(sc[0]) > v(sc[1]) ? 0 : 1;
  if (lose >= 0 && !g.teamBatsu) g.teamBatsu = wfGroupBatsu();
  return `<section class="team-res">
    <h2 class="res-h2">チーム戦${uneven ? "（人数が違うので1人あたり）" : ""}</h2>
    <div class="team-vs">${sc.map((x) => `<div class="tv ${lose === x.t ? "lose" : lose >= 0 ? "win" : ""}" style="--tc:${TEAM[x.t].color}"><small>${TEAM[x.t].name}チーム</small><b>${v(x)}</b><span>${x.who.map((i) => esc(S.members[i].name)).join("・")}</span><em>${lose < 0 ? "引き分け" : lose === x.t ? "負け" : "勝ち"}</em></div>`).join(`<i class="vs">VS</i>`)}</div>
    ${lose >= 0 ? `<p class="team-batsu"><b>${TEAM[lose].name}チームの罰</b>${g.teamBatsu.lucky ? "天使が来た！今回はセーフ" : g.teamBatsu.html}</p>` : ""}
  </section>`;
}

// ---------- 12 途中参加・先に帰る ----------
// ゲーム中に「⋯」から。メンバーを変えたら、今の罰を引き継いで同じ遊び方をやり直す
// 今来た人は今いる人の平均の罰から（0からやと後から来た人が得するので）。帰った人は結果発表に残す
S.left = []; // 先に帰った人 [{name, pen}]
S.carryPen = null; // 次の newGame で引き継ぐ罰 {名前: 数}
function vInout() {
  const g = S.game, n = S.members.length;
  return `<div class="sheet-back" data-act="inoutClose">
    <div class="sheet" role="dialog" aria-label="メンバーの出入り" data-stop>
      <div class="sheet-grip"></div>
      <h2>メンバーの出入り</h2>
      <p class="sheet-note">罰の数はそのまま引き継ぐ。今来た人は、今おる人の平均（${avgPen()}）から</p>
      <form class="add1" id="inoutForm"><input id="inoutName" maxlength="10" placeholder="今来た人の名前" autocomplete="off" enterkeyhint="done"><button class="add-btn" type="submit" aria-label="追加">${ICON.plus}</button></form>
      ${S.inoutMsg ? `<p class="add-msg" role="alert">${esc(S.inoutMsg)}</p>` : ""}
      <ul class="inout-list">${S.members.map((m, i) => `<li style="--mc:${colorOf(i)}"><span class="nm"><i></i>${esc(m.name)}<small>罰${g.pen[i]}</small></span><button class="ghost sm" data-act="leave" data-i="${i}" ${n <= 2 ? "disabled" : ""}>先に帰る</button></li>`).join("")}</ul>
      ${S.left.length ? `<p class="sheet-note">先に帰った人：${S.left.map((x) => `${esc(x.name)}（罰${x.pen}）`).join("・")}</p>` : ""}
      <button class="ghost" data-act="inoutClose">閉じる</button>
    </div>
  </div>`;
}
function avgPen() {
  const p = S.game?.pen || [];
  return p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length) : 0;
}
function carryNow() {
  applyAdds();
  const g = S.game, c = {};
  S.members.forEach((m, i) => (c[m.name] = g.pen[i] || 0));
  return c;
}
function inoutAdd(e) {
  e.preventDefault();
  const el = document.getElementById("inoutName"), name = el.value.trim().slice(0, 10);
  if (!name) return;
  const err = S.members.length >= 12 ? "12人までやで" : S.members.some((m) => m.name === name) ? `「${name}」はもうおるで` : "";
  S.inoutMsg = err;
  if (err) { render(); return; }
  const c = carryNow(), back = S.left.find((x) => x.name === name);
  c[name] = back ? back.pen : avgPen(); // 一回帰った人が戻ってきたら、その時の罰から
  S.left = S.left.filter((x) => x.name !== name);
  S.members.push({ name });
  restartWith(c, `${name}が参加！罰${c[name]}からスタート`);
}
function inoutLeave(i) {
  if (S.members.length <= 2) return;
  const c = carryNow(), m = S.members[i];
  S.left.push({ name: m.name, pen: c[m.name] });
  delete c[m.name];
  S.members.splice(i, 1);
  restartWith(c, `${m.name}は先に帰った。おつかれ！`);
}
function restartWith(c, msg) {
  saveMembers();
  S.inout = false; S.inoutMsg = ""; S.carryPen = c;
  const left = S.left;
  newGame(S.game.mode, true);
  S.left = left;
  toast(msg);
}
// newGame の最後に呼ぶ：引き継ぎの罰を入れる（なければ帰った人の記録も消す）
function applyCarry() {
  const g = S.game;
  if (!S.carryPen) { S.left = []; return; }
  g.pen = S.members.map((m) => S.carryPen[m.name] || 0);
  S.prevPen = g.pen.slice();
  S.carryPen = null;
}
function vLeftResult() {
  if (!S.left.length) return "";
  return `<h2 class="res-h2">先に帰った人</h2><ul class="ng-list res">${S.left.map((x) => `<li style="--mc:#8d857a"><span class="nm"><i></i>${esc(x.name)}</span><b>罰${x.pen}・途中退場</b></li>`).join("")}</ul>`;
}

// ---------- 16 終電アラートとお水タイム ----------
// 帰りの時間を入れとくと、30分前・10分前・時間になったらお知らせ。お水タイムは30分ごと
S.goHome = (() => { const v = store.get("nd_gohome", null); return v && typeof v.t === "string" && Date.now() - v.at < 12 * 3600e3 ? v.t : ""; })();
S.water = store.get("nd_water", true) !== false;
S.since = 0; // 最初にゲームを始めた時刻（お水タイムの基準）
S.alerted = {};
function minsLeft() {
  if (!S.goHome) return null;
  const [h, m] = S.goHome.split(":").map(Number), now = new Date(), t = new Date(now);
  t.setHours(h, m, 0, 0);
  // 夜中をまたぐ（23時に「1:00」を入れた）時は次の日。過ぎて1時間以内はそのまま（マイナス）
  if (t - now < -3600e3) t.setDate(t.getDate() + 1);
  return Math.round((t - now) / 60000);
}
function timeCheck() {
  if (!isStage(S.screen)) return;
  if (!S.since) S.since = Date.now();
  const left = minsLeft();
  if (left != null) {
    for (const k of [30, 10, 0]) {
      const key = S.goHome + ":" + k;
      if (left <= k && left > k - 10 && !S.alerted[key]) {
        S.alerted[key] = true;
        toast(k === 0 ? `${S.goHome}、帰る時間やで！忘れ物ないように` : `帰る時間（${S.goHome}）まであと${left}分`, "train");
        play("alarm");
        return;
      }
    }
  }
  if (S.water) {
    const n = Math.floor((Date.now() - S.since) / (30 * 60e3));
    if (n > 0 && !S.alerted["water" + n]) {
      S.alerted["water" + n] = true;
      toast("お水タイム！全員お水かソフドリをひと口（罰ちゃうで）", "water");
      play("chin");
    }
  }
}
setInterval(timeCheck, 20000);
function vGoHome() {
  const left = minsLeft();
  return `<label class="gohome ${S.goHome ? "set" : ""}"><span class="gh-ic">${ICON.gohome}</span><span class="gh-tx">帰る時間<small>${S.goHome ? (left > 0 ? `あと${Math.floor(left / 60) ? `${Math.floor(left / 60)}時間` : ""}${left % 60}分` : "もう時間やで") : "入れとくと30分前と10分前に知らせる"}</small></span><input type="time" id="goHomeIn" value="${S.goHome}" aria-label="帰る時間">${S.goHome ? `<button class="text-btn" data-act="goHomeClear">消す</button>` : ""}</label>`;
}
// 画面の上にちょっとだけ出すお知らせ（タップで消える）
function toast(text, kind = "") {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("button"); el.id = "toast"; el.type = "button"; el.addEventListener("click", () => el.classList.remove("on")); document.body.appendChild(el); }
  const ic = kind === "train" ? ICON.gohome : kind === "water" ? ICON.drop : "";
  el.innerHTML = `${ic}<span>${esc(text)}</span>`; el.className = "toast on " + kind;
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), kind ? 12000 : 3500);
}

// ---------- 17 幹事の道具 ----------
// 席替え・役割決め・順番決め・二次会の投票。名前はもう入ってるので、そのまま使える
const KJ_ROLES = ["注文係", "会計係", "写真係", "乾杯の音頭", "二次会の店探し", "タクシー呼ぶ係", "お水を配る係", "盛り上げ係"];
const KJ_NEXT = ["カラオケ", "ラーメン", "もう1軒", "帰る"];
function kjOpen(tab) {
  const n = S.members.length;
  S.kanji = { tab, shape: S.kanji?.shape || "face", seat: shuffle(S.members.map((_, i) => i)), roles: shuffle(S.members.map((_, i) => i)), order: shuffle(S.members.map((_, i) => i)), votes: Array(KJ_NEXT.length).fill(0), voted: 0, show: false, n };
}
function vKanji() {
  const k = S.kanji, ms = S.members;
  const tabs = [["seat", "席替え"], ["role", "役割決め"], ["order", "順番決め"], ["next", "二次会"]];
  const chip = (i) => `<span class="kj-p" style="--mc:${colorOf(i)}">${dot(i)}<b>${esc(ms[i].name)}</b></span>`;
  let body = "";
  if (k.tab === "seat") {
    const half = Math.ceil(k.seat.length / 2);
    const table = k.shape === "round"
      ? `<div class="kj-round">${k.seat.map((i, j) => { const a = (j / k.seat.length) * 2 * Math.PI - Math.PI / 2; return `<span class="kj-rs" style="left:${50 + 40 * Math.cos(a)}%;top:${50 + 40 * Math.sin(a)}%">${chip(i)}</span>`; }).join("")}<i class="kj-tbl round"></i></div>`
      : `<div class="kj-face"><div class="kj-side">${k.seat.slice(0, half).map(chip).join("")}</div><i class="kj-tbl"></i><div class="kj-side">${k.seat.slice(half).map(chip).join("")}</div></div>`;
    body = `<div class="kj-shape" role="group">${[["face", "向かい合わせ"], ["round", "丸テーブル"]].map(([v, t]) => `<button data-act="kjShape" data-v="${v}" aria-pressed="${k.shape === v}">${t}</button>`).join("")}</div>${table}
      <p class="sheet-note">${k.shape === "face" ? "左の列と右の列で向かい合わせ。上から順に座る" : "時計回りに座る"}</p><button class="big" data-act="kjShuffle">もう1回シャッフル</button>`;
  } else if (k.tab === "role") {
    body = `<ul class="kj-list">${k.roles.slice(0, Math.min(ms.length, KJ_ROLES.length)).map((i, j) => `<li><small>${KJ_ROLES[j]}</small>${chip(i)}</li>`).join("")}</ul><button class="big" data-act="kjShuffle">もう1回決める</button>`;
  } else if (k.tab === "order") {
    body = `<ol class="kj-list num">${k.order.map((i, j) => `<li><small>${j + 1}番</small>${chip(i)}</li>`).join("")}</ol><button class="big" data-act="kjShuffle">もう1回決める</button>`;
  } else {
    const max = Math.max(...k.votes);
    body = k.show
      ? `<ul class="kj-list">${KJ_NEXT.map((t, j) => `<li class="${k.votes[j] === max && max > 0 ? "top" : ""}"><small>${k.votes[j]}票</small><b>${t}</b></li>`).join("")}</ul><button class="big" data-act="kjVoteReset">もう1回投票</button>`
      : `<p class="sheet-note">スマホを回して、1人ずつこっそり押す（${k.voted}/${ms.length}人）</p><div class="kj-vote">${KJ_NEXT.map((t, j) => `<button class="ghost" data-act="kjVote" data-i="${j}" ${k.voted >= ms.length ? "disabled" : ""}>${t}</button>`).join("")}</div><button class="big" data-act="kjVoteShow" ${k.voted ? "" : "disabled"}>結果を見る</button>`;
  }
  return `<div class="sheet-back" data-act="kanjiClose">
    <div class="sheet" role="dialog" aria-label="幹事の道具" data-stop>
      <div class="sheet-grip"></div>
      <h2>幹事の道具</h2>
      <div class="mode-tabs kj-tabs" role="tablist">${tabs.map(([v, t]) => `<button role="tab" data-act="kjTab" data-v="${v}" aria-selected="${k.tab === v}">${t}</button>`).join("")}</div>
      ${body}
      <button class="ghost" data-act="kanjiClose">閉じる</button>
    </div>
  </div>`;
}

// ---------- 18 隣の人にQR ----------
function qrSvg() {
  const q = DATA.qr;
  return `<svg class="qr" viewBox="-2 -2 ${q.size + 4} ${q.size + 4}" shape-rendering="crispEdges" role="img" aria-label="ノリダンWeb版のQRコード"><rect x="-2" y="-2" width="${q.size + 4}" height="${q.size + 4}" fill="#fff"/><path d="${q.path}" fill="#141210"/></svg>`;
}
function vQr() {
  return `<div class="sheet-back" data-act="qrClose">
    <div class="sheet qr-sheet" role="dialog" aria-label="隣の人にも" data-stop>
      <div class="sheet-grip"></div>
      <h2>隣の人にもノリダン</h2>
      <p class="sheet-note">カメラで読むとWeb版がすぐ開く。アプリを入れんでも遊べる</p>
      ${qrSvg()}
      <p class="qr-url">${esc(DATA.qr.url.replace("https://", ""))}</p>
      <button class="ghost" data-act="qrClose">閉じる</button>
    </div>
  </div>`;
}

// ---------- 19 このメンバーの通算 ----------
// 同じメンバー（名前の組み合わせ）ごとに、遊んだ回数・通算の罰・天使・前回の戦犯を覚えとく（スマホの中だけ）
const tallyKey = (ms = S.members) => ms.map((m) => m.name).sort().join("\u0001");
function tallyAll() { const v = store.get("nd_tally", {}); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
function tallyGet(ms) { const t = tallyAll()[tallyKey(ms)]; return t && typeof t === "object" && t.pen ? t : null; }
function tallyRecord() {
  const g = S.game;
  if (!g || g.tallied || S.isExample) return;
  g.tallied = true;
  const all = tallyAll(), key = tallyKey(), t = all[key] && all[key].pen ? all[key] : { games: 0, pen: {}, lucky: {} };
  t.games++;
  S.members.forEach((m, i) => { t.pen[m.name] = (t.pen[m.name] || 0) + (g.pen[i] || 0); t.lucky[m.name] = (t.lucky[m.name] || 0) + (g.st?.lucky?.[i] || 0); });
  const max = Math.max(...g.pen);
  t.last = { names: max > 0 ? S.members.filter((_, i) => g.pen[i] === max).map((m) => m.name) : [], mode: g.mode, at: Date.now() };
  all[key] = t;
  // 多くなりすぎんように、新しい20組だけ残す
  const keys = Object.keys(all).sort((a, b) => (all[b].last?.at || 0) - (all[a].last?.at || 0)).slice(0, 20);
  store.set("nd_tally", Object.fromEntries(keys.map((k) => [k, all[k]])));
}
function tallyLine() {
  const t = tallyGet(S.members);
  if (!t || !t.last) return "";
  const who = t.last.names.length ? t.last.names.join("・") : "なし（全員セーフ）";
  return `<span class="lg-tally">前回の戦犯：<b>${esc(who)}</b>（${esc(MODE_NAME[t.last.mode] || "")}）・このメンバーで${t.games}回</span>`;
}
function vTallyResult() {
  const t = tallyGet(S.members);
  if (!t || t.games < 2) return "";
  const rows = S.members.map((m) => ({ m, n: t.pen[m.name] || 0, l: t.lucky[m.name] || 0 })).sort((a, b) => b.n - a.n);
  return `<h2 class="res-h2">このメンバーの通算（${t.games}回）</h2><ul class="ng-list res">${rows.map((r) => `<li style="--mc:${colorOf(S.members.indexOf(r.m))}"><span class="nm"><i></i>${esc(r.m.name)}</span><b>罰${r.n}${r.l ? `・天使${r.l}` : ""}</b></li>`).join("")}</ul>`;
}

// ---------- 15 大画面モード ----------
// テレビやパソコンに映す時。画面いっぱいに大きく出して、横が空いてたら罰ランキングを横に出す
S.big = store.get("nd_big", false) === true;
function bigLayout() {
  document.body.classList.toggle("bigscreen", S.big);
  const app = document.getElementById("app");
  if (!S.big) { app.style.zoom = ""; app.style.removeProperty("--app-h"); document.getElementById("bigRank")?.remove(); return; }
  const z = Math.max(1, Math.min(window.innerHeight / 760, (window.innerWidth - 40) / 560));
  app.style.zoom = String(z);
  app.style.setProperty("--app-h", window.innerHeight / z + "px"); // 拡大した分、中の高さは小さく計算する
  let r = document.getElementById("bigRank");
  const show = isStage(S.screen) && S.game && window.innerWidth - 560 * z > 300;
  if (!show) { r?.remove(); return; }
  if (!r) { r = document.createElement("aside"); r.id = "bigRank"; document.body.appendChild(r); }
  const g = S.game, rows = S.members.map((m, i) => ({ m, i, n: g.pen[i] })).sort((a, b) => b.n - a.n);
  r.innerHTML = `<small>罰ランキング</small>${rows.map((x) => `<p style="--mc:${colorOf(x.i)}"><i>${esc(x.m.name.slice(0, 1))}</i><b>${esc(x.m.name)}</b><em>${x.n}</em></p>`).join("")}${teamOn() ? teamScore(g.pen).map((x) => `<p class="tm" style="--mc:${TEAM[x.t].color}"><i></i><b>${TEAM[x.t].name}チーム</b><em>${x.sum}</em></p>`).join("") : ""}`;
}
window.addEventListener("resize", () => { if (S.big) bigLayout(); });

// ---------- 天使のひとこと ----------
// 罰ガチャが全員セーフの時、「ラッキー！セーフ」の下にユーモアのひとこと（同じガチャの間は同じ言葉）
const quipCache = new WeakMap();
function luckyQuip(gacha) {
  if (!quipCache.has(gacha)) quipCache.set(gacha, draw("quip", DATA.batsu.quip));
  return quipCache.get(gacha);
}

// ---------- ボタン ----------
function extraClick(act, b, g, i) {
  switch (act) {
    case "team": S.team = !teamOn(); store.set("nd_team", S.team); if (S.team) makeTeams(); render(); return true;
    case "teamShuffle": makeTeams(); play("pop"); render(); return true;
    case "inout": S.menu = false; S.inout = true; S.inoutMsg = ""; render(); return true;
    case "inoutClose": S.inout = false; render(); return true;
    case "leave": inoutLeave(i); return true;
    case "goHomeClear": S.goHome = ""; store.set("nd_gohome", null); render(); return true;
    case "kanji": kjOpen(b.dataset.v || "seat"); render(); return true;
    case "kanjiClose": S.kanji = null; render(); return true;
    case "kjTab": S.kanji.tab = b.dataset.v; render(); return true;
    case "kjShape": S.kanji.shape = b.dataset.v; render(); return true;
    case "kjShuffle": { const t = S.kanji.tab, sh = S.kanji.shape; kjOpen(t); S.kanji.shape = sh; play("pop"); render(); return true; }
    case "kjVote": S.kanji.votes[i]++; S.kanji.voted++; play("tick"); vib(20); render(); return true;
    case "kjVoteShow": S.kanji.show = true; play("fanfare"); render(); return true;
    case "kjVoteReset": S.kanji.votes = S.kanji.votes.map(() => 0); S.kanji.voted = 0; S.kanji.show = false; render(); return true;
    case "qr": S.qr = true; render(); return true;
    case "qrClose": S.qr = false; render(); return true;
    case "water": S.water = !S.water; store.set("nd_water", S.water); render(); return true;
    case "big": S.big = !S.big; store.set("nd_big", S.big); render(); return true;
  }
  return false;
}
document.addEventListener("change", (e) => {
  if (e.target.id === "goHomeIn") {
    S.goHome = e.target.value || "";
    store.set("nd_gohome", S.goHome ? { t: S.goHome, at: Date.now() } : null);
    S.alerted = {};
    render();
  }
});
document.addEventListener("submit", (e) => { if (e.target.id === "inoutForm") inoutAdd(e); });

// ===== 第8弾 G5：おまかせメドレー =====
// 人数に合うゲームを自動で並べて、次々流す。罰は全部のゲームで足し算（結果発表は最後に1回）
// 長いゲーム・準備が長いゲーム（すごろく・神経衰弱・NGワード・ワードウルフ・お絵かき・テンション伝言・アホお題）は入れへん
const MED_POOL = ["king", "yama", "nyok", "rtap", "bpass", "hilo", "ito", "vote", "pittari", "quiz", "reflex", "voice", "doubt", "homeru", "gesture", "whack", "deko", "tilt", "shake", "stop"];
function medPick(n) {
  const people = S.members.length;
  const ok = MED_POOL.filter((m) => { const x = MODE_LIST.find((y) => y.m === m); return x && (!x.min || people >= x.min); });
  const cat = (m) => MODE_LIST.find((y) => y.m === m).cat;
  const pool = shuffle(ok), out = [];
  // 同じ種類が続かんように、できるだけ前と違う種類を選ぶ
  while (out.length < n && pool.length) {
    const k = Math.max(0, pool.findIndex((m) => !out.length || cat(m) !== cat(out[out.length - 1])));
    out.push(pool.splice(k, 1)[0]);
  }
  return out;
}
function medStart() {
  const list = medPick(S.medN);
  if (list.length < 2) return;
  S.medley = { list, idx: 0 };
  S.carryPen = null; S.left = [];
  S._med = true; newGame(list[0]);
}
// 次のゲームへ：罰は引き継ぐ
function medNext() {
  const md = S.medley, g = S.game;
  if (!md || md.idx >= md.list.length - 1) return;
  stopTimer(); applyAdds();
  S.carryPen = Object.fromEntries(S.members.map((m, i) => [m.name, g.pen[i] || 0]));
  S.menu = false; S.ask = null; S.askBar = false; S.hold = null; clearTimeout(S.holdT);
  md.idx++;
  S._med = true; newGame(md.list[md.idx]);
}
const medLast = () => !S.medley || S.medley.idx >= S.medley.list.length - 1;
function vMedBox() {
  return `<section class="med-box" aria-label="おまかせメドレー">
    <div class="med-head"><b>おまかせメドレー</b><small>ゲームを選ぶ手間をなくして、次々流す</small></div>
    <div class="med-n" role="group" aria-label="ゲームの数">${[3, 5, 7].map((v) => `<button data-act="medN" data-v="${v}" aria-pressed="${S.medN === v}">${v}つ</button>`).join("")}</div>
    <button class="big" data-act="medStart">はじめる</button>
    <p class="note">人数に合うゲームだけ自動で選ぶ。お酒なし・触るのなし・地獄度の設定はそのまま守る</p>
  </section>`;
}
// 説明画面の下：進み具合・このあと・とばす
function vMedIntro() {
  const md = S.medley;
  if (!md) return "";
  const rest = md.list.slice(md.idx + 1);
  return `<div class="med-intro"><p class="med-prog"><span>メドレー ${md.idx + 1} / ${md.list.length}</span><i><b style="width:${((md.idx + 1) / md.list.length) * 100}%"></b></i></p>
    <p class="med-next"><small>このあと</small>${rest.length ? rest.map((m) => esc(MODE_NAME[m])).join(" → ") : "最後のゲーム"}</p>
    ${rest.length ? `<button class="text-btn" data-act="medNext">このゲームをとばす</button>` : ""}</div>`;
}

// ---------- ゲームが終わったら「次はこれどう？」 ----------
// 今の人数に合う短めのゲームを、今と違う種類から2つ（メドレー中は出さへん）
function nextPicks() {
  const g = S.game;
  if (g.nextP) return g.nextP;
  const n = S.members.length, kind = (m) => MODE_LIST.find((y) => y.m === m)?.cat;
  const ok = shuffle(MED_POOL.filter((m) => m !== g.mode && (!MODE_LIST.find((y) => y.m === m).min || n >= MODE_LIST.find((y) => y.m === m).min)));
  const out = [];
  const first = ok.find((m) => kind(m) !== kind(g.mode)) || ok[0];
  if (first) out.push(first);
  const second = ok.find((m) => m !== first && kind(m) !== kind(first) && kind(m) !== kind(g.mode)) || ok.find((m) => m !== first && kind(m) !== kind(first)) || ok.find((m) => m !== first);
  if (second) out.push(second);
  return (g.nextP = out);
}
function vNextPick() {
  if (S.medley) return "";
  const l = nextPicks();
  if (!l.length) return "";
  return `<section class="next-pick"><p class="next-h">次はこれどう？<small>${S.members.length}人</small></p><div>${l.map((m) => { const x = MODE_LIST.find((y) => y.m === m); return `<button class="np cat-${x.cat}" data-act="start" data-m="${m}"><b>${esc(MODE_NAME[m])}</b><span>${x.t}・${x.min || 2}人〜</span></button>`; }).join("")}</div></section>`;
}
