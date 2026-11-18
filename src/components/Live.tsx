import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Animated, Easing, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { DeviceMotion } from 'expo-sensors';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { Tap } from './Tap';
import { Icon } from './Icon';
import { MODE_TITLE } from './ModeParts';
import { addPhoto, CAP_LABEL, LIVE, mlog, nickList, setLive, useLive, usePhotos, type Cap, type LiveSet } from '../lib/live';
import type { Tally } from '../lib/extras';
import { play } from '../lib/sound';
import { Haptics, Vibration } from '../lib/vibe';
import { C, F, LEVEL_LABEL, ROLE, colorOf } from '../theme';
import type { GachaItem, Level, Member, Mode } from '../types';

/** ノリダンのキャラ：黄色い四角の顔 */
export function HostFace({ size = 52 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect x={2} y={2} width={36} height={36} rx={11} fill="#ffd23f" stroke="#141210" strokeWidth={2.5} />
      <Circle cx={14} cy={18} r={3.2} fill="#141210" />
      <Circle cx={26} cy={18} r={3.2} fill="#141210" />
      <Path d="M12.5 26q7.5 6.5 15 0" stroke="#141210" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M9 10.5l6.5 2.8M31 10.5l-6.5 2.8" stroke="#141210" strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

// ---------- 20 実況ひとこと：画面の下にキャラのツッコミ ----------
export function HostSay({ text, onDone }: { text: string; onDone: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(v, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(v, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onDone());
    Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 450, useNativeDriver: true }), Animated.timing(bob, { toValue: 0, duration: 450, useNativeDriver: true })]), { iterations: 2 }).start();
  }, []);
  return (
    <Animated.View pointerEvents="none" style={[ls.host, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
      <Animated.View style={{ transform: [{ rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) }] }}>
        <HostFace />
      </Animated.View>
      <View style={ls.bubble}>
        <Text style={ls.bubbleText}>{text}</Text>
      </View>
    </Animated.View>
  );
}

// ---------- 21 レアのカプセルが割れる瞬間に白く光る ----------
export function RareFlash({ onDone }: { onDone: () => void }) {
  const v = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 0, duration: 450, useNativeDriver: true }).start(() => onDone());
  }, []);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: v }]} />;
}
/** カプセルの上半分の色 */
export const CAP_COLOR: Record<Cap['c'], string> = { white: '#f7f3ea', red: '#e8202a', gold: '#ffd23f', rainbow: '#ff5d8f' };
/** 金・虹カプセルの「金カプセル！」（0.5秒後にドンと出て消える） */
export function RareLabel({ cap }: { cap: Cap }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([Animated.delay(480), Animated.timing(v, { toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: true })]).start();
  }, []);
  const label = CAP_LABEL[cap.c];
  if (!label) return null;
  return (
    <Animated.Text
      style={[ls.rare, cap.c === 'rainbow' && { color: '#fff', textShadowColor: '#ff5d8f' }, {
        opacity: v.interpolate({ inputRange: [0, 0.3, 0.8, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [2.2, 1, 1.1] }) }],
      }]}
    >
      {label}
    </Animated.Text>
  );
}

