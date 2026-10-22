import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { DeviceMotion } from 'expo-sensors';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Note, Outline, Prog } from '../components/ModeParts';
import { shuffle } from '../lib/game';
import { StageShell, usePenalty } from '../components/StageShell';
import { ScoreRank } from '../components/ScoreRank';
import { useHold, useReveal } from '../components/Reveal';
import { HELP } from '../lib/help';
import { useCountdown } from '../lib/useCountdown';
import { play } from '../lib/sound';
import { Haptics } from '../lib/vibe';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';
import dekoJson from '../data/deko.json';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'hand' | 'count' | 'play' | 'turn' | 'tally' | 'rank' | 'batsu';
type Word = { c: string; w: string };
const SEC: Record<Level, number> = { yurume: 90, futsu: 60, jigoku: 45 };
const ALL: Word[] = Object.entries((dekoJson as { cats: Record<string, string[]> }).cats).flatMap(([c, ws]) => ws.map((w) => ({ c, w })));
const DEG = 180 / Math.PI;

/**
 * おでこ当て：番の人がスマホをおでこに当てる（画面は外向き）。周りのヒントで当てたら下に傾けて正解、上に傾けてパス。
 * 時間内の正解数が一番少ない人が罰（同点は全員）。傾きがとれへん時は周りの人がボタンを押す
 */
