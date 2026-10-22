import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Prog, Note } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { ScoreRank } from '../components/ScoreRank';
import { Skull } from '../components/Fx';
import { useHold, useReveal } from '../components/Reveal';
import { HELP } from '../lib/help';
import { useCountdown } from '../lib/useCountdown';
import { play } from '../lib/sound';
import { Haptics, Vibration } from '../lib/vibe';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'hand' | 'play' | 'turn' | 'tally' | 'rank' | 'batsu';
type Hole = { skull: boolean; id: number } | null;
const SEC = 15;
const LV: Record<Level, { every: number; life: number; skull: number }> = { yurume: { every: 650, life: 950, skull: 0.12 }, futsu: { every: 520, life: 780, skull: 0.18 }, jigoku: { every: 400, life: 620, skull: 0.26 } };

/** ワニワニタップ：1人15秒。穴から出てくる顔をタップで1点、ドクロは押すたびにマイナス1点。一番低い人（同点は全員）が罰 */
export default function WhackScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const lv = LV[level];
  const P = usePenalty(members, level, night, 'whack');
  const H = useHold();
  const RV = useReveal();
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [k, setK] = useState(0);
  const [holes, setHoles] = useState<Hole[]>(() => Array(9).fill(null));
  const [score, setScore] = useState<number[]>(() => Array(n).fill(0));
  const [skulls, setSkulls] = useState<number[]>(() => Array(n).fill(0));
  const [losers, setLosers] = useState<number[]>([]);
  const [turns, setTurns] = useState(0);
  const best = useRef<number[]>(Array(n).fill(0)).current;
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  const holesRef = useRef<Hole[]>(Array(9).fill(null));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const who = k % n;
  const clock = useCountdown(() => end());
  useEffect(() => {
    if (skipIntro) newRound();
    return clear;
  }, []);

  const setH = (h: Hole[]) => {
    holesRef.current = h;
    setHoles(h);
  };
  const newRound = () => {
    setRound((r) => r + 1);
    setScore(Array(n).fill(0));
    setSkulls(Array(n).fill(0));
    setLosers([]);
    setK(0);
    setPhase('hand');
  };
  const go = () => {
    setH(Array(9).fill(null));
    phaseRef.current = 'play';
    setPhase('play');
    play('coin');
    clock.start(SEC);
    const spawn = () => {
      if (phaseRef.current !== 'play') return;
      const empty = holesRef.current.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      if (empty.length) {
        const i = empty[Math.floor(Math.random() * empty.length)];
        const id = Math.random();
        const h = holesRef.current.slice();
        h[i] = { skull: Math.random() < lv.skull, id };
        setH(h);
        timers.current.push(setTimeout(() => {
          if (phaseRef.current === 'play' && holesRef.current[i]?.id === id) {
            const h2 = holesRef.current.slice();
            h2[i] = null;
            setH(h2);
          }
        }, lv.life * (0.8 + Math.random() * 0.4)));
      }
      timers.current.push(setTimeout(spawn, lv.every * (0.7 + Math.random() * 0.6)));
    };
    timers.current.push(setTimeout(spawn, 300));
  };
  const tap = (i: number) => {
    if (phaseRef.current !== 'play') return;
    const h = holesRef.current[i];
    if (!h) return;
    const h2 = holesRef.current.slice();
    if (h.skull) {
      // ドクロは押すたびにマイナス1点（終わりにはならへん）
      h2[i] = null;
      setH(h2);
      setSkulls((x) => x.map((v, j) => (j === who ? v + 1 : v)));
      setScore((s0) => s0.map((v, j) => (j === who ? v - 1 : v)));
      play('buzzer');
      Vibration.vibrate([0, 80, 40, 120]);
      return;
    }
    h2[i] = null;
    setH(h2);
    setScore((s0) => s0.map((v, j) => (j === who ? v + 1 : v)));
    play('pop');
    Haptics.selectionAsync().catch(() => {});
  };
  const end = () => {
    if (phaseRef.current !== 'play') return;
    phaseRef.current = 'turn';
    clock.stop();
    clear();
    play('timeup');
    setTurns((t) => t + 1);
    setPhase('turn');
  };
  const after = () => {
    best[who] = Math.max(best[who], score[who]);
    if (k + 1 < n) {
      setK(k + 1);
      setPhase('hand');
      return;
    }
    const min = Math.min(...score);
    const lo = members.map((_, i) => i).filter((i) => score[i] === min);
    setLosers(lo);
    setPhase('tally');
    H.hold('結果は…', 1800, () => { setPhase('rank'); RV.start(n); });
  };
  const finish = (p: number[] = P.pen) => {
    clock.stop();
    clear();
    P.stats.whackBest = best.slice();
    onFinish(p, turns, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="whack" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：${level === 'jigoku' ? '速い・ドクロ多め' : level === 'futsu' ? 'ふつうの速さ' : 'ゆっくり・ドクロ少なめ'}`} />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="スタート" onPress={newRound} />;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦・${k + 1}/${n}人目`}</Prog>
          <HandWho members={members} i={who} sub="の番" fg={fg} />
          <Note fg={fg}>{'出てきた顔をタップで1点。\nドクロを押したらマイナス1点'}</Note>
          <Text style={[s.lim, { color: fg }]}>{SEC}秒</Text>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="スタート" onPress={go} />;
      break;
    case 'play':
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.time, { color: fg }]}>
            {`${clock.left}秒・${score[who]}点`}
            {skulls[who] > 0 && <Text style={{ color: '#e8202a' }}>{`  ドクロ ${skulls[who]}`}</Text>}
          </Text>
          <View style={s.grid}>
            {holes.map((h, i) => (
              <Pressable key={i} onPressIn={() => tap(i)} style={s.cell}>
                <View style={s.hole} />
                {h && (h.skull ? <View style={s.skull}><Skull /></View> : (
                  <View style={s.face}>
                    <View style={[s.eye, { left: '28%' }]} />
                    <View style={[s.eye, { right: '28%' }]} />
                    <View style={s.mouth} />
                  </View>
                ))}
              </Pressable>
            ))}
          </View>
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>顔だけタップ！ドクロはアカン</Text>;
      break;
    case 'turn': {
      const sk = skulls[who];
      card = (
        <ModeCard pal={pal} center bg={sk ? '#1a0606' : undefined} edge={sk ? '#e8202a' : undefined}>
          <Prog fg={sk ? '#f7f3ea' : fg}>{`${members[who].name}の結果`}</Prog>
          <Text style={[s.num, { color: sk ? '#f7f3ea' : fg }]}>{score[who]}<Text style={s.unit}> 点</Text></Text>
          {sk ? <Text style={[s.verdict, { color: '#ff2a2a' }]}>{`ドクロ ${sk}回`}</Text> : <Note fg={fg}>ドクロはセーフ！</Note>}
          {sk > 0 && <Note fg="#f7f3ea">{`${sk}点マイナス`}</Note>}
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={k + 1 < n ? `次は${members[(who + 1) % n].name}` : '結果発表'} onPress={after} />;
      break;
    }
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
      pal={pal} members={members} pen={P.pen} doer={phase === 'hand' || phase === 'play' ? who : -1} frame={phase === 'intro' ? C.muted : colorOf(who)}
      rules={HELP.whack.rules} meta={`ワニワニタップ・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={() => { clock.stop(); clear(); onQuit(); }} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  lim: { fontFamily: F.display, fontSize: 44, lineHeight: 50 },
  time: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignContent: 'space-around' },
  cell: { width: '31%', aspectRatio: 1, alignItems: 'center', justifyContent: 'flex-end', borderRadius: 18, overflow: 'hidden', backgroundColor: '#6aad42' },
  hole: { position: 'absolute', bottom: '8%', width: '80%', height: '26%', borderRadius: 999, backgroundColor: '#1e140d' },
  face: { width: '60%', height: '72%', marginBottom: '16%', borderRadius: 999, backgroundColor: '#ffd23f', borderWidth: 3, borderColor: '#141210' },
  eye: { position: 'absolute', top: '34%', width: '12%', height: '16%', borderRadius: 99, backgroundColor: '#141210' },
  mouth: { position: 'absolute', left: '32%', right: '32%', top: '60%', height: '14%', borderBottomLeftRadius: 99, borderBottomRightRadius: 99, backgroundColor: '#e8202a' },
  skull: { width: '74%', height: '74%', marginBottom: '8%', alignItems: 'center', justifyContent: 'center' },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  verdict: { fontFamily: F.display, fontSize: 44, lineHeight: 52 },
  num: { fontFamily: F.display, fontSize: 84, lineHeight: 92 },
  unit: { fontSize: 20, opacity: 0.6 },
});
