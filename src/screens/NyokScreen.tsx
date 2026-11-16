import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Vibration } from '../lib/vibe';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { IntroCard, LevelBox, ModeCard, Note, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { HELP } from '../lib/help';
import { play } from '../lib/sound';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'hand' | 'play' | 'out' | 'batsu';
type TapRec = { i: number; ts: number; no: number };
/** これより短い間に押したら「かぶった」 */
const GAP = 600;
const MAX = 8;

const shuffle = <T,>(a: T[]) => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

/** たけのこニョッキ：スマホを真ん中に置いて、自分のエリアを押しながら「1ニョッキ！」。0.6秒以内にかぶったらアウト、最後の1人もアウト */
export default function NyokScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const P = usePenalty(members, level, night, 'nyok');
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [heat, setHeat] = useState<number[]>([]);
  const [taps, setTaps] = useState<TapRec[]>([]);
  const [losers, setLosers] = useState<number[]>([]);
  const [why, setWhy] = useState('');
  const live = useRef({ phase: 'intro' as Phase, taps: [] as TapRec[], heat: [] as number[] });
  const endT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const newRound = (r: number) => {
    const all = members.map((_, i) => i);
    const h = n <= MAX ? all : shuffle(all).slice(0, MAX).sort((a, b) => a - b);
    if (endT.current) clearTimeout(endT.current);
    live.current = { phase: 'hand', taps: [], heat: h };
    setRound(r);
    setHeat(h);
    setTaps([]);
    setLosers([]);
    setWhy('');
    setPhase('hand');
  };
  useEffect(() => {
    if (skipIntro) newRound(1);
    return () => { if (endT.current) clearTimeout(endT.current); };
  }, []);
  const go = () => {
    live.current.phase = 'play';
    setPhase('play');
    play('coin');
  };
  const out = (l: number[], w: string) => {
    live.current.phase = 'out';
    setLosers(l);
    setWhy(w);
    setPhase('out');
  };
  const tap = (i: number) => {
    const L = live.current;
    if (L.phase !== 'play' || !L.heat.includes(i) || L.taps.some((t) => t.i === i)) return;
    const ts = Date.now();
    const last = L.taps[L.taps.length - 1];
    L.taps = [...L.taps, { i, ts, no: L.taps.length + 1 }];
    setTaps(L.taps);
    if (last && ts - last.ts < GAP) {
      if (endT.current) clearTimeout(endT.current);
      out(L.taps.filter((t) => ts - t.ts < GAP).map((t) => t.i), 'かぶった！');
      play('boom');
      Vibration.vibrate([0, 200, 60, 200]);
      return;
    }
    play('pop');
    Vibration.vibrate(20);
    if (L.taps.length === L.heat.length - 1) {
      endT.current = setTimeout(() => {
        if (live.current !== L || L.phase !== 'play') return;
        out(L.heat.filter((j) => !L.taps.some((t) => t.i === j)), '最後まで残った');
        play('buzzer');
      }, GAP + 50);
    }
  };
  const finish = (p: number[] = P.pen) => {
    if (endT.current) clearTimeout(endT.current);
    onFinish(p, round, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const zones = (isLive: boolean) => {
    const m = heat.length;
    const cols = m <= 2 ? 1 : 2;
    const rows = Math.ceil(m / cols);
    return (
      <View style={[s.zones, !isLive && { height: 160, flex: 0 }]}>
        {Array.from({ length: rows }, (_, r) => (
          <View key={r} style={s.zoneRow}>
            {heat.slice(r * cols, r * cols + cols).map((i) => {
              const t = taps.find((x) => x.i === i);
              const o = losers.includes(i);
              const top = r === 0 && rows > 1;
              return (
                <View
                  key={i}
                  onTouchStart={isLive ? () => tap(i) : undefined}
                  style={[s.zone, { borderColor: o ? '#ff3b3b' : colorOf(i), backgroundColor: o ? 'rgba(232,32,42,0.75)' : t ? alpha(colorOf(i), 0.55) : alpha(colorOf(i), 0.14), borderStyle: t || o ? 'solid' : 'dashed' }]}
                >
                  <View style={top ? { transform: [{ rotate: '180deg' }] } : undefined} pointerEvents="none">
                    <Text style={[s.zoneName, { color: isLive ? '#fff' : fg }]} numberOfLines={1}>{members[i].name}</Text>
                    {(o || t) && <Text style={s.zoneV}>{o ? 'アウト' : `${t!.no}ニョッキ`}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="nyok" tag={`${n}人`}>
          <LevelBox pal={pal} text={`0.6秒以内に押したら「かぶり」。${n > MAX ? `${MAX}人ずつ遊ぶ（毎回入れ替え）` : '全員で遊ぶ'}`} />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="スタート" onPress={() => newRound(1)} />;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦`}</Prog>
          {zones(false)}
          <Note fg={fg}>スマホを真ん中に置いて、自分のエリアの上に指1本。「1ニョッキ！」と言いながら押す</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="準備OK" onPress={go} />;
      break;
    case 'play':
      card = (
        <View style={s.play}>
          {zones(true)}
          <Text pointerEvents="none" style={s.count}>{taps.length ? `${taps.length}ニョッキ！` : 'ニョッキ！'}</Text>
        </View>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>言いながら自分のエリアを押す。かぶったらアウト</Text>;
      break;
    case 'out':
      card = (
        <ModeCard pal={pal} center bg="#1a0606" edge="#e8202a">
          <Prog fg="#f7f3ea">{`第${round}回戦`}</Prog>
          <Text style={s.why}>{why}</Text>
          {zones(false)}
          <Text style={s.lose}>{`${losers.map((i) => members[i].name).join('・')}がアウト`}</Text>
        </ModeCard>
      );
      controls = <BigButton pal={pal} danger label={`${losers.map((i) => members[i].name).join('・')}に罰ガチャ`} onPress={() => { P.draw(losers); setPhase('batsu'); }} />;
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
      pal={pal} members={members} pen={P.pen} doer={-1} frame={phase === 'intro' ? C.muted : phase === 'out' ? '#ff2a2a' : '#1fc95b'}
      rules={HELP.nyok.rules} meta={`たけのこニョッキ・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={onQuit} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  play: { flex: 1, backgroundColor: '#1fc95b', borderRadius: 22, padding: 10 },
  zones: { flex: 1, gap: 12, alignSelf: 'stretch' },
  zoneRow: { flex: 1, flexDirection: 'row', gap: 12 },
  zone: { flex: 1, borderRadius: 14, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  zoneName: { fontFamily: F.display, fontSize: 22, textAlign: 'center' },
  zoneV: { color: '#fff', fontWeight: '900', fontSize: 15, textAlign: 'center' },
  count: { position: 'absolute', alignSelf: 'center', top: '45%', fontFamily: F.display, fontSize: 40, color: '#fff', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  why: { fontFamily: F.display, fontSize: 48, color: '#ff3b3b', marginBottom: 8 },
  lose: { color: '#f7f3ea', fontFamily: F.display, fontSize: 22, marginTop: 10 },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
});
