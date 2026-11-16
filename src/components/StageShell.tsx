import { useRef, useState } from 'react';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Frame, PickCard, RulesSheet, ScoreBar } from './Stage';
import GameMenu from './GameMenu';
import { Decks, type BatsuPick } from '../lib/game';
import { newStats, type Stats, type Why } from '../lib/titles';
import type { Pal } from '../theme';
import type { GachaItem, Level, Member, Night } from '../types';
import { batsuCue } from '../lib/fx';

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
  const [pick, setPick] = useState<BatsuPick | null>(null);
  const stats = useRef<Stats>(newStats(n)).current;
  /** x は全員同じ数か、人ごとの数（i => 数）。winner は1位（1人に決まってたら、罰を2つから選ばせる） */
  const draw = (losers: number[], x: number | ((i: number) => number) = 1, winner = -1) => {
    const cnt = (i: number) => (typeof x === 'number' ? x : x(i));
    const r = decks.gachaOrPick(members, losers, cnt, winner);
    if ('pick' in r) { setPick(r.pick); setGacha([]); return; }
    setGacha(r.items);
    batsuCue(r.items, members);
  };
  /** 1位が選んだ罰を罰ガチャにする */
  const choose = (k: number) => {
    if (!pick) return;
    const items = pick.opts[k];
    setPick(null);
    setGacha(items);
    batsuCue(items, members);
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
  return { pen, gacha, stats, draw, apply, lucky, decks, pick, choose };
}

/** 1位の特権の画面（選んでる間は「もう1回戦」とかのボタンを出さへん）。選ぶものが無ければ null */
export function pickView(pal: Pal, members: Member[], pick: BatsuPick | null, onPick: (k: number) => void) {
  if (!pick) return null;
  return {
    card: <View style={{ flex: 1 }}><PickCard pal={pal} members={members} pick={pick} onPick={onPick} /></View>,
    controls: <Text style={[s.pickHint, { color: pal.muted }]}>選んだ方が罰になる</Text>,
  };
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
        <ScoreBar onEnd={onEnd} pal={pal} members={members} pen={pen} rev={Array(members.length).fill(false)} doer={doer} onMenu={() => setMenu(true)} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
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
  pickHint: { textAlign: 'center', fontSize: 13, fontWeight: '700', paddingVertical: 14 },
});
