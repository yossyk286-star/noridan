import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Note, Peek, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { useHold } from '../components/Reveal';
import { HELP } from '../lib/help';
import { play } from '../lib/sound';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';
import doubtJson from '../data/doubt.json';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'hand' | 'talk' | 'vote' | 'reveal' | 'batsu';
const TOPICS: string[] = (doubtJson as { list: string[] }).list;
const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

/**
 * ダウト：番の人だけお題と「本当／嘘」を見て、それっぽく話す。ほかの人がそれぞれ本当か嘘か投票。
 * 半分以上が当てたら見破られたので話した人、当てたのが半分未満なら騙されたので外した人全員が罰
 */
export default function DoubtScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const P = usePenalty(members, level, night, 'doubt');
  const H = useHold();
  const deck = useRef<string[]>([]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [k, setK] = useState(0);
  const [topic, setTopic] = useState('');
  const [lie, setLie] = useState(false);
  const [votes, setVotes] = useState<Record<number, 'T' | 'L'>>({});
  const [losers, setLosers] = useState<number[]>([]);
  const [caught, setCaught] = useState(false);
  const [turns, setTurns] = useState(0);
  const fooled = useRef<number[]>(Array(n).fill(0)).current;
  const seen = useRef<number[]>(Array(n).fill(0)).current;
  const who = k % n;
  useEffect(() => {
    if (skipIntro) newRound();
  }, []);

  const turn = (kk: number) => {
    if (!deck.current.length) deck.current = shuffle(TOPICS);
    setK(kk);
    setTopic(deck.current.pop()!);
    setLie(Math.random() < 0.5);
    setVotes({});
    setLosers([]);
    setPhase('hand');
    play('flip');
  };
  const newRound = () => {
    setRound((r) => r + 1);
    turn(0);
  };
  const voters = members.map((_, i) => i).filter((i) => i !== who);
  const done = voters.every((i) => votes[i]);
  const open = () => {
    const right = voters.filter((i) => (votes[i] === 'L') === lie);
    const c = right.length * 2 >= voters.length;
    setCaught(c);
    setLosers(c ? [who] : voters.filter((i) => !right.includes(i)));
    if (c) right.forEach((i) => seen[i]++);
    else fooled[who]++;
    setTurns((t) => t + 1);
    H.hold('正解は…', 1800, () => {
      setPhase('reveal');
      play(c ? 'buzzer' : 'pinpon');
    });
  };
  const finish = (p: number[] = P.pen) => {
    P.stats.doubtFooled = fooled.slice();
    P.stats.doubtSeen = seen.slice();
    onFinish(p, turns, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const last = k + 1 >= n;
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="doubt" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」`} />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="スタート" onPress={newRound} />;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦・${k + 1}/${n}人目`}</Prog>
          <HandWho members={members} i={who} sub="が話す" fg={fg} />
          <Note fg={fg}>{`${members[who].name}だけ長押しで見て。ほかの人は見たらアカン`}</Note>
          <Peek fg={fg}>
            <Text style={[s.label, { color: fg }]}>お題</Text>
            <Text style={[s.topic, { color: fg }]}>{topic}</Text>
            <Text style={[s.mode, { backgroundColor: lie ? '#e8202a' : '#1f9d55' }]}>{lie ? '嘘をつく' : '本当のことを言う'}</Text>
          </Peek>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="覚えた → 話す" onPress={() => setPhase('talk')} />;
      break;
    case 'talk':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[who].name}が話す`}</Prog>
          <Text style={[s.label, { color: fg }]}>お題</Text>
          <Text style={[s.topic, { color: fg }]}>{topic}</Text>
          <Note fg={fg}>{'30秒くらいでそれっぽく話して。\n周りは質問してもOK。本当か嘘か見破れ'}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="話し終わった → 投票" onPress={() => setPhase('vote')} />;
      break;
    case 'vote':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`「${topic}」`}</Prog>
          <Text style={[s.lead, { color: fg }]}>本当？嘘？</Text>
          <View style={{ gap: 6, width: '100%' }}>
            {voters.map((i) => (
              <View key={i} style={[s.vrow, { borderLeftColor: colorOf(i) }]}>
                <Text style={[s.vname, { color: fg }]} numberOfLines={1}>{members[i].name}</Text>
                {(['T', 'L'] as const).map((v) => {
                  const on = votes[i] === v;
                  return (
                    <Pressable key={v} onPress={() => setVotes({ ...votes, [i]: v })} style={[s.vbtn, on && { backgroundColor: v === 'T' ? '#1f9d55' : '#e8202a', borderColor: 'transparent' }]}>
                      <Text style={[s.vbtnT, { color: on ? '#fff' : fg }]}>{v === 'T' ? '本当' : '嘘'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={done ? '開票' : `あと${voters.filter((i) => !votes[i]).length}人`} disabled={!done} onPress={open} />;
      break;
    case 'reveal':
      card = (
        <ModeCard pal={pal} center bg={caught ? '#1a0606' : undefined} edge={caught ? '#e8202a' : undefined}>
          <Prog fg={caught ? '#f7f3ea' : fg}>{`「${topic}」は…`}</Prog>
          <Text style={[s.verdict, { color: lie ? '#ff2a2a' : '#1f9d55' }]}>{lie ? '嘘！' : '本当！'}</Text>
          <Text style={[s.lead, { color: caught ? '#f7f3ea' : fg }]}>{caught ? '見破られた！' : '騙された！'}</Text>
          <Note fg={caught ? '#f7f3ea' : fg}>{caught ? `${members[who].name}が罰` : `外した${losers.map((i) => members[i].name).join('・')}が罰`}</Note>
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
      controls = last ? (
        <RoundEnd pal={pal} next={P.lucky ? 'ラッキー！もう1回戦' : '受け入れてもう1回戦'} onNext={() => { P.apply(); newRound(); }} onEnd={() => finish(P.apply())} />
      ) : (
        <BigButton pal={pal} label={`${P.lucky ? 'ラッキー！' : '受け入れた'} → 次は${members[(who + 1) % n].name}`} onPress={() => { P.apply(); turn(k + 1); }} />
      );
      break;
  }
  const hv = H.view(pal);
  if (hv) { card = hv.card; controls = hv.controls; }
  return (
    <StageShell
      pal={pal} members={members} pen={P.pen} doer={phase === 'intro' ? -1 : who} frame={phase === 'intro' ? C.muted : phase === 'reveal' && caught ? '#ff2a2a' : colorOf(who)}
      rules={HELP.doubt.rules} meta={`ダウト・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={onQuit} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '800', opacity: 0.6, textAlign: 'center' },
  topic: { fontFamily: F.display, fontSize: 26, lineHeight: 34, textAlign: 'center' },
  mode: { alignSelf: 'center', marginTop: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', color: '#fff', fontSize: 18, fontWeight: '900' },
  lead: { fontFamily: F.display, fontSize: 26, lineHeight: 34, textAlign: 'center' },
  verdict: { fontFamily: F.display, fontSize: 56, lineHeight: 64 },
  vrow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12, borderLeftWidth: 5, backgroundColor: 'rgba(136,136,136,0.08)' },
  vname: { flex: 1, fontSize: 16, fontWeight: '900' },
  vbtn: { width: 70, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(136,136,136,0.4)', alignItems: 'center' },
  vbtnT: { fontSize: 14, fontWeight: '900' },
});
