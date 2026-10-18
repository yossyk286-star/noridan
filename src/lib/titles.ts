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
  steady?: (number | null)[]; // 傾けたらアウトの最大角度（測れた人だけ）
  /** 罰の理由ごとの回数（結果発表の内訳） */
  why: Partial<Record<Why, number>>[];
};
export type Why = 'out' | 'rule' | 'double' | 'push' | 'bomb' | 'vote' | 'ng' | 'mfail' | 'skull' | 'mlow' | 'ito' | 'glow' | 'gquota' | 'hmlaugh' | 'hmfail' | 'wolf' | 'pit' | 'tilt';
export const WHY_LABEL: Record<Why, string> = { out: 'アウト', rule: '違反', double: '倍プッシュ失敗', push: '押し付けられ', bomb: '爆弾', vote: '投票1位', ng: 'NGワード', mfail: '答えられへん', skull: 'ドクロ', mlow: '最下位', ito: '並び間違い', glow: 'ジェスチャーで当てられへん', gquota: 'ジェスチャーのノルマ未達', hmlaugh: '笑った', hmfail: '褒め負け', wolf: 'ワードウルフ負け', pit: '予想が一番遠い', tilt: '傾けた' };
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
  const d = top(st.dbl, 1);
  if (d) add('ギャンブラー', d, `倍プッシュ ${st.dbl[d[0]]}回（成功${st.dwin[d[0]]}）`);
  const p = top(st.pass, 2);
  if (p) add('パス魔', p, `パス ${st.pass[p[0]]}回`);
  const nm = top(st.notme, 2);
  if (nm) add('当てはまらん人生', nm, `当てはまらん ${st.notme[nm[0]]}回`);
  return out.slice(0, 6);
}
