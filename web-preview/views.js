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
    // ガラガラ…（だんだんゆっくり）→ ポン
    rattle: (T) => { let t = 0, k = 0; while (t < T) { tone(k % 2 ? 1250 : 980, 0.03, "square", 0.05, 0, t); t += 0.07 + k * 0.006; k++; } },
    // ガラガラ → コロン（カプセルが出る）→ パカッ（割れる）→ 結果
    gachaPop: () => { SFX.rattle(0.5); tone(700, 0.06, "triangle", 0.12, 400, 0.45); noise(0.08, 0.4, 4000, 0.76); tone(1200, 0.05, "square", 0.06, 0, 0.76); noise(0.25, 0.45, 900, GACHA_T); tone(140, 0.35, "sine", 0.4, 60, GACHA_T); },
    gachaLucky: () => { SFX.rattle(0.5); tone(700, 0.06, "triangle", 0.12, 400, 0.45); noise(0.08, 0.35, 5000, 0.76); [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, "sine", 0.14, 0, 0.8 + i * 0.07)); },
    // ドラムロール（T秒）→ ジャーン
    drumroll: (T = 2.4) => { let t = 0, k = 0; while (t < T) { noise(0.05, 0.12 + 0.18 * (t / T), 1400, t); t += 0.055; k++; } [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.55 : 0.13, "triangle", 0.18, 0, T + i * 0.1)); noise(0.5, 0.35, 5000, T + 0.3); },
    hurry: () => { tone(1800, 0.04, "square", 0.07); },
    fanfare: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.45 : 0.13, "triangle", 0.16, 0, i * 0.12)); },
  };
})();
const play = (k) => {
  // 罰ガチャのマシンが回る時は、ガラガラ音のあとに結果の音
  if (S.gIntro && (k === "pop" || k === "lucky" || k === "boom")) k = k === "lucky" ? "gachaLucky" : "gachaPop";
  if (S.sound) try { SFX[k](); } catch {}
};

// ---------- icons ----------
// 線のアイコン（1本のパスで描く）
const ico = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON = {
  check: ico("M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M8 12.5l2.7 2.7L16 9.5"),
  pin: ico("M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10zM9.8 11a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0"),
  skull: ico("M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4.2 3 5.3V19h8v-3.7c1.8-1.1 3-2.9 3-5.3a7 7 0 0 0-7-7zM7.9 10.5a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0M13.299999999999999 10.5a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0M10.5 19v2M13.5 19v2"),
  hash: ico("M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"),
  chat: ico("M4 5h16v11H9l-5 4z"),
  smile: ico("M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M8 14a4.5 4.5 0 0 0 8 0M9 9.5h.01M15 9.5h.01"),
  timer: ico("M4 13a8 8 0 1 0 16 0a8 8 0 1 0 -16 0M12 9v4l2.5 2M9.5 2.5h5"),
  eye: ico("M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"),
  bang: ico("M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M12 7v6M12 16.5h.01"),
  question: ico("M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.4M12 16.8h.01"),
  scale: ico("M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z"),
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
  wolf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/><path d="M17.5 3.5v1"/></svg>`,
  target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></svg>`,
  undo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>`,
  split: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M4 12h16M9 7.5h6M9 16.5h6"/></svg>`,
  hand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.5 7-6.5 7S5 18 4 15l-1-3a1.5 1.5 0 0 1 2.8-1L8 14"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z"/></svg>`,
  num: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18h16"/><path d="M6 14v4M10 11v7M14 8v10M18 5v13"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M15.5 16.5h3M17 15v3"/></svg>`,
  mute: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M9 8.5l6 4M15 8.5l-6 4"/></svg>`,
  vote: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13h16v7H4z"/><path d="M8 13V5h8v8"/><path d="M10 9l1.5 1.5L14 8"/></svg>`,
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

// 罰2倍のバッジ（ギザギザの爆発マーク）
const X2_BURST = (() => {
  const pts = Array.from({ length: 28 }, (_, k) => { const r = k % 2 ? 34 : 48, a = (k / 28) * Math.PI * 2 - Math.PI / 2; return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`; }).join(" ");
  return `<svg class="x2-burst" viewBox="0 0 100 100" aria-label="罰2倍"><polygon points="${pts}" fill="#ff2a2a" stroke="#141210" stroke-width="3" stroke-linejoin="round"/><polygon points="${pts}" fill="none" stroke="#ffd23f" stroke-width="2" stroke-linejoin="round" transform="translate(50 50) scale(.78) translate(-50 -50)"/><text x="50" y="62" text-anchor="middle" font-family="Dela Gothic One, sans-serif" font-size="34" fill="#ffd23f" stroke="#141210" stroke-width="1.5">×2</text></svg>`;
})();
// 罰2倍の「元の数 → 倍の数」のメーター
const x2Meter = (html, n) => doubleAll(html, n).map((d) => `<div class="x2-meter"><span class="old">${esc(d.from)}</span><i>${ICON.next}</i><span class="new">${esc(d.to)}</span></div>`).join("");
// 罰ガチャのマシン（札が出る前に1.4秒ガラガラ回る）
const GACHA_T = 1.0;
const CROWN = `<svg class="crown" viewBox="0 0 24 16" aria-label="罰が一番多い"><path d="M2 14 1 4l6 4 5-7 5 7 6-4-1 10z" fill="#ffd23f" stroke="#141210" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="10" r="1.6" fill="#e8202a"/></svg>`;
// 長押ししてる間だけ中身が見える目隠し（スマホを渡して1人だけ見る画面用）
const peekBox = (inner, label = "長押しで見る", cls = "") => `<div class="peek ${cls}" data-peek>
  <div class="peek-in">${inner}</div>
  <div class="peek-cover"><span class="peek-ic">${ICON.eye}</span><b>${label}</b><small>指を離したら隠れる</small></div>
</div>`;
// ドームの中のカプセル：ドクロ顔と天使顔（6:2）
const miniSkull = (x, y) => `<g><circle cx="${x}" cy="${y}" r="10" fill="#f7f3ea" stroke="#141210" stroke-width="2"/><circle cx="${x - 3.6}" cy="${y - 1}" r="2.8" fill="#e8202a"/><circle cx="${x + 3.6}" cy="${y - 1}" r="2.8" fill="#e8202a"/><path d="M${x - 3} ${y + 5}h6" stroke="#141210" stroke-width="1.6" stroke-linecap="round"/></g>`;
const miniAngel = (x, y) => `<g><ellipse cx="${x}" cy="${y - 12}" rx="6" ry="2" fill="none" stroke="#ffd23f" stroke-width="2"/><circle cx="${x}" cy="${y}" r="10" fill="#fff3d6" stroke="#141210" stroke-width="2"/><path d="M${x - 6} ${y - 1}q2.5-3 5 0M${x + 1} ${y - 1}q2.5-3 5 0" fill="none" stroke="#141210" stroke-width="1.6" stroke-linecap="round"/><circle cx="${x - 6}" cy="${y + 4}" r="1.6" fill="#ff9aa8"/><circle cx="${x + 6}" cy="${y + 4}" r="1.6" fill="#ff9aa8"/></g>`;
const CAP_SKULL = `<svg viewBox="0 0 100 100"><path d="M50 10C28 10 16 25 16 44c0 12 7 20 15 24v10c0 3 3 6 6 6h26c3 0 6-3 6-6V68c8-4 15-12 15-24C84 25 72 10 50 10z" fill="#f7f3ea" stroke="#141210" stroke-width="4"/><ellipse cx="36" cy="46" rx="9" ry="10" fill="#e8202a"/><ellipse cx="64" cy="46" rx="9" ry="10" fill="#e8202a"/><path d="M50 56l-5 8h10z" fill="#141210"/></svg>`;
const CAP_ANGEL = `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="14" rx="20" ry="6" fill="none" stroke="#ffd23f" stroke-width="5"/><circle cx="50" cy="56" r="30" fill="#fff3d6" stroke="#141210" stroke-width="4"/><path d="M34 52q6-7 12 0M54 52q6-7 12 0" fill="none" stroke="#141210" stroke-width="4" stroke-linecap="round"/><path d="M42 68q8 7 16 0" fill="none" stroke="#141210" stroke-width="4" stroke-linecap="round"/></svg>`;
// 罰ガチャのマシン：ガタガタ回って、ドクロか天使のカプセルが出てきて、パカッと割れる（約1秒）
const gachaMachine = (lucky = false) => {
  const balls = [[44, 40, 0], [70, 36, 0], [56, 58, 1], [36, 62, 0], [80, 60, 0], [60, 24, 0], [46, 78, 1], [74, 78, 0]];
  return `<div class="g-machine ${lucky ? "lucky" : ""}" aria-hidden="true"><svg viewBox="0 0 120 160">
    <g class="gm-body">
      <circle cx="60" cy="56" r="46" fill="rgba(255,255,255,.16)" stroke="currentColor" stroke-width="4"/>
      <g class="gm-balls">${balls.map(([x, y, a]) => (a ? miniAngel(x, y) : miniSkull(x, y))).join("")}</g>
      <path d="M30 34a34 34 0 0 1 22-14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".55"/>
      <path d="M24 98h72l6 52H18z" fill="#e8202a" stroke="#141210" stroke-width="4" stroke-linejoin="round"/>
      <rect x="50" y="134" width="20" height="12" rx="3" fill="#141210"/>
      <g class="gm-handle"><circle cx="60" cy="116" r="11" fill="#f7f3ea" stroke="#141210" stroke-width="4"/><rect x="57" y="104" width="6" height="24" rx="3" fill="#141210"/></g>
    </g>
  </svg>
  <div class="gm-cap"><i class="t"></i><i class="b"></i><span class="ic">${lucky ? CAP_ANGEL : CAP_SKULL}</span></div>
  <i class="gm-burst"></i></div>`;
};
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
// 顔アイコンの文字：頭1文字。同じ頭文字の人がおる時だけ頭2文字
function iniOf(i) {
  const first = (nm) => Array.from(nm.trim())[0] || "";
  const nm = S.members[i]?.name || "";
  const f = first(nm);
  const clash = S.members.some((m, j) => j !== i && first(m.name) === f);
  return clash ? Array.from(nm.trim()).slice(0, 2).join("") : f;
}
const ini = (i) => { const t = iniOf(i); return Array.from(t).length > 1 ? `<span class="i2">${esc(t)}</span>` : esc(t); };
const dot = (i, size = "") => `<span class="dot" style="background:${colorOf(i)}">${ini(i)}</span>`;

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
    <b>遊ぶ人の名前を入れよう</b>
    <ol>
      <li>名前を入れて「＋」を押す（12人まで）</li>
      <li>2人以上入れたら「遊ぶ」を押す</li>
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
    ${ms.map((m, i) => `
      <div class="mem">
        ${dot(i)}
        <div class="nm"><b>${esc(m.name)}</b></div>
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
    <b>遊び方を選ぼう</b>
    <ol>
      <li>地獄度はお題の攻め具合。迷ったら「普通」</li>
      <li>遊び方を押したら、まず説明が出る</li>
      <li>やめたい時は「⋯」→結果発表</li>
    </ol>
    <button data-act="coachOk" data-k="mode">わかった</button>
  </div>`}
  <section style="display:flex;flex-direction:column;gap:10px">
    <p class="step-h"><span class="num">②</span>地獄度<small>お題・罰の攻め具合</small></p>
    <div class="levels">
      ${Object.entries(LV).map(([k, v]) => `<button class="lv" data-act="lv" data-v="${k}" aria-pressed="${S.level === k}">${v}<small>${LV_SUB[k]}</small></button>`).join("")}
    </div>
  </section>
  <section style="display:flex;flex-direction:column;gap:10px">
    <p class="step-h"><span class="num">③</span>遊び方</p>
    <div class="modes">
      <button class="mode" data-act="start" data-m="odai"><i class="mode-ic">${ICON.cards}</i><b>アホお題</b><span>${HELP.odai.desc}</span><em class="go">開始</em></button>
      <button class="mode" data-act="start" data-m="sugoroku"><i class="mode-ic">${ICON.dice}</i><b>すごろく</b><span>${HELP.sugoroku.desc}</span><em class="go">開始</em></button>
      <button class="mode" data-act="start" data-m="memory"><i class="mode-ic">${ICON.grid}</i><b>神経衰弱</b><span>${HELP.memory.desc}</span><em class="go">開始</em></button>
      <button class="mode" data-act="start" data-m="ito"><i class="mode-ic">${ICON.num}</i><b>価値観ナンバー</b><span>${HELP.ito.desc}</span><em class="go">開始</em></button>
      <button class="mode" data-act="start" data-m="gesture" ${S.members.length < 3 ? "disabled" : ""}><i class="mode-ic">${ICON.hand}</i><b>早押しジェスチャー</b><span>${S.members.length < 3 ? "3人から遊べる" : HELP.gesture.desc}</span><em class="go">開始</em></button>
      <button class="mode" data-act="start" data-m="homeru"><i class="mode-ic">${ICON.heart}</i><b>褒め殺し</b><span>${HELP.homeru.desc}</span><em class="go">開始</em></button>
      <button class="mode" data-act="start" data-m="ngword"><i class="mode-ic">${ICON.mute}</i><b>NGワード</b><span>${HELP.ngword.desc}</span><em class="go">開始</em></button>
      <button class="mode" data-act="start" data-m="vote" ${S.members.length < 3 ? "disabled" : ""}><i class="mode-ic">${ICON.vote}</i><b>ぶっちゃけ投票</b><span>${S.members.length < 3 ? "3人から遊べる" : HELP.vote.desc}</span><em class="go">開始</em></button>
      <button class="mode" data-act="start" data-m="wolf" ${S.members.length < 3 ? "disabled" : ""}><i class="mode-ic">${ICON.wolf}</i><b>ワードウルフ</b><span>${S.members.length < 3 ? "3人から遊べる" : HELP.wolf.desc}</span><em class="go">開始</em></button>
      <button class="mode" data-act="start" data-m="pittari" ${S.members.length < 3 ? "disabled" : ""}><i class="mode-ic">${ICON.target}</i><b>ピッタリ予想</b><span>${S.members.length < 3 ? "3人から遊べる" : HELP.pittari.desc}</span><em class="go">開始</em></button>
    </div>
  </section>
  ${S.night ? `<section class="night-switch">
    <p class="h2">夜の深さ</p>
    <div class="night-lv three">
      <button data-act="nightPick" data-v="off">通常<small>夜モードをやめる</small></button>
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
      <button class="ghost" data-act="coachReset">遊び方をもう一回見る<small class="ghost-sub">最初の説明と、各画面のひとこと説明がまた出る</small></button>
      <button class="ghost" data-act="sheetClose">閉じる</button>
    </div>
  </div>`;
}

// ---------- views: tutorial ----------
const TUT = [
  {
    step: "1 / 3",
    title: "名前を入れて、<br>遊び方を選ぶ",
    text: "遊ぶ人の名前を入れて、遊び方を選ぶだけ。遊び方は<b>10個</b>。どれも始める前に<b>説明が出る</b>から大丈夫。",
    art: () => `<div class="tut-modes">${["アホお題", "すごろく", "神経衰弱", "価値観ナンバー", "ジェスチャー", "褒め殺し", "NGワード", "ぶっちゃけ投票", "ワードウルフ", "ピッタリ予想"].map((m) => `<span>${m}</span>`).join("")}</div>`,
  },
  {
    step: "2 / 3",
    title: "負けたら罰ガチャ",
    text: "負けた人は<b>罰ガチャ</b>を引く。ドクロなら罰、たまに出る<b>天使</b>なら罰なし（飲めへん人はソフドリでOK）。",
    art: () => `<div class="gacha" style="max-width:280px"><div class="gacha-item" style="--d:.1s;--mc:var(--futsu)"><div class="capsule"><i class="top"></i><i class="bot"></i></div><div class="gacha-txt"><b>まゆの罰</b><p>次の番まで語尾が「ござる」</p></div></div></div>`,
  },
  {
    step: "3 / 3",
    title: "困ったら「⋯」",
    text: "画面のフチの色は<b>いまの人の色</b>。右上の<b>「⋯」</b>で、ルール・結果発表・設定が開ける。「〇〇だけ見て」の時は、他の人は見たらアカン。",
    art: () => `<div class="tut-menu"><span>${ICON.book}ルール早見表</span><span>${ICON.flag}結果発表</span><span>${ICON.gear}設定</span></div>`,
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
  const names = [...g.add.keys()].map((i) => esc(S.members[i].name));
  return `${names.length > 2 ? names.slice(0, 2).join("・") + ` ほか${names.length - 2}人` : names.join("・")}に罰 → ${base}`;
}

function vControls() {
  const g = S.game, all = S.members.map((_, i) => i);
  const nextLabel = g.mode === "sugoroku" ? (g.done ? "結果発表へ" : "次の人へ") : "次へ";
  switch (g.phase) {
    case "offer":
      return `<div class="choices">
        <button class="choice hot" data-act="double" data-v="1">倍プッシュ<small>成功→押し付け／失敗→罰2倍</small></button>
        <button class="choice" data-act="double" data-v="0">普通に見る<small>いつも通り</small></button>
      </div>`;
    case "revenge":
      return `${vChips(`${esc(S.members[g.doer].name)}のリベンジ。誰に押し付ける？`, "revTo", others(g.doer).filter((i) => !g.card.yoru || okForYoru(i)), false)}
        <button class="ghost" data-act="revCancel">やっぱやめる</button>`;
    case "push":
      return vChips("成功！罰を押し付ける相手をタップ", "pushTo", others(g.doer), false);
    case "batsu":
      return `<button class="big" data-act="accept">${g.gacha.every((x) => x.lucky) ? "ラッキー！" : "受け入れた"} → ${nextLabel}</button>`;
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
      // 続くルールを出した指令は、今は誰も罰にならへん。上に出しといて、破った時に「違反者に罰」
      if (g.card.ruleCard) return `<button class="big" data-act="next">ルール開始 → ${nextLabel}</button>`;
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
          <button class="vd ok" data-act="clear"><b>セーフ！</b><small>→ ${nextLabel}</small></button>
        </div>
        <p class="swipe-hint">${earlyTurns() ? `<span>← アウト</span>` : ""}<button class="link" data-act="penOpen">他の人に罰をつける</button>${earlyTurns() ? `<span>セーフ →</span>` : ""}</p>`;
      }
      return `
        ${subs ? `<div class="sub-acts">${subs}</div>` : ""}
        ${vPenGrid()}
        <button class="big ${g.add.size ? "has-pen" : ""}" data-act="next" ${!g.add.size && mustPick(g.card.tpl) ? "disabled" : ""}>${nextText(nextLabel)}</button>`;
    }
  }
}
// 操作のヒントは最初の3枚だけ（慣れたら消えてスッキリ）
const earlyTurns = () => (S.game?.cards ?? 0) < 3;

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
    const drum = S.anim; // 画面が切り替わった時だけマシンを回す（メニュー開閉などの再描画では回さへん）
    if (drum) S.gIntro = true;
    return `<div class="odai ${allLucky ? "lucky" : "batsu"} ${drum ? "drum" : anim}" id="card">
      ${drum ? gachaMachine(allLucky) : ""}
      <div class="head"><span>罰ガチャ</span></div>
      ${S.dual ? `<div class="mirror-list">${g.gacha.map((x) => `<p><b>${esc(S.members[x.i].name)}${x.lucky ? "はセーフ" : "の罰"}</b>${x.lucky ? x.html : doubledPlain(x.html, x.n)}</p>`).join("")}</div><hr class="dual-line">` : ""}
      ${(() => { const dbl = !allLucky && g.gacha.some((x) => x.n > 1 && !x.lucky); return `<div class="skull-wrap ${dbl ? "x2" : ""}">${allLucky ? `${ANGEL}<b>ラッキー！セーフ</b>` : dbl ? `<div class="x2-skulls">${SKULL}${SKULL}${X2_BURST}</div><b>罰ゲーム2倍！</b>` : `${SKULL}<b>罰ゲーム確定</b>`}</div>`; })()}
      <div class="gacha">${g.gacha.map((x, k) => `
        <div class="gacha-item ${x.night ? "night " + x.night : ""}" style="--d:calc(var(--gt, 0s) + ${(k * 0.35).toFixed(2)}s);--mc:${colorOf(x.i)}">
          <div class="capsule"><i class="top"></i><i class="bot"></i><i class="res ${x.lucky ? "ok" : ""}">${x.lucky ? "天" : "罰"}</i></div>
          <div class="gacha-txt"><b>${mixed ? `<span class="mark ${x.lucky ? "ok" : "ng"}">${x.lucky ? "天使" : "ドクロ"}</span>` : ""}${esc(S.members[x.i].name)}${x.lucky ? "はセーフ" : x.night === "shinya" ? "の深夜の罰" : x.night ? "の夜の罰" : "の罰"} ${x.n > 1 && !x.lucky ? `<span class="x2-badge">×${x.n}</span>` : ""}</b><p>${x.lucky ? x.html : doubleHtml(x.html, x.n)}</p>${!x.lucky && x.n > 1 ? x2Meter(x.html, x.n) : ""}</div>
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
    <div class="head">${vWho()}<span class="meta">${plainKind(c) ? "" : `<span class="kind">${esc(shortKind(c.kind))}</span>`}${cardTag(c) && g.phase === "play" ? `<i class="tag">${cardTag(c)}</i>` : ""}${badge}</span></div>
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
  const g = S.game;
  const bomb = g.bomb && !g.phase.startsWith("bomb")
    ? `<div class="rule bomb"><span class="fuse" aria-hidden="true"></span><span><b>時限爆弾 作動中</b><br><span class="nowrap">仕掛け人：${esc(S.members[g.bomb.owner].name)}</span></span><button class="rule-out look" data-act="bombLook">中身を見る</button></div>` : "";
  // ルールが出た札そのものを見てる間は、上の枠は出さへん（同じ文が2回並ぶので）
  // 新しい順に2つまで（画面を圧迫せんように）
  const list = g.rules.map((r, k) => ({ r, k })).filter(({ r }) => !(r.card && r.card === g.card && g.phase === "play")).reverse();
  const shown = list.slice(0, 2);
  return bomb + shown.map(({ r, k }, j) => `<div class="rule"><span class="rule-txt"><b>${r.who != null ? `${esc(S.members[r.who].name)}の次の番まで` : `発動中 残り${r.left}ターン`}${j === 0 && list.length > 2 ? `<em>ほか${list.length - 2}件</em>` : ""}</b><span>${r.html}</span></span><button class="rule-out" data-act="ruleOpen" data-k="${k}">違反者に罰</button></div>`).join("");
}
// 誰の番か（札の上に1行でまとめる）
function vWho() {
  const g = S.game;
  const label = g.card?.bomb ? "が仕掛け人" : g.card?.passed ? "に回ってきた" : g.doer !== g.cur ? "に押し付けられた" : "の番";
  return `<span class="who" style="--mc:${colorOf(g.doer)}"><i></i><b>${esc(S.members[g.doer].name)}</b><small>${label}</small></span>`;
}
// 上のバー：左に罰スコアの顔アイコン列、右に「⋯」メニューだけ
function vBar() {
  const g = S.game, n = S.members.length;
  // 右のボタン3つ（上下反転・向かい合わせ・⋯）の分をよけて、入る人数だけ顔を出す。入りきらん分は「…」にまとめる
  const frameW = Math.min(window.innerWidth, 560) - 32;
  const fit = Math.max(2, Math.floor((frameW - 3 * 46 - 18) / 44));
  let shown = S.members.map((_, i) => i);
  if (n > fit) {
    shown = shown.slice(0, fit - 1);
    if (g.doer >= 0 && !shown.includes(g.doer)) shown[shown.length - 1] = g.doer; // 今の番の人は必ず見せる
  }
  // 罰が一番多い人に王冠（同点なら全員）。入りきらん時も王冠の人は顔を出す
  const maxPen = Math.max(...g.pen);
  const kings = maxPen > 0 ? g.pen.map((v, i) => (v === maxPen ? i : -1)).filter((i) => i >= 0) : [];
  if (n > fit) kings.forEach((kI) => { if (!shown.includes(kI) && shown.length >= 2) { const slot = shown.length - (shown[shown.length - 1] === g.doer ? 2 : 1); if (slot >= 0 && shown[slot] !== g.doer) shown[slot] = kI; } });
  // 罰が増えた人はポンと跳ねる
  const prev = S.prevPen && S.prevPen.length === n ? S.prevPen : g.pen;
  const bump = (i) => g.pen[i] > prev[i];
  S.prevPen = [...g.pen];
  const hidden = n - shown.length;
  const rv = (i) => g.rev[i] && (g.mode === "odai" || g.mode === "sugoroku");
  return `<div class="bar">
    <div class="score" aria-label="罰スコア">${shown.map((i) => `
      <span class="av ${i === g.doer ? "is-turn" : ""} ${bump(i) ? "bump" : ""}" style="--mc:${colorOf(i)}" title="${esc(S.members[i].name)} 罰${g.pen[i]}">
        ${kings.includes(i) ? CROWN : ""}${ini(i)}${g.pen[i] ? `<b class="cnt">${g.pen[i]}</b>` : ""}${rv(i) ? `<i class="rv">↺</i>` : ""}
      </span>`).join("")}${hidden ? `<button class="av more" data-act="scores" aria-label="全員の罰を見る">…<b class="cnt">${hidden}</b></button>` : ""}</div>
    <button class="icon-btn bar-btn" data-act="flip" aria-pressed="${S.flip}" aria-label="上下反転">${ICON.flip}</button>
    <button class="icon-btn bar-btn" data-act="dual" aria-pressed="${S.dual}" aria-label="向かい合わせ表示">${ICON.split}</button>
    <button class="icon-btn menu-btn" data-act="menu" aria-label="メニュー">${ICON.more}</button>
  </div>`;
}
// 時限爆弾の中身を仕掛け人だけ見直す（1段目で他の人に目をそらさせる）
function vBombLook() {
  const g = S.game, b = g.bomb;
  if (!b) return "";
  const nm = esc(S.members[b.owner].name);
  return `
  <div class="sheet-back" data-act="bombLookClose">
    <div class="sheet bomb-look" role="dialog" aria-label="時限爆弾の中身" data-stop>
      <div class="sheet-grip"></div>
      ${S.bombLook === 1
        ? `<h2>${nm}だけ見て</h2><p class="sheet-note">ほかの人は目そらして！</p>
           <button class="big" data-act="bombLookShow">${nm}が見る</button>`
        : `<h2>時限爆弾の中身</h2>
           <p class="bomb-cond"><mark style="--mc:#ff7a1a">${esc(b.cond)}</mark>奴を、こっそり監視</p>
           <p class="sheet-note">見たらすぐ閉じてな</p>`}
      <button class="ghost" data-act="bombLookClose">閉じる</button>
    </div>
  </div>`;
}
// 「…」から開く、全員の罰の一覧
function vScores() {
  const g = S.game;
  const rows = S.members.map((m, i) => ({ m, i, n: g.pen[i] })).sort((a, b) => b.n - a.n);
  return `
  <div class="sheet-back" data-act="scoresClose">
    <div class="sheet" role="dialog" aria-label="全員の罰" data-stop>
      <div class="sheet-grip"></div>
      <h2>全員の罰</h2>
      <ol class="rank">${rows.map((r, k) => `<li><span class="no">${k + 1}</span><i class="pc" style="background:${colorOf(r.i)}"></i><span class="nm">${esc(r.m.name)}${r.i === g.doer ? "<small>いまの番</small>" : ""}</span><span class="ct">${r.n}</span></li>`).join("")}</ol>
      <button class="ghost" data-act="scoresClose">閉じる</button>
    </div>
  </div>`;
}
function vMenu() {
  const g = S.game;
  // 結果発表・やめるは押し間違えたら戻れへんので、1回だけ確認を挟む
  if (S.ask) {
    const end = S.ask === "end";
    return `
  <div class="sheet-back" data-act="menuClose">
    <div class="sheet menu" role="dialog" aria-label="確認" data-stop>
      <div class="sheet-grip"></div>
      <h2>${end ? "ここで結果発表する？" : "ゲームをやめる？"}</h2>
      <p class="sheet-note">${end ? "ゲームはここで終わり。罰が一番多い人を発表するで" : "罰の記録は消えて、最初の画面に戻る"}</p>
      <button class="${end ? "big" : "big danger-btn"}" data-act="${end ? "end" : "home"}">${end ? "結果発表する" : "やめる"}</button>
      <button class="ghost" data-act="askNo">続ける</button>
    </div>
  </div>`;
  }
  const canUndo = S.hist.length > 0 && !busyGame();
  return `
  <div class="sheet-back" data-act="menuClose">
    <div class="sheet menu" role="dialog" aria-label="メニュー" data-stop>
      <div class="sheet-grip"></div>
      <p class="menu-meta">${esc(modeLine(g))}</p>
      <button class="menu-item hot" data-act="ask" data-v="end">${ICON.flag}<span>結果発表<small>ここで終わって、罰が一番多い人を発表</small></span></button>
      <button class="menu-item" data-act="undo" ${canUndo ? "" : "disabled"}>${ICON.undo}<span>1手戻す<small>${canUndo ? "押し間違えた時に、直前の操作を取り消す" : "まだ戻せる操作がない"}</small></span></button>
      <button class="menu-item" data-act="rules">${ICON.book}<span>ルール早見表<small>${MODE_NAME[g.mode]}の遊び方</small></span></button>
      <button class="menu-item" data-act="sheet">${ICON.gear}<span>設定<small>効果音・読み上げ・遊び方</small></span></button>
      <button class="menu-item danger" data-act="ask" data-v="home">${ICON.exit}<span>ゲームをやめる<small>罰の記録は消える</small></span></button>
      <button class="ghost" data-act="menuClose">閉じる</button>
    </div>
  </div>`;
}
// ---------- 分かりやすさ ----------
// 押し付け・当てはまらんの時は（）の中だけ出す（「〜の番」と同じ情報が並ばんように）
function shortKind(k) {
  const m = k.match(/（(.*)）$/);
  return m ? m[1] : k;
}
// 普通のお題は種類名を出さへん（地獄度は画面の色で分かる）。夜・緊急・押し付けなどの時だけ出す
function plainKind(c) {
  return !!c.kind && !c.kind.includes("（") && /^(\d+マス目・)?(アホお題|全員参加)/.test(c.kind);
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
  double: "倍プッシュ：できたら誰かに罰、できんかったら罰2回",
  bomb: "時限爆弾：仕掛け人だけがNG行動を知ってる。やった人は後で全員罰",
  rule: "このルールは上に出しとく。破った人が出たら「違反者に罰」",
  event: "緊急指令：アウトの人を下で選ぶ",
  contest: "負けた人を下で選んでから「次へ」",
  swipe: "できたらセーフ、できんかったらアウト。札を左右にスワイプでもOK",
  notme: "当てはまらん時は、罰なしで誰かに回せる",
  pass: "夜のお題は「無理！」で罰なしパスできる",
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
  const md = S.game?.mode || "odai";
  const items = [...(HELP[md] || HELP.odai).rules];
  if (S.night && md !== "vote") items.push(["夜モード", "夜・深夜のお題や罰も混ざる。下ネタNGの人には振られへん。夜お題は「無理！」で罰なしパス"]);
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
const WHY = { out: "アウト", rule: "違反", double: "倍プッシュ失敗", push: "押し付けられ", bomb: "爆弾", vote: "投票1位", ng: "NGワード", mfail: "答えられへん", skull: "ドクロ", mlow: "最下位", ito: "並び間違い", glow: "ジェスチャー最下位", hmlaugh: "笑った", hmfail: "褒め負け", wolf: "ワードウルフ負け", pit: "予想が一番遠い" };
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
      <p class="rule-now">${g.rules[S.ruleK]?.html || ""}</p>
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
  return `<p class="next-up">次の番 ${ICON.next}<span class="av sm" style="--mc:${colorOf(n)}">${ini(n)}</span>${esc(S.members[n].name)}</p>`;
}

