import { useEffect, useState } from 'react';
import type React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, NameTiles, Note, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { HELP } from '../lib/help';
import { useHold } from '../components/Reveal';
import { useCountdown } from '../lib/useCountdown';
import { sexPrefer, pick } from '../lib/game';
import { play } from '../lib/sound';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'close' | 'secret' | 'touch' | 'guess' | 'reveal' | 'batsu';
/** 触る時間（秒） */
export const BL_SEC = 5;
const TOUCH = ['両手で手を握る', '手のひらを合わせる', '頭をなでる', 'ほっぺを指でつつく', '肩をもむ', '手の甲をなでる', '腕をつかむ', '耳たぶをつまむ', '背中をトントンする', '指を絡める', '肩に頭を乗せる', '首の後ろに息をかける'];
const DEEP = { bg: '#120c1d', edge: C.deep };

/**
 * 目隠し当て（深夜だけ）：番の人が目をつぶって、アプリが決めた人がそっと触る。誰やったか当てる。
 * 当てたら触った人（バレた）、外したら当てた人が罰。下ネタNGの人は入らへん。組む相手はなるべく異性
 */
export default function BlindScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const P = usePenalty(members, level, night, 'blind');
  const H = useHold();
  const pool = members.map((_, i) => i).filter((i) => !members[i].ng);
  const [phase, setPhase] = useState<Phase>('intro');
  const [k, setK] = useState(0);
  const [who, setWho] = useState(pool[0] ?? 0);
  const [toucher, setToucher] = useState(pool[1] ?? 0);
  const [touch, setTouch] = useState(TOUCH[0]);
  const [guess, setGuess] = useState(-1);
  const [turns, setTurns] = useState(0);
  const [hits] = useState(() => Array(members.length).fill(0) as number[]);
  const [fool] = useState(() => Array(members.length).fill(0) as number[]);
  const clock = useCountdown(() => {
    play('timeup');
    setPhase('guess');
  });
  useEffect(() => {
    if (skipIntro) round(0);
  }, []);

  const round = (next: number) => {
    const w = pool[next % pool.length];
    const c = sexPrefer(members, w, pool.filter((i) => i !== w));
    const c2 = c.filter((i) => i !== toucher);
    setK(next);
    setWho(w);
    setToucher(pick(c2.length ? c2 : c));
    setTouch(pick(TOUCH));
    setGuess(-1);
    setPhase('close');
    play('flip');
  };
  const ok = guess === toucher;
  const loser = ok ? toucher : who;
  const answer = (i: number) => {
    setGuess(i);
    setTurns((t) => t + 1);
    if (i === toucher) hits[who]++;
    else fool[toucher]++;
    H.hold('正解は…', 1800, () => {
      setPhase('reveal');
      play(i === toucher ? 'pinpon' : 'buzzer');
    });
  };
  const finish = (p: number[] = P.pen) => {
    P.stats.blindHits = hits.slice();
    P.stats.blindFool = fool.slice();
    onFinish(p, turns, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="blind" tag={`${pool.length}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」`} />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="スタート" onPress={() => round(0)} />;
      break;
    case 'close':
      card = (
        <ModeCard pal={pal} center {...DEEP}>
          <Prog fg="#fff">{`第${k + 1}回戦`}</Prog>
          <HandWho members={members} i={who} sub="の番" fg="#fff" />
          <Text style={s.lead}>目をつぶって</Text>
          <Note fg="#fff">{`${members[who].name}は目をつぶって、手を前に出して座る。\nスマホはほかの人だけで見てな`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`${members[who].name}が目をつぶった`} onPress={() => setPhase('secret')} />;
      break;
    case 'secret':
      card = (
        <ModeCard pal={pal} center {...DEEP}>
          <Prog fg="#fff">{`${members[who].name}は見たらアカン`}</Prog>
          <Text style={s.label}>触る人</Text>
          <HandWho members={members} i={toucher} fg="#fff" />
          <Text style={s.label}>やること</Text>
          <Text style={s.touch}>{touch}</Text>
          <Note fg="#fff">{`${BL_SEC}秒間、そっと。声・笑い声でバレんように\nほかの人もシーッ`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`触り始める（${BL_SEC}秒）`} onPress={() => { setPhase('touch'); clock.start(BL_SEC); }} />;
      break;
    case 'touch':
      card = (
        <ModeCard pal={pal} center {...DEEP}>
          <Prog fg="#fff">{`${members[toucher].name}が「${touch}」`}</Prog>
          <Text style={s.count}>{clock.left}</Text>
          <Note fg="#fff">{`${members[who].name}はまだ目をつぶったまま。\nブザーが鳴ったら目を開けて`}</Note>
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>シーッ…</Text>;
      break;
    case 'guess':
      card = (
        <ModeCard pal={pal} center {...DEEP}>
          <Prog fg="#fff">{`${members[who].name}、目を開けて`}</Prog>
          <Text style={s.lead}>誰に触られた？</Text>
          <NameTiles members={members} list={pool.filter((i) => i !== who)} fg="#fff" cols={2} onPress={answer} />
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>{`当てたら触った人、外したら${members[who].name}が罰`}</Text>;
      break;
    case 'reveal':
      card = (
        <ModeCard pal={pal} center bg={ok ? undefined : '#1a0606'} edge={ok ? undefined : '#e8202a'}>
          <Prog fg={ok ? fg : '#f7f3ea'}>正解は…</Prog>
          <HandWho members={members} i={toucher} sub={`が「${touch}」`} fg={ok ? fg : '#f7f3ea'} />
          <Text style={[s.verdict, { color: ok ? '#1f9d55' : '#ff2a2a' }]}>{ok ? '当たり！' : 'ハズレ！'}</Text>
          <Note fg={ok ? fg : '#f7f3ea'}>{ok ? `バレたので${members[toucher].name}が罰` : `${members[guess]?.name ?? ''}やと思った${members[who].name}が罰`}</Note>
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
      controls = <RoundEnd pal={pal} next={P.lucky ? 'ラッキー！もう1回戦' : '受け入れてもう1回戦'} onNext={() => { P.apply(); round(k + 1); }} onEnd={() => finish(P.apply())} />;
      break;
  }
  const hv = H.view(pal);
  if (hv) { card = hv.card; controls = hv.controls; }
  return (
    <StageShell
      pal={pal} members={members} pen={P.pen} doer={phase === 'intro' ? -1 : who} frame={phase === 'intro' ? C.muted : phase === 'reveal' && !ok ? '#ff2a2a' : colorOf(who)}
      rules={HELP.blind.rules} meta={`目隠し当て・${LEVEL_LABEL[level]}・${k + 1}回戦`} onEnd={() => finish()} onQuit={() => { clock.stop(); onQuit(); }} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  lead: { fontFamily: F.display, fontSize: 30, lineHeight: 38, color: '#fff', textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '800', color: '#fff', opacity: 0.6 },
  touch: { fontFamily: F.display, fontSize: 30, lineHeight: 38, color: C.deep, textAlign: 'center', textShadowColor: C.deep, textShadowRadius: 10 },
  count: { fontFamily: F.display, fontSize: 130, lineHeight: 140, color: '#fff' },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  verdict: { fontFamily: F.display, fontSize: 40, lineHeight: 48 },
});
