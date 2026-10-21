import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Note, Outline, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { HELP } from '../lib/help';
import { sexPrefer } from '../lib/game';
import { play } from '../lib/sound';
import { Vibration } from '../lib/vibe';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'ready' | 'count' | 'play' | 'safe' | 'lose' | 'batsu';
type End = 'who' | 'mate' | 'broke' | 'full';
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const DEEP = { bg: '#120c1d', edge: C.deep };

/**
 * ポッキーゲーム（深夜だけ）：2人で両端をくわえて交互に食べ進める。
 * 先に離した方が罰、折れたら2人とも罰、最後まで行けたらセーフ。下ネタNGの人は入らへん。組む相手はなるべく異性
 */
export default function PockyScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const P = usePenalty(members, level, night, 'pocky');
  const pool = members.map((_, i) => i).filter((i) => !members[i].ng);
  const [phase, setPhase] = useState<Phase>('intro');
  const [k, setK] = useState(0);
  const [who, setWho] = useState(pool[0] ?? 0);
  const [mate, setMate] = useState(pool[1] ?? 0);
  const [count, setCount] = useState(3);
  const [end, setEnd] = useState<End>('full');
  const [turns, setTurns] = useState(0);
  const full = useRef<number[]>(Array(members.length).fill(0)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (skipIntro) round(0);
    return () => timers.current.forEach(clearTimeout);
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
    timers.current.push(setTimeout(() => { setPhase('play'); play('coin'); }, 2400));
  };
  const losers = end === 'who' ? [who] : end === 'mate' ? [mate] : end === 'broke' ? [who, mate] : [];
  const finishRound = (e: End) => {
    setEnd(e);
    setTurns((t) => t + 1);
    if (e === 'full') {
      full[who]++;
      full[mate]++;
      setPhase('safe');
      play('fanfare');
    } else {
      setPhase('lose');
      play('buzzer');
      Vibration.vibrate([0, 80, 40, 160]);
    }
  };
  const finish = (p: number[] = P.pen) => {
    P.stats.pockyFull = full.slice();
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
        <IntroCard pal={pal} mode="pocky" tag={`${pool.length}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」`} note="ポッキー（細長いお菓子なら何でも）を用意してな" />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="スタート" onPress={() => round(0)} />;
      break;
    case 'ready':
      card = (
        <ModeCard pal={pal} center {...DEEP}>
          <Prog fg="#fff">{`第${k + 1}回戦`}</Prog>
          {duo('#fff')}
          <Note fg="#fff">{'ポッキーの両端をくわえて向かい合う。\n3・2・1で交互に食べ進める。\n先に離した方が罰、折れたら2人とも罰'}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="3・2・1でスタート" onPress={go} />;
      break;
    case 'count':
      card = (
        <ModeCard pal={pal} center {...DEEP}>
          <Prog fg="#fff">くわえて…</Prog>
          <Text style={s.count}>{count}</Text>
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>まだ食べたらアカン</Text>;
      break;
    case 'play':
      card = (
        <ModeCard pal={pal} center {...DEEP}>
          <Text style={s.go}>食べ進めろ！</Text>
          {duo('#fff')}
          <Note fg="#fff">どうなった？（周りの人が押して）</Note>
        </ModeCard>
      );
      controls = (
        <View style={{ gap: 8 }}>
          <View style={s.row}>
            <View style={{ flex: 1 }}><BigButton pal={pal} danger label={`${members[who].name}が離した`} onPress={() => finishRound('who')} /></View>
            <View style={{ flex: 1 }}><BigButton pal={pal} danger label={`${members[mate].name}が離した`} onPress={() => finishRound('mate')} /></View>
          </View>
          <View style={s.row}>
            <Outline label="折れた" fg={pal.fg} onPress={() => finishRound('broke')} style={{ flex: 1 }} />
            <View style={{ flex: 1 }}><BigButton pal={pal} label="最後まで！" onPress={() => finishRound('full')} /></View>
          </View>
        </View>
      );
      break;
    case 'safe':
      card = (
        <ModeCard pal={pal} center>
          <Text style={[s.verdict, { color: '#1f9d55' }]}>完走！</Text>
          {duo(fg)}
          <Note fg={fg}>最後まで行ったので2人とも罰なし</Note>
        </ModeCard>
      );
      controls = <RoundEnd pal={pal} next="もう1回戦" onNext={() => round(k + 1)} onEnd={() => finish()} />;
      break;
    case 'lose':
      card = (
        <ModeCard pal={pal} center bg="#1a0606" edge="#e8202a">
          <Text style={[s.verdict, { color: '#ff2a2a' }]}>{end === 'broke' ? '折れた！' : '離した！'}</Text>
          {losers.length > 1 ? duo('#f7f3ea') : <HandWho members={members} i={losers[0]} sub="の負け" fg="#f7f3ea" />}
          <Note fg="#f7f3ea">{end === 'broke' ? '折れたので2人とも罰' : `先に離した${members[losers[0]].name}が罰`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} danger label={`${losers.map((i) => members[i].name).join('と')}に罰ガチャ`} onPress={() => { P.draw(losers); setPhase('batsu'); }} />;
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
  return (
    <StageShell
      pal={pal} members={members} pen={P.pen} doer={phase === 'intro' ? -1 : who} frame={phase === 'intro' ? C.muted : phase === 'lose' ? '#ff2a2a' : colorOf(who)}
      rules={HELP.pocky.rules} meta={`ポッキーゲーム・${LEVEL_LABEL[level]}・${k + 1}回戦`} onEnd={() => finish()} onQuit={() => { timers.current.forEach(clearTimeout); onQuit(); }} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  duo: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  x: { fontFamily: F.display, fontSize: 28, color: C.deep },
  count: { fontFamily: F.display, fontSize: 130, lineHeight: 140, color: '#fff' },
  go: { fontFamily: F.display, fontSize: 44, lineHeight: 52, color: C.deep },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  verdict: { fontFamily: F.display, fontSize: 56, lineHeight: 64 },
  row: { flexDirection: 'row', gap: 8 },
});
