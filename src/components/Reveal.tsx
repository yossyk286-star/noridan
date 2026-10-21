import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Vibration } from '../lib/vibe';
import { play } from '../lib/sound';
import { F, type Pal } from '../theme';
import { ModeCard, Note } from './ModeParts';

/** 1人ずつ出す間隔（秒）と最初の待ち */
export const RV_STEP = 0.55;
export const RV_START = 0.25;
export const rvTotal = (count: number) => RV_START + count * RV_STEP + 0.15;

/**
 * ため：hold('結果は…', 1800, () => 次の画面へ) で、その間「結果は…」とドラムロール。タップで飛ばせる。
 * 画面側は holding の間 view(pal) の card / controls を出す
 */
export function useHold() {
  const [h, setH] = useState<{ text: string; ms: number } | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const then = useRef<() => void>(() => {});
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  const done = () => {
    if (t.current) clearTimeout(t.current);
    t.current = null;
    const f = then.current;
    then.current = () => {};
    setH(null);
    f();
  };
  const hold = (text: string, ms: number, fn: () => void) => {
    if (t.current) clearTimeout(t.current);
    then.current = fn;
    setH({ text, ms });
    play('drumroll');
    t.current = setTimeout(done, ms);
  };
  const cancel = () => {
    if (t.current) clearTimeout(t.current);
    t.current = null;
    then.current = () => {};
    setH(null);
  };
  const view = (pal: Pal) =>
    h
      ? {
          card: (
            <Pressable style={{ flex: 1 }} onPress={done} accessibilityLabel="タップで飛ばす">
              <ModeCard pal={pal} center>
                <HoldText text={h.text} fg={pal.cardFg} />
                <HoldBar ms={h.ms} fg={pal.cardFg} />
                <Note fg={pal.cardFg}>タップで飛ばす</Note>
              </ModeCard>
            </Pressable>
          ),
          controls: <Text style={[s.hint, { color: pal.muted }]}>ドゥルルルル…</Text>,
        }
      : null;
  return { holding: !!h, hold, cancel, view };
}

function HoldText({ text, fg }: { text: string; fg: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, []);
  return <Animated.Text style={[s.holdT, { color: fg, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>{text}</Animated.Text>;
}
function HoldBar({ ms, fg }: { ms: number; fg: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: false }).start();
  }, []);
  return (
    <View style={[s.bar, { backgroundColor: 'rgba(136,136,136,0.25)' }]}>
      <Animated.View style={{ height: '100%', backgroundColor: fg, width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

/**
 * 1人ずつ出す演出（順位表）。start(count) で始めて、ready になったらボタンを出す。
 * skip() で全部すぐ出す（罰の人のドカンがまだやったらその場で鳴らす）
 */
export function useReveal() {
  const [run, setRun] = useState(0); // 始めるたびに増やす（行のアニメを作り直す）
  const [skipped, setSkipped] = useState(false);
  const [ready, setReady] = useState(true);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boomed = useRef(true);
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  const start = (count: number) => {
    if (t.current) clearTimeout(t.current);
    boomed.current = false;
    setSkipped(false);
    setReady(false);
    setRun((r) => r + 1);
    t.current = setTimeout(() => setReady(true), rvTotal(count) * 1000);
  };
  const boom = () => {
    if (boomed.current) return;
    boomed.current = true;
    play('boom');
    Vibration.vibrate([0, 120, 60, 200]);
  };
  const skip = () => {
    if (ready) return;
    if (t.current) clearTimeout(t.current);
    setSkipped(true);
    setReady(true);
    boom();
  };
  return { run, skipped, ready, start, skip, boom };
}

/** 順位表の1行。k 番目に出る。lose の行が出た瞬間にドカン＋赤く光る */
export function RevealItem({ k, rv, lose, children }: { k: number; rv: ReturnType<typeof useReveal>; lose?: boolean; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (rv.skipped) {
      v.setValue(1);
      return;
    }
    v.setValue(0);
    const delay = (RV_START + k * RV_STEP) * 1000;
    const a = Animated.timing(v, { toValue: 1, duration: 380, delay, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true });
    a.start();
    const tm = setTimeout(() => {
      if (lose) {
        rv.boom();
        Animated.sequence([
          Animated.timing(flash, { toValue: 1, duration: 200, useNativeDriver: false }),
          Animated.timing(flash, { toValue: 0.25, duration: 700, useNativeDriver: false }),
        ]).start();
      } else play('tick');
    }, delay);
    return () => { a.stop(); clearTimeout(tm); };
  }, [rv.run, rv.skipped]);
  return (
    <Animated.View
      style={{
        opacity: v,
        borderRadius: 8,
        backgroundColor: lose ? flash.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,59,59,0)', 'rgba(255,59,59,0.55)'] }) : 'transparent',
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  holdT: { fontFamily: F.display, fontSize: 52, lineHeight: 62, textAlign: 'center' },
  bar: { width: 220, height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: 14 },
});
