import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Note, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { Tap } from '../components/Tap';
import { HELP } from '../lib/help';
import { RevealItem, useHold, useReveal } from '../components/Reveal';
import { play } from '../lib/sound';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'hand' | 'count' | 'tally' | 'play' | 'done' | 'rank' | 'pick' | 'batsu';
const SEC = 5;
/** dBFS（-60〜0）を 0〜100 に */
const score = (db: number) => Math.max(0, Math.min(100, ((db + 60) / 60) * 100));

/**
 * 声デカ選手権：1人ずつ5秒間、スマホに向かって叫ぶ。声が一番小さかった人が罰（地獄は罰2倍）。
 * 大きさを測るだけで、録音したものは捨てる。マイクが使えへん時はみんなで一番小さかった人を決める
 */
export default function VoiceScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const P = usePenalty(members, level, night, 'voice');
  const H = useHold();
  const RV = useReveal();
  const recorder = useAudioRecorder({ ...RecordingPresets.LOW_QUALITY, isMeteringEnabled: true });
  const [phase, setPhase] = useState<Phase>('intro');
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  const [mic, setMic] = useState<boolean | null>(null);
  const [round, setRound] = useState(1);
  const [k, setK] = useState(0);
  const who = (k + round - 1) % n;
  const [res, setRes] = useState<(number | null)[]>(() => Array(n).fill(null));
  const [losers, setLosers] = useState<number[]>([]);
  const [turns, setTurns] = useState(0);
  const [left, setLeft] = useState(SEC);
  const [cur, setCur] = useState(0);
  const [peak, setPeak] = useState(0);
  const peakRef = useRef(0);
  const best = useRef<(number | null)[]>(Array(n).fill(null)).current;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopAll = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    try { recorder.stop(); } catch {}
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
  };
  useEffect(() => {
    if (skipIntro) start();
    return stopAll;
  }, []);

  const start = async () => {
    let ok = false;
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      ok = !!perm?.granted;
    } catch {}
    setMic(ok);
    newRound(1, ok);
  };
  const newRound = (r: number, ok = mic) => {
    setRound(r);
    setK(0);
    setRes(Array(n).fill(null));
    setLosers([]);
    setPhase(ok ? 'hand' : 'pick');
  };
  const [count, setCount] = useState(3);
  // 「叫ぶ！」を押したら3・2・1で息を吸う時間をとってからスタート（その間にマイクを開いておく）
  const go = async () => {
    setPhase('count');
    phaseRef.current = 'count';
    setCount(3);
    play('tick');
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setMic(false);
      setPhase('pick');
      return;
    }
    for (const c of [2, 1]) {
      await new Promise((r) => setTimeout(r, 800));
      if (phaseRef.current !== 'count') return;
      setCount(c);
      play('tick');
    }
    await new Promise((r) => setTimeout(r, 800));
    if (phaseRef.current !== 'count') return;
    peakRef.current = 0;
    setPeak(0);
    setCur(0);
    setLeft(SEC);
    setPhase('play');
    phaseRef.current = 'play';
    play('coin');
    const startAt = Date.now();
    let smooth = 0;
    timer.current = setInterval(() => {
      const ms = SEC * 1000 - (Date.now() - startAt);
      if (ms <= 0) return done();
      setLeft(ms / 1000);
      const st = recorder.getStatus?.();
      const db = typeof st?.metering === 'number' ? st.metering : -160;
      smooth = smooth * 0.6 + score(db) * 0.4;
      setCur(smooth);
      if (smooth > peakRef.current) {
        peakRef.current = smooth;
        setPeak(smooth);
      }
    }, 80);
  };
  const doneRef = useRef(() => {});
  const done = () => doneRef.current();
  doneRef.current = () => {
    if (phaseRef.current !== 'play') return;
    stopAll();
    const sc = Math.round(peakRef.current);
    const nr = res.slice();
    nr[who] = sc;
    setRes(nr);
    if (sc > (best[who] ?? -1)) best[who] = sc;
    setTurns((t) => t + 1);
    if (k + 1 >= n) {
      const min = Math.min(...(nr as number[]));
      setLosers(members.map((_, i) => i).filter((i) => nr[i] === min));
      // ドラムロールでためてから、1人ずつ順位発表
      setPhase('tally');
      H.hold('結果は…', 1800, () => { setPhase('rank'); RV.start(n); });
    } else {
      play('fanfare');
      setPhase('done');
    }
  };
  const pick = (i: number) => {
    setRes(members.map((_, j) => (j === i ? 0 : 1)));
    setLosers([i]);
    setTurns((t) => t + 1);
    setPhase('rank');
  };
  const finish = (p: number[] = P.pen) => {
    stopAll();
    phaseRef.current = 'intro';
    P.stats.voiceBest = best.slice();
    onFinish(p, turns, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const x = level === 'jigoku' ? 2 : 1;
  // 順位発表の時だけ、1行ずつ出す
  const rvWrap = (key: number, k: number, bad: boolean, el: React.ReactNode) =>
    phase === 'rank' ? <RevealItem key={key} k={k} rv={RV} lose={bad}>{el}</RevealItem> : el;
  const board = (hi: number, dark: boolean) => {
    const idx = members.map((_, i) => i);
    const c = dark ? '#f7f3ea' : fg;
    const rows = idx.filter((i) => res[i] != null).sort((a, b) => (res[b] as number) - (res[a] as number));
    return (
      <ScrollView style={s.boardScroll} contentContainerStyle={s.board}>
        {rows.map((i, r) => {
          const bad = losers.includes(i) && (phase === 'rank' || phase === 'batsu');
          return rvWrap(i, r, bad,
            <View key={i} style={[s.row, i === hi && { borderColor: colorOf(i) }]}>
              <Text style={[s.rk, { color: c }]}>{r + 1}</Text>
              <Text style={[s.nm, { color: bad ? '#ff3b3b' : c }]} numberOfLines={1}>{members[i].name}</Text>
              <Text style={[s.v, { color: bad ? '#ff3b3b' : c }]}>{mic ? res[i] : bad ? '一番小さい' : ''}</Text>
            </View>,
          );
        })}
        {idx.filter((i) => res[i] == null).map((i) => (
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
        <IntroCard pal={pal} mode="voice" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：${level === 'jigoku' ? '一番小さい人の罰が2倍' : '一番小さい人が罰'}`} note="次にマイクの許可を聞かれる。録音はせえへん（大きさを測るだけ）" />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="スタート" onPress={start} />;
      break;
    case 'pick':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦（マイクが使えへんのでみんなで判定）`}</Prog>
          <Text style={[s.lead, { color: fg }]}>{'1人ずつ5秒叫んで、\n一番小さかった人をタップ'}</Text>
          <View style={s.pickGrid}>
            {members.map((m, i) => (
              <Tap key={i} onPress={() => pick(i)} style={[s.pickBtn, { borderColor: colorOf(i), backgroundColor: alpha(colorOf(i), 0.18) }]}>
                <Text style={[s.pickText, { color: fg }]} numberOfLines={1}>{m.name}</Text>
              </Tap>
            ))}
          </View>
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>マイクを許可してへんかったら、スマホの設定から許可すると測れる</Text>;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦・${k + 1}/${n}人目`}</Prog>
          <HandWho members={members} i={who} sub="の番" fg={fg} />
          <Note fg={fg}>{`スマホに向かって${SEC}秒間、全力で叫ぶ。\nなんでもOK（「ノリダーン！」とか）`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="叫ぶ！スタート" onPress={go} />;
      break;
    case 'count':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[who].name}、息を吸って…`}</Prog>
          <Text style={[s.count, { color: fg }]}>{count}</Text>
          <Note fg={fg}>{`0になったら${SEC}秒間叫ぶ`}</Note>
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>スマホを口の前に</Text>;
      break;
    case 'play':
      card = (
        <ModeCard pal={pal} center>
          <Text style={[s.sec, { color: left <= 2 ? '#ff3b3b' : fg }]}>
            {Math.floor(left)}
            <Text style={s.secSub}>.{Math.floor((left % 1) * 10)} 秒</Text>
          </Text>
          <View style={s.meter}>
            <View style={[s.meterFill, { width: `${cur}%` }]} />
          </View>
          <Text style={[s.peak, { color: fg }]}>
            {Math.round(peak)}
            <Text style={s.secSub}> 最大</Text>
          </Text>
          <Note fg={fg}>{`${members[who].name}、叫べ！`}</Note>
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>大きさだけ測ってる（録音はしてへん）</Text>;
      break;
    case 'done':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[who].name}の記録`}</Prog>
          <Text style={[s.peak, { color: fg }]}>
            {res[who]}
            <Text style={s.secSub}> 点</Text>
          </Text>
          {board(who, false)}
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`次は${members[(k + 1 + round - 1) % n].name}`} onPress={() => { setK(k + 1); setPhase('hand'); }} />;
      break;
    case 'rank':
      card = (
        <Pressable style={{ flex: 1 }} onPress={RV.skip}>
        <ModeCard pal={pal} center bg="#1a0606" edge="#e8202a">
          <Prog fg="#f7f3ea">{`第${round}回戦の結果`}</Prog>
          {board(-1, true)}
          {RV.ready && <Text style={s.lose}>{`${losers.map((i) => members[i].name).join('・')}が一番小さい${x > 1 ? '（罰2倍）' : ''}`}</Text>}
        </ModeCard>
        </Pressable>
      );
      controls = !RV.ready ? <Text style={[s.hint, { color: pal.muted }]}>タップで飛ばす</Text> : <BigButton pal={pal} danger label={`${losers.map((i) => members[i].name).join('・')}に罰ガチャ`} onPress={() => { P.draw(losers, x); setPhase('batsu'); }} />;
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
  // ため（ドラムロール）の間は「結果は…」を出す
  const hv = H.view(pal);
  if (hv) { card = hv.card; controls = hv.controls; }
  return (
    <StageShell
      pal={pal} members={members} pen={P.pen} doer={phase === 'hand' || phase === 'play' || phase === 'done' ? who : -1} frame={phase === 'intro' ? C.muted : phase === 'rank' ? '#ff2a2a' : colorOf(who)}
      rules={HELP.voice.rules} meta={`声デカ選手権・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={() => { stopAll(); phaseRef.current = 'intro'; onQuit(); }} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  count: { fontFamily: F.display, fontSize: 130, lineHeight: 140 },
  lead: { fontFamily: F.display, fontSize: 22, lineHeight: 30, textAlign: 'center', marginVertical: 8 },
  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', alignSelf: 'stretch' },
  pickBtn: { width: '31%', paddingVertical: 12, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
  pickText: { fontSize: 14, fontWeight: '900' },
  sec: { fontFamily: F.display, fontSize: 80, lineHeight: 88, fontVariant: ['tabular-nums'] },
  secSub: { fontSize: 18, opacity: 0.6 },
  meter: { alignSelf: 'stretch', maxWidth: 280, height: 22, borderRadius: 11, backgroundColor: 'rgba(136,136,136,0.2)', overflow: 'hidden', marginVertical: 12 },
  meterFill: { height: '100%', backgroundColor: '#7be36b' },
  peak: { fontFamily: F.display, fontSize: 72, lineHeight: 80, fontVariant: ['tabular-nums'] },
  boardScroll: { alignSelf: 'stretch', flexGrow: 0, flexShrink: 1 },
  board: { gap: 6, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: 'transparent', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2 },
  rk: { width: 18, textAlign: 'center', fontFamily: F.display, opacity: 0.55 },
  nm: { flex: 1, fontSize: 15, fontWeight: '800' },
  v: { fontFamily: F.display, fontSize: 18 },
  lose: { fontFamily: F.display, fontSize: 24, lineHeight: 30, textAlign: 'center', marginTop: 8, color: '#ff3b3b' },
});
