import odai from '../data/odai.json';
import events from '../data/events.json';
import batsu from '../data/batsu.json';
import bombs from '../data/bombs.json';
import boardJson from '../data/board.json';
import ngwords from '../data/ngwords.json';
import voteJson from '../data/vote.json';
import marksJson from '../data/marks.json';
import gestureJson from '../data/gesture.json';
import homeruJson from '../data/homeru.json';
import wolfJson from '../data/wolf.json';
import pittariJson from '../data/pittari.json';
import { LEVEL_LABEL } from '../theme';
import type { Card, Cell, GameEvent, Level, Member, Night, Rule, Segment } from '../types';

export const BOARD = boardJson as Cell[];
export const GOAL = BOARD.length - 1;
const EVENTS = events as GameEvent[];

/** 各要素が出る確率 */
/**
 * エロがりモードを出すか。App Store審査で引っかかったら false にしてビルド
 * （Web版はそのままtrueでOK）
 */
export const ALLOW_SHINYA = true;

export const CHANCE = { event: 0.14, double: 0.2, minna: 0.25, bomb: 0.12, yoru: 0.35, lucky: 0.15 };

const rnd = (n: number) => Math.floor(Math.random() * n);
export const pick = <T,>(a: T[]): T => a[rnd(a.length)];
const shuffle = <T,>(a: T[]): T[] => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
export const othersOf = (members: Member[], i: number) => members.map((_, j) => j).filter((j) => j !== i);

/** {P}{X}{Y} を埋めて表示用の部品にする */
export function fill(tpl: string, members: Member[], p: number, opts: { noNg?: boolean } = {}): Segment[] {
  const others = othersOf(members, p).filter((i) => !opts.noNg || !members[i].ng);
  const x = pick(others);
  const yPool = others.filter((i) => i !== x);
  const y = yPool.length ? pick(yPool) : x;

  const out: Segment[] = [];
  const re = /\{(P|X|Y)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tpl))) {
    if (m.index > last) out.push({ text: tpl.slice(last, m.index) });
    const key = m[1];
    const who = key === 'P' ? p : key === 'X' ? x : y;
    out.push({ text: members[who]?.name ?? '誰か', hl: true, who });
    last = m.index + m[0].length;
  }
  if (last < tpl.length) out.push({ text: tpl.slice(last) });
  return out;
}

export const nameSeg = (name: string, rest: string, who?: number): Segment[] => [{ text: name, hl: true, who }, { text: rest }];

/** 人によっては当てはまらんお題（恋人・経験・その場の状況など）。この時だけ「当てはまらん」ボタンを出す */
const SITUATIONAL = /元恋人|恋人|キス|初体験|ラブホ|ワンナイト|付き合|好きやった|ドキッとした相手|グイグイ|トイレ|親に|寝言|夢/;
export const isSituational = (tpl?: string) => !!tpl && SITUATIONAL.test(tpl);

/** 神経衰弱のマーク：お題の文にこの言葉が入ってたらそのマーク（上から順に） */
const MARKS = (marksJson.marks as string[][]).map(([re, m]) => [new RegExp(re), m] as const);
export function markOf(t: string): string | null {
  const s = t.replace(/\{[PXY]\}/g, '誰か');
  const hit = MARKS.find(([re]) => re.test(s));
  return hit ? hit[1] : null;
}

/** 「次の自分の番まで語尾が〜」みたいな、しばらく続く罰・お題 */
export const PERSONAL = /次の(自分の)?番まで/;

/** 罰2倍（×2）にしても意味が通る罰（「ひと口飲む」「10秒」「3つ言う」みたいに数があるやつ） */
const DOUBLEABLE = /ひと口|ふた口|飲む|\d+\s*(秒|回|つ|個|件|枚|小節|連発|発|杯|周|曲|本|段|行|文字)|[一二三]回/;
export const canDouble = (t: string) => DOUBLEABLE.test(t) && !PERSONAL.test(t);

