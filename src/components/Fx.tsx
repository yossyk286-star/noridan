import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Ellipse, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { F } from '../theme';

const loop = (v: Animated.Value, duration: number, to = 1) =>
  Animated.loop(Animated.timing(v, { toValue: to, duration, easing: Easing.linear, useNativeDriver: true }));

/** 時限爆弾のイラスト（火花がチリチリする） */
export function BombArt() {
  const spark = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(spark, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(spark, { toValue: 0, duration: 90, useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, []);
  const scale = spark.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] });
  return (
    <View style={fx.bombBox} accessibilityElementsHidden>
      <View style={fx.bombBody}>
        <View style={fx.bombShine} />
      </View>
      <View style={fx.bombCap} />
      <View style={fx.bombFuse} />
      <Animated.View style={[fx.spark, { transform: [{ scale }] }]} />
    </View>
  );
}

/** ダブルアップのコイン（ずっと回ってる） */
export function Coin() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = loop(v, 1100);
    a.start();
    return () => a.stop();
  }, []);
  const rotateY = v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={[fx.coin, { transform: [{ perspective: 600 }, { rotateY }] }]}>
        <Text style={fx.coinText}>倍</Text>
      </Animated.View>
    </View>
  );
}

/** 時限爆弾バナーの導火線（燃えてる感じに流れる） */
export function Fuse({ color }: { color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = loop(v, 1200);
    a.start();
    return () => a.stop();
  }, []);
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] });
  return (
    <View style={fx.fuse}>
      <Animated.View style={[fx.fuseRow, { transform: [{ translateX }] }]}>
        {Array.from({ length: 7 }).map((_, i) => (
          <View key={i} style={[fx.fuseDash, { backgroundColor: color }]} />
        ))}
      </Animated.View>
    </View>
  );
}

/** 罰ガチャのカプセル。上から落ちてきて、上半分がパカッと開く */
/** 罰ガチャのカプセル。落ちてきて開いたら、中身（罰／天使）のマークに変わる */
export function Capsule({ color, delay, result }: { color: string; delay: number; result?: 'ng' | 'ok' }) {
  const drop = useRef(new Animated.Value(0)).current;
  const open = useRef(new Animated.Value(0)).current;
  const badge = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(drop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      Animated.timing(open, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ...(result ? [Animated.spring(badge, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true })] : []),
    ]).start();
  }, []);
  const parts = badge.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' });
  const badgeScale = badge.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const translateY = drop.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] });
  const rotate = drop.interpolate({ inputRange: [0, 1], outputRange: ['-200deg', '0deg'] });
  const topRotate = open.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-70deg'] });
  const topY = open.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  return (
    <Animated.View style={[fx.capsule, { opacity: drop, transform: [{ translateY }, { rotate }] }]}>
      <Animated.View style={[fx.capBot, { opacity: parts }]} />
      <Animated.View style={[fx.capTop, { backgroundColor: color, opacity: parts, transform: [{ translateX: -20 }, { translateY: topY }, { rotate: topRotate }, { translateX: 20 }] }]} />
      {result && (
        <Animated.View style={[fx.capBadge, { borderColor: color, backgroundColor: result === 'ok' ? '#ffd23f' : '#e8202a', opacity: badge, transform: [{ scale: badgeScale }] }]}>
          <Text style={[fx.capBadgeText, { color: result === 'ok' ? '#141210' : '#ffffff' }]}>{result === 'ok' ? '天' : '罰'}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** 爆発の時に画面全体が光る */
export function Flash({ trigger }: { trigger: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!trigger) return;
    v.setValue(0);
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 110, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [trigger]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1.4, 1] });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fx.flash, { opacity: v, transform: [{ scale }] }]}>
      <View style={fx.flashCore} />
    </Animated.View>
  );
}