function vOdai() {
  const g = S.game;
  if (g.intro) return vIntroStage("odai", { extra: lvBox("", false), btn: `${mName(0)}からスタート`, act: "introGo" });
  return `<div id="stage" class="${S.flip ? "flipped" : ""}">
    ${vBar()}
    ${vRule()}
    <div class="deck">${vCard()}</div>
    ${vCoach()}
    ${vControls()}
  </div>`;
}

// ---------- NGワード（画面） ----------
const NG_MIN = [3, 5, 10, 15, 0];
const mName = (i) => esc(S.members[i].name);
const bigWho = (i, sub) => `<div class="hand-who" style="--mc:${colorOf(i)}"><span class="hand-dot">${ini(i)}</span><b>${mName(i)}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
function ngWordsFor(viewer) {
  const ng = S.game.ng;
  return `<ul class="ng-list">${S.members.map((m, j) => j === viewer ? "" : `<li style="--mc:${colorOf(j)}"><span class="nm"><i></i>${esc(m.name)}</span><b>${esc(ng.words[j])}</b></li>`).join("")}</ul>`;
}
function vNgCard() {
  const g = S.game, ng = g.ng, n = S.members.length;
  switch (ng.phase) {
    case "hand": return `<div class="odai mode-card center" id="card">
      ${ng.dealing ? `<p class="prog">ワード配り ${ng.viewer + 1} / ${n}</p>` : `<p class="prog">ワードの見直し</p>`}
      ${bigWho(ng.viewer, "だけ見て")}
      <p class="hand-note">スマホを${mName(ng.viewer)}に渡して。<br>他の人は画面を見たらアカン</p>
    </div>`;
    case "look": return `<div class="odai mode-card mid" id="card">
      <div class="head"><span class="who" style="--mc:${colorOf(ng.viewer)}"><i></i><b>${mName(ng.viewer)}</b><small>以外のNGワード</small></span></div>
      <div class="mid-body">
      ${peekBox(ngWordsFor(ng.viewer), "長押しで見る", n > 5 ? "many" : "")}
      <p class="how-note">自分のワードはここに出えへん。覚えたら指を離してな</p>
      </div>
    </div>`;
    case "play": case "who": return `<div class="odai mode-card center" id="card">
      ${ng.minutes ? `<p class="ng-timer ${ng.left < 30000 ? "hurry" : ""}" id="ngTimer">${fmtTime(ng.endAt ? ng.endAt - Date.now() : ng.left)}</p>` : `<p class="ng-timer free">∞</p>`}
      <p class="ng-lead">相手にNGワードを<br>言わせろ！</p>
      ${ng.topic ? `<p class="ng-topic"><small>話題</small>${esc(ng.topic)}</p>` : ""}
    </div>`;
    case "confirm": return `<div class="odai mode-card center" id="card">
      ${bigWho(ng.out, "")}
      <p class="ng-lead">NGワード、言うた？</p>
      <p class="hand-note">アウトにしたら、${mName(ng.out)}のワードを発表する</p>
    </div>`;
    case "out": return `<div class="odai ${ng.res.lucky ? "lucky" : "batsu"} mode-card center ${S.anim ? "shake" : ""}" id="card">
      <p class="prog">${mName(ng.out)} アウト！</p>
      <p class="ng-reveal"><small>NGワードは</small><b>「${esc(ng.words[ng.out])}」</b></p>
      <div class="skull-wrap sm">${ng.res.lucky ? `${ANGEL}<b>天使！罰なし</b>` : `${SKULL}<b>罰ゲーム</b>`}</div>
      <p class="rule-pen">${ng.res.html}</p>
    </div>`;
    case "eyes": return `<div class="odai mode-card center" id="card">
      ${bigWho(ng.out, "は目をつぶれ！")}
      <p class="hand-note">${mName(ng.out)}の新しいNGワードを、<br>${mName(ng.out)}以外の全員で見る</p>
    </div>`;
    case "newword": return `<div class="odai mode-card center" id="card">
      <p class="prog">${mName(ng.out)}の新しいNGワード</p>
      <p class="ng-reveal"><b>「${esc(ng.words[ng.out])}」</b></p>
      <p class="hand-note">${mName(ng.out)}には見せたらアカン</p>
    </div>`;
    case "over": return `<div class="odai mode-card center" id="card">
      <p class="ng-timer">0:00</p>
      <p class="ng-lead">タイムアップ！</p>
      <p class="hand-note">結果発表で、みんなのNGワードを公開</p>
    </div>`;
  }
  return "";
}
function vNgControls() {
  const g = S.game, ng = g.ng, n = S.members.length;
  switch (ng.phase) {
    case "hand": return `<button class="big" data-act="ngSee">${mName(ng.viewer)}が見る</button>${ng.dealing ? "" : `<button class="ghost" data-act="ngBack">やっぱやめる</button>`}`;
    case "look": return `<button class="big" data-act="ngNext">${!ng.dealing ? "覚えた、隠す" : ng.viewer + 1 < n ? `覚えた → ${mName(ng.viewer + 1)}に渡す` : "覚えた → スタート"}</button>`;
    case "play": return `
      <div class="pen-grid-wrap"><p class="pen-q">言うてもうたのは？<span>タップでアウト</span></p>
      <div class="pen-grid ${n > 6 ? "many" : ""}">${S.members.map((m, i) => `<button class="pen-tile" style="--mc:${colorOf(i)}" data-act="ngTap" data-i="${i}"><span class="bar"></span><span class="nm">${esc(m.name)}</span><span class="meta"><em>アウト${g.pen[i]}</em></span></button>`).join("")}</div></div>
      <div class="sub-acts two"><button data-act="ngPeek">ワードを見直す</button><button data-act="ngTopic">話題を出す</button></div>`;
    case "who": return `${vChipsSimple("誰がワードを見直す？", "ngWho", S.members.map((_, i) => i))}<button class="ghost" data-act="ngBack">やめる</button>`;
    case "confirm": return `<div class="verdict"><button class="vd ok" data-act="ngNo"><b>言うてない</b><small>戻る</small></button><button class="vd ng" data-act="ngYes"><b>アウト！</b><small>罰ガチャ</small></button></div>`;
    case "out": return `<button class="big" data-act="ngNew">${ng.res.lucky ? "ラッキー！" : "受け入れた"} → 新しいワードを配る</button>`;
    case "eyes": return `<button class="big" data-act="ngEyes">${mName(ng.out)}以外で見る</button>`;
    case "newword": return `<button class="big" data-act="ngHide">見た、隠す → 再開</button>`;
    case "over": return `<button class="big" data-act="end">結果発表</button>`;
  }
  return "";
}
function vChipsSimple(head, act, list) {
  return `<div class="pen"><h3>${head}</h3><div class="chips">${list.map((i) => `<button class="chip" style="--mc:${colorOf(i)}" data-act="${act}" data-i="${i}"><span class="dot"></span>${esc(S.members[i].name)}</button>`).join("")}</div></div>`;
}
function vNg() {
  const ng = S.game.ng;
  if (ng.phase === "setup") return vIntroStage("ngword", { extra: `${lvBox(NG_LV[S.level])}<div class="ng-min-wrap"><p class="ng-min-h">制限時間</p><div class="ng-min">${NG_MIN.map((m) => `<button data-act="ngMin" data-v="${m}" aria-pressed="${ng.minutes === m}">${m ? m + "分" : "なし"}</button>`).join("")}</div></div>`, btn: "ワードを配る", act: "ngDeal" });
  return `<div id="stage" class="${S.flip ? "flipped" : ""}">
    ${vBar()}
    <div class="deck">${vNgCard()}</div>
    ${vNgControls()}
  </div>`;
}

// 票のバー。画面が切り替わった時は 0 から1票ずつ数え上げる（postFx が動かす）
function vbars(rows, max, isTop, stamp) {
  const count = S.anim && rows.some((r) => r.v > 0);
  return `<ul class="vbars ${count ? "count" : ""}" data-max="${max}">${rows.map((r, k) => `<li class="${isTop(r.i) ? "top" : ""} ${r.i < 0 ? "none" : ""}" data-v="${r.v}" style="--mc:${r.i < 0 ? "#8d857a" : colorOf(r.i)};--d:${(0.15 + (rows.length - k) * 0.12).toFixed(2)}s"><span class="nm">${r.i < 0 ? "ウルフはおらん" : mName(r.i)}</span><span class="bar"><i style="--w:${count ? 0 : max ? (r.v / max) * 100 : 0}%"></i></span><b>${count ? 0 : r.v}</b>${stamp && isTop(r.i) ? `<span class="stamp">罰</span>` : ""}</li>`).join("")}</ul>`;
}
// 数え上げにかかる時間（秒）
const voteStep = (total) => Math.max(0.12, Math.min(0.42, 3.2 / Math.max(1, total)));
const voteFxTime = (counts) => { const t = (counts || []).reduce((a, b) => a + b, 0); return t ? 0.3 + t * voteStep(t) : 0; };

// ---------- ぶっちゃけ投票（画面） ----------
function vVoteCard() {
  const g = S.game, vt = g.vt, n = S.members.length;
  const nc = vt.night === "shinya" ? "deep" : vt.night ? "yoru" : "";
  const qHead = `<div class="head"><span class="who"><b>第${vt.round}問</b></span><span class="meta">${vt.night ? `<span class="kind">${vt.night === "shinya" ? "深夜" : "夜"}の質問</span>` : ""}<i class="tag">投票</i></span></div>`;
  switch (vt.phase) {
    case "q": return `<div class="odai ${nc} mode-card ${S.anim ? "in" : ""}" id="card">
      ${qHead}
      <p class="txt" style="font-size:${fitSize(vt.q, false)}"><span>${esc(vt.q)}</span></p>
      <p class="vote-rule ${vt.good ? "good" : "bad"}">${vt.good ? "褒める系：票が一番<b>少ない</b>人が罰" : "イジる系：票が一番<b>多い</b>人が罰"}</p>
      <p class="how-note">自分以外の誰かに、こっそり1票${vt.night ? "（下ネタNGの人は候補に出えへん）" : ""}</p>
    </div>`;
    case "hand": { const v = vt.order[vt.k]; return `<div class="odai ${nc} mode-card center" id="card">
      <p class="prog">投票 ${vt.k + 1} / ${n}</p>
      ${bigWho(v, "の番")}
      <p class="hand-note">スマホを${mName(v)}に渡して。<br>他の人は画面を見たらアカン</p>
    </div>`; }
    case "vote": { const v = vt.order[vt.k]; return `<div class="odai ${nc} mode-card" id="card">
      <div class="head"><span class="who" style="--mc:${colorOf(v)}"><i></i><b>${mName(v)}</b><small>の投票</small></span></div>
      <p class="vote-q">${esc(vt.q)}</p>
      <div class="pen-grid vote-grid ${n > 6 ? "many" : ""}">${vt.cands.filter((i) => i !== v).map((i) => `<button class="pen-tile" style="--mc:${colorOf(i)}" data-act="vPick" data-i="${i}"><span class="bar"></span><span class="nm">${mName(i)}</span></button>`).join("")}</div>
    </div>`; }
    case "done": return `<div class="odai ${nc} mode-card center" id="card">
      <p class="prog">${esc(vt.q)}</p>
      <p class="ng-lead">全員投票した！</p>
      <p class="hand-note">スマホをみんなが見える所に置いて</p>
    </div>`;
    case "reveal": {
      const c = voteCounts(), max = Math.max(...c);
      const rows = vt.cands.map((i) => ({ i, v: c[i] })).sort((a, b) => b.v - a.v);
      const rule = `<p class="vote-rule ${vt.good ? "good" : "bad"}">${vt.good ? "褒める系なので、票が一番少ない人が罰" : "イジる系なので、票が一番多い人が罰"}</p>`;
      return `<div class="odai ${nc} mode-card" id="card">
        ${qHead}
        <p class="vote-q">${esc(vt.q)}</p>
        ${rule}
        ${vbars(rows, max, (i) => vt.top.includes(i), true)}
      </div>`;
    }
    case "batsu": return vCard();
  }
  return "";
}
function vVoteControls() {
  const g = S.game, vt = g.vt;
  switch (vt.phase) {
    case "q": return `<button class="big" data-act="vStart">投票スタート</button><button class="ghost" data-act="vSkip">この質問はパス</button>`;
    case "hand": return `<button class="big" data-act="vHand">${mName(vt.order[vt.k])}です。投票する</button>`;
    case "vote": return `<p class="hint">押したらすぐ次の人へ。誰に入れたかは出えへん</p>`;
    case "done": return `<button class="big" data-act="vReveal">結果発表</button>`;
    case "reveal": return `<button class="big has-pen" data-act="vGacha">${vt.top.map(mName).join("・")}に罰ガチャ</button>`;
    case "batsu": return `<button class="big" data-act="vNext">${g.gacha.every((x) => x.lucky) ? "ラッキー！" : "受け入れた"} → 次の質問</button>`;
  }
  return "";
}
function vVote() {
  if (S.game.vt.phase === "intro") return vIntroStage("vote", { extra: lvBox(), btn: "1問目へ", act: "vBegin" });
  return `<div id="stage" class="${S.flip ? "flipped" : ""}">
    ${vBar()}
    <div class="deck">${vVoteCard()}</div>
    ${vVoteControls()}
  </div>`;
}

// ---------- ワードウルフ（画面） ----------
// ウルフの顔（cls: "caught" つかまった / "win" 逃げ切り）
// ウルフの顔（cls: "caught" つかまって泣いてる / "win" 逃げ切りでニヤリ）
const WOLF_FACE = {
  normal: `<path d="M22 40 45 47M78 40 55 47" stroke="#0b0d12" stroke-width="5" stroke-linecap="round"/>
  <ellipse class="w-glow" cx="35" cy="52" rx="12" ry="7" fill="#ffd23f" opacity=".22"/><ellipse class="w-glow" cx="65" cy="52" rx="12" ry="7" fill="#ffd23f" opacity=".22"/>
  <path class="w-eye" d="M25 45 45 50.5 41 58 28 53.5z" fill="url(#eg)" stroke="#0b0d12" stroke-width="2" stroke-linejoin="round"/>
  <path class="w-eye" d="M75 45 55 50.5 59 58 72 53.5z" fill="url(#eg)" stroke="#0b0d12" stroke-width="2" stroke-linejoin="round"/>
  <path d="M37 49v7.5M63 49v7.5" stroke="#0b0d12" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M41 75q9 5 18 0" fill="none" stroke="#0b0d12" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M42.5 76 45 85 47.5 77.5M57.5 76 55 85 52.5 77.5" fill="#fff" stroke="#0b0d12" stroke-width="1.4" stroke-linejoin="round"/>`,
  // 泣き顔：眉は八の字、目は「＞＜」でぎゅっとつぶって、涙がぽろぽろ、口はへの字でふるえる
  caught: `<path d="M24 45 44 39M76 45 56 39" stroke="#0b0d12" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M29 47.5 41 53 29 58.5M71 47.5 59 53 71 58.5" fill="none" stroke="#0b0d12" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path class="w-tear-stream" d="M33 58q-2 7 0 14M67 58q2 7 0 14" fill="none" stroke="#6cc7ff" stroke-width="4" stroke-linecap="round" opacity=".85"/>
  <path class="w-tear" d="M31 58c-3 5-4.5 8-4.5 10.5a4.5 4.5 0 0 0 9 0c0-2.5-1.5-5.5-4.5-10.5z" fill="#8fd8ff" stroke="#0b0d12" stroke-width="1.5"/>
  <path class="w-tear r" d="M69 58c-3 5-4.5 8-4.5 10.5a4.5 4.5 0 0 0 9 0c0-2.5-1.5-5.5-4.5-10.5z" fill="#8fd8ff" stroke="#0b0d12" stroke-width="1.5"/>
  <path class="w-mouth" d="M40 80q2.5-4 5 0t5 0 5 0 5 0" fill="none" stroke="#0b0d12" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
};
const WOLF = (cls = "") => `<svg class="wolf ${cls}" viewBox="0 0 100 100" aria-hidden="true">
  <defs>
  <radialGradient id="eg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6b0"/><stop offset=".55" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff8a1a"/></radialGradient>
  <linearGradient id="fur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b556e"/><stop offset="1" stop-color="#262c3b"/></linearGradient>
  </defs>
  <path d="M50 19 35 23 21 38 12 58l11 1-6 11 14 2 8 16 11 9 11-9 8-16 14-2-6-11 11-1-9-20-14-15zM19 47 25 3l23 26zM81 47 75 3 52 29z" fill="none" stroke="#9fb2e6" stroke-opacity=".35" stroke-width="8" stroke-linejoin="round"/>
  <path d="M19 47 25 3l23 26zM81 47 75 3 52 29z" fill="#262c3b" stroke="#0b0d12" stroke-width="3" stroke-linejoin="round"/>
  <path d="M25 37 27 14l12 14zM75 37 73 14 61 28z" fill="#5d6782"/>
  <path d="M50 19 35 23 21 38 12 58l11 1-6 11 14 2 8 16 11 9 11-9 8-16 14-2-6-11 11-1-9-20-14-15z" fill="url(#fur)" stroke="#0b0d12" stroke-width="3" stroke-linejoin="round"/>
  <path d="M50 21 43 38 50 57 57 38z" fill="#6b7590" opacity=".9"/>
  <path d="M23 58 33 56 38 64M77 58 67 56 62 64" fill="none" stroke="#7d87a3" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M37 63 50 58 63 63 59 80 50 90 41 80z" fill="#d7dcea" stroke="#0b0d12" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M43 61.5h14l-7 7.5z" fill="#0b0d12"/>
  ${cls === "caught" ? WOLF_FACE.caught : WOLF_FACE.normal}