/** 罰2倍：お題の中の数を全部倍にする（「無理なら〜」の方も） */
const KAN: Record<string, number> = { 一: 1, 二: 2, 三: 3 };
const X2_RE = /(\d+)(\s*)(秒|回|つ|個|件|枚|小節|連発|発|杯|周|曲|本|段|行|文字)(?!以内)|ひと口|ふた口|([一二三])回/g;
function doubleAll(t: string, n: number): { at: number; from: string; to: string }[] {
  const out: { at: number; from: string; to: string }[] = [];
  for (const m of t.matchAll(X2_RE)) {
    const [all, num, sp, unit, kan] = m;
    const to = num ? `${+num * n}${sp}${unit}` : all === 'ひと口' ? (n === 2 ? 'ふた口' : `${n}口`) : all === 'ふた口' ? `${2 * n}口` : `${KAN[kan] * n}回`;
    out.push({ at: m.index!, from: all, to });
  }
  return out;
}
/** 罰2倍の文：数を「元の数（取り消し線）＋倍の数」に分ける。plain=true なら倍の数だけ（読み上げ用） */
export function doubleSegments(segs: Segment[], n: number, plain = false): Segment[] {
  if (n < 2) return segs;
  const out: Segment[] = [];
  let any = false;
  for (const sg of segs) {
    const ds = sg.hl ? [] : doubleAll(sg.text, n);
    if (!ds.length) { out.push(sg); continue; }
    any = true;
    let last = 0;
    for (const d of ds) {
      if (d.at > last) out.push({ text: sg.text.slice(last, d.at) });
      if (!plain) out.push({ text: d.from, x2: 'old' });
      out.push({ text: d.to, x2: plain ? undefined : 'new' });
      last = d.at + d.from.length;
    }
    if (last < sg.text.length) out.push({ text: sg.text.slice(last) });
  }
  if (any) return out;
  // 数が無い時は「飲む」→「2回飲む」
  const res: Segment[] = [];
  let done = false;
  for (const sg of segs) {
    const k = !done && !sg.hl ? sg.text.indexOf('飲む') : -1;
    if (k < 0) { res.push(sg); continue; }
    done = true;
    if (k > 0) res.push({ text: sg.text.slice(0, k) });
    if (!plain) res.push({ text: '飲む', x2: 'old' });
    res.push({ text: `${n}回飲む`, x2: plain ? undefined : 'new' });
    if (k + 2 < sg.text.length) res.push({ text: sg.text.slice(k + 2) });
  }
  return res;
}

/** お題テンプレからカードを作る */
export function makeCard(kind: string, tpl: string, members: Member[], p: number, extra: Partial<Card> = {}): Card {
  return {
    kind,
    tpl,
    noNg: extra.noNg,
    segments: fill(tpl, members, p, { noNg: extra.noNg }),
    solo: tpl.includes('{P}'),
    ...extra,
  };
}

/** 夜お題を出していいか（下ネタNGの人を巻き込まない） */
function canYoru(tpl: string, members: Member[], p: number) {
  // 全員参加の夜お題は、NGの人も指差される側に入ってしまうので出さない
  if (tpl.startsWith('全員') && members.some((m) => m.ng)) return false;
  const ok = othersOf(members, p).filter((i) => !members[i].ng).length;
  if (tpl.includes('{Y}') && ok < 2) return false;
  if (tpl.includes('{X}') && ok < 1) return false;
  return true;
}

/** 3人以上おらんと成立せえへんお題（2人やと必ず引き分け・全員該当になる） */
const NEEDS_3 = /少数派|被らんかった|多数決|一番指された|指差せ|一番似てない|一番低い点|ひとりぼっち|被ったら/;

export function usable(t: string, n: number) {
  if (NEEDS_3.test(t) && n < 3) return false;
  if (t.includes('{Y}') && n < 3) return false;
  if (t.includes('{X}') && n < 2) return false;
  return true;
}

/** 同じお題が続かないための山札 */
export class Decks {
  private decks: Record<string, unknown[]> = {};

  /** 人数的に使えるお題が無ければ undefined */
  private draw<T>(key: string, list: T[], text: (t: T) => string, n: number): T | undefined {
    let d = this.decks[key] as T[] | undefined;
    if (!d || !d.length) d = this.decks[key] = shuffle(list.filter((t) => usable(text(t), n)));
    return d.pop();
  }
  private str(key: string, list: string[], n: number): string | undefined {
    return this.draw(key, list, (t) => t, n);
  }

