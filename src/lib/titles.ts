import whyJson from '../data/why.json';
/** 称号用の記録（1ゲーム分） */
export type Stats = {
  lucky: number[]; // 天使でセーフになった回数
  pass: number[]; // 夜お題をパスした回数
  rev: number[]; // リベンジ権で押し付けた回数
  hit: number[]; // 押し付けられた回数（リベンジ・倍プッシュ成功）
  dbl: number[]; // 倍プッシュした回数
  dwin: number[]; // 倍プッシュ成功
  notme: number[]; // 当てはまらんで回した回数
  solo: number[]; // 自分のお題をやった枚数
  votes?: number[]; // ぶっちゃけ投票で集めた票
  exact?: number[]; // ピッタリ予想でピッタリ当てた回数
  wolf?: number[]; // ワードウルフでウルフとして逃げ切った回数
  reflexBest?: (number | null)[]; // 反射神経の最速（ミリ秒）
  voiceBest?: (number | null)[]; // 声デカの最大
  hiloHits?: number[]; // ハイ&ローで当てた回数
  blindHits?: number[]; // 目隠し当てで当てた回数
  blindFool?: number[]; // 目隠し当てでバレへんかった回数
  pockyFull?: number[]; // ポッキーを最後まで行った回数
  stopExact?: number[]; // ピタッとストップでピッタリ止めた回数
  shakeBest?: (number | null)[]; // 全力シェイクの自己ベスト
  steady?: (number | null)[]; // 傾けたらアウトの最大角度（測れた人だけ）
  /** 罰の理由ごとの回数（結果発表の内訳） */
  why: Partial<Record<Why, number>>[];
};
export type Why = 'out' | 'rule' | 'double' | 'push' | 'bomb' | 'vote' | 'ng' | 'mfail' | 'skull' | 'mlow' | 'ito' | 'glow' | 'gquota' | 'hmlaugh' | 'hmfail' | 'wolf' | 'pit' | 'tilt' | 'shake' | 'stop' | 'rtap' | 'bpass' | 'hilo' | 'reflex' | 'voice' | 'blind' | 'pocky';
/** 罰の理由の名前（src/data/why.json。Web版と共通） */
export const WHY_LABEL = whyJson as Record<Why, string>;
export function whyText(st: Stats | undefined, i: number) {
  const w = st?.why?.[i];
  if (!w) return '';
  return (Object.keys(WHY_LABEL) as Why[]).filter((k) => w[k]).map((k) => `${WHY_LABEL[k]}${w[k]}`).join('・');
}
export const newStats = (n: number): Stats => ({
  lucky: Array(n).fill(0), pass: Array(n).fill(0), rev: Array(n).fill(0), hit: Array(n).fill(0),
  dbl: Array(n).fill(0), dwin: Array(n).fill(0), notme: Array(n).fill(0), solo: Array(n).fill(0), votes: Array(n).fill(0), exact: Array(n).fill(0), wolf: Array(n).fill(0),
  why: Array.from({ length: n }, () => ({})),
});

export type Title = { title: string; idx: number[]; desc: string };