</svg>`;
function vWfCard() {
  const g = S.game, wf = g.wf, n = S.members.length;
  const nc = wf.night === "shinya" ? "deep" : wf.night ? "yoru" : "";
  const late = wf.phase === "reveal" && S.anim ? "late" : "";
  const lateD = `--late:${(voteFxTime([...(wf.counts || []), wf.none || 0]) + 0.2).toFixed(2)}s`;
  const words = (showMaj = true) => wf.allCit
    ? `<div class="wf-words one ${late}" style="${lateD}"><p class="c"><small>全員市民</small><b>${esc(wf.maj)}</b><span>ウルフはおらんかった</span></p></div>`
    : `<div class="wf-words ${late}" style="${lateD}">
      <p class="w"><small>${WOLF()}ウルフ${wf.wolves.length > 1 ? `${wf.wolves.length}人` : ""}</small><b>${esc(wf.min)}</b><span class="wn">${wf.wolves.map((i) => `<span style="--mc:${colorOf(i)}"><i></i>${mName(i)}</span>`).join("")}</span></p>
      <p class="c"><small>市民</small><b>${showMaj ? esc(wf.maj) : "？？？"}</b><span>ほか${n - wf.wolves.length}人</span></p>
    </div>`;
  const wolfRow = (mood) => `<div class="wf-row n${Math.max(1, wf.wolves.length)}">${(wf.wolves.length ? wf.wolves : [-1]).map(() => WOLF(mood)).join("")}</div>`;
  const kTxt = `${wfCount(wf, n)}人${wfPeaceOk(wf, n) ? "（全員市民の回もある）" : ""}`;
  switch (wf.phase) {
    case "hand": return `<div class="odai mode-card center" id="card">
      <p class="prog">${wf.dealing ? `お題配り ${wf.dealt + 1} / ${n}` : "お題の見直し"}</p>
      ${bigWho(wf.viewer, "だけ見て")}
      <p class="hand-note">スマホを${mName(wf.viewer)}に渡して。<br>他の人は画面を見たらアカン</p>
    </div>`;
    case "look": return `<div class="odai ${nc} mode-card center" id="card">
      <p class="prog">${mName(wf.viewer)}のお題</p>
      ${peekBox(`<p class="ng-reveal wf-word"><b>${esc(wfWord(wf.viewer))}</b></p>`)}
      <p class="hand-note">自分が市民かウルフかは分からへん。<br>お題そのものは言うたらアカン</p>
    </div>`;
    case "talk": case "who": return `<div class="odai mode-card center" id="card">
      <p class="ng-timer ${wf.timeUp ? "" : "run"}" id="${wf.timeUp ? "" : "modeTimer"}">${wf.timeUp ? "0:00" : fmtTime(wf.endAt ? Math.max(0, wf.endAt - Date.now()) : wf.minutes * 60000)}</p>
      <p class="ng-lead">${wf.timeUp ? "時間切れ！<br>投票へ" : "お題の話をして<br>ウルフを探せ！"}</p>
      <p class="hand-note">${n}人のうちウルフは${kTxt}。<br>自分がウルフかもしれへん</p>
    </div>`;
    case "vhand": { const v = wf.order[wf.k]; return `<div class="odai mode-card center" id="card">
      <p class="prog">投票 ${wf.k + 1} / ${n}</p>
      ${bigWho(v, "の番")}
      <p class="hand-note">スマホを${mName(v)}に渡して。<br>他の人は画面を見たらアカン</p>
    </div>`; }
    case "vote": { const v = wf.order[wf.k]; return `<div class="odai mode-card" id="card">
      <div class="head"><span class="who" style="--mc:${colorOf(v)}"><i></i><b>${mName(v)}</b><small>の投票</small></span></div>
      <p class="vote-q">ウルフやと思うのは？</p>
      <div class="pen-grid vote-grid ${n > 6 ? "many" : ""}">${S.members.map((_, i) => i).filter((i) => i !== v).map((i) => `<button class="pen-tile" style="--mc:${colorOf(i)}" data-act="wfPick" data-i="${i}"><span class="bar"></span><span class="nm">${mName(i)}</span></button>`).join("")}${wfPeaceOk(wf, n) ? `<button class="pen-tile none" style="--mc:#8d857a" data-act="wfPick" data-i="-1"><span class="bar"></span><span class="nm">ウルフはおらん</span></button>` : ""}</div>
    </div>`; }
    case "done": return `<div class="odai mode-card center" id="card">
      <p class="ng-lead">全員投票した！</p>
      <p class="hand-note">スマホをみんなが見える所に置いて</p>
    </div>`;
    case "reveal": {
      const c = wf.counts, max = Math.max(...c, wf.none || 0);
      const rows = S.members.map((_, i) => ({ i, v: c[i] }));
      if (wfPeaceOk(wf, n) || wf.none) rows.push({ i: WF_NONE, v: wf.none || 0 });
      rows.sort((a, b) => b.v - a.v);
      const lose = wfLosers();
      const res = wf.allCit ? (lose.length ? "実は全員市民！疑った人の負け" : "実は全員市民！全員見抜いた")
        : wf.caught ? `ウルフを見つけた！でも${wolfNames()}に逆転チャンス`
        : wf.top.length > 1 ? "同票で決まらず。ウルフの逃げ切り！"
        : wf.top[0] === WF_NONE ? "「おらん」が一番。ウルフの逃げ切り！"
        : `${mName(wf.top[0])}は市民。ウルフの逃げ切り！`;
      return `<div class="odai mode-card" id="card">
        <div class="head"><span class="who"><b>第${wf.round}回戦</b></span><span class="meta"><i class="tag">結果</i></span></div>
        ${vbars(rows, max, (i) => isWolf(i), false)}
        ${words(!wf.caught)}
        <p class="vote-rule ${wf.caught || (wf.allCit && !lose.length) ? "good" : "bad"}">${res}</p>
      </div>`;
    }
    case "guess": return `<div class="odai mode-card center" id="card">
      <p class="prog">逆転チャンス</p>
      <div class="wf-wolf">${wolfRow("")}<span><i style="--mc:${colorOf(wf.wolves[0])}"></i>ウルフ：${wolfNames()}</span></div>
      <p class="ng-lead">市民のお題を<br>当てろ！</p>
      <p class="hand-note">${wf.wolves.length > 1 ? `${wolfNames()}で相談して、1回だけ答える。` : `${wolfNames()}が声に出して答える。`}<br>合ってるかは市民のみんなが判定</p>
    </div>`;
    case "result": {
      const lose = wfLosers();
      if (wf.allCit) {
        const ok = !lose.length;
        return `<div class="odai mode-card center wf-res ${ok ? "cit" : "wolf"}" id="card">
          <p class="prog">第${wf.round}回戦</p>
          <div class="wf-wolf ghost">${WOLF("ghost")}<em class="wf-stamp">不在！</em><span>ウルフはおらんかった</span></div>
          <p class="wf-win">${ok ? "全員見抜いた！" : "全員市民やった！"}</p>
          <p class="hand-note">${ok ? "全員が「ウルフはおらん」に入れた。全員セーフ" : "誰かを疑った人の負け"}</p>
          ${words(true)}
          <p class="vote-rule ${ok ? "good" : "bad"}">${ok ? "今回は罰なし" : `${lose.map(mName).join("・")}に罰`}</p>
        </div>`;
      }
      const wolfLose = wf.caught && !wf.guessed;
      const how = wolfLose ? "ウルフをつかまえた" : wf.caught ? "ウルフが市民のお題を当てた" : wf.top.length > 1 ? "同票でウルフを決められへんかった" : wf.top[0] === WF_NONE ? "「ウルフはおらん」にだまされた" : "ウルフを見抜けへんかった";
      return `<div class="odai mode-card center wf-res ${wolfLose ? "cit" : "wolf"}" id="card">
        <p class="prog">第${wf.round}回戦</p>
        <div class="wf-wolf ${wolfLose ? "caught" : "win"}">${wolfRow(wolfLose ? "caught" : "win")}<em class="wf-stamp">${wolfLose ? "御用！" : wf.caught ? "逆転！" : "逃げ切り！"}</em><span>ウルフは${wolfNames()}</span></div>
        <p class="wf-win">${wolfLose ? "市民の勝ち！" : wf.caught ? "ウルフの逆転勝ち！" : "ウルフの勝ち！"}</p>
        <p class="hand-note">${how}</p>
        ${words(true)}
        <p class="vote-rule bad">${wolfLose ? `ウルフの${wolfNames()}に罰` : `市民の${lose.length}人全員に罰`}</p>
      </div>`;
    }
    case "group": { const r = wf.res; if (S.anim) S.gIntro = true; return `<div class="odai ${r.lucky ? "lucky" : "batsu"} mode-card center ${S.anim ? "drum" : ""}" id="card">
      ${S.anim ? gachaMachine(r.lucky) : ""}
      <p class="prog">市民全員の罰</p>
      <div class="skull-wrap sm">${r.lucky ? `${ANGEL}<b>天使！全員セーフ</b>` : `${SKULL}<b>罰ゲーム</b>`}</div>
      <p class="rule-pen">${r.html}</p>
      <p class="hand-note">${wfLosers().map(mName).join("・")}</p>
    </div>`; }
    case "batsu": return vCard();
  }
  return "";
}
function vWfControls() {
  const g = S.game, wf = g.wf, n = S.members.length;
  const nextIdx = wf.order[wf.dealt + 1];
  switch (wf.phase) {
    case "hand": return `<button class="big" data-act="wfSee">${mName(wf.viewer)}が見る</button>${wf.dealing ? "" : `<button class="ghost" data-act="wfBack">やっぱやめる</button>`}`;
    case "look": return `<button class="big" data-act="wfNext">${!wf.dealing ? "覚えた、隠す" : wf.dealt + 1 < n ? `覚えた → ${mName(nextIdx)}に渡す` : "覚えた → 話し合いスタート"}</button>`;
    case "talk": return `<button class="big" data-act="wfVote">${wf.timeUp ? "投票へ" : "話し終わった → 投票へ"}</button><div class="sub-acts"><button data-act="wfPeek">お題を見直す</button></div>`;
    case "who": return `${vChipsSimple("誰がお題を見直す？", "wfWho", S.members.map((_, i) => i))}<button class="ghost" data-act="wfBack">やめる</button>`;
    case "vhand": return `<button class="big" data-act="wfVHand">${mName(wf.order[wf.k])}です。投票する</button>`;
    case "vote": return `<p class="hint">押したらすぐ次の人へ。誰に入れたかは出えへん</p>`;
    case "done": return `<button class="big" data-act="wfReveal">結果発表</button>`;
    case "reveal": return wf.caught ? `<button class="big" data-act="wfGuess">逆転チャンスへ</button>` : `<button class="big ${wfLosers().length ? "has-pen" : ""}" data-act="wfResult">${wf.allCit ? "結果を見る" : "罰を決める"}</button>`;
    case "guess": return `<div class="verdict"><button class="vd ng" data-act="wfMiss"><b>外れ</b><small>ウルフに罰</small></button><button class="vd ok" data-act="wfHit"><b>当たり！</b><small>市民に罰</small></button></div>`;
    case "result": return wfLosers().length ? `<button class="big has-pen" data-act="wfGacha">罰ガチャ</button>` : `<button class="big" data-act="wfDone">次の回戦</button>`;
    case "group": return `<button class="big" data-act="wfDone">${wf.res.lucky ? "ラッキー！" : "受け入れた"} → 次の回戦</button>`;
    case "batsu": return `<button class="big" data-act="wfDone">${g.gacha.every((x) => x.lucky) ? "ラッキー！" : "受け入れた"} → 次の回戦</button>`;
  }
  return "";
}
function vWolf() {
  const wf = S.game.wf;
  if (wf.phase === "intro") {
    const n = S.members.length, mx = wfMax(n);
    // 設定は1行ずつ：左に見出し、右に小さいボタン
    const sel = (h, act, opts) => `<div class="wf-set"><span>${h}</span><div class="seg">${opts.map(([v, l, on, dis]) => `<button data-act="${act}" data-v="${v}" aria-pressed="${on}" ${dis ? "disabled" : ""}>${l}</button>`).join("")}</div></div>`;
    return vIntroStage("wolf", { extra: `${lvBox("", true)}<div class="wf-sets">
      ${sel("話し合い", "wfMin", WF_MIN.map((m) => [m, `${m}分`, wf.minutes === m]))}
      ${sel("ウルフ", "wfN", [[0, `おまかせ(${Math.min(wfAuto(n), mx)})`, !wf.count], ...[1, 2, 3].filter((k) => k <= mx).map((k) => [k, `${k}人`, wf.count === k])])}
      ${n >= 4 ? sel("全員市民の回", "wfPeace", [[1, "たまに", wf.peace], [0, "なし", !wf.peace]]) : ""}</div>`, btn: "お題を配る", act: "wfBegin" });
  }
  return `<div id="stage" class="${S.flip ? "flipped" : ""}">
    ${vBar()}
    <div class="deck">${vWfCard()}</div>
    ${vWfControls()}
  </div>`;
}

// ---------- ピッタリ予想（画面） ----------
const ptQ = (pt) => (pt.who >= 0 ? fill(pt.q, pt.who) : esc(pt.q));
const ptNum = (v) => Number(v).toLocaleString("ja-JP");
function vPtPad(act) {
  const pt = S.game.pt;
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clr", "0", "del"];
  return `<div class="pt-pad">${keys.map((k) => `<button data-act="ptKey" data-v="${k}" ${k === "clr" || k === "del" ? `class="fn" aria-label="${k === "del" ? "1文字消す" : "全部消す"}"` : ""}>${k === "del" ? "⌫" : k === "clr" ? "C" : k}</button>`).join("")}</div>
    <button class="big" data-act="${act}" ${pt.input === "" ? "disabled" : ""}>${act === "ptAnsOk" ? "答え合わせ" : "決定"}</button>`;
}
function vPtCard() {
  const g = S.game, pt = g.pt, n = S.members.length;
  const head = `<div class="head"><span class="who"><b>第${pt.round}問</b></span><span class="meta"><i class="tag">予想</i></span></div>`;
  const disp = (lab) => `<p class="pt-disp"><small>${lab}</small><b>${pt.input === "" ? "<i>?</i>" : ptNum(pt.input)}</b><span>${esc(pt.u)}</span></p>`;
  switch (pt.phase) {
    case "q": return `<div class="odai mode-card ${S.anim ? "in" : ""}" id="card">
      ${head}
      <p class="txt" style="font-size:${fitSize(pt.q, false)}"><span>${ptQ(pt)}</span></p>
      <p class="how-note">${pt.who >= 0 ? `${mName(pt.who)}は答える人なので予想せえへん。ほかの人が1人ずつこっそり予想` : "全員1人ずつ、こっそり数字を予想"}（単位：${esc(pt.u)}）</p>
    </div>`;
    case "hand": { const v = pt.order[pt.k]; return `<div class="odai mode-card center" id="card">
      <p class="prog">予想 ${pt.k + 1} / ${pt.order.length}</p>
      ${bigWho(v, "の番")}
      <p class="hand-note">スマホを${mName(v)}に渡して。<br>他の人は画面を見たらアカン</p>
    </div>`; }
    case "input": { const v = pt.order[pt.k]; return `<div class="odai mode-card pt-card" id="card">
      <div class="head"><span class="who" style="--mc:${colorOf(v)}"><i></i><b>${mName(v)}</b><small>の予想</small></span></div>
      <p class="vote-q">${ptQ(pt)}</p>
      ${disp("予想")}
    </div>`; }
    case "done": return `<div class="odai mode-card center" id="card">
      <p class="ng-lead">全員予想した！</p>
      <p class="hand-note">${pt.who >= 0 ? `${mName(pt.who)}、本当の数字を調べて入れて` : "スマホや財布を見て、本当の数字を調べよう"}</p>
    </div>`;
    case "answer": return `<div class="odai mode-card pt-card" id="card">
      <div class="head"><span class="who"><b>答え</b></span></div>
      <p class="vote-q">${ptQ(pt)}</p>
      ${disp("本当の数字")}
    </div>`;
    case "reveal": {
      const rows = pt.order.map((i) => ({ i, v: pt.guess[i], d: Math.abs(pt.guess[i] - pt.answer) })).sort((a, b) => b.d - a.d); // 罰の人（一番遠い）が上に来るように
      return `<div class="odai mode-card" id="card">
        ${head}
        <p class="vote-q">${ptQ(pt)}</p>
        <p class="pt-ans"><small>答え</small><b>${ptNum(pt.answer)}</b><span>${esc(pt.u)}</span></p>
        <ul class="pt-list">${rows.map((r, k) => `<li class="${pt.losers.includes(r.i) ? "lose" : r.d === 0 ? "hit" : ""}" style="--mc:${colorOf(r.i)};--d:${(0.15 + k * 0.1).toFixed(2)}s"><span class="nm"><i></i>${mName(r.i)}</span>${pt.losers.includes(r.i) ? `<span class="stamp">罰</span>` : "<span></span>"}<b>${ptNum(r.v)}</b><em>${r.d === 0 ? "ピッタリ！" : `差 ${ptNum(r.d)}`}</em></li>`).join("")}</ul>
        <p class="vote-rule ${pt.losers.length ? "bad" : "good"}">${pt.losers.length ? `一番遠い${pt.losers.map(mName).join("・")}に罰${pt.exact.length ? "（ピッタリが出たので2倍）" : ""}` : "全員同じ差なので、今回は罰なし"}</p>
      </div>`;
    }
    case "batsu": return vCard();
  }
  return "";
}
function vPtControls() {
  const g = S.game, pt = g.pt;
  switch (pt.phase) {
    case "q": return `<button class="big" data-act="ptStart">予想スタート</button><button class="ghost" data-act="ptSkip">このお題はパス</button>`;
    case "hand": return `<button class="big" data-act="ptHand">${mName(pt.order[pt.k])}です。予想する</button>`;
    case "input": return vPtPad("ptOk");
    case "done": return `<button class="big" data-act="ptAns">答えを入れる</button>`;
    case "answer": return vPtPad("ptAnsOk");
    case "reveal": return pt.losers.length ? `<button class="big has-pen" data-act="ptGacha">${pt.losers.map(mName).join("・")}に罰ガチャ</button>` : `<button class="big" data-act="ptNext">次のお題</button>`;
    case "batsu": return `<button class="big" data-act="ptNext">${g.gacha.every((x) => x.lucky) ? "ラッキー！" : "受け入れた"} → 次のお題</button>`;
  }
  return "";
}
function vPittari() {
  if (S.game.pt.phase === "intro") return vIntroStage("pittari", { extra: lvBox(), btn: "1問目へ", act: "ptBegin" });
  return `<div id="stage" class="${S.flip ? "flipped" : ""}">
    ${vBar()}
    <div class="deck">${vPtCard()}</div>
    ${vPtControls()}
  </div>`;
}

// ---------- 神経衰弱（画面） ----------
function vMmCell(c, k) {
  const g = S.game;
  if (c.gone) return `<div class="mm-card gone" ${c.owner != null && c.owner >= 0 ? `style="--mc:${colorOf(c.owner)}"` : ""}>${c.owner != null && c.owner >= 0 ? `<i></i>` : ""}</div>`;
  if (c.up) return `<div class="mm-card up ${c.skull ? "is-skull" : ""} ${c.yoru ? "yoru" : ""}">${c.skull ? SKULL : `<b>${esc(c.ch)}</b>`}</div>`;
  return `<button class="mm-card down" data-act="mmFlip" data-i="${k}" ${g.mm.phase !== "pick" ? "disabled" : ""} aria-label="カードをめくる"><span>?</span></button>`;
}
function vMmInfo() {
  const g = S.game, mm = g.mm;
  const hint = mm.phase === "pick" ? (mm.open.length ? "もう1枚めくれ" : "2枚めくれ") : mm.phase === "miss" ? "ハズレ…場所を覚えとけ" : "";
  return `<div class="mm-info">
    <span class="who" style="--mc:${colorOf(g.doer)}"><i></i><b>${esc(S.members[g.doer].name)}</b><small>の番</small></span>
    <span class="mm-hint">${hint}</span>
  </div>
  <div class="mm-scores">${S.members.map((m, i) => `<span class="${i === g.doer ? "on" : ""}" style="--mc:${colorOf(i)}"><i></i>${esc(m.name)}<b>${mm.score[i]}</b></span>`).join("")}</div>`;
}
function vMemory() {
  const g = S.game, mm = g.mm;
  if (mm.phase === "intro") return vIntroStage("memory", { tag: `${MM_PAIRS}ペア`, extra: lvBox(), btn: `${mName(0)}からスタート`, act: "mmStart" });
  const ended = mm.phase === "over" || mm.phase === "end" || mm.phase === "low";
  const sheet = mm.phase === "match" || mm.phase === "fail" || mm.phase === "skull" || mm.phase === "low";
  let controls = "";
  if (mm.phase === "miss") controls = `<button class="big" data-act="mmNext">覚えた → ${esc(S.members[(g.cur + 1) % S.members.length].name)}の番</button>`;
  else if (mm.phase === "over") { const low = mmLowest(); controls = `<button class="big has-pen" data-act="mmLow">${low.map((i) => esc(S.members[i].name)).join("・")}に罰ガチャ</button>`; }
  else if (mm.phase === "end") controls = `<button class="big" data-act="end">結果発表</button>`;
  else controls = `<p class="hint mm-foot">${mm.done} / ${mm.pairs} ペア揃った</p>`;
  const body = ended ? vMmOver() : `<div class="mm-grid">${mm.cards.map(vMmCell).join("")}</div>`;
  return `<div id="stage" class="mm ${S.flip ? "flipped" : ""}">
    ${vBar()}
    ${vRule()}
    ${vMmInfo()}
    ${body}
    ${controls}
  </div>
  ${sheet ? `<div class="sg-sheet-back"></div><div class="sg-sheet ${S.flip ? "flipped" : ""}">${vMmSheet()}</div>` : ""}`;
}
function vMmOver() {
  const g = S.game, mm = g.mm, low = mmLowest();
  const rows = S.members.map((m, i) => ({ m, i, v: mm.score[i] })).sort((a, b) => b.v - a.v);
  return `<div class="deck"><div class="odai mode-card" id="card">
    <div class="head"><span class="who"><b>全部揃った！</b></span><span class="meta"><i class="tag">点数</i></span></div>
    <ul class="vbars">${rows.map((r, k) => `<li class="${low.includes(r.i) ? "top" : ""}" style="--mc:${colorOf(r.i)};--d:${(0.15 + (rows.length - k) * 0.12).toFixed(2)}s"><span class="nm">${esc(r.m.name)}</span><span class="bar"><i style="--w:${Math.max(...mm.score) ? (r.v / Math.max(...mm.score)) * 100 : 0}%"></i></span><b>${r.v}</b>${low.includes(r.i) ? `<span class="stamp">罰</span>` : ""}</li>`).join("")}</ul>
    <p class="vote-rule bad">点数が一番低い人が罰</p>
  </div></div>`;
}
function vMmSheet() {
  const g = S.game, mm = g.mm;
  if (mm.phase === "match") {
    const c = mm.card;
    return `<div class="deck"><div class="odai ${c.kind.includes("深夜") ? "deep" : c.yoru ? "yoru" : ""} ${S.anim ? "in" : ""}" id="card">
      <div class="head">${vWho()}<span class="meta"><i class="tag">揃った！</i></span></div>
      <p class="txt" style="font-size:${fitSize(c.html, true)}"><span>${c.html}</span></p>
    </div></div>
    <div class="verdict">
      <button class="vd ng" data-act="mmNo"><b>答えられへん</b><small>罰ガチャ</small></button>
      <button class="vd ok" data-act="mmYes"><b>答えた！</b><small>+1点でもう1回</small></button>
    </div>`;
  }
  const lucky = g.gacha.every((x) => x.lucky);
  const label = mm.phase === "low" ? "結果発表へ" : mm.phase === "skull" && lucky ? "続けてめくる" : mm.done >= mm.pairs ? "点数発表へ" : `${esc(S.members[(g.cur + 1) % S.members.length].name)}の番へ`;
  return `<div class="deck">${mm.phase === "skull" ? vCard().replace('<span>罰ガチャ</span>', '<span>ドクロをめくった！</span>') : vCard()}</div>
    <button class="big" data-act="mmAccept">${lucky ? "ラッキー！" : "受け入れた"} → ${label}</button>`;
}

// ---------- 価値観ナンバー（画面） ----------
function itScale(t) {
  return `<div class="it-scale"><span><b>1</b>${esc(t.lo)}</span><i></i><span><b>100</b>${esc(t.hi)}</span></div>`;
}
function vItCard() {
  const g = S.game, it = g.it, n = S.members.length;
  const nc = it.night === "shinya" ? "deep" : it.night ? "yoru" : "";
  switch (it.phase) {
    case "hand": return `<div class="odai mode-card center" id="card">
      <p class="prog">${it.dealing ? `数字配り ${it.seen + 1} / ${n}` : "数字の見直し"}</p>
      ${bigWho(it.viewer, "だけ見て")}
      <p class="hand-note">スマホを${mName(it.viewer)}に渡して。<br>他の人は画面を見たらアカン</p>
    </div>`;
    case "look": return `<div class="odai ${nc} mode-card center" id="card">
      <p class="prog">${mName(it.viewer)}の数字</p>
      ${peekBox(`<p class="it-num">${it.nums[it.viewer]}</p>`)}
      <p class="it-topic">お題：${esc(it.topic.t)}</p>
      ${itScale(it.topic)}
    </div>`;
    case "talk": case "who": return `<div class="odai ${nc} mode-card mid" id="card">
      <div class="head"><span class="who"><b>第${it.round}問</b></span><span class="meta">${it.night ? `<span class="kind">${it.night === "shinya" ? "深夜" : "夜"}のお題</span>` : ""}<i class="tag">お題</i></span></div>
      <div class="mid-body">
        <p class="it-big">${esc(it.topic.t)}</p>
        ${itScale(it.topic)}
        <p class="how-note">1人ずつ、自分の数字っぽい「${esc(it.topic.t)}」を言え。数字は言うたらアカン</p>
      </div>
    </div>`;
    case "order": {
      const left = S.members.map((_, i) => i).filter((i) => !it.order.includes(i));
      return `<div class="odai ${nc} mode-card" id="card">
        <div class="head"><span class="who"><b>小さい順に並べる</b></span><span class="meta"><i class="tag">${esc(it.topic.t)}</i></span></div>
        <ol class="it-line">${it.order.map((i, k) => `<li style="--mc:${colorOf(i)}"><em>${k + 1}</em><span>${mName(i)}</span></li>`).join("")}${left.length ? `<li class="empty"><em>${it.order.length + 1}</em><span>${it.order.length ? "次に小さい人をタップ" : "一番小さい人をタップ"}</span></li>` : ""}</ol>
        <div class="pen-grid vote-grid">${left.map((i) => `<button class="pen-tile" style="--mc:${colorOf(i)}" data-act="itPut" data-i="${i}"><span class="bar"></span><span class="nm">${mName(i)}</span></button>`).join("")}</div>
      </div>`;
    }
    case "reveal": {
      const ok = !it.bad.length;
      return `<div class="odai ${nc} mode-card" id="card">
        <div class="head"><span class="who"><b>答え合わせ</b></span><span class="meta"><i class="tag">${esc(it.topic.t)}</i></span></div>
        <ol class="it-line reveal">${it.order.map((i, k) => `<li class="${it.bad.includes(i) ? "bad" : ""}" style="--mc:${colorOf(i)};--d:${(0.2 + k * 0.35).toFixed(2)}s"><em>${k + 1}</em><span>${mName(i)}</span><b>${it.nums[i]}</b></li>`).join("")}</ol>
        <p class="vote-rule ${ok ? "good" : "bad"}" style="--d:${(0.3 + it.order.length * 0.35).toFixed(2)}s">${ok ? "完璧！全員セーフ" : `順番が逆：${it.bad.map(mName).join("・")}に罰`}</p>
      </div>`;
    }
    case "batsu": return vCard();
  }
  return "";
}
function vItControls() {
  const g = S.game, it = g.it, n = S.members.length;
  switch (it.phase) {
    case "hand": return `<button class="big" data-act="itSee">${mName(it.viewer)}が見る</button>${it.dealing ? "" : `<button class="ghost" data-act="itBack">やっぱやめる</button>`}`;
    case "look": return `<button class="big" data-act="itNext">${!it.dealing ? "覚えた、隠す" : it.seen + 1 < n ? `覚えた → ${mName((it.viewer + 1) % n)}に渡す` : "覚えた → スタート"}</button>`;
    case "talk": return `<div class="sub-acts two"><button data-act="itPeek">数字を見直す</button><button data-act="itSkip">お題を変える</button></div><button class="big" data-act="itOrder">言い終わった → 並べる</button>`;
    case "who": return `${vChipsSimple("誰が数字を見直す？", "itWho", S.members.map((_, i) => i))}<button class="ghost" data-act="itBack">やめる</button>`;
    case "order": return it.order.length === n ? `<div class="sub-acts two"><button data-act="itUndo">1つ戻す</button><button data-act="itClear">やり直す</button></div><button class="big" data-act="itCheck">この順で答え合わせ</button>` : `<div class="sub-acts two"><button data-act="itUndo" ${it.order.length ? "" : "disabled"}>1つ戻す</button><button data-act="itTalk">お題に戻る</button></div>`;
    case "reveal": return it.bad.length ? `<button class="big has-pen" data-act="itGacha">${it.bad.map(mName).join("・")}に罰ガチャ</button>` : `<button class="big" data-act="itNew">次のお題へ</button>`;
    case "batsu": return `<button class="big" data-act="itAccept">${g.gacha.every((x) => x.lucky) ? "ラッキー！" : "受け入れた"} → 次のお題へ</button>`;
  }
  return "";
}
function vIto() {
  if (S.game.it.phase === "intro") return vIntroStage("ito", { tag: "協力", extra: lvBox(), btn: "数字を配る", act: "itStart" });
  return `<div id="stage" class="${S.flip ? "flipped" : ""}">
    ${vBar()}
    <div class="deck">${vItCard()}</div>
    ${vItControls()}
  </div>`;
}

// ---------- 説明（全モード共通の中身） ----------
// ホームのひとこと（desc）、始める前の説明（how）、ルール早見表（rules）を1か所にまとめる
const HELP = DATA.help;
// 始める前の説明画面（どのモードも同じ形）。extra に地獄度の説明や時間の選択などを入れる
function vIntroStage(mode, { tag = "", extra = "", btn, act, disabled = false }) {
  const h = HELP[mode];
  return `<div id="stage" class="${S.flip ? "flipped" : ""}">
    ${vBar()}
    <div class="deck"><div class="odai mode-card mid" id="card">
      <div class="head"><span class="who"><b>${MODE_NAME[mode]}</b></span><span class="meta"><i class="tag">${tag || `${S.members.length}人`}</i></span></div>
      <div class="mid-body">
        <ul class="how ic">${h.how.map(([ic, t]) => `<li><span class="ic">${ICON[ic] || ""}</span><span>${t}</span></li>`).join("")}</ul>
        ${extra}
      </div>
    </div></div>
    <button class="big" data-act="${act}" ${disabled ? "disabled" : ""}>${btn}</button>
  </div>`;
}
const nightNote = (noNg) => (S.night ? `<small>${S.night === "shinya" ? "深夜" : "夜"}モードのお題も出る${noNg && S.members.some((m) => m.ng) ? "（下ネタNGの人がおるので今回は混ぜへん）" : ""}</small>` : "");
const lvBox = (text = "", noNg = true) => `<p class="ng-lv">地獄度は「${LV[S.level]}」${text ? `：${text}` : ""}${nightNote(noNg)}</p>`;

// ---------- 最初の人ルーレット（画面） ----------
function vRoulette(title, picked, label) {
  return `<div class="odai mode-card center" id="card">
    <p class="prog">${title}</p>
    <div class="roul" style="grid-template-columns:repeat(${S.members.length <= 4 ? 2 : S.members.length <= 6 || S.members.length === 9 ? 3 : 4}, minmax(0,1fr))">${S.members.map((m, i) => `<span class="roul-chip ${picked === i ? "on hit" : ""}" style="--mc:${colorOf(i)}"><i>${ini(i)}</i><b>${esc(m.name)}</b></span>`).join("")}</div>
    <p class="ng-lead roul-res">${picked != null ? `${mName(picked)}${label}` : "ルーレット中…"}</p>
  </div>`;
}

// ---------- 早押しジェスチャー（画面） ----------
const GS_SEC = [30, 60, 90];
function vGsCard() {
  const g = S.game, gs = g.gs, n = S.members.length;
  switch (gs.phase) {
    case "roul": return vRoulette("最初に演じる人は…", gs.picked, "から演じる！");
    case "hand": return `<div class="odai mode-card center" id="card">
      <p class="prog">演じる人 ${gs.acted + 1} / ${n}</p>
      ${bigWho(gs.actor, "が演じる番")}
      <p class="hand-note">スマホを${mName(gs.actor)}に渡して。<br>お題は${mName(gs.actor)}だけが見る</p>
    </div>`;
    case "act": return `<div class="odai ${gs.word.night === "shinya" ? "deep" : gs.word.night ? "yoru" : ""} mode-card center" id="card">
      <p class="gs-timer" id="modeTimer">${Math.max(0, Math.ceil((gs.endAt - Date.now()) / 1000))}</p>
      <p class="prog">${mName(gs.actor)}だけ見て、体で伝えろ</p>
      <p class="gs-word">${esc(gs.word.text)}</p>
      <p class="hand-note">正解 ${gs.got}問${gs.last != null && gs.got ? `（さっきは${mName(gs.last)}）` : ""}</p>
    </div>`;
    case "timeup": return `<div class="odai mode-card center" id="card">
      <p class="gs-timer">0</p>
      <p class="ng-lead">タイムアップ！</p>
      <p class="hand-note">${mName(gs.actor)}は${gs.got}問正解${gs.got ? `（+${gs.got}点）` : ""}</p>
    </div>`;
    case "over": case "low": case "end": {
      const low = gsLowest(), max = Math.max(...gs.score);
      const rows = S.members.map((m, i) => ({ i, v: gs.score[i] })).sort((a, b) => b.v - a.v);
      return `<div class="odai mode-card" id="card">
        <div class="head"><span class="who"><b>全員演じた！</b></span><span class="meta"><i class="tag">点数</i></span></div>
        <ul class="vbars">${rows.map((r, k) => `<li class="${low.includes(r.i) ? "top" : ""}" style="--mc:${colorOf(r.i)};--d:${(0.15 + (rows.length - k) * 0.12).toFixed(2)}s"><span class="nm">${mName(r.i)}</span><span class="bar"><i style="--w:${max ? (r.v / max) * 100 : 0}%"></i></span><b>${r.v}</b>${low.includes(r.i) ? `<span class="stamp">罰</span>` : ""}</li>`).join("")}</ul>
        <p class="vote-rule bad">点数が一番低い人が罰</p>
      </div>`;
    }
  }
  return "";
}
function vGsControls() {
  const g = S.game, gs = g.gs;
  switch (gs.phase) {
    case "roul": return gs.picked != null ? `<button class="big" data-act="gsBegin">${mName(gs.picked)}から始める</button>` : `<button class="big" disabled>ルーレット中…</button>`;
    case "hand": return `<button class="big" data-act="gsGo">スタート（${gs.sec}秒）</button>`;
    case "act": return `<div class="pen-grid-wrap"><p class="pen-q">当てたのは？<span>タップで1点</span></p>
      <div class="pen-grid ${S.members.length > 7 ? "many" : ""}">${others(gs.actor).map((i) => `<button class="pen-tile" style="--mc:${colorOf(i)}" data-act="gsHit" data-i="${i}"><span class="bar"></span><span class="nm">${mName(i)}</span><span class="meta"><em>${gs.score[i]}点</em></span></button>`).join("")}</div></div>
      <button class="ghost" data-act="gsPass">パス（次のお題）</button>`;
    case "timeup": return `<button class="big" data-act="gsNext">${gs.acted + 1 >= S.members.length ? "点数発表へ" : `次は${mName((gs.actor + 1) % S.members.length)}が演じる`}</button>`;
    case "over": { const low = gsLowest(); return `<button class="big has-pen" data-act="gsLow">${low.map(mName).join("・")}に罰ガチャ</button>`; }
    case "end": return `<button class="big" data-act="end">結果発表</button>`;
  }
  return "";
}
function vGesture() {
  const g = S.game, gs = g.gs;
  if (gs.phase === "intro") return vIntroStage("gesture", { extra: `${lvBox({ yurume: "簡単なお題", futsu: "ふつうのお題", jigoku: "むずいお題" }[S.level])}<div class="ng-min-wrap"><p class="ng-min-h">1人の持ち時間</p><div class="ng-min three">${GS_SEC.map((v) => `<button data-act="gsSec" data-v="${v}" aria-pressed="${gs.sec === v}">${v}秒</button>`).join("")}</div></div>`, btn: "ルーレットで最初の人を決める", act: "gsRoul" });
  if (gs.phase === "low") return `<div id="stage" class="${S.flip ? "flipped" : ""}">${vBar()}<div class="deck">${vCard()}</div><button class="big" data-act="gsAccept">${g.gacha.every((x) => x.lucky) ? "ラッキー！" : "受け入れた"} → 結果発表へ</button></div>`;
  return `<div id="stage" class="${S.flip ? "flipped" : ""}">
    ${vBar()}
    <div class="deck">${vGsCard()}</div>
    ${vGsControls()}
  </div>`;
}

// ---------- 褒め殺し（画面） ----------
function vHmCard() {
  const g = S.game, hm = g.hm;
  const nc = hm.night === "shinya" ? "deep" : hm.night ? "yoru" : "";
  switch (hm.phase) {
    case "roul": return vRoulette("最初に褒める人は…", hm.picked, "から褒める！");
    case "ready": case "go": return `<div class="odai ${nc} mode-card center" id="card">
      ${hm.phase === "go" ? `<p class="gs-timer" id="modeTimer">${Math.max(0, Math.ceil((hm.endAt - Date.now()) / 1000))}</p>` : `<p class="prog">第${g.turn + 1}戦</p>`}
      <div class="hm-vs">
        <span style="--mc:${colorOf(hm.praiser)}"><i>${ini(hm.praiser)}</i><b>${mName(hm.praiser)}</b><small>褒める</small></span>
        <em>→</em>
        <span style="--mc:${colorOf(hm.target)}"><i>${ini(hm.target)}</i><b>${mName(hm.target)}</b><small>耐える</small></span>
      </div>
      <p class="ng-topic"><small>褒めるところ</small>${esc(hm.theme)}</p>
      <p class="hand-note">${hm.phase === "go" ? `${mName(hm.target)}、笑ったら負けやで` : `${mName(hm.target)}は真顔で耐えろ`}</p>
    </div>`;
    case "batsu": return vCard();
  }
  return "";
}
function vHmControls() {
  const g = S.game, hm = g.hm;
  switch (hm.phase) {
    case "roul": return hm.picked != null ? `<button class="big" data-act="hmBegin">${mName(hm.picked)}から始める</button>` : `<button class="big" disabled>ルーレット中…</button>`;
    case "ready": return `<div class="sub-acts two"><button data-act="hmShuffle">相手を変える</button><button data-act="hmTheme">テーマを変える</button></div><button class="big" data-act="hmGo">スタート（${hm.sec}秒）</button>`;
    case "go": return `<div class="verdict">
      <button class="vd ng" data-act="hmLaugh"><b>笑った・照れた</b><small>${mName(hm.target)}に罰</small></button>
      <button class="vd ok" data-act="hmGiveUp"><b>褒めるの限界</b><small>${mName(hm.praiser)}に罰</small></button>
    </div><p class="hint">${hm.sec}秒耐えたら${mName(hm.praiser)}に罰</p>`;
    case "batsu": return `<button class="big" data-act="hmAccept">${g.gacha.every((x) => x.lucky) ? "ラッキー！" : "受け入れた"} → 次は${mName((hm.praiser + 1) % S.members.length)}が褒める</button>`;
  }
  return "";
}
function vHomeru() {
  const g = S.game, hm = g.hm;
  if (hm.phase === "intro") return vIntroStage("homeru", { tag: `${hm.sec}秒`, btn: "ルーレットで最初の人を決める", act: "hmRoul" });
  const top = hm.phase === "batsu" ? `<p class="hm-result">${hm.loser === hm.target ? `${mName(hm.target)}が笑ってもうた！` : `${mName(hm.target)}が耐え切った！`}</p>` : "";
  return `<div id="stage" class="${S.flip ? "flipped" : ""}">
    ${vBar()}
    ${vRule()}
    ${top}
    <div class="deck">${vHmCard()}</div>
    ${vHmControls()}
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
    ${S.members.map((m, i) => `<div class="sg-tok ${i === g.cur ? "is-cur" : ""}" id="tok${i}" style="${tokenStyle(i)}">${ini(i)}</div>`).join("")}
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
  if (g.intro) return vIntroStage("sugoroku", { tag: `${GOAL}マス`, extra: lvBox("", false), btn: `${mName(0)}からスタート`, act: "introGo" });
  const busy = g.rolling || g.hopping;
  const sheet = g.rolled && !g.hopping;
  const label = g.rolling ? "コロコロ…" : g.hopping ? `${g.die}マス進む！` : g.skip[g.cur] ? "1回休み（タップで確認）" : "タップで振る";
  return `<div id="stage" class="sugo2 ${S.flip ? "flipped" : ""}">
    ${vBar()}
    ${vRule()}
    ${vBoard()}
    ${vRanks()}
    <div class="dice-dock">
      <button class="die3d ${g.rolling ? "roll" : ""}" id="die" data-act="roll" ${busy || g.rolled ? "disabled" : ""} aria-label="サイコロを振る">${dieFace(g.die)}</button>
      <div class="dice-txt"><span class="who" style="--mc:${colorOf(g.cur)}"><i></i><b>${esc(S.members[g.cur].name)}</b><small>の番</small></span><b>${label}</b></div>
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
  const slot = S.anim && top.n > 0 && S.members.length > 1;
  const rankOf = (n) => 1 + rows.filter((r) => r.n > n).length; // 同点は同じ順位
  const maxN = Math.max(1, top.n);
  // 表彰台：真ん中が1位、左が2位、右が3位
  const podN = Math.min(3, rows.length);
  const order = podN === 3 ? [1, 0, 2] : podN === 2 ? [1, 0] : [0];
  const pod = (k) => {
    const r = rows[k], rk = rankOf(r.n), first = k === 0;
    return `<div class="pod p${Math.min(rk, 3)} ${first ? "first" : ""}" style="--mc:${colorOf(r.i)};--d:${(0.15 + (podN - 1 - k) * 0.35).toFixed(2)}s">
      ${first ? `<div class="pod-skull">${CROWN}${SKULL}</div>` : ""}
      <div class="pod-av"><span class="real">${ini(r.i)}</span>${first && slot ? `<span class="q">？</span>` : ""}</div>
      <b class="pod-nm">${first && slot ? `<span class="q">？？？</span>` : ""}<span class="real">${esc(r.m.name)}</span></b>
      <div class="pod-block"><em>${rk}</em><span>罰${r.n}</span></div>
    </div>`;
  };
  const hero = top.n === 0
    ? `<div class="res-safe">${ANGEL}<b>全員セーフ</b><span>平和すぎる。もう一回いっとく？</span></div>`
    : `<div class="podium n${podN}">${order.map(pod).join("")}</div>
       <div class="mvp" ${slot ? "data-slot" : ""}><small>MVP（悪い意味で）</small><b data-final="${esc(who)}">${slot ? "？？？" : esc(who)}</b><span>罰 ${top.n}回${tie.length === 1 && whyText(top.i) ? `（${esc(whyText(top.i))}）` : ""}</span></div>`;
  const MEDAL = (k) => `<i class="medal" style="--m:${["#ffd23f", "#ff5aa5", "#3ec7ff", "#7be36b", "#ff8a1a", "#b48cff"][k % 6]}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h4l1 5-3 2zM17 2h-4l-1 5 3 2z" fill="currentColor" opacity=".55"/><circle cx="12" cy="15" r="7" fill="var(--m)" stroke="#141210" stroke-width="1.6"/><path d="m12 11 1.2 2.5 2.7.3-2 1.9.6 2.7-2.5-1.4-2.5 1.4.6-2.7-2-1.9 2.7-.3z" fill="#fff"/></svg></i>`;
  return `<div class="result ${slot ? "wait" : ""}">
  <button class="icon-btn res-back" data-act="home" aria-label="遊び方の選択に戻る">${ICON.back}</button>
  <section class="res-hero">
    <div class="rays" aria-hidden="true"></div>
    <p class="res-sub">${esc(modeLine(g))}</p>
    <h1 class="res-head"><span>本日の戦犯</span></h1>
    ${hero}
  </section>
  ${(() => { const ts = titles(); return ts.length ? `<h2 class="res-h2">称号</h2><ul class="titles">${ts.map((t, k) => `<li style="--d:${(0.3 + k * 0.12).toFixed(2)}s">${MEDAL(k)}<div><small>${esc(t.title)}</small><b>${esc(titleNames(t))}</b><span>${esc(t.desc)}</span></div></li>`).join("")}</ul>` : ""; })()}
  ${g.mode === "gesture" && g.gs ? `<h2 class="res-h2">ジェスチャーの点数</h2><ul class="ng-list res">${S.members.map((m, j) => ({ m, j })).sort((a, b) => g.gs.score[b.j] - g.gs.score[a.j]).map(({ m, j }) => `<li style="--mc:${colorOf(j)}"><span class="nm"><i></i>${esc(m.name)}</span><b>${g.gs.score[j]}点</b></li>`).join("")}</ul>` : ""}
  ${g.mode === "memory" && g.mm ? `<h2 class="res-h2">神経衰弱の点数</h2><ul class="ng-list res">${S.members.map((m, j) => ({ m, j })).sort((a, b) => g.mm.score[b.j] - g.mm.score[a.j]).map(({ m, j }) => `<li style="--mc:${colorOf(j)}"><span class="nm"><i></i>${esc(m.name)}</span><b>${g.mm.score[j]}点</b></li>`).join("")}</ul>` : ""}
  ${g.mode === "ngword" && g.ng?.words.length ? `<h2 class="res-h2">みんなのNGワード</h2><ul class="ng-list res">${S.members.map((m, j) => `<li style="--mc:${colorOf(j)}"><span class="nm"><i></i>${esc(m.name)}</span><b>${esc(g.ng.words[j])}</b></li>`).join("")}</ul>` : ""}
  <h2 class="res-h2">罰ランキング</h2>
  <ol class="rank">${rows.map((r, k) => `<li style="--mc:${colorOf(r.i)};--w:${(r.n / maxN) * 100}%;--d:${(0.2 + k * 0.06).toFixed(2)}s"><span class="no ${rankOf(r.n) === 1 && r.n > 0 ? "top" : ""}">${rankOf(r.n)}</span><span class="r-av">${ini(r.i)}</span><span class="nm">${esc(r.m.name)}${whyText(r.i) ? `<small>${esc(whyText(r.i))}</small>` : ""}</span><span class="r-bar"><i></i></span><span class="ct">${r.n}</span></li>`).join("")}</ol>
  <p class="tip">${MOON}<span>${esc(resultTip())}</span></p>
  <button class="share-btn" data-act="share">${ICON.share}<span>画像で保存・シェア</span></button>
  ${S.shareMsg ? `<p class="note" role="status">${esc(S.shareMsg)}</p>` : ""}
  <div class="row2"><button class="ghost" data-act="home">${ICON.back}<span>遊び方を選ぶ</span></button><button class="big" data-act="again">もう一回</button></div>
  <button class="res-link" data-act="members">メンバーを変える</button>
  </div>`;
}

