import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
type Phase = 'intro' | 'hand' | 'wait' | 'done' | 'rank' | 'batsu';
type Color = 'wait' | 'go' | 'yellow' | 'red' | 'mada';
type Res = { fly: boolean; ms: number | null };
/** これより遅かったら「遅すぎ」で打ち切り */
const LATE = 1500;
const BG: Record<Color, string> = { wait: '#3a3530', go: '#1fc95b', yellow: '#ffd23f', red: '#e8202a', mada: '#3d7bff' }; // 「まだ！」は緑と間違えへん青
const LABEL: Record<Color, string> = { wait: '待って…', go: '今！', yellow: 'まだやで', red: 'まだやで', mada: 'まだ！' };
const LV_TEXT: Record<Level, string> = { yurume: 'フェイクなし', futsu: 'たまに黄色のフェイク', jigoku: '黄色・赤・「まだ！」のフェイク' };

/**
 * 反射神経バトル：1人ずつ。画面が緑になった瞬間にタップ。フライングした人は罰、おらんかったら一番遅い人が罰。
 * 普通は黄色のフェイク、地獄は赤や「まだ！」のフェイクも出る
 */
export default function ReflexScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const P = usePenalty(members, level, night, 'reflex');
  const [phase, setPhase] = useState<Phase>('intro');
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  const [round, setRound] = useState(1);
  const [k, setK] = useState(0);
  const who = (k + round - 1) % n;
  const [color, setColor] = useState<Color>('wait');
  const colorRef = useRef<Color>('wait');
  const [res, setRes] = useState<(Res | null)[]>(() => Array(n).fill(null));
  const [losers, setLosers] = useState<number[]>([]);
  const [turns, setTurns] = useState(0);
  const best = useRef<(number | null)[]>(Array(n).fill(null)).current;
  const goShown = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => {
    if (skipIntro) newRound(1);
    return clear;
  }, []);

  const paint = (c: Color) => { colorRef.current = c; setColor(c); };
  const newRound = (r: number) => {
    setRound(r);
    setK(0);
    setRes(Array(n).fill(null));
    setLosers([]);
    setPhase('hand');
  };
  const go = () => {
    clear();
    paint('wait');
    setPhase('wait');
    phaseRef.current = 'wait';
    const pool: Color[] = ['yellow', 'red', 'mada'];
    const fakes: Color[] = level === 'yurume' ? [] : level === 'futsu' ? (Math.random() < 0.6 ? ['yellow'] : []) : pool.sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2));
    // 緑になるまで3〜7秒＋フェイク1つにつき1秒。フェイクは1.8秒以上ためてから出して、0.8秒見せる
    const wait = 3000 + fakes.length * 1000 + Math.random() * 4000;
    fakes.forEach((f, i) => {
      const at = 1800 + i * 1000 + ((wait - 3000 - fakes.length * 1000) * (i + 1)) / (fakes.length + 1);
      timers.current.push(setTimeout(() => {
        if (phaseRef.current !== 'wait') return;
        paint(f);
        timers.current.push(setTimeout(() => { if (phaseRef.current === 'wait' && colorRef.current === f) paint('wait'); }, 800));
      }, at));
    });
    timers.current.push(setTimeout(() => { if (phaseRef.current !== 'wait') return; goShown.current = performance.now(); paint('go'); play('pop'); }, wait));
    timers.current.push(setTimeout(() => { if (phaseRef.current === 'wait' && colorRef.current === 'go') tapRef.current(true); }, wait + LATE));
  };
  const tapRef = useRef<(late?: boolean) => void>(() => {});
  tapRef.current = (late = false) => {
    if (phaseRef.current !== 'wait') return;
    clear();
    const fly = colorRef.current !== 'go';
    const ms = fly ? null : late ? LATE : Math.round(performance.now() - goShown.current);
    const nr = res.slice();
    nr[who] = { fly, ms };
    setRes(nr);
    if (!fly && ms != null && (best[who] == null || ms < (best[who] as number))) best[who] = ms;
    setTurns((t) => t + 1);
    play(fly ? 'boom' : 'coin');
    if (k + 1 >= n) {
      const idx = members.map((_, i) => i);
      const flyers = idx.filter((i) => nr[i]!.fly);
      if (flyers.length) setLosers(flyers);
      else {
        const worst = Math.max(...idx.map((i) => nr[i]!.ms as number));
        setLosers(idx.filter((i) => nr[i]!.ms === worst));
      }
      setPhase('rank');
    } else setPhase('done');
  };
  const finish = (p: number[] = P.pen) => {
    clear();
    phaseRef.current = 'intro';
    P.stats.reflexBest = best.slice();
    onFinish(p, turns, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const label = (r: Res) => (r.fly ? 'フライング' : (r.ms as number) >= LATE ? '遅すぎ' : `${r.ms}ms`);
  const board = (hi: number, dark: boolean) => {
    const idx = members.map((_, i) => i);
    const rows = idx.filter((i) => res[i]).sort((a, b) => (res[a]!.fly ? 1e9 : res[a]!.ms!) - (res[b]!.fly ? 1e9 : res[b]!.ms!));
    const c = dark ? '#f7f3ea' : fg;
    return (
      <ScrollView style={s.boardScroll} contentContainerStyle={s.board}>
        {rows.map((i, r) => {
          const bad = losers.includes(i) && (phase === 'rank' || phase === 'batsu');
          return (
            <View key={i} style={[s.row, i === hi && { borderColor: colorOf(i) }]}>
              <Text style={[s.rk, { color: c }]}>{res[i]!.fly ? '×' : r + 1}</Text>
              <Text style={[s.nm, { color: bad ? '#ff3b3b' : c }]} numberOfLines={1}>{members[i].name}</Text>
              <Text style={[s.v, { color: bad ? '#ff3b3b' : c }]}>{label(res[i]!)}</Text>
            </View>
          );
        })}
        {idx.filter((i) => !res[i]).map((i) => (
          <View key={i} style={[s.row, { opacity: 0.4 }]}>
            <Text style={[s.rk, { color: c }]}>-</Text>
            <Text style={[s.nm, { color: c }]} numberOfLines={1}>{members[i].name}</Text>
            <Text style={[s.v, { color: c }]}>?</Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="reflex" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：${LV_TEXT[level]}`} />
        </IntroCard>
      );
      controls = <BigButton pal={pal} label="スタート" onPress={() => newRound(1)} />;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦・${k + 1}/${n}人目`}</Prog>
          <HandWho members={members} i={who} sub="の番" fg={fg} />
          <Note fg={fg}>{'画面が緑になった瞬間にタップ。\n緑になる前に押したらフライングで罰'}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="準備OK" onPress={go} />;
      break;
    case 'wait':
      card = (
        <View style={{ flex: 1 }} onTouchStart={() => tapRef.current()}>
          <View style={[s.box, { backgroundColor: BG[color] }]}>
            <Text style={[s.boxText, { color: color === 'yellow' ? '#141210' : '#fff' }]}>{LABEL[color]}</Text>
          </View>
        </View>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>{`${members[who].name}・緑になったら画面のどこでもタップ`}</Text>;
      break;
    case 'done': {
      const r = res[who]!;
      card = (
        <ModeCard pal={pal} center bg={r.fly ? '#1a0606' : undefined} edge={r.fly ? '#e8202a' : undefined}>
          <Prog fg={r.fly ? '#f7f3ea' : fg}>{`${members[who].name}の記録`}</Prog>
          <Text style={[s.big, { color: r.fly ? '#ff3b3b' : fg }]} numberOfLines={1} adjustsFontSizeToFit>{label(r)}</Text>
          {board(who, r.fly)}
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`次は${members[(k + 1 + round - 1) % n].name}`} onPress={() => { setK(k + 1); setPhase('hand'); }} />;
      break;
    }
    case 'rank':
      card = (
        <ModeCard pal={pal} center bg="#1a0606" edge="#e8202a">
          <Prog fg="#f7f3ea">{`第${round}回戦の結果`}</Prog>
          {board(-1, true)}
          <Text style={s.lose}>{`${losers.map((i) => members[i].name).join('・')}が${losers.some((i) => res[i]?.fly) ? 'フライング' : '一番遅い'}`}</Text>
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
      pal={pal} members={members} pen={P.pen} doer={phase === 'hand' || phase === 'wait' || phase === 'done' ? who : -1} frame={phase === 'intro' ? C.muted : phase === 'rank' ? '#ff2a2a' : colorOf(who)}
      rules={HELP.reflex.rules} meta={`反射神経バトル・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={() => { clear(); phaseRef.current = 'intro'; onQuit(); }} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  box: { flex: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  boxText: { fontFamily: F.display, fontSize: 60, lineHeight: 70 },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  big: { fontFamily: F.display, fontSize: 64, lineHeight: 72 },
  boardScroll: { alignSelf: 'stretch', flexGrow: 0, flexShrink: 1 },
  board: { gap: 6, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: 'transparent', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2 },
  rk: { width: 18, textAlign: 'center', fontFamily: F.display, opacity: 0.55 },
  nm: { flex: 1, fontSize: 15, fontWeight: '800' },
  v: { fontFamily: F.display, fontSize: 18 },
  lose: { fontFamily: F.display, fontSize: 24, lineHeight: 30, textAlign: 'center', marginTop: 8, color: '#ff3b3b' },
});