// ---------- 23 選手入場 ----------
export function Entrance({ members, tally, mode, onDone }: { members: Member[]; tally: Tally | null; mode: Mode; onDone: () => void }) {
  const [nicks] = useState(() => nickList(members, tally));
  const n = members.length, many = n > 6, step = many ? 180 : 320;
  const fade = useRef(new Animated.Value(0)).current;
  const head = useRef(new Animated.Value(0)).current;
  const rows = useRef(members.map(() => new Animated.Value(0))).current;
  const done = useRef(false);
  const close = () => {
    if (done.current) return;
    done.current = true;
    Animated.timing(fade, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => onDone());
  };
  useEffect(() => {
    play('drumroll');
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    Animated.spring(head, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    const ts = rows.map((v, i) =>
      setTimeout(() => {
        Animated.spring(v, { toValue: 1, friction: 7, tension: 110, useNativeDriver: true }).start();
        play('tick');
        Haptics.selectionAsync().catch(() => {});
      }, 450 + i * step),
    );
    ts.push(setTimeout(() => !done.current && play('fanfare'), 550 + n * step));
    ts.push(setTimeout(close, 1900 + n * step));
    return () => ts.forEach(clearTimeout);
  }, []);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, ls.en, { opacity: fade }]}>
      <Pressable style={ls.enIn} onPress={close} accessibilityLabel="選手入場（タップで飛ばす）">
        <Text style={ls.enMode}>{MODE_TITLE[mode]}</Text>
        <Animated.Text style={[ls.enHead, { transform: [{ scale: head.interpolate({ inputRange: [0, 1], outputRange: [2, 1] }) }] }]}>選手入場</Animated.Text>
        <View style={[ls.enList, many && { flexDirection: 'row', flexWrap: 'wrap' }]}>
          {members.map((m, i) => {
            const right = !many && i % 2 === 1;
            return (
              <Animated.View
                key={m.name}
                style={[ls.enRow, many && { width: '48%', paddingVertical: 6 }, right && { flexDirection: 'row-reverse' }, { backgroundColor: colorOf(i) + '40', opacity: rows[i], transform: [{ translateX: rows[i].interpolate({ inputRange: [0, 1], outputRange: [right ? 300 : -300, 0] }) }, { skewX: '-6deg' }] }]}
              >
                <View style={[ls.enAv, { backgroundColor: colorOf(i) }, many && { width: 36, height: 36 }]}>
                  <Text style={[ls.enAvText, many && { fontSize: 16 }]}>{m.name.slice(0, 1)}</Text>
                </View>
                <View style={[{ flexShrink: 1 }, right && { alignItems: 'flex-end' }]}>
                  <Text style={[ls.enName, many && { fontSize: 17 }]} numberOfLines={1}>{m.name}</Text>
                  <Text style={[ls.enNick, { color: colorOf(i) }, many && { fontSize: 12 }]} numberOfLines={1}>{nicks[i]}</Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
        <Text style={ls.enSkip}>タップで飛ばす</Text>
      </Pressable>
    </Animated.View>
  );
}

// ---------- 24 伏せて出す（アホお題） ----------
export function FaceDeal({ name, color, turn, fg, cardBg, edge, face, onFace, onGo }: { name: string; color: string; turn: number; fg: string; cardBg: string; edge: string; face: 'down' | 'up'; onFace: (f: 'up') => void; onGo: () => void }) {
  const faceRef = useRef(face);
  faceRef.current = face;
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let alive = true;
    (async () => {
      try {
        if (!(await DeviceMotion.isAvailableAsync())) return;
        const perm = await DeviceMotion.requestPermissionsAsync?.();
        if (perm && !perm.granted) return;
        if (!alive) return;
        DeviceMotion.setUpdateInterval(120);
        sub = DeviceMotion.addListener((e: { rotation?: { beta: number; gamma: number } }) => {
          if (!e.rotation) return;
          const b = Math.abs(e.rotation.beta), g = Math.abs(e.rotation.gamma);
          if (faceRef.current === 'down' && b > 2.4) {
            onFace('up');
            play('pop');
            Vibration.vibrate(30);
          } else if (faceRef.current === 'up' && b < 0.7 && g < 0.7) onGo();
        });
      } catch {}
    })();
    const a = Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 500, useNativeDriver: true }), Animated.timing(bob, { toValue: 0, duration: 500, useNativeDriver: true })]));
    a.start();
    return () => {
      alive = false;
      sub?.remove();
      a.stop();
    };
  }, []);
  const up = face === 'up';
  return (
    <View style={[ls.faceCard, { backgroundColor: cardBg, borderColor: edge }]}>
      <Text style={[ls.prog, { color: fg }]}>{`${turn}枚目・${name}の番`}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={[ls.ph, { borderColor: fg, opacity: up ? 0.3 : 0.7, transform: [{ perspective: 240 }, { rotateX: '55deg' }] }]}><Text style={[ls.phText, { color: fg }]}>伏せる</Text></View>
        <Icon name="next" color={fg} size={28} />
        <Animated.View style={[ls.ph, { backgroundColor: C.yuru, borderColor: C.ink }, up && { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]}><Text style={[ls.phText, { color: C.ink }]}>お題</Text></Animated.View>
      </View>
      <Text style={[ls.faceH, { color: fg }]}>{up ? 'せーので\n起こして！' : 'スマホを伏せて\n机に置いてな'}</Text>
      <Text style={[ls.note, { color: fg }]}>{up ? '画面を上に向けたらお題がバン！と出る' : `${name}が「せーの」で起こしたら、お題が出る`}</Text>
      <View style={[ls.dot, { backgroundColor: color }]} />
    </View>
  );
}