// 結果画面のひとこと。夜モードに入ってない人には噂として隠しモードをにおわせる
const TIPS = ["罰ガチャの天使はだいたい7回に1回", "リベンジ権は罰を食らった人だけのご褒美", "倍プッシュは勝てば誰かに罰、負けたら罰2倍", "設定の「向かい合わせ表示」で机の真ん中に置ける"];
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
  const fit = (text, font, size, maxW, min = 28) => { let fs = size; x.font = `${font.replace("@", fs)}`; while (x.measureText(text).width > maxW && fs > min) { fs -= 4; x.font = font.replace("@", fs); } return fs; };
  // 背景：黒地に赤い光、黄色の斜めストライプ、下に水玉
  x.fillStyle = "#141210"; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, 520, 40, W / 2, 520, 900);
  glow.addColorStop(0, "rgba(232,32,42,.42)"); glow.addColorStop(1, "rgba(232,32,42,0)");
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  x.save(); x.globalAlpha = 0.05; x.fillStyle = "#ffd23f";
  for (let k = -H; k < W + H; k += 120) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 60, 0); x.lineTo(k + 60 - H, H); x.lineTo(k - H, H); x.fill(); }
  x.restore();
  x.save(); x.fillStyle = "rgba(247,243,234,.05)";
  for (let yy = 1500; yy < H; yy += 34) for (let xx = (yy / 34) % 2 ? 17 : 0; xx < W; xx += 34) { x.beginPath(); x.arc(xx, yy, 5 * ((yy - 1500) / 420), 0, Math.PI * 2); x.fill(); }
  x.restore();
  // 上：ロゴ・日付・モード（ストーリーの上の帯に隠れても困らん情報）
  const d = new Date();
  x.fillStyle = "#ffd23f"; x.font = `72px ${disp}`; x.fillText("ノリダン", 90, 170);
  x.fillStyle = "#8d857a"; x.font = `900 34px ${body}`;
  const ds = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  x.fillText(ds, W - 90 - x.measureText(ds).width, 160);
  x.fillText(modeLine(g), 90, 230);
  // タイトル
  x.save(); x.translate(90, 410); x.rotate(-0.04);
  x.font = `150px ${disp}`; x.lineWidth = 14; x.strokeStyle = "#ffd23f"; x.lineJoin = "round"; x.strokeText("本日の戦犯", 0, 0);
  x.fillStyle = "#e8202a"; x.fillText("本日の戦犯", 0, 0);
  x.restore();
  const rows = S.members.map((m, i) => ({ m, i, n: g.pen[i] })).sort((a, b) => b.n - a.n);
  const top = rows[0], tie = rows.filter((r) => r.n === top.n);
  const who = top.n === 0 ? "該当者なし" : tie.map((r) => r.m.name).join("・");
  // MVPのステッカー（少し傾ける）
  x.save(); x.translate(W / 2, 700); x.rotate(-0.025);
  const cw = W - 180, ch = 380;
  x.fillStyle = "rgba(0,0,0,.5)"; roundRect(x, -cw / 2 + 10, -ch / 2 + 22, cw, ch, 44); x.fill();
  x.fillStyle = "#ffd23f"; roundRect(x, -cw / 2, -ch / 2, cw, ch, 44); x.fill();
  x.lineWidth = 6; x.strokeStyle = "#141210"; x.stroke();
  x.fillStyle = "#141210"; x.font = `900 38px ${body}`; x.fillText("MVP（悪い意味で）", -cw / 2 + 60, -ch / 2 + 84);
  fit(who, `@px ${disp}`, 130, cw - 330, 56); x.fillText(who, -cw / 2 + 60, 40);
  x.font = `900 46px ${body}`; x.fillText(top.n === 0 ? "全員セーフ。平和すぎる" : `罰 ${top.n}回`, -cw / 2 + 60, 120);
  const why = top.n > 0 && tie.length === 1 ? whyText(top.i) : "";
  if (why) { x.fillStyle = "rgba(20,18,16,.6)"; fit(why, `900 @px ${body}`, 30, cw - 120, 20); x.fillText(why, -cw / 2 + 60, 168); }
  // ドクロ（MVPの右上にはみ出す）
  x.save(); x.translate(cw / 2 - 150, -ch / 2 - 30); x.rotate(0.18); x.scale(2.3, 2.3);
  x.fillStyle = "#f7f3ea"; x.strokeStyle = "#141210"; x.lineWidth = 3;
  const skull = new Path2D("M50 6C25 6 10 23 10 45c0 14 8 23 17 27v11c0 4 3 7 7 7h32c4 0 7-3 7-7V72c9-4 17-13 17-27C90 23 75 6 50 6z");
  x.fill(skull); x.stroke(skull);
  x.fillStyle = "#e8202a"; [[33, 47], [67, 47]].forEach(([ex, ey]) => { x.beginPath(); x.ellipse(ex, ey, 11, 12, 0, 0, Math.PI * 2); x.fill(); });
  x.fillStyle = "#141210"; x.fill(new Path2D("M50 58l-6 10h12z"));
  x.beginPath(); [40, 50, 60].forEach((tx) => { x.moveTo(tx, 76); x.lineTo(tx, 90); }); x.stroke();
  x.restore();
  x.restore();
  // ランキング：罰の数をバーで
  const ts = titles().slice(0, 4);
  const maxRows = ts.length > 2 ? 5 : ts.length ? 6 : 8;
  const maxN = Math.max(1, top.n), rowH = 66;
  let y = 1000;
  x.fillStyle = "#8d857a"; x.font = `900 32px ${body}`; x.fillText("罰ランキング", 90, y - 20);
  rows.slice(0, maxRows).forEach((r, k) => {
    const cy = y + k * rowH + 30;
    x.fillStyle = k === 0 && r.n > 0 ? "#e8202a" : "rgba(247,243,234,.12)"; x.beginPath(); x.arc(118, cy - 12, 26, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#f7f3ea"; x.font = `36px ${disp}`; const no = String(k + 1); x.fillText(no, 118 - x.measureText(no).width / 2, cy);
    x.fillStyle = colorOf(r.i); x.beginPath(); x.arc(186, cy - 12, 14, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#f7f3ea"; fit(r.m.name, `900 @px ${body}`, 44, 300, 24); x.fillText(r.m.name, 216, cy);
    const bx = 540, bw = W - 200 - bx;
    x.fillStyle = "rgba(247,243,234,.1)"; roundRect(x, bx, cy - 30, bw, 28, 14); x.fill();
    if (r.n) { x.fillStyle = colorOf(r.i); roundRect(x, bx, cy - 30, Math.max(28, (bw * r.n) / maxN), 28, 14); x.fill(); }
    x.fillStyle = "#f7f3ea"; x.font = `52px ${disp}`; const sN = String(r.n); x.fillText(sN, W - 90 - x.measureText(sN).width, cy + 4);
  });
  if (rows.length > maxRows) { x.fillStyle = "#8d857a"; x.font = `900 30px ${body}`; x.fillText(`ほか${rows.length - maxRows}人`, 216, y + maxRows * rowH + 24); }
  y += Math.min(rows.length, maxRows) * rowH + (rows.length > maxRows ? 56 : 30);
  // 称号のバッジ
  if (ts.length) {
    y += 30;
    x.fillStyle = "#ffd23f"; x.font = `48px ${disp}`; x.fillText("称号", 90, y);
    y += 26;
    const w = (W - 200) / 2;
    ts.forEach((t, k) => {
      const cx = 90 + (k % 2) * (w + 20), cy = y + Math.floor(k / 2) * 142;
      x.fillStyle = "rgba(247,243,234,.08)"; roundRect(x, cx, cy, w, 124, 24); x.fill();
      x.strokeStyle = "rgba(255,210,63,.45)"; x.lineWidth = 3; x.stroke();
      x.fillStyle = "#ffd23f"; fit(t.title, `900 @px ${body}`, 32, w - 56, 20); x.fillText(t.title, cx + 28, cy + 48);
      const nmz = titleNames(t);
      x.fillStyle = "#f7f3ea"; fit(nmz, `900 @px ${body}`, 46, w - 56, 24); x.fillText(nmz, cx + 28, cy + 102);
    });
  }
  // 下：アプリ名（ストーリーの下の帯の上に収まる位置）
  x.fillStyle = "rgba(247,243,234,.18)"; x.fillRect(90, H - 210, W - 180, 3);
  x.fillStyle = "#f7f3ea"; x.font = `52px ${disp}`; x.fillText("ノリダン", 90, H - 128);
  x.fillStyle = "#8d857a"; x.font = `900 32px ${body}`; x.fillText("ノリで断れない飲み会ゲーム", 360, H - 140);
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
document.documentElement.lang = "ja"; // 日本語の改行ルール（小さい「ッ」などを行頭に置かへん）を効かせる
const app = document.getElementById("app");
const overlay = document.getElementById("overlay");
let lastSoundKey = "";
function render(anim) {
  const sc = S.screen;
  const onStage = isStage(sc);
  document.body.dataset.level = S.level;
  document.body.classList.toggle("stage", onStage);
  if (onStage) document.body.style.setProperty("--pc", S.game.doer >= 0 ? colorOf(S.game.doer) : modeFrame());
  // 夜お題の間だけ照明が落ちてネオン看板に。ホームも夜モード中はネオン
  const c = onStage ? S.game.card : null;
  const vtNight = sc === "vote" && S.game.vt.phase !== "batsu" ? S.game.vt.night : false; // 投票の夜の質問もネオンに
  const neon = !!(c && c.yoru && S.game.phase !== "batsu") || !!vtNight;
  document.body.classList.toggle("neon", neon);
  // 画面の外側（下のホームバーの所など）も同じ色にして、黒い帯が出んようにする
  document.documentElement.style.backgroundColor = getComputedStyle(document.body).getPropertyValue("--bg").trim() || "";
  document.body.classList.toggle("night-home", sc === "home" && !!(S.night || S.nightAsk));
  document.body.classList.toggle("deep", (neon && (vtNight ? vtNight === "shinya" : c.kind?.includes("深夜"))) || (sc === "home" && (S.nightAsk ? S.nightAsk === "shinya" : S.night === "shinya")));
  S.anim = !!anim;
  S.gIntro = false;
  // 画面が変わった時だけスライドして入ってくる
  const key = sc === "home" ? (S.nightAsk ? "night" : "home" + S.step) : sc;
  const ORDER = { home1: 0, night: 1, home2: 1, odai: 2, sugoroku: 2, memory: 2, ito: 2, gesture: 2, homeru: 2, ngword: 2, vote: 2, wolf: 2, pittari: 2, result: 3 };
  const moved = S.navKey && S.navKey !== key;
  const dir = moved && ORDER[key] < ORDER[S.navKey] ? "back" : "fwd";
  S.navKey = key;
  app.innerHTML = sc === "home" ? vHome() : sc === "odai" ? vOdai() : sc === "sugoroku" ? vSugo() : sc === "memory" ? vMemory() : sc === "ito" ? vIto() : sc === "gesture" ? vGesture() : sc === "homeru" ? vHomeru() : sc === "ngword" ? vNg() : sc === "vote" ? vVote() : sc === "wolf" ? vWolf() : sc === "pittari" ? vPittari() : vResult();
  if (moved) { app.classList.remove("enter-fwd", "enter-back"); void app.offsetWidth; app.classList.add("enter-" + dir); window.scrollTo(0, 0); }
  overlay.innerHTML = S.tut !== null ? vTut() : S.sheet ? vSheet() : S.menu ? vMenu() : S.scores && onStage ? vScores() : S.bombLook && onStage ? vBombLook() : S.ruleSheet && onStage ? vRuleSheet() : S.rules ? vRules() : "";
  if (onStage) { fixHeight(); fitCard(); }
  if (anim) { window.scrollTo(0, 0); cue(); if (S.gIntro) { clearTimeout(S.speakT); S.speakT = setTimeout(speakNow, GACHA_T * 1000); } else speakNow(); postFx(); }
  if (!onStage && sc !== "result") stopSpeak();
  syncWake();
  const f = document.getElementById("addForm");
  if (f) f.addEventListener("submit", onAdd);
}
// 描画のあとに動かす演出（票の数え上げ・結果発表のドラムロール）
function postFx() {
  (S.fxTs || []).forEach(clearTimeout); S.fxTs = [];
  const later = (fn, ms) => S.fxTs.push(setTimeout(fn, ms));
  // 票の数え上げ：1票ずつランダムな順に、ポン、ポン
  const ul = app.querySelector(".vbars.count");
  if (ul) {
    const lis = [...ul.children], max = +ul.dataset.max || 1;
    const seq = [];
    lis.forEach((li, k) => { for (let j = 0; j < +li.dataset.v; j++) seq.push(k); });
    for (let a = seq.length - 1; a > 0; a--) { const b = Math.floor(Math.random() * (a + 1)); [seq[a], seq[b]] = [seq[b], seq[a]]; }
    const step = voteStep(seq.length) * 1000, cnt = lis.map(() => 0);
    seq.forEach((k, j) => later(() => {
      cnt[k]++;
      const li = lis[k];
      li.querySelector("b").textContent = cnt[k];
      li.querySelector(".bar i").style.setProperty("--w", `${(cnt[k] / max) * 100}%`);
      li.classList.remove("hit"); void li.offsetWidth; li.classList.add("hit");
      play("tick");
    }, 300 + j * step));
    later(() => { ul.classList.add("done"); play("warn"); if (navigator.vibrate) navigator.vibrate([30, 30, 60]); }, 300 + seq.length * step + 150);
  }
  // 結果発表：戦犯の名前がスロットみたいに回って、止まったら揺れて紙吹雪
  const slot = app.querySelector(".mvp[data-slot]");
  if (slot) {
    const b = slot.querySelector("b"), final = b.dataset.final, names = S.members.map((m) => m.name);
    const T = 2.4;
    play("drumroll");
    let t = 0, k = 0;
    while (t < T * 1000) { const nm = names[k % names.length]; later(() => { b.textContent = nm; }, t); t += 60 + (t / (T * 1000)) ** 2 * 260; k++; }
    later(() => { b.textContent = final; slot.classList.add("landed"); app.querySelector(".result")?.classList.add("landed"); confetti(); if (navigator.vibrate) navigator.vibrate([60, 40, 120]); }, T * 1000);
  }
}
function confetti() {
  const box = document.createElement("div");
  box.className = "confetti";
  box.setAttribute("aria-hidden", "true");
  const cols = ["#ffd23f", "#ff5aa5", "#3ec7ff", "#7be36b", "#ff8a1a", "#e8202a", "#b48cff"];
  box.innerHTML = Array.from({ length: 70 }, (_, k) => `<i style="left:${(Math.random() * 100).toFixed(1)}%;background:${cols[k % cols.length]};--x:${((Math.random() * 2 - 1) * 120).toFixed(0)}px;--r:${(Math.random() * 720 - 360).toFixed(0)}deg;--t:${(1.6 + Math.random() * 1.4).toFixed(2)}s;--d:${(Math.random() * 0.35).toFixed(2)}s;width:${(6 + Math.random() * 6).toFixed(0)}px;height:${(10 + Math.random() * 8).toFixed(0)}px"></i>`).join("");
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3600);
}

// 画面が変わった時の効果音と演出
function cue() {
  const sc = S.screen;
  if (sc === "result") { if (!app.querySelector(".mvp[data-slot]")) play("fanfare"); return; }
  if (sc === "ngword") { const p = S.game.ng.phase; play(p === "out" ? (S.game.ng.res.lucky ? "lucky" : "boom") : p === "over" ? "alarm" : p === "confirm" ? "warn" : "flip"); if (p === "out" && !S.game.ng.res.lucky) boomFlash(); return; }
  if (sc === "gesture") { const p = S.game.gs.phase; play(p === "low" ? (S.game.gacha.every((x) => x.lucky) ? "lucky" : "pop") : p === "over" ? "fanfare" : p === "act" ? "coin" : "flip"); return; }
  if (sc === "homeru") { const p = S.game.hm.phase; play(p === "batsu" ? (S.game.gacha.every((x) => x.lucky) ? "lucky" : "pop") : p === "go" ? "coin" : "flip"); return; }
  if (sc === "ito") { const p = S.game.it.phase; play(p === "batsu" ? (S.game.gacha.every((x) => x.lucky) ? "lucky" : "pop") : p === "reveal" ? (S.game.it.bad.length ? "warn" : "fanfare") : "flip"); return; }
  if (sc === "memory") { const p = S.game.mm.phase; play(p === "skull" ? "boom" : p === "fail" || p === "low" ? (S.game.gacha.every((x) => x.lucky) ? "lucky" : "pop") : p === "match" ? "coin" : p === "miss" ? "warn" : p === "over" ? "fanfare" : "flip"); if (p === "skull") boomFlash(); return; }
  if (sc === "wolf") { const p = S.game.wf.phase; play(p === "batsu" ? (S.game.gacha.every((x) => x.lucky) ? "lucky" : "pop") : p === "group" ? (S.game.wf.res.lucky ? "lucky" : "pop") : p === "reveal" || p === "result" ? "fanfare" : "flip"); return; }
  if (sc === "pittari") { const p = S.game.pt.phase; if (p === "input" || p === "answer") return; play(p === "batsu" ? (S.game.gacha.every((x) => x.lucky) ? "lucky" : "pop") : p === "reveal" ? "fanfare" : "flip"); return; }
  if (sc === "vote") { const p = S.game.vt.phase; play(p === "batsu" ? (S.game.gacha.every((x) => x.lucky) ? "lucky" : "pop") : p === "reveal" ? "fanfare" : "flip"); return; }
  if (sc !== "odai" && sc !== "sugoroku") return;
  const g = S.game, c = g.card || {};
  if (g.intro) { play("flip"); return; }
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
  } else if ((S.screen === "odai" || S.screen === "sugoroku") && !S.game.intro) speak(cardSpeech());
  else if (S.screen === "homeru") { const hm = S.game.hm; if (hm.phase === "ready") speak(`${S.members[hm.praiser].name}が${S.members[hm.target].name}を褒め殺し。テーマは${hm.theme}`); else if (S.game.phase === "batsu") speak(cardSpeech()); }
  // ジェスチャーのお題は読み上げへん（当てる人に聞こえてまう）
  else if (S.screen === "ito") { const it = S.game.it; if (it.phase === "talk") speak(`お題は、${it.topic.t}`); else if (S.game.phase === "batsu") speak(cardSpeech()); }
  else if (S.screen === "memory") { const mm = S.game.mm; if (mm.phase === "match") speak(plain(mm.card.html)); else if (S.game.phase === "batsu") speak(cardSpeech()); }
  else if (S.screen === "pittari") { const pt = S.game.pt; if (pt.phase === "q") speak(pt.q.replace("{P}", pt.who >= 0 ? S.members[pt.who].name : "")); else if (pt.phase === "batsu") speak(cardSpeech()); }
  else if (S.screen === "wolf") { const wf = S.game.wf; if (wf.phase === "batsu") speak(cardSpeech()); }
  else if (S.screen === "vote") { const vt = S.game.vt; if (vt.phase === "q") speak(vt.q); else if (vt.phase === "batsu") speak(cardSpeech()); }
  // NGワードは絶対に読み上げへん（ワードがバレる）
}
// フチの色：番の人がおらんモードは、その時に画面を見てる人の色
function modeFrame() {
  const g = S.game;
  if (g.ng && ["hand", "look"].includes(g.ng.phase)) return colorOf(g.ng.viewer);
  if (g.ng && ["confirm", "out", "eyes", "newword"].includes(g.ng.phase)) return colorOf(g.ng.out);
  if (g.vt && ["hand", "vote"].includes(g.vt.phase)) return colorOf(g.vt.order[g.vt.k]);
  if (g.wf && ["hand", "look"].includes(g.wf.phase)) return colorOf(g.wf.viewer);
  if (g.wf && ["vhand", "vote"].includes(g.wf.phase)) return colorOf(g.wf.order[g.wf.k]);
  if (g.wf && g.wf.phase === "guess" && g.wf.wolves.length) return colorOf(g.wf.wolves[0]);
  if (g.pt && ["hand", "input"].includes(g.pt.phase)) return colorOf(g.pt.order[g.pt.k]);
  if (g.it && ["hand", "look"].includes(g.it.phase)) return colorOf(g.it.viewer);
  if (g.hm && g.hm.phase === "batsu" && g.hm.loser != null) return colorOf(g.hm.loser);
  return "#8d857a";
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
  S.members.push({ name });
  saveMembers(); play("tick"); render();
  document.getElementById("inName").focus();
}
// ゲームを始めた時のメンバーを「前回のメンバー」として3組まで覚えておく
function rememberGroup() {
  if (S.isExample) return;
  const key = S.members.map((m) => m.name).join();
  const gs = (store.get("nd_groups", []) || []).filter((g) => g.map((m) => m.name).join() !== key);
  gs.unshift(S.members.map((m) => ({ ...m })));
  store.set("nd_groups", gs.slice(0, 3));
}

