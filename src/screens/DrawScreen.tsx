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
type Phase = 'intro' | 'hand' | 'pic' | 'guess' | 'reveal' | 'batsu';
type Step = { by: number; type: 'pic' | 'guess'; val: string };
const SEC: Record<Level, number> = { yurume: 60, futsu: 40, jigoku: 25 };
const WORDS: string[] = Object.values((dekoJson as { cats: Record<string, string[]> }).cats).flat();
const W = 300; // 絵の座標（0〜300 の正方形）
const norm = (t: string) => t.replace(/[\s　・ー〜~、。!！?？]/g, '').toLowerCase();

/** 手描きのキャンバス。線は「M x y L x y …」の文字列で覚える */
function Canvas({ onChange, clearKey }: { onChange: (paths: string[]) => void; clearKey: number }) {
  const [paths, setPaths] = useState<string[]>([]);
  const cur = useRef('');
  const size = useRef(1);
  useEffect(() => {
    setPaths([]);
    onChange([]);
  }, [clearKey]);
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
  const [culprit, setCulprit] = useState<number | null>(null);
  const [turns, setTurns] = useState(0);
  const [guess, setGuess] = useState('');
  const [clearKey, setClearKey] = useState(0);
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
    if (n % 2) od.push(od[1]); // 奇数人数やと最後が絵で終わるので、2番目の人がもう一回だけ言葉で答える
    setOrder(od);
    setWord(deck.current.pop()!);
    setChain([]);
    setStep(0);
    setCulprit(null);
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
          <Canvas clearKey={clearKey} onChange={(p) => (paths.current = p)} />
          <Text style={[s.time, { color: fg }]}>{`のこり ${clock.left} 秒`}</Text>
        </ModeCard>
      );
      controls = (
        <View style={s.row}>
          <Outline label="全部消す" fg={pal.fg} onPress={() => { paths.current = []; setClearKey((x) => x + 1); }} style={{ flex: 1 }} />
          <View style={{ flex: 1 }}><BigButton pal={pal} label="完成！" onPress={() => submit('pic', JSON.stringify(paths.current))} /></View>
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
            {same ? <Text style={[s.verdict, { color: '#1f9d55' }]}>完璧！</Text> : (
              <>
                <Text style={[s.src, { color: fg }]}>どこでズレた？</Text>
                <View style={s.chips}>
                  {[...new Set(chain.map((x) => x.by))].map((w) => (
                    <Pressable key={w} onPress={() => setCulprit(culprit === w ? null : w)} style={[s.chip, { borderColor: colorOf(w) }, culprit === w && { backgroundColor: '#e8202a', borderColor: '#e8202a' }]}>
                      <Text style={[s.chipT, { color: culprit === w ? '#fff' : fg }]}>{members[w].name}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </ModeCard>
      );
      controls = same ? (
        <RoundEnd pal={pal} next="もう1回戦" onNext={newRound} onEnd={() => finish()} />
      ) : culprit != null ? (
        <BigButton pal={pal} danger label={`ズラした${members[culprit].name}に罰ガチャ`} onPress={() => { P.draw([culprit]); setPhase('batsu'); }} />
      ) : (
        <Outline label="みんなセーフにする → 次の回戦" fg={pal.fg} onPress={newRound} />
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
  by: { fontSize: 12, fontWeight: '900' },
  word: { fontFamily: F.display, fontSize: 26, lineHeight: 34 },
  verdict: { fontFamily: F.display, fontSize: 44, lineHeight: 52 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5 },
  chipT: { fontSize: 14, fontWeight: '900' },
});