  odai(level: Level, members: Member[], p: number, night: Night = false): Card {
    const n = members.length;
    // 夜は3回に1回くらい、深夜は毎回下ネタ（NGの人の番だけ普通のお題）
    const shinya = night === 'shinya' && ALLOW_SHINYA;
    const rate = shinya ? 1 : CHANCE.yoru;
    if (night && !members[p].ng && Math.random() < rate) {
      for (let k = 0; k < 4; k++) {
        // 深夜×地獄は全部下ネタ（深夜お題だけ）。それ以外の深夜は6割が深夜お題、4割が夜お題
        const deep = shinya && (level === 'jigoku' || Math.random() < 0.6);
        const tpl = deep ? this.str('shinya', odai.shinya, n) : this.str('yoru', odai.yoru, n);
        if (tpl && canYoru(tpl, members, p)) return makeCard(deep ? 'エロがりお題' : '夜お題', tpl, members, p, { noNg: true, yoru: true });
      }
    }
    if (Math.random() < CHANCE.minna) {
      const t = this.str('minna', odai.minna, n);
      if (t) return makeCard('全員参加', t, members, p, { solo: false });
    }
    return makeCard(`アホお題・${LEVEL_LABEL[level]}`, this.str(level, odai[level], n)!, members, p);
  }

  event(members: Member[], p: number): { card: Card; rule: Rule | null } {
    const ev = this.draw('ev', EVENTS, (e) => e.text, members.length)!;
    // 「次の自分の番まで〜」の指令も、その人の次の番まで上に出しておく（破ったら罰をつけられる）
    const personal = !ev.turns && PERSONAL.test(ev.text);
    const card = makeCard('緊急指令', ev.text, members, p, { alert: true, solo: false, ruleCard: !!ev.turns || personal });
    return { card, rule: ev.turns ? { segments: card.segments, left: ev.turns, card } : personal ? { segments: card.segments, left: members.length + 1, who: p, card } : null };
  }

  bomb(n: number): string {
    return this.str('bomb', bombs, n)!;
  }

  /** NGワードを1つ（今配ってるワードとは被らせへん） */
  /** 地獄度で言葉の言いやすさが変わる。夜・深夜は恋愛・下ネタ寄りも混ざる（下ネタNGの人には配らへん） */
  ngWord(exclude: string[], member?: Member): string {
    let key: Level | 'yoru' | 'shinya' = this.level;
    const shinya = this.night === 'shinya' && ALLOW_SHINYA;
    if (this.night && member && !member.ng && Math.random() < (shinya ? 0.5 : 0.3)) key = shinya && Math.random() < 0.6 ? 'shinya' : 'yoru';
    const words = ngwords.words as Record<string, string[]>;
    for (let k = 0; k < 50; k++) {
      const w = this.str('ngw_' + key, words[key], 99);
      if (w && !exclude.includes(w)) return w;
    }
    return pick(words[this.level].filter((w) => !exclude.includes(w)));
  }
  /** 神経衰弱のペア（マークが被らんように）。夜・深夜はお題も夜寄りに混ぜる（下ネタNGの人がおる時は混ぜへん） */
  memoryPairs(level: Level, night: Night, members: Member[], count = 7): { tpl: string; ch: string; yoru: boolean; deep: boolean }[] {
    const n = members.length;
    const anyNg = members.some((m) => m.ng);
    const pools: { list: string[]; yoru: boolean; deep: boolean }[] = [{ list: odai[level], yoru: false, deep: false }];
    if (night && !anyNg) pools.push({ list: odai.yoru, yoru: true, deep: false });
    if (night === 'shinya' && ALLOW_SHINYA && !anyNg) pools.push({ list: odai.shinya, yoru: true, deep: true }, { list: odai.shinya, yoru: true, deep: true });
    const used = new Set<string>();
    const out: { tpl: string; ch: string; yoru: boolean; deep: boolean }[] = [];
    for (let k = 0; k < 400 && out.length < count; k++) {
      const p = pick(pools);
      const t = pick(p.list);
      if (!/^\{P\}、/.test(t) || !usable(t, n)) continue;
      const ch = markOf(t);
      if (!ch || used.has(ch)) continue;
      used.add(ch);
      out.push({ tpl: t, ch, yoru: p.yoru, deep: p.deep });
    }
    return out;
  }
  /** 早押しジェスチャーのお題。夜・深夜は恋愛・ちょいエロ寄りも混ぜる（下ネタNGの人がおる時は混ぜへん） */
  gesture(level: Level, night: Night, members: Member[]): { text: string; night: 'yoru' | 'shinya' | false } {
    let key: Level | 'yoru' | 'shinya' = level;
    const shinya = night === 'shinya' && ALLOW_SHINYA;
    if (night && !members.some((m) => m.ng) && Math.random() < (shinya ? 0.4 : 0.25)) key = shinya && Math.random() < 0.6 ? 'shinya' : 'yoru';
    const text = this.str('gs_' + key, (gestureJson as unknown as Record<string, string[]>)[key], 99)!;
    return { text, night: key === 'yoru' || key === 'shinya' ? key : false };
  }
  /** 褒め殺しのテーマ。夜・深夜は色気寄りも（どっちかが下ネタNGなら普通のだけ） */
  homeru(night: Night, okNight: boolean): { theme: string; night: 'yoru' | 'shinya' | false } {
    const shinya = night === 'shinya' && ALLOW_SHINYA;
    const key = night && okNight && Math.random() < (shinya ? 0.5 : 0.3) ? (shinya && Math.random() < 0.6 ? 'shinya' : 'yoru') : 'normal';
    const theme = this.str('hm_' + key, (homeruJson as unknown as Record<string, string[]>)[key], 99)!;
    return { theme, night: key === 'normal' ? false : key };
  }
  /** NGワード中に話題に困った時の振りネタ */
  ngTopic(): string {
    return this.str('ngt', ngwords.topics, 99)!;
  }
  /** ぶっちゃけ投票の質問。夜・深夜はたまに下ネタ（候補から下ネタNGの人を外す） */
  vote(level: Level, night: Night, members: Member[]): { q: string; good: boolean; night: 'yoru' | 'shinya' | false; cands: number[] } {
    const ok = members.map((_, i) => i).filter((i) => !members[i].ng);
    const shinya = night === 'shinya' && ALLOW_SHINYA;
    let key: Level | 'yoru' | 'shinya' = level;
    if (night && ok.length >= 3 && Math.random() < (shinya ? 0.75 : 0.35)) key = shinya && (level === 'jigoku' || Math.random() < 0.6) ? 'shinya' : 'yoru';
    const nightQ = key === 'yoru' || key === 'shinya' ? key : false;
    type VQ = string | { text: string; good?: boolean };
    const raw = this.draw<VQ>('vote_' + key, (voteJson as unknown as Record<string, VQ[]>)[key], (t) => (typeof t === 'string' ? t : t.text), 99)!;
    // 褒める系（good）は票が一番少ない人、イジる系は一番多い人が罰
    const q = typeof raw === 'string' ? raw : raw.text;
    const good = typeof raw !== 'string' && !!raw.good;
    return { q, good, night: nightQ, cands: nightQ ? ok : members.map((_, i) => i) };
  }

