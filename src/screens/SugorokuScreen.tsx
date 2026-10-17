import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import type { Stats } from '../lib/titles';
import { BombBanner, Coach, Who, Controls, RuleSheet, RulesSheet, SwipeCard, canVerdict, DeckStack, Frame, GachaCard, OdaiCard, RuleBanner, ScoreBar } from '../components/Stage';
import GameMenu from '../components/GameMenu';
import { Board, COLS, Die, ROWS, Ranks, type Callout } from '../components/Board';
import { Flash } from '../components/Fx';
import { BOARD, Decks, GOAL, fill, makeCard, nameSeg, othersOf, pick, usable } from '../lib/game';
import { useTurnFlow } from '../lib/useTurnFlow';
import { useStageCues } from '../lib/useStageCues';
import { play } from '../lib/sound';
import { LEVEL_LABEL, STAGE, colorOf, C, NEON_BG, neonPal } from '../theme';
import type { Night, Card, Level, Member, Rule, GachaItem } from '../types';

type Props = {
  members: Member[];
  level: Level;
  night: Night;
  onQuit: () => void;
  onSettings: () => void;
  /** 画面の外側（ノッチ部分）の色を合わせる */
  onBg?: (bg: string | null) => void;
  onFinish: (pen: number[], turns: number, stats: Stats) => void;
};


