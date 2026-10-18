import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { DeviceMotion } from 'expo-sensors';
import { BigButton, Frame, GachaCard, RulesSheet, ScoreBar, DeckStack } from '../components/Stage';
import { HandWho, IntroCard, Lead, LevelBox, ModeCard, Note, Prog } from '../components/ModeParts';
import { HELP } from '../lib/help';
import GameMenu from '../components/GameMenu';
import { Decks } from '../lib/game';
import { play } from '../lib/sound';
import { newStats, type Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf } from '../theme';
import type { GachaItem, Level, Member, Night } from '../types';

type Props = {
  members: Member[];
  level: Level;
  night: Night;
  onQuit: () => void;
  onSettings: () => void;
  onFinish: (pen: number[], turns: number, stats: Stats) => void;
  skipIntro?: boolean;
};
type Phase = 'intro' | 'hand' | 'count' | 'play' | 'out' | 'safe' | 'batsu';

const SEC = 10;
const LIMIT: Record<Level, number> = { yurume: 6, futsu: 4, jigoku: 2 };
type Vec = [number, number, number];
/** 端末の傾き（ラジアン）から「画面の向き」のベクトル */
const vecOf = (b: number, g: number): Vec => [Math.cos(b) * Math.sin(g), -Math.sin(b), Math.cos(b) * Math.cos(g)];
/** 2色を r（0〜1）で混ぜる */
const mix = (a: string, b: string, r: number) => {
  const h = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(h(a, i) + (h(b, i) - h(a, i)) * r).toString(16).padStart(2, '0')).join('');
};
const angleOf = (v: Vec, w: Vec) => (Math.acos(Math.max(-1, Math.min(1, v[0] * w[0] + v[1] * w[1] + v[2] * w[2]))) * 180) / Math.PI;

/**
 * 傾けたらアウト：画面を上にしてスマホを手のひらに乗せる。カウントダウンが0になった瞬間の向きを0°にして10秒キープ。
 * 地獄度の角度（ゆるめ6°・普通4°・地獄2°）を超えたら即アウトで罰。周りは触らんかったら邪魔してOK。
 * センサーが使えへん時は、みんなの目で判定する
 */
