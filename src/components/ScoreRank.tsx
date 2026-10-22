import type React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RevealItem, type useReveal } from './Reveal';
import { F } from '../theme';
import type { Member } from '../types';

/** 点数の順位表（クイズ・テンション伝言）。1行ずつ出して、最下位でドカン。タップで飛ばす */
export function ScoreRank({ members, score, losers, rv, fg, title, foot }: { members: Member[]; score: number[]; losers: number[]; rv: ReturnType<typeof useReveal>; fg: string; title: string; foot: string }) {
  const idx = members.map((_, i) => i).sort((a, b) => score[b] - score[a]);
  return (
    <Pressable style={{ flex: 1, width: '100%' }} onPress={rv.skip}>
      <Text style={[s.title, { color: fg }]}>{title}</Text>
      <ScrollView contentContainerStyle={{ gap: 6 }}>
        {idx.map((i, k) => {
          const bad = losers.includes(i);
          const row: React.ReactNode = (
            <View style={s.row}>
              <Text style={[s.rk, { color: fg }]}>{k + 1}</Text>
              <Text style={[s.nm, { color: bad ? '#ff3b3b' : fg }]} numberOfLines={1}>{members[i].name}</Text>
              <Text style={[s.v, { color: bad ? '#ff3b3b' : fg }]}>{score[i]}点</Text>
            </View>
          );
          return <RevealItem key={i} k={k} rv={rv} lose={bad}>{row}</RevealItem>;
        })}
      </ScrollView>
      {rv.ready && <Text style={[s.foot, { color: fg }]}>{foot}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 13, fontWeight: '800', opacity: 0.7, textAlign: 'center', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10 },
  rk: { width: 22, fontSize: 15, fontWeight: '900' },
  nm: { flex: 1, fontSize: 17, fontWeight: '900' },
  v: { fontFamily: F.display, fontSize: 20 },
  foot: { fontFamily: F.display, fontSize: 22, lineHeight: 30, textAlign: 'center', marginTop: 8 },
});
