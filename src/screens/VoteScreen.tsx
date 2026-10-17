import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, Frame, GachaCard, RulesSheet, ScoreBar, DeckStack } from '../components/Stage';
import { HandWho, Lead, ModeCard, NameTiles, Note, Outline, Prog } from '../components/ModeParts';
import GameMenu from '../components/GameMenu';
import { Decks } from '../lib/game';
import { play } from '../lib/sound';
import { usePrefs } from '../lib/prefs';
import { speak } from '../lib/speech';
import { newStats, type Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf, neonPal } from '../theme';
import type { GachaItem, Level, Member, Night } from '../types';

type Props = {
  members: Member[];
  level: Level;
  night: Night;
  onQuit: () => void;
  onSettings: () => void;
  onFinish: (pen: number[], turns: number, stats: Stats) => void;
};
type Phase = 'q' | 'hand' | 'vote' | 'done' | 'reveal' | 'batsu';
type Round = { q: string; good: boolean; night: 'yoru' | 'shinya' | false; cands: number[]; order: number[]; votes: (number | null)[]; no: number };

export const VOTE_RULES: [string, string][] = [
  ['質問', '「この中で一番○○なのは？」が出る。地獄度で質問の攻め具合が変わる'],
  ['投票', 'スマホを回して、1人ずつ自分以外の誰かにこっそり1票。誰が誰に入れたかは出えへん'],
  ['結果', 'イジる系の質問は票が一番多い人、褒める系の質問は一番少ない人が罰ガチャ。同票なら全員'],
  ['夜モード', '夜・深夜は下ネタの質問も出る。下ネタNGの人は候補に出えへん'],
];

/** ぶっちゃけ投票：「この中で一番○○なのは？」に全員がこっそり投票。一番票を集めた人が罰 */
export default function VoteScreen({ members, level, night, onQuit, onSettings, onFinish }: Props) {
  useKeepAwake();
  const n = members.length;
  const decks = useRef(new Decks()).current;
  decks.night = night;
  decks.level = level;
  const { voice } = usePrefs();
  const newRound = (no: number): Round => {
    const v = decks.vote(level, night, members);
    const s0 = (no - 1) % n;
    return { ...v, no, order: members.map((_, k) => (s0 + k) % n), votes: Array(n).fill(null) };
  };
  const [round, setRound] = useState<Round>(() => newRound(1));
  const [phase, setPhase] = useState<Phase>('q');
  const [k, setK] = useState(0);
  const [pen, setPen] = useState<number[]>(() => Array(n).fill(0));
  const [done, setDone] = useState(0); // 結果まで行った問題の数
  const [gacha, setGacha] = useState<GachaItem[]>([]);
  const stats = useRef<Stats>(newStats(n)).current;
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (phase === 'q' && voice) speak(round.q);
  }, [round, phase]);

  const counts = Array(n).fill(0) as number[];
  round.votes.forEach((t) => t != null && counts[t]++);
  const max = Math.max(...counts);
  const cv = round.cands.map((i) => counts[i]);
  const goal = round.good ? Math.min(...cv) : Math.max(...cv);
  const top = round.cands.filter((i) => counts[i] === goal);
  const ruleTag = (
    <Text style={[s.rule, round.good ? s.ruleGood : s.ruleBad]}>
      {round.good ? '褒める系：票が一番少ない人が罰' : 'イジる系：票が一番多い人が罰'}
    </Text>
  );
  const voter = round.order[k];

  const nextRound = (skip = false) => {
    setRound(newRound(skip ? round.no : round.no + 1));
    setK(0);
    setGacha([]);
    setPhase('q');
  };
  const vote = (i: number) => {
    const votes = round.votes.slice();
    votes[voter] = i;
    setRound({ ...round, votes });
    play('tick');
    Haptics.selectionAsync().catch(() => {});
    if (k + 1 < n) {
      setK(k + 1);
      setPhase('hand');
    } else setPhase('done');
  };
  const reveal = () => {
    counts.forEach((v, i) => (stats.votes![i] += v));
    setDone(done + 1);
    setPhase('reveal');
    play('fanfare');
  };
  const doGacha = () => {
    const items = top.map((i) => ({ i, n: 1, ...decks.batsu(members, i) }));
    setGacha(items);
    setPhase('batsu');
    play(items.every((x) => x.lucky) ? 'lucky' : 'pop');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };
  const accept = () => {
    const np = pen.slice();
    gacha.forEach((x) => {
      if (x.lucky) stats.lucky[x.i]++;
      else {
        np[x.i] += x.n;
        stats.why[x.i].vote = (stats.why[x.i].vote || 0) + x.n;
      }
    });
    setPen(np);
    nextRound();
  };
  const finish = () => onFinish(pen, done, stats);

  const pal = round.night && phase !== 'batsu' ? neonPal(round.night === 'shinya' ? C.deep : C.night) : STAGE[level];
  const fg = pal.cardFg;
  const frame = phase === 'hand' || phase === 'vote' ? colorOf(voter) : C.muted;
  const head = (
    <View style={s.head}>
      <Text style={[s.no, { color: fg }]}>第{round.no}問</Text>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        {!!round.night && <Text style={[s.kind, { color: fg }]}>{round.night === 'shinya' ? '深夜' : '夜'}の質問</Text>}
        <Text style={[s.tag, { color: fg, borderColor: alpha('#888888', 0.5) }]}>投票</Text>
      </View>
    </View>
  );

  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'q':
      card = (
        <ModeCard pal={pal}>
          {head}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={[s.qBig, { color: fg }]} adjustsFontSizeToFit>{round.q}</Text>
          </View>
          {ruleTag}
          <Text style={[s.small, { color: fg }]}>自分以外の誰かに、こっそり1票{round.night ? '（下ネタNGの人は候補に出えへん）' : ''}</Text>
        </ModeCard>
      );
      controls = (
        <View style={{ gap: 8 }}>
          <BigButton pal={pal} label="投票スタート" onPress={() => setPhase('hand')} />
          <Outline label="この質問はパス" fg={pal.fg} onPress={() => nextRound(true)} style={{ flex: 0 }} />
        </View>
      );
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`投票 ${k + 1} / ${n}`}</Prog>
          <HandWho members={members} i={voter} sub="の番" fg={fg} />
          <Note fg={fg}>{`スマホを${members[voter].name}に渡して。\n他の人は画面を見たらアカン`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`${members[voter].name}です。投票する`} onPress={() => setPhase('vote')} />;
      break;
    case 'vote':
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.voter, { color: fg }]}>{members[voter].name}<Text style={s.voterSub}> の投票</Text></Text>
          <Text style={[s.qSmall, { color: fg }]}>{round.q}</Text>
          <View style={{ flex: 1 }} />
          <NameTiles members={members} list={round.cands.filter((i) => i !== voter)} fg={fg} cols={2} onPress={vote} />
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>押したらすぐ次の人へ。誰に入れたかは出えへん</Text>;
      break;
    case 'done':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{round.q}</Prog>
          <Lead fg={fg}>全員投票した！</Lead>
          <Note fg={fg}>スマホをみんなが見える所に置いて</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="結果発表" onPress={reveal} />;
      break;
    case 'reveal': {
      const rows = round.cands.map((i) => ({ i, v: counts[i] })).sort((a, b) => b.v - a.v);
      card = (
        <ModeCard pal={pal}>
          {head}
          <Text style={[s.qSmall, { color: fg }]}>{round.q}</Text>
          {ruleTag}
          <View style={{ flex: 1 }} />
          <View style={{ gap: 8 }}>
            {rows.map((r, j) => (
              <Bar key={r.i} name={members[r.i].name} color={colorOf(r.i)} v={r.v} max={max} top={top.includes(r.i)} fg={fg} delay={150 + (rows.length - j) * 120} />
            ))}
          </View>
        </ModeCard>
      );
      controls = <BigButton pal={pal} danger label={`${top.map((i) => members[i].name).join('・')}に罰ガチャ`} onPress={doGacha} />;
      break;
    }
    case 'batsu':
      card = (
        <DeckStack pal={pal} minHeight={0}>
          <GachaCard pal={pal} members={members} items={gacha} />
        </DeckStack>
      );
      controls = <BigButton pal={pal} label={`${gacha.every((x) => x.lucky) ? 'ラッキー！' : '受け入れた'} → 次の質問`} onPress={accept} />;
      break;
  }

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <View style={[s.wrap, flipped && { transform: [{ rotate: '180deg' }] }]}>
        <ScoreBar pal={pal} members={members} pen={pen} rev={Array(n).fill(false)} doer={-1} onMenu={() => setMenu(true)} />
        <View style={{ flex: 1 }}>{card}</View>
        {controls}
      </View>
      <Frame color={frame} />
      <RulesSheet visible={rules} custom={VOTE_RULES} onClose={() => setRules(false)} />
      <GameMenu
        visible={menu}
        meta={`ぶっちゃけ投票・${LEVEL_LABEL[level]}・${done}問`}
        rulesSub="このモードの遊び方"
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
        onRules={() => setRules(true)}
        onEnd={finish}
        onSettings={onSettings}
        onQuit={onQuit}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}

