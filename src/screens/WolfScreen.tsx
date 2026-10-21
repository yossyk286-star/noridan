import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { HurryFrame } from '../components/Fx';
import { useHurry } from '../lib/useHurry';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Haptics } from '../lib/vibe';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, Frame, GachaCard, RulesSheet, ScoreBar, DeckStack } from '../components/Stage';
import { HandWho, IntroCard, Lead, LevelBox, ModeCard, NameTiles, Note, Outline, Prog, Peek } from '../components/ModeParts';
import { Angel, GACHA_MS, GachaMachine, Skull } from '../components/Fx';
import { Tap } from '../components/Tap';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { HELP } from '../lib/help';
import { useHold } from '../components/Reveal';
import GameMenu from '../components/GameMenu';
import { Decks } from '../lib/game';
import { play } from '../lib/sound';
import { load, save } from '../lib/storage';
import { useCountdown } from '../lib/useCountdown';
import { useVoteCount } from '../lib/useVoteCount';
import { newStats, type Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf, neonPal } from '../theme';
import type { GachaItem, Level, Member, Night, Segment } from '../types';
import { batsuCue } from '../lib/fx';

type Props = {
  members: Member[];
  level: Level;
  night: Night;
  onQuit: () => void;
  onSettings: () => void;
  onFinish: (pen: number[], turns: number, stats: Stats) => void;
};
type Phase = 'intro' | 'hand' | 'look' | 'talk' | 'who' | 'vhand' | 'vote' | 'done' | 'reveal' | 'guess' | 'result' | 'group' | 'batsu';
type Round = { no: number; maj: string; min: string; night: 'yoru' | 'shinya' | false; wolves: number[]; allCit: boolean; order: number[]; votes: (number | null)[] };

