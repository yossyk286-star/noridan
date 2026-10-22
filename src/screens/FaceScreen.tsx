import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Note, Outline, Peek, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { ScoreRank } from '../components/ScoreRank';
import { useHold, useReveal } from '../components/Reveal';
import { HELP } from '../lib/help';
import { useCountdown } from '../lib/useCountdown';
import { play } from '../lib/sound';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';
import facesJson from '../data/faces.json';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'hand' | 'act' | 'guess' | 'res' | 'tally' | 'rank' | 'batsu';
const PER = 2;
const SEC = 10;
const FACES: string[] = (facesJson as { list: string[] }).list;
const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

/**
 * テンション伝言（表情当て）：番の人だけお題（気持ち）を見て、10秒間顔だけで演じる。周りが相談して4択で当てる。
 * 伝わったら演じた人に1点、1人2問ずつ。全員終わって一番点が少ない人が罰（同点は全員）
 */
export default function FaceScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const P = usePenalty(members, level, night, 'face');
  const H = useHold();
  const RV = useReveal();
  const deck = useRef<string[]>([]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [k, setK] = useState(0);
  const [t, setT] = useState('');
  const [opts, setOpts] = useState<string[]>([]);
  const [pick, setPick] = useState('');
  const [score, setScore] = useState<number[]>(() => Array(n).fill(0));
  const [losers, setLosers] = useState<number[]>([]);
  const [turns, setTurns] = useState(0);
  const hits = useRef<number[]>(Array(n).fill(0)).current;
  const clock = useCountdown(() => setPhase('guess'));
  useEffect(() => {
    if (skipIntro) newRound();
  }, []);
  const who = Math.floor(k / PER) % n;

  const prompt = (kk: number) => {
    if (!deck.current.length) deck.current = shuffle(FACES);
    const tt = deck.current.pop()!;
    setK(kk);
    setT(tt);
    setOpts(shuffle([tt, ...shuffle(FACES.filter((x) => x !== tt)).slice(0, 3)]));
    setPick('');
    setPhase('hand');
    play('flip');
  };
  const newRound = () => {
    setRound((r) => r + 1);
    setScore(Array(n).fill(0));
    setLosers([]);
    prompt(0);
  };
  const guess = (o: string) => {
    setPick(o);
    if (o === t) {
      setScore((s0) => s0.map((v, j) => (j === who ? v + 1 : v)));
      hits[who]++;
      play('pinpon');
    } else play('buzzer');
    setPhase('res');
  };
  const after = () => {
    setTurns((x) => x + 1);
    if (k + 1 < n * PER) return prompt(k + 1);
    const min = Math.min(...score);
    setLosers(members.map((_, i) => i).filter((i) => score[i] === min));
    setPhase('tally');
    H.hold('結果は…', 1800, () => { setPhase('rank'); RV.start(n); });
  };
  const finish = (p: number[] = P.pen) => {
    clock.stop();
    P.stats.faceHits = hits.slice();
    onFinish(p, turns, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const prog = `第${round}回戦・${k + 1}/${n * PER}問`;
  const ok = pick === t;
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="face" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：1人${PER}問・顔だけで${SEC}秒`} />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="スタート" onPress={newRound} />;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{prog}</Prog>
          <HandWho members={members} i={who} sub="が演じる" fg={fg} />
          <Note fg={fg}>{`${members[who].name}だけ長押しでお題を見て。\nほかの人は見たらアカン`}</Note>
          <Peek fg={fg}>
            <Text style={[s.t, { color: fg }]}>{t}</Text>
          </Peek>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`覚えた → 演じる（${SEC}秒）`} onPress={() => { setPhase('act'); clock.start(SEC); }} />;
      break;
    case 'act':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[who].name}が演じてる`}</Prog>
          <Text style={[s.count, { color: fg }]}>{clock.left}</Text>
          <Text style={[s.lead, { color: fg }]}>顔だけで！</Text>
          <Note fg={fg}>{'声・手・身ぶりはナシ。\nスマホは周りの人が持って見てて'}</Note>
        </ModeCard>
      );
      controls = <Outline label="もうわかった → 答える" fg={pal.fg} onPress={() => { clock.stop(); setPhase('guess'); }} />;
      break;
    case 'guess':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{prog}</Prog>
          <Text style={[s.lead, { color: fg }]}>{`${members[who].name}の気持ちは？`}</Text>
          <View style={{ gap: 8, width: '100%' }}>
            {opts.map((o) => (
              <Pressable key={o} onPress={() => guess(o)} style={({ pressed }) => [s.opt, { borderColor: colorOf(who), opacity: pressed ? 0.7 : 1 }]}>
                <Text style={[s.optT, { color: fg }]}>{o}</Text>
              </Pressable>
            ))}
          </View>
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>周りの人で相談して1つ選んで</Text>;
      break;
    case 'res':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>正解は…</Prog>
          <Text style={[s.t, { color: fg }]}>{t}</Text>
          <Text style={[s.verdict, { color: ok ? '#1f9d55' : '#ff2a2a' }]}>{ok ? '伝わった！' : '伝わらん！'}</Text>
          <Note fg={fg}>{ok ? `${members[who].name}に1点` : `「${pick}」に見えたらしい`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={k + 1 >= n * PER ? '結果発表' : (k + 1) % PER === 0 ? `次は${members[(who + 1) % n].name}` : `${members[who].name}の2問目`} onPress={after} />;
      break;
    case 'tally':
    case 'rank':
      card = (
        <ModeCard pal={pal} bg="#1a0606" edge="#e8202a">
          <ScoreRank members={members} score={score} losers={losers} rv={RV} fg="#f7f3ea" title={`第${round}回戦の結果`} foot={`${losers.map((i) => members[i].name).join('・')}が一番伝わらんかった`} />
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
      pal={pal} members={members} pen={P.pen} doer={phase === 'intro' || phase === 'rank' || phase === 'tally' ? -1 : who} frame={phase === 'intro' ? C.muted : colorOf(who)}
      rules={HELP.face.rules} meta={`テンション伝言・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={() => { clock.stop(); onQuit(); }} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  t: { fontFamily: F.display, fontSize: 26, lineHeight: 34, textAlign: 'center' },
  count: { fontFamily: F.display, fontSize: 130, lineHeight: 140 },
  lead: { fontFamily: F.display, fontSize: 26, lineHeight: 34, textAlign: 'center' },
  verdict: { fontFamily: F.display, fontSize: 36, lineHeight: 44 },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  opt: { borderLeftWidth: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14 },
  optT: { fontSize: 16, fontWeight: '900' },
});
