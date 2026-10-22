import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { IntroCard, LevelBox, ModeCard, Outline, Prog, tileColors } from '../components/ModeParts';
import { shuffle } from '../lib/game';
import { StageShell, usePenalty } from '../components/StageShell';
import { ScoreRank } from '../components/ScoreRank';
import { useHold, useReveal } from '../components/Reveal';
import { HELP } from '../lib/help';
import { play } from '../lib/sound';
import { Haptics } from '../lib/vibe';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';
import quizJson from '../data/quiz.json';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'ready' | 'q' | 'ans' | 'wrong' | 'res' | 'tally' | 'rank' | 'batsu';
type Item = { q: string; a: string[] };
const N = 10;
const TIER: Record<Level, 'easy' | 'normal' | 'hard'> = { yurume: 'easy', futsu: 'normal', jigoku: 'hard' };

/**
 * 早押し雑学クイズ：スマホを真ん中に置いて、全員が自分のエリアで早押し。押した人が4択で答える。
 * 正解+1（地獄は不正解-1）。間違えた人はその問題はもう押せへん。10問で一番点が低い人が罰（同点は全員）
 */
export default function QuizScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const P = usePenalty(members, level, night, 'quiz');
  const H = useHold();
  const RV = useReveal();
  const deck = useRef<Item[]>([]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [k, setK] = useState(0);
  const [item, setItem] = useState<Item>({ q: '', a: ['', '', '', ''] });
  const [opts, setOpts] = useState<string[]>([]);
  const [score, setScore] = useState<number[]>(() => Array(n).fill(0));
  const [locked, setLocked] = useState<number[]>([]);
  const [buzz, setBuzz] = useState(-1);
  const [miss, setMiss] = useState(-1);
  const [ok, setOk] = useState(false);
  const [pick, setPick] = useState('');
  const [losers, setLosers] = useState<number[]>([]);
  const [turns, setTurns] = useState(0);
  const wins = useRef<number[]>(Array(n).fill(0)).current;
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  useEffect(() => {
    if (skipIntro) newRound();
  }, []);

  const draw = () => {
    if (!deck.current.length) deck.current = shuffle(quizJson[TIER[level]] as Item[]);
    return deck.current.pop()!;
  };
  const newRound = () => {
    setRound((r) => r + 1);
    setK(0);
    setScore(Array(n).fill(0));
    setLosers([]);
    setPhase('ready');
  };
  const next = () => {
    const it = draw();
    setItem(it);
    setOpts(shuffle(it.a));
    setK((x) => x + 1);
    setLocked([]);
    setBuzz(-1);
    setMiss(-1);
    setPhase('q');
    play('jan');
  };
  const onBuzz = (i: number) => {
    if (phaseRef.current !== 'q' || locked.includes(i)) return;
    phaseRef.current = 'ans';
    setBuzz(i);
    setPhase('ans');
    play('pop');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };
  const answer = (o: string) => {
    setPick(o);
    if (o === item.a[0]) {
      setScore((s0) => s0.map((v, j) => (j === buzz ? v + 1 : v)));
      wins[buzz]++;
      setOk(true);
      setPhase('res');
      play('pinpon');
      return;
    }
    if (level === 'jigoku') setScore((s0) => s0.map((v, j) => (j === buzz ? v - 1 : v)));
    play('buzzer');
    setLocked([...locked, buzz]);
    setMiss(buzz);
    setPhase('wrong'); // 「不正解」の画面をはさむ
  };
  const afterWrong = () => {
    setBuzz(-1);
    if (locked.length >= n) {
      setOk(false);
      setPhase('res');
    } else setPhase('q');
  };
  const after = () => {
    if (k < N) return next();
    const min = Math.min(...score);
    setLosers(members.map((_, i) => i).filter((i) => score[i] === min));
    setTurns((t) => t + 1);
    setPhase('tally');
    H.hold('結果は…', 1800, () => { setPhase('rank'); RV.start(n); });
  };
  const finish = (p: number[] = P.pen) => {
    P.stats.quizWins = wins.slice();
    onFinish(p, turns, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const cols = n <= 2 ? 1 : n <= 8 ? 2 : 3;
  const zones = (live: boolean) => (
    <View style={s.zones}>
      {Array.from({ length: Math.ceil(n / cols) }, (_, r) => (
        <View key={r} style={s.zRow}>
          {members.slice(r * cols, r * cols + cols).map((m, c) => {
            const i = r * cols + c;
            const out = locked.includes(i);
            return (
              <Pressable key={i} onPressIn={() => live && onBuzz(i)} disabled={!live || out} style={[s.zone, { borderColor: colorOf(i), backgroundColor: alpha(colorOf(i), 0.14), opacity: out ? 0.3 : 1 }]}>
                <Text style={[s.zName, { color: fg }]} numberOfLines={1}>{m.name}</Text>
                <Text style={[s.zPt, { color: fg }]}>{`${score[i]}点${out ? '・×' : ''}`}</Text>
              </Pressable>
            );
          })}
          {Array.from({ length: cols - members.slice(r * cols, r * cols + cols).length }, (_, e) => <View key={'e' + e} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="quiz" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：${level === 'jigoku' ? '難しい問題・間違えたら-1点' : level === 'futsu' ? 'ふつうの問題' : 'かんたんな問題'}`} />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="スタート" onPress={newRound} />;
      break;
    case 'ready':
      card = (
        <ModeCard pal={pal}>
          <Prog fg={fg}>{`第${round}回戦・全${N}問`}</Prog>
          <Text style={[s.q, { color: fg }]}>スマホを真ん中に置いて</Text>
          <Text style={[s.how, { color: fg }]}>{`1. 問題が出たら、答えがわかった人は自分の名前のマスを押す\n2. 一番早く押した人が4つの答えから1つ選ぶ\n3. 正解で+1点。間違えたらその問題は×で、ほかの人がまた押せる${level === 'jigoku' ? '（地獄は-1点）' : ''}`}</Text>
          {zones(false)}
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="1問目" onPress={next} />;
      break;
    case 'q':
      card = (
        <ModeCard pal={pal}>
          <Prog fg={fg}>{`第${k}問 / ${N}`}</Prog>
          <Text style={[s.q, { color: fg }]}>{item.q}</Text>
          <Text style={[s.tip, { color: fg }]}>
            {locked.length ? `${locked.map((i) => members[i].name).join('・')}は×。` : ''}
            <Text style={s.tipB}>{locked.length ? 'ほかの人、わかったら押して！' : 'わかった人は自分の名前を押して！'}</Text>
          </Text>
          {zones(true)}
        </ModeCard>
      );
      controls = <Outline label="誰もわからん → 答えを見る" fg={pal.fg} onPress={() => { setOk(false); setBuzz(-1); setPhase('res'); }} />;
      break;
    case 'ans':
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.who, { color: fg }]}>
            <Text style={[s.whoName, { color: colorOf(buzz) }]}>{members[buzz].name}</Text>が答える！
          </Text>
          <Text style={[s.q, { color: fg }]}>{item.q}</Text>
          <Text style={[s.tip, { color: fg }]}>{`${members[buzz].name}、下の4つから`}<Text style={s.tipB}>答えを1つ押して</Text></Text>
          <View style={{ gap: 8, width: '100%' }}>
            {opts.map((o) => (
              <Pressable key={o} onPress={() => answer(o)} style={({ pressed }) => [s.opt, { borderColor: colorOf(buzz), backgroundColor: tileColors(fg).bg }, pressed && s.optDown]}>
                <Text style={[s.optT, { color: tileColors(fg).fg }]}>{o}</Text>
              </Pressable>
            ))}
          </View>
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>ほかの人は口出し禁止</Text>;
      break;
    case 'wrong': {
      const left = n - locked.length;
      card = (
        <ModeCard pal={pal} center bg="#1a0606" edge="#e8202a">
          <Text style={[s.verdict, { color: '#ff2a2a' }]}>ブッブー！</Text>
          <Text style={[s.q, { color: '#f7f3ea' }]}>{`${members[miss].name}は不正解`}</Text>
          <Text style={[s.note, { color: '#f7f3ea' }]}>{`「${pick}」は違う${level === 'jigoku' ? '（-1点）' : ''}\n${left ? `この問題はまだ${left}人が押せる` : '全員×なので答えを見る'}`}</Text>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={left ? '続ける（ほかの人が押せる）' : '答えを見る'} onPress={afterWrong} />;
      break;
    }
    case 'res':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${k}問の答え`}</Prog>
          <Text style={[s.small, { color: fg }]}>{item.q}</Text>
          <Text style={[s.small, { color: fg }]}>正解は</Text>
          <Text style={[s.ans, { color: fg }]}>{item.a[0]}</Text>
          <Text style={[s.verdict, { color: ok ? '#1f9d55' : '#ff2a2a' }]}>{ok ? `${members[buzz].name}正解！+1点` : '誰も正解できず'}</Text>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={k < N ? `次の問題（${k + 1}/${N}）` : '結果発表'} onPress={after} />;
      break;
    case 'tally':
    case 'rank':
      card = (
        <ModeCard pal={pal} bg="#1a0606" edge="#e8202a">
          <ScoreRank members={members} score={score} losers={losers} rv={RV} fg="#f7f3ea" title={`第${round}回戦の結果`} foot={`${losers.map((i) => members[i].name).join('・')}が最下位`} />
        </ModeCard>
      );
      controls = !RV.ready ? <Text style={[s.hint, { color: pal.muted }]}>タップで飛ばす</Text> : <BigButton pal={pal} danger label={`${losers.map((i) => members[i].name).join('・')}に罰ガチャ`} onPress={() => { P.draw(losers); setPhase('batsu'); }} />;
      break;
    case 'batsu':
      card = (
        <DeckStack pal={pal} minHeight={0}>
          <GachaCard pal={pal} members={members} items={P.gacha} />
        </DeckStack>
      );
      controls = <RoundEnd pal={pal} next={P.lucky ? 'ラッキー！もう1回戦' : '受け入れてもう1回戦'} onNext={() => { P.apply(); newRound(); }} onEnd={() => finish(P.apply())} />;
      break;
  }
  const hv = H.view(pal);
  if (hv) { card = hv.card; controls = hv.controls; }
  return (
    <StageShell
      pal={pal} members={members} pen={P.pen} doer={phase === 'ans' ? buzz : -1} frame={phase === 'intro' ? C.muted : phase === 'ans' ? colorOf(buzz) : '#8d857a'}
      rules={HELP.quiz.rules} meta={`早押し雑学クイズ・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={onQuit} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  q: { fontFamily: F.display, fontSize: 22, lineHeight: 30, textAlign: 'center', marginVertical: 6 },
  small: { fontSize: 14, fontWeight: '800', opacity: 0.7, textAlign: 'center' },
  ans: { fontFamily: F.display, fontSize: 34, lineHeight: 42, textAlign: 'center' },
  verdict: { fontFamily: F.display, fontSize: 30, lineHeight: 38 },
  note: { fontSize: 12, fontWeight: '700', opacity: 0.7, textAlign: 'center', marginTop: 6 },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  how: { fontSize: 13, lineHeight: 21, fontWeight: '700', alignSelf: 'stretch' },
  tip: { fontSize: 14, lineHeight: 21, textAlign: 'center', fontWeight: '700' },
  tipB: { color: '#e8202a', fontWeight: '900' },
  who: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  whoName: { fontFamily: F.display, fontSize: 30 },
  zones: { flex: 1, width: '100%', gap: 8 },
  zRow: { flex: 1, flexDirection: 'row', gap: 8 },
  zone: { flex: 1, minHeight: 56, borderWidth: 3, borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  zName: { fontFamily: F.display, fontSize: 20 },
  zPt: { fontSize: 13, fontWeight: '900' },
  opt: { borderWidth: 2, borderBottomWidth: 6, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14 },
  optDown: { borderBottomWidth: 3, marginTop: 3 },
  optT: { fontSize: 17, fontWeight: '900' },
});
