import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Note, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { HELP } from '../lib/help';
import { load, save } from '../lib/storage';
import { Tap } from '../components/Tap';
import { play } from '../lib/sound';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'hand' | 'wait' | 'done' | 'mhand' | 'mwait' | 'mdone' | 'rank' | 'batsu';
type Style = 'solo' | 'multi';
/** みんな同時：4人までの組に分ける（5→3+2、9→3+3+3 みたいに均等に） */
const heatsOf = (n: number) => {
  const k = Math.ceil(n / 4);
  const out: number[][] = [];
  let i = 0;
  for (let h = 0; h < k; h++) {
    const size = Math.floor(n / k) + (h < n % k ? 1 : 0);
    out.push(Array.from({ length: size }, () => i++));
  }
  return out;
};
type Color = 'wait' | 'go' | 'yellow' | 'red' | 'mada';
type Res = { fly: boolean; ms: number | null };
/** これより遅かったら「遅すぎ」で打ち切り */
const LATE = 1500;
const BG: Record<Color, string> = { wait: '#3a3530', go: '#1fc95b', yellow: '#ffd23f', red: '#e8202a', mada: '#3d7bff' }; // 「まだ！」は緑と間違えへん青
const LABEL: Record<Color, string> = { wait: '待って…', go: '今！', yellow: 'まだやで', red: 'まだやで', mada: 'まだ！' };
const LV_TEXT: Record<Level, string> = { yurume: 'フェイクなし', futsu: 'たまにフェイクが出る', jigoku: 'フェイクが何回も出る' };

