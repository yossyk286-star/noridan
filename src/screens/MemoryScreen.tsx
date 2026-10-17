import { useRef, useState } from 'react';
import type React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Tap } from '../components/Tap';
import { BigButton, DeckStack, Frame, GachaCard, OdaiCard, RuleBanner, RuleSheet, RulesSheet, ScoreBar } from '../components/Stage';
import { ModeCard } from '../components/ModeParts';
import { Skull } from '../components/Fx';
import GameMenu from '../components/GameMenu';
import { Decks, PERSONAL, makeCard } from '../lib/game';
import { play } from '../lib/sound';
import { newStats, type Stats, type Why } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf } from '../theme';
import type { Card, GachaItem, Level, Member, Night, Rule, Segment } from '../types';

type Props = {
  members: Member[];
  level: Level;
  night: Night;
  onQuit: () => void;
  onSettings: () => void;
  onFinish: (pen: number[], turns: number, stats: Stats, words?: string[], scores?: number[]) => void;
};
type MCard = { id: number; ch: string; tpl?: string; yoru?: boolean; deep?: boolean; skull?: boolean; up: boolean; gone: boolean; owner: number | null };
type Phase = 'intro' | 'pick' | 'miss' | 'match' | 'skull' | 'fail' | 'over' | 'low' | 'end';
const PAIRS = 7;
const SKULLS = 2;

export const MEMORY_RULES: [string, string][] = [
  ['カード', '表にはお題に関係するマークだけ（📱ならスマホ系、💘なら恋愛系）。同じお題のカードが2枚ずつある'],
  ['自分の番', '2枚めくる。揃ったらお題の全文が出て、答えたら+1点でもう1回。答えられへんかったら罰ガチャで次の人へ'],
  ['ハズレ', '揃わへんかったら裏に戻して次の人へ。場所を覚えとけ'],
  ['ドクロ', 'めくった瞬間に罰ガチャ。天使が出たら続けてめくれる'],
  ['終わり', '全部揃ったら、点数が一番低い人が罰ガチャ（同点なら全員）'],
  ['続く罰', '「次の自分の番まで〜」の罰やお題は上に出る。破ったら「違反者に罰」'],
];

const shuffle = <T,>(a: T[]): T[] => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const plain = (segs: Segment[]) => segs.map((x) => x.text).join('');

