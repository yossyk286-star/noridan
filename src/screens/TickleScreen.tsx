import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Note, Outline, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { HELP } from '../lib/help';
import { useCountdown } from '../lib/useCountdown';
import { sexPrefer, pick, shuffle } from '../lib/game';
import { play } from '../lib/sound';
import { Vibration } from '../lib/vibe';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'ready' | 'play' | 'safe' | 'lose' | 'batsu';
const SEC = 10;
const PARTS = ['脇腹', '首すじ', '足の裏', '膝の裏', '脇の下', '耳のうしろ', 'おなか', '二の腕の内側'];
const DEEP = { bg: '#120c1d', edge: C.deep };

/**
 * こしょばし我慢（深夜だけ）：くすぐられる人（基本女性・3回に1回は逆転で男性）を、くすぐる人（なるべく異性）が10秒くすぐる。
 * 笑ったら罰、耐えたらセーフ。始める前ならパスできる（罰なし）。同じ人が続けて当たらんように、当たった回数が少ない人から選ぶ
 */
export default function TickleScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const P = usePenalty(members, level, night, 'tickle');
  const pool = members.map((_, i) => i).filter((i) => !members[i].ng);
  const [phase, setPhase] = useState<Phase>('intro');
  const [k, setK] = useState(0);
  const [who, setWho] = useState(pool[0] ?? 0);
  const [by, setBy] = useState<number[]>([]);
  const [part, setPart] = useState(PARTS[0]);
  const [turns, setTurns] = useState(0);
  const got = useRef<number[]>(Array(members.length).fill(0)).current;
  const safeN = useRef<number[]>(Array(members.length).fill(0)).current;
  const last = useRef<number | null>(null);
  const clock = useCountdown(() => end(false));
  useEffect(() => {
    if (skipIntro) round(0);
  }, []);

  const swap = k % 3 === 2; // 逆転ラウンド
  const round = (next: number) => {
    const want = next % 3 === 2 ? 'm' : 'f';
    let c = pool.filter((i) => members[i].sex === want);
    if (!c.length) c = pool.filter((i) => !members[i].sex);
    if (!c.length) c = pool;
    const c2 = c.filter((i) => i !== last.current);
    if (c2.length) c = c2;
    const min = Math.min(...c.map((i) => got[i]));
    const w = pick(c.filter((i) => got[i] === min));
    setK(next);
    setWho(w);
    setBy(shuffle(sexPrefer(members, w, pool.filter((i) => i !== w))).slice(0, level === 'jigoku' ? 2 : 1));
    setPart(pick(PARTS));
    setPhase('ready');
    play('jan');
  };
  const end = (laughed: boolean) => {
    clock.stop();
    setTurns((t) => t + 1);
    got[who]++;
    last.current = who;
    if (laughed) {
      setPhase('lose');
      play('buzzer');
      Vibration.vibrate([0, 80, 40, 160]);
    } else {
      safeN[who]++;
      setPhase('safe');
      play('fanfare');
    }
  };
  const finish = (p: number[] = P.pen) => {
    clock.stop();
    P.stats.tickleSafe = safeN.slice();
    onFinish(p, turns, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const byNames = by.map((i) => members[i].name).join('と');
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="tickle" tag={`${pool.length}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：${level === 'jigoku' ? 'くすぐる人が2人' : 'くすぐる人は1人'}`} />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="スタート" onPress={() => round(0)} />;
      break;
    case 'ready':
      card = (
        <ModeCard pal={pal} center {...DEEP}>
          <Prog fg="#fff">{`第${k + 1}回戦${swap ? '・逆転ラウンド' : ''}`}</Prog>
          <Text style={s.label}>くすぐられる人</Text>
          <HandWho members={members} i={who} fg="#fff" />
          <Text style={s.label}>くすぐる人</Text>
          <Text style={s.by}>{byNames}</Text>
          <Text style={s.label}>場所</Text>
          <Text style={s.part}>{part}</Text>
          <Note fg="#fff">{`${SEC}秒、声を出して笑ったらアウト。\n出た場所以外はアカン`}</Note>
        </ModeCard>
      );
      controls = (
        <View style={s.row}>
          <Outline label="パス" fg={pal.fg} onPress={() => { last.current = who; round(k + 1); }} style={{ flex: 0, paddingHorizontal: 18 }} />
          <View style={{ flex: 1 }}><BigButton pal={pal} label={`スタート（${SEC}秒）`} onPress={() => { setPhase('play'); play('coin'); clock.start(SEC); }} /></View>
        </View>
      );
      break;
    case 'play':
      card = (
        <ModeCard pal={pal} center {...DEEP}>
          <Prog fg="#fff">{`${byNames} → ${members[who].name}の${part}`}</Prog>
          <Text style={s.count}>{clock.left}</Text>
          <Text style={s.lead}>笑うな…！</Text>
        </ModeCard>
      );
      controls = <BigButton pal={pal} danger label="笑った！アウト" onPress={() => end(true)} />;
      break;
    case 'safe':
      card = (
        <ModeCard pal={pal} center>
          <Text style={[s.verdict, { color: '#1f9d55' }]}>耐えた！</Text>
          <HandWho members={members} i={who} fg={fg} />
          <Note fg={fg}>{`${SEC}秒笑わんかったので罰なし`}</Note>
        </ModeCard>
      );
      controls = <RoundEnd pal={pal} next="もう1回戦" onNext={() => round(k + 1)} onEnd={() => finish()} />;
      break;
    case 'lose':
      card = (
        <ModeCard pal={pal} center bg="#1a0606" edge="#e8202a">
          <Text style={[s.verdict, { color: '#ff2a2a' }]}>笑った！</Text>
          <HandWho members={members} i={who} sub="の負け" fg="#f7f3ea" />
          <Note fg="#f7f3ea">{`${part}をこしょばされて笑ったので罰`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} danger label={`${members[who].name}に罰ガチャ`} onPress={() => { P.draw([who]); setPhase('batsu'); }} />;
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
      rules={HELP.tickle.rules} meta={`こしょばし我慢・${LEVEL_LABEL[level]}・${k + 1}回戦`} onEnd={() => finish()} onQuit={() => { clock.stop(); onQuit(); }} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '800', color: '#fff', opacity: 0.6 },
  by: { fontSize: 22, fontWeight: '900', color: '#fff' },
  part: { fontFamily: F.display, fontSize: 30, lineHeight: 38, color: C.deep, textShadowColor: C.deep, textShadowRadius: 10 },
  count: { fontFamily: F.display, fontSize: 130, lineHeight: 140, color: '#fff' },
  lead: { fontFamily: F.display, fontSize: 30, lineHeight: 38, color: '#fff' },
  verdict: { fontFamily: F.display, fontSize: 56, lineHeight: 64 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
});
