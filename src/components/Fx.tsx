import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
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
export function Capsule({ color, delay }: { color: string; delay: number }) {
  const drop = useRef(new Animated.Value(0)).current;
  const open = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(drop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      Animated.timing(open, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  const translateY = drop.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] });
  const rotate = drop.interpolate({ inputRange: [0, 1], outputRange: ['-200deg', '0deg'] });
  const topRotate = open.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-70deg'] });
  const topY = open.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  return (
    <Animated.View style={[fx.capsule, { opacity: drop, transform: [{ translateY }, { rotate }] }]}>
      <View style={fx.capBot} />
      <Animated.View style={[fx.capTop, { backgroundColor: color, transform: [{ translateX: -20 }, { translateY: topY }, { rotate: topRotate }, { translateX: 20 }] }]} />
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

const fx = StyleSheet.create({
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
  capTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 32, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 2, borderColor: 'rgba(0,0,0,0.18)' },
  flash: { zIndex: 50, backgroundColor: 'rgba(255,59,26,0.75)', alignItems: 'center', justifyContent: 'center' },
  flashCore: { width: '70%', aspectRatio: 1, borderRadius: 999, backgroundColor: 'rgba(255,240,180,0.95)' },
});
