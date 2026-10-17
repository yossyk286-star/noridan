import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import type { Stats } from '../lib/titles';
import { BombBanner, Coach, Controls, RuleSheet, RulesSheet, SwipeCard, canVerdict, DeckStack, Frame, GachaCard, OdaiCard, RuleBanner, ScoreBar, shakeAction } from '../components/Stage';
import GameMenu from '../components/GameMenu';
import { Flash } from '../components/Fx';
import { CHANCE, Decks } from '../lib/game';
import { useTurnFlow } from '../lib/useTurnFlow';
import { useShake } from '../lib/useShake';
import { useStageCues } from '../lib/useStageCues';
import { LEVEL_LABEL, STAGE, colorOf, C, NEON_BG, neonPal } from '../theme';
import type { Night, Level, Member, Rule, GachaItem } from '../types';

type Props = {
  members: Member[];
  level: Level;
  shake: boolean;
  night: Night;
  onQuit: () => void;
  onSettings: () => void;
  /** 画面の外側（ノッチ部分）の色を合わせる */
  onBg?: (bg: string | null) => void;
  onFinish: (pen: number[], turns: number, stats: Stats) => void;
};

export default function OdaiScreen({ members, level, shake, night, onQuit, onSettings, onBg, onFinish }: Props) {
  useKeepAwake(); // ゲーム中は画面を消さない
  const basePal = STAGE[level];
  const decks = useRef(new Decks()).current;
  decks.night = night; // 夜・深夜は罰ガチャも過激に
  const [cur, setCur] = useState(0);
  const [turn, setTurn] = useState(1);
  const [rule, setRule] = useState<Rule | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  /** ルール違反のシート（誰を選ぶか → 罰ガチャの結果） */
  const [ruleSheet, setRuleSheet] = useState<'pick' | GachaItem | null>(null);

  /** ターン開始：たまに割り込み、たまにダブルアップ */
  const startTurn = (who: number, t: number) => {
    if (t > 2 && Math.random() < CHANCE.event) {
      const ev = decks.event(members, who);
      if (ev.rule) setRule(ev.rule);
      flow.show(ev.card, who);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else {
      flow.present(decks.odai(level, members, who, night), who, t > 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const flow = useTurnFlow(members, decks, () => {
    setRule((r) => (r && r.left > 1 ? { ...r, left: r.left - 1 } : null));
    const nc = (cur + 1) % members.length;
    setCur(nc);
    setTurn(turn + 1);
    startTurn(nc, turn + 1);
  });

  useEffect(() => startTurn(0, 1), []);

  const shakeOn = useShake(shake, () => shakeAction(flow)?.());
  const flash = useStageCues(flow);

  const { st } = flow;
  // 誰の番か（札の上に1行で出す）
  const who = {
    name: members[st.doer].name,
    color: colorOf(st.doer),
    label: st.card.bomb ? 'が仕掛け人' : st.card.passed ? 'に回ってきた' : st.doer !== cur ? 'に押し付けられた' : 'の番',
  };
  // 夜お題の間だけ照明が落ちてネオン看板に
  const neon = !!st.card.yoru && st.phase !== 'batsu';
  const pal = neon ? neonPal(st.card.kind.includes('深夜') ? C.deep : C.night) : basePal;
  useEffect(() => onBg?.(neon ? NEON_BG : null), [neon]);
  const art = st.phase === 'bombSet' || st.phase === 'bombPeek' ? 'bomb' : st.phase === 'offer' ? 'coin' : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      {/* 1画面に固定（スクロールしない） */}
      <View style={[s.wrap, flipped && s.flipped]}>
        <ScoreBar pal={pal} members={members} pen={st.pen} rev={st.rev} doer={st.doer} onMenu={() => setMenu(true)} />
        {!st.phase.startsWith('bomb') && <BombBanner pal={pal} members={members} bomb={st.bomb} />}
        {/* ルールが出た札そのものを見てる間は、上の枠は出さへん（同じ文が2回並ぶので） */}
        <RuleBanner pal={pal} rule={st.card.ruleCard && st.phase === 'play' ? null : rule} onViolate={() => setRuleSheet('pick')} />
        <DeckStack pal={pal} minHeight={0}>
          {st.phase === 'batsu' ? (
            <GachaCard pal={pal} members={members} items={st.gacha} />
          ) : (
            <SwipeCard enabled={canVerdict(flow)} flipped={flipped} onSwipe={(d) => (d > 0 ? flow.clear() : flow.fail())}>
              <OdaiCard
                pal={pal}
                card={st.card}
                no={st.cards + 1}
                doubled={st.double && st.phase === 'play'}
                art={art}
                underline={level === 'jigoku'}
                who={who}
              />
            </SwipeCard>
          )}
        </DeckStack>
        <Coach flow={flow} />
        <Controls pal={pal} members={members} flow={flow} nextLabel="次へ" shakeHint={shakeOn} next={(cur + 1) % members.length} />
      </View>
      <Frame color={colorOf(st.doer)} />
      <Flash trigger={flash} />
      <RuleSheet members={members} rule={rule} state={ruleSheet} onPick={(i) => setRuleSheet(flow.rulePenalty(i))} onClose={() => setRuleSheet(null)} />
      <RulesSheet visible={rules} night={!!night} onClose={() => setRules(false)} />
      <GameMenu
        visible={menu}
        meta={`アホお題・${LEVEL_LABEL[level]}・${turn}ターン`}
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
        onRules={() => setRules(true)}
        onEnd={() => onFinish(flow.finalPen(), turn, flow.st.stats)}
        onSettings={onSettings}
        onQuit={onQuit}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, paddingBottom: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  flipped: { transform: [{ rotate: '180deg' }] },
});
