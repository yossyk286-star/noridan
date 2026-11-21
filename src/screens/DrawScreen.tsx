import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Note, Outline, Prog } from '../components/ModeParts';
import { shuffle } from '../lib/game';
import { StageShell, usePenalty } from '../components/StageShell';
import { HELP } from '../lib/help';
import { useCountdown } from '../lib/useCountdown';
import { play } from '../lib/sound';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';
import dekoJson from '../data/deko.json';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'hand' | 'pic' | 'guess' | 'reveal' | 'judge' | 'batsu';
type Step = { by: number; type: 'pic' | 'guess'; val: string };
const SEC: Record<Level, number> = { yurume: 60, futsu: 40, jigoku: 25 };
const WORDS: string[] = Object.values((dekoJson as { cats: Record<string, string[]> }).cats).flat();
const W = 300; // 絵の座標（0〜300 の正方形）
const norm = (t: string) => t.replace(/[\s　・ー〜~、。!！?？]/g, '').toLowerCase();

/** 手描きのキャンバス。線は「M x y L x y …」の文字列で覚える */
function Canvas({ onChange, clearKey, undoKey }: { onChange: (paths: string[]) => void; clearKey: number; undoKey: number }) {
  const [paths, setPaths] = useState<string[]>([]);
  const cur = useRef('');
  const size = useRef(1);
  useEffect(() => {
    setPaths([]);
    onChange([]);
  }, [clearKey]);
  // 「戻す」：最後の1本だけ消す
  useEffect(() => {
    if (!undoKey) return;
    setPaths((p) => {
      const n = p.slice(0, -1);
      onChange(n);
      return n;
    });
  }, [undoKey]);
  const pr = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false, // 描いてる途中でスクロールに取られへんように
        onPanResponderGrant: (e) => {
          const k = W / size.current;
          cur.current = `M${(e.nativeEvent.locationX * k).toFixed(1)} ${(e.nativeEvent.locationY * k).toFixed(1)}`;
          setPaths((p) => [...p, cur.current]);
        },
        onPanResponderMove: (e) => {
          const k = W / size.current;
          cur.current += ` L${(e.nativeEvent.locationX * k).toFixed(1)} ${(e.nativeEvent.locationY * k).toFixed(1)}`;
          setPaths((p) => [...p.slice(0, -1), cur.current]);
        },
        onPanResponderRelease: () => setPaths((p) => (onChange(p), p)),
      }),
    [],
  );
  return (
    <View style={s.canvas} onLayout={(e) => (size.current = e.nativeEvent.layout.width)} {...pr.panHandlers}>
      <Pic val={JSON.stringify(paths)} />
    </View>
  );
}
function Pic({ val }: { val: string }) {
  let paths: string[] = [];
  try {
    paths = JSON.parse(val);
  } catch {}
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${W}`} pointerEvents="none">
      <Rect x={0} y={0} width={W} height={W} fill="#fff" />
      {paths.map((d, i) => <Path key={i} d={d} stroke="#141210" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
    </Svg>
  );
}

/**
 * お絵かき伝言：お題 → 絵 → 言葉 → 絵 … を1人ずつリレー（自分の番は前の人の絵か言葉だけ見る）。
 * 最後にお題から順番に見せて、お題と同じなら全員セーフ、違ったらズラした人を選んで罰
 */
export default function DrawScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const sec = SEC[level];
  const P = usePenalty(members, level, night, 'draw');
  const deck = useRef<string[]>([]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [order, setOrder] = useState<number[]>([]);
  const [word, setWord] = useState('');
  const [chain, setChain] = useState<Step[]>([]);
  const [step, setStep] = useState(0);
  /** 戦犯（何人でも。空なら全員セーフ） */
  const [culprits, setCulprits] = useState<number[]>([]);
  const [turns, setTurns] = useState(0);
  const [guess, setGuess] = useState('');
  const [clearKey, setClearKey] = useState(0);
  const [undoKey, setUndoKey] = useState(0);
  const paths = useRef<string[]>([]);
  const clock = useCountdown(() => submit('pic', JSON.stringify(paths.current)));
  useEffect(() => {
    if (skipIntro) newRound();
  }, []);

  const newRound = () => {
    if (!deck.current.length) deck.current = shuffle(WORDS);
    const r = round + 1;
    const s0 = (r - 1) % n;
    setRound(r);
    const od = members.map((_, k) => (s0 + k) % n);
    if (n % 2) od.push(od[1]); // 奇数人数やと最後が絵で終わるので、2番目の人がもう1回だけ言葉で答える
    setOrder(od);
    setWord(deck.current.pop()!);
    setChain([]);
    setStep(0);
    setCulprits([]);
    setPhase('hand');
    play('flip');
  };
  const kind = (st: number) => (st % 2 === 0 ? 'pic' : 'guess');
  const submit = (type: 'pic' | 'guess', val: string) => {
    clock.stop();
    const nc = [...chain, { by: order[step], type, val }];
    setChain(nc);
    if (step + 1 >= order.length) {
      setPhase('reveal');
      setTurns((t) => t + 1);
      play('fanfare');
    } else {
      setStep(step + 1);
      setPhase('hand');
      play('flip');
    }
  };
  const finish = (p: number[] = P.pen) => {
    clock.stop();
    onFinish(p, turns, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const who = order[step] ?? 0;
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="draw" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：絵を描く時間は${sec}秒`} />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="スタート" onPress={newRound} />;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦・${step + 1}/${order.length}番目`}</Prog>
          <HandWho members={members} i={who} sub={kind(step) === 'pic' ? 'が絵を描く' : 'が言葉で答える'} fg={fg} />
          <Note fg={fg}>{`${step === 0 ? 'お題を見て絵を描く。文字は書いたらアカン' : kind(step) === 'pic' ? '前の人の言葉だけ見て、絵を描く' : '前の人の絵だけ見て、何の絵か書く'}\nほかの人は見たらアカン`}</Note>
        </ModeCard>
      );
      controls = (
        <BigButton
          pal={pal}
          label={`${members[who].name}が受け取った`}
          onPress={() => {
            if (kind(step) === 'pic') {
              paths.current = [];
              setClearKey((x) => x + 1);
              setPhase('pic');
              clock.start(sec);
            } else {
              setGuess('');
              setPhase('guess');
            }
          }}
        />
      );
      break;
    case 'pic':
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.src, { color: fg }]}>{step === 0 ? `お題：${word}` : `「${chain[step - 1].val}」を描いて`}</Text>
          <Canvas clearKey={clearKey} undoKey={undoKey} onChange={(p) => (paths.current = p)} />
          <Text style={[s.time, { color: fg }]}>{`のこり ${clock.left} 秒`}</Text>
        </ModeCard>
      );
      controls = (
        <View style={s.row}>
          <Outline label="戻す" fg={pal.fg} onPress={() => setUndoKey((x) => x + 1)} style={{ flex: 1 }} />
          <Outline label="全部消す" fg={pal.fg} onPress={() => { paths.current = []; setClearKey((x) => x + 1); }} style={{ flex: 1.1 }} />
          <View style={{ flex: 1.3 }}><BigButton pal={pal} label="完成！" onPress={() => submit('pic', JSON.stringify(paths.current))} /></View>
        </View>
      );
      break;
    case 'guess':
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.src, { color: fg }]}>これは何の絵？</Text>
          <View style={s.canvas}><Pic val={chain[step - 1].val} /></View>
          <TextInput value={guess} onChangeText={setGuess} maxLength={20} placeholder="1語で書いて" placeholderTextColor="#8d857a" style={[s.input, { color: fg, borderColor: fg }]} />
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="決定" disabled={!guess.trim()} onPress={() => submit('guess', guess.trim())} />;
      break;
    case 'reveal': {
      const last = chain[chain.length - 1];
      const same = last?.type === 'guess' && norm(last.val) === norm(word);
      card = (
        <ModeCard pal={pal}>
          <ScrollView contentContainerStyle={{ gap: 10, alignItems: 'center' }}>
            <Prog fg={fg}>答え合わせ</Prog>
            <Text style={[s.by, { color: fg }]}>お題</Text>
            <Text style={[s.word, { color: fg }]}>{word}</Text>
            {chain.map((x, i) => (
              <View key={i} style={{ alignItems: 'center', gap: 4, width: '100%' }}>
                <Text style={[s.by, { color: colorOf(x.by) }]}>{members[x.by].name}</Text>
                {x.type === 'pic' ? <View style={[s.canvas, { width: '70%' }]}><Pic val={x.val} /></View> : <Text style={[s.word, { color: fg }]}>{x.val}</Text>}
              </View>
            ))}
            {same && <Text style={[s.verdict, { color: '#1f9d55' }]}>完璧！</Text>}
          </ScrollView>
        </ModeCard>
      );
      controls = same ? (
        <RoundEnd pal={pal} next="もう1回戦" onNext={newRound} onEnd={() => finish()} />
      ) : (
        <BigButton pal={pal} label="戦犯を決める →" onPress={() => { setCulprits([]); setPhase('judge'); play('flip'); }} />
      );
      break;
    }
    case 'judge': {
      // お題が終わるたびに「戦犯は誰？」。ズラした人を何人でも選べる。だれも選ばんかったら全員セーフ
      const last = chain[chain.length - 1];
      const ws = [...new Set(chain.map((x) => x.by))];
      const did = (w: number) => chain.filter((x) => x.by === w).map((x) => (x.type === 'pic' ? '絵' : `「${x.val}」`)).join('・');
      card = (
        <ModeCard pal={pal}>
          <ScrollView contentContainerStyle={{ gap: 10, alignItems: 'center' }}>
            <Prog fg={fg}>{`第${round}回戦`}</Prog>
            <Text style={[s.by, { color: fg, fontSize: 15, opacity: 0.8 }]}>{`お題「${word}」→ 最後は「${last?.type === 'guess' ? last.val : '絵'}」`}</Text>
            <Text style={s.q}>戦犯は誰？</Text>
            <Text style={[s.by, { color: fg, opacity: 0.75 }]}>ズラしたと思う人を押して（何人でも）</Text>
            <View style={s.pick}>
              {ws.map((w) => {
                const on = culprits.includes(w);
                return (
                  <Pressable key={w} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { play('tick'); setCulprits(on ? culprits.filter((x) => x !== w) : [...culprits, w]); }} style={[s.pickBtn, { borderColor: on ? '#e8202a' : colorOf(w) }, on && { backgroundColor: '#e8202a' }]}>
                    {on && <Text style={s.pickTag}>戦犯</Text>}
                    <Text style={[s.pickName, { color: on ? '#fff' : fg }]} numberOfLines={1} adjustsFontSizeToFit>{members[w].name}</Text>
                    <Text style={[s.pickSub, { color: on ? '#fff' : fg }]} numberOfLines={1}>{did(w)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={() => setPhase('reveal')} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={[s.by, { color: fg, textDecorationLine: 'underline' }]}>答えをもう1回見る</Text>
            </Pressable>
          </ScrollView>
        </ModeCard>
      );
      controls = culprits.length ? (
        <BigButton pal={pal} danger label={`戦犯の${culprits.map((w) => members[w].name).join('・')}に罰ガチャ`} onPress={() => { P.draw([...culprits]); setPhase('batsu'); }} />
      ) : (
        <BigButton pal={pal} label="戦犯なし！全員セーフ → 次の回戦" onPress={newRound} />
      );
      break;
    }
    case 'batsu':
      card = (
        <DeckStack pal={pal} minHeight={0}>
          <GachaCard pal={pal} members={members} items={P.gacha} />
        </DeckStack>
      );
      controls = <RoundEnd pal={pal} next={P.lucky ? 'ラッキー！もう1回戦' : '受け入れてもう1回戦'} onNext={() => { P.apply(); newRound(); }} onEnd={() => finish(P.apply())} />;
      break;
  }
  return (
    <StageShell
      pal={pal} members={members} pen={P.pen} doer={phase === 'hand' || phase === 'pic' || phase === 'guess' ? who : -1} frame={phase === 'intro' ? C.muted : colorOf(who)}
      rules={HELP.draw.rules} meta={`お絵かき伝言・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={() => { clock.stop(); onQuit(); }} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  src: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  canvas: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' },
  time: { fontSize: 15, fontWeight: '900', textAlign: 'center' },
  input: { borderWidth: 2, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  by: { fontSize: 13, fontWeight: '900' },
  word: { fontFamily: F.display, fontSize: 26, lineHeight: 34 },
  verdict: { fontFamily: F.display, fontSize: 44, lineHeight: 52 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5 },
  chipT: { fontSize: 14, fontWeight: '900' },
  q: { fontFamily: F.display, fontSize: 40, lineHeight: 48, color: '#e8202a', textAlign: 'center' },
  pick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  pickBtn: { width: '48%', flexGrow: 1, minHeight: 64, borderRadius: 14, borderWidth: 2.5, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pickTag: { fontSize: 11, fontWeight: '900', color: '#e8202a', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 8, overflow: 'hidden' },
  pickName: { fontFamily: F.display, fontSize: 20, lineHeight: 26 },
  pickSub: { fontSize: 12, fontWeight: '900', opacity: 0.75 },
});