/** 罰ガチャのドクロ。ドンッと出てきて、ゆらゆら揺れて、目が赤く光る */
export function Skull() {
  const pop = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start();
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const g = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    );
    b.start();
    g.start();
    return () => {
      b.stop();
      g.stop();
    };
  }, []);
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const spin = pop.interpolate({ inputRange: [0, 1], outputRange: ['-40deg', '0deg'] });
  const rock = bob.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] });
  return (
    <Animated.View style={[fx.skull, { transform: [{ scale }, { rotate: spin }, { rotate: rock }] }]} accessibilityElementsHidden>
      <View style={fx.skullHead} />
      <View style={fx.skullJaw} />
      <Animated.View style={[fx.eye, { left: 18 }]}>
        <Animated.View style={[fx.eyeGlow, { opacity: glow }]} />
      </Animated.View>
      <Animated.View style={[fx.eye, { right: 18 }]}>
        <Animated.View style={[fx.eyeGlow, { opacity: glow }]} />
      </Animated.View>
      <View style={fx.nose} />
      {[40, 50, 60].map((x) => (
        <View key={x} style={[fx.tooth, { left: x - 1.5 }]} />
      ))}
    </Animated.View>
  );
}

/** ラッキーの天使。ふわふわ浮いて、輪っかが光る */
export function Angel() {
  const pop = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start();
    const f = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    f.start();
    return () => f.stop();
  }, []);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const haloScale = float.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  return (
    <Animated.View style={[fx.angel, { transform: [{ scale: pop }, { translateY }] }]} accessibilityElementsHidden>
      <View style={[fx.wing, { left: 4, transform: [{ rotate: '-20deg' }] }]} />
      <View style={[fx.wing, { right: 4, transform: [{ rotate: '20deg' }] }]} />
      <Animated.View style={[fx.halo, { transform: [{ scaleX: haloScale }] }]} />
      <View style={fx.face}>
        <View style={fx.eyes}>
          <View style={fx.happyEye} />
          <View style={fx.happyEye} />
        </View>
        <View style={fx.smile} />
      </View>
    </Animated.View>
  );
}

/** 罰ガチャのマシンが回る時間（このあと結果が出る） */
export const GACHA_MS = 1000;

/** ドームの中のカプセル：ドクロ顔と天使顔 */
function MiniFace({ x, y, angel }: { x: number; y: number; angel?: boolean }) {
  if (angel) {
    return (
      <>
        <Ellipse cx={x} cy={y - 12} rx={6} ry={2} fill="none" stroke="#ffd23f" strokeWidth={2} />
        <Circle cx={x} cy={y} r={10} fill="#fff3d6" stroke="#141210" strokeWidth={2} />
        <Path d={`M${x - 6} ${y - 1}q2.5-3 5 0M${x + 1} ${y - 1}q2.5-3 5 0`} fill="none" stroke="#141210" strokeWidth={1.6} strokeLinecap="round" />
      </>
    );
  }
  return (
    <>
      <Circle cx={x} cy={y} r={10} fill="#f7f3ea" stroke="#141210" strokeWidth={2} />
      <Circle cx={x - 3.6} cy={y - 1} r={2.8} fill="#e8202a" />
      <Circle cx={x + 3.6} cy={y - 1} r={2.8} fill="#e8202a" />
      <Path d={`M${x - 3} ${y + 5}h6`} stroke="#141210" strokeWidth={1.6} strokeLinecap="round" />
    </>
  );
}

