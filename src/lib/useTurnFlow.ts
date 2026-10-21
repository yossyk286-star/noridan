import { useReducer, useRef } from 'react';
import { Haptics } from './vibe';
import { CHANCE, Decks, PERSONAL, makeCard, nameSeg, othersOf, pick } from './game';
import { play } from './sound';
import { newStats, type Why } from './titles';
import type { Bomb, Card, GachaItem, Member, Phase, Rule, Segment } from '../types';

const OFFER_CARD = (members: Member[], doer: number): Card => ({
  kind: '倍プッシュのチャンス',
  segments: nameSeg(members[doer].name, '、お題を見る前に倍プッシュするか？', doer),
});

/**
 * 1枚のカードを出してから次に進むまでの流れ（両モード共通）
 * 罰チップ → 罰ガチャ → (時限爆弾) → 次へ、の間にダブルアップとリベンジ権が入る
 */
export function useTurnFlow(members: Member[], decks: Decks, onAdvance: () => void) {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const n = members.length;
  const st = useRef({
    doer: 0,
    card: { kind: '', segments: [] } as Card,
    pending: null as Card | null,
    phase: 'play' as Phase,
    double: false,
    pen: Array(n).fill(0) as number[],
    rev: Array(n).fill(false) as boolean[],
    add: new Map<number, number>(),
    gacha: [] as GachaItem[],
    bomb: null as Bomb | null,
    /** 爆弾の設置・爆発を出した直後（次の1回は爆弾判定をしない） */
    bombJust: false,
    /** これ以上爆弾を仕掛けない（すごろくのゴール後など） */
    noPlant: false,
    cards: 0,
    /** 「他の人に罰をつける」で一覧を開いた札（札が変わったら閉じる） */
    penOpenFor: null as Card | null,
    /** 今たまってる罰の理由（なければアウト。爆弾札なら爆弾） */
    addReason: null as Why | null,
    /** 称号用の記録 */
    stats: newStats(n),
    /** 今の番の人（画面側で入れる。「次の自分の番まで」の残りターン計算用） */
    cur: 0,
    /** 発動中のルール（緊急指令・「次の自分の番まで〜」の罰やお題） */
    rules: [] as Rule[],
  }).current;

  /** その人の次の番が終わるまで何ターンあるか（すぐ次がその人でも、その番の間は出しとく） */
  const untilNext = (i: number) => (((i - st.cur + n) % n) || n) + 1;
  const plain = (segs: Segment[]) => segs.map((x) => x.text).join('');
  const addRule = (r: Rule) => {
    // 「〇〇の次の番まで」は見出しに出すので本文からは省く
    const segments = r.who != null ? r.segments.map((x) => (x.hl ? x : { ...x, text: x.text.replace(/次の(自分の)?番まで[、,]?/, '') })) : r.segments;
    const key = plain(segments);
    st.rules = [...st.rules.filter((x) => plain(x.segments) !== key), { ...r, segments }].slice(-4);
  };
  const penaltyRule = (i: number, segments: Segment[]) => {
    if (PERSONAL.test(plain(segments))) addRule({ segments: [{ text: members[i].name, hl: true, who: i }, { text: 'の罰：' }, ...segments], left: untilNext(i), who: i });
  };

  const addPen = (i: number, k = 1) => st.add.set(i, (st.add.get(i) ?? 0) + k);

  const applyAdds = () => {
    const saved = new Set(st.gacha.filter((g) => g.lucky).map((g) => g.i)); // ラッキーの人は罰なし
    saved.forEach((i) => st.stats.lucky[i]++);
    const why: Why = st.addReason ?? (st.card.bomb ? 'bomb' : 'out');
    st.gacha.forEach((g) => !g.lucky && penaltyRule(g.i, g.segments));
    st.add.forEach((k, i) => {
      if (saved.has(i)) return;
      st.pen[i] += k;
      st.rev[i] = true;
      st.stats.why[i][why] = (st.stats.why[i][why] ?? 0) + k;
    });
    st.add = new Map();
    st.addReason = null;
    return st.pen.slice();
  };

  /** カード1枚が終わったあと。時限爆弾の爆発・設置をここで挟む */
  const afterCard = () => {
    applyAdds();
    st.gacha = [];
    st.cards++;
    if (!st.bombJust && st.bomb) {
      if (--st.bomb.left <= 0) {
        const b = st.bomb;
        st.bomb = null;
        st.bombJust = true;
        st.doer = b.owner;
        st.double = false;
        st.phase = 'play';
        st.card = {
          kind: '時限爆弾 ドカン！',
          bombCond: b.cond,
          bomb: true,
          alert: true,
          solo: false,
          segments: [
            { text: '仕掛け人' },
            { text: members[b.owner].name, hl: true, who: b.owner },
            { text: 'が発表！爆弾が仕掛けられてから' },
            { text: b.cond, hl: true },
            { text: '奴は全員罰。自首するか告発しろ' },
          ],
        };
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        rerender();
        return;
      }
    } else if (!st.bombJust && !st.noPlant && st.cards >= 2 && Math.random() < CHANCE.bomb) {
      const owner = Math.floor(Math.random() * n);
      st.bomb = { cond: decks.bomb(n), owner, left: 3 + Math.floor(Math.random() * 3) };
      st.bombJust = true;
      st.doer = owner;
      st.double = false;
      st.phase = 'bombSet';
      st.card = { kind: '時限爆弾セット', bomb: true, alert: true, segments: nameSeg(members[owner].name, 'だけ画面を見ろ。他の奴は目そらせ！', owner) };
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      rerender();
      return;
    }
    st.bombJust = false;
    onAdvance();
  };

  /** 罰が出たら罰ガチャ、なければ次へ */
  const finishCard = () => {
    if (st.card.solo) st.stats.solo[st.doer]++;
    // 「次の自分の番まで〜」のお題をやり切った（セーフ）なら、その人の次の番までルールとして上に出す
    const c = st.card;
    if (c.tpl && c.solo && !c.alert && PERSONAL.test(c.tpl) && !st.add.has(st.doer)) addRule({ segments: c.segments, left: untilNext(st.doer), who: st.doer, card: c });
    if (st.add.size) {
      st.gacha = [...st.add].map(([i, k]) => ({ i, n: k, ...decks.batsu(members, i, k) }));
      st.phase = 'batsu';
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      rerender();
    } else {
      afterCard();
    }
  };

  return {
    st,
    members,
    /** カードをそのまま出す（イベント・マスなど） */
    show(card: Card, doer: number) {
      st.doer = doer;
      st.double = false;
      st.phase = 'play';
      st.card = card;
      rerender();
    },
    /** お題カードを出す。たまに倍プッシュのチャンスを挟む */
    present(card: Card, doer: number, allowDouble: boolean) {
      st.doer = doer;
      st.double = false;
      if (allowDouble && card.solo && Math.random() < CHANCE.double) {
        st.pending = card;
        st.phase = 'offer';
        st.card = OFFER_CARD(members, doer);
      } else {
        st.phase = 'play';
        st.card = card;
      }
      rerender();
    },
    togglePen(i: number) {
      st.add.has(i) ? st.add.delete(i) : st.add.set(i, 1);
      if (st.add.has(i)) {
        play('warn');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      } else play('tick');
      rerender();
    },
    next: finishCard,
    /** やった！（罰なしで次へ） */
    clear() {
      st.add = new Map();
      finishCard();
    },
    /** できんかった（番の人に罰） */
    fail() {
      st.add = new Map([[st.doer, 1]]);
      finishCard();
    },
    /** ルール違反：お題の途中でもその場で罰ガチャ（天使なら帳消し） */
    rulePenalty(i: number): GachaItem {
      const item: GachaItem = { i, n: 1, ...decks.batsu(members, i) };
      if (item.lucky) st.stats.lucky[i]++;
      else {
        penaltyRule(i, item.segments);
        st.pen[i]++;
        st.rev[i] = true;
        st.stats.why[i].rule = (st.stats.why[i].rule ?? 0) + 1;
      }
      play(item.lucky ? 'lucky' : 'pop');
      Haptics.notificationAsync(item.lucky ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
      rerender();
      return item;
    },
    /** 他の人に罰をつけたい時だけ一覧を開く */
    openPen() {
      st.penOpenFor = st.card;
      rerender();
    },
    accept: afterCard,
    /** 夜お題の「無理」。罰なしで次へ */
    pass() {
      st.stats.pass[st.doer]++;
      st.add = new Map();
      afterCard();
    },
    /** 仕掛け人だけが中身を見る */
    peekBomb() {
      if (!st.bomb) return;
      st.phase = 'bombPeek';
      st.card = {
        kind: `${members[st.doer].name}だけ見てええ`,
        bomb: true,
        segments: [{ text: '今から' }, { text: st.bomb.cond, hl: true }, { text: '奴を、こっそり監視しろ。爆発したら発表してもらう' }],
      };
      rerender();
    },
    hideBomb() {
      st.bombJust = false;
      onAdvance();
    },
    stopPlanting() {
      st.noPlant = true;
    },
    chooseDouble(on: boolean) {
      st.double = on;
      if (on) st.stats.dbl[st.doer]++;
      st.card = st.pending ?? st.card;
      st.pending = null;
      st.phase = 'play';
      rerender();
    },
    doubleWin() {
      st.stats.dwin[st.doer]++;
      st.phase = 'push';
      rerender();
    },
    doubleLose() {
      st.addReason = 'double';
      addPen(st.doer, 2);
      finishCard();
    },
    pushTo(i: number) {
      st.stats.hit[i]++;
      st.addReason = 'push';
      addPen(i, 1);
      finishCard();
    },
    /** 当てはまらん → ランダムで別の人に回す（1枚につき1回、NGの人には夜お題を回さない） */
    notMe() {
      const c = st.card;
      const from = st.doer;
      const pool = othersOf(members, from).filter((j) => !c.yoru || !members[j].ng);
      if (!pool.length || !c.tpl) return;
      const to = pick(pool);
      st.stats.notme[from]++;
      st.doer = to;
      st.card = makeCard(`${c.kind.replace(/（.*）$/, '')}（${members[from].name}は当てはまらん）`, c.tpl, members, to, {
        noNg: c.noNg,
        yoru: c.yoru,
        shinya: c.shinya,
        passed: true,
      });
      rerender();
    },
    startRevenge() {
      st.phase = 'revenge';
      rerender();
    },
    cancelRevenge() {
      st.phase = 'play';
      rerender();
    },
    revengeTo(i: number) {
      const from = st.doer;
      const c = st.card;
      if (!c.tpl) return;
      st.rev[from] = false;
      st.stats.rev[from]++;
      st.stats.hit[i]++;
      st.doer = i;
      const base = c.kind.replace(/（.*押し付け）$/, '');
      st.card = makeCard(`${base}（${members[from].name}から押し付け）`, c.tpl, members, i, {
        noNg: c.noNg,
        yoru: c.yoru,
        shinya: c.shinya,
        alert: true,
      });
      st.phase = 'play';
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      rerender();
    },
    /** 緊急指令のルールを足す */
    addRule(r: Rule) {
      addRule(r);
      rerender();
    },
    /** 1ターン進んだ時。ルールの残りを減らす（画面側で今の番の人も入れる） */
    tickRules(nextCur: number) {
      st.rules = st.rules.map((r) => ({ ...r, left: r.left - 1 })).filter((r) => r.left > 0);
      st.cur = nextCur;
    },
    /** 結果発表用。保留中の罰も足して返す */
    finalPen: applyAdds,
  };
}

export type TurnFlow = ReturnType<typeof useTurnFlow>;
