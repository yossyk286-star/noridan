import { useEffect, useRef, useState } from 'react';
import { iniFit, initialOf } from '../lib/game';
import type React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Haptics } from '../lib/vibe';
import { play } from '../lib/sound';
import { Tap } from './Tap';
import { F, alpha, colorOf } from '../theme';
import type { STAGE } from '../theme';
import type { Level, Member, Mode } from '../types';
import { HELP, boldParts } from '../lib/help';
import { Icon, type IconName } from './Icon';

type Pal = (typeof STAGE)[Level];

/** NGワード・投票で使う札（お題札と同じ見た目の箱） */
export function ModeCard({ pal, children, center, edge, bg }: { pal: Pal; children: React.ReactNode; center?: boolean; edge?: string; bg?: string }) {
  return <View style={[s.card, { backgroundColor: bg ?? pal.cardBg, borderColor: edge ?? pal.cardEdge }, center && s.center]}>{children}</View>;
}

export function Prog({ fg, children }: { fg: string; children: React.ReactNode }) {
  return <Text style={[s.prog, { color: fg }]}>{children}</Text>;
}
export function Note({ fg, children }: { fg: string; children: React.ReactNode }) {
  return <Text style={[s.note, { color: fg }]}>{children}</Text>;
}
export function Lead({ fg, children }: { fg: string; children: React.ReactNode }) {
  return <Text style={[s.lead, { color: fg }]}>{children}</Text>;
}

const MODE_TITLE: Record<Mode, string> = { odai: 'アホお題', sugoroku: 'すごろく', memory: '神経衰弱', ito: '価値観ナンバー', gesture: '早押しジェスチャー', homeru: '褒め殺し', ngword: 'NGワード', vote: 'ぶっちゃけ投票', wolf: 'ワードウルフ', pittari: 'ピッタリ予想', tilt: '傾けたらアウト', shake: '全力シェイク', stop: 'ピタッとストップ', rtap: 'ロシアンタップ', bpass: '爆弾パス', hilo: 'ハイ&ロー', reflex: '反射神経バトル', voice: '声デカ選手権', blind: '目隠し当て', pocky: 'ポッキーゲーム', tickle: 'こしょばし我慢', hug: 'ハグタイム当て', quiz: '早押し雑学クイズ', face: 'テンション伝言', deko: 'おでこ当て', doubt: 'ダウト' };

/** 始める前の説明（どのモードも同じ形）。children に地獄度の説明や時間の選択を入れる */
export function IntroCard({ pal, mode, tag, children }: { pal: Pal; mode: Mode; tag?: string; children?: React.ReactNode }) {
  const fg = pal.cardFg;
  return (
    <ModeCard pal={pal}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[s.introTitle, { color: fg }]}>{MODE_TITLE[mode]}</Text>
        {!!tag && <Text style={[s.introTag, { color: fg, borderColor: alpha('#888888', 0.5) }]}>{tag}</Text>}
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        {HELP[mode].how.map(([ic, t], k) => (
          <View key={k} style={s.howRow}>
            <View style={s.howIc}>
              <Icon name={ic as IconName} color={pal.cardEdge} size={24} />
            </View>
            <Text style={[s.howText, { color: fg }]}>
              {boldParts(t).map((x, j) => (
                <Text key={j} style={x.b ? s.howBold : undefined}>{x.t}</Text>
              ))}
            </Text>
          </View>
        ))}
        {children}
      </View>
    </ModeCard>
  );
}

/** 地獄度の説明の箱 */
export function LevelBox({ pal, text, note }: { pal: Pal; text: string; note?: string }) {
  return (
    <View style={[s.lvBox, { backgroundColor: alpha(pal.cardEdge, 0.16) }]}>
      <Text style={[s.lvText, { color: pal.cardFg }]}>{text}</Text>
      {!!note && <Text style={[s.lvNote, { color: pal.cardFg }]}>{note}</Text>}
    </View>
  );
}

