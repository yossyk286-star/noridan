import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tap } from './Tap';
import { F, alpha, colorOf } from '../theme';
import type { STAGE } from '../theme';
import type { Level, Member } from '../types';

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

/** 大きい丸と名前（「〇〇だけ見て」など、スマホを渡す時の画面） */
export function HandWho({ members, i, sub, fg }: { members: Member[]; i: number; sub?: string; fg: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <View style={[s.handDot, { backgroundColor: colorOf(i) }]}>
        <Text style={s.handDotText}>{members[i].name.slice(0, 1)}</Text>
      </View>
      <Text style={[s.handName, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit>{members[i].name}</Text>
      {!!sub && <Text style={[s.handSub, { color: fg }]}>{sub}</Text>}
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
export function WordList({ members, words, skip, fg, big }: { members: Member[]; words: string[]; skip?: number; fg: string; /** 大きめ（覚える画面用） */ big?: boolean }) {
  return (
    <View style={{ gap: 8 }}>
      {members.map((m, j) =>
        j === skip ? null : (
          <View key={j} style={[s.wordRow, big && { paddingVertical: 18 }, { borderLeftColor: colorOf(j), backgroundColor: alpha(fg.length === 7 ? fg : '#141210', 0.07) }]}>
            <Text style={[s.wordName, { color: fg }]} numberOfLines={1}>{m.name}</Text>
            <Text style={[s.word, big && { fontSize: 30 }, { color: fg }]}>{words[j]}</Text>
          </View>
        ),
      )}
    </View>
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
  wordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderLeftWidth: 6 },
  wordName: { fontWeight: '900', fontSize: 15, flexShrink: 1 },
  word: { fontFamily: F.display, fontSize: 22 },
  outline: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' },
  outlineText: { fontWeight: '900', fontSize: 14 },
});