/**
 * 反射神経バトル：画面が緑になった瞬間にタップ。フライングした人は罰、おらんかったら一番遅い人が罰。
 * 「1人ずつ」か「みんな同時」（4人までの組ごとに画面を区切って一斉に）を選べる。
 * 普通はたまにフェイク、地獄はフェイクが何回も。緑になる時間も毎回バラバラ
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
  const [style, setStyle] = useState<Style>('solo');
  const heats = useRef(heatsOf(n)).current;
  const [h, setH] = useState(0);
  const resRef = useRef<(Res | null)[]>(Array(n).fill(null));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => {
    load<Style>('nd_rfstyle', 'solo').then((v) => { if (v === 'multi' || v === 'solo') setStyle(v); }).catch(() => {});
    if (skipIntro) newRound(1);
    return clear;
  }, []);
  const pickStyle = (v: Style) => { setStyle(v); save('nd_rfstyle', v); };

  const paint = (c: Color) => { colorRef.current = c; setColor(c); };
  const newRound = (r: number) => {
    setRound(r);
    setK(0);
    setRes(Array(n).fill(null));
    resRef.current = Array(n).fill(null);
    setLosers([]);
    setH(0);
    setPhase(styleRef.current === 'multi' ? 'mhand' : 'hand');
  };
  const styleRef = useRef<Style>('solo');
  styleRef.current = style;
  const go = () => {
    clear();
    paint('wait');
    const W: Phase = styleRef.current === 'multi' ? 'mwait' : 'wait';
    setPhase(W);
    phaseRef.current = W;
    // 緑になるのは毎回バラバラ（5〜15秒のどこか）。フェイクも数・時間・色がバラバラで、緑の直前とは限らへん
    const wait = 5000 + Math.random() * 10000; // 5〜15秒
    const want = level === 'yurume' ? 0 : level === 'futsu' ? (Math.random() < 0.55 ? 1 : 0) : [0, 1, 1, 2, 2, 3][Math.floor(Math.random() * 6)];
    const plan: { at: number; f: Color }[] = [];
    for (let t = 0; t < 40 && plan.length < want; t++) {
      const at = 1500 + Math.random() * (wait - 1500 - 1200);
      if (at < 1500 || plan.some((x) => Math.abs(x.at - at) < 1100)) continue;
      const pool: Color[] = ['yellow', 'red', 'mada'];
      plan.push({ at, f: level === 'futsu' ? 'yellow' : pool[Math.floor(Math.random() * 3)] });
    }
    plan.forEach(({ at, f }) => {
      timers.current.push(setTimeout(() => {
        if (phaseRef.current !== W) return;
        paint(f);
        timers.current.push(setTimeout(() => { if (phaseRef.current === W && colorRef.current === f) paint('wait'); }, 800));
      }, at));
    });
    timers.current.push(setTimeout(() => { if (phaseRef.current !== W) return; goShown.current = performance.now(); paint('go'); play('pop'); }, wait));
    timers.current.push(setTimeout(() => {
      if (phaseRef.current !== W || colorRef.current !== 'go') return;
      if (W === 'mwait') heatEndRef.current();
      else tapRef.current(true);
    }, wait + LATE));
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
  // みんな同時：自分のエリアを押した瞬間。緑になる前ならその人だけフライング
  const zoneTap = (i: number) => {
    if (phaseRef.current !== 'mwait' || resRef.current[i] || !heats[h].includes(i)) return;
    const fly = colorRef.current !== 'go';
    const ms = fly ? null : Math.min(LATE, Math.max(0, Math.round(performance.now() - goShown.current)));
    const nr = resRef.current.slice();
    nr[i] = { fly, ms };
    resRef.current = nr;
    setRes(nr);
    play(fly ? 'boom' : 'coin');
    if (heats[h].every((j) => nr[j])) heatEndRef.current();
  };
  // 組が終わった（全員押した or 緑から1.5秒）：押してへん人は「遅すぎ」
  const heatEndRef = useRef(() => {});
  heatEndRef.current = () => {
    if (phaseRef.current !== 'mwait') return;
    clear();
    const nr = resRef.current.slice();
    for (const j of heats[h]) {
      if (!nr[j]) nr[j] = { fly: false, ms: LATE };
      const r = nr[j]!;
      if (!r.fly && (r.ms as number) < LATE && (best[j] == null || (r.ms as number) < (best[j] as number))) best[j] = r.ms;
    }
    resRef.current = nr;
    setRes(nr);
    setTurns((t) => t + 1);
    if (h + 1 < heats.length) {
      phaseRef.current = 'mdone';
      setPhase('mdone');
      return;
    }
    const idx = members.map((_, i) => i);
    const flyers = idx.filter((i) => nr[i]!.fly);
    if (flyers.length) setLosers(flyers);
    else {
      const worst = Math.max(...idx.map((i) => nr[i]!.ms as number));
      setLosers(idx.filter((i) => nr[i]!.ms === worst));
    }
    phaseRef.current = 'rank';
    setPhase('rank');
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

  const zones = (heat: number[], live: boolean) => {
    const cols = heat.length <= 2 ? 1 : 2;
    const rowsN = Math.ceil(heat.length / cols);
    const rowsArr = Array.from({ length: rowsN }, (_, r) => heat.slice(r * cols, r * cols + cols));
    return (
      <View style={[s.zones, !live && { height: 150, flex: 0 }]}>
        {rowsArr.map((row, r) => (
          <View key={r} style={s.zoneRow}>
            {row.map((i) => {
              const z = res[i];
              const top = r === 0 && rowsN > 1;
              return (
                <View
                  key={i}
                  onTouchStart={live ? () => zoneTap(i) : undefined}
                  style={[s.zone, { borderColor: z?.fly ? '#ff3b3b' : colorOf(i), backgroundColor: z ? (z.fly ? 'rgba(232,32,42,0.75)' : alpha(colorOf(i), 0.55)) : alpha(colorOf(i), 0.14), borderStyle: z ? 'solid' : 'dashed' }]}
                >
                  <View style={top && { transform: [{ rotate: '180deg' }] }}>
                    <Text style={[s.zoneName, { color: live ? '#fff' : fg }]} numberOfLines={1}>{members[i].name}</Text>
                    {!!z && <Text style={s.zoneV}>{label(z)}</Text>}
                  </View>
                </View>
              );
            })}
            {row.length < cols && <View style={{ flex: 1 }} />}
          </View>
        ))}
      </View>
    );
  };
  const head = `第${round}回戦${heats.length > 1 ? `・${h + 1}組目（全${heats.length}組）` : ''}`;

  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="reflex" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：${LV_TEXT[level]}`} />
          <View style={s.styleRow}>
            {(['solo', 'multi'] as Style[]).map((v) => {
              const on = style === v;
              return (
                <Tap key={v} onPress={() => pickStyle(v)} style={[s.styleBtn, { borderColor: on ? pal.cardEdge : alpha('#888888', 0.4), backgroundColor: on ? alpha(pal.cardEdge, 0.2) : 'transparent' }]}>
                  <Text style={[s.styleT, { color: fg }]}>{v === 'solo' ? '1人ずつ' : 'みんな同時'}</Text>
                  <Text style={[s.styleS, { color: fg }]}>{v === 'solo' ? '順番にじっくり' : n > 4 ? `4人までの${heats.length}組に分けて` : '画面を分けて一斉に'}</Text>
                </Tap>
              );
            })}
          </View>
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
    case 'mhand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{head}</Prog>
          <Text style={[s.heatNames, { color: fg }]}>{heats[h].map((i) => members[i].name).join('・')}</Text>
          {zones(heats[h], false)}
          <Note fg={fg}>{'スマホを真ん中に置いて、自分のエリアの上に指1本で構えて（まだ触らんといて）。\n緑になる前に触ったらフライング'}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="準備OK" onPress={go} />;
      break;
    case 'mwait':
      card = (
        <View style={[s.box, s.multiBox, { backgroundColor: BG[color] }]}>
          {zones(heats[h], true)}
          <Text pointerEvents="none" style={[s.boxText, s.multiLabel, { color: color === 'yellow' ? '#141210' : '#fff' }]}>{LABEL[color]}</Text>
        </View>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>緑になったら自分のエリアをタップ（隙間は数えへん）</Text>;
      break;
    case 'mdone': {
      const heat = heats[h];
      const rows = heat.slice().sort((a, b) => (res[a]!.fly ? 1e9 : res[a]!.ms!) - (res[b]!.fly ? 1e9 : res[b]!.ms!));
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${head}の記録`}</Prog>
          <View style={s.board}>
            {rows.map((i, r) => (
              <View key={i} style={s.row}>
                <Text style={[s.rk, { color: fg }]}>{res[i]!.fly ? '×' : r + 1}</Text>
                <Text style={[s.nm, { color: fg }]} numberOfLines={1}>{members[i].name}</Text>
                <Text style={[s.v, { color: res[i]!.fly ? '#ff3b3b' : fg }]}>{label(res[i]!)}</Text>
              </View>
            ))}
          </View>
          <Note fg={fg}>{`次の組：${heats[h + 1].map((i) => members[i].name).join('・')}`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="次の組へ" onPress={() => { setH(h + 1); setPhase('mhand'); }} />;
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
      pal={pal} members={members} pen={P.pen} doer={(phase === 'hand' || phase === 'wait' || phase === 'done') && style === 'solo' ? who : -1} frame={phase === 'intro' ? C.muted : phase === 'rank' ? '#ff2a2a' : style === 'multi' ? C.muted : colorOf(who)}
      rules={HELP.reflex.rules} meta={`反射神経バトル・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={() => { clear(); phaseRef.current = 'intro'; onQuit(); }} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  box: { flex: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  multiBox: { padding: 10, alignItems: 'stretch', justifyContent: 'flex-start' },
  multiLabel: { position: 'absolute', alignSelf: 'center', top: '42%', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8, fontSize: 44, lineHeight: 52 },
  zones: { flex: 1, gap: 12, alignSelf: 'stretch' },
  zoneRow: { flex: 1, flexDirection: 'row', gap: 12 },
  zone: { flex: 1, borderRadius: 14, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  zoneName: { fontFamily: F.display, fontSize: 22, textAlign: 'center' },
  zoneV: { color: '#fff', fontWeight: '900', fontSize: 15, textAlign: 'center' },
  heatNames: { fontFamily: F.display, fontSize: 22, textAlign: 'center' },
  styleRow: { flexDirection: 'row', gap: 8 },
  styleBtn: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 14, borderWidth: 2 },
  styleT: { fontSize: 17, fontWeight: '900' },
  styleS: { fontSize: 11, opacity: 0.65 },
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