/** 大きい丸と名前（「〇〇だけ見て」など、スマホを渡す時の画面） */
export function HandWho({ members, i, sub, fg }: { members: Member[]; i: number; sub?: string; fg: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <View style={[s.handDot, { backgroundColor: colorOf(i) }]}>
        <Text style={[s.handDotText, iniFit(initialOf(members, i))]}>{initialOf(members, i)}</Text>
      </View>
      <Text style={[s.handName, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit>{members[i].name}</Text>
      {!!sub && <Text style={[s.handSub, { color: fg }]}>{sub}</Text>}
    </View>
  );
}

/** 最初の人を決めるルーレット。名前を順に光らせて、だんだん遅くなって1人に止まる */
export function Roulette({ members, fg, onDone, tick }: { members: Member[]; fg: string; onDone: (i: number) => void; tick?: () => void }) {
  const n = members.length;
  const [idx, setIdx] = useState(0);
  const [hit, setHit] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const goal = Math.floor(Math.random() * n);
    const base = 16 + Math.floor(Math.random() * n);
    const steps = base + ((goal - (base % n) + n) % n);
    let k = 0;
    const step = () => {
      setIdx(k % n);
      tick?.();
      if (k >= steps) {
        timer.current = setTimeout(() => {
          setHit(true);
          onDone(k % n);
        }, 450);
        return;
      }
      k++;
      const p = k / steps;
      timer.current = setTimeout(step, 55 + p * p * 330);
    };
    step();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const cols = n <= 4 ? 2 : n <= 6 || n === 9 ? 3 : 4;
  return (
    <View style={s.tiles}>
      {members.map((m, i) => {
        const on = i === idx;
        return (
          <View key={i} style={[s.roul, { width: `${100 / cols - 2}%` as const, borderColor: on ? colorOf(i) : alpha('#888888', 0.3), backgroundColor: on ? alpha(colorOf(i).length === 7 ? colorOf(i) : '#888888', 0.22) : 'transparent', transform: [{ scale: on ? (hit ? 1.1 : 1.05) : 1 }] }]}>
            <View style={[s.roulDot, { backgroundColor: colorOf(i), opacity: on ? 1 : 0.45 }]}>
              <Text style={[s.roulDotText, iniFit(initialOf(members, i))]}>{initialOf(members, i)}</Text>
            </View>
            <Text style={[s.roulName, { color: fg, opacity: on ? 1 : 0.55 }]} numberOfLines={1}>{m.name}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** 名前のタイル（押す用）。count を渡すと右下に小さく出す */
export function NameTiles({ members, list, fg, onPress, count, cols = 3 }: { members: Member[]; list: number[]; fg: string; onPress: (i: number) => void; count?: (i: number) => string; cols?: number }) {
  return (
    <View style={s.tiles}>
      {list.map((i) => (
        <Tap key={i} onPress={() => onPress(i)} style={({ pressed }) => [s.tile, { width: `${100 / cols - 2}%` as const, borderColor: alpha(fg.length === 7 ? fg : '#f7f3ea', 0.25), transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
          <View style={[s.tileBar, { backgroundColor: colorOf(i) }]} />
          <Text style={[s.tileName, { color: fg }]} numberOfLines={1}>{members[i].name}</Text>
          {count && <Text style={[s.tileCount, { color: fg }]}>{count(i)}</Text>}
        </Tap>
      ))}
    </View>
  );
}

/** 名前 → ワード の一覧 */
export function WordList({ members, words, skip, fg, big, compact }: { members: Member[]; words: string[]; skip?: number; fg: string; /** 大きめ（覚える画面用） */ big?: boolean; /** 人数が多い時の2列（長押ししたまま全部見えるように） */ compact?: boolean }) {
  if (compact) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {members.map((m, j) =>
          j === skip ? null : (
            <View key={j} style={[s.wordCell, { borderLeftColor: colorOf(j), backgroundColor: alpha(fg.length === 7 ? fg : '#141210', 0.07) }]}>
              <Text style={[s.wordName, { color: fg, fontSize: 12 }]} numberOfLines={1}>{m.name}</Text>
              <Text style={[s.word, { color: fg, fontSize: 18 }]} numberOfLines={2}>{words[j]}</Text>
            </View>
          ),
        )}
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {members.map((m, j) =>
        j === skip ? null : (
          <View key={j} style={[s.wordRow, big && { paddingVertical: 18 }, { borderLeftColor: colorOf(j), backgroundColor: alpha(fg.length === 7 ? fg : '#141210', 0.07) }]}>
            <Text style={[s.wordName, { color: fg }]} numberOfLines={1}>{m.name}</Text>
            <Text style={[s.word, big && { fontSize: 30 }, { color: fg, flexShrink: 1, textAlign: 'right' }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5}>{words[j]}</Text>
          </View>
        ),
      )}
    </View>
  );
}

/** 長押ししてる間だけ中身が見える目隠し（スマホを渡して1人だけ見る画面用） */
export function Peek({ fg, children }: { fg: string; children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  const v = useRef(new Animated.Value(0)).current;
  const press = (x: boolean) => {
    setOn(x);
    if (x) {
      play('flip');
      Haptics.selectionAsync().catch(() => {});
      v.setValue(0);
      Animated.spring(v, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
    }
  };
  const line = alpha(fg.length === 7 ? fg : '#141210', 0.35);
  return (
    <Pressable onPressIn={() => press(true)} onPressOut={() => press(false)} accessibilityRole="button" accessibilityLabel="長押しで見る" style={s.peek}>
      <Animated.View style={{ alignSelf: 'stretch', opacity: on ? 1 : 0, transform: [{ perspective: 800 }, { rotateX: v.interpolate({ inputRange: [0, 1], outputRange: ['-70deg', '0deg'] }) }] }}>{children}</Animated.View>
      {!on && (
        <View style={[StyleSheet.absoluteFill, s.peekCover, { borderColor: line, backgroundColor: alpha(fg.length === 7 ? fg : '#141210', 0.06) }]}>
          <Icon name="eye" color={fg} size={30} />
          <Text style={[s.peekText, { color: fg }]}>長押しで見る</Text>
          <Text style={[s.peekSub, { color: fg }]}>指を離したら隠れる</Text>
        </View>
      )}
    </Pressable>
  );
}

/** 枠だけのボタン（2番目に大事な操作） */
export function Outline({ label, fg, onPress, style }: { label: string; fg: string; onPress: () => void; style?: object }) {
  return (
    <Tap onPress={onPress} style={({ pressed }) => [s.outline, { borderColor: alpha(fg.length === 7 ? fg : '#f7f3ea', 0.35), opacity: pressed ? 0.7 : 1 }, style]}>
      <Text style={[s.outlineText, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
    </Tap>
  );
}

export const ms = StyleSheet.create({
  display: { fontFamily: F.display },
});

const s = StyleSheet.create({
  card: { flex: 1, borderRadius: 22, borderWidth: 2, padding: 20, gap: 12, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  prog: { fontSize: 13, fontWeight: '900', letterSpacing: 1, opacity: 0.65, textAlign: 'center' },
  note: { fontSize: 13, fontWeight: '700', opacity: 0.7, lineHeight: 20, textAlign: 'center' },
  lead: { fontFamily: F.display, fontSize: 26, lineHeight: 36, textAlign: 'center' },
  handDot: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  handDotText: { fontFamily: F.display, fontSize: 32, color: '#141210' },
  handName: { fontFamily: F.display, fontSize: 40, maxWidth: '100%' },
  handSub: { fontSize: 18, fontWeight: '900' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { minHeight: 60, borderRadius: 14, borderWidth: 2, paddingLeft: 16, paddingRight: 10, paddingVertical: 8, justifyContent: 'center', overflow: 'hidden' },
  tileBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 7 },
  tileName: { fontSize: 16, fontWeight: '900' },
  tileCount: { fontSize: 10, fontWeight: '900', opacity: 0.7, alignSelf: 'flex-end' },
  wordCell: { width: '48.5%', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, borderLeftWidth: 5 },
  peek: { alignSelf: 'stretch', minHeight: 120, justifyContent: 'center', alignItems: 'center' },
  peekCover: { borderRadius: 18, borderWidth: 2.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  peekText: { fontFamily: F.display, fontSize: 22 },
  peekSub: { fontSize: 12, fontWeight: '900', opacity: 0.6 },
  wordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderLeftWidth: 6 },
  wordName: { fontWeight: '900', fontSize: 15, flexShrink: 1 },
  word: { fontFamily: F.display, fontSize: 22 },
  introTitle: { fontFamily: F.display, fontSize: 22 },
  introTag: { fontSize: 11, fontWeight: '900', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  howRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  howIc: { width: 30, height: 27, alignItems: 'center', justifyContent: 'center' },
  howText: { flex: 1, fontSize: 18, lineHeight: 27, fontWeight: '700' },
  howBold: { fontWeight: '900' },
  lvBox: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
  lvText: { fontSize: 14, fontWeight: '900' },
  lvNote: { fontSize: 12, fontWeight: '700', opacity: 0.75 },
  roul: { borderWidth: 2, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', gap: 4 },
  roulDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  roulDotText: { fontFamily: F.display, fontSize: 20, color: '#141210' },
  roulName: { fontSize: 13, fontWeight: '900' },
  outline: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' },
  outlineText: { fontWeight: '900', fontSize: 14 },
});