// ---------- 1手戻す ----------
// ゲームの中身が変わる操作の直前を覚えとく（最大20手）。タイマー・サイコロ・ルーレットの途中は戻さへん
const snapKey = (g) => { try { return JSON.stringify(g, (k, v) => (v instanceof Map || v instanceof Set ? [...v] : v)); } catch { return ""; } };
function busyGame() { const g = S.game; return !!(g && (g.rolling || g.hopping || S.spinning || modeTimer)); }
function rememberStep(act) {
  if (act === "undo" || !S.game || !isStage(S.screen) || busyGame()) return;
  const g = S.game, key = snapKey(g);
  let snap;
  try { snap = structuredClone(g); } catch { return; }
  queueMicrotask(() => {
    if (S.game !== g || !isStage(S.screen) || snapKey(g) === key) return;
    S.hist.push(snap);
    if (S.hist.length > 20) S.hist.shift();
  });
}
function undoGame() {
  if (!S.hist.length || busyGame()) return;
  stopTimer();
  S.game = S.hist.pop();
  S.menu = false; S.scores = false; S.bombLook = 0; S.ruleSheet = null;
  render(true);
}

function onClick(e) {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  // シートの中身をタップしても閉じないように
  if ((b.dataset.act === "sheetClose" || b.dataset.act === "menuClose" || b.dataset.act === "scoresClose" || b.dataset.act === "rulesClose" || b.dataset.act === "bombLookClose") && b.classList.contains("sheet-back") && e.target.closest("[data-stop]")) return;
  SFX.unlock();
  if (navigator.vibrate && b.tagName === "BUTTON") navigator.vibrate(6); // 押した手応え（Androidのみ）
  const act = b.dataset.act, g = S.game, i = +b.dataset.i;
  rememberStep(act);
  switch (act) {
    // home
    case "del": S.members.splice(i, 1); saveMembers(); render(); break;
    case "lv": S.level = b.dataset.v; store.set("nd_level", S.level); render(); break;
    case "step1": S.step = 1; render(); break;
    case "members": stopTimer(); S.screen = "home"; S.step = 1; render(); window.scrollTo(0, 0); break;
    case "step2": S.step = 2; render(); window.scrollTo(0, 0); break;
    case "start": rememberGroup(); newGame(b.dataset.m); break;
    case "home": stopTimer(); S.menu = false; S.ask = null; S.screen = "home"; S.step = 2; render(); break;
    case "again": S.shareMsg = ""; newGame(g.mode, true); break;
    case "end": stopTimer(); S.menu = false; S.ask = null; applyAdds(); S.shareMsg = ""; S.screen = "result"; render(true); break;
    case "menu": S.menu = true; S.ask = null; render(); break;
    case "ask": S.ask = b.dataset.v; render(); break;
    case "askNo": S.ask = null; render(); break;
    case "undo": undoGame(); break;
    case "scores": S.scores = true; render(); break;
    case "bombLook": S.bombLook = 1; render(); break;
    case "bombLookShow": S.bombLook = 2; render(); break;
    case "bombLookClose": S.bombLook = 0; render(); break;
    case "scoresClose": S.scores = false; render(); break;
    case "menuClose": S.menu = false; S.ask = null; render(); break;
    case "share": shareResult(); break;
    case "clearAll": S.members = []; saveMembers(); render(); document.getElementById("inName")?.focus(); break;
    case "loadGroup": {
      const gs = (store.get("nd_groups", []) || []).filter((x) => x.map((m) => m.name).join() !== S.members.map((m) => m.name).join());
      if (gs[i]) { S.members = gs[i].map((m) => ({ name: m.name, ...(m.ng ? { ng: true } : {}) })); saveMembers(); render(); }
      break;
    }

    // settings / tutorial
    case "sheet": S.menu = false; S.sheet = true; render(); break;
    case "sheetClose": S.sheet = false; render(); break;
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
    case "coachReset": S.seen = {}; store.set("nd_seen", {}); store.set("nd_tut", false); S.sheet = false; S.tut = 0; render(); break;
    case "coachOk": S.seen[b.dataset.k] = 1; store.set("nd_seen", S.seen); render(); break;
    case "rules": S.menu = false; S.rules = true; render(); break;
    case "rulesClose": S.rules = false; render(); break;
    case "ruleOpen": S.ruleK = +b.dataset.k; S.ruleSheet = "pick"; render(); break;
    case "ruleClose": S.ruleSheet = null; render(); break;
    case "ruleTo": {
      const { lucky, html } = drawBatsu(i);
      if (lucky) g.st.lucky[i]++;
      else { g.pen[i]++; g.rev[i] = true; g.st.why[i].rule = (g.st.why[i].rule || 0) + 1; }
      S.ruleSheet = { i, lucky, html };
      if (!lucky && PERSONAL.test(html)) addRule({ html: `${nm(i)}の罰：${html}`, left: untilNext(i), who: i });
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

    // NGワード
    case "ngMin": g.ng.minutes = +b.dataset.v; store.set("nd_ng_min", g.ng.minutes); render(); break;
    case "ngDeal": ngDeal(); render(true); break;
    case "ngSee": g.ng.phase = "look"; render(true); break;
    case "ngNext":
      if (g.ng.dealing && g.ng.viewer + 1 < S.members.length) { g.ng.viewer++; g.ng.phase = "hand"; }
      else { g.ng.dealing = false; ngPlay(); }
      render(true); break;
    case "ngBack": ngPlay(); render(); break;
    case "ngPeek": ngPause(); g.ng.phase = "who"; render(); break;
    case "ngWho": g.ng.viewer = i; g.ng.phase = "hand"; render(true); break;
    case "ngTopic": g.ng.topic = draw("ngt", DATA.ngwords.topics); render(); break;
    case "ngTap": ngPause(); g.ng.out = i; g.ng.phase = "confirm"; render(true); break;
    case "ngNo": ngPlay(); render(); break;
    case "ngYes": ngOut(g.ng.out); render(true); if (navigator.vibrate) navigator.vibrate([80, 40, 160]); break;
    case "ngNew": g.ng.phase = "eyes"; render(true); break;
    case "ngEyes": g.ng.words[g.ng.out] = ngPick(g.ng.words, g.ng.out); g.ng.phase = "newword"; render(true); break;
    case "ngHide": ngPlay(); render(true); break;

    // 早押しジェスチャー
    case "gsSec": g.gs.sec = +b.dataset.v; store.set("nd_gs_sec", g.gs.sec); render(); break;
    case "gsRoul": g.gs.phase = "roul"; g.gs.picked = null; render(true); spinRoulette((i) => { g.gs.picked = i; g.gs.actor = i; g.doer = g.cur = i; play("coin"); render(true); }); break;
    case "gsBegin": g.gs.phase = "hand"; render(true); break;
    case "gsGo": gsStart(); render(true); break;
    case "gsHit": gsHit(i); play("coin"); if (navigator.vibrate) navigator.vibrate(30); render(true); break;
    case "gsPass": g.gs.word = gsWord(); play("tick"); render(true); break;
    case "gsNext": gsNextActor(); render(true); break;
    case "gsLow": {
      const low = gsLowest();
      g.add = new Map(low.map((t) => [t, 1])); g.addReason = "glow";
      g.gacha = low.map((t) => ({ i: t, n: 1, ...drawBatsu(t) }));
      g.phase = "batsu"; g.gs.phase = "low"; render(true); break;
    }
    case "gsAccept": applyAdds(); g.gacha = []; g.phase = "play"; g.gs.phase = "end"; render(true); break;

    // 褒め殺し
    case "hmRoul": g.hm.phase = "roul"; g.hm.picked = null; render(true); spinRoulette((i) => { g.hm.picked = i; g.hm.praiser = i; g.doer = g.cur = i; play("coin"); render(true); }); break;
    case "hmBegin": hmRound(); render(true); break;
    case "hmShuffle": { const t = g.hm.target, pool = others(g.hm.praiser).filter((x) => x !== t); if (pool.length) g.hm.target = pick(pool); render(true); break; }
    case "hmTheme": g.hm.theme = draw("hm_" + (g.hm.night || "normal"), DATA.homeru[g.hm.night || "normal"]); render(true); break;
    case "hmGo": g.hm.phase = "go"; g.hm.endAt = startTimer(g.hm.sec, () => { hmLose(g.hm.praiser); render(true); }); render(true); break;
    case "hmLaugh": hmLose(g.hm.target); render(true); break;
    case "hmGiveUp": hmLose(g.hm.praiser); render(true); break;
    case "hmAccept": applyAdds(); g.gacha = []; g.phase = "play"; tickRule(); g.hm.praiser = (g.hm.praiser + 1) % S.members.length; hmRound(); render(true); break;

    // 価値観ナンバー
    case "itStart": itRound(); render(true); break;
    case "itSee": g.it.phase = "look"; render(true); break;
    case "itNext": {
      const it = g.it, n = S.members.length;
      if (it.dealing && it.seen + 1 < n) { it.seen++; it.viewer = (it.viewer + 1) % n; it.phase = "hand"; }
      else { it.dealing = false; it.phase = "talk"; }
      render(true); break;
    }
    case "itBack": g.it.phase = "talk"; render(); break;
    case "itPeek": g.it.phase = "who"; render(); break;
    case "itWho": g.it.viewer = i; g.it.phase = "hand"; render(true); break;
    case "itSkip": g.it.topic = itTopic(g.it.night || S.level); render(true); break;
    case "itOrder": g.it.phase = "order"; render(true); break;
    case "itTalk": g.it.phase = "talk"; render(); break;
    case "itPut": g.it.order.push(i); play("tick"); render(); break;
    case "itUndo": g.it.order.pop(); render(); break;
    case "itClear": g.it.order = []; render(); break;
    case "itCheck": itCheck(); render(true); break;
    case "itGacha":
      g.add = new Map(g.it.bad.map((t) => [t, 1])); g.addReason = "ito";
      g.gacha = g.it.bad.map((t) => ({ i: t, n: 1, ...drawBatsu(t) }));
      g.phase = "batsu"; g.it.phase = "batsu"; render(true); break;
    case "itAccept": applyAdds(); g.gacha = []; g.phase = "play"; itRound(); render(true); break;
    case "itNew": itRound(); render(true); break;

    case "introGo": g.intro = false; render(true); break;
    case "vBegin": startVoteRound(); render(true); break;

    // 神経衰弱
    case "mmStart": g.mm.phase = "pick"; render(true); break;
    case "mmFlip": mmFlip(i); render(g.mm.phase !== "pick"); if (g.mm.phase === "pick") play("tick"); break;
    case "mmNext": g.mm.cards.forEach((c) => { if (!c.gone) c.up = false; }); mmNextPlayer(); render(true); break;
    case "mmYes": mmAnswer(true); render(true); break;
    case "mmNo": mmAnswer(false); render(true); break;
    case "mmAccept": mmAfterBatsu(); render(true); break;
    case "mmLow": {
      const low = mmLowest();
      g.add = new Map(low.map((t) => [t, 1])); g.addReason = "mlow";
      g.gacha = low.map((t) => ({ i: t, n: 1, ...drawBatsu(t) }));
      g.phase = "batsu"; g.mm.phase = "low"; render(true); break;
    }

    // ワードウルフ
    case "wfMin": g.wf.minutes = +b.dataset.v; store.set("nd_wf_min", g.wf.minutes); render(); break;
    case "wfN": g.wf.count = +b.dataset.v; store.set("nd_wf_n", g.wf.count); render(); break;
    case "wfPeace": g.wf.peace = b.dataset.v === "1"; store.set("nd_wf_peace", g.wf.peace); render(); break;
    case "wfBegin": wfRound(); render(true); break;
    case "wfSee": g.wf.phase = "look"; render(true); break;
    case "wfNext": {
      const wf = g.wf;
      if (wf.dealing && wf.dealt + 1 < S.members.length) { wf.dealt++; wf.viewer = wf.order[wf.dealt]; wf.phase = "hand"; }
      else wfTalk();
      render(true); break;
    }
    case "wfBack": g.wf.phase = "talk"; render(); break;
    case "wfPeek": g.wf.phase = "who"; render(); break;
    case "wfWho": g.wf.viewer = i; g.wf.phase = "hand"; render(true); break;
    case "wfVote": stopTimer(); g.wf.endAt = 0; g.wf.k = 0; g.wf.phase = "vhand"; render(true); break;
    case "wfVHand": g.wf.phase = "vote"; render(true); break;
    case "wfPick":
      g.wf.votes[g.wf.order[g.wf.k]] = i; g.wf.k++;
      g.wf.phase = g.wf.k < S.members.length ? "vhand" : "done";
      play("tick"); if (navigator.vibrate) navigator.vibrate(20);
      render(true); break;
    case "wfReveal": wfReveal(); render(true); break;
    case "wfGuess": g.wf.phase = "guess"; render(true); break;
    case "wfHit": g.wf.guessed = true; g.wf.phase = "result"; render(true); break;
    case "wfMiss": g.wf.guessed = false; g.wf.phase = "result"; render(true); break;
    case "wfResult": g.wf.phase = "result"; render(true); break;
    case "wfGacha": {
      const wf = g.wf, lose = wfLosers();
      if (!wf.allCit && !wf.caught) wf.wolves.forEach((w) => g.st.wolf[w]++);
      g.add = new Map(lose.map((t) => [t, 1])); g.addReason = "wolf";
      if (lose.length === 1) { g.gacha = lose.map((t) => ({ i: t, n: 1, ...drawBatsu(t) })); g.phase = "batsu"; wf.phase = "batsu"; }
      else { wf.res = wfGroupBatsu(); g.gacha = wf.res.lucky ? lose.map((t) => ({ i: t, n: 1, lucky: true, html: "" })) : []; wf.phase = "group"; }
      render(true); break;
    }
    case "wfDone": applyAdds(); g.gacha = []; g.phase = "play"; wfRound(); render(true); break;

    // ピッタリ予想
    case "ptBegin": ptRound(); render(true); break;
    case "ptSkip": g.pt.round--; ptRound(); render(true); break;
    case "ptStart": g.pt.phase = "hand"; render(true); break;
    case "ptHand": g.pt.input = ""; g.pt.phase = "input"; render(true); break;
    case "ptKey": ptKey(b.dataset.v); play("tick"); render(); break;
    case "ptOk": {
      const pt = g.pt;
      if (pt.input === "") break;
      pt.guess[pt.order[pt.k]] = +pt.input; pt.input = ""; pt.k++;
      pt.phase = pt.k < pt.order.length ? "hand" : "done";
      if (navigator.vibrate) navigator.vibrate(20);
      render(true); break;
    }
    case "ptAns": g.pt.input = ""; g.pt.phase = "answer"; render(true); break;
    case "ptAnsOk": if (g.pt.input === "") break; g.pt.answer = +g.pt.input; g.pt.input = ""; ptReveal(); render(true); break;
    case "ptGacha": {
      const pt = g.pt, x = pt.exact.length ? 2 : 1;
      g.add = new Map(pt.losers.map((t) => [t, x])); g.addReason = "pit";
      g.gacha = pt.losers.map((t) => ({ i: t, n: x, ...drawBatsu(t, x) }));
      g.phase = "batsu"; pt.phase = "batsu"; render(true); break;
    }
    case "ptNext": applyAdds(); g.gacha = []; g.phase = "play"; ptRound(); render(true); break;

    // ぶっちゃけ投票
    case "vStart": g.vt.phase = "hand"; render(true); break;
    case "vSkip": g.vt.round--; startVoteRound(); render(true); break;
    case "vHand": g.vt.phase = "vote"; render(true); break;
    case "vPick":
      g.vt.votes[g.vt.order[g.vt.k]] = i; g.vt.k++;
      g.vt.phase = g.vt.k < S.members.length ? "hand" : "done";
      play("tick"); if (navigator.vibrate) navigator.vibrate(20);
      render(true); break;
    case "vReveal": voteReveal(); render(true); break;
    case "vGacha":
      g.add = new Map(g.vt.top.map((t) => [t, 1])); g.addReason = "vote";
      g.gacha = [...g.add].map(([t, n]) => ({ i: t, n, ...drawBatsu(t) }));
      g.phase = "batsu"; g.vt.phase = "batsu"; render(true); break;
    case "vNext": applyAdds(); g.gacha = []; startVoteRound(); render(true); break;

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
      if (b.dataset.v === "off") { S.night = false; store.set("nd_night", false); render(); break; }
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
// 長押しで見る：押してる間だけ .on
app.addEventListener("pointerdown", (e) => {
  const pk = e.target.closest("[data-peek]");
  if (!pk) return;
  e.preventDefault();
  pk.classList.add("on", "seen");
  try { pk.setPointerCapture(e.pointerId); } catch {}
  play("flip");
  if (navigator.vibrate) navigator.vibrate(12);
});
const peekOff = () => document.querySelectorAll("[data-peek].on").forEach((el) => el.classList.remove("on"));
["pointerup", "pointercancel", "blur"].forEach((ev) => window.addEventListener(ev, peekOff));
app.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-peek]")) e.preventDefault(); });

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
  return g && !g.intro && (S.screen === "odai" || S.screen === "sugoroku") && g.phase === "play" && !g.double && g.card?.solo && !needsPick(g.card.tpl) && g.penOpen !== g.card && !(S.screen === "sugoroku" && !g.rolled);
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

render();
