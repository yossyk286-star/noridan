import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { HurryFrame } from '../components/Fx';
import { useHurry } from '../lib/useHurry';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, Frame, GachaCard, RulesSheet, ScoreBar, DeckStack } from '../components/Stage';
import { HandWho, IntroCard, Lead, LevelBox, ModeCard, NameTiles, Note, Outline, Prog, Peek } from '../components/ModeParts';
import { Angel, GACHA_MS, GachaMachine, Skull } from '../components/Fx';
import { Tap } from '../components/Tap';
import { HELP } from '../lib/help';
import GameMenu from '../components/GameMenu';
import { Decks } from '../lib/game';
import { play } from '../lib/sound';
import { load, save } from '../lib/storage';
import { useCountdown } from '../lib/useCountdown';
import { useVoteCount } from '../lib/useVoteCount';
import { newStats, type Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf, neonPal } from '../theme';
import type { GachaItem, Level, Member, Night, Segment } from '../types';

type Props = {
  members: Member[];
  level: Level;
  night: Night;
  onQuit: () => void;
  onSettings: () => void;
  onFinish: (pen: number[], turns: number, stats: Stats) => void;
};
type Phase = 'intro' | 'hand' | 'look' | 'talk' | 'who' | 'vhand' | 'vote' | 'done' | 'reveal' | 'guess' | 'result' | 'group' | 'batsu';
type Round = { no: number; maj: string; min: string; night: 'yoru' | 'shinya' | false; wolf: number; order: number[]; votes: (number | null)[] };

const MINUTES = [2, 3, 5];
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/**
 * ワードウルフ：全員にお題。1人（少数派）だけちょっと違うお題で、自分がどっちかは分からへん。
 * 話して投票、少数派が一番票を集めたら少数派の負け（多数派のお題を当てたら逆転）。外したら・同票なら多数派全員の負け
 */
