import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Note, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { HELP } from '../lib/help';
import { useHold } from '../components/Reveal';
import { sexPrefer } from '../lib/game';
import { play } from '../lib/sound';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'ready' | 'count' | 'hug' | 'res' | 'batsu';
const SEC: Record<Level, number> = { yurume: 5, futsu: 10, jigoku: 15 };
const TOL: Record<Level, number> = { yurume: 1.5, futsu: 1, jigoku: 0.5 };
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const DEEP = { bg: '#120c1d', edge: C.deep };

/**
 * ハグタイム当て（深夜だけ）：2人でハグして、目をつぶったまま「ちょうど○秒」で離れる。
 * 周りの人が離れた瞬間を押す。ズレが大きかったら2人とも罰。下ネタNGの人は入らへん。組む相手はなるべく異性
 */
export default function HugScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const P = usePenalty(members, level, night, 'hug');
  const H = useHold();
  const pool = members.map((_, i) => i).filter((i) => !members[i].ng);
  const sec = SEC[level];
  const tol = TOL[level];
  const [phase, setPhase] = useState<Phase>('intro');
  const [k, setK] = useState(0);
  const [who, setWho] = useState(pool[0] ?? 0);
  const [mate, setMate] = useState(pool[1] ?? 0);
  const [count, setCount] = useState(3);
  const [t, setT] = useState(0);
  const [turns, setTurns] = useState(0);
  const best = useRef<(number | null)[]>(Array(members.length).fill(null)).current;
  const start = useRef(0);
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => {
    if (skipIntro) round(0);
    return clear;
  }, []);

  const round = (next: number) => {
    const w = pool[next % pool.length];
    const c = sexPrefer(members, w, pool.filter((i) => i !== w));
    const c2 = c.filter((i) => i !== mate);
    setK(next);
    setWho(w);
    setMate(pick(c2.length ? c2 : c));
    setPhase('ready');
    play('jan');
  };
  const go = () => {
    setPhase('count');
    setCount(3);
    play('heart');
    [1, 2].forEach((j) => timers.current.push(setTimeout(() => { setCount(3 - j); play('heart'); }, j * 800)));
    timers.current.push(setTimeout(() => {
      start.current = Date.now();
      phaseRef.current = 'hug';
      setPhase('hug');
      play('coin');
      // 目標の3倍たっても離れへんかったら自動で止める
      timers.current.push(setTimeout(() => stop(), sec * 3000));
    }, 2400));
  };
  const diff = Math.abs(t - sec);
  const ok = diff <= tol;
  const stop = () => {
    if (phaseRef.current !== 'hug') return;
    phaseRef.current = 'res';
    clear();
    const v = (Date.now() - start.current) / 1000;
    const d = Math.abs(v - sec);
    setT(v);
    setTurns((x) => x + 1);
    [who, mate].forEach((i) => (best[i] = best[i] == null ? d : Math.min(best[i]!, d)));
    H.hold('結果は…', 1600, () => {
      setPhase('res');
      play(d <= tol ? 'pinpon' : 'buzzer');
    });
  };
  const finish = (p: number[] = P.pen) => {
    clear();
    P.stats.hugBest = best.slice();
    onFinish(p, turns, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const duo = (col: string) => (
    <View style={s.duo}>
      <View style={{ flex: 1 }}><HandWho members={members} i={who} fg={col} /></View>
      <Text style={s.x}>×</Text>
      <View style={{ flex: 1 }}><HandWho members={members} i={mate} fg={col} /></View>
    </View>
  );
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="hug" tag={`${pool.length}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：ちょうど${sec}秒（±${tol}秒ならセーフ）`} />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="スタート" onPress={() => round(0)} />;
      break;
    case 'ready':
      card = (
        <ModeCard pal={pal} center {...DEEP}>
          <Prog fg="#fff">{`第${k + 1}回戦`}</Prog>
          {duo('#fff')}
          <Text style={s.lim}>{sec}秒</Text>
          <Text style={s.small}>ちょうどで離れる</Text>
          <Note fg="#fff">{'3・2・1でハグ。目をつぶって心の中で数える。\n2人で「今や」と思ったら離れる。\nスマホは周りの人が持ってな'}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="3・2・1でハグ" onPress={go} />;
      break;
    case 'count':
      card = (
        <ModeCard pal={pal} center {...DEEP}>
          <Prog fg="#fff">くっついて…</Prog>
          <Text style={s.count}>{count}</Text>
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>0でハグ開始</Text>;
      break;
    case 'hug':
      card = (
        <ModeCard pal={pal} center {...DEEP}>
          <Text style={s.go}>ハグ中…</Text>
          {duo('#fff')}
          <Text style={s.target}>{`目標 ${sec}秒`}</Text>
          <Note fg="#fff">時間は出えへん。周りの人は、2人が離れた瞬間に押して</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} danger label="離れた！" onPress={stop} />;
      break;
    case 'res':
      card = (
        <ModeCard pal={pal} center bg={ok ? undefined : '#1a0606'} edge={ok ? undefined : '#e8202a'}>
          <Prog fg={ok ? fg : '#f7f3ea'}>{`目標 ${sec}秒`}</Prog>
          <Text style={[s.num, { color: ok ? fg : '#ff3b3b' }]}>
            {t.toFixed(2)}
            <Text style={s.unit}> 秒</Text>
          </Text>
          <Text style={[s.verdict, { color: ok ? '#1f9d55' : '#ff2a2a' }]}>{ok ? (diff <= 0.2 ? 'ピッタリ！' : 'セーフ！') : 'ズレすぎ！'}</Text>
          <Note fg={ok ? fg : '#f7f3ea'}>{`ズレ ${diff.toFixed(2)}秒（±${tol}秒まで）${ok ? '' : `\n${members[who].name}と${members[mate].name}は2人とも罰`}`}</Note>
        </ModeCard>
      );
      controls = ok ? (
        <RoundEnd pal={pal} next="もう1回戦" onNext={() => round(k + 1)} onEnd={() => finish()} />
      ) : (
        <BigButton pal={pal} danger label={`${members[who].name}と${members[mate].name}に罰ガチャ`} onPress={() => { P.draw([who, mate]); setPhase('batsu'); }} />
      );
      break;
    case 'batsu':
      card = (
        <DeckStack pal={pal} minHeight={0}>
          <GachaCard pal={pal} members={members} items={P.gacha} />
        </DeckStack>
      );
      controls = <RoundEnd pal={pal} next={P.lucky ? 'ラッキー！もう1回戦' : '受け入れてもう1回戦'} onNext={() => { P.apply(); round(k + 1); }} onEnd={() => finish(P.apply())} />;
      break;
  }
  const hv = H.view(pal);
  if (hv) { card = hv.card; controls = hv.controls; }
  return (
    <StageShell
      pal={pal} members={members} pen={P.pen} doer={phase === 'intro' ? -1 : who} frame={phase === 'intro' ? C.muted : phase === 'res' && !ok ? '#ff2a2a' : colorOf(who)}
      rules={HELP.hug.rules} meta={`ハグタイム当て・${LEVEL_LABEL[level]}・${k + 1}回戦`} onEnd={() => finish()} onQuit={() => { clear(); onQuit(); }} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  duo: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  x: { fontFamily: F.display, fontSize: 28, color: C.deep },
  lim: { fontFamily: F.display, fontSize: 44, lineHeight: 50, color: '#fff' },
  small: { fontSize: 12, fontWeight: '700', opacity: 0.65, color: '#fff' },
  count: { fontFamily: F.display, fontSize: 130, lineHeight: 140, color: '#fff' },
  go: { fontFamily: F.display, fontSize: 44, lineHeight: 52, color: C.deep },
  target: { fontFamily: F.display, fontSize: 24, lineHeight: 30, color: '#fff' },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  num: { fontFamily: F.display, fontSize: 84, lineHeight: 92, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 22, opacity: 0.6 },
  verdict: { fontFamily: F.display, fontSize: 36, lineHeight: 44 },
});