/** 罰ガチャのマシン（約1秒）：ガタガタ回って、ドクロか天使のカプセルが出てきて真ん中でパカッと割れる */
export function GachaMachine({ color = '#141210', lucky }: { color?: string; lucky?: boolean }) {
  const shake = useRef(new Animated.Value(0)).current;
  const handle = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current; // マシンが消える
  const cap = useRef(new Animated.Value(0)).current; // カプセルが出て真ん中へ
  const crack = useRef(new Animated.Value(0)).current; // 割れる
  const out = useRef(new Animated.Value(0)).current; // 全体が消える
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
    const sh = Animated.loop(Animated.timing(shake, { toValue: 1, duration: 140, easing: Easing.linear, useNativeDriver: true }), { iterations: 4 });
    sh.start();
    Animated.timing(handle, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
    Animated.sequence([Animated.delay(500), Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true })]).start();
    // カプセルはマシンの下の取り出し口から出てきて、ポトッと落ちてから真ん中へ
    Animated.sequence([Animated.delay(380), Animated.timing(cap, { toValue: 1, duration: 380, easing: Easing.linear, useNativeDriver: true })]).start();
    Animated.sequence([Animated.delay(760), Animated.timing(crack, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true })]).start();
    Animated.sequence([Animated.delay(930), Animated.timing(out, { toValue: 1, duration: 180, useNativeDriver: true })]).start();
    return () => sh.stop();
  }, []);
  const rock = shake.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: ['0deg', '-3deg', '3deg', '0deg'] });
  const spin = handle.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const balls: [number, number, boolean][] = [[44, 40, false], [70, 36, false], [56, 58, true], [36, 62, false], [80, 60, false], [60, 24, false], [46, 78, true], [74, 78, false]];
  const half = (top: boolean) => ({
    opacity: crack.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [
      { translateX: crack.interpolate({ inputRange: [0, 1], outputRange: [0, top ? -34 : 30] }) },
      { translateY: crack.interpolate({ inputRange: [0, 1], outputRange: [0, top ? -46 : 46] }) },
      { rotate: crack.interpolate({ inputRange: [0, 1], outputRange: ['0deg', top ? '-50deg' : '40deg'] }) },
    ],
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fx.machine, { opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
      <Animated.View style={{ position: 'absolute', width: 180, height: 240, opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: pop }, { rotate: rock }] }}>
        <Svg width={180} height={240} viewBox="0 0 120 160">
          <Circle cx={60} cy={56} r={46} fill="rgba(255,255,255,0.16)" stroke={color} strokeWidth={4} />
          {balls.map(([x, y, a], k) => (
            <MiniFace key={k} x={x} y={y} angel={a} />
          ))}
          <Path d="M30 34a34 34 0 0 1 22-14" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={0.55} />
          <Path d="M24 98h72l6 52H18z" fill="#e8202a" stroke="#141210" strokeWidth={4} strokeLinejoin="round" />
          <Rect x={50} y={134} width={20} height={12} rx={3} fill="#141210" />
        </Svg>
        <Animated.View style={[fx.handle, { transform: [{ rotate: spin }] }]}>
          <Svg width={36} height={43} viewBox="0 0 30 36">
            <Circle cx={15} cy={18} r={11} fill="#f7f3ea" stroke="#141210" strokeWidth={4} />
            <Rect x={12} y={6} width={6} height={24} rx={3} fill="#141210" />
          </Svg>
        </Animated.View>
      </Animated.View>
      {/* 出てきたカプセル */}
      <Animated.View style={{ width: 84, height: 84, opacity: cap.interpolate({ inputRange: [0, 0.02, 1], outputRange: [0, 1, 1] }), transform: [{ translateY: cap.interpolate({ inputRange: [0, 0.3, 0.85, 1], outputRange: [90, 112, -6, 0] }) }, { scale: cap.interpolate({ inputRange: [0, 0.3, 0.85, 1], outputRange: [0.26, 0.36, 1.32, 1.25] }) }, { rotate: cap.interpolate({ inputRange: [0, 0.3, 1], outputRange: ['-90deg', '-60deg', '0deg'] }) }] }}>
        <Animated.View style={[fx.capFace, { opacity: crack, transform: [{ scale: crack.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.4, 1.35, 1.1] }) }] }]}>
          <Svg width={72} height={72} viewBox="0 0 100 100">
            {lucky ? (
              <>
                <Ellipse cx={50} cy={14} rx={20} ry={6} fill="none" stroke="#ffd23f" strokeWidth={5} />
                <Circle cx={50} cy={56} r={30} fill="#fff3d6" stroke="#141210" strokeWidth={4} />
                <Path d="M34 52q6-7 12 0M54 52q6-7 12 0M42 68q8 7 16 0" fill="none" stroke="#141210" strokeWidth={4} strokeLinecap="round" />
              </>
            ) : (
              <>
                <Path d="M50 10C28 10 16 25 16 44c0 12 7 20 15 24v10c0 3 3 6 6 6h26c3 0 6-3 6-6V68c8-4 15-12 15-24C84 25 72 10 50 10z" fill="#f7f3ea" stroke="#141210" strokeWidth={4} />
                <Ellipse cx={36} cy={46} rx={9} ry={10} fill="#e8202a" />
                <Ellipse cx={64} cy={46} rx={9} ry={10} fill="#e8202a" />
                <Path d="M50 56l-5 8h10z" fill="#141210" />
              </>
            )}
          </Svg>
        </Animated.View>
        <Animated.View style={[fx.capHalf, fx.capT, { backgroundColor: lucky ? '#ffd23f' : '#e8202a' }, half(true)]} />
        <Animated.View style={[fx.capHalf, fx.capB, half(false)]} />
      </Animated.View>
      {/* パカッと割れた時の光 */}
      <Animated.View style={[fx.burst, { backgroundColor: lucky ? 'rgba(255,224,120,0.8)' : 'rgba(255,255,255,0.8)', opacity: crack.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] }), transform: [{ scale: crack.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.4] }) }] }]} />
    </Animated.View>
  );
}