// ---------- 24 振ってガチャ ----------
export function SpinWait({ names, fg, onSpin }: { names: string; fg: string; onSpin: () => void }) {
  const rock = useRef(new Animated.Value(0)).current;
  const fired = useRef(false);
  const go = () => {
    if (fired.current) return;
    fired.current = true;
    onSpin();
  };
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(rock, { toValue: 1, duration: 250, useNativeDriver: true }), Animated.timing(rock, { toValue: -1, duration: 250, useNativeDriver: true })]));
    a.start();
    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        if (!(await DeviceMotion.isAvailableAsync())) return;
        const perm = await DeviceMotion.requestPermissionsAsync?.();
        if (perm && !perm.granted) return;
        DeviceMotion.setUpdateInterval(50);
        sub = DeviceMotion.addListener((e: { acceleration?: { x: number; y: number; z: number } | null }) => {
          const a2 = e.acceleration;
          if (a2 && Math.hypot(a2.x, a2.y, a2.z) > 13) go();
        });
      } catch {}
    })();
    return () => {
      a.stop();
      sub?.remove();
    };
  }, []);
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 12, flex: 1, paddingVertical: 20 }}>
      <Animated.View style={[ls.swArt, { transform: [{ rotate: rock.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] }) }] }]}>
        <Icon name="shake" color="#fff" size={72} />
      </Animated.View>
      <Text style={[ls.swH, { color: fg }]}>振って回せ！</Text>
      <Text style={[ls.note, { color: fg }]}>{`${names}がスマホを振る。落とさんようにしっかり持ってな`}</Text>
      <Tap onPress={go} style={ls.swBtn}>
        <Text style={ls.swBtnText}>押して回す</Text>
      </Tap>
    </View>
  );
}