export default function SugorokuScreen({ members, level, night, onQuit, onSettings, onBg, onFinish }: Props) {
  useKeepAwake(); // ゲーム中は画面を消さない
  const basePal = STAGE[level];
  const decks = useRef(new Decks()).current;
  decks.night = night; // 夜・深夜は罰ガチャも過激に
  decks.level = level;
  const n = members.length;

  const [cur, setCur] = useState(0);
  const [turn, setTurn] = useState(0);
  const [pos, setPos] = useState<number[]>(() => Array(n).fill(0));
  /** 画面に出してるコマの位置（1マスずつ追いかける） */
  const [vpos, setVpos] = useState<number[]>(() => Array(n).fill(0));
  const [hopping, setHopping] = useState(false);
  const [callout, setCallout] = useState<Callout>(null);
  const [skip, setSkip] = useState<boolean[]>(() => Array(n).fill(false));
  /** 「違反者に罰」を押したルール */
  const [rule, setRule] = useState<Rule | null>(null);
  const [die, setDie] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [rolled, setRolled] = useState(false);
  const [done, setDone] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  /** ルール違反のシート（誰を選ぶか → 罰ガチャの結果） */
  const [ruleSheet, setRuleSheet] = useState<'pick' | GachaItem | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });

  const flow = useTurnFlow(members, decks, () => {
    if (done) {
      onFinish(flow.st.pen.slice(), turn, flow.st.stats);
      return;
    }
    const nc = (cur + 1) % n;
    flow.tickRules(nc);
    setCur(nc);
    setRolled(false);
    setDie(null);
    flow.show({ kind: 'すごろく', segments: nameSeg(members[nc].name, 'の番。サイコロ振れ！', nc) }, nc);
  });

  useEffect(() => {
    flow.show({ kind: 'すごろく', segments: nameSeg(members[0].name, 'からスタート。サイコロ振れ！', 0) }, 0);
  }, []);

  /** 止まったマスの処理 */
  const resolve = (me: number, positions: number[]) => {
    const p = positions.slice();
    const c = BOARD[p[me]];
    const head = `${p[me]}マス目`;
    const plain = (label: string, text: string): Card => ({ kind: `${head}・${label}`, segments: fill(text, members, me) });
    let finished = false;

    switch (c.type) {
      case 'goal':
        finished = true;
        flow.show({ kind: 'GOAL', segments: nameSeg(members[me].name, 'がゴール！最後に罰が一番多い奴は誰や', me) }, me);
        break;
      case 'odai': {
        const o = decks.odai(level, members, me, night);
        flow.present({ ...o, kind: `${head}・${o.kind}` }, me, true);
        break;
      }
      case 'event': {
        const e = decks.event(members, me);
        const ec = { ...e.card, kind: `${head}・${e.card.kind}` };
        if (e.rule) flow.addRule({ ...e.rule, card: ec });
        flow.show(ec, me);
        break;
      }
      case 'move': {
        p[me] = Math.max(0, Math.min(GOAL, p[me] + c.value));
        const card = plain(c.label, c.text);
        if (p[me] === GOAL) {
          finished = true;
          card.segments.push({ text: '　そのままゴール！' });
        }
        flow.show(card, me);
        break;
      }
      case 'skip':
        setSkip((s) => s.map((v, i) => (i === me ? true : v)));
        flow.show(plain(c.label, c.text), me);
        break;
      case 'swap': {
        const x = pick(othersOf(members, me));
        [p[me], p[x]] = [p[x], p[me]];
        const [before, after] = (c as { text: string }).text.split('{X}');
        flow.show({ kind: `${head}・${c.label}`, segments: [{ text: before }, { text: members[x].name, hl: true, who: x }, { text: after ?? '' }] }, me);
        break;
      }
      default: {
        const text = 'text' in c ? c.text : '';
        if (!usable(text, members.length)) {
          // 2人やと成立せんマス（指差しとか）は普通のお題に差し替え
          const o = decks.odai(level, members, me, night);
          flow.present({ ...o, kind: `${head}・${o.kind}` }, me, true);
        } else flow.show(makeCard(`${head}・${'label' in c ? c.label : ''}`, text, members, me), me);
      }
    }
    setPos(p);
    setDone(finished);
    if (finished) flow.stopPlanting();
    return p;
  };

  /** コマを1マスずつ動かす */
  const hop = (me: number, from: number, target: number, done: () => void) => {
    let at = from;
    const step = () => {
      if (at === target) {
        done();
        return;
      }
      at += target > at ? 1 : -1;
      const now = at;
      setVpos((v) => v.map((q, i) => (i === me ? now : q)));
      play('tick');
      setTimeout(step, 260);
    };
    setTimeout(step, 200);
  };

  const roll = () => {
    if (rolling || rolled || hopping) return;
    if (skip[cur]) {
      setSkip((s) => s.map((v, i) => (i === cur ? false : v)));
      setRolled(true);
      flow.show({ kind: '1回休み', segments: nameSeg(members[cur].name, 'は休み。おとなしく見とけ', cur) }, cur);
      return;
    }
    setRolling(true);
    let k = 0;
    const t = setInterval(() => {
      const v = 1 + Math.floor(Math.random() * 6);
      setDie(v);
      play('tick');
      if (++k >= 10) {
        clearInterval(t);
        setRolling(false);
        setHopping(true);
        setTurn((x) => x + 1);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        const me = cur;
        const start = pos[me];
        const target = Math.min(GOAL, start + v);
        hop(me, start, target, () => {
          const p = pos.slice();
          p[me] = target;
          const after = resolve(me, p); // 進む・戻る・入れ替えで変わることがある
          const finish = () => {
            setHopping(false);
            setRolled(true);
          };
          const c = BOARD[target];
          if (after[me] !== target || c.type === 'swap') {
            // マイナス・プラス・入れ替えは、いったん止まって吹き出しを出してから動く
            const diff = after[me] - target;
            const swap = c.type === 'swap';
            setCallout({
              text: swap ? '入れ替え！' : diff > 0 ? `+${diff}マス進む！` : `${diff}マス戻る…`,
              at: target,
              kind: swap ? 'swap' : diff > 0 ? 'plus' : 'minus',
              key: Date.now(),
            });
            play(diff < 0 ? 'warn' : 'coin');
            Haptics.notificationAsync(diff < 0 ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success).catch(() => {});
            setTimeout(() => {
              setCallout(null);
              if (swap || Math.abs(diff) > 6) {
                setVpos(after.slice()); // 入れ替えはワープ
                setTimeout(finish, 450);
              } else hop(me, target, after[me], finish);
            }, 1200);
          } else setTimeout(finish, 350);
        });
      }
    }, 75);
  };

  const flash = useStageCues(flow, !rolled && !hopping);

  // お題札が下からせり上がる
  const showSheet = rolled && !hopping;
  const sheetY = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    sheetY.setValue(showSheet ? 1 : 0);
    if (showSheet) Animated.spring(sheetY, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }).start();
  }, [showSheet, flow.st.card]);

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
  const label = rolling ? 'コロコロ…' : hopping ? `${die}マス進む！` : skip[cur] ? '1回休み（タップで確認）' : 'タップで振る';
  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      {/* 1画面に固定（スクロールしない）。盤は残りの高さに収まるサイズにする */}
      <View style={[s.wrap, flipped && s.flipped]}>
        <ScoreBar pal={pal} members={members} pen={st.pen} rev={st.rev} doer={st.doer} onMenu={() => setMenu(true)} />
        {!st.phase.startsWith('bomb') && <BombBanner pal={pal} members={members} bomb={st.bomb} />}
        {/* ルールが出た札そのものを見てる間は、上の枠は出さへん（同じ文が2回並ぶので） */}
        <RuleBanner pal={pal} members={members} rules={st.rules} hideCard={st.phase === 'play' ? st.card : null} onViolate={(r) => { setRule(r); setRuleSheet('pick'); }} />
        <View style={s.boardArea} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {area.w > 0 && (
            <View style={{ width: area.w }}>
              {/* 横幅いっぱい、縦は残りの高さまで伸ばす（伸ばしすぎない） */}
              <Board pal={pal} members={members} vpos={vpos} cur={cur} callout={callout} height={Math.min(area.h, ((area.w * ROWS) / COLS) * 1.5)} />
            </View>
          )}
        </View>
        <Ranks pal={pal} members={members} vpos={vpos} skip={skip} cur={cur} />
        <View style={s.dock}>
          <Die value={die} rolling={rolling} disabled={rolling || rolled || hopping} onPress={roll} />
          <View style={{ flex: 1, gap: 4 }}>
            <Who name={members[cur].name} color={colorOf(cur)} label="の番" fg={pal.fg} />
            <Text style={[s.dockText, { color: pal.fg }]}>{label}</Text>
          </View>
        </View>
      </View>

      {showSheet && (
        <>
          <View style={s.sheetBack} />
          <Animated.View
            style={[
              s.sheet,
              { backgroundColor: pal.bg, borderColor: colorOf(st.doer) },
              flipped ? s.sheetTop : s.sheetBottom,
              { transform: [{ translateY: sheetY.interpolate({ inputRange: [0, 1], outputRange: [0, flipped ? -600 : 600] }) }, ...(flipped ? [{ rotate: '180deg' }] : [])] },
            ]}
          >
            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <DeckStack pal={pal} minHeight={230}>
                {st.phase === 'batsu' ? (
                  <GachaCard pal={pal} members={members} items={st.gacha} />
                ) : (
                  <SwipeCard enabled={canVerdict(flow)} flipped={flipped} onSwipe={(d) => (d > 0 ? flow.clear() : flow.fail())}>
                    <OdaiCard pal={pal} card={st.card} doubled={st.double && st.phase === 'play'} art={art} underline={level === 'jigoku'} small who={who} />
                  </SwipeCard>
                )}
              </DeckStack>
              <Coach flow={flow} />
              <Controls
                pal={pal}
                members={members}
                flow={flow}
                nextLabel={done ? '結果発表へ' : '次の人へ'}
                next={done ? null : (cur + 1) % n}
              />
            </ScrollView>
          </Animated.View>
        </>
      )}

      <Frame color={colorOf(st.doer)} />
      <Flash trigger={flash} />
      <RuleSheet members={members} rule={rule} state={ruleSheet} onPick={(i) => setRuleSheet(flow.rulePenalty(i))} onClose={() => setRuleSheet(null)} />
      <RulesSheet visible={rules} night={!!night} onClose={() => setRules(false)} />
      <GameMenu
        visible={menu}
        meta={`すごろく・${LEVEL_LABEL[level]}・${turn}ターン`}
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
  boardArea: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  wrap: { flex: 1, padding: 16, paddingBottom: 16, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  flipped: { transform: [{ rotate: '180deg' }] },
  dock: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 'auto', paddingTop: 4 },
  dockText: { fontSize: 18, fontWeight: '900' },
  sheetBack: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, maxHeight: '88%', padding: 16, paddingBottom: 26, borderWidth: 4, maxWidth: 560, alignSelf: 'center', width: '100%',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: -8 }, elevation: 12,
  },
  sheetBottom: { bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomWidth: 0 },
  sheetTop: { top: 0, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderTopWidth: 0 },
});
