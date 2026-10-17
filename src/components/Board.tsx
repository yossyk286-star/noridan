import { useEffect, useRef, useState } from 'react';
import { Tap } from './Tap';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { BOARD, GOAL } from '../lib/game';
import { F, STAGE, alpha, colorOf } from '../theme';
import type { Cell, Level, Member } from '../types';

type Pal = (typeof STAGE)[Level];

export const COLS = 6;
export const ROWS = Math.ceil(BOARD.length / COLS);

/** ヘビ型：偶数行は左→右、奇数行は右→左 */
const cellXY = (i: number) => {
  const r = Math.floor(i / COLS);
  const c = r % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
  return { r, c };
};

function cellFace(c: Cell, pal: Pal): { bg: string; fg: string; label: string; small?: boolean; stripe?: boolean } {
  switch (c.type) {
    case 'start':
      return { bg: '#141210', fg: '#f7f3ea', label: 'START', small: true };
    case 'goal':
      return { bg: '#ffd23f', fg: '#141210', label: 'GOAL', small: true };
    case 'odai':
      return { bg: pal.cardBg, fg: alpha(pal.cardFg.slice(0, 7), 0.55), label: 'お題', small: true };
    case 'move':
      return c.value > 0 ? { bg: '#3fd16b', fg: '#062a12', label: `+${c.value}` } : { bg: '#ff5a4f', fg: '#ffffff', label: `−${-c.value}` };
    case 'skip':
      return { bg: '#7b8db8', fg: '#ffffff', label: '休' };
    case 'swap':
      return { bg: '#b69cff', fg: '#1c1328', label: '⇄' };
    case 'event':
      return { bg: '#ffd23f', fg: '#141210', label: '！', stripe: true };
    default:
      return { bg: '#ff9a3c', fg: '#2a1200', label: c.label, small: true };
  }
}

/** すごろく盤。道でつながったマスと、ピョンピョン動くコマ */
export type Callout = { text: string; at: number; kind: 'plus' | 'minus' | 'swap'; key: number } | null;

export function Board({ pal, members, vpos, cur, callout }: { pal: Pal; members: Member[]; vpos: number[]; cur: number; callout?: Callout }) {
  const [w, setW] = useState(0);
  const cell = w / COLS;
  const center = (i: number) => {
    const { r, c } = cellXY(i);
    return { x: (c + 0.5) * cell, y: (r + 0.5) * cell };
  };

  return (
    <View style={{ width: '100%', height: w ? cell * ROWS : undefined, aspectRatio: w ? undefined : COLS / ROWS }} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityLabel="すごろく盤">
      {w > 0 && (
        <>
          {/* 道 */}
          {BOARD.slice(0, -1).map((_, i) => {
            const a = center(i);
            const b = center(i + 1);
            const horiz = a.y === b.y;
            return (
              <View
                key={`p${i}`}
                style={[
                  s.path,
                  { backgroundColor: alpha(pal.fg.slice(0, 7), 0.28) },
                  horiz
                    ? { left: Math.min(a.x, b.x), top: a.y - 7, width: Math.abs(a.x - b.x), height: 14 }
                    : { left: a.x - 7, top: Math.min(a.y, b.y), width: 14, height: Math.abs(a.y - b.y) },
                ]}
              />
            );
          })}
          {/* マス */}
          {BOARD.map((c, i) => {
            const { r, c: col } = cellXY(i);
            const f = cellFace(c, pal);
            return (
              <View key={i} style={[s.cell, { left: col * cell, top: r * cell, width: cell, height: cell }]}>
                <View style={[s.cellIn, { backgroundColor: f.bg }, f.stripe && { borderWidth: 4, borderColor: '#141210', borderStyle: 'dashed' }]}>
                  {c.type !== 'start' && c.type !== 'goal' && <Text style={[s.no, { color: f.fg }]}>{i}</Text>}
                  <Text style={[f.small ? s.labelSmall : s.label, { color: f.fg }]} numberOfLines={2} adjustsFontSizeToFit>
                    {f.label}
                  </Text>
                </View>
              </View>
            );
          })}
          {/* コマ */}
          {members.map((m, i) => {
            const same = vpos.map((q, k) => (q === vpos[i] ? k : -1)).filter((k) => k >= 0);
            const k = same.indexOf(i);
            const off = same.length === 1 ? { x: 0, y: 0 } : { x: ((k % 2) - 0.5) * 18, y: (Math.floor(k / 2) - (same.length > 2 ? 0.5 : 0)) * 18 };
            const c = center(vpos[i]);
            return <Token key={i} name={m.name} color={colorOf(i)} x={c.x + off.x} y={c.y + off.y} active={i === cur} />;
          })}
          {callout && <Bubble key={callout.key} text={callout.text} kind={callout.kind} x={center(callout.at).x} y={center(callout.at).y} width={w} />}
        </>
      )}
    </View>
  );
}

const BUBBLE = { plus: { bg: '#3fd16b', fg: '#062a12' }, minus: { bg: '#ff5a4f', fg: '#ffffff' }, swap: { bg: '#b69cff', fg: '#1c1328' } };