/** 罰2倍のバッジ（ギザギザの爆発マーク「×2」）。ドンと出て、ゆっくり揺れる */
export function X2Burst({ size = 74 }: { size?: number }) {
  const pop = useRef(new Animated.Value(0)).current;
  const wob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([Animated.delay(750), Animated.spring(pop, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true })]).start();
    const a = Animated.loop(Animated.sequence([
      Animated.timing(wob, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(wob, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, []);
  const pts = (r1: number, r2: number) => Array.from({ length: 28 }, (_, k) => { const r = k % 2 ? r1 : r2, a = (k / 28) * Math.PI * 2 - Math.PI / 2; return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
  return (
    <Animated.View style={{ transform: [{ scale: pop }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-120deg', '0deg'] }) }, { rotate: wob.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '12deg'] }) }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Polygon points={pts(34, 48)} fill="#ff2a2a" stroke="#141210" strokeWidth={3} strokeLinejoin="round" />
        <Polygon points={pts(26.5, 37.5)} fill="none" stroke="#ffd23f" strokeWidth={2} strokeLinejoin="round" />
        <SvgText x="50" y="62" textAnchor="middle" fontFamily={F.display} fontSize="34" fill="#ffd23f" stroke="#141210" strokeWidth={1.5}>×2</SvgText>
      </Svg>
    </Animated.View>
  );
}

/** 罰2倍のドクロ：1体目の後ろから2体目がスッと出てきて、×2のバッジがドン */
export function TwinSkulls() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([Animated.delay(450), Animated.spring(v, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true })]).start();
  }, []);
  return (
    <View style={{ width: 170, height: 112 }}>
      <View style={{ position: 'absolute', left: 0, top: 4, zIndex: 1 }}><Skull /></View>
      <Animated.View style={{ position: 'absolute', left: 58, top: 4, opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-58, 0] }) }] }}><Skull /></Animated.View>
      <View style={{ position: 'absolute', right: -26, top: -18, zIndex: 2 }}><X2Burst /></View>
    </View>
  );
}