export default function TiltScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const lim = LIMIT[level];
  const decks = useRef(new Decks()).current;
  decks.night = night;
  decks.level = level;
  const [phase, setPhase] = useState<Phase>(skipIntro ? 'hand' : 'intro');
  const [k, setK] = useState(0); // 何人目か
  const who = k % n;
  const [count, setCount] = useState(3);
  const [left, setLeft] = useState(SEC);
  const [angle, setAngle] = useState(0);
  const [peak, setPeak] = useState(0);
  const [outSec, setOutSec] = useState(0);
  const [manual, setManual] = useState(false);
  const [sensor, setSensor] = useState<'unknown' | 'ok' | 'none'>('unknown');
  const [pen, setPen] = useState<number[]>(() => Array(n).fill(0));
  const [tries, setTries] = useState(0);
  const [gacha, setGacha] = useState<GachaItem[]>([]);
  const stats = useRef<Stats>(newStats(n)).current;
  const maxOf = useRef<(number | null)[]>(Array(n).fill(null)).current;
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const latest = useRef<Vec | null>(null);
  const latestAt = useRef(0);
  const base = useRef<Vec | null>(null);
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  const startAt = useRef(0);
  const peakRef = useRef(0);
  const dot = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  // センサーを聞く（許可が無い・無い端末なら手動判定）
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        const ok = await DeviceMotion.isAvailableAsync();
        if (!ok) return setSensor('none');
        const perm = await DeviceMotion.requestPermissionsAsync?.();
        if (perm && perm.granted === false) return setSensor('none');
        DeviceMotion.setUpdateInterval(50);
        sub = DeviceMotion.addListener((e: { rotation?: { beta: number; gamma: number } }) => {
          if (!e.rotation) return;
          latest.current = vecOf(e.rotation.beta, e.rotation.gamma);
          latestAt.current = Date.now();
          sampleRef.current();
        });
        setSensor('ok');
      } catch {
        setSensor('none');
      }
    })();
    return () => {
      sub?.remove();
      clear();
    };
  }, []);

  const sampleRef = useRef<() => void>(() => {});
  const onSample = () => {
    if (phaseRef.current !== 'play' || !base.current || !latest.current) return;
    const v = latest.current;
    const a = angleOf(base.current, v);
    if (a > peakRef.current) peakRef.current = a;
    setAngle(a);
    // 0°からのずれを左右・前後に分けて、限界の角度でちょうど円のフチ
    const dx = (Math.asin(Math.max(-1, Math.min(1, v[0] - base.current[0]))) * 180) / Math.PI;
    const dy = (Math.asin(Math.max(-1, Math.min(1, v[1] - base.current[1]))) * 180) / Math.PI;
    dot.setValue({ x: Math.max(-1.2, Math.min(1.2, dx / lim)) * 60, y: Math.max(-1.2, Math.min(1.2, -dy / lim)) * 60 });
    if (a > lim) out();
  };
  sampleRef.current = onSample;

  const begin = (next: number) => {
    clear();
    setK(next);
    setAngle(0);
    setPeak(0);
    peakRef.current = 0;
    dot.setValue({ x: 0, y: 0 });
    setPhase('hand');
  };
  const countdown = () => {
    setPhase('count');
    setCount(3);
    play('tick');
    [1, 2].forEach((j) => timers.current.push(setTimeout(() => { setCount(3 - j); play('tick'); }, j * 800)));
    timers.current.push(setTimeout(go, 2400));
  };
  const go = () => {
    const live = !!latest.current && Date.now() - latestAt.current < 1500;
    setManual(!live);
    base.current = live ? latest.current : null;
    startAt.current = Date.now();
    peakRef.current = 0;
    setLeft(SEC);
    setPhase('play');
    phaseRef.current = 'play';
    play('coin');
    const tick = () => {
      const ms = SEC * 1000 - (Date.now() - startAt.current);
      if (phaseRef.current !== 'play') return;
      if (ms <= 0) return safe();
      setLeft(ms / 1000);
      timers.current.push(setTimeout(tick, 100));
    };
    timers.current.push(setTimeout(tick, 100));
  };
  const record = (isManual: boolean) => {
    if (!isManual) maxOf[who] = Math.max(maxOf[who] ?? 0, peakRef.current);
    setPeak(peakRef.current);
    setTries((t) => t + 1);
  };
  const out = () => {
    if (phaseRef.current !== 'play') return;
    phaseRef.current = 'out';
    clear();
    setOutSec((Date.now() - startAt.current) / 1000);
    record(!base.current);
    setPhase('out');
    play('boom');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  };
  const safe = () => {
    if (phaseRef.current !== 'play') return;
    phaseRef.current = 'safe';
    clear();
    record(!base.current);
    setPhase('safe');
    play('fanfare');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };
  const doGacha = () => {
    const items = [{ i: who, n: 1, ...decks.batsu(members, who) }];
    setGacha(items);
    setPhase('batsu');
    play(items[0].lucky ? 'gachaLucky' : 'gacha');
  };
  const accept = () => {
    const np = pen.slice();
    gacha.forEach((x) => {
      if (x.lucky) stats.lucky[x.i]++;
      else {
        np[x.i] += 1;
        stats.why[x.i].tilt = (stats.why[x.i].tilt ?? 0) + 1;
      }
    });
    setPen(np);
    begin(k + 1);
  };
  const finish = () => {
    clear();
    // 鋼の手：一番揺れへんかった人（センサーで測れた人だけ）
    const ok = members.map((_, i) => i).filter((i) => maxOf[i] != null);
    if (ok.length > 1) stats.steady = members.map((_, i) => (maxOf[i] == null ? null : maxOf[i]));
    onFinish(pen, tries, stats);
  };

  // 限界に近づくほどフチが赤く太く。0.8を超えたら札がブルブル
  const heat = phase === 'out' ? 1 : phase === 'play' && !manual ? Math.min(1, angle / lim) : 0;
  const edge = heat >= 0.8 && heat < 1;
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!edge) return void shake.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 40, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]),
    );
    loop.start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    return () => loop.stop();
  }, [edge]);
  const pal = STAGE[level];
  const fg = pal.cardFg;
  const frame = phase === 'intro' ? C.muted : mix(colorOf(who), '#ff2a2a', heat);
  const nextName = members[(k + 1) % n].name;

  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="tilt" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：${lim}°を超えたらアウト`} note="ゆるめ6°・普通4°・地獄2°" />
          {sensor === 'none' && <Text style={[s.small, { color: fg }]}>このスマホは角度がとられへんので、みんなの目で判定するモードになる</Text>}
        </IntroCard>
      );
      controls = <BigButton pal={pal} label="スタート" onPress={() => begin(0)} />;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${k + 1}人目`}</Prog>
          <HandWho members={members} i={who} sub="の番" fg={fg} />
          <Note fg={fg}>{'画面を上にして、手のひらに平らに乗せて。\n周りは触らんかったら、しゃべって邪魔してOK'}</Note>
          <Text style={[s.lim, { color: fg }]}>{lim}°</Text>
          <Text style={[s.small, { color: fg }]}>超えたらアウト</Text>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="準備OK → カウントダウン" onPress={countdown} />;
      break;
    case 'count':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[who].name}、動くな…`}</Prog>
          <Text style={[s.count, { color: fg }]}>{count}</Text>
          <Note fg={fg}>0になった瞬間の向きが0°</Note>
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>スマホを動かさんといて</Text>;
      break;
    case 'play':
      card = (
        <ModeCard pal={pal} center>
          <Text style={[s.timer, { color: left <= 3 ? '#ff3b3b' : fg }]}>{left.toFixed(1)}</Text>
          {manual ? (
            <>
              <Lead fg={fg}>{'傾けんように\nキープ！'}</Lead>
              <Note fg={fg}>{'このスマホでは角度がとられへんので、\n傾いたらみんなで判定して押して'}</Note>
            </>
          ) : (
            <>
              <View style={[s.level, { borderColor: alpha('#888888', 0.4) }]}>
                <View style={s.zoneY} />
                <View style={s.zoneG} />
                <View style={s.ring} />
                <View style={[s.cross, { width: 2, height: '100%' }]} />
                <View style={[s.cross, { height: 2, width: '100%' }]} />
                <Animated.View style={[s.dot, { backgroundColor: angle > lim * 0.7 ? '#ff8a1a' : '#5bd35b', transform: dot.getTranslateTransform() }]} />
              </View>
              <Text style={[s.deg, { color: fg }]}>
                {angle.toFixed(1)}
                <Text style={s.degSub}>°  / {lim}°</Text>
              </Text>
            </>
          )}
        </ModeCard>
      );
      controls = manual ? <BigButton pal={pal} danger label="傾いた！アウト" onPress={out} /> : <Text style={[s.hint, { color: pal.muted }]}>{`${lim}°を超えたら即アウト`}</Text>;
      break;
    case 'out':
      card = (
        <ModeCard pal={pal} center bg="#1a0606" edge="#e8202a">
          <Text style={[s.big, { color: '#ff2a2a' }]}>アウト！</Text>
          {!manual && (
            <Text style={[s.deg, { color: '#f7f3ea' }]}>
              {peak.toFixed(1)}
              <Text style={s.degSub}>° 傾いた</Text>
            </Text>
          )}
          <Note fg="#f7f3ea">{manual ? 'みんなの判定でアウト' : `${outSec.toFixed(1)}秒で${lim}°を超えた`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} danger label={`${members[who].name}に罰ガチャ`} onPress={doGacha} />;
      break;
    case 'safe':
      card = (
        <ModeCard pal={pal} center>
          <Text style={[s.big, { color: '#1f9d55' }]}>セーフ！</Text>
          {!manual && (
            <Text style={[s.deg, { color: fg }]}>
              {peak.toFixed(1)}
              <Text style={s.degSub}>° まで（最大）</Text>
            </Text>
          )}
          <Note fg={fg}>{`${SEC}秒キープ成功。${members[who].name}は罰なし`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`次は${nextName}`} onPress={() => begin(k + 1)} />;
      break;
    case 'batsu':
      card = (
        <DeckStack pal={pal} minHeight={0}>
          <GachaCard pal={pal} members={members} items={gacha} />
        </DeckStack>
      );
      controls = <BigButton pal={pal} label={`${gacha.every((x) => x.lucky) ? 'ラッキー！' : '受け入れた'} → 次は${nextName}`} onPress={accept} />;
      break;
  }

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <View style={[s.wrap, flipped && { transform: [{ rotate: '180deg' }] }]}>
        <ScoreBar pal={pal} members={members} pen={pen} rev={Array(n).fill(false)} doer={phase === 'intro' ? -1 : who} onMenu={() => setMenu(true)} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
        <Animated.View style={{ flex: 1, transform: [{ translateX: Animated.multiply(shake, 3) }] }}>{card}</Animated.View>
        {controls}
      </View>
      {heat > 0 && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,30,30,${(heat * heat * 0.22).toFixed(3)})`, zIndex: 9 }]} />}
      <Frame color={frame} />
      {heat > 0 && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 3 + 13 * heat, borderColor: frame, opacity: edge ? 0.9 : 1, zIndex: 10 }]} />}
      <RulesSheet visible={rules} custom={HELP.tilt.rules} onClose={() => setRules(false)} />
      <GameMenu
        visible={menu}
        meta={`傾けたらアウト・${LEVEL_LABEL[level]}・${tries}回挑戦`}
        rulesSub="このモードの遊び方"
        onRules={() => setRules(true)}
        onEnd={finish}
        onSettings={onSettings}
        onQuit={() => { clear(); onQuit(); }}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  small: { fontSize: 12, fontWeight: '700', opacity: 0.65, lineHeight: 18, textAlign: 'center' },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  lim: { fontFamily: F.display, fontSize: 44, lineHeight: 50 },
  count: { fontFamily: F.display, fontSize: 130, lineHeight: 140 },
  timer: { fontFamily: F.display, fontSize: 56, lineHeight: 64, fontVariant: ['tabular-nums'] },
  level: { width: 240, height: 240, borderRadius: 120, borderWidth: 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,42,42,0.16)' },
  zoneY: { position: 'absolute', width: 168, height: 168, borderRadius: 84, backgroundColor: 'rgba(255,210,63,0.24)' },
  zoneG: { position: 'absolute', width: 115, height: 115, borderRadius: 58, backgroundColor: 'rgba(123,227,107,0.3)' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderStyle: 'dashed', borderColor: '#ff2a2a' },
  cross: { position: 'absolute', backgroundColor: 'rgba(136,136,136,0.25)' },
  dot: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: 'rgba(0,0,0,0.25)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 4 } },
  deg: { fontFamily: F.display, fontSize: 56, lineHeight: 64 },
  degSub: { fontSize: 16, opacity: 0.6 },
  big: { fontFamily: F.display, fontSize: 64, lineHeight: 72 },
});
