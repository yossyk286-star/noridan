import odai from '../data/odai.json';
import events from '../data/events.json';
import batsu from '../data/batsu.json';
import bombs from '../data/bombs.json';
import boardJson from '../data/board.json';
import ngwords from '../data/ngwords.json';
import voteJson from '../data/vote.json';
import marksJson from '../data/marks.json';
import { LEVEL_LABEL } from '../theme';
import type { Card, Cell, GameEvent, Level, Member, Night, Rule, Segment } from '../types';

export const BOARD = boardJson as Cell[];
export const GOAL = BOARD.length - 1;
const EVENTS = events as GameEvent[];

/** 各要素が出る確率 */
/**
 * 深夜モードを出すか。App Store審査で引っかかったら false にしてビルド
 * （Web版はそのままtrueでOK）
 */
export const ALLOW_SHINYA = true;

export const CHANCE = { event: 0.14, double: 0.2, minna: 0.18, neta: 0.22, bomb: 0.12, yoru: 0.35, lucky: 0.15 };

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

/** {P}{X}{Y}{NETA} を埋めて表示用の部品にする */
export function fill(tpl: string, members: Member[], p: number, opts: { needNeta?: boolean; noNg?: boolean } = {}): Segment[] {
  const others = othersOf(members, p).filter((i) => !opts.noNg || !members[i].ng);
  let pool = opts.needNeta ? others.filter((i) => members[i].neta) : others;
  if (!pool.length) pool = others;
  const x = pick(pool);
  const yPool = others.filter((i) => i !== x);
  const y = yPool.length ? pick(yPool) : x;

  const out: Segment[] = [];
  const re = /\{(P|X|Y|NETA)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tpl))) {
    if (m.index > last) out.push({ text: tpl.slice(last, m.index) });
    const key = m[1];
    if (key === 'NETA') out.push({ text: members[x]?.neta || 'アレ' });
    else {
      const who = key === 'P' ? p : key === 'X' ? x : y;
      out.push({ text: members[who]?.name ?? '誰か', hl: true, who });
    }
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

/** お題テンプレからカードを作る */
export function makeCard(kind: string, tpl: string, members: Member[], p: number, extra: Partial<Card> = {}): Card {
  return {
    kind,
    tpl,
    needNeta: extra.needNeta,
    noNg: extra.noNg,
    segments: fill(tpl, members, p, { needNeta: extra.needNeta, noNg: extra.noNg }),
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
        if (tpl && canYoru(tpl, members, p)) return makeCard(deep ? '深夜お題' : '夜お題', tpl, members, p, { noNg: true, yoru: true });
      }
    }
    const hasNeta = members.some((m, i) => i !== p && m.neta);
    const r = Math.random();
    if (hasNeta && r < CHANCE.neta) {
      const t = this.str('neta', odai.neta, n);
      if (t) return makeCard('イジりお題', t, members, p, { needNeta: true });
    }
    if (r < CHANCE.neta + CHANCE.minna) {
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

  /** 罰ガチャ。たまにラッキー（天使）で帳消し */
  /** 夜モードの状態（罰ガチャを過激にするかどうか）。画面側で毎回入れる */
  night: Night = false;
  /** 地獄度（深夜×地獄は罰も全部深夜系） */
  level: Level = 'futsu';

  /** 罰ガチャの中身。夜・深夜は罰も過激に（下ネタNGの人には普通の罰） */
  batsu(members: Member[], p: number): { segments: Segment[]; lucky: boolean; night?: 'yoru' | 'shinya' } {
    if (Math.random() < CHANCE.lucky) return { segments: fill(this.str('lucky', batsu.lucky, members.length)!, members, p), lucky: true };
    let list: 'bad' | 'yoru' | 'shinya' = 'bad';
    if (this.night && !members[p].ng) {
      const r = Math.random();
      list = this.night === 'shinya' && ALLOW_SHINYA ? (this.level === 'jigoku' || r < 0.65 ? 'shinya' : r < 0.85 ? 'yoru' : 'bad') : r < 0.4 ? 'yoru' : 'bad';
    }
    if (list !== 'bad') {
      const tpl = this.str('batsu_' + list, batsu[list], members.length);
      // 巻き込む相手（{X}）も下ネタNGやない人だけ。おらんかったら普通の罰
      const okX = members.some((m, j) => j !== p && !m.ng);
      if (tpl && (!tpl.includes('{X}') || okX)) return { segments: fill(tpl, members, p, { noNg: true }), lucky: false, night: list };
    }
    return { segments: fill(this.str('batsu', batsu.bad, members.length)!, members, p), lucky: false };
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