export default function DekoScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const sec = SEC[level];
  const P = usePenalty(members, level, night, 'deko');
  const H = useHold();
  const RV = useReveal();
  const deck = useRef<Word[]>([]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [k, setK] = useState(0);
  const [count, setCount] = useState(3);
  const [cur, setCur] = useState<Word>(ALL[0]);
  const [flash, setFlash] = useState<'' | 'ok' | 'pass'>('');
  const [list, setList] = useState<{ w: string; ok: boolean }[]>([]);
  const [score, setScore] = useState<number[]>(() => Array(n).fill(0));
  const [losers, setLosers] = useState<number[]>([]);
  const [turns, setTurns] = useState(0);
  const [manual, setManual] = useState(false);
  const best = useRef<number[]>(Array(n).fill(0)).current;
  const beta = useRef<number | null>(null);
  const betaAt = useRef(0);
  const base = useRef<number | null>(null);
  const armed = useRef(false);
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  const flashRef = useRef('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const who = k % n;
  const clock = useCountdown(() => end());
  const hitRef = useRef<(ok: boolean) => void>(() => {});

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        if (!(await DeviceMotion.isAvailableAsync())) return;
        const perm = await DeviceMotion.requestPermissionsAsync?.();
        if (perm && perm.granted === false) return;
        DeviceMotion.setUpdateInterval(60);
        sub = DeviceMotion.addListener((e: { rotation?: { beta: number } }) => {
          if (!e.rotation) return;
          beta.current = e.rotation.beta * DEG;
          betaAt.current = Date.now();
          // 始めた時の向きから、画面が床を向く方（beta が増える）＝正解、天井を向く方＝パス
          if (phaseRef.current !== 'play' || base.current == null || flashRef.current) return;
          const d = beta.current - base.current;
          if (!armed.current) {
            if (Math.abs(d) < 15) armed.current = true;
            return;
          }
          if (d > 35) hitRef.current(true);
          else if (d < -35) hitRef.current(false);
        });
      } catch {}
    })();
    if (skipIntro) newRound();
    return () => {
      sub?.remove();
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const draw = () => {
    if (!deck.current.length) deck.current = shuffle(ALL);
    return deck.current.pop()!;
  };
  const newRound = () => {
    setRound((r) => r + 1);
    setScore(Array(n).fill(0));
    setLosers([]);
    turn(0);
  };
  const turn = (kk: number) => {
    setK(kk);
    setList([]);
    setPhase('hand');
  };
  const go = () => {
    setPhase('count');
    setCount(3);
    play('heart');
    [1, 2].forEach((j) => timers.current.push(setTimeout(() => { setCount(3 - j); play('heart'); }, j * 800)));
    timers.current.push(setTimeout(() => {
      const live = beta.current != null && Date.now() - betaAt.current < 1500;
      setManual(!live);
      base.current = live ? beta.current : null;
      armed.current = false;
      flashRef.current = '';
      setFlash('');
      setCur(draw());
      phaseRef.current = 'play';
      setPhase('play');
      play('coin');
      clock.start(sec);
    }, 2400));
  };
  const hit = (ok: boolean) => {
    if (phaseRef.current !== 'play' || flashRef.current) return;
    flashRef.current = ok ? 'ok' : 'pass';
    armed.current = false;
    setFlash(ok ? 'ok' : 'pass');
    setList((l) => [...l, { w: cur.w, ok }]);
    if (ok) setScore((s0) => s0.map((v, j) => (j === who ? v + 1 : v)));
    play(ok ? 'pinpon' : 'tick');
    Haptics.impactAsync(ok ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    timers.current.push(setTimeout(() => {
      if (phaseRef.current !== 'play') return;
      flashRef.current = '';
      setFlash('');
      setCur(draw());
    }, 650));
  };
  hitRef.current = hit;
  const end = () => {
    if (phaseRef.current !== 'play') return;
    phaseRef.current = 'turn';
    clock.stop();
    setPhase('turn');
    setTurns((t) => t + 1);
    play('timeup');
  };
  const after = () => {
    best[who] = Math.max(best[who], score[who]);
    if (k + 1 < n) return turn(k + 1);
    const min = Math.min(...score);
    setLosers(members.map((_, i) => i).filter((i) => score[i] === min));
    setPhase('tally');
    H.hold('結果は…', 1800, () => { setPhase('rank'); RV.start(n); });
  };
  const finish = (p: number[] = P.pen) => {
    clock.stop();
    P.stats.dekoBest = best.slice();
    onFinish(p, turns, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="deko" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：1人${sec}秒`} note="ゆるめ90秒・普通60秒・地獄45秒" />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="スタート" onPress={newRound} />;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦・${k + 1}/${n}人目`}</Prog>
          <HandWho members={members} i={who} sub="の番" fg={fg} />
          <Note fg={fg}>{'スマホを縦にしておでこに当てる（画面は外向き、自分は見たらアカン）。\n当てたら下に傾けて正解、わからんかったら上に傾けてパス'}</Note>
          <Text style={[s.lim, { color: fg }]}>{sec}秒</Text>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="おでこに当てた → 3・2・1" onPress={go} />;
      break;
    case 'count':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[who].name}、構えて…`}</Prog>
          <Text style={[s.count, { color: fg }]}>{count}</Text>
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>0の瞬間の向きがまっすぐ</Text>;
      break;
    case 'play': {
      const bg = flash === 'ok' ? '#1f9d55' : flash === 'pass' ? '#e8780a' : undefined;
      const c = bg ? '#fff' : fg;
      card = (
        <ModeCard pal={pal} center bg={bg}>
          <Text style={[s.time, { color: c }]}>{`${clock.left}秒・${score[who]}問正解`}</Text>
          <Text style={[s.cat, { color: c }]}>{cur.c}</Text>
          <Text style={[s.word, { color: c }]} numberOfLines={2} adjustsFontSizeToFit>{flash === 'ok' ? '正解！' : flash === 'pass' ? 'パス' : cur.w}</Text>
          <Note fg={c}>{manual ? '周りの人が下のボタンを押して' : '下に傾けたら正解・上に傾けたらパス'}</Note>
        </ModeCard>
      );
      controls = (
        <View style={s.row}>
          <Outline label="パス" fg={pal.fg} onPress={() => hit(false)} style={{ flex: 1 }} />
          <View style={{ flex: 1 }}><BigButton pal={pal} label="正解" onPress={() => hit(true)} /></View>
        </View>
      );
      break;
    }
    case 'turn':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[who].name}の結果`}</Prog>
          <Text style={[s.num, { color: fg }]}>{score[who]}<Text style={s.unit}> 問正解</Text></Text>
          <View style={s.list}>
            {list.length ? list.map((x, j) => (
              <Text key={j} style={[s.chip, { color: x.ok ? '#1f9d55' : fg, borderColor: x.ok ? '#1f9d55' : 'rgba(136,136,136,0.4)', opacity: x.ok ? 1 : 0.55 }]}>{`${x.ok ? '○' : '×'} ${x.w}`}</Text>
            )) : <Text style={[s.chip, { color: fg }]}>なし</Text>}
          </View>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={k + 1 < n ? `次は${members[(who + 1) % n].name}` : '結果発表'} onPress={after} />;
      break;
    case 'tally':
    case 'rank':
      card = (
        <ModeCard pal={pal} bg="#1a0606" edge="#e8202a">
          <ScoreRank members={members} score={score} losers={losers} rv={RV} fg="#f7f3ea" title={`第${round}回戦の結果`} foot={`${losers.map((i) => members[i].name).join('・')}が最下位`} />
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
      rules={HELP.deko.rules} meta={`おでこ当て・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={() => { clock.stop(); timers.current.forEach(clearTimeout); onQuit(); }} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  lim: { fontFamily: F.display, fontSize: 44, lineHeight: 50 },
  count: { fontFamily: F.display, fontSize: 130, lineHeight: 140 },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  time: { fontSize: 16, fontWeight: '900', opacity: 0.8 },
  cat: { fontSize: 14, fontWeight: '800', opacity: 0.6 },
  word: { fontFamily: F.display, fontSize: 64, lineHeight: 76, textAlign: 'center' },
  num: { fontFamily: F.display, fontSize: 84, lineHeight: 92 },
  unit: { fontSize: 20, opacity: 0.6 },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 14, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8 },
});
