import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { onFx } from '../lib/fx';
import { C, F } from '../theme';
import { Confetti } from './Fx';

const GOLD = ['#ffd23f', '#ffe680', '#fff3b0', '#f5b700', '#ffffff'];

/** 画面の一番上に重ねる演出：罰の赤いフチ・ラッキーの金の紙吹雪・連続罰の炎・深夜のピンクのフチとハート */
export default function FxLayer({ deep }: { deep: boolean }) {
  const red = useRef(new Animated.Value(0)).current;
  const [goldN, setGoldN] = useState(0);
  const [stk, setStk] = useState<{ name: string; n: number; k: number } | null>(null);
  const [bb, setBb] = useState(0);
  useEffect(
    () =>
      onFx((e) => {
        if (e.kind === 'quake') {
          red.setValue(0);
          Animated.sequence([
            Animated.timing(red, { toValue: 1, duration: 100, useNativeDriver: true }),
            Animated.timing(red, { toValue: 0, duration: 750, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]).start();
        } else if (e.kind === 'gold') {
          setGoldN((x) => x + 1);
        } else if (e.kind === 'bigboom') setBb(Date.now());
        else setStk({ name: e.name, n: e.n, k: Date.now() });
      }),
    [],
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {deep && <DeepGlow />}
      <Animated.View style={[StyleSheet.absoluteFill, s.red, { opacity: red }]} />
      <Confetti trigger={goldN} colors={GOLD} />
      {stk && <Streak key={stk.k} name={stk.name} n={stk.n} onDone={() => setStk(null)} />}
      {bb > 0 && <BigBoomFx key={bb} onDone={() => setBb(0)} />}
    </View>
  );
}

function Streak({ name, n, onDone }: { name: string; n: number; onDone: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  const fl = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const f = Animated.loop(Animated.sequence([
      Animated.timing(fl, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(fl, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]));
    f.start();
    Animated.timing(v, { toValue: 1, duration: 1850, easing: Easing.linear, useNativeDriver: true }).start(() => onDone());
    return () => f.stop();
  }, []);
  const scale = v.interpolate({ inputRange: [0, 0.14, 0.22, 0.3, 0.8, 1], outputRange: [3, 0.92, 1.04, 1, 1, 1.15] });
  const opacity = v.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const flame = (w: number, h: number, left: number | string, key: number) => (
    <Animated.View key={key} style={[s.flame, { width: w, height: h, borderRadius: w / 2, left: left as number, transform: [{ scaleY: fl.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.08] }) }] }]}>
      <View style={[s.flameIn, { borderRadius: w / 2 }]} />
    </Animated.View>
  );
  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.center, { opacity }]}>
      <View style={s.dim} />
      <Animated.View style={[s.stkBox, { transform: [{ scale }] }]}>
        {flame(70, 110, -6, 0)}
        {flame(90, 140, 70, 1)}
        {flame(70, 110, 160, 2)}
        <Text style={s.stkName}>{name}</Text>
        <Text style={s.stkN}>{n}連続！</Text>
      </Animated.View>
    </Animated.View>
  );
}

