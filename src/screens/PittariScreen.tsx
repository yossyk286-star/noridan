import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, Frame, GachaCard, RulesSheet, ScoreBar, DeckStack, SegText } from '../components/Stage';
import { HandWho, IntroCard, Lead, LevelBox, ModeCard, Note, Outline, Prog } from '../components/ModeParts';
import { Tap } from '../components/Tap';
import { HELP } from '../lib/help';
import GameMenu from '../components/GameMenu';
import { Decks, fill } from '../lib/game';
import { play } from '../lib/sound';
import { usePrefs } from '../lib/prefs';
import { speak } from '../lib/speech';
import { newStats, type Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf } from '../theme';
import type { GachaItem, Level, Member, Night, Segment } from '../types';

type Props = {
  members: Member[];
  level: Level;
  night: Night;
  onQuit: () => void;
  onSettings: () => void;
  onFinish: (pen: number[], turns: number, stats: Stats) => void;
  skipIntro?: boolean;
};
type Phase = 'intro' | 'q' | 'hand' | 'input' | 'done' | 'answer' | 'reveal' | 'batsu';
type Round = { no: number; q: string; u: string; who: number; segs: Segment[]; order: number[]; guess: (number | null)[]; answer: number | null };

const MAX_DIGITS = 7;
const num = (v: number) => v.toLocaleString('ja-JP');

