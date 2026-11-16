import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Vibration } from '../lib/vibe';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { IntroCard, LevelBox, ModeCard, NameTiles, Note, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { HELP } from '../lib/help';
import { play } from '../lib/sound';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';
import yama from '../data/yama.json';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'ready' | 'play' | 'who' | 'batsu';
const BPM: Record<Level, number> = { yurume: 84, futsu: 100, jigoku: 120 };
const TOPICS = yama as Record<Level, string[]>;

/** 山手線ゲーム：スマホが「パン・パン」と手拍子、3拍目で番の人が答える。1周ごとに速くなる。詰まった人が罰 */
export default function YamaScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const P = usePenalty(members, level, night, 'yama');
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [topic, setTopic] = useState('');
  const [who, setWho] = useState(0);
  const [beat, setBeat] = useState(-1);
  const [bpm, setBpm] = useState(BPM[level]);
  const [said, setSaid] = useState(0);
  const [loser, setLoser] = useState(0);
  const used = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef({ beat: -1, who: 0, start: 0, bpm: BPM[level], said: 0 });

  const newRound = (r: number) => {
    const list = TOPICS[level].filter((t) => !used.current.includes(t));
    const t = (list.length ? list : TOPICS[level])[Math.floor(Math.random() * (list.length || TOPICS[level].length))];
    used.current = list.length ? [...used.current, t] : [t];
    setRound(r);
    setTopic(t);
    const start = (r - 1) % n;
    live.current = { beat: -1, who: start, start, bpm: BPM[level], said: 0 };
    setWho(start);
    setBeat(-1);
    setBpm(BPM[level]);
    setSaid(0);
    setPhase('ready');
  };
  useEffect(() => {
    if (skipIntro) newRound(1);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const go = () => {
    setPhase('play');
    const tick = () => {
      const L = live.current;
      L.beat++;
      const k = L.beat % 3;
      if (k === 0 && L.beat > 0) {
        L.who = (L.who + 1) % n;
        L.said++;
        if (L.who === L.start) L.bpm = Math.min(170, L.bpm + 8);
        setWho(L.who);
        setSaid(L.said);
        setBpm(L.bpm);
      }
      setBeat(L.beat);
      if (k < 2) play('clack');
      else { play('tik'); Vibration.vibrate(30); }
      timer.current = setTimeout(tick, 60000 / L.bpm);
    };
    timer.current = setTimeout(tick, 500);
  };
  const stuck = () => {
    if (timer.current) clearTimeout(timer.current);
    setLoser(live.current.who);
    setPhase('who');
    play('buzzer');
    Vibration.vibrate([0, 120, 60, 120]);
  };
  const finish = (p: number[] = P.pen) => {
    if (timer.current) clearTimeout(timer.current);
    onFinish(p, round, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const Topic = (
    <View style={s.topic}>
      <Text style={s.topicSmall}>お題</Text>
      <Text style={s.topicText}>{topic}</Text>
    </View>
  );
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="yama" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：最初のテンポ ${BPM[level]}。1周ごとに速くなる`} />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="スタート" onPress={() => newRound(1)} />;
      break;
    case 'ready':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦`}</Prog>
          {Topic}
          <Note fg={fg}>{`${members[who].name}から時計回り。「パン・パン」のあとに1人1つずつ答える`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="手拍子スタート" onPress={go} />;
      break;
    case 'play':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦・テンポ ${bpm}`}</Prog>
          {Topic}
          <View style={s.beats}>
            {['パン', 'パン', '答え'].map((t, k) => {
              const on = beat >= 0 && beat % 3 === k;
              return (
                <View key={k} style={[s.beat, on && { backgroundColor: k === 2 ? '#ffd23f' : '#ff5d8f', transform: [{ scale: 1.15 }] }]}>
                  <Text style={[s.beatText, { color: on ? '#141210' : fg }]}>{t}</Text>
                </View>
              );
            })}
          </View>
          <Text style={[s.who, { color: colorOf(who) }]} numberOfLines={1} adjustsFontSizeToFit>{members[who].name}</Text>
          <Text style={[s.whoSub, { color: fg }]}>の番</Text>
        </ModeCard>
      );
      controls = <BigButton pal={pal} danger label="詰まった！" onPress={stuck} />;
      break;
    case 'who':
      card = (
        <ModeCard pal={pal} center bg="#1a0606" edge="#e8202a">
          <Prog fg="#f7f3ea">{`第${round}回戦・${said}人目で詰まった`}</Prog>
          {Topic}
          <Text style={s.ask}>誰が詰まった？</Text>
          <NameTiles members={members} list={members.map((_, i) => i)} fg="#f7f3ea" onPress={setLoser} count={(i) => (i === loser ? '← この人' : '')} />
        </ModeCard>
      );
      controls = <BigButton pal={pal} danger label={`${members[loser].name}に罰ガチャ`} onPress={() => { P.draw([loser]); setPhase('batsu'); }} />;
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
      pal={pal} members={members} pen={P.pen} doer={phase === 'play' ? who : -1} frame={phase === 'intro' ? C.muted : phase === 'who' ? '#ff2a2a' : colorOf(who)}
      rules={HELP.yama.rules} meta={`山手線ゲーム・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={onQuit} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  topic: { alignSelf: 'stretch', backgroundColor: '#ffd23f', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  topicSmall: { fontSize: 12, fontWeight: '900', color: '#141210' },
  topicText: { fontFamily: F.display, fontSize: 28, color: '#141210', textAlign: 'center' },
  beats: { flexDirection: 'row', gap: 12, marginTop: 14 },
  beat: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(136,136,136,0.16)' },
  beatText: { fontWeight: '900', fontSize: 15 },
  who: { fontFamily: F.display, fontSize: 52, marginTop: 12, textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
  whoSub: { fontWeight: '900', opacity: 0.7 },
  ask: { color: '#f7f3ea', fontFamily: F.display, fontSize: 24, marginVertical: 10 },
});
