// ===== 第6弾：アプリ全体の動き =====
// 33 押した札が広がって画面になる / 35 起動の0.5秒 / 37 シートを下に引っ張って閉じる / 39 +1とカウントアップ
// ※ views.js より前に読み込む。ここのトップレベルでは views.js の const を触らんこと（関数の中でだけ使う）
const calmMotion = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

// ---------- 33 押した札が広がる ----------
// 遊び方の行を押したら、その行の位置から広がる。戻る時は逆に、元の行へ縮む
let mvFrom = null; // { rect, mode, bg }
function mvRemember(btn) {
  if (calmMotion() || !btn) { mvFrom = null; return; }
  const r = btn.getBoundingClientRect();
  mvFrom = { rect: { top: r.top, left: r.left, width: r.width, height: r.height }, mode: btn.dataset.m, bg: getComputedStyle(btn.classList.contains("hero-mode") ? btn : (btn.querySelector(".mode-ic") || btn)).backgroundColor, rad: getComputedStyle(btn).borderRadius };
}
function mvBox() { const f = document.querySelector(".frame") || document.body; const r = f.getBoundingClientRect(); return { top: 0, left: r.left, width: r.width, height: innerHeight }; }
function mvExpand(dir) {
  if (!mvFrom || calmMotion()) return;
  const full = mvBox();
  let to = mvFrom.rect;
  if (dir === "back") {
    const el = document.querySelector(`[data-act="start"][data-m="${mvFrom.mode}"]`);
    if (!el) { mvFrom = null; return; }
    const r = el.getBoundingClientRect();
    to = { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  const el = document.createElement("div");
  el.className = "mv-card";
  const px = (b) => ({ top: b.top + "px", left: b.left + "px", width: b.width + "px", height: b.height + "px" });
  el.style.background = mvFrom.bg;
  document.body.appendChild(el);
  const a = dir === "back" ? [{ ...px(full), borderRadius: "0px", opacity: 0 }, { ...px(full), borderRadius: "0px", opacity: 1, offset: .25 }, { ...px(to), borderRadius: mvFrom.rad, opacity: 0 }]
    : [{ ...px(to), borderRadius: mvFrom.rad, opacity: 1 }, { ...px(full), borderRadius: "0px", opacity: 1, offset: .65 }, { ...px(full), borderRadius: "0px", opacity: 0 }];
  const an = el.animate(a, { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" });
  an.onfinish = an.oncancel = () => el.remove();
  if (dir !== "back") mvFrom = { ...mvFrom };
}

// ---------- 35 起動の0.5秒 ----------
// 開いた時だけ。ホームが出たらロゴがポン→前のメンバーが順に出る。同じタブの2回目以降は出さへん
function bootAnim() {
  if (calmMotion()) return;
  try { if (sessionStorage.getItem("nd_booted")) return; sessionStorage.setItem("nd_booted", "1"); } catch {}
  document.body.classList.add("boot");
  setTimeout(() => document.body.classList.remove("boot"), 900);
  window.addEventListener("pointerdown", () => document.body.classList.remove("boot"), { once: true });
}

// ---------- 37 シートを下に引っ張って閉じる ----------
// 上の持ち手か、一番上までスクロールした状態から下へ。80px以上か勢いがあれば閉じる。足りんかったら元に戻る
function sheetSwipeInit(host) {
  let st = null;
  host.addEventListener("pointerdown", (e) => {
    const sh = e.target.closest(".sheet");
    if (!sh || e.target.closest("input, textarea, select")) return;
    if (sh.scrollTop > 0 && !e.target.closest(".sheet-grip")) return;
    st = { sh, y: e.clientY, t: e.timeStamp, dy: 0, on: false, id: e.pointerId };
  });
  host.addEventListener("pointermove", (e) => {
    if (!st || e.pointerId !== st.id) return;
    const dy = e.clientY - st.y;
    if (!st.on) { if (dy < 8) { if (dy < -8) st = null; return; } st.on = true; st.sh.style.animation = "none"; st.sh.style.transition = "none"; try { st.sh.setPointerCapture(e.pointerId); } catch {} }
    st.dy = Math.max(0, dy);
    st.sh.style.transform = `translateY(${st.dy}px)`;
    const back = st.sh.parentElement; if (back) back.style.background = `rgba(0,0,0,${0.55 * Math.max(0, 1 - st.dy / 400)})`;
  });
  const end = (e) => {
    if (!st) return;
    const s = st; st = null;
    if (!s.on) return;
    const fast = s.dy / Math.max(1, e.timeStamp - s.t) > 0.6;
    s.sh.style.transition = "transform .22s cubic-bezier(.2,.9,.3,1)";
    if (s.dy > 80 || (fast && s.dy > 30)) {
      s.sh.style.transform = "translateY(110%)";
      const back = s.sh.parentElement;
      if (back) back.style.transition = "background .22s", back.style.background = "rgba(0,0,0,0)";
      s.sh.dataset.swiped = "1";
      setTimeout(() => (back || s.sh).click(), 200);
    } else {
      s.sh.style.transform = "";
      const back = s.sh.parentElement; if (back) back.style.background = "";
    }
    // 引っ張りの後ろに click が出て「押した」扱いにならんように
    const kill = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    s.sh.addEventListener("click", kill, { capture: true, once: true });
    setTimeout(() => s.sh.removeEventListener("click", kill, { capture: true }), 60);
  };
  host.addEventListener("pointerup", end);
  host.addEventListener("pointercancel", end);
}

// ---------- 39 数字が動く ----------
// 結果発表の罰の数を、0から数え上げる（下の人から順に。1位だけ最後にドン）
function countUpRank(root) {
  if (calmMotion()) return;
  root.querySelectorAll(".rank li").forEach((li) => {
    const ct = li.querySelector(".ct"); if (!ct) return;
    const n = parseInt(ct.textContent, 10);
    if (!(n > 0) || n > 99) return;
    const d = parseFloat(li.style.getPropertyValue("--d")) || 0;
    ct.textContent = "0";
    const t0 = performance.now() + d * 1000 + 150, dur = Math.min(900, 220 + n * 90);
    const tick = (now) => {
      if (!ct.isConnected) return;
      const r = Math.min(1, Math.max(0, (now - t0) / dur));
      ct.textContent = String(Math.round(n * (1 - Math.pow(1 - r, 3))));
      if (r < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