/** ピッタリ予想：数字のお題に1人ずつこっそり予想を入れる。答え合わせで一番遠い人が罰。誰かがピッタリなら罰2倍 */
export default function PittariScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const decks = useRef(new Decks()).current;
  decks.night = night;
  decks.level = level;
  const { voice } = usePrefs();
  const newRound = (no: number): Round => {
    const p = decks.pittari(level);
    const who = p.t.includes('{P}') ? (no - 1) % n : -1; // 答える人（予想はせえへん）
    const segs = who >= 0 ? fill(p.t, members, who) : [{ text: p.t }];
    const all = members.map((_, k) => (no - 1 + k) % n);
    return { no, q: p.t, u: p.u, who, segs, order: all.filter((i) => i !== who), guess: Array(n).fill(null), answer: null };
  };
  const [round, setRound] = useState<Round>(() => newRound(1));
  const [phase, setPhase] = useState<Phase>(skipIntro ? 'q' : 'intro');
  const [k, setK] = useState(0);
  const [input, setInput] = useState('');
  const [pen, setPen] = useState<number[]>(() => Array(n).fill(0));
  const [done, setDone] = useState(0);
  const [gacha, setGacha] = useState<GachaItem[]>([]);
  const stats = useRef<Stats>(newStats(n)).current;
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const qText = round.segs.map((x) => x.text).join('');
  useEffect(() => {
    if (phase === 'q' && voice) speak(qText);
  }, [round, phase]);

  const guesser = round.order[k];
  const dist = round.order.map((i) => Math.abs((round.guess[i] ?? 0) - (round.answer ?? 0)));
  const maxD = Math.max(...dist);
  const exact = round.answer == null ? [] : round.order.filter((i) => round.guess[i] === round.answer);
  const losers = round.answer == null || dist.every((d) => d === maxD) ? [] : round.order.filter((_, j) => dist[j] === maxD);
  const times = exact.length ? 2 : 1;

  const key = (v: string) => {
    play('tick');
    if (v === 'del') setInput(input.slice(0, -1));
    else if (v === 'clr') setInput('');
    else if (input.length < MAX_DIGITS) setInput(input === '0' ? v : input + v);
  };
  const nextRound = (skip = false) => {
    setRound(newRound(skip ? round.no : round.no + 1));
    setK(0);
    setInput('');
    setGacha([]);
    setPhase('q');
  };
  const submitGuess = () => {
    if (input === '') return;
    const guess = round.guess.slice();
    guess[guesser] = +input;
    setRound({ ...round, guess });
    setInput('');
    Haptics.selectionAsync().catch(() => {});
    if (k + 1 < round.order.length) {
      setK(k + 1);
      setPhase('hand');
    } else setPhase('done');
  };
  const submitAnswer = () => {
    if (input === '') return;
    const answer = +input;
    const r = { ...round, answer };
    setRound(r);
    setInput('');
    r.order.forEach((i) => r.guess[i] === answer && (stats.exact![i] += 1));
    setDone(done + 1);
    setPhase('reveal');
    play('fanfare');
  };
  const doGacha = () => {
    const items = losers.map((i) => ({ i, n: times, ...decks.batsu(members, i, times) }));
    setGacha(items);
    setPhase('batsu');
    play(items.every((x) => x.lucky) ? 'gachaLucky' : 'gacha');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };
  const accept = () => {
    const np = pen.slice();
    gacha.forEach((x) => {
      if (x.lucky) stats.lucky[x.i]++;
      else {
        np[x.i] += x.n;
        stats.why[x.i].pit = (stats.why[x.i].pit || 0) + x.n;
      }
    });
    setPen(np);
    nextRound();
  };
  const finish = () => onFinish(pen, done, stats);

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const frame = phase === 'hand' || phase === 'input' ? colorOf(guesser) : C.muted;
  const head = (
    <View style={s.head}>
      <Text style={[s.no, { color: fg }]}>第{round.no}問</Text>
      <Text style={[s.tag, { color: fg, borderColor: alpha('#888888', 0.5) }]}>予想</Text>
    </View>
  );
  const qSmall = <SegText segments={round.segs} style={[s.qSmall, { color: fg }]} />;
  const display = (lab: string) => (
    <View style={s.disp}>
      <Text style={[s.dispLab, { color: fg }]}>{lab}</Text>
      <View style={s.dispRow}>
        <Text style={[s.dispNum, { color: fg, opacity: input === '' ? 0.3 : 1 }]} adjustsFontSizeToFit numberOfLines={1}>{input === '' ? '?' : num(+input)}</Text>
        <Text style={[s.dispUnit, { color: fg }]}>{round.u}</Text>
      </View>
    </View>
  );
  const pad = (label: string, onOk: () => void) => (
    <View style={{ gap: 8 }}>
      <View style={s.pad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'].map((v) => (
          <Tap key={v} onPress={() => key(v)} accessibilityLabel={v === 'del' ? '1文字消す' : v === 'clr' ? '全部消す' : v} style={[s.key, { backgroundColor: pal.chip }]}>
            <Text style={[v === 'del' || v === 'clr' ? s.keyFn : s.keyText, { color: pal.fg }]}>{v === 'del' ? '⌫' : v === 'clr' ? 'C' : v}</Text>
          </Tap>
        ))}
      </View>
      <BigButton pal={pal} label={label} disabled={input === ''} onPress={onOk} />
    </View>
  );

  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="pittari" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」`} />
        </IntroCard>
      );
      controls = <BigButton pal={pal} label="1問目へ" onPress={() => setPhase('q')} />;
      break;
    case 'q':
      card = (
        <ModeCard pal={pal}>
          {head}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <SegText segments={round.segs} style={[s.qBig, { color: fg }]} fit />
          </View>
          <Text style={[s.small, { color: fg }]}>
            {round.who >= 0 ? `${members[round.who].name}は答える人なので予想せえへん。ほかの人が1人ずつこっそり予想` : '全員1人ずつ、こっそり数字を予想'}（単位：{round.u}）
          </Text>
        </ModeCard>
      );
      controls = (
        <View style={{ gap: 8 }}>
          <BigButton pal={pal} label="予想スタート" onPress={() => setPhase('hand')} />
          <Outline label="このお題はパス" fg={pal.fg} onPress={() => nextRound(true)} style={{ flex: 0 }} />
        </View>
      );
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`予想 ${k + 1} / ${round.order.length}`}</Prog>
          <HandWho members={members} i={guesser} sub="の番" fg={fg} />
          <Note fg={fg}>{`スマホを${members[guesser].name}に渡して。\n他の人は画面を見たらアカン`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`${members[guesser].name}です。予想する`} onPress={() => { setInput(''); setPhase('input'); }} />;
      break;
    case 'input':
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.voter, { color: fg }]}>{members[guesser].name}<Text style={s.voterSub}> の予想</Text></Text>
          {qSmall}
          {display('予想')}
        </ModeCard>
      );
      controls = pad('決定', submitGuess);
      break;
    case 'done':
      card = (
        <ModeCard pal={pal} center>
          <Lead fg={fg}>全員予想した！</Lead>
          <Note fg={fg}>{round.who >= 0 ? `${members[round.who].name}、本当の数字を調べて入れて` : 'スマホや財布を見て、本当の数字を調べよう'}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="答えを入れる" onPress={() => { setInput(''); setPhase('answer'); }} />;
      break;
    case 'answer':
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.voter, { color: fg }]}>答え</Text>
          {qSmall}
          {display('本当の数字')}
        </ModeCard>
      );
      controls = pad('答え合わせ', submitAnswer);
      break;
    case 'reveal': {
      // 罰の人（一番遠い）が上に来るように
      const rows = round.order.map((i, j) => ({ i, v: round.guess[i] ?? 0, d: dist[j] })).sort((a, b) => b.d - a.d);
      card = (
        <ModeCard pal={pal}>
          {head}
          {qSmall}
          <View style={s.ansRow}>
            <Text style={[s.dispLab, { color: fg }]}>答え</Text>
            <Text style={[s.ansNum, { color: fg }]}>{num(round.answer ?? 0)}</Text>
            <Text style={[s.dispUnit, { color: fg }]}>{round.u}</Text>
          </View>
          <View style={{ gap: 6, flexShrink: 1 }}>
            {rows.map((r) => {
              const lose = losers.includes(r.i);
              return (
                <View key={r.i} style={[s.row, { borderLeftColor: colorOf(r.i), backgroundColor: alpha('#888888', 0.12) }]}>
                  <Text style={[s.rowName, { color: lose ? '#ff3b3b' : fg }]} numberOfLines={1}>{members[r.i].name}</Text>
                  <View style={{ width: 28, alignItems: 'center' }}>{lose && <Text style={s.stamp}>罰</Text>}</View>
                  <Text style={[s.rowNum, { color: fg }]}>{num(r.v)}</Text>
                  <Text style={[s.rowDiff, { color: r.d === 0 ? '#1f9d55' : fg }]}>{r.d === 0 ? 'ピッタリ！' : `差 ${num(r.d)}`}</Text>
                </View>
              );
            })}
          </View>
          <Text style={[s.rule, losers.length ? s.ruleBad : s.ruleGood]}>
            {losers.length ? `一番遠い${losers.map((i) => members[i].name).join('・')}に罰${exact.length ? '（ピッタリが出たので2倍）' : ''}` : '全員同じ差なので、今回は罰なし'}
          </Text>
        </ModeCard>
      );
      controls = losers.length ? (
        <BigButton pal={pal} danger label={`${losers.map((i) => members[i].name).join('・')}に罰ガチャ`} onPress={doGacha} />
      ) : (
        <BigButton pal={pal} label="次のお題" onPress={() => nextRound()} />
      );
      break;
    }
    case 'batsu':
      card = (
        <DeckStack pal={pal} minHeight={0}>
          <GachaCard pal={pal} members={members} items={gacha} />
        </DeckStack>
      );
      controls = <BigButton pal={pal} label={`${gacha.every((x) => x.lucky) ? 'ラッキー！' : '受け入れた'} → 次のお題`} onPress={accept} />;
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
      <RulesSheet visible={rules} custom={HELP.pittari.rules} onClose={() => setRules(false)} />
      <GameMenu
        visible={menu}
        meta={`ピッタリ予想・${LEVEL_LABEL[level]}・${done}問`}
        rulesSub="このモードの遊び方"
        onRules={() => setRules(true)}
        onEnd={finish}
        onSettings={onSettings}
        onQuit={onQuit}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  no: { fontFamily: F.display, fontSize: 22 },
  tag: { fontSize: 11, fontWeight: '900', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  qBig: { fontFamily: F.display, fontSize: 34, lineHeight: 48 },
  qSmall: { fontFamily: F.display, fontSize: 19, lineHeight: 28 },
  small: { fontSize: 12, fontWeight: '700', opacity: 0.65, lineHeight: 18 },
  voter: { fontFamily: F.display, fontSize: 22 },
  voterSub: { fontFamily: undefined, fontSize: 13, fontWeight: '900' },
  disp: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 },
  dispLab: { fontSize: 13, fontWeight: '900', opacity: 0.65 },
  dispRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, maxWidth: '100%' },
  dispNum: { fontFamily: F.display, fontSize: 68, flexShrink: 1 },
  dispUnit: { fontWeight: '900', fontSize: 18 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  key: { width: '31.5%', height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: F.display, fontSize: 24 },
  keyFn: { fontSize: 18, fontWeight: '900', opacity: 0.8 },
  ansRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8 },
  ansNum: { fontFamily: F.display, fontSize: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderLeftWidth: 6 },
  rowName: { flex: 1, fontWeight: '900', fontSize: 15 },
  rowNum: { fontFamily: F.display, fontSize: 22 },
  rowDiff: { width: 76, textAlign: 'right', fontSize: 12, fontWeight: '900', opacity: 0.8 },
  stamp: { width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, borderColor: '#ff3b3b', color: '#ff3b3b', textAlign: 'center', lineHeight: 21, fontFamily: F.display, fontSize: 13, transform: [{ rotate: '-14deg' }] },
  rule: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, fontSize: 13, fontWeight: '900', overflow: 'hidden' },
  ruleBad: { backgroundColor: 'rgba(255,59,59,0.14)', color: '#ff3b3b' },
  ruleGood: { backgroundColor: 'rgba(60,180,110,0.18)', color: '#2fbf6f' },
});