const MINUTES = [2, 3, 5];
const NONE = -1; // 投票の「ウルフはおらん」
/** おまかせのウルフの人数：3〜6人は1人、7〜9人は2人、10人以上は3人（ウルフは半分未満） */
const autoCount = (n: number) => (n >= 10 ? 3 : n >= 7 ? 2 : 1);
const maxCount = (n: number) => Math.max(1, Math.min(3, Math.floor((n - 1) / 2)));
const shuffled = (a: number[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/**
 * ワードウルフ：全員にお題。ウルフだけちょっと違うお題で、自分がどっちかは分からへん。話して投票（「ウルフはおらん」も選べる）。
 * ・ウルフがおる回：一番票が多いのがウルフの誰かなら市民の勝ち（市民のお題を当てたら逆転）。市民・同票・「おらん」が一番ならウルフの勝ち
 * ・全員市民の回（4人以上、たまに）：「おらん」に入れんかった人（誰かを疑った人）の負け
 */
export default function WolfScreen({ members, level, night, onQuit, onSettings, onFinish }: Props) {
  useKeepAwake();
  const n = members.length;
  const decks = useRef(new Decks()).current;
  decks.night = night;
  decks.level = level;
  const cfg = useRef({ count: 0, peace: true }); // ウルフの人数（0=おまかせ）・全員市民の回あり
  const wolfCount = () => Math.min(maxCount(n), cfg.current.count || autoCount(n));
  const peaceOk = () => cfg.current.peace && n >= 4;
  const newRound = (no: number): Round => {
    const w = decks.wolf(level, night, members);
    const s0 = (no - 1) % n;
    const allCit = peaceOk() && Math.random() < 1 / 6; // 全員市民の回は6回に1回くらい
    const wolves = allCit ? [] : shuffled(members.map((_, i) => i)).slice(0, wolfCount()).sort((a, b) => a - b);
    return { ...w, no, wolves, allCit, order: members.map((_, k) => (s0 + k) % n), votes: Array(n).fill(null) };
  };
  const [round, setRound] = useState<Round>(() => newRound(1));
  const [phase, setPhase] = useState<Phase>('intro');
  const [minutes, setMinutes] = useState(3);
  const [count, setCount] = useState(0);
  const [peace, setPeace] = useState(true);
  cfg.current = { count, peace };
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
  const [groupRoll, setGroupRoll] = useState(false); // 市民全員の罰もマシンが回ってから出す
  const stats = useRef<Stats>(newStats(n)).current;
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const H = useHold();
  const clock = useCountdown(() => {
    setTimeUp(true);
    play('timeup');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  });
  const talkRunning = useRef(false);
  const hurry = useHurry(clock.left, talkRunning.current && !timeUp && ['talk', 'who', 'hand', 'look'].includes(phase));
  const talkStarted = useRef(false);

  useEffect(() => {
    load('nd_wf_min', 3).then((m) => MINUTES.includes(m) && setMinutes(m));
    load('nd_wf_n', 0).then((v) => setCount(v));
    load('nd_wf_peace', true).then((v) => setPeace(!!v));
  }, []);

  const isWolf = (i: number) => round.wolves.includes(i);
  const word = (i: number) => (isWolf(i) ? round.min : round.maj);
  const counts = Array(n).fill(0) as number[];
  let none = 0;
  round.votes.forEach((t) => {
    if (t === NONE) none++;
    else if (t != null) counts[t]++;
  });
  const showNone = peaceOk() || none > 0;
  const max = Math.max(...counts, none);
  const top = counts.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0);
  if (none === max) top.push(NONE);
  const caught = !round.allCit && top.length === 1 && isWolf(top[0]);
  // 負けた人：全員市民 → 誰かを疑った人。バレて逆転できず → ウルフ。逃げ切り・逆転 → 市民全員
  const losers = round.allCit
    ? members.map((_, i) => i).filter((i) => round.votes[i] !== NONE)
    : caught && !guessed ? [...round.wolves] : members.map((_, i) => i).filter((i) => !isWolf(i));
  const wolfNames = round.wolves.map((i) => members[i].name).join('・');
  const voter = round.order[k];
  const tally = useVoteCount(showNone ? [...counts, none] : counts, phase === 'reveal');

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
    // 開票の前にドラムロール
    H.hold('開票…', 1800, () => {
      setPlayed(played + 1);
      setPhase('reveal');
    });
  };
  const doGacha = () => {
    if (!round.allCit && !caught) round.wolves.forEach((w) => stats.wolf![w]++);
    if (losers.length === 1) {
      const items = losers.map((i) => ({ i, n: 1, ...decks.batsu(members, i) }));
      setGacha(items);
      setPhase('batsu');
      batsuCue(items, members);
    } else {
      const g = decks.groupBatsu(members);
      setGroup(g);
      setGroupRoll(true);
      setTimeout(() => setGroupRoll(false), GACHA_MS);
      setPhase('group');
      batsuCue([{ i: -1, lucky: g.lucky }], members);
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
  const frame = phase === 'hand' || phase === 'look' ? colorOf(viewer) : phase === 'vhand' || phase === 'vote' ? colorOf(voter) : phase === 'guess' && round.wolves.length ? colorOf(round.wolves[0]) : C.muted;
  const kTxt = `${wolfCount()}人${peaceOk() ? '（全員市民の回もある）' : ''}`;
  const wolfRow = (mood?: 'caught' | 'win') => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      {round.wolves.map((w, j) => (
        <View key={w} style={{ marginHorizontal: round.wolves.length > 1 ? -6 : 0, zIndex: j === 1 ? 1 : 0 }}>
          <WolfFace size={round.wolves.length === 1 ? 104 : round.wolves.length === 3 && j === 1 ? 92 : 80} mood={mood} />
        </View>
      ))}
    </View>
  );
  const words = (showMaj: boolean) => round.allCit ? (
    <View style={s.words}>
      <View style={[s.wordBox, { backgroundColor: alpha('#888888', 0.12) }]}>
        <Text style={[s.wordLab, { color: fg }]}>全員市民</Text>
        <Text style={[s.wordText, { color: fg }]}>{round.maj}</Text>
        <Text style={[s.wordLab, { color: fg }]}>ウルフはおらんかった</Text>
      </View>
    </View>
  ) : (
    <View style={s.words}>
      <View style={[s.wordBox, { backgroundColor: alpha('#888888', 0.12), borderWidth: 2, borderColor: 'rgba(255,59,59,0.45)' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <WolfFace size={22} />
          <Text style={[s.wordLab, { color: '#ff3b3b', opacity: 1 }]}>ウルフ{round.wolves.length > 1 ? `${round.wolves.length}人` : ''}</Text>
        </View>
        <Text style={[s.wordText, { color: fg }]}>{round.min}</Text>
        <View style={[s.wordWho, { flexWrap: 'wrap', justifyContent: 'center' }]}>
          {round.wolves.map((w) => (
            <View key={w} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={[s.dot, { backgroundColor: colorOf(w) }]} />
              <Text style={[s.wordLab, { color: fg }]} numberOfLines={1}>{members[w].name}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={[s.wordBox, { backgroundColor: alpha('#888888', 0.12) }]}>
        <Text style={[s.wordLab, { color: fg }]}>市民</Text>
        <Text style={[s.wordText, { color: fg }]}>{showMaj ? round.maj : '？？？'}</Text>
        <Text style={[s.wordLab, { color: fg }]}>ほか{n - round.wolves.length}人</Text>
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
          <SetRow label="話し合い" fg={fg} bg={pal.cardBg} opts={MINUTES.map((m) => ({ label: `${m}分`, on: minutes === m, press: () => { setMinutes(m); save('nd_wf_min', m); } }))} />
          <SetRow label="ウルフ" fg={fg} bg={pal.cardBg} opts={[{ label: `おまかせ(${Math.min(autoCount(n), maxCount(n))})`, on: !count, press: () => { setCount(0); save('nd_wf_n', 0); } }, ...[1, 2, 3].filter((c) => c <= maxCount(n)).map((c) => ({ label: `${c}人`, on: count === c, press: () => { setCount(c); save('nd_wf_n', c); } }))]} />
          {n >= 4 && <SetRow label="全員市民の回" fg={fg} bg={pal.cardBg} opts={[{ label: 'たまに', on: peace, press: () => { setPeace(true); save('nd_wf_peace', true); } }, { label: 'なし', on: !peace, press: () => { setPeace(false); save('nd_wf_peace', false); } }]} />}
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="お題を配る" onPress={() => startRound(1)} />;
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
          <Note fg={fg}>{'自分が市民かウルフかは分からへん。\nお題そのものは言うたらアカン'}</Note>
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
          <Lead fg={fg}>{timeUp ? '時間切れ！\n投票へ' : 'お題の話をして\nウルフを探せ！'}</Lead>
          <Note fg={fg}>{`${n}人のうちウルフは${kTxt}。\n自分がウルフかもしれへん`}</Note>
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
          <Text style={[s.qSmall, { color: fg }]}>ウルフやと思うのは？</Text>
          <View style={{ flex: 1 }} />
          <NameTiles members={members} list={members.map((_, i) => i).filter((i) => i !== voter)} fg={fg} cols={2} onPress={vote} />
          {peaceOk() && <Outline label="ウルフはおらん" fg={fg} onPress={() => vote(NONE)} style={{ flex: 0, borderStyle: 'dashed' }} />}
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
      const rows = members.map((_, i) => ({ i, v: counts[i] }));
      if (showNone) rows.push({ i: NONE, v: none });
      rows.sort((a, b) => b.v - a.v);
      const res = round.allCit ? (losers.length ? '実は全員市民！疑った人の負け' : '実は全員市民！全員見抜いた')
        : caught ? `ウルフを見つけた！でも${wolfNames}に逆転チャンス`
        : top.length > 1 ? '同票で決まらず。ウルフの逃げ切り！'
        : top[0] === NONE ? '「おらん」が一番。ウルフの逃げ切り！'
        : `${members[top[0]].name}は市民。ウルフの逃げ切り！`;
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.no, { color: fg }]}>第{round.no}回戦</Text>
          <View style={{ flex: 1 }} />
          <View style={{ gap: 8 }}>
            {rows.map((r, j) => (
              <Bar key={r.i} name={r.i === NONE ? 'ウルフはおらん' : members[r.i].name} color={r.i === NONE ? '#8d857a' : colorOf(r.i)} v={tally.shown[r.i === NONE ? n : r.i] ?? 0} max={max} red={tally.done && isWolf(r.i)} fg={fg} />
            ))}
          </View>
          {tally.done ? <FlipIn>{words(!caught)}</FlipIn> : <View style={{ height: 96 }} />}
          {tally.done && <Text style={[s.rule, caught || (round.allCit && !losers.length) ? s.ruleGood : s.ruleBad]}>{res}</Text>}
        </ModeCard>
      );
      controls = caught ? <BigButton pal={pal} label="逆転チャンスへ" onPress={() => setPhase('guess')} /> : <BigButton pal={pal} danger={losers.length > 0} label={round.allCit ? '結果を見る' : '罰を決める'} onPress={() => setPhase('result')} />;
      break;
    }
    case 'guess':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>逆転チャンス</Prog>
          {wolfRow()}
          <WolfTag name={wolfNames} color={colorOf(round.wolves[0] ?? 0)} fg={fg} label="ウルフ：" />
          <Lead fg={fg}>{'市民のお題を\n当てろ！'}</Lead>
          <Note fg={fg}>{`${round.wolves.length > 1 ? `${wolfNames}で相談して、1回だけ答える。` : `${wolfNames}が声に出して答える。`}\n合ってるかは市民のみんなが判定`}</Note>
        </ModeCard>
      );
      controls = (
        <View style={s.verdict}>
          <Tap style={[s.vd, { backgroundColor: '#e8202a' }]} onPress={() => { setGuessed(false); setPhase('result'); }}>
            <Text style={[s.vdText, { color: '#fff' }]}>外れ</Text>
            <Text style={[s.vdSub, { color: '#fff' }]}>ウルフに罰</Text>
          </Tap>
          <Tap style={[s.vd, { backgroundColor: pal.fg }]} onPress={() => { setGuessed(true); setPhase('result'); }}>
            <Text style={[s.vdText, { color: pal.bg }]}>当たり！</Text>
            <Text style={[s.vdSub, { color: pal.bg }]}>市民に罰</Text>
          </Tap>
        </View>
      );
      break;
    case 'result': {
      if (round.allCit) {
        const ok = !losers.length;
        card = (
          <ModeCard pal={pal} center>
            <Prog fg={fg}>{`第${round.no}回戦`}</Prog>
            <View>
              <View style={{ opacity: 0.25 }}><WolfFace size={104} /></View>
              <Stamp text="不在！" color={ok ? '#1f9d55' : '#ff3b3b'} />
            </View>
            <WolfTag name="" color="#8d857a" fg={fg} label="ウルフはおらんかった" />
            <Text style={[s.win, { color: ok ? '#1f9d55' : '#ff3b3b' }]} numberOfLines={1} adjustsFontSizeToFit>{ok ? '全員見抜いた！' : '全員市民やった！'}</Text>
            <Note fg={fg}>{ok ? '全員が「ウルフはおらん」に入れた。全員セーフ' : '誰かを疑った人の負け'}</Note>
            {words(true)}
            <Text style={[s.rule, ok ? s.ruleGood : s.ruleBad, { alignSelf: 'center' }]}>{ok ? '今回は罰なし' : `${losers.map((i) => members[i].name).join('・')}に罰`}</Text>
          </ModeCard>
        );
        controls = ok ? <BigButton pal={pal} label="次の回戦" onPress={() => startRound(round.no + 1)} /> : <BigButton pal={pal} danger label="罰ガチャ" onPress={doGacha} />;
        break;
      }
      const wolfLose = caught && !guessed;
      const how = wolfLose ? 'ウルフをつかまえた' : caught ? 'ウルフが市民のお題を当てた' : top.length > 1 ? '同票でウルフを決められへんかった' : top[0] === NONE ? '「ウルフはおらん」にだまされた' : 'ウルフを見抜けへんかった';
      const winColor = wolfLose ? '#1f9d55' : '#ff3b3b';
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round.no}回戦`}</Prog>
          <View>
            {wolfRow(wolfLose ? 'caught' : 'win')}
            <Stamp text={wolfLose ? '御用！' : caught ? '逆転！' : '逃げ切り！'} color={winColor} />
          </View>
          <WolfTag name={wolfNames} color={colorOf(round.wolves[0] ?? 0)} fg={fg} label="ウルフは" />
          <Text style={[s.win, { color: winColor }]} numberOfLines={1} adjustsFontSizeToFit>{wolfLose ? '市民の勝ち！' : caught ? 'ウルフの逆転勝ち！' : 'ウルフの勝ち！'}</Text>
          <Note fg={fg}>{how}</Note>
          {words(true)}
          <Text style={[s.rule, s.ruleBad, { alignSelf: 'center' }]}>{wolfLose ? `ウルフの${wolfNames}に罰` : `市民の${losers.length}人全員に罰`}</Text>
        </ModeCard>
      );
      controls = <BigButton pal={pal} danger label="罰ガチャ" onPress={doGacha} />;
      break;
    }
    case 'group':
      card = groupRoll ? (
        <ModeCard pal={pal} center bg={group?.lucky ? undefined : '#1a0606'} edge={group?.lucky ? undefined : '#e8202a'}>
          <GachaMachine color={group?.lucky ? fg : '#f7f3ea'} lucky={!!group?.lucky} />
        </ModeCard>
      ) : (
        <ModeCard pal={pal} center bg={group?.lucky ? undefined : '#1a0606'} edge={group?.lucky ? undefined : '#e8202a'}>
          <Prog fg={group?.lucky ? fg : '#f7f3ea'}>市民全員の罰</Prog>
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

  // ため（ドラムロール）の間は結果を出さへん
  const hv = H.view(pal);
  if (hv) { card = hv.card; controls = hv.controls; }
  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <View style={[s.wrap, flipped && { transform: [{ rotate: '180deg' }] }]}>
        <ScoreBar onEnd={finish} pal={pal} members={members} pen={pen} rev={Array(n).fill(false)} doer={-1} onMenu={() => setMenu(true)} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
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
/** ウルフの顔（caught=つかまった、win=逃げ切りでゆらゆら） */
function WolfFace({ size, mood }: { size: number; mood?: 'caught' | 'win' }) {
  const pop = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start();
    if (mood === 'caught') {
      const a = Animated.loop(Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(sway, { toValue: -1, duration: 240, useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]));
      a.start();
      return () => a.stop();
    }
    if (mood === 'win') {
      const a = Animated.loop(Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      a.start();
      return () => a.stop();
    }
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale: pop }, { rotate: sway.interpolate({ inputRange: [-1, 0, 1], outputRange: mood === 'caught' ? ['2deg', '0deg', '-2deg'] : ['8deg', '0deg', '-8deg'] }) }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="eg" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#fff6b0" /><Stop offset=".55" stopColor="#ffd23f" /><Stop offset="1" stopColor="#ff8a1a" /></RadialGradient>
          <LinearGradient id="fur" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#4b556e" /><Stop offset="1" stopColor="#262c3b" /></LinearGradient>
        </Defs>
        <Path d="M50 19 35 23 21 38 12 58l11 1-6 11 14 2 8 16 11 9 11-9 8-16 14-2-6-11 11-1-9-20-14-15zM19 47 25 3l23 26zM81 47 75 3 52 29z" fill="none" stroke="#9fb2e6" strokeOpacity={0.35} strokeWidth={8} strokeLinejoin="round" />
        <Path d="M19 47 25 3l23 26zM81 47 75 3 52 29z" fill="#262c3b" stroke="#0b0d12" strokeWidth={3} strokeLinejoin="round" />
        <Path d="M25 37 27 14l12 14zM75 37 73 14 61 28z" fill="#5d6782" />
        <Path d="M50 19 35 23 21 38 12 58l11 1-6 11 14 2 8 16 11 9 11-9 8-16 14-2-6-11 11-1-9-20-14-15z" fill="url(#fur)" stroke="#0b0d12" strokeWidth={3} strokeLinejoin="round" />
        <Path d="M50 21 43 38 50 57 57 38z" fill="#6b7590" opacity={0.9} />
        <Path d="M23 58 33 56 38 64M77 58 67 56 62 64" fill="none" stroke="#7d87a3" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <Path d="M37 63 50 58 63 63 59 80 50 90 41 80z" fill="#d7dcea" stroke="#0b0d12" strokeWidth={2.5} strokeLinejoin="round" />
        <Path d="M43 61.5h14l-7 7.5z" fill="#0b0d12" />
        {mood === 'caught' ? (
          <>
            <Path d="M24 45 44 39M76 45 56 39" stroke="#0b0d12" strokeWidth={4.5} strokeLinecap="round" />
            <Path d="M29 47.5 41 53 29 58.5M71 47.5 59 53 71 58.5" fill="none" stroke="#0b0d12" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M33 58q-2 7 0 14M67 58q2 7 0 14" fill="none" stroke="#6cc7ff" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
            <Path d="M40 80q2.5-4 5 0t5 0 5 0 5 0" fill="none" stroke="#0b0d12" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <Path d="M22 40 45 47M78 40 55 47" stroke="#0b0d12" strokeWidth={5} strokeLinecap="round" />
            <Ellipse cx="35" cy="52" rx="12" ry="7" fill="#ffd23f" opacity={0.22} />
            <Ellipse cx="65" cy="52" rx="12" ry="7" fill="#ffd23f" opacity={0.22} />
            <Path d="M25 45 45 50.5 41 58 28 53.5z" fill="url(#eg)" stroke="#0b0d12" strokeWidth={2} strokeLinejoin="round" />
            <Path d="M75 45 55 50.5 59 58 72 53.5z" fill="url(#eg)" stroke="#0b0d12" strokeWidth={2} strokeLinejoin="round" />
            <Path d="M37 49v7.5M63 49v7.5" stroke="#0b0d12" strokeWidth={2.4} strokeLinecap="round" />
            <Path d="M41 75q9 5 18 0" fill="none" stroke="#0b0d12" strokeWidth={2.2} strokeLinecap="round" />
            <Path d="M42.5 76 45 85 47.5 77.5M57.5 76 55 85 52.5 77.5" fill="#fff" stroke="#0b0d12" strokeWidth={1.4} strokeLinejoin="round" />
          </>
        )}
      </Svg>
      {mood === 'caught' && (
        <>
          <Tear size={size} x={0.31} delay={0} />
          <Tear size={size} x={0.69} delay={550} />
        </>
      )}
    </Animated.View>
  );
}

/** ぽろぽろ落ちる涙 */
function Tear({ size, x, delay }: { size: number; x: number; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.in(Easing.quad), useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, []);
  const w = size * 0.1;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: size * x - w / 2, top: size * 0.57, opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.04, size * 0.26] }) }] }}>
      <Svg width={w} height={w * 1.4} viewBox="0 0 10 14">
        <Path d="M5 1C2.5 5 1 7.5 1 9.5a4 4 0 0 0 8 0C9 7.5 7.5 5 5 1z" fill="#8fd8ff" stroke="#0b0d12" strokeWidth={1.2} />
      </Svg>
    </Animated.View>
  );
}

/** 設定の1行：左に見出し、右に小さいボタン */
function SetRow({ label, fg, bg, opts }: { label: string; fg: string; bg: string; opts: { label: string; on: boolean; press: () => void }[] }) {
  return (
    <View style={s.setRow}>
      <Text style={[s.setLabel, { color: fg }]}>{label}</Text>
      <View style={s.seg}>
        {opts.map((o) => (
          <Tap key={o.label} onPress={o.press} style={[s.segBtn, { borderColor: alpha('#888888', 0.4) }, o.on && { backgroundColor: fg, borderColor: fg }]}>
            <Text style={[s.segText, { color: o.on ? bg : fg }]}>{o.label}</Text>
          </Tap>
        ))}
      </View>
    </View>
  );
}

/** 「ウルフは〇〇」の札 */
function WolfTag({ name, color, fg, label }: { name: string; color: string; fg: string; label: string }) {
  return (
    <View style={[s.wolfTag, { backgroundColor: alpha('#888888', 0.14) }]}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={[s.wolfTagText, { color: fg }]} numberOfLines={1}>{label}{name}</Text>
    </View>
  );
}

/** 斜めのハンコ（御用！・逃げ切り！） */
function Stamp({ text, color }: { text: string; color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([Animated.delay(600), Animated.spring(v, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true })]).start();
  }, []);
  return (
    <Animated.View style={[s.stamp, { borderColor: color, opacity: v, transform: [{ rotate: '14deg' }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] }) }] }]}>
      <Text style={[s.stampText, { color }]}>{text}</Text>
    </Animated.View>
  );
}

/** 数え終わったらウルフの正体がめくれて出てくる */
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
  setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  setLabel: { fontSize: 12, fontWeight: '900', opacity: 0.7 },
  seg: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4, flexShrink: 1 },
  segBtn: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  segText: { fontSize: 13, fontWeight: '900' },
  wolfTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, maxWidth: '90%' },
  wolfTagText: { fontWeight: '900', fontSize: 14 },
  stamp: { position: 'absolute', top: 4, right: -64, borderWidth: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  stampText: { fontFamily: F.display, fontSize: 17 },
  win: { fontFamily: F.display, fontSize: 32, lineHeight: 40 },
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