  /** 文字列やないお題（ワードウルフの組・ピッタリ予想）用の山札 */
  private obj<T>(key: string, list: T[]): T {
    let d = this.decks[key] as T[] | undefined;
    if (!d || !d.length) d = this.decks[key] = shuffle(list.slice());
    return d.pop()!;
  }
  /** ワードウルフのお題の組。どっちが市民のお題かはランダム。夜は下ネタNGの人がおらん時だけ */
  wolf(level: Level, night: Night, members: Member[]): { maj: string; min: string; night: 'yoru' | 'shinya' | false } {
    let key: Level | 'yoru' | 'shinya' = level;
    const shinya = night === 'shinya' && ALLOW_SHINYA;
    if (night && !members.some((m) => m.ng) && Math.random() < (shinya ? 0.5 : 0.3)) key = shinya && Math.random() < 0.6 ? 'shinya' : 'yoru';
    const pair = this.obj('wolf_' + key, (wolfJson as unknown as Record<string, [string, string][]>)[key]);
    const sw = Math.random() < 0.5;
    return { maj: sw ? pair[1] : pair[0], min: sw ? pair[0] : pair[1], night: key === 'yoru' || key === 'shinya' ? key : false };
  }
  /** ピッタリ予想のお題（{P}=答える人） */
  pittari(level: Level): { t: string; u: string } {
    return this.obj('pit_' + level, (pittariJson as unknown as Record<string, { t: string; u: string }[]>)[level]);
  }
  /** 市民全員の罰：全員で同じ罰を1つ（人で中身が変わるもの・「次の自分の番まで」系は外す） */
  groupBatsu(members: Member[]): { segments: Segment[]; lucky: boolean } {
    if (Math.random() < CHANCE.lucky) {
      const t = this.obj('lucky_group', batsu.lucky.filter((x) => !/\{[PXY]\}/.test(x))) ?? 'セーフ！';
      return { segments: [{ text: t }], lucky: true };
    }
    const pool = batsu.bad.filter((t) => !/\{[PXY]\}/.test(t) && !PERSONAL.test(t));
    return { segments: [{ text: this.obj('batsu_group', pool) ?? '全員でひと口飲む（ソフドリでもOK）' }], lucky: false };
  }