/** 罰が一番多い人の王冠 */
/** ワニワニのモグラ（穴から上半身だけ出てる） */
export function Mole() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Path d="M16 100V50a34 34 0 0 1 68 0v50z" fill="#8a5a3b" stroke="#141210" strokeWidth={4} />
      <Ellipse cx={50} cy={66} rx={25} ry={21} fill="#d9ab84" />
      <Circle cx={37} cy={45} r={4.5} fill="#141210" />
      <Circle cx={63} cy={45} r={4.5} fill="#141210" />
      <Circle cx={38.5} cy={43.5} r={1.4} fill="#fff" />
      <Circle cx={64.5} cy={43.5} r={1.4} fill="#fff" />
      <Path d="M28 60h-14M28 65l-13 4M72 60h14M72 65l13 4" stroke="#141210" strokeWidth={2} strokeLinecap="round" />
      <Rect x={45} y={66} width={10} height={9} rx={1.5} fill="#fff" stroke="#141210" strokeWidth={2} />
      <Path d="M50 66v9" stroke="#141210" strokeWidth={1.6} />
      <Ellipse cx={50} cy={59} rx={9} ry={6.5} fill="#ff7aa2" stroke="#141210" strokeWidth={2.5} />
      <Ellipse cx={26} cy={90} rx={10} ry={7} fill="#f0b896" stroke="#141210" strokeWidth={2.5} />
      <Ellipse cx={74} cy={90} rx={10} ry={7} fill="#f0b896" stroke="#141210" strokeWidth={2.5} />
    </Svg>
  );
}

export function Crown() {
  return (
    <View pointerEvents="none" style={fx.crown}>
      <Svg width={22} height={15} viewBox="0 0 24 16">
        <Path d="M2 14 1 4l6 4 5-7 5 7 6-4-1 10z" fill="#ffd23f" stroke="#141210" strokeWidth={1.6} strokeLinejoin="round" />
        <Circle cx={12} cy={10} r={1.6} fill="#e8202a" />
      </Svg>
    </View>
  );
}

/** 紙吹雪（trigger が変わるたびに降る） */
const CONF_COLS = ['#ffd23f', '#ff5aa5', '#3ec7ff', '#7be36b', '#ff8a1a', '#e8202a', '#b48cff'];
export function Confetti({ trigger, colors = CONF_COLS }: { trigger: number; colors?: string[] }) {
  const { width, height } = useWindowDimensions();
  const pieces = useRef(
    Array.from({ length: 60 }, (_, k) => ({
      x: Math.random(),
      dx: (Math.random() * 2 - 1) * 120,
      r: Math.random() * 720 - 360,
      d: Math.random() * 350,
      t: 1600 + Math.random() * 1400,
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 8,
      c: colors[k % colors.length],
      v: new Animated.Value(0),
    })),
  ).current;
  useEffect(() => {
    if (!trigger) return;
    pieces.forEach((p) => {
      p.v.setValue(0);
      Animated.sequence([Animated.delay(p.d), Animated.timing(p.v, { toValue: 1, duration: p.t, easing: Easing.bezier(0.25, 0.6, 0.4, 1), useNativeDriver: true })]).start();
    });
  }, [trigger]);
  if (!trigger) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, k) => (
        <Animated.View
          key={k}
          style={{
            position: 'absolute', left: p.x * width, top: -20, width: p.w, height: p.h, borderRadius: 2, backgroundColor: p.c,
            transform: [
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.r}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

/** 残り10秒の赤いフチ（on の間、脈打つ） */
export function HurryFrame({ on }: { on: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) return;
    const a = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.35, duration: 850, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [on]);
  if (!on) return null;
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fx.hurry, { opacity: v }]} />;
}

