import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Animated, Easing, StyleSheet, Text, View, Vibration } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Note, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { HELP } from '../lib/help';
import { play } from '../lib/sound';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';
import bpassJson from '../data/bpass.json';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'ready' | 'play' | 'boom' | 'batsu';
const SEC: Record<Level, [number, number]> = { yurume: [15, 30], futsu: [10, 24], jigoku: [6, 16] };
const TOPICS = (bpassJson as { topics: string[] }).topics;

/** 爆弾パス：お題に合うものを言えたら次の人へ手渡し。いつ爆発するか分からん。爆発した時に持ってた人が罰 */
export default function BpassScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const P = usePenalty(members, level, night, 'bpass');
  const [phase, setPhase] = useState<Phase>('intro');
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  const [round, setRound] = useState(1);
  const [topic, setTopic] = useState('');
  const [holder, setHolder] = useState(0);
  const [passes, setPasses] = useState(0);
  const [turns, setTurns] = useState(0);
  const used = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (skipIntro) newRound(1);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    if (phase !== 'play') return;
    const a = Animated.loop(Animated.sequence([
      Animated.timing(wob, { toValue: 1, duration: 250, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(wob, { toValue: -1, duration: 250, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [phase]);

  const pickTopic = () => {
    let left = TOPICS.filter((t) => !used.current.includes(t));
    if (!left.length) { used.current = []; left = TOPICS; }
    const t = left[Math.floor(Math.random() * left.length)];
    used.current.push(t);
    return t;
  };
  const newRound = (r: number) => {
    setRound(r);
    setTopic(pickTopic());
    setHolder((r - 1) % n);
    setPasses(0);
    setPhase('ready');
  };
  const go = () => {
    const [a, b] = SEC[level];
    const start = Date.now();
    const end = start + (a + Math.random() * (b - a)) * 1000;
    setPhase('play');
    phaseRef.current = 'play';
    play('coin');
    // チクタク：経過時間でだんだん速くなる（残り時間はバレへん）
    const tick = () => {
      if (phaseRef.current !== 'play') return;
      const now = Date.now();
      if (now >= end) {
        setPhase('boom');
        play('boom');
        Vibration.vibrate([0, 200, 80, 300]);
        return;
      }
      play('tick');
      const el = (now - start) / 1000;
      timer.current = setTimeout(tick, Math.max(140, 650 - el * (level === 'jigoku' ? 45 : 28)));
    };
    timer.current = setTimeout(tick, 400);
  };
  const pass = () => {
    if (phaseRef.current !== 'play') return;
    setHolder((h) => (h + 1) % n);
    setPasses((p) => p + 1);
    setTurns((t) => t + 1);
    play('pop');
  };
  const finish = (p: number[] = P.pen) => {
    if (timer.current) clearTimeout(timer.current);
    phaseRef.current = 'intro';
    onFinish(p, turns, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const next = members[(holder + 1) % n].name;
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="bpass" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：爆発まで${SEC[level][0]}〜${SEC[level][1]}秒のどこか`} />
          <View style={s.safe}>
            <Text style={s.safeTitle}>⚠ スマホは手渡しで</Text>
            <Text style={[s.safeText, { color: fg }]}>投げたらアカン。落とさんように両手で渡す</Text>
          </View>
        </IntroCard>
      );
      controls = <BigButton pal={pal} label="スタート" onPress={() => newRound(1)} />;
      break;
    case 'ready':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦`}</Prog>
          <Text style={[s.topicL, { color: fg }]}>お題</Text>
          <Text style={[s.topic, { color: fg }]}>{topic}</Text>
          <Note fg={fg}>{`1つ言えたら「パス」を押して次の人（${next}の方）へ手渡し。\nいつ爆発するかは分からへん`}</Note>
          <HandWho members={members} i={holder} sub="から" fg={fg} />
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="スタート" onPress={go} />;
      break;
    case 'play':
      card = (
        <ModeCard pal={pal} center>
          <Text style={[s.topicL, { color: fg }]}>お題</Text>
          <Text style={[s.topic, { color: fg }]}>{topic}</Text>
          <Animated.Text style={[s.bomb, { transform: [{ rotate: wob.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] }) }] }]}>💣</Animated.Text>
          <HandWho members={members} i={holder} sub="が持ってる" fg={fg} />
          <Note fg={fg}>{`${passes}回パス`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`言えた！パス → ${next}`} onPress={pass} />;
      break;
    case 'boom':
      card = (
        <ModeCard pal={pal} center bg="#1a0606" edge="#e8202a">
          <Text style={s.boom} numberOfLines={1} adjustsFontSizeToFit>ドカーン！</Text>
          <HandWho members={members} i={holder} sub="が持ってた" fg="#f7f3ea" />
          <Note fg="#f7f3ea">{`${passes}回パスで爆発`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} danger label={`${members[holder].name}に罰ガチャ`} onPress={() => { P.draw([holder]); setPhase('batsu'); }} />;
      break;
    case 'batsu':
      card = (
        <DeckStack pal={pal} minHeight={0}>
          <GachaCard pal={pal} members={members} items={P.gacha} />
        </DeckStack>
      );
      controls = <RoundEnd pal={pal} next={P.lucky ? 'ラッキー！もう1回戦' : '受け入れてもう1回戦'} onNext={() => { P.apply(); newRound(round + 1); }} onEnd={() => finish(P.apply())} />;
      break;
  }
  return (
    <StageShell
      pal={pal} members={members} pen={P.pen} doer={phase === 'ready' || phase === 'play' ? holder : -1} frame={phase === 'intro' ? C.muted : phase === 'boom' ? '#ff2a2a' : colorOf(holder)}
      rules={HELP.bpass.rules} meta={`爆弾パス・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={() => { phaseRef.current = 'intro'; if (timer.current) clearTimeout(timer.current); onQuit(); }} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  topicL: { fontSize: 12, fontWeight: '800', opacity: 0.6 },
  topic: { fontFamily: F.display, fontSize: 38, lineHeight: 46, textAlign: 'center' },
  bomb: { fontSize: 72, lineHeight: 84 },
  boom: { fontFamily: F.display, fontSize: 56, lineHeight: 64, color: '#ff2a2a' },
  safe: { alignSelf: 'stretch', gap: 4, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#ffb02e', backgroundColor: 'rgba(255,176,46,0.16)' },
  safeTitle: { color: '#e8780a', fontSize: 14, fontWeight: '900' },
  safeText: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
});
