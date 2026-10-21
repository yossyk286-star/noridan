import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { onFx } from '../lib/fx';
import { C, F } from '../theme';
import { Confetti } from './Fx';

const GOLD = ['#ffd23f', '#ffe680', '#fff3b0', '#f5b700', '#ffffff'];

/** 画面の一番上に重ねる演出：罰の赤いフチ・ラッキーの光と金の紙吹雪・連続罰の炎・深夜のピンクのフチとハート */
export default function FxLayer({ deep }: { deep: boolean }) {
  const red = useRef(new Animated.Value(0)).current;
  const gold = useRef(new Animated.Value(0)).current;
  const [goldN, setGoldN] = useState(0);
  const [stk, setStk] = useState<{ name: string; n: number; k: number } | null>(null);
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
          gold.setValue(0);
          Animated.timing(gold, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
          setGoldN((x) => x + 1);
        } else setStk({ name: e.name, n: e.n, k: Date.now() });
      }),
    [],
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {deep && <DeepGlow />}
      <Animated.View style={[StyleSheet.absoluteFill, s.red, { opacity: red }]} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          s.goldWrap,
          { opacity: gold.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 0] }), transform: [{ scale: gold.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] }) }] },
        ]}
      >
        <View style={s.goldCore} />
      </Animated.View>
      <Confetti trigger={goldN} colors={GOLD} />
      {stk && <Streak key={stk.k} name={stk.name} n={stk.n} onDone={() => setStk(null)} />}
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
  goldWrap: { alignItems: 'center', justifyContent: 'center' },
  goldCore: { width: 420, height: 420, borderRadius: 210, backgroundColor: 'rgba(255,226,110,0.55)', shadowColor: '#ffd23f', shadowOpacity: 1, shadowRadius: 80 },
  center: { alignItems: 'center', justifyContent: 'center' },
  dim: { position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: 'rgba(10,0,0,0.72)' },
  stkBox: { width: 230, paddingTop: 18, paddingBottom: 16, alignItems: 'center' },
  flame: { position: 'absolute', bottom: 4, backgroundColor: 'rgba(255,74,0,0.75)', overflow: 'hidden' },
  flameIn: { position: 'absolute', left: '20%', right: '20%', bottom: 0, height: '55%', backgroundColor: 'rgba(255,214,80,0.9)' },
  stkName: { color: '#fff', fontSize: 26, fontWeight: '900', textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 },
  stkN: { fontFamily: F.display, fontSize: 60, lineHeight: 70, color: '#ffe14a', textShadowColor: '#ff3a00', textShadowRadius: 16, transform: [{ rotate: '-6deg' }] },
  deepEdge: { borderWidth: 3, borderColor: 'rgba(255,79,168,0.7)', shadowColor: C.deep, shadowOpacity: 1, shadowRadius: 24 },
});