const fx = StyleSheet.create({
  machine: { alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 5 },
  handle: { position: 'absolute', left: 72, top: 152 },
  capHalf: { position: 'absolute', left: 0, right: 0, height: 42, borderWidth: 4, borderColor: '#141210' },
  capT: { top: 0, borderTopLeftRadius: 42, borderTopRightRadius: 42, borderBottomWidth: 2 },
  capB: { bottom: 0, borderBottomLeftRadius: 42, borderBottomRightRadius: 42, borderTopWidth: 2, backgroundColor: '#f7f3ea' },
  capFace: { position: 'absolute', left: 6, top: 6 },
  burst: { position: 'absolute', width: 110, height: 110, borderRadius: 55 },
  crown: { position: 'absolute', top: -13, alignSelf: 'center', transform: [{ rotate: '-8deg' }], zIndex: 2 },
  hurry: { borderWidth: 6, borderColor: '#ff2a2a', shadowColor: '#ff2a2a', shadowOpacity: 1, shadowRadius: 30, zIndex: 50 },
  angel: { width: 128, height: 104, alignSelf: 'center' },
  wing: { position: 'absolute', top: 40, width: 40, height: 28, borderRadius: 18, backgroundColor: '#fff', borderWidth: 2.5, borderColor: '#9ab0ff' },
  halo: { position: 'absolute', left: 42, top: 4, width: 44, height: 12, borderRadius: 22, borderWidth: 5, borderColor: '#ffd23f' },
  face: { position: 'absolute', left: 37, top: 28, width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff3d6', borderWidth: 3, borderColor: '#141210', alignItems: 'center', justifyContent: 'center', gap: 6 },
  eyes: { flexDirection: 'row', gap: 10 },
  happyEye: { width: 10, height: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderWidth: 3, borderBottomWidth: 0, borderColor: '#141210' },
  smile: { width: 18, height: 9, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, borderWidth: 3, borderTopWidth: 0, borderColor: '#141210' },
  skull: { width: 100, height: 100, alignSelf: 'center' },
  skullHead: { position: 'absolute', left: 10, top: 6, width: 80, height: 70, borderRadius: 40, backgroundColor: '#f7f3ea', borderWidth: 3, borderColor: '#141210' },
  skullJaw: { position: 'absolute', left: 27, top: 64, width: 46, height: 28, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: '#f7f3ea', borderWidth: 3, borderTopWidth: 0, borderColor: '#141210' },
  eye: { position: 'absolute', top: 35, width: 24, height: 26, borderRadius: 12, backgroundColor: '#e8202a', overflow: 'hidden' },
  eyeGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: '#ff8a1a' },
  nose: { position: 'absolute', left: 44, top: 58, width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#141210' },
  tooth: { position: 'absolute', top: 74, width: 3, height: 16, backgroundColor: '#141210' },
  bombBox: { width: 96, height: 92, alignSelf: 'center' },
  bombBody: { position: 'absolute', left: 12, top: 26, width: 60, height: 60, borderRadius: 30, backgroundColor: '#1a1a1a', borderWidth: 3, borderColor: '#ff7a1a' },
  bombShine: { position: 'absolute', left: 12, top: 10, width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.25)' },
  bombCap: { position: 'absolute', left: 50, top: 18, width: 14, height: 12, borderRadius: 3, backgroundColor: '#555', transform: [{ rotate: '35deg' }] },
  bombFuse: { position: 'absolute', left: 60, top: 12, width: 14, height: 3, borderRadius: 2, backgroundColor: '#c9a46a', transform: [{ rotate: '-35deg' }] },
  spark: { position: 'absolute', left: 66, top: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#ffd23f', borderWidth: 3, borderColor: '#ff7a1a' },
  coin: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#ffd23f', borderWidth: 5, borderColor: '#e8b52a', alignItems: 'center', justifyContent: 'center' },
  coinText: { fontFamily: F.display, fontSize: 34, color: '#6b4a00' },
  fuse: { width: 46, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.15)' },
  fuseRow: { flexDirection: 'row', gap: 4, height: 6 },
  fuseDash: { width: 6, height: 6 },
  capsule: { width: 64, height: 64 },
  capBot: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 32, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, backgroundColor: '#f2ede4', borderWidth: 2, borderColor: 'rgba(0,0,0,0.18)' },
  capBadge: { position: 'absolute', left: 6, top: 6, right: 6, bottom: 6, borderRadius: 999, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  capBadgeText: { fontFamily: F.display, fontSize: 20 },
  capTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 32, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 2, borderColor: 'rgba(0,0,0,0.18)' },
  flash: { zIndex: 50, backgroundColor: 'rgba(255,59,26,0.75)', alignItems: 'center', justifyContent: 'center' },
  flashCore: { width: '70%', aspectRatio: 1, borderRadius: 999, backgroundColor: 'rgba(255,240,180,0.95)' },
});