  /** 罰ガチャ。たまにラッキー（天使）で帳消し */
  /** 夜モードの状態（罰ガチャを過激にするかどうか）。画面側で毎回入れる */
  night: Night = false;
  /** 地獄度（深夜×地獄は罰も全部深夜系） */
  level: Level = 'futsu';

  /** 罰ガチャの中身。夜・深夜は罰も過激に（下ネタNGの人には普通の罰） */
  /** 罰ガチャの中身。夜・深夜は罰も過激に（下ネタNGの人には普通の罰）。n が2以上（罰2倍）の時は、2倍にしても意味が通る罰だけ */
  batsu(members: Member[], p: number, n = 1): { segments: Segment[]; lucky: boolean; night?: 'yoru' | 'shinya' } {
    const pickFrom = (key: string, list: string[]) => {
      if (n < 2) return this.str(key, list, members.length);
      const pool = list.filter(canDouble);
      return pool.length ? this.str(key + '_x2', pool, members.length) : this.str(key, list, members.length);
    };
    if (Math.random() < CHANCE.lucky) return { segments: fill(this.str('lucky', batsu.lucky, members.length)!, members, p), lucky: true };
    let list: 'bad' | 'yoru' | 'shinya' = 'bad';
    if (this.night && !members[p].ng) {
      const r = Math.random();
      list = this.night === 'shinya' && ALLOW_SHINYA ? (this.level === 'jigoku' || r < 0.65 ? 'shinya' : r < 0.85 ? 'yoru' : 'bad') : r < 0.4 ? 'yoru' : 'bad';
    }
    if (list !== 'bad') {
      const tpl = pickFrom('batsu_' + list, batsu[list]);
      // 巻き込む相手（{X}）も下ネタNGやない人だけ。おらんかったら普通の罰
      const okX = members.some((m, j) => j !== p && !m.ng);
      if (tpl && (!tpl.includes('{X}') || okX)) return { segments: fill(tpl, members, p, { noNg: true }), lucky: false, night: list };
    }
    return { segments: fill(pickFrom('batsu', batsu.bad)!, members, p), lucky: false };
  }


}

// お題の文から「誰が罰か」を読み取って、罰の人を選ぶ時の聞き方にする（例：一番遅い奴が罰 → 一番遅い人は？）
export function penHead(tpl?: string): string {
  if (!tpl) return "アウトの人は？";
  const s = tpl.replace(/（[^）]*）/g, "");
  if (/黙秘/.test(s)) return "黙秘した人は？";
  if (/一番指された人/.test(s)) return "一番指された人は？";
  if (/一番似てない/.test(s)) return "一番似てなかった人は？";
  if (/詰まったら/.test(s)) return "詰まった人は？";
  const ok = (w: string) => w && !w.includes("{") && !/^(と|なら|どっち|も|なっ)/.test(w);
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
/** 勝負のお題（負けた方・先に笑った方…）は誰かが必ずアウトになる */
export function mustPick(tpl?: string): boolean {
  return !!tpl && /方が罰|2人とも罰/.test(tpl);
}
export function needsPick(tpl?: string): boolean {
  if (!tpl) return true;
  if (/黙秘は罰/.test(tpl)) return false;
  return /が罰|は罰|2人とも罰|両方罰/.test(tpl) || /^\{P\}と\{X\}/.test(tpl);
}

/** 顔アイコンの文字：頭1文字。同じ頭文字の人がおる時だけ頭2文字 */
export function initialOf(members: { name: string }[], i: number): string {
  const first = (nm: string) => Array.from(nm.trim())[0] ?? '';
  const nm = members[i]?.name ?? '';
  const f = first(nm);
  return members.some((m, j) => j !== i && first(m.name) === f) ? Array.from(nm.trim()).slice(0, 2).join('') : f;
}
/** 2文字の時は丸からはみ出さんように少し縮める */
export const iniFit = (t: string) => (Array.from(t).length > 1 ? { transform: [{ scale: 0.74 }] } : null);