/** 神経衰弱：お題のマークが描いたカードを揃えて、答えたら+1点。最後に点数が一番低い人が罰 */
export default function MemoryScreen({ members, level, night, onQuit, onSettings, onFinish }: Props) {
  useKeepAwake();
  const pal = STAGE[level];
  const n = members.length;
  const decks = useRef(new Decks()).current;
  decks.night = night;
  decks.level = level;
  const deal = (): MCard[] => {
    const pairs = decks.memoryPairs(level, night, members, PAIRS);
    const cs: MCard[] = [];
    pairs.forEach((p, id) => {
      for (let k = 0; k < 2; k++) cs.push({ id, ch: p.ch, tpl: p.tpl, yoru: p.yoru, deep: p.deep, up: false, gone: false, owner: null });
    });
    for (let k = 0; k < SKULLS; k++) cs.push({ id: -1 - k, ch: '', skull: true, up: false, gone: false, owner: null });
    return shuffle(cs);
  };
  const [cards, setCards] = useState<MCard[]>(deal);
  const pairCount = cards.filter((c) => !c.skull).length / 2;
  const [phase, setPhase] = useState<Phase>('intro');
  const [cur, setCur] = useState(0);
  const [open, setOpen] = useState<number[]>([]);
  const [score, setScore] = useState<number[]>(() => Array(n).fill(0));
  const [pen, setPen] = useState<number[]>(() => Array(n).fill(0));
  const [done, setDone] = useState(0);
  const [card, setCard] = useState<Card | null>(null);
  const [gacha, setGacha] = useState<GachaItem[]>([]);
  const [why, setWhy] = useState<Why>('mfail');
  const [rules, setRules] = useState<Rule[]>([]);
  const [rule, setRule] = useState<Rule | null>(null);
  const [ruleSheet, setRuleSheet] = useState<'pick' | GachaItem | null>(null);
  const stats = useRef<Stats>(newStats(n)).current;
  const [menu, setMenu] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);

  /** その人の次の番が終わるまで何ターンあるか */
  const untilNext = (i: number) => (((i - cur + n) % n) || n) + 1;
  const addRule = (r: Rule) => {
    const segments = r.segments.map((x) => (x.hl ? x : { ...x, text: x.text.replace(/次の(自分の)?番まで[、,]?/, '') }));
    setRules((rs) => [...rs.filter((x) => plain(x.segments) !== plain(segments)), { ...r, segments }].slice(-4));
  };
  const penaltyRule = (i: number, segs: Segment[]) => {
    if (PERSONAL.test(plain(segs))) addRule({ segments: [{ text: members[i].name, hl: true, who: i }, { text: 'の罰：' }, ...segs], left: untilNext(i), who: i });
  };
  const nextPlayer = () => {
    setRules((rs) => rs.map((r) => ({ ...r, left: r.left - 1 })).filter((r) => r.left > 0));
    setCur((c) => (c + 1) % n);
    setOpen([]);
    setPhase('pick');
  };
  const startGacha = (who: number[], w: Why, ph: Phase) => {
    const items = who.map((i) => ({ i, n: 1, ...decks.batsu(members, i) }));
    setGacha(items);
    setWhy(w);
    setPhase(ph);
    play(items.every((x) => x.lucky) ? 'lucky' : 'pop');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  };
  const flip = (k: number) => {
    const c = cards[k];
    if (phase !== 'pick' || c.up || c.gone) return;
    const cs = cards.slice();
    cs[k] = { ...c, up: true };
    if (c.skull) {
      // ドクロ：その場で罰ガチャ。開いてた1枚目は裏に戻す
      cs[k] = { ...cs[k], gone: true };
      open.forEach((x) => (cs[x] = { ...cs[x], up: false }));
      setCards(cs);
      setOpen([]);
      play('boom');
      startGacha([cur], 'skull', 'skull');
      return;
    }
    const op = [...open, k];
    setCards(cs);
    setOpen(op);
    if (op.length < 2) {
      play('tick');
      return;
    }
    const [a, b] = op.map((x) => cs[x]);
    if (a.id === b.id) {
      setCard(makeCard(a.deep ? '深夜お題' : a.yoru ? '夜お題' : `アホお題・${LEVEL_LABEL[level]}`, a.tpl!, members, cur, { noNg: a.yoru, yoru: a.yoru }));
      setPhase('match');
      play('coin');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      setPhase('miss');
      play('warn');
    }
  };
  const answer = (ok: boolean) => {
    const cs = cards.map((c, i) => (open.includes(i) ? { ...c, gone: true, owner: ok ? cur : -1 } : c));
    setCards(cs);
    const d = done + 1;
    setDone(d);
    setOpen([]);
    if (ok) {
      setScore((s) => s.map((v, i) => (i === cur ? v + 1 : v)));
      if (card?.tpl && PERSONAL.test(card.tpl)) addRule({ segments: card.segments, left: untilNext(cur), who: cur });
      setCard(null);
      setPhase(d >= pairCount ? 'over' : 'pick');
    } else startGacha([cur], 'mfail', 'fail');
  };
  const accept = () => {
    const lucky = gacha.every((x) => x.lucky);
    const np = pen.slice();
    gacha.forEach((x) => {
      if (x.lucky) stats.lucky[x.i]++;
      else {
        np[x.i] += x.n;
        stats.why[x.i][why] = (stats.why[x.i][why] ?? 0) + x.n;
        penaltyRule(x.i, x.segments);
      }
    });
    setPen(np);
    setGacha([]);
    if (phase === 'low') return setPhase('end');
    if (done >= pairCount) return setPhase('over');
    if (phase === 'skull' && lucky) return setPhase('pick'); // 天使なら続けてめくれる
    nextPlayer();
  };
  const lowest = () => {
    const m = Math.min(...score);
    return score.map((v, i) => (v === m ? i : -1)).filter((i) => i >= 0);
  };
  const finish = () => onFinish(pen, done, stats, undefined, score);
  const rulePenalty = (i: number): GachaItem => {
    const item: GachaItem = { i, n: 1, ...decks.batsu(members, i) };
    if (item.lucky) stats.lucky[i]++;
    else {
      setPen((p) => p.map((v, j) => (j === i ? v + 1 : v)));
      stats.why[i].rule = (stats.why[i].rule ?? 0) + 1;
      penaltyRule(i, item.segments);
    }
    play(item.lucky ? 'lucky' : 'pop');
    return item;
  };

  const fg = pal.fg;
  let body: React.ReactNode;
  let controls: React.ReactNode = null;
  if (phase === 'intro') {
    body = (
      <ModeCard pal={pal}>
        <Text style={[s.title, { color: pal.cardFg }]}>神経衰弱</Text>
        <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
          <Text style={[s.how, { color: pal.cardFg }]}>1. カードにはお題に関係するマークだけ（📱ならスマホ系、💘なら恋愛系）。同じお題の2枚を揃えろ</Text>
          <Text style={[s.how, { color: pal.cardFg }]}>2. 揃ったらお題の全文が出る。答えたら+1点でもう1回、答えられへんかったら罰ガチャで次の人へ</Text>
          <Text style={[s.how, { color: pal.cardFg }]}>3. ドクロはめくった瞬間に罰ガチャ。天使が出たら続けてめくれる</Text>
          <Text style={[s.how, { color: pal.cardFg }]}>4. 全部揃ったら、点数が一番低い人が罰</Text>
          <View style={[s.lvBox, { backgroundColor: alpha(pal.cardEdge, 0.16) }]}>
            <Text style={[s.lvText, { color: pal.cardFg }]}>地獄度「{LEVEL_LABEL[level]}」のお題で遊ぶ</Text>
            {!!night && <Text style={[s.small, { color: pal.cardFg }]}>{night === 'shinya' ? '深夜' : '夜'}モードのお題も混ざる{members.some((m) => m.ng) ? '（下ネタNGの人がおるので今回は混ぜへん）' : ''}</Text>}
          </View>
        </View>
      </ModeCard>
    );
    controls = <BigButton pal={pal} label={`${members[0].name}からスタート`} onPress={() => setPhase('pick')} />;
  } else if (phase === 'over' || phase === 'low' || phase === 'end') {
    const low = lowest();
    const rows = members.map((m, i) => ({ m, i, v: score[i] })).sort((a, b) => b.v - a.v);
    body = (
      <ModeCard pal={pal}>
        <Text style={[s.title, { color: pal.cardFg }]}>全部揃った！</Text>
        <View style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
          {rows.map((r) => (
            <View key={r.i} style={[s.row, { borderLeftColor: colorOf(r.i), backgroundColor: alpha('#888888', 0.12) }]}>
              <Text style={[s.rowName, { color: low.includes(r.i) ? '#ff3b3b' : pal.cardFg }]} numberOfLines={1}>{r.m.name}{low.includes(r.i) ? '　罰' : ''}</Text>
              <Text style={[s.rowV, { color: pal.cardFg }]}>{r.v}点</Text>
            </View>
          ))}
        </View>
        <Text style={[s.small, { color: pal.cardFg }]}>点数が一番低い人が罰</Text>
      </ModeCard>
    );
    controls = phase === 'end' ? <BigButton pal={pal} label="結果発表" onPress={finish} /> : <BigButton pal={pal} danger label={`${low.map((i) => members[i].name).join('・')}に罰ガチャ`} onPress={() => startGacha(low, 'mlow', 'low')} />;
  } else {
    body = (
      <View style={s.grid}>
        {cards.map((c, k) => (
          <View key={k} style={s.cell}>
            {c.gone ? (
              <View style={[s.mc, s.gone, { borderColor: alpha('#f7f3ea', 0.15) }]}>{c.owner != null && c.owner >= 0 && <View style={[s.ownerDot, { backgroundColor: colorOf(c.owner) }]} />}</View>
            ) : c.up ? (
              <View style={[s.mc, { backgroundColor: c.skull ? '#1a0606' : c.yoru ? '#1c1328' : pal.cardBg, borderColor: c.skull ? '#e8202a' : c.yoru ? C.night : colorOf(cur), borderWidth: 3 }]}>
                {c.skull ? <View style={{ transform: [{ scale: 0.55 }] }}><Skull /></View> : <Text style={[s.ch, { color: c.yoru ? '#f1e8ff' : pal.cardFg }]}>{c.ch}</Text>}
              </View>
            ) : (
              <Tap onPress={() => flip(k)} disabled={phase !== 'pick'} style={({ pressed }) => [s.mc, s.down, { backgroundColor: pal.cardEdge, transform: [{ translateY: pressed ? 3 : 0 }] }]}>
                <Text style={s.q}>?</Text>
              </Tap>
            )}
          </View>
        ))}
      </View>
    );
    controls =
      phase === 'miss' ? (
        <BigButton
          pal={pal}
          label={`覚えた → ${members[(cur + 1) % n].name}の番`}
          onPress={() => {
            setCards((cs) => cs.map((c) => (c.gone ? c : { ...c, up: false })));
            nextPlayer();
          }}
        />
      ) : (
        <Text style={[s.foot, { color: pal.muted }]}>{done} / {pairCount} ペア揃った</Text>
      );
  }

  const sheet = phase === 'match' || phase === 'fail' || phase === 'skull' || phase === 'low';
  const lucky = gacha.every((x) => x.lucky);
  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <View style={[s.wrap, flipped && { transform: [{ rotate: '180deg' }] }]}>
        <ScoreBar pal={pal} members={members} pen={pen} rev={Array(n).fill(false)} doer={phase === 'intro' ? -1 : cur} onMenu={() => setMenu(true)} />
        <RuleBanner pal={pal} members={members} rules={rules} onViolate={(r) => { setRule(r); setRuleSheet('pick'); }} />
        {phase !== 'intro' && (
          <View style={{ gap: 8 }}>
            <View style={s.info}>
              <Text style={[s.who, { color: fg }]} numberOfLines={1}>
                <Text style={{ color: colorOf(cur) }}>● </Text>
                {members[cur].name}
                <Text style={s.whoSub}> の番</Text>
              </Text>
              <Text style={[s.hint, { color: pal.muted }]}>{phase === 'pick' ? (open.length ? 'もう1枚めくれ' : '2枚めくれ') : phase === 'miss' ? 'ハズレ…場所を覚えとけ' : ''}</Text>
            </View>
            <View style={s.scores}>
              {members.map((m, i) => (
                <View key={i} style={[s.sc, { backgroundColor: pal.chip, borderColor: i === cur ? colorOf(i) : 'transparent' }]}>
                  <View style={[s.scDot, { backgroundColor: colorOf(i) }]} />
                  <Text style={[s.scText, { color: fg }]}>{m.name}</Text>
                  <Text style={[s.scV, { color: fg }]}>{score[i]}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        <View style={{ flex: 1 }}>{body}</View>
        {controls}
      </View>
      <Frame color={phase === 'intro' ? C.muted : colorOf(cur)} />
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => {}}>
        <View style={s.sheetBack}>
          <View style={[s.sheet, { backgroundColor: pal.bg, borderColor: colorOf(cur) }, flipped && { transform: [{ rotate: '180deg' }] }]}>
            {phase === 'match' && card ? (
              <>
                <DeckStack pal={pal} minHeight={230}>
                  <OdaiCard pal={pal} card={card} small who={{ name: members[cur].name, color: colorOf(cur), label: 'の番' }} />
                </DeckStack>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}><BigButton pal={pal} danger label="答えられへん" onPress={() => answer(false)} /></View>
                  <View style={{ flex: 1 }}><BigButton pal={pal} label="答えた！+1点" onPress={() => answer(true)} /></View>
                </View>
              </>
            ) : gacha.length ? (
              <>
                {phase === 'skull' && <Text style={[s.skullHead, { color: '#ff3b3b' }]}>ドクロをめくった！</Text>}
                <DeckStack pal={pal} minHeight={230}>
                  <GachaCard pal={pal} members={members} items={gacha} />
                </DeckStack>
                <BigButton
                  pal={pal}
                  label={`${lucky ? 'ラッキー！' : '受け入れた'} → ${phase === 'low' ? '結果発表へ' : phase === 'skull' && lucky ? '続けてめくる' : done >= pairCount ? '点数発表へ' : `${members[(cur + 1) % n].name}の番へ`}`}
                  onPress={accept}
                />
              </>
            ) : null}
          </View>
        </View>
      </Modal>
      <RuleSheet members={members} rule={rule} state={ruleSheet} onPick={(i) => setRuleSheet(rulePenalty(i))} onClose={() => setRuleSheet(null)} />
      <RulesSheet visible={rulesOpen} custom={MEMORY_RULES} onClose={() => setRulesOpen(false)} />
      <GameMenu
        visible={menu}
        meta={`神経衰弱・${LEVEL_LABEL[level]}・${done}ペア`}
        rulesSub="このモードの遊び方"
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
        onRules={() => setRulesOpen(true)}
        onEnd={finish}
        onSettings={onSettings}
        onQuit={onQuit}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { fontFamily: F.display, fontSize: 24 },
  how: { fontSize: 16, fontWeight: '700', lineHeight: 24 },
  small: { fontSize: 12, fontWeight: '700', opacity: 0.7, lineHeight: 18 },
  lvBox: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
  lvText: { fontSize: 14, fontWeight: '900' },
  info: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  who: { fontFamily: F.display, fontSize: 22, flexShrink: 1 },
  whoSub: { fontFamily: undefined, fontSize: 13, fontWeight: '900' },
  hint: { fontSize: 14, fontWeight: '900' },
  scores: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sc: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1.5 },
  scDot: { width: 9, height: 9, borderRadius: 5 },
  scText: { fontSize: 13, fontWeight: '900' },
  scV: { fontFamily: F.display, fontSize: 15 },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'stretch' },
  cell: { width: '25%', height: '25%', padding: 4 },
  mc: { flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  down: { borderWidth: 3, borderColor: 'rgba(0,0,0,0.18)' },
  q: { fontFamily: F.display, fontSize: 26, color: 'rgba(0,0,0,0.35)' },
  ch: { fontSize: 44 },
  gone: { borderWidth: 1.5, borderStyle: 'dashed' },
  ownerDot: { width: 14, height: 14, borderRadius: 7, opacity: 0.7 },
  foot: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderLeftWidth: 6 },
  rowName: { fontWeight: '900', fontSize: 16, flexShrink: 1 },
  rowV: { fontFamily: F.display, fontSize: 22 },
  sheetBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 34, gap: 12, borderWidth: 4, borderBottomWidth: 0, width: '100%', maxWidth: 560, alignSelf: 'center' },
  skullHead: { fontFamily: F.display, fontSize: 22, textAlign: 'center' },
});