/** 票数のバー（下の人から順に伸びる） */
function Bar({ name, color, v, max, top, fg, delay }: { name: string; color: string; v: number; max: number; top: boolean; fg: string; delay: number }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: max ? v / max : 0, duration: 700, delay, easing: Easing.out(Easing.back(1.2)), useNativeDriver: false }).start();
  }, []);
  return (
    <View style={s.barRow}>
      <Text style={[s.barName, { color: top ? '#ff3b3b' : fg }]} numberOfLines={1}>{name}</Text>
      <View style={[s.barTrack, { backgroundColor: alpha('#888888', 0.18) }]}>
        <Animated.View style={[s.barFill, { backgroundColor: color, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
      <Text style={[s.barV, { color: fg }]}>{v}</Text>
      {top && <Text style={s.stamp}>罰</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  no: { fontFamily: F.display, fontSize: 22 },
  kind: { fontSize: 12, fontWeight: '900', opacity: 0.8 },
  tag: { fontSize: 11, fontWeight: '900', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  qBig: { fontFamily: F.display, fontSize: 36, lineHeight: 50 },
  qSmall: { fontFamily: F.display, fontSize: 21, lineHeight: 30 },
  small: { fontSize: 12, fontWeight: '700', opacity: 0.65, lineHeight: 18 },
  voter: { fontFamily: F.display, fontSize: 22 },
  voterSub: { fontFamily: undefined, fontSize: 13, fontWeight: '900' },
  rule: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, fontSize: 13, fontWeight: '900', overflow: 'hidden' },
  ruleBad: { backgroundColor: 'rgba(255,59,59,0.14)', color: '#ff3b3b' },
  ruleGood: { backgroundColor: 'rgba(60,180,110,0.18)', color: '#2fbf6f' },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barName: { width: 96, fontWeight: '900', fontSize: 15 },
  barTrack: { flex: 1, height: 18, borderRadius: 9, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 9 },
  barV: { width: 28, textAlign: 'right', fontFamily: F.display, fontSize: 22 },
  stamp: { position: 'absolute', right: 40, width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: '#ff3b3b', color: '#ff3b3b', textAlign: 'center', lineHeight: 25, fontFamily: F.display, fontSize: 14, transform: [{ rotate: '-14deg' }] },
});
