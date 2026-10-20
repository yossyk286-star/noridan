import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { StyleSheet, Text, View, Vibration } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Note, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { HELP } from '../lib/help';
import { play } from '../lib/sound';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'guess' | 'reveal' | 'batsu';
/** これだけ続いたあとに外したら罰2倍 */
const X2: Record<Level, number> = { yurume: 99, futsu: 5, jigoku: 3 };
const SUITS = ['♠', '♥', '♦', '♣'];
const face = (v: number) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' } as Record<number, string>)[v] ?? String(v);
const rnd = (n: number) => Math.floor(Math.random() * n);

function PlayCard({ v, suit, dim }: { v: number; suit: number; dim?: boolean }) {
  const red = suit === 1 || suit === 2;
  return (
    <View style={[s.card, dim && { opacity: 0.55, transform: [{ scale: 0.9 }] }]}>
      <Text style={[s.suit, red && { color: '#e8202a' }]}>{SUITS[suit]}</Text>
      <Text style={[s.face, red && { color: '#e8202a' }]}>{face(v)}</Text>
    </View>
  );
}

/** ハイ&ロー：次のカードが今より大きいか小さいかを当てる。当たったら次の人。外したら罰（続いた回数が多いと罰2倍） */
export default function HiloScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const P = usePenalty(members, level, night, 'hilo');
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(1);
  const [who, setWho] = useState(0);
  const [cur, setCur] = useState({ v: 7, s: 0 });
  const [next, setNext] = useState({ v: 7, s: 0 });
  const [up, setUp] = useState(true);
  const [ok, setOk] = useState(true);
  const [same, setSame] = useState(false);
  const [streak, setStreak] = useState(0);
  const [x, setX] = useState(1);
  const [turns, setTurns] = useState(0);
  const hits = useRef<number[]>(Array(n).fill(0)).current;
  useEffect(() => {
    if (skipIntro) newRound(1);
  }, []);

  const newRound = (r: number) => {
    setRound(r);
    setWho((r - 1) % n);
    setCur({ v: 1 + rnd(13), s: rnd(4) });
    setStreak(0);
    setPhase('guess');
  };
  const guess = (u: boolean) => {
    const nx = { v: 1 + rnd(13), s: rnd(4) };
    const sm = nx.v === cur.v;
    const good = sm ? level !== 'jigoku' : u ? nx.v > cur.v : nx.v < cur.v;
    setNext(nx);
    setUp(u);
    setSame(sm);
    setOk(good);
    setTurns((t) => t + 1);
    if (good) {
      setStreak(streak + 1);
      hits[who]++;
      play('coin');
    } else {
      setX(streak >= X2[level] ? 2 : 1);
      play('boom');
      Vibration.vibrate([0, 120, 60, 200]);
    }
    setPhase('reveal');
  };
  const finish = (p: number[] = P.pen) => {
    P.stats.hiloHits = hits.slice();
    onFinish(p, turns, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="hilo" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：${level === 'jigoku' ? '同じ数字もアウト。3連続のあとに外したら罰2倍' : level === 'futsu' ? '5連続のあとに外したら罰2倍' : '同じ数字はセーフ'}`} />
        </IntroCard>
      );
      controls = <BigButton pal={pal} label="スタート" onPress={() => newRound(1)} />;
      break;
    case 'guess':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦・${streak}連続中`}</Prog>
          <HandWho members={members} i={who} sub="の番" fg={fg} />
          <View style={s.row}>
            <PlayCard v={cur.v} suit={cur.s} />
            <View style={[s.card, s.back]}>
              <Text style={s.backText}>?</Text>
            </View>
          </View>
          <Note fg={fg}>{`次のカードは${face(cur.v)}より大きい？小さい？${level === 'jigoku' ? '（同じ数字はアウト）' : '（同じ数字はセーフ）'}`}</Note>
        </ModeCard>
      );
      controls = (
        <View style={s.btnRow}>
          <View style={{ flex: 1 }}><BigButton pal={pal} label="▼ ロー" onPress={() => guess(false)} /></View>
          <View style={{ flex: 1 }}><BigButton pal={pal} label="▲ ハイ" onPress={() => guess(true)} /></View>
        </View>
      );
      break;
    case 'reveal':
      card = (
        <ModeCard pal={pal} center bg={ok ? undefined : '#1a0606'} edge={ok ? undefined : '#e8202a'}>
          <Prog fg={ok ? fg : '#f7f3ea'}>{`${members[who].name}は「${up ? 'ハイ' : 'ロー'}」`}</Prog>
          <View style={s.row}>
            <PlayCard v={cur.v} suit={cur.s} dim />
            <PlayCard v={next.v} suit={next.s} />
          </View>
          <Text style={[s.verdict, { color: ok ? '#1f9d55' : '#ff2a2a' }]}>{ok ? (same ? '同じでセーフ' : '当たり！') : same ? '同じでアウト' : 'ハズレ！'}</Text>
          <Note fg={ok ? fg : '#f7f3ea'}>{ok ? `${streak}連続` : `${streak}連続で止まった${x > 1 ? '（罰2倍）' : ''}`}</Note>
        </ModeCard>
      );
      controls = ok ? (
        <BigButton pal={pal} label={`次は${members[(who + 1) % n].name}`} onPress={() => { setCur(next); setWho((who + 1) % n); setPhase('guess'); }} />
      ) : (
        <BigButton pal={pal} danger label={`${members[who].name}に罰ガチャ`} onPress={() => { P.draw([who], x); setPhase('batsu'); }} />
      );
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
      pal={pal} members={members} pen={P.pen} doer={phase === 'guess' ? who : -1} frame={phase === 'intro' ? C.muted : phase === 'reveal' && !ok ? '#ff2a2a' : colorOf(who)}
      rules={HELP.hilo.rules} meta={`ハイ&ロー・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={onQuit} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, justifyContent: 'center', alignItems: 'center', marginVertical: 8 },
  card: { width: 104, aspectRatio: 5 / 7, borderRadius: 14, backgroundColor: '#fff', borderWidth: 3, borderColor: '#141210', alignItems: 'center', justifyContent: 'center' },
  suit: { position: 'absolute', top: 6, left: 8, fontSize: 20, color: '#141210' },
  face: { fontFamily: F.display, fontSize: 56, lineHeight: 64, color: '#141210' },
  back: { backgroundColor: '#e8202a' },
  backText: { fontFamily: F.display, fontSize: 48, color: '#fff' },
  verdict: { fontFamily: F.display, fontSize: 34, lineHeight: 42 },
  btnRow: { flexDirection: 'row', gap: 10 },
});