// 爆弾パスの大爆発（白い光・ギザギザの火の玉・衝撃波・破片・煙）
const SPIKES = Array.from({ length: 22 }, (_, k) => {
  const r = k % 2 ? 30 : 50;
  const a = (k / 22) * Math.PI * 2;
  return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');
function BigBoomFx({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const v = useRef(new Animated.Value(0)).current;
  const bits = useRef(
    Array.from({ length: 26 }, (_, k) => {
      const a = (k / 26) * Math.PI * 2 + Math.random() * 0.3;
      const d = 140 + Math.random() * 220;
      return { x: Math.cos(a) * d, y: Math.sin(a) * d + 80, r: Math.random() * 900 - 450, s: 6 + Math.random() * 10, c: ['#2a1a10', '#ff7a1a', '#ffd23f', '#4a3a30'][k % 4] };
    }),
  ).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true }).start(() => onDone());
  }, []);
  const size = Math.max(width, height) * 1.2;
  const cx = width / 2;
  const cy = height * 0.45;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: v.interpolate({ inputRange: [0, 0.28], outputRange: [1, 0], extrapolate: 'clamp' }) }]} />
      <Animated.View
        style={{
          position: 'absolute', left: cx - size / 2, top: cy - size / 2, width: size, height: size,
          opacity: v.interpolate({ inputRange: [0, 0.2, 0.6], outputRange: [1, 1, 0], extrapolate: 'clamp' }),
          transform: [
            { scale: v.interpolate({ inputRange: [0, 0.6], outputRange: [0.05, 1.1], extrapolate: 'clamp' }) },
            { rotate: v.interpolate({ inputRange: [0, 0.6], outputRange: ['0deg', '25deg'], extrapolate: 'clamp' }) },
          ],
        }}
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Polygon points={SPIKES} fill="#ffd23f" stroke="#ff4a00" strokeWidth={5} strokeLinejoin="round" />
          <Polygon points={SPIKES} fill="#fff6c0" transform="translate(50 50) scale(.55) translate(-50 -50)" />
        </Svg>
      </Animated.View>
      {[0, 0.07].map((d, k) => (
        <Animated.View
          key={k}
          style={{
            position: 'absolute', left: cx - 30, top: cy - 30, width: 60, height: 60, borderRadius: 30, borderWidth: 8,
            borderColor: k ? 'rgba(255,120,30,0.7)' : 'rgba(255,240,200,0.9)',
            opacity: v.interpolate({ inputRange: [d, d + 0.45], outputRange: [1, 0], extrapolate: 'clamp' }),
            transform: [{ scale: v.interpolate({ inputRange: [d, d + 0.45], outputRange: [0.2, 14], extrapolate: 'clamp' }) }],
          }}
        />
      ))}
      {bits.map((b, k) => (
        <Animated.View
          key={k}
          style={{
            position: 'absolute', left: cx - b.s / 2, top: cy - b.s / 2, width: b.s, height: b.s * 0.7, borderRadius: 2, backgroundColor: b.c,
            opacity: v.interpolate({ inputRange: [0, 0.45, 0.6], outputRange: [1, 1, 0], extrapolate: 'clamp' }),
            transform: [
              { translateX: v.interpolate({ inputRange: [0, 0.6], outputRange: [0, b.x], extrapolate: 'clamp' }) },
              { translateY: v.interpolate({ inputRange: [0, 0.6], outputRange: [0, b.y], extrapolate: 'clamp' }) },
              { rotate: v.interpolate({ inputRange: [0, 0.6], outputRange: ['0deg', `${b.r}deg`], extrapolate: 'clamp' }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

const HEARTS = [
  { x: 0.06, d: 0, t: 7000, s: 18 },
  { x: 0.18, d: 2600, t: 8500, s: 12 },
  { x: 0.31, d: 5100, t: 7400, s: 15 },
  { x: 0.47, d: 1200, t: 9000, s: 11 },
  { x: 0.63, d: 3800, t: 7800, s: 17 },
  { x: 0.76, d: 600, t: 8200, s: 13 },
  { x: 0.88, d: 4400, t: 7200, s: 16 },
];
/** 深夜モード：フチがピンクにぼわっと光って、ハートがゆっくり昇る */
function DeepGlow() {
  const { width, height } = useWindowDimensions();
  const glow = useRef(new Animated.Value(0)).current;
  const vs = useRef(HEARTS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const g = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 2600, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 2600, useNativeDriver: true }),
    ]));
    g.start();
    const hs = vs.map((v, k) => Animated.loop(Animated.sequence([Animated.delay(HEARTS[k].d), Animated.timing(v, { toValue: 1, duration: HEARTS[k].t, easing: Easing.linear, useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true })])));
    hs.forEach((h) => h.start());
    return () => {
      g.stop();
      hs.forEach((h) => h.stop());
    };
  }, []);
  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, s.deepEdge, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }]} />
      {HEARTS.map((h, k) => (
        <Animated.View
          key={k}
          style={{
            position: 'absolute', left: h.x * width, top: height,
            opacity: vs[k].interpolate({ inputRange: [0, 0.1, 0.5, 1], outputRange: [0, 0.55, 0.4, 0] }),
            transform: [
              { translateY: vs[k].interpolate({ inputRange: [0, 1], outputRange: [0, -height - 40] }) },
              { translateX: vs[k].interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 14, -10] }) },
            ],
          }}
        >
          <Svg width={h.s} height={h.s} viewBox="0 0 24 24">
            <Path d="M12 21s-7.5-4.6-9.6-9.4A5.2 5.2 0 0 1 12 6.4a5.2 5.2 0 0 1 9.6 5.2C19.5 16.4 12 21 12 21z" fill={C.deep} />
          </Svg>
        </Animated.View>
      ))}
    </>
  );
}

const s = StyleSheet.create({
  red: { borderWidth: 6, borderColor: '#ff2a2a', backgroundColor: 'rgba(255,30,30,0.18)' },
  center: { alignItems: 'center', justifyContent: 'center' },
  dim: { position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: 'rgba(10,0,0,0.72)' },
  stkBox: { width: 230, paddingTop: 18, paddingBottom: 16, alignItems: 'center' },
  flame: { position: 'absolute', bottom: 4, backgroundColor: 'rgba(255,74,0,0.75)', overflow: 'hidden' },
  flameIn: { position: 'absolute', left: '20%', right: '20%', bottom: 0, height: '55%', backgroundColor: 'rgba(255,214,80,0.9)' },
  stkName: { color: '#fff', fontSize: 26, fontWeight: '900', textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 },
  stkN: { fontFamily: F.display, fontSize: 60, lineHeight: 70, color: '#ffe14a', textShadowColor: '#ff3a00', textShadowRadius: 16, transform: [{ rotate: '-6deg' }] },
  deepEdge: { borderWidth: 3, borderColor: 'rgba(255,79,168,0.7)', shadowColor: C.deep, shadowOpacity: 1, shadowRadius: 24 },
});
