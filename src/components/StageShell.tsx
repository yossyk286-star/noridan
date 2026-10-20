import { useRef, useState } from 'react';
import type React from 'react';
import { StyleSheet, View } from 'react-native';
import { Frame, RulesSheet, ScoreBar } from './Stage';
import GameMenu from './GameMenu';
import { Decks } from '../lib/game';
import { play } from '../lib/sound';
import { newStats, type Stats, type Why } from '../lib/titles';
import type { Pal } from '../theme';
import type { GachaItem, Level, Member, Night } from '../types';

/**
 * 罰の数・罰ガチャ・称号の記録（新しい遊び方で共通）。
 * draw(losers, x) で罰ガチャを引いて、apply() で罰に足す（戻り値は新しい罰の数）
 */
export function usePenalty(members: Member[], level: Level, night: Night, why: Why) {
  const n = members.length;
  const decks = useRef(new Decks()).current;
  decks.night = night;
  decks.level = level;
  const [pen, setPen] = useState<number[]>(() => Array(n).fill(0));
  const [gacha, setGacha] = useState<GachaItem[]>([]);
  const stats = useRef<Stats>(newStats(n)).current;
  const draw = (losers: number[], x = 1) => {
    const items = losers.map((i) => ({ i, n: x, ...decks.batsu(members, i, x) }));
    setGacha(items);
    play(items.every((it) => it.lucky) ? 'gachaLucky' : 'gacha');
  };
  const apply = () => {
    const np = pen.slice();
    gacha.forEach((x) => {
      if (x.lucky) stats.lucky[x.i]++;
      else {
        np[x.i] += x.n;
        stats.why[x.i][why] = (stats.why[x.i][why] ?? 0) + x.n;
      }
    });
    setPen(np);
    setGacha([]);
    return np;
  };
  const lucky = gacha.length > 0 && gacha.every((x) => x.lucky);
  return { pen, gacha, stats, draw, apply, lucky, decks };
}

/** 画面の外まわり（上のバー・フチ・メニュー・ルール） */
export function StageShell({
  pal, members, pen, doer, frame, rules, meta, onEnd, onQuit, onSettings, card, controls,
}: {
  pal: Pal; members: Member[]; pen: number[]; doer: number; frame: string; rules: [string, string][]; meta: string;
  onEnd: () => void; onQuit: () => void; onSettings: () => void; card: React.ReactNode; controls: React.ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [flipped, setFlipped] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <View style={[s.wrap, flipped && { transform: [{ rotate: '180deg' }] }]}>
        <ScoreBar pal={pal} members={members} pen={pen} rev={Array(members.length).fill(false)} doer={doer} onMenu={() => setMenu(true)} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
        <View style={{ flex: 1 }}>{card}</View>
        {controls}
      </View>
      <Frame color={frame} />
      <RulesSheet visible={showRules} custom={rules} onClose={() => setShowRules(false)} />
      <GameMenu
        visible={menu}
        meta={meta}
        rulesSub="このモードの遊び方"
        onRules={() => setShowRules(true)}
        onEnd={onEnd}
        onSettings={onSettings}
        onQuit={onQuit}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
});