export default function WolfScreen({ members, level, night, onQuit, onSettings, onFinish }: Props) {
  useKeepAwake();
  const n = members.length;
  const decks = useRef(new Decks()).current;
  decks.night = night;
  decks.level = level;
  const newRound = (no: number): Round => {
    const w = decks.wolf(level, night, members);
    const s0 = (no - 1) % n;
    return { ...w, no, wolf: Math.floor(Math.random() * n), order: members.map((_, k) => (s0 + k) % n), votes: Array(n).fill(null) };
  };
  const [round, setRound] = useState<Round>(() => newRound(1));
  const [phase, setPhase] = useState<Phase>('intro');
  const [minutes, setMinutes] = useState(3);
  const [dealt, setDealt] = useState(0); // 何人目に配ってるか
  const [dealing, setDealing] = useState(true);
  const [viewer, setViewer] = useState(0);
  const [k, setK] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const [guessed, setGuessed] = useState<boolean | null>(null);
  const [pen, setPen] = useState<number[]>(() => Array(n).fill(0));
  const [played, setPlayed] = useState(0);
  const [gacha, setGacha] = useState<GachaItem[]>([]);
  const [group, setGroup] = useState<{ segments: Segment[]; lucky: boolean } | null>(null);
  const [groupRoll, setGroupRoll] = useState(false); // 多数派全員の罰もマシンが回ってから出す
  const stats = useRef<Stats>(newStats(n)).current;
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const clock = useCountdown(() => {
    setTimeUp(true);
    play('alarm');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  });
  const talkRunning = useRef(false);
  const hurry = useHurry(clock.left, talkRunning.current && !timeUp && ['talk', 'who', 'hand', 'look'].includes(phase));
  const talkStarted = useRef(false);

  useEffect(() => {
    load('nd_wf_min', 3).then((m) => MINUTES.includes(m) && setMinutes(m));
  }, []);

  const word = (i: number) => (i === round.wolf ? round.min : round.maj);
  const counts = Array(n).fill(0) as number[];
  round.votes.forEach((t) => t != null && counts[t]++);
  const max = Math.max(...counts);
  const top = counts.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0);
  const caught = top.length === 1 && top[0] === round.wolf;
  const losers = caught && !guessed ? [round.wolf] : members.map((_, i) => i).filter((i) => i !== round.wolf);
  const voter = round.order[k];
  const tally = useVoteCount(counts, phase === 'reveal');

  const startRound = (no: number) => {
    const r = newRound(no);
    setRound(r);
    setDealt(0);
    setViewer(r.order[0]);
    setDealing(true);
    setK(0);
    setTimeUp(false);
    setGuessed(null);
    setGacha([]);
    setGroup(null);
    talkStarted.current = false;
    talkRunning.current = false;
    clock.stop();
    setPhase('hand');
  };
  const toTalk = () => {
    setDealing(false);
    setPhase('talk');
    if (!talkStarted.current) {
      talkStarted.current = true;
      clock.start(minutes * 60);
      talkRunning.current = true;
    }
  };
  const afterLook = () => {
    if (dealing && dealt + 1 < n) {
      setDealt(dealt + 1);
      setViewer(round.order[dealt + 1]);
      setPhase('hand');
    } else toTalk();
  };
  const vote = (i: number) => {
    const votes = round.votes.slice();
    votes[voter] = i;
    setRound({ ...round, votes });
    play('tick');
    Haptics.selectionAsync().catch(() => {});
    if (k + 1 < n) {
      setK(k + 1);
      setPhase('vhand');
    } else setPhase('done');
  };
  const reveal = () => {
    setPlayed(played + 1);
    setPhase('reveal');
  };
  const doGacha = () => {
    if (!caught) stats.wolf![round.wolf]++;
    if (losers.length === 1) {
      const items = losers.map((i) => ({ i, n: 1, ...decks.batsu(members, i) }));
      setGacha(items);
      setPhase('batsu');
      play(items.every((x) => x.lucky) ? 'gachaLucky' : 'gacha');
    } else {
      const g = decks.groupBatsu(members);
      setGroup(g);
      setGroupRoll(true);
      setTimeout(() => setGroupRoll(false), GACHA_MS);
      setPhase('group');
      play(g.lucky ? 'gachaLucky' : 'gacha');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };
  const accept = () => {
    const np = pen.slice();
    const add = (i: number, lucky: boolean) => {
      if (lucky) stats.lucky[i]++;
      else {
        np[i] += 1;
        stats.why[i].wolf = (stats.why[i].wolf || 0) + 1;
      }
    };
    if (group) losers.forEach((i) => add(i, group.lucky));
    else gacha.forEach((x) => add(x.i, !!x.lucky));
    setPen(np);
    startRound(round.no + 1);
  };
  const finish = () => {
    clock.stop();
    onFinish(pen, played, stats);
  };

  const pal = round.night && phase !== 'batsu' && phase !== 'group' && phase !== 'intro' ? neonPal(round.night === 'shinya' ? C.deep : C.night) : STAGE[level];
  const fg = pal.cardFg;
  const frame = phase === 'hand' || phase === 'look' ? colorOf(viewer) : phase === 'vhand' || phase === 'vote' ? colorOf(voter) : phase === 'guess' ? colorOf(round.wolf) : C.muted;
  const words = (showMaj: boolean) => (
    <View style={s.words}>
      <View style={[s.wordBox, { backgroundColor: alpha('#888888', 0.12) }]}>
        <Text style={[s.wordLab, { color: fg }]}>少数派</Text>
        <Text style={[s.wordText, { color: fg }]}>{round.min}</Text>
        <View style={s.wordWho}>
          <View style={[s.dot, { backgroundColor: colorOf(round.wolf) }]} />
          <Text style={[s.wordLab, { color: fg }]} numberOfLines={1}>{members[round.wolf].name}</Text>
        </View>
      </View>
      <View style={[s.wordBox, { backgroundColor: alpha('#888888', 0.12) }]}>
        <Text style={[s.wordLab, { color: fg }]}>多数派</Text>
        <Text style={[s.wordText, { color: fg }]}>{showMaj ? round.maj : '？？？'}</Text>
        <Text style={[s.wordLab, { color: fg }]}>ほか{n - 1}人</Text>
      </View>
    </View>
  );

  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="wolf" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」`} note={night ? `${night === 'shinya' ? '深夜' : '夜'}モードのお題も出る${members.some((m) => m.ng) ? '（下ネタNGの人がおるので今回は混ぜへん）' : ''}` : undefined} />
          <Text style={[s.small, { color: fg, fontWeight: '900' }]}>話し合いの時間</Text>
          <View style={s.mins}>
            {MINUTES.map((m) => {
              const on = minutes === m;
              return (
                <Tap key={m} onPress={() => { setMinutes(m); save('nd_wf_min', m); }} style={[s.min, { borderColor: alpha('#141210', 0.25) }, on && { backgroundColor: fg, borderColor: fg }]}>
                  <Text style={[s.minText, { color: on ? pal.cardBg : fg }]}>{m}分</Text>
                </Tap>
              );
            })}
          </View>
        </IntroCard>
      );
      controls = <BigButton pal={pal} label="お題を配る" onPress={() => startRound(1)} />;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{dealing ? `お題配り ${dealt + 1} / ${n}` : 'お題の見直し'}</Prog>
          <HandWho members={members} i={viewer} sub="だけ見て" fg={fg} />
          <Note fg={fg}>{`スマホを${members[viewer].name}に渡して。\n他の人は画面を見たらアカン`}</Note>
        </ModeCard>
      );
      controls = (
        <View style={{ gap: 8 }}>
          <BigButton pal={pal} label={`${members[viewer].name}が見る`} onPress={() => setPhase('look')} />
          {!dealing && <Outline label="やっぱやめる" fg={pal.fg} onPress={() => setPhase('talk')} style={{ flex: 0 }} />}
        </View>
      );
      break;
    case 'look':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[viewer].name}のお題`}</Prog>
          <Peek fg={fg}>
            <Text style={[s.bigWord, { color: fg }]} adjustsFontSizeToFit numberOfLines={2}>{word(viewer)}</Text>
          </Peek>
          <Note fg={fg}>{'自分が多数派か少数派かは分からへん。\nお題そのものは言うたらアカン'}</Note>
        </ModeCard>
      );
      controls = (
        <BigButton
          pal={pal}
          label={!dealing ? '覚えた、隠す' : dealt + 1 < n ? `覚えた → ${members[round.order[dealt + 1]].name}に渡す` : '覚えた → 話し合いスタート'}
          onPress={afterLook}
        />
      );
      break;
    case 'talk':
      card = (
        <ModeCard pal={pal} center>
          <Text style={[s.timer, { color: !timeUp && clock.left < 30 ? '#ff3b3b' : fg }]}>{fmt(timeUp ? 0 : clock.left)}</Text>
          <Lead fg={fg}>{timeUp ? '時間切れ！\n投票へ' : 'お題の話をして\n少数派を探せ！'}</Lead>
          <Note fg={fg}>{`${n}人のうち1人だけ、ちょっと違うお題。\n自分が少数派かもしれへん`}</Note>
        </ModeCard>
      );
      controls = (
        <View style={{ gap: 8 }}>
          <BigButton pal={pal} label={timeUp ? '投票へ' : '話し終わった → 投票へ'} onPress={() => { clock.stop(); talkRunning.current = false; setK(0); setPhase('vhand'); }} />
          <Outline label="お題を見直す" fg={pal.fg} onPress={() => setPhase('who')} style={{ flex: 0 }} />
        </View>
      );
      break;
    case 'who':
      card = (
        <ModeCard pal={pal}>
          <Lead fg={fg}>誰がお題を見直す？</Lead>
          <View style={{ flex: 1 }} />
          <NameTiles members={members} list={members.map((_, i) => i)} fg={fg} cols={2} onPress={(i) => { setViewer(i); setPhase('hand'); }} />
        </ModeCard>
      );
      controls = <Outline label="やめる" fg={pal.fg} onPress={() => setPhase('talk')} style={{ flex: 0 }} />;
      break;
    case 'vhand':
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
          <Text style={[s.qSmall, { color: fg }]}>少数派やと思うのは？</Text>
          <View style={{ flex: 1 }} />
          <NameTiles members={members} list={members.map((_, i) => i).filter((i) => i !== voter)} fg={fg} cols={2} onPress={vote} />
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>押したらすぐ次の人へ。誰に入れたかは出えへん</Text>;
      break;
    case 'done':
      card = (
        <ModeCard pal={pal} center>
          <Lead fg={fg}>全員投票した！</Lead>
          <Note fg={fg}>スマホをみんなが見える所に置いて</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="結果発表" onPress={reveal} />;
      break;
    case 'reveal': {
      const rows = members.map((_, i) => ({ i, v: counts[i] })).sort((a, b) => b.v - a.v);
      const res = caught ? `少数派を当てた！${members[round.wolf].name}に逆転チャンス` : top.length > 1 ? '同票で決まらず。少数派の逃げ切り！' : `${members[top[0]].name}は多数派。少数派の逃げ切り！`;
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.no, { color: fg }]}>第{round.no}回戦</Text>
          <View style={{ flex: 1 }} />
          <View style={{ gap: 8 }}>
            {rows.map((r, j) => (
              <Bar key={r.i} name={members[r.i].name} color={colorOf(r.i)} v={tally.shown[r.i] ?? 0} max={max} red={tally.done && r.i === round.wolf} fg={fg} />
            ))}
          </View>
          {tally.done ? <FlipIn>{words(!caught)}</FlipIn> : <View style={{ height: 96 }} />}
          {tally.done && <Text style={[s.rule, caught ? s.ruleGood : s.ruleBad]}>{res}</Text>}
        </ModeCard>
      );
      controls = caught ? <BigButton pal={pal} label="逆転チャンスへ" onPress={() => setPhase('guess')} /> : <BigButton pal={pal} danger label="罰を決める" onPress={() => setPhase('result')} />;
      break;
    }
    case 'guess':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>逆転チャンス</Prog>
          <HandWho members={members} i={round.wolf} fg={fg} />
          <Lead fg={fg}>{'多数派のお題を\n当てろ！'}</Lead>
          <Note fg={fg}>{`${members[round.wolf].name}が声に出して答える。\n合ってるかは多数派のみんなが判定`}</Note>
        </ModeCard>
      );
      controls = (
        <View style={s.verdict}>
          <Tap style={[s.vd, { backgroundColor: '#e8202a' }]} onPress={() => { setGuessed(false); setPhase('result'); }}>
            <Text style={[s.vdText, { color: '#fff' }]}>外れ</Text>
            <Text style={[s.vdSub, { color: '#fff' }]}>{members[round.wolf].name}に罰</Text>
          </Tap>
          <Tap style={[s.vd, { backgroundColor: pal.fg }]} onPress={() => { setGuessed(true); setPhase('result'); }}>
            <Text style={[s.vdText, { color: pal.bg }]}>当たり！</Text>
            <Text style={[s.vdSub, { color: pal.bg }]}>多数派に罰</Text>
          </Tap>
        </View>
      );
      break;
    case 'result': {
      const wolfLose = losers.length === 1 && losers[0] === round.wolf;
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round.no}回戦`}</Prog>
          {words(true)}
          <Lead fg={fg}>{wolfLose ? '少数派の負け' : caught ? '逆転！多数派の負け' : '少数派の逃げ切り'}</Lead>
          <Text style={[s.rule, s.ruleBad, { alignSelf: 'center' }]}>{wolfLose ? `${members[round.wolf].name}に罰` : `多数派の${n - 1}人全員に罰`}</Text>
        </ModeCard>
      );
      controls = <BigButton pal={pal} danger label="罰ガチャ" onPress={doGacha} />;
      break;
    }
    case 'group':
      card = groupRoll ? (
        <ModeCard pal={pal} center bg={group?.lucky ? undefined : '#1a0606'} edge={group?.lucky ? undefined : '#e8202a'}>
          <GachaMachine color={group?.lucky ? fg : '#f7f3ea'} />
        </ModeCard>
      ) : (
        <ModeCard pal={pal} center bg={group?.lucky ? undefined : '#1a0606'} edge={group?.lucky ? undefined : '#e8202a'}>
          <Prog fg={group?.lucky ? fg : '#f7f3ea'}>多数派全員の罰</Prog>
          {group?.lucky ? <Angel /> : <Skull />}
          <Text style={[s.groupHead, { color: group?.lucky ? fg : '#ff3b3b' }]}>{group?.lucky ? '天使！全員セーフ' : '罰ゲーム'}</Text>
          <Text style={[s.groupText, { color: group?.lucky ? fg : '#f7f3ea' }]}>{group?.segments.map((x) => x.text).join('')}</Text>
          <Note fg={group?.lucky ? fg : '#f7f3ea'}>{losers.map((i) => members[i].name).join('・')}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`${group?.lucky ? 'ラッキー！' : '受け入れた'} → 次の回戦`} onPress={accept} />;
      break;
    case 'batsu':
      card = (
        <DeckStack pal={pal} minHeight={0}>
          <GachaCard pal={pal} members={members} items={gacha} />
        </DeckStack>
      );
      controls = <BigButton pal={pal} label={`${gacha.every((x) => x.lucky) ? 'ラッキー！' : '受け入れた'} → 次の回戦`} onPress={accept} />;
      break;
  }

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <View style={[s.wrap, flipped && { transform: [{ rotate: '180deg' }] }]}>
        <ScoreBar pal={pal} members={members} pen={pen} rev={Array(n).fill(false)} doer={-1} onMenu={() => setMenu(true)} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
        <View style={{ flex: 1 }}>{card}</View>
        {controls}
      </View>
      <Frame color={frame} />
      <HurryFrame on={hurry} />
      <RulesSheet visible={rules} custom={HELP.wolf.rules} onClose={() => setRules(false)} />
      <GameMenu
        visible={menu}
        meta={`ワードウルフ・${LEVEL_LABEL[level]}・${played}回戦`}
        rulesSub="このモードの遊び方"
        onRules={() => setRules(true)}
        onEnd={finish}
        onSettings={onSettings}
        onQuit={() => { clock.stop(); onQuit(); }}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}

/** 票数のバー（下の人から順に伸びる） */
/** 数え終わったら少数派の正体がめくれて出てくる */
function FlipIn({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: v, transform: [{ perspective: 800 }, { rotateY: v.interpolate({ inputRange: [0, 1], outputRange: ['-100deg', '0deg'] }) }] }}>
      {children}
    </Animated.View>
  );
}

function Bar({ name, color, v, max, red, fg }: { name: string; color: string; v: number; max: number; red: boolean; fg: string }) {
  const w = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: max ? v / max : 0, duration: 250, easing: Easing.out(Easing.back(1.4)), useNativeDriver: false }).start();
    if (v > 0) {
      pop.setValue(1);
      Animated.spring(pop, { toValue: 0, friction: 4, tension: 160, useNativeDriver: false }).start();
    }
  }, [v]);
  return (
    <View style={s.barRow}>
      <Text style={[s.barName, { color: red ? '#ff3b3b' : fg }]} numberOfLines={1}>{name}</Text>
      <View style={[s.barTrack, { backgroundColor: alpha('#888888', 0.18) }]}>
        <Animated.View style={[s.barFill, { backgroundColor: color, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
      <Animated.Text style={[s.barV, { color: fg, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }] }]}>{v}</Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  no: { fontFamily: F.display, fontSize: 22 },
  small: { fontSize: 12, fontWeight: '700', opacity: 0.65, lineHeight: 18 },
  mins: { flexDirection: 'row', gap: 8 },
  min: { flex: 1, borderWidth: 2, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  minText: { fontWeight: '900', fontSize: 15 },
  bigWord: { fontFamily: F.display, fontSize: 48, lineHeight: 60, textAlign: 'center' },
  timer: { fontFamily: F.display, fontSize: 80, lineHeight: 90 },
  qSmall: { fontFamily: F.display, fontSize: 21, lineHeight: 30 },
  voter: { fontFamily: F.display, fontSize: 22 },
  voterSub: { fontFamily: undefined, fontSize: 13, fontWeight: '900' },
  rule: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, fontSize: 13, fontWeight: '900', overflow: 'hidden' },
  ruleBad: { backgroundColor: 'rgba(255,59,59,0.14)', color: '#ff3b3b' },
  ruleGood: { backgroundColor: 'rgba(60,180,110,0.18)', color: '#2fbf6f' },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  words: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  wordBox: { flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  wordLab: { fontSize: 12, fontWeight: '900', opacity: 0.7 },
  wordText: { fontFamily: F.display, fontSize: 22, lineHeight: 30, textAlign: 'center' },
  wordWho: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  verdict: { flexDirection: 'row', gap: 10 },
  vd: { flex: 1, borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
  vdText: { fontFamily: F.display, fontSize: 22 },
  vdSub: { fontSize: 12, fontWeight: '900', opacity: 0.85 },
  groupHead: { fontFamily: F.display, fontSize: 26 },
  groupText: { fontFamily: F.display, fontSize: 22, lineHeight: 32, textAlign: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barName: { width: 96, fontWeight: '900', fontSize: 15 },
  barTrack: { flex: 1, height: 18, borderRadius: 9, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 9 },
  barV: { width: 28, textAlign: 'right', fontFamily: F.display, fontSize: 22 },
});
