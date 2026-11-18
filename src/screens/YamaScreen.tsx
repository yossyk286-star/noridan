import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Vibration } from '../lib/vibe';
import { Tap } from '../components/Tap';
import { Icon } from '../components/Icon';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { IntroCard, LevelBox, ModeCard, NameTiles, Note, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { HELP } from '../lib/help';
import { play } from '../lib/sound';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';
import yama from '../data/yama.json';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'ready' | 'play' | 'who' | 'batsu';
const TOPICS = yama as Record<Level, string[]>;

/** 山手線ゲーム：お題が出たら準備してから始める。手拍子（パン・パン）はみんなで自分らでやる。詰まった人が罰 */
export default function YamaScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const P = usePenalty(members, level, night, 'yama');
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [topic, setTopic] = useState('');
  const [start, setStart] = useState(0);
  const [loser, setLoser] = useState(0);
  const used = useRef<string[]>([]);

  const pickTopic = () => {
    const list = TOPICS[level].filter((t) => !used.current.includes(t));
    const t = (list.length ? list : TOPICS[level])[Math.floor(Math.random() * (list.length || TOPICS[level].length))];
    used.current = list.length ? [...used.current, t] : [t];
    setTopic(t);
  };
  const newRound = (r: number) => {
    setRound(r);
    pickTopic();
    setStart((r - 1) % n);
    setPhase('ready');
  };
  useEffect(() => {
    if (skipIntro) newRound(1);
  }, []);

  const go = () => {
    setPhase('play');
    play('coin');
  };
  const stuck = () => {
    setLoser(start);
    setPhase('who');
    play('buzzer');
    Vibration.vibrate([0, 120, 60, 120]);
  };
  const finish = (p: number[] = P.pen) => onFinish(p, round, P.stats);

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
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：地獄度でお題の難しさが変わる。手拍子は自分らで`} />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="スタート" onPress={() => newRound(1)} />;
      break;
    case 'ready':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦・準備`}</Prog>
          {Topic}
          <Tap onPress={() => { pickTopic(); play('flip'); }} style={[s.swap, { borderColor: alpha(fg.length === 7 ? fg : '#f7f3ea', 0.3) }]}>
            <Icon name="flip" color={fg} size={18} />
            <Text style={[s.swapText, { color: fg }]}>お題を変える</Text>
          </Tap>
          <Note fg={fg}>{`${members[start].name}から時計回り。\n準備できたら押して、「パン・パン」は自分らで`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="準備OK、はじめ！" onPress={go} />;
      break;
    case 'play':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦`}</Prog>
          {Topic}
          <Text style={[s.who, { color: colorOf(start) }]} numberOfLines={1} adjustsFontSizeToFit>{members[start].name}</Text>
          <Text style={[s.whoSub, { color: fg }]}>から時計回り</Text>
          <Note fg={fg}>詰まった・かぶった・リズムに遅れた人が出たら押す</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} danger label="詰まった！" onPress={stuck} />;
      break;
    case 'who':
      card = (
        <ModeCard pal={pal} center bg="#1a0606" edge="#e8202a">
          <Prog fg="#f7f3ea">{`第${round}回戦`}</Prog>
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
      pal={pal} members={members} pen={P.pen} doer={phase === 'play' || phase === 'ready' ? start : -1} frame={phase === 'intro' ? C.muted : phase === 'who' ? '#ff2a2a' : colorOf(start)}
      rules={HELP.yama.rules} meta={`山手線ゲーム・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={onQuit} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  topic: { alignSelf: 'stretch', backgroundColor: '#4dd4ff', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  topicSmall: { fontSize: 12, fontWeight: '900', color: '#141210' },
  topicText: { fontFamily: F.display, fontSize: 28, color: '#141210', textAlign: 'center' },
  swap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, marginTop: 12 },
  swapText: { fontWeight: '900', fontSize: 14 },
  who: { fontFamily: F.display, fontSize: 52, marginTop: 12, textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
  whoSub: { fontWeight: '900', opacity: 0.7 },
  ask: { color: '#f7f3ea', fontFamily: F.display, fontSize: 24, marginVertical: 10 },
});
