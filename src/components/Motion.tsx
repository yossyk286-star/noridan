import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { AccessibilityInfo, Animated, Easing, PanResponder, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { C, F } from '../theme';

/**
 * 第6弾：アプリ全体の動き（33 広がる札 / 34 スイッチ / 35 起動 / 37 シートを下に引っ張る / 39 数え上げ）
 * 「動きを減らす」設定の人には出さへん
 */
let calm = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => { calm = v; }).catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => { calm = v; });
export const isCalm = () => calm;

// ---------- 34 本物のスイッチ（つまみが0.15秒で滑る） ----------
export function Switch({ on, color }: { on: boolean; color?: string }) {
  const v = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: on ? 1 : 0, duration: calm ? 0 : 150, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start();
  }, [on]);
  return (
    <View style={[sw.track, on && sw.trackOn, on && color ? { backgroundColor: color } : null]}>
      <Animated.View style={[sw.knob, on && { backgroundColor: C.ink }, { transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] }]} />
    </View>
  );
}
const sw = StyleSheet.create({
  track: { width: 50, height: 30, borderRadius: 15, backgroundColor: 'rgba(247,243,234,0.16)', padding: 3 },
  trackOn: { backgroundColor: C.yuru },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#b8b0a2' },
});

// ---------- 37 下に引っ張って閉じるシート ----------
// 上の持ち手を下に引っ張る。80px以上か勢いがあれば閉じて、足りんかったらバネで戻る
export function SwipeSheet({ onClose, style, children }: { onClose: () => void; style: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const y = useRef(new Animated.Value(0)).current;
  const close = useRef(onClose);
  close.current = onClose;
  const back = () => Animated.spring(y, { toValue: 0, friction: 7, tension: 140, useNativeDriver: true }).start();
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || (g.vy > 0.8 && g.dy > 20)) Animated.timing(y, { toValue: 700, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => { y.setValue(0); close.current(); });
        else back();
      },
      onPanResponderTerminate: back,
    }),
  ).current;
  return (
    <Animated.View style={[style, { transform: [{ translateY: y }] }]} onStartShouldSetResponder={() => true}>
      <View {...pan.panHandlers} style={sh.hit} accessibilityLabel="下に引っ張ると閉じる">
        <View style={sh.grip} />
      </View>
      {children}
    </Animated.View>
  );
}
const sh = StyleSheet.create({
  hit: { alignSelf: 'stretch', alignItems: 'center', paddingTop: 2, paddingBottom: 14, marginTop: -10 },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(247,243,234,0.25)', marginTop: 10 },
});

// ---------- 35 起動：ポンと出る ----------
let booted = false;
/** 開いて最初のホームだけ true を返す（同じ起動で2回目からは false） */
export function useBootOnce() {
  const first = useRef(!booted && !calm);
  useEffect(() => { booted = true; }, []);
  return first.current;
}
export function Pop({ on, delay = 0, children, style }: { on: boolean; delay?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(on ? 0 : 1)).current;
  useEffect(() => {
    if (!on) return;
    Animated.timing(v, { toValue: 1, duration: 300, delay, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// ---------- 39 数え上げ ----------
export function CountUp({ to, go = true, delay = 0, style }: { to: number; go?: boolean; delay?: number; style?: StyleProp<TextStyle> }) {
  const [n, setN] = useState(calm || to <= 0 || to > 99 ? to : 0);
  useEffect(() => {
    if (!go || calm || to <= 0 || to > 99) { setN(to); return; }
    const dur = Math.min(900, 220 + to * 90);
    let raf = 0;
    const t0 = Date.now() + delay;
    const tick = () => {
      const r = Math.min(1, Math.max(0, (Date.now() - t0) / dur));
      setN(Math.round(to * (1 - Math.pow(1 - r, 3))));
      if (r < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [go, to]);
  return <Text style={style}>{n}</Text>;
}

// ---------- 33 押した札が広がって画面になる ----------
export type Rect = { x: number; y: number; width: number; height: number };
type Job = { rect: Rect; bg: string; back: boolean; id: number };
let listener: ((j: Job) => void) | null = null;
let seq = 0;
const last: { rect?: Rect; bg?: string } = {};
/** 押した行の位置を覚えて広がらせる（戻る時は同じ位置へ縮む） */
export function expandFrom(rect: Rect, bg: string) {
  last.rect = rect; last.bg = bg;
  if (!calm) listener?.({ rect, bg, back: false, id: ++seq });
}
export function shrinkBack() {
  if (calm || !last.rect) return;
  listener?.({ rect: last.rect, bg: last.bg ?? C.yuru, back: true, id: ++seq });
}
export function ExpandLayer() {
  const { width, height } = useWindowDimensions();
  const [job, setJob] = useState<Job | null>(null);
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => { listener = setJob; return () => { listener = null; }; }, []);
  useEffect(() => {
    if (!job) return;
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 380, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }).start(() => setJob(null));
  }, [job?.id]);
  if (!job) return null;
  const r = job.rect;
  const a = job.back ? { x: 0, y: 0, width, height } : r;
  const b = job.back ? r : { x: 0, y: 0, width, height };
  const lerp = (p: number, q: number) => t.interpolate({ inputRange: [0, 1], outputRange: [p, q] });
  // 広がる時は前半で広がって後半で消える。戻る時は最初に出て、縮みながら消える
  const opacity = job.back ? t.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 0] }) : t.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 1, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', zIndex: 50, backgroundColor: job.bg, opacity, left: lerp(a.x, b.x), top: lerp(a.y, b.y), width: lerp(a.width, b.width), height: lerp(a.height, b.height), borderRadius: job.back ? lerp(0, 14) : lerp(14, 0) }}
    />
  );
}

// ---------- 39 +1 ----------
export function Plus1({ v }: { v: Animated.Value }) {
  return (
    <Animated.Text
      pointerEvents="none"
      style={{ position: 'absolute', top: -15, alignSelf: 'center', fontFamily: F.display, fontSize: 16, color: C.blood, opacity: v.interpolate({ inputRange: [0, 0.2, 0.75, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, -12] }) }, { scale: v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.5, 1.25, 1] }) }] }}
    >
      +1
    </Animated.Text>
  );
}