// ---------- 25 罰の瞬間カメラ ----------
export function CamButton({ item, members, fg }: { item: GachaItem; members: Member[]; fg: string }) {
  const photos = usePhotos();
  const done = photos.some((p) => p.key === item);
  const shoot = async () => {
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
      }
      const r = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, quality: 0.5, allowsEditing: false, exif: false });
      if (r.canceled || !r.assets?.[0]?.uri) return;
      addPhoto({ key: item, i: item.i, txt: item.segments.map((x) => x.text).join(''), uri: r.assets[0].uri });
      play('chin');
    } catch {}
  };
  return (
    <Tap onPress={shoot} style={[ls.camBtn, { borderColor: fg, marginLeft: 62 }]} accessibilityLabel={`${members[item.i]?.name}の罰の瞬間を撮る`}>
      <Icon name="cam" color={fg} size={16} />
      <Text style={[ls.camText, { color: fg }]}>{done ? '撮った！もう1回' : '罰の瞬間を撮る'}</Text>
    </Tap>
  );
}
const ROT = [-4, 3, -2, 5, -3, 2, -5, 4];
export function Polaroids({ members }: { members: Member[] }) {
  const photos = usePhotos();
  if (!photos.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={ls.h2}>罰の瞬間</Text>
      <View style={ls.polas}>
        {photos.map((p, k) => (
          <View key={k} style={[ls.pola, { transform: [{ rotate: `${ROT[k % 8]}deg` }] }]}>
            <Image source={{ uri: p.uri }} style={ls.polaImg} />
            <Text style={ls.polaName}>{members[p.i]?.name ?? ''}</Text>
            <Text style={ls.polaTxt} numberOfLines={2}>{p.txt}</Text>
          </View>
        ))}
      </View>
      <Text style={ls.small}>写真はこのスマホの中だけ。シェアする前に、写ってる人に「ええ？」って聞いてな</Text>
    </View>
  );
}
/** シェア画像（360×640）用の小さいポラロイド3枚 */
export function StoryPolas({ members }: { members: Member[] }) {
  const photos = usePhotos().slice(-3);
  if (!photos.length) return null;
  return (
    <>
      <Text style={ls.storyHead}>罰の瞬間</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        {photos.map((p, k) => (
          <View key={k} style={[ls.spola, { transform: [{ rotate: `${[-3, 2, -2][k]}deg` }] }]}>
            <Image source={{ uri: p.uri }} style={{ width: '100%', height: 64, backgroundColor: '#333' }} />
            <Text style={ls.spName} numberOfLines={1}>{members[p.i]?.name ?? ''}</Text>
            <Text style={ls.spTxt} numberOfLines={1}>{p.txt}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

// ---------- 26 盛り上がりメーター ----------
// マイクで場の声の大きさだけを見る（録音ファイルは残さへん）。静かな時間が続いたら地獄度を上げるか聞く
export function MeterHost({ active, screen, level, onLevel }: { active: boolean; screen: string; level: Level; onLevel: (l: Level) => void }) {
  const recorder = useAudioRecorder({ ...RecordingPresets.LOW_QUALITY, isMeteringEnabled: true });
  const [lv, setLv] = useState(0);
  const [ask, setAsk] = useState(false);
  const st = useRef({ start: 0, asked: 0, smooth: 0, on: false });
  const run = active && screen !== 'voice';
  useEffect(() => {
    if (!run) return;
    let alive = true;
    let t: ReturnType<typeof setInterval> | null = null;
    (async () => {
      try {
        const p = await AudioModule.requestRecordingPermissionsAsync();
        if (!p.granted || !alive) return;
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        st.current.on = true;
        if (!st.current.start) st.current.start = Date.now();
        let acc: number[] = [];
        t = setInterval(() => {
          const s2 = recorder.getStatus?.();
          const db = typeof s2?.metering === 'number' ? s2.metering : -160;
          acc.push(Math.max(0, Math.min(100, ((db + 62) / 50) * 100)));
          if (acc.length < 4) return;
          const v = acc.reduce((a, b) => a + b, 0) / acc.length;
          acc = [];
          st.current.smooth = st.current.smooth * 0.7 + v * 0.3;
          setLv(st.current.smooth);
          mlog.push({ t: Date.now(), v: Math.round(v), m: screen });
          if (mlog.length > 4 * 3600) mlog.shift();
          // 6分以上たって、ここ5分の平均が小さかったら1回だけ聞く（次は20分あける）
          const now = Date.now(), last5 = mlog.filter((q) => now - q.t < 5 * 60e3);
          if (now - st.current.start > 6 * 60e3 && now - st.current.asked > 20 * 60e3 && last5.length > 200 && last5.reduce((a, q) => a + q.v, 0) / last5.length < 24) {
            st.current.asked = now;
            setAsk(true);
            play('warn');
          }
        }, 250);
      } catch {}
    })();
    return () => {
      alive = false;
      if (t) clearInterval(t);
      if (st.current.on) {
        st.current.on = false;
        try {
          recorder.stop();
        } catch {}
        setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
      }
    };
  }, [run, screen]);
  const up: Level | null = level === 'yurume' ? 'futsu' : level === 'futsu' ? 'jigoku' : null;
  return (
    <>
      {run && (
        <View pointerEvents="none" style={ls.strip}>
          <View style={[ls.stripIn, { width: `${Math.max(4, lv)}%`, backgroundColor: lv > 55 ? '#ff5d2a' : '#4dd4ff' }]} />
        </View>
      )}
      <Modal visible={ask} transparent animationType="slide" onRequestClose={() => setAsk(false)}>
        <Pressable style={ls.qBack} onPress={() => setAsk(false)}>
          <Pressable style={ls.qSheet} onPress={() => {}}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
              <HostFace size={48} />
              <View style={ls.qBubble}>
                <Text style={{ fontWeight: '900', color: C.ink }}>{LIVE.meter.quiet[Math.floor(Math.random() * LIVE.meter.quiet.length)]}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.ink, opacity: 0.6 }}>ここ5分、声が小さめ</Text>
              </View>
            </View>
            <Text style={ls.qH}>{up ? `地獄度、\n「${LEVEL_LABEL[up]}」に上げる？` : '声を出す系のゲームも\nおすすめやで'}</Text>
            <Text style={ls.qP}>{up ? 'それか、声を出す系のゲーム（声デカ選手権・山手線ゲーム・たけのこニョッキ）もええで' : '声デカ選手権・山手線ゲーム・たけのこニョッキは、結果発表のあとに選べる'}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Tap style={ls.qBtn} onPress={() => setAsk(false)}><Text style={ls.qBtnText}>このまま</Text></Tap>
              {up && (
                <Tap style={[ls.qBtn, { backgroundColor: '#ff2a2a' }]} onPress={() => { onLevel(up); setAsk(false); play('warn'); }}>
                  <Text style={ls.qBtnText}>{`${LEVEL_LABEL[up]}にする`}</Text>
                </Tap>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
/** 結果発表：今日の盛り上がりグラフ（30秒ずつの平均）といちばんの瞬間 */
export function MeterGraph() {
  const [w, setW] = useState(300);
  if (mlog.length < 60) return null;
  const B = 30e3, t0 = mlog[0].t, bins: { s: number; n: number; t: number; m: string }[] = [];
  mlog.forEach((p) => {
    const k = Math.floor((p.t - t0) / B);
    if (!bins[k]) bins[k] = { s: 0, n: 0, t: p.t, m: p.m };
    bins[k].s += p.v;
    bins[k].n++;
  });
  const pts = bins.filter(Boolean).map((b) => ({ v: b.s / b.n, t: b.t, m: b.m }));
  if (pts.length < 3) return null;
  const H = 110, mx = Math.max(30, ...pts.map((p) => p.v));
  const xy = pts.map((p, k) => [(k / (pts.length - 1)) * w, H - (p.v / mx) * (H - 14) - 4]);
  const d = xy.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const pk = pts.reduce((a, p, k) => (p.v > pts[a].v ? k : a), 0);
  const hm = (t: number) => {
    const z = new Date(t);
    return `${z.getHours()}:${String(z.getMinutes()).padStart(2, '0')}`;
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={ls.h2}>今日の盛り上がり</Text>
      <View style={ls.graph} onLayout={(e) => setW(Math.max(100, e.nativeEvent.layout.width - 24))}>
        <Svg width={w} height={H}>
          <Path d={`${d}L${w} ${H}L0 ${H}Z`} fill="rgba(255,93,143,0.22)" />
          <Path d={d} fill="none" stroke="#ff5d8f" strokeWidth={3} />
          <Circle cx={xy[pk][0]} cy={xy[pk][1]} r={7} fill={C.yuru} stroke={C.ink} strokeWidth={3} />
        </Svg>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={ls.small}>{hm(pts[0].t)}</Text>
          <Text style={ls.small}>{hm(pts[pts.length - 1].t)}</Text>
        </View>
      </View>
      <View style={ls.peak}>
        <Text style={{ color: C.paper, fontWeight: '900' }}>いちばん盛り上がった瞬間</Text>
        <Text style={ls.small}>{`${hm(pts[pk].t)}　${MODE_TITLE[pts[pk].m as Mode] ?? ''}`}</Text>
      </View>
    </View>
  );
}

// ---------- 設定シートの「演出」 ----------
const ROWS: [keyof LiveSet, string, string][] = [
  ['jikkyo', '実況ひとこと', '連続の罰や首位交代に、ノリダンがツッコむ'],
  ['entrance', '選手入場', 'ゲームの最初に、二つ名つきでメンバー紹介'],
  ['faceDeal', '伏せて出す', 'アホお題：伏せたスマホを起こしたらお題が出る'],
  ['spinGacha', '振ってガチャ', '罰ガチャをスマホを振って回す（ボタンでもOK）'],
  ['camera', '罰の瞬間カメラ', '罰が出たら写真を撮れる。写真はこのスマホの中だけ'],
  ['meter', '盛り上がりメーター', 'マイクで声の大きさだけ見る（録音は残さへん）'],
];
export function LiveSettings({ Toggle, hideHead }: { hideHead?: boolean; Toggle: (p: { label: string; sub: string; on: boolean; onPress: () => void }) => ReactElement }) {
  const v = useLive();
  return (
    <>
      {!hideHead && <Text style={ls.sec}>演出</Text>}
      {ROWS.map(([k, t, sub]) => (
        <Toggle key={k} label={t} sub={sub} on={v[k]} onPress={() => setLive(k, !v[k])} />
      ))}
    </>
  );
}

const ls = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, bottom: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  bubble: { flex: 1, backgroundColor: C.paper, borderRadius: 18, borderBottomLeftRadius: 4, paddingVertical: 11, paddingHorizontal: 15, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  bubbleText: { color: C.ink, fontWeight: '900', fontSize: 16, lineHeight: 22 },
  rare: { position: 'absolute', left: 0, right: 0, top: '56%', textAlign: 'center', fontFamily: F.display, fontSize: 30, color: '#ffd23f', textShadowColor: '#141210', textShadowRadius: 1, textShadowOffset: { width: 0, height: 3 } },
  en: { backgroundColor: '#1c0f17', zIndex: 50 },
  enIn: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, gap: 6 },
  enMode: { color: '#ff5d8f', fontWeight: '900', letterSpacing: 4 },
  enHead: { color: C.paper, fontFamily: F.display, fontSize: 48, lineHeight: 60 },
  enList: { alignSelf: 'stretch', gap: 10, marginTop: 12, justifyContent: 'space-between' },
  enRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20 },
  enAv: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  enAvText: { fontFamily: F.display, fontSize: 24, color: C.ink },
  enName: { fontFamily: F.display, fontSize: 26, color: C.paper },
  enNick: { fontWeight: '900', fontSize: 13 },
  enSkip: { marginTop: 16, color: C.muted, fontSize: 12, fontWeight: '900' },
  faceCard: { flex: 1, borderRadius: 26, borderWidth: 3, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 },
  prog: { fontWeight: '900', fontSize: 13, opacity: 0.7 },
  ph: { width: 66, height: 110, borderRadius: 14, borderWidth: 3.5, alignItems: 'center', justifyContent: 'center' },
  phText: { fontWeight: '900', fontSize: 13 },
  faceH: { fontFamily: F.display, fontSize: 30, lineHeight: 40, textAlign: 'center' },
  note: { fontWeight: '700', fontSize: 14, textAlign: 'center', opacity: 0.75, lineHeight: 21 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  swArt: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#e8202a', alignItems: 'center', justifyContent: 'center' },
  swH: { fontFamily: F.display, fontSize: 34 },
  swBtn: { alignSelf: 'stretch', marginTop: 6, backgroundColor: C.paper, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  swBtnText: { color: C.ink, fontWeight: '900', fontSize: 18 },
  camBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 2, opacity: 0.85 },
  camText: { fontWeight: '900', fontSize: 13 },
  h2: { color: C.muted, fontWeight: '900', fontSize: 13, letterSpacing: 1, marginTop: 8 },
  polas: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  pola: { width: '48%', backgroundColor: '#fff', padding: 7, paddingBottom: 10, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  polaImg: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#333' },
  polaName: { color: C.ink, fontWeight: '900', fontSize: 14, marginTop: 5 },
  polaTxt: { color: C.ink, opacity: 0.7, fontSize: 12, fontWeight: '700' },
  small: { color: C.muted, fontSize: 12, fontWeight: '700' },
  storyHead: { fontFamily: F.display, fontSize: 16, color: ROLE.info, marginTop: 14 },
  spola: { width: '31%', backgroundColor: '#fff', padding: 4, paddingBottom: 5 },
  spName: { color: C.ink, fontWeight: '900', fontSize: 12, marginTop: 2 },
  spTxt: { color: C.ink, opacity: 0.6, fontSize: 9, fontWeight: '700' },
  strip: { position: 'absolute', left: 0, right: 0, top: 0, height: 4, backgroundColor: 'rgba(0,0,0,0.15)', zIndex: 30 },
  stripIn: { height: '100%', borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  qBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  qSheet: { backgroundColor: '#fffaf0', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34, gap: 12 },
  qBubble: { flex: 1, backgroundColor: '#efe8da', borderRadius: 16, borderBottomLeftRadius: 4, paddingVertical: 9, paddingHorizontal: 13 },
  qH: { fontFamily: F.display, fontSize: 26, lineHeight: 34, color: C.ink, textAlign: 'center' },
  qP: { fontWeight: '700', fontSize: 14, color: C.ink, opacity: 0.7, textAlign: 'center' },
  qBtn: { flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: '#2a2622', alignItems: 'center' },
  qBtnText: { color: C.paper, fontWeight: '900', fontSize: 16 },
  graph: { backgroundColor: 'rgba(247,243,234,0.06)', borderRadius: 18, padding: 12, gap: 4 },
  peak: { backgroundColor: 'rgba(247,243,234,0.06)', borderRadius: 16, padding: 12, gap: 2 },
  sec: { color: C.muted, fontWeight: '900', fontSize: 13, letterSpacing: 1, marginTop: 6 },
});