/** 結果発表で戦犯以外にもあだ名をつける。同点は並べる。全員が同じ称号になるやつは出さない */
export function titles(pen: number[], st: Stats | undefined): Title[] {
  if (!st) return [];
  const n = pen.length;
  const out: Title[] = [];
  const add = (title: string, idx: number[] | null, desc: string) => {
    if (idx && idx.length && idx.length < n) out.push({ title, idx, desc });
  };
  const top = (arr: number[], min: number) => {
    const m = Math.max(...arr);
    return m < min ? null : arr.map((v, i) => (v === m ? i : -1)).filter((i) => i >= 0);
  };
  // ノリの化身：パスも当てはまらんも使わず、3枚以上やって罰ゼロ
  const brave = pen.map((_, i) => i).filter((i) => pen[i] === 0 && st.pass[i] === 0 && st.solo[i] >= 3 && !st.notme[i]);
  if (brave.length) add('ノリの化身', brave, '全部やり切って罰ゼロ');
  const maxPen = Math.max(...pen);
  const minPen = Math.min(...pen);
  if (maxPen > 0) add('逃げ切り王', pen.map((v, i) => (v === minPen && !brave.includes(i) ? i : -1)).filter((i) => i >= 0), `罰 ${minPen}回で逃げ切った`);
  const l = top(st.lucky, 1);
  if (l) add('天使に愛された人', l, `天使 ${st.lucky[l[0]]}回`);
  const r = top(st.rev, 1);
  if (r) add('リベンジの鬼', r, `押し付け ${st.rev[r[0]]}回`);
  const h = top(st.hit, 2);
  if (h) add('押し付けられ体質', h, `押し付けられ ${st.hit[h[0]]}回`);
  const v = st.votes ? top(st.votes, 2) : null;
  if (v) add('みんなの的', v, `合計 ${st.votes![v[0]]}票`);
  const ex = st.exact ? top(st.exact, 1) : null;
  if (ex) add('ピッタリ職人', ex, `ピッタリ ${st.exact![ex[0]]}回`);
  const wf = st.wolf ? top(st.wolf, 1) : null;
  if (wf) add('名演技', wf, `ウルフで逃げ切り ${st.wolf![wf[0]]}回`);
  if (st.steady) {
    const sd = st.steady;
    const ok = sd.map((_, i) => i).filter((i) => sd[i] != null);
    if (ok.length > 1) {
      const m = Math.min(...ok.map((i) => sd[i] as number));
      add('鋼の手', ok.filter((i) => sd[i] === m), `最大でも ${m.toFixed(1)}°`);
    }
  }
  if (st.reflexBest) {
    const rb = st.reflexBest;
    const ok = rb.map((_, i) => i).filter((i) => rb[i] != null);
    if (ok.length > 1) {
      const m = Math.min(...ok.map((i) => rb[i] as number));
      add('反射神経王', ok.filter((i) => rb[i] === m), `最速 ${m}ミリ秒`);
    }
  }
  if (st.voiceBest) {
    const vb = st.voiceBest.map((v) => v ?? 0);
    const t = top(vb, 1);
    if (t) add('声量おばけ', t, `最大 ${vb[t[0]]}`);
  }
  const hh = st.hiloHits ? top(st.hiloHits, 2) : null;
  if (hh) add('読みの達人', hh, `当てた ${st.hiloHits![hh[0]]}回`);
  const bh = st.blindHits ? top(st.blindHits, 1) : null;
  if (bh) add('触覚の達人', bh, `当てた ${st.blindHits![bh[0]]}回`);
  const bf = st.blindFool ? top(st.blindFool, 1) : null;
  if (bf) add('気配を消す人', bf, `バレへんかった ${st.blindFool![bf[0]]}回`);
  const pf = st.pockyFull ? top(st.pockyFull, 1) : null;
  if (pf) add('ポッキー完走', pf, `最後まで ${st.pockyFull![pf[0]]}回`);
  const se = st.stopExact ? top(st.stopExact, 1) : null;
  if (se) add('ピタ止め職人', se, `ピッタリ ${st.stopExact![se[0]]}回`);
  if (st.shakeBest && pen.length > 1) {
    const sb = st.shakeBest.map((v) => v ?? 0);
    const t = top(sb, 1);
    if (t) add('シェイク王', t, `10秒で ${sb[t[0]]}回`);
  }
  const d = top(st.dbl, 1);
  if (d) add('ギャンブラー', d, `倍プッシュ ${st.dbl[d[0]]}回（成功${st.dwin[d[0]]}）`);
  const p = top(st.pass, 2);
  if (p) add('パス魔', p, `パス ${st.pass[p[0]]}回`);
  const nm = top(st.notme, 2);
  if (nm) add('当てはまらん人生', nm, `当てはまらん ${st.notme[nm[0]]}回`);
  // 準戦犯：罰が2番目に多い（戦犯とは別の人）
  const sorted = [...new Set(pen)].sort((a, b) => b - a);
  if (sorted.length > 2 && sorted[1] > 0) add('あと一歩で戦犯', pen.map((_, i) => i).filter((i) => pen[i] === sorted[1]), `罰 ${sorted[1]}回`);
  // 罰を1人で半分以上背負った
  const total = pen.reduce((a, b) => a + b, 0);
  if (total >= 4) {
    const big = pen.map((_, i) => i).filter((i) => pen[i] * 2 > total);
    if (big.length) add('全部背負った人', big, `全体の罰の${Math.round((pen[big[0]] / total) * 100)}%`);
  }
  // 天使に見放された：罰3回以上で天使0回
  const nolucky = pen.map((_, i) => i).filter((i) => pen[i] >= 3 && !st.lucky[i] && pen[i] === maxPen);
  if (nolucky.length) add('天使に見放された人', nolucky, `罰 ${maxPen}回・天使 0回`);
  // 罰の理由ごとの称号（何でやられたか）
  let whyN = 0; // 理由ごとの称号は多くても3つまで（いろんな称号が出るように）
  const whyTop = (key: Why, min: number, title: string, unit: string) => {
    if (whyN >= 3) return;
    const a = pen.map((_, i) => st.why[i]?.[key] ?? 0);
    const t = top(a, min);
    if (t && t.length < n) {
      add(title, t, `${unit} ${a[t[0]]}回`);
      whyN++;
    }
  };
  whyTop('rule', 2, 'ルール破りの常習犯', '違反');
  whyTop('bomb', 1, '爆弾処理班（失敗）', '爆発');
  whyTop('skull', 2, 'ドクロの申し子', 'ドクロ');
  whyTop('ng', 2, '口がすべる人', 'NGワード');
  whyTop('hmlaugh', 1, '笑いの沸点ゼロ', '笑った');
  whyTop('double', 1, '倍プッシュ爆死', '失敗');
  whyTop('stop', 2, '止まられへん人', '止め負け');
  whyTop('reflex', 2, '反応遅め', '負け');
  whyTop('rtap', 2, '爆弾に好かれる人', '爆弾');
  return out.slice(0, 8);
}