/** 止まったマスの上の吹き出し（−3マス戻る…など）。ポンッと出て、ふわっと消える */
function Bubble({ text, kind, x, y, width }: { text: string; kind: 'plus' | 'minus' | 'swap'; x: number; y: number; width: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const [bw, setBw] = useState(0);
  useEffect(() => {
    Animated.sequence([
      Animated.spring(v, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(v, { toValue: 2, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);
  const scale = v.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0.9] });
  const opacity = v.interpolate({ inputRange: [0, 0.2, 1, 2], outputRange: [0, 1, 1, 0] });
  const lift = v.interpolate({ inputRange: [0, 1, 2], outputRange: [10, 0, -12] });
  // 盤の外にはみ出さんように左右を寄せる
  const left = Math.max(4, Math.min(width - bw - 4, x - bw / 2));
  const c = BUBBLE[kind];
  return (
    <Animated.View
      pointerEvents="none"
      onLayout={(e) => setBw(e.nativeEvent.layout.width)}
      style={[s.bubble, { backgroundColor: c.bg, left, top: y - 70, opacity, transform: [{ translateY: lift }, { scale }] }]}
    >
      <Text style={[s.bubbleText, { color: c.fg }]}>{text}</Text>
    </Animated.View>
  );
}

function Token({ name, color, x, y, active }: { name: string; color: string; x: number; y: number; active: boolean }) {
  const pos = useRef(new Animated.ValueXY({ x, y })).current;
  const jump = useRef(new Animated.Value(0)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      pos.setValue({ x, y });
      return;
    }
    Animated.parallel([
      Animated.timing(pos, { toValue: { x, y }, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.sequence([
        Animated.timing(jump, { toValue: 1, duration: 120, useNativeDriver: false }),
        Animated.timing(jump, { toValue: 0, duration: 120, useNativeDriver: false }),
      ]),
    ]).start();
  }, [x, y]);
  const size = active ? 32 : 26;
  const lift = jump.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.token,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          zIndex: active ? 3 : 2,
          borderWidth: active ? 3 : 2.5,
          left: pos.x,
          top: Animated.add(pos.y, lift),
        },
        active && { shadowColor: color, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
      ]}
    >
      <Text style={[s.tokText, { fontSize: active ? 15 : 13 }]}>{name.slice(0, 1)}</Text>
    </Animated.View>
  );
}

/** みんなの進み具合 */
export function Ranks({ pal, members, vpos, skip, cur }: { pal: Pal; members: Member[]; vpos: number[]; skip: boolean[]; cur: number }) {
  const order = members.map((m, i) => ({ m, i, p: vpos[i] })).sort((a, b) => b.p - a.p);
  // 人数が多い時は2列にして高さを抑える（1画面に収めるため）
  const two = members.length > 6;
  return (
    <View style={two ? { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 } : { gap: 4 }}>
      {order.map((o) => (
        <View key={o.i} style={[s.rank, two && { width: '47%' }]}>
          <Text style={[s.rankName, { color: pal.fg }, o.i === cur && { fontSize: 13 }]} numberOfLines={1}>
            {o.m.name}
            {skip[o.i] ? '（休）' : ''}
          </Text>
          <View style={[s.rankBar, { backgroundColor: pal.chip }]}>
            <View style={[s.rankFill, { width: `${(o.p / GOAL) * 100}%`, backgroundColor: colorOf(o.i) }]} />
          </View>
          <Text style={[s.rankPos, { color: pal.fg }]}>{o.p === GOAL ? 'GOAL' : o.p}</Text>
        </View>
      ))}
    </View>
  );
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

/** 点の目のサイコロ。タップで振る。振ってる間は転がる */
export function Die({ value, rolling, disabled, onPress }: { value: number | null; rolling: boolean; disabled: boolean; onPress: () => void }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!rolling) {
      spin.setValue(0);
      return;
    }
    const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 300, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [rolling]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const lift = spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -10, 0] });
  return (
    <Tap onPress={onPress} disabled={disabled} accessibilityLabel="サイコロを振る">
      {({ pressed }) => (
        <Animated.View style={[s.die, { transform: [{ rotate }, { translateY: pressed ? 5 : lift }] }]}>
          {value ? (
            <View style={s.pips}>
              {Array.from({ length: 9 }).map((_, k) => (
                <View key={k} style={s.pipBox}>
                  {PIPS[value].includes(k) && <View style={[s.pip, value === 1 && { backgroundColor: '#e8202a', width: 18, height: 18, borderRadius: 9 }]} />}
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.dieQ}>?</Text>
          )}
        </Animated.View>
      )}
    </Tap>
  );
}

const s = StyleSheet.create({
  path: { position: 'absolute', borderRadius: 7 },
  cell: { position: 'absolute', padding: 4 },
  cellIn: {
    flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 0, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  no: { position: 'absolute', left: 5, top: 3, fontSize: 9, fontWeight: '900', opacity: 0.5 },
  label: { fontFamily: F.display, fontSize: 17, textAlign: 'center' },
  labelSmall: { fontSize: 11, fontWeight: '900', textAlign: 'center' },
  bubble: {
    position: 'absolute', zIndex: 5, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, borderWidth: 3, borderColor: '#141210',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  bubbleText: { fontFamily: F.display, fontSize: 20 },
  token: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderColor: '#141210' },
  tokText: { color: '#141210', fontWeight: '900' },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankName: { width: 72, fontSize: 12, fontWeight: '900' },
  rankBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  rankFill: { height: '100%', borderRadius: 4 },
  rankPos: { width: 40, textAlign: 'right', fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  die: {
    width: 84, height: 84, borderRadius: 18, backgroundColor: '#fff', padding: 12, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 0, shadowOffset: { width: 0, height: 7 }, elevation: 5,
  },
  pips: { width: '100%', height: '100%', flexDirection: 'row', flexWrap: 'wrap' },
  pipBox: { width: '33.33%', height: '33.33%', alignItems: 'center', justifyContent: 'center' },
  pip: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#141210' },
  dieQ: { fontFamily: F.display, fontSize: 40, color: '#141210' },
});
