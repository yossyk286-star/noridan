import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import type { Stats } from '../lib/titles';
import { BombBanner, Coach, Controls, RuleSheet, RulesSheet, SwipeCard, canVerdict, DeckStack, Frame, GachaCard, OdaiCard, RuleBanner, ScoreBar, BigButton } from '../components/Stage';
import GameMenu from '../components/GameMenu';
import { IntroCard, LevelBox } from '../components/ModeParts';
import { HELP } from '../lib/help';
import { Flash } from '../components/Fx';
import { CHANCE, Decks } from '../lib/game';
import { useTurnFlow } from '../lib/useTurnFlow';
import { useStageCues } from '../lib/useStageCues';
import { LEVEL_LABEL, STAGE, colorOf, C, NEON_BG, neonPal } from '../theme';
import type { Night, Level, Member, Rule, GachaItem } from '../types';

type Props = {
  members: Member[];
  level: Level;
  night: Night;
  onQuit: () => void;
  onSettings: () => void;
  /** 画面の外側（ノッチ部分）の色を合わせる */
  onBg?: (bg: string | null) => void;
  onFinish: (pen: number[], turns: number, stats: Stats) => void;
  /** 「もう一回」の時は始める前の説明を出さへん */
  skipIntro?: boolean;
};

export default function OdaiScreen({ members, level, night, onQuit, onSettings, onBg, onFinish, skipIntro }: Props) {
  useKeepAwake(); // ゲーム中は画面を消さない
  const basePal = STAGE[level];
  const decks = useRef(new Decks()).current;
  decks.night = night; // 夜・深夜は罰ガチャも過激に
  decks.level = level;
  const [cur, setCur] = useState(0);
  const [turn, setTurn] = useState(1);
  /** 「違反者に罰」を押したルール */
  const [rule, setRule] = useState<Rule | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  const [intro, setIntro] = useState(!skipIntro);
  /** ルール違反のシート（誰を選ぶか → 罰ガチャの結果） */
  const [ruleSheet, setRuleSheet] = useState<'pick' | GachaItem | null>(null);

  /** ターン開始：たまに割り込み、たまにダブルアップ */
  const startTurn = (who: number, t: number) => {
    flow.st.cur = who;
    if (t > 2 && Math.random() < CHANCE.event) {
      const ev = decks.event(members, who);
      if (ev.rule) flow.addRule(ev.rule);
      flow.show(ev.card, who);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else {
      flow.present(decks.odai(level, members, who, night), who, t > 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const flow = useTurnFlow(members, decks, () => {
    const nc = (cur + 1) % members.length;
    flow.tickRules(nc);
    setCur(nc);
    setTurn(turn + 1);
    startTurn(nc, turn + 1);
  });

  useEffect(() => {
    if (!intro) startTurn(0, 1);
  }, [intro]);

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
  // 始める前の説明（「もう一回」の時は出さへん）
  if (intro)
    return (
      <View style={{ flex: 1, backgroundColor: basePal.bg }}>
        <View style={s.wrap}>
          <ScoreBar pal={basePal} members={members} pen={Array(members.length).fill(0)} rev={Array(members.length).fill(false)} doer={-1} onMenu={() => setMenu(true)} />
          <View style={{ flex: 1 }}>
            <IntroCard pal={basePal} mode="odai" tag={`${members.length}人`}>
              <LevelBox pal={basePal} text={`地獄度は「${LEVEL_LABEL[level]}」`} note={night ? `${night === 'shinya' ? '深夜' : '夜'}モードのお題も出る` : undefined} />
            </IntroCard>
          </View>
          <BigButton pal={basePal} label={`${members[0].name}からスタート`} onPress={() => setIntro(false)} />
        </View>
        <Frame color={C.muted} />
        <GameMenu visible={menu} meta={'アホお題・' + LEVEL_LABEL[level]} rulesSub="アホお題の遊び方" flipped={false} onFlip={() => {}} onRules={() => setRules(true)} onEnd={onQuit} onSettings={onSettings} onQuit={onQuit} onClose={() => setMenu(false)} />
        <RulesSheet visible={rules} night={!!night} custom={HELP.odai.rules} onClose={() => setRules(false)} />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      {/* 1画面に固定（スクロールしない） */}
      <View style={[s.wrap, flipped && s.flipped]}>
        <ScoreBar pal={pal} members={members} pen={st.pen} rev={st.rev} doer={st.doer} onMenu={() => setMenu(true)} />
        {!st.phase.startsWith('bomb') && <BombBanner pal={pal} members={members} bomb={st.bomb} />}
        {/* ルールが出た札そのものを見てる間は、上の枠は出さへん（同じ文が2回並ぶので） */}
        <RuleBanner pal={pal} members={members} rules={st.rules} hideCard={st.phase === 'play' ? st.card : null} onViolate={(r) => { setRule(r); setRuleSheet('pick'); }} />
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
        <Controls pal={pal} members={members} flow={flow} nextLabel="次へ" next={(cur + 1) % members.length} />
      </View>
      <Frame color={colorOf(st.doer)} />
      <Flash trigger={flash} />
      <RuleSheet members={members} rule={rule} state={ruleSheet} onPick={(i) => setRuleSheet(flow.rulePenalty(i))} onClose={() => setRuleSheet(null)} />
      <RulesSheet visible={rules} night={!!night} custom={HELP.odai.rules} onClose={() => setRules(false)} />
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
