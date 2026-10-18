import { useEffect, useRef, useState } from 'react';
import { Tap } from './Tap';
import type React from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { iniFit, initialOf, isSituational, mustPick, needsPick, othersOf, penHead } from '../lib/game';
import type { TurnFlow } from '../lib/useTurnFlow';
import { usePrefs } from '../lib/prefs';
import { useSeen } from '../lib/coach';
import { CARD_LOOK, F, STAGE, alpha, colorOf } from '../theme';
import type { Bomb, Card, GachaItem, Level, Member, Rule, Segment } from '../types';
import { Angel, BombArt, Capsule, Coin, Fuse, Skull } from './Fx';
import { Icon } from './Icon';
import { HELP } from '../lib/help';

type Pal = (typeof STAGE)[Level];

/** お題の文章。名前はその人の色でマーカーを引く */
export function SegText({ segments, style, underline, fit }: { segments: Segment[]; style?: object; underline?: boolean; /** 札からはみ出す時は自動で縮める */ fit?: boolean }) {
  return (
    <Text style={style} lineBreakStrategyIOS="standard" {...(fit ? { adjustsFontSizeToFit: true, numberOfLines: 9, minimumFontScale: 0.45 } : null)}>
      {segments.map((s, i) => {
        if (!s.hl) return <Text key={i}>{s.text}</Text>;
        const col = s.who !== undefined ? colorOf(s.who) : '#ffd23f';
        return (
          <Text
            key={i}
            style={underline ? { textDecorationLine: 'underline', textDecorationColor: col } : { backgroundColor: alpha(col, 0.55) }}
          >
            {s.text}
          </Text>
        );
      })}
    </Text>
  );
}

/** 画面のフチ。いまの番の人の色で光る */
export function Frame({ color }: { color: string }) {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frame, { borderColor: color, shadowColor: color }]} />;
}

/** 上のバー：左に罰スコアの顔アイコン列、右に「⋯」メニュー */
export function ScoreBar({
  pal, members, pen, rev, doer, onMenu, flipped, onFlip,
}: { pal: Pal; members: Member[]; pen: number[]; rev: boolean[]; doer: number; onMenu: () => void; flipped?: boolean; onFlip?: () => void }) {
  const { dual, setDual } = usePrefs();
  const { width } = useWindowDimensions();
  const [all, setAll] = useState(false);
  // 右のボタン（上下反転・向かい合わせ・⋯）をよけて、入る人数だけ顔を出す。入りきらん分は「…」にまとめる
  const btns = (onFlip ? 1 : 0) + 2;
  const fit = Math.max(2, Math.floor((Math.min(width, 560) - 32 - btns * 50 - 18) / 44));
  let shown = members.map((_, i) => i);
  if (members.length > fit) {
    shown = shown.slice(0, fit - 1);
    if (doer >= 0 && !shown.includes(doer)) shown[shown.length - 1] = doer; // 今の番の人は必ず見せる
  }
  const hidden = members.length - shown.length;
  const ranking = members.map((m, i) => ({ m, i, n: pen[i] })).sort((a, b) => b.n - a.n);
  const quick = (on: boolean) => [styles.menuBtn, { backgroundColor: on ? pal.fg : pal.chip }];
  return (
    <View style={styles.bar}>
      <View style={[styles.score, { flex: 1, flexDirection: 'row', overflow: 'hidden' }]}>
        {shown.map((i) => (
          <View key={i} style={[styles.av, { backgroundColor: colorOf(i) }, i === doer && { borderWidth: 3, transform: [{ scale: 1.08 }] }]}>
            <Text style={[styles.avText, iniFit(initialOf(members, i))]}>{initialOf(members, i)}</Text>
            {pen[i] > 0 && (
              <View style={[styles.cnt, { borderColor: pal.bg }]}>
                <Text style={styles.cntText}>{pen[i]}</Text>
              </View>
            )}
            {rev[i] && (
              <View style={[styles.rvDot, { backgroundColor: pal.fg }]}>
                <Text style={[styles.rvText, { color: pal.bg }]}>↺</Text>
              </View>
            )}
          </View>
        ))}
        {hidden > 0 && (
          <Tap onPress={() => setAll(true)} accessibilityLabel="全員の罰を見る" style={[styles.av, { backgroundColor: pal.chip, borderColor: pal.muted }]}>
            <Text style={[styles.avText, { color: pal.fg }]}>…</Text>
            <View style={[styles.cnt, { borderColor: pal.bg, backgroundColor: pal.fg }]}>
              <Text style={[styles.cntText, { color: pal.bg }]}>{hidden}</Text>
            </View>
          </Tap>
        )}
      </View>
      {onFlip && (
        <Tap onPress={onFlip} accessibilityLabel="上下反転" accessibilityState={{ selected: !!flipped }} style={quick(!!flipped)}>
          <Icon name="flip" color={flipped ? pal.bg : pal.fg} size={19} />
        </Tap>
      )}
      <Tap onPress={() => setDual(!dual)} accessibilityLabel="向かい合わせ表示" accessibilityState={{ selected: dual }} style={quick(dual)}>
        <Icon name="split" color={dual ? pal.bg : pal.fg} size={19} />
      </Tap>
      <Tap onPress={onMenu} accessibilityLabel="メニュー" style={[styles.menuBtn, { backgroundColor: pal.chip }]}>
        <Icon name="more" color={pal.fg} size={20} />
      </Tap>
      <Modal visible={all} transparent animationType="slide" onRequestClose={() => setAll(false)}>
        <Pressable style={styles.sheetBack} onPress={() => setAll(false)}>
          <Pressable style={[styles.sheet, { maxHeight: '88%' }]} onPress={() => {}}>
            <ScrollView contentContainerStyle={{ gap: 8 }}>
              <Text style={styles.sheetTitle}>全員の罰</Text>
              {ranking.map((r, k) => (
                <View key={r.i} style={[styles.ruleItem, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                  <Text style={[styles.ruleItemHead, { width: 22 }]}>{k + 1}</Text>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colorOf(r.i) }} />
                  <Text style={[styles.ruleItemHead, { flex: 1 }]} numberOfLines={1}>{r.m.name}{r.i === doer ? '（いまの番）' : ''}</Text>
                  <Text style={styles.ruleItemHead}>{r.n}</Text>
                </View>
              ))}
              <Tap onPress={() => setAll(false)} style={styles.sheetGhost}>
                <Text style={styles.sheetGhostText}>閉じる</Text>
              </Tap>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** 次の番の予告 */
export function NextUp({ pal, name, color }: { pal: Pal; name: string; color: string }) {
  return (
    <View style={styles.nextUp}>
      <Text style={[styles.nextText, { color: pal.muted }]}>次の番</Text>
      <Icon name="next" size={14} color={pal.muted} />
      <View style={[styles.avSm, { backgroundColor: color }]}>
        <Text style={styles.avSmText}>{name.slice(0, 1)}</Text>
      </View>
      <Text style={[styles.nextText, { color: pal.muted }]}>{name}</Text>
    </View>
  );
}

/** 札の後ろに山札を重ねて見せる */
export function DeckStack({ pal, children, minHeight = 280 }: { pal: Pal; children: React.ReactNode; minHeight?: number }) {
  return (
    <View style={{ flex: 1, minHeight }}>
      <View style={[styles.stack, { backgroundColor: pal.cardBg, opacity: 0.32, transform: [{ rotate: '-1.8deg' }, { translateY: 8 }] }]} />
      <View style={[styles.stack, { backgroundColor: pal.cardBg, opacity: 0.55, transform: [{ rotate: '2.6deg' }, { translateY: 4 }] }]} />
      {children}
    </View>
  );
}

/** お題の長さで文字サイズを決める（短いほど大きく） */
export function fitSize(segments: Segment[], small = false, scale = 1) {
  const n = segments.reduce((a, s) => a + s.text.length, 0);
  const px = n <= 12 ? 44 : n <= 20 ? 38 : n <= 30 ? 33 : n <= 42 ? 28 : n <= 56 ? 25 : 22;
  const size = Math.round((small ? px * 0.88 : px) * scale);
  return { fontSize: size, lineHeight: Math.round(size * 1.4) };
}

/** 発動中のルール（新しい順に2つまで）。「違反者に罰」でいつでも罰をつけられる */
export function RuleBanner({ pal, rules, members, hideCard, onViolate }: { pal: Pal; rules: Rule[]; members: Member[]; /** 今見てる札が出したルールは出さない */ hideCard?: Card | null; onViolate?: (r: Rule) => void }) {
  const list = rules.filter((r) => !(r.card && hideCard && r.card === hideCard)).reverse();
  if (!list.length) return null;
  return (
    <View style={{ gap: 6 }}>
      {list.slice(0, 2).map((r, j) => (
        <View key={j} style={[styles.rule, { borderColor: pal.muted }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.ruleHead, { color: pal.fg }]}>
              {r.who != null ? `${members[r.who].name}の次の番まで` : `発動中 残り${r.left}ターン`}
              {j === 0 && list.length > 2 ? `　ほか${list.length - 2}件` : ''}
            </Text>
            <SegText segments={r.segments} style={[styles.ruleText, { color: pal.fg }]} />
          </View>
          {onViolate && (
            <Tap onPress={() => onViolate(r)} style={[styles.ruleOut, { borderWidth: 1.5, borderColor: '#ff7a7a' }]}>
              <Text style={[styles.ruleOutText, { color: '#ff7a7a' }]}>違反者に罰</Text>
            </Tap>
          )}
        </View>
      ))}
    </View>
  );
}

/** ルール違反のシート：誰が破ったか選ぶ → その場で罰ガチャ */
export function RuleSheet({
  members, rule, state, onPick, onClose,
}: { members: Member[]; rule: Rule | null; state: 'pick' | GachaItem | null; onPick: (i: number) => void; onClose: () => void }) {
  return (
    <Modal visible={!!state} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBack} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {state === 'pick' ? (
            <>
              <Text style={styles.sheetLabel}>ルール違反</Text>
              {rule && <SegText segments={rule.segments} style={styles.sheetRule} />}
              <Text style={styles.sheetTitle}>破ったのは誰？</Text>
              <View style={styles.sheetChips}>
                {members.map((m, i) => (
                  <Tap key={i} onPress={() => onPick(i)} style={styles.sheetChip}>
                    <View style={[styles.dot, { backgroundColor: colorOf(i) }]} />
                    <Text style={styles.sheetChipText}>{m.name}</Text>
                  </Tap>
                ))}
              </View>
              <Tap onPress={onClose} style={styles.sheetGhost}>
                <Text style={styles.sheetGhostText}>やっぱやめる</Text>
              </Tap>
            </>
          ) : state ? (
            <>
              <View style={{ alignItems: 'center', gap: 6 }}>
                {state.lucky ? <Angel /> : <Skull />}
                <Text style={[styles.sheetVerdict, state.lucky && { color: '#ffd23f' }]}>
                  {state.lucky ? '天使が出た！セーフ' : `${members[state.i].name}、ルール違反`}
                </Text>
              </View>
              <SegText segments={state.segments} style={styles.sheetPen} />
              <Tap onPress={onClose} style={styles.sheetBig}>
                <Text style={styles.sheetBigText}>{state.lucky ? 'ラッキー！' : '受け入れた'}</Text>
              </Tap>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** 時限爆弾が作動中の表示。中身とあと何ターンかは出さない。仕掛け人だけ「中身を見る」で見直せる */
export function BombBanner({ pal, members, bomb }: { pal: Pal; members: Member[]; bomb: Bomb | null }) {
  const [look, setLook] = useState(0);
  if (!bomb) return null;
  const nm = members[bomb.owner].name;
  const close = () => setLook(0);
  return (
    <View style={[styles.rule, { borderColor: pal.fg, borderStyle: 'solid' }]}>
      <Fuse color={pal.fg} />
      <Text style={[styles.ruleText, { color: pal.fg, flex: 1 }]}>
        <Text style={styles.ruleHead}>時限爆弾 作動中</Text>{'\n'}仕掛け人：{nm}
      </Text>
      <Tap onPress={() => setLook(1)} accessibilityLabel="時限爆弾の中身を見る" style={[styles.ruleOut, { borderWidth: 1.5, borderColor: pal.fg }]}>
        <Text style={[styles.ruleOutText, { color: pal.fg }]}>中身を見る</Text>
      </Tap>
      <Modal visible={look > 0} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.sheetBack} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {look === 1 ? (
              <>
                <Text style={styles.sheetTitle}>{nm}だけ見て</Text>
                <Text style={styles.ruleItemText}>ほかの人は目そらして！</Text>
                <Tap onPress={() => setLook(2)} style={styles.sheetBig}>
                  <Text style={styles.sheetBigText}>{nm}が見る</Text>
                </Tap>
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>時限爆弾の中身</Text>
                <Text style={{ color: '#f7f3ea', fontSize: 22, fontWeight: '900', lineHeight: 34 }}>
                  <Text style={{ backgroundColor: alpha('#ff7a1a', 0.55) }}>{bomb.cond}</Text>奴を、こっそり監視
                </Text>
                <Text style={styles.ruleItemText}>見たらすぐ閉じてな</Text>
              </>
            )}
            <Tap onPress={close} style={styles.sheetGhost}>
              <Text style={styles.sheetGhostText}>閉じる</Text>
            </Tap>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** 札がめくれて出てくるアニメーション。割り込みの時はガタッと揺れる */
function useFlipIn(dep: unknown, alert?: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    shake.setValue(0);
    const seq = [Animated.timing(v, { toValue: 1, duration: 480, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true })];
    if (alert) {
      seq.push(
        Animated.sequence([7, -7, 4, -3, 1, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 60, useNativeDriver: true }))),
      );
    }
    Animated.sequence(seq).start();
  }, [dep]);
  const rotateY = v.interpolate({ inputRange: [0, 1], outputRange: ['-100deg', '0deg'] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const opacity = v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.2, 1, 1] });
  return { opacity, transform: [{ perspective: 1000 }, { rotateY }, { scale }, { translateX: shake }] };
}

function lookOf(pal: Pal, card: Card) {
  if (card.bomb) return CARD_LOOK.bomb;
  if (card.kind.includes('深夜')) return CARD_LOOK.deep;
  if (card.yoru) return CARD_LOOK.yoru;
  if (card.alert) return CARD_LOOK.event;
  return { bg: pal.cardBg, fg: pal.cardFg, edge: pal.cardEdge };
}

/** お題札 */
export function OdaiCard({
  pal, card, no, doubled, art, underline, small, who,
}: { pal: Pal; card: Card; no?: number; doubled?: boolean; art?: 'bomb' | 'coin'; underline?: boolean; small?: boolean; /** 札の上に出す「誰の番か」 */ who?: { name: string; color: string; label: string } }) {
  const anim = useFlipIn(card, card.alert);
  const look = lookOf(pal, card);
  // 向かい合わせ：同じお題を上下逆さにもう1枚（爆弾の中身は仕掛け人だけが見るので出さない）
  const dual = usePrefs().dual && art !== 'bomb';
  const ul = underline && !card.yoru && !card.alert && !card.bomb;
  // 夜お題はネオン管：ふちが光って、出てくる時にチカチカ点く
  const neon = !!card.yoru;
  const flick = useNeonOn(card, neon);
  const glow = neon ? { shadowColor: look.edge, shadowOpacity: 0.85, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } } : null;
  const textGlow = neon ? { textShadowColor: look.edge, textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } } : null;
  return (
    <Animated.View style={[styles.card, { backgroundColor: look.bg, borderColor: look.edge }, glow, anim]}>
      <Animated.View style={{ flex: 1, gap: 12, opacity: flick }}>
      <View style={styles.cardHead}>
        {who && <Who {...who} fg={neon ? '#fff' : look.fg} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, marginLeft: 'auto', opacity: 0.85 }}>
          {!plainKind(card) && (
            <Text style={[styles.kind, { color: neon ? look.edge : look.fg, opacity: neon ? 1 : undefined, flexShrink: 1 }, textGlow]} numberOfLines={1}>{card.kind.match(/（(.*)）$/)?.[1] ?? card.kind}</Text>
          )}
          {!!cardTag(card) && art === undefined && (
            <Text style={[styles.tag, { color: neon ? look.edge : look.fg, borderColor: neon ? look.edge : look.fg }]} numberOfLines={1}>{cardTag(card)}</Text>
          )}
          {doubled ? (
            <View style={[styles.badge, { backgroundColor: look.fg, flexShrink: 0 }]}>
              <Text style={[styles.badgeText, { color: look.bg }]} numberOfLines={1}>倍プッシュ中</Text>
            </View>
          ) : null}
        </View>
      </View>
      {/* コイン・爆弾の絵はお題の文と一緒に札の真ん中へ */}
      {art && <View style={{ flex: 1 }} />}
      {art === 'bomb' && <BombArt />}
      {art === 'coin' && <Coin />}
      {dual && (
        <>
          <View style={[styles.cardBody, styles.mirror]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <SegText fit segments={card.segments} underline={ul} style={[styles.cardText, fitSize(card.segments, small, 0.74), { color: look.fg }, textGlow]} />
          </View>
          <View style={[styles.dualLine, { borderColor: look.fg }]} />
        </>
      )}
      {/* 上・絵と文の間・下の余白をそろえる */}
      {art && <View style={{ flex: 1 }} />}
      <View style={[styles.cardBody, art && { flex: 0 }]}>
        <SegText fit segments={card.segments} underline={ul} style={[styles.cardText, fitSize(card.segments, small, dual ? 0.74 : 1), { color: look.fg }, textGlow]} />
      </View>
      {art && <View style={{ flex: 1 }} />}
      </Animated.View>
    </Animated.View>
  );
}

/** ネオンが点く時のチカチカ（夜お題が出るたび） */
function useNeonOn(key: unknown, on: boolean) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!on) {
      v.setValue(1);
      return;
    }
    v.setValue(0.2);
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.3, duration: 60, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.delay(120),
      Animated.timing(v, { toValue: 0.55, duration: 50, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start();
  }, [key]);
  return v;
}

const BATSU_LOOK = { bg: '#1a0606', fg: '#ffffff', edge: '#e8202a' };
const LUCKY_LOOK = { bg: '#eef6ff', fg: '#1c2a4a', edge: '#ffd23f' };

/** 罰ガチャ：ドクロがドンッ → カプセルが落ちてきて開き、中身が出る */
export function GachaCard({ members, items }: { pal: Pal; members: Member[]; items: GachaItem[] }) {
  const anim = useFlipIn(items);
  const allLucky = items.every((g) => g.lucky);
  const mixed = !allLucky && items.some((g) => g.lucky);
  const look = allLucky ? LUCKY_LOOK : BATSU_LOOK;
  const { dual } = usePrefs();
  return (
    <Animated.View style={[styles.card, { backgroundColor: look.bg, borderColor: look.edge, borderWidth: 3 }, anim]}>
      <Text style={[styles.kind, { color: look.fg }]}>罰ガチャ</Text>
      {dual && (
        <>
          <View style={[styles.mirror, { gap: 6 }]}>
            {items.map((g) => (
              <Text key={g.i} style={[styles.mirrorText, { color: look.fg }]}>
                <Text style={{ fontWeight: '900' }}>{members[g.i].name}{g.lucky ? 'はセーフ　' : 'の罰　'}</Text>
                {g.segments.map((x) => x.text).join('')}
              </Text>
            ))}
          </View>
          <View style={[styles.dualLine, { borderColor: look.fg }]} />
        </>
      )}
      <View style={{ alignItems: 'center', gap: 4 }}>
        {allLucky ? <Angel /> : <Skull />}
        <Text style={[styles.batsuHead, allLucky && { color: '#d99a00' }]}>{allLucky ? 'ラッキー！セーフ' : '罰ゲーム確定'}</Text>
      </View>
      <View style={[styles.cardBody, { gap: 14 }]}>
        {items.map((g, k) => (
          <GachaRow key={g.i} name={members[g.i].name} color={colorOf(g.i)} item={g} fg={look.fg} mark={mixed} delay={400 + k * 350} />
        ))}
      </View>
    </Animated.View>
  );
}
function GachaRow({ name, color, item, delay, fg, mark }: { name: string; color: string; item: GachaItem; delay: number; fg: string; mark: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 400, delay: delay + 800, useNativeDriver: true }).start();
  }, []);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  return (
    <View style={styles.gachaRow}>
      <Capsule color={color} delay={delay} result={item.lucky ? 'ok' : 'ng'} />
      <Animated.View style={{ flex: 1, opacity: v, transform: [{ translateY }] }}>
        <View style={styles.gachaWhoRow}>
          {mark && (
            <View style={[styles.mark, { backgroundColor: item.lucky ? '#ffd23f' : '#e8202a' }]}>
              <Text style={[styles.markText, { color: item.lucky ? '#141210' : '#fff' }]}>{item.lucky ? '天使' : 'ドクロ'}</Text>
            </View>
          )}
          <Text style={[styles.gachaWho, { color: fg }]}>
            {name}{item.lucky ? 'はセーフ' : item.night === 'shinya' ? 'の深夜の罰' : item.night ? 'の夜の罰' : 'の罰'}{item.n > 1 && !item.lucky ? `　×${item.n}` : ''}
          </Text>
        </View>
        <SegText segments={item.segments} style={[styles.gachaText, { color: fg }]} />
      </Animated.View>
    </View>
  );
}

function Chips({
  pal, members, list, head, selected, pen, rev, onPress,
}: {
  pal: Pal; members: Member[]; list: number[]; head: string;
  selected?: Map<number, number>; pen?: number[]; rev: boolean[]; onPress: (i: number) => void;
}) {
  return (
    <View>
      <Text style={[styles.penHead, { color: pal.muted }]}>{head}</Text>
      <View style={styles.chips}>
        {list.map((i) => {
          const on = !!selected?.has(i);
          return (
            <Tap
              key={i}
              onPress={() => onPress(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, { backgroundColor: on ? pal.fg : pal.chip }]}
            >
              <View style={[styles.chipDot, { backgroundColor: colorOf(i) }]} />
              <Text style={[styles.chipText, { color: on ? pal.bg : pal.fg }]}>
                {members[i].name}
                {pen && <Text style={styles.chipN}> {pen[i]}</Text>}
                {rev[i] && <Text style={styles.chipN}> ↺</Text>}
              </Text>
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

const PEN_RED = '#e8202a';

/** 罰をつける人を選ぶタイル。押すと赤くなって「罰」のハンコ */
function PenGrid({ pal, members, flow }: { pal: Pal; members: Member[]; flow: TurnFlow }) {
  const { st } = flow;
  const onRed = !!pal.jigoku ? pal.cardEdge : PEN_RED;
  const onText = !!pal.jigoku ? '#000' : '#fff';
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.penQRow}>
        <Text style={[styles.penQ, { color: pal.fg, flexShrink: 1 }]} numberOfLines={1} adjustsFontSizeToFit>{penQuestion(flow)}</Text>
        <Text style={[styles.penQSub, { color: pal.muted }]}>タップで罰</Text>
      </View>
      <View style={styles.penGrid}>
        {members.map((m, i) => {
          const on = st.add.has(i);
          const many = members.length > 6; // 人数が多い時は4列で低めに（1画面に収める）
          return (
            <Tap
              key={i}
              onPress={() => flow.togglePen(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${m.name}に罰`}
              style={({ pressed }) => [
                styles.penTile,
                many && { width: '23.5%', minHeight: 46, paddingVertical: 5 },
                { backgroundColor: on ? onRed : pal.chip, borderColor: on ? onRed : i === st.doer ? pal.fg : pal.chip },
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
            >
              <View style={[styles.penBar, { backgroundColor: colorOf(i) }]} />
              <Text style={[styles.penName, { color: on ? onText : pal.fg }]} numberOfLines={1}>{m.name}</Text>
              <Text style={[styles.penMeta, { color: on ? onText : pal.fg }]}>
                {i === st.doer && !many ? 'いまの番' : ''}{st.rev[i] ? ' ↺' : ''}{on ? '' : `  罰${st.pen[i]}`}
              </Text>
              {on && (
                <View style={[styles.stamp, { borderColor: onText }]}>
                  <Text style={[styles.stampText, { color: onText }]}>罰</Text>
                </View>
              )}
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

/** 次へボタンの文字。誰に罰がつくかをそのまま書く */
function nextText(members: Member[], add: Map<number, number>, base: string, tpl?: string) {
  if (!add.size && mustPick(tpl)) return `${penHead(tpl).replace(/は？$/, '')}を選んで`;
  if (!add.size) return `アウトなし → ${base}`;
  const names = [...add.keys()].map((i) => members[i].name);
  const who = names.length > 2 ? `${names.slice(0, 2).join('・')} ほか${names.length - 2}人` : names.join('・');
  return `${who}に罰 → ${base}`;
}

function Choice({ pal, title, sub, hot, onPress }: { pal: Pal; title: string; sub: string; hot?: boolean; onPress: () => void }) {
  return (
    <Tap onPress={onPress} style={[styles.choice, { borderColor: hot ? 'transparent' : 'rgba(247,243,234,0.35)', backgroundColor: hot ? pal.fg : 'transparent', borderWidth: 1.5 }]}>
      <Text style={[hot ? styles.choiceHot : styles.choiceTitle, { color: hot ? pal.bg : pal.fg }]}>{title}</Text>
      <Text style={[styles.choiceSub, { color: hot ? pal.bg : pal.fg }]}>{sub}</Text>
    </Tap>
  );
}

/** カードの下の操作部分。いまの段階（phase）で中身が変わる */
export function Controls({
  pal, members, flow, nextLabel, next,
}: { pal: Pal; members: Member[]; flow: TurnFlow; nextLabel: string; next?: number | null }) {
  const { st } = flow;
  const others = othersOf(members, st.doer);
  const revTargets = others.filter((i) => !st.card.yoru || !members[i].ng);
  // 操作のヒントは最初の3枚だけ（慣れたら消えてスッキリ）
  const early = st.cards < 3;
  const verdict = canVerdict(flow);

  switch (st.phase) {
    case 'offer':
      return (
        <View style={styles.choices}>
          <Choice pal={pal} hot title="倍プッシュ" sub="成功→押し付け／失敗→罰2倍" onPress={() => flow.chooseDouble(true)} />
          <Choice pal={pal} title="普通に見る" sub="いつも通り" onPress={() => flow.chooseDouble(false)} />
        </View>
      );
    case 'revenge':
      return (
        <View style={{ gap: 12 }}>
          <Chips pal={pal} members={members} list={revTargets} rev={st.rev} head={`${members[st.doer].name}のリベンジ。誰に押し付ける？`} onPress={flow.revengeTo} />
          <Tap onPress={flow.cancelRevenge} style={[styles.ghost, { borderColor: pal.muted }]}>
            <Text style={[styles.ghostText, { color: pal.fg }]}>やっぱやめる</Text>
          </Tap>
        </View>
      );
    case 'push':
      return <Chips pal={pal} members={members} list={others} rev={st.rev} head="成功！罰を押し付ける相手をタップ" onPress={flow.pushTo} />;
    case 'batsu':
      return (
        <View style={{ gap: 8 }}>
          <BigButton pal={pal} label={`${st.gacha.every((g) => g.lucky) ? 'ラッキー！' : '受け入れた'} → ${nextLabel}`} onPress={flow.accept} />
        </View>
      );
    case 'bombSet':
      return <BigButton pal={pal} label={`${members[st.doer].name}が見る`} onPress={flow.peekBomb} />;
    case 'bombPeek':
      return <BigButton pal={pal} label="見た！隠して続ける" onPress={flow.hideBomb} />;
    default:
      if (st.double) {
        return (
          <View style={styles.choices}>
            <Choice pal={pal} hot title="成功！" sub="誰かに罰を押し付ける" onPress={flow.doubleWin} />
            <Choice pal={pal} title="失敗…" sub="罰2倍" onPress={flow.doubleLose} />
          </View>
        );
      }
      // 続くルールを出した指令は、今は誰も罰にならへん。上に出しといて、破った時に「違反者に罰」
      if (st.card.ruleCard) return <BigButton pal={pal} label={`ルール開始 → ${nextLabel}`} onPress={flow.next} />;
      return (
        <View style={{ gap: 12 }}>
          {(st.card.yoru || st.card.solo) && (
            <View style={styles.subActs}>
              {st.card.solo && !st.card.passed && isSituational(st.card.tpl) && (
                <Tap onPress={flow.notMe} style={styles.subBtn}>
                  <Text style={[styles.subText, { color: pal.fg }]}>当てはまらん → 誰かに回す</Text>
                </Tap>
              )}
              {st.card.yoru && (
                <Tap onPress={flow.pass} style={styles.subBtn}>
                  <Text style={[styles.subText, { color: pal.fg }]}>無理！罰なしでパス</Text>
                </Tap>
              )}
              {st.card.solo && st.rev[st.doer] && (
                <Tap onPress={flow.startRevenge} style={[styles.subBtn, styles.revenge, { borderColor: pal.cardEdge }]}>
                  <Text style={[styles.subText, { color: pal.fg }]}>↺ リベンジ権を使う</Text>
                </Tap>
              )}
            </View>
          )}
          {verdict ? (
            <>
              {/* 1人用のお題は「やった／できんかった」の2択（札のスワイプでもOK） */}
              <View style={styles.choices}>
                <Verdict pal={pal} ng title="アウト" sub={`${members[st.doer].name}に罰`} onPress={flow.fail} />
                <Verdict pal={pal} title="セーフ！" sub={`→ ${nextLabel}`} onPress={flow.clear} />
              </View>
              <View style={styles.swipeHint}>
                <Text style={[styles.swipeHintText, { color: pal.muted }]}>{early ? '← アウト' : ''}</Text>
                <Tap onPress={flow.openPen} haptic={false}>
                  <Text style={[styles.link, { color: pal.fg }]}>他の人に罰をつける</Text>
                </Tap>
                <Text style={[styles.swipeHintText, { color: pal.muted }]}>{early ? 'セーフ →' : ''}</Text>
              </View>
            </>
          ) : (
            <>
          <PenGrid pal={pal} members={members} flow={flow} />
          <BigButton
            pal={pal}
            label={nextText(members, st.add, nextLabel, st.card.tpl)}
            onPress={flow.next}
            disabled={!st.add.size && mustPick(st.card.tpl)}
            danger={st.add.size > 0}
          />
            </>
          )}
        </View>
      );
  }
}

/** やった／できんかった ボタン */
function Verdict({ pal, title, sub, ng, onPress }: { pal: Pal; title: string; sub: string; ng?: boolean; onPress: () => void }) {
  const jigoku = !!pal.jigoku;
  // 地獄度は両方赤になって見分けにくいので、セーフは枠だけにする
  const outline = !ng && (pal.neon || jigoku);
  const bg = ng ? (jigoku ? pal.cardEdge : PEN_RED) : outline ? 'transparent' : pal.fg;
  const fg = ng ? (jigoku ? '#000' : '#fff') : pal.neon ? '#fff' : jigoku ? pal.fg : pal.bg;
  return (
    <Tap
      onPress={onPress}
      style={({ pressed }) => [
        styles.verdict,
        { backgroundColor: bg, transform: [{ translateY: pressed ? 4 : 0 }] },
        outline && { borderWidth: 2, borderColor: pal.neon ?? pal.fg },
      ]}
    >
      <Text style={[styles.verdictTitle, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
      <Text style={[styles.verdictSub, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit>{sub}</Text>
    </Tap>
  );
}

/** 誰の番か（札の上に1行） */
export function Who({ name, color, label, fg }: { name: string; color: string; label: string; fg: string }) {
  return (
    <View style={styles.who}>
      <View style={[styles.whoDot, { backgroundColor: color }]} />
      <Text style={[styles.whoName, { color: fg }]} numberOfLines={1}>{name}</Text>
      <Text style={[styles.whoLabel, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** 普通のお題は種類名を出さへん（地獄度は画面の色で分かる）。夜・緊急・押し付けなどの時だけ出す */
function plainKind(c: Card) {
  return !!c.kind && !c.kind.includes('（') && /^(\d+マス目・)?(アホお題|全員参加)/.test(c.kind);
}

/** 札の種類タグ（誰が動くお題か） */
export function cardTag(c: Card): string {
  if (!c || c.bomb || !c.tpl) return '';
  if (c.ruleCard) return 'ルール';
  if (c.alert) return '緊急';
  if (mustPick(c.tpl)) return '勝負';
  if (!c.solo) return '全員';
  return needsPick(c.tpl) ? 'みんなで判定' : 'ひとり';
}

/** 初めて出てきた仕組みだけ、札の下にひとこと説明（1回見たら二度と出えへん） */
const COACH: Record<string, string> = {
  double: '倍プッシュ：できたら誰かに罰、できんかったら罰2回',
  bomb: '時限爆弾：仕掛け人だけがNG行動を知ってる。やった人は後で全員罰',
  rule: 'このルールは上に出しとく。破った人が出たら「違反者に罰」',
  event: '緊急指令：アウトの人を下で選ぶ',
  contest: '負けた人を下で選んでから「次へ」',
  swipe: 'できたらセーフ、できんかったらアウト。札を左右にスワイプでもOK',
  notme: '当てはまらん時は、罰なしで誰かに回せる',
  pass: '夜のお題は「無理！」で罰なしパスできる',
  revenge: 'リベンジ権 ↺：このお題を1回だけ誰かに押し付けられる',
};
export function Coach({ flow }: { flow: TurnFlow }) {
  const { seen, markSeen } = useSeen();
  const { st } = flow;
  const c = st.card;
  const keys: string[] = [];
  if (st.phase === 'offer') keys.push('double');
  if (st.phase === 'bombSet') keys.push('bomb');
  if (st.phase === 'play' && !st.double) {
    if (c.ruleCard) keys.push('rule');
    else if (c.alert && !c.bomb) keys.push('event');
    if (mustPick(c.tpl)) keys.push('contest');
    if (canVerdict(flow)) keys.push('swipe');
    if (c.solo && !c.passed && isSituational(c.tpl)) keys.push('notme');
    if (c.yoru) keys.push('pass');
    if (c.solo && st.rev[st.doer]) keys.push('revenge');
  }
  const k = keys.find((x) => !seen[x]);
  if (!k) return null;
  return (
    <View style={styles.coach} accessibilityRole="text">
      <View style={styles.coachArrow} />
      <Text style={styles.coachText}>{COACH[k]}</Text>
      <Tap onPress={() => markSeen(k)} style={styles.coachBtn}>
        <Text style={styles.coachBtnText}>わかった</Text>
      </Tap>
    </View>
  );
}

/** ルール早見表（⋯メニューから） */
export function RulesSheet({ visible, night, onClose, custom }: { visible: boolean; night?: boolean; onClose: () => void; /** モードごとのルール（NGワード・投票） */ custom?: [string, string][] }) {
  const items: [string, string][] = [...(custom ?? HELP.odai.rules)];
  if (night) items.push(['夜モード', '夜・深夜のお題や罰も混ざる。下ネタNGの人には振られへん。夜お題は「無理！」で罰なしパス']);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBack} onPress={onClose}>
        <Pressable style={[styles.sheet, { maxHeight: '88%' }]} onPress={() => {}}>
          <ScrollView contentContainerStyle={{ gap: 10 }}>
            <Text style={styles.sheetTitle}>ルール早見表</Text>
            {items.map(([h, t]) => (
              <View key={h} style={styles.ruleItem}>
                <Text style={styles.ruleItemHead}>{h}</Text>
                <Text style={styles.ruleItemText}>{t}</Text>
              </View>
            ))}
            <Tap onPress={onClose} style={styles.sheetGhost}>
              <Text style={styles.sheetGhostText}>閉じる</Text>
            </Tap>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** 罰の人を選ぶ時の聞き方（お題に合わせる。例：一番遅い奴が罰 → 一番遅い人は？） */
function penQuestion(flow: TurnFlow) {
  const c = flow.st.card;
  if (c.bombCond) return `${c.bombCond}人は？`;
  if (flow.st.penOpenFor === c && c.solo && !needsPick(c.tpl)) return '罰をつける人は？';
  return penHead(c.tpl);
}

/** 1人用のお題で2択・スワイプが使える場面か */
export function canVerdict(flow: TurnFlow) {
  const { st } = flow;
  return st.phase === 'play' && !st.double && !!st.card.solo && !needsPick(st.card.tpl) && st.penOpenFor !== st.card;
}

/** 札のスワイプ：右でクリア、左で番の人に罰。上下反転中は左右も逆 */
export function SwipeCard({ enabled, flipped, onSwipe, children }: { enabled: boolean; flipped?: boolean; onSwipe: (dir: 1 | -1) => void; children: React.ReactNode }) {
  const x = useRef(new Animated.Value(0)).current;
  const live = useRef({ enabled, flipped, onSwipe });
  live.current = { enabled, flipped, onSwipe };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => live.current.enabled && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => x.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        const dir = (g.dx > 0 ? 1 : -1) as 1 | -1;
        if (Math.abs(g.dx) > 90) {
          Animated.timing(x, { toValue: dir * 520, duration: 200, useNativeDriver: true }).start(() => {
            x.setValue(0);
            live.current.onSwipe((live.current.flipped ? -dir : dir) as 1 | -1);
          });
        } else Animated.spring(x, { toValue: 0, friction: 5, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;
  const rotate = x.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-16deg', '0deg', '16deg'] });
  // 右に動かすと「クリア」、左で「罰」のハンコが浮かぶ（反転中は逆）
  const okOp = x.interpolate({ inputRange: flipped ? [-110, 0] : [0, 110], outputRange: flipped ? [1, 0] : [0, 1], extrapolate: 'clamp' });
  const ngOp = x.interpolate({ inputRange: flipped ? [0, 110] : [-110, 0], outputRange: flipped ? [0, 1] : [1, 0], extrapolate: 'clamp' });
  return (
    <Animated.View style={{ flex: 1, transform: [{ translateX: x }, { rotate }] }} {...pan.panHandlers}>
      {children}
      {enabled && (
        <>
          <Animated.Text style={[styles.swStamp, styles.stampOk, { opacity: okOp }]}>セーフ</Animated.Text>
          <Animated.Text style={[styles.swStamp, styles.stampNg, { opacity: ngOp }]}>アウト</Animated.Text>
        </>
      )}
    </Animated.View>
  );
}

export function BigButton({
  pal, label, onPress, disabled, danger,
}: { pal: Pal; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const jigoku = !!pal.jigoku;
  const bg = danger ? (jigoku ? pal.cardEdge : PEN_RED) : pal.fg;
  const fg = danger ? (jigoku ? '#000' : '#fff') : pal.bg;
  // ネオン看板中は光る管のボタン
  const tube = pal.neon && !danger
    ? { backgroundColor: 'transparent', borderWidth: 2, borderColor: pal.neon, shadowColor: pal.neon, shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }
    : null;
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.big,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1, transform: [{ translateY: pressed ? 4 : 0 }] },
        tube,
      ]}
    >
      <Text style={[styles.bigText, { color: tube ? '#fff' : fg }, tube && { textShadowColor: pal.neon, textShadowRadius: 8 }]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: 3, zIndex: 10 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  score: { gap: 10, paddingVertical: 10, paddingLeft: 8, paddingRight: 10, alignItems: 'center' },
  av: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#141210' },
  avText: { color: '#141210', fontWeight: '900', fontSize: 15 },
  cnt: { position: 'absolute', top: -7, right: -8, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#e8202a', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cntText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  rvDot: { position: 'absolute', bottom: -5, right: -5, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rvText: { fontSize: 9, fontWeight: '900' },
  menuBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  nextUp: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextText: { fontSize: 13, fontWeight: '900' },
  avSm: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  avSmText: { color: '#141210', fontSize: 11, fontWeight: '900' },
  stack: { position: 'absolute', left: 12, right: 12, top: 14, bottom: -2, borderRadius: 22 },
  tools: { flexDirection: 'row', gap: 6 },
  pill: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999 },
  pillText: { fontWeight: '900', fontSize: 13 },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  flipIcon: { fontSize: 18, fontWeight: '900' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, padding: 10 },
  ruleHead: { fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  ruleText: { fontSize: 13, fontWeight: '700' },
  card: { flex: 1, minHeight: 0, overflow: 'hidden', borderRadius: 22, borderWidth: 3, padding: 20, gap: 12 },
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 8, rowGap: 6 },
  kind: { fontSize: 12, fontWeight: '900', letterSpacing: 0.3, opacity: 0.7 },
  no: { fontSize: 11, fontWeight: '900', letterSpacing: 1, opacity: 0.6, fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '900' },
  cardBody: { flex: 1, justifyContent: 'center' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 0, maxWidth: '100%' },
  whoDot: { width: 12, height: 12, borderRadius: 6 },
  whoName: { fontFamily: F.display, fontSize: 22, lineHeight: 28, flexShrink: 1 },
  whoLabel: { fontSize: 13, fontWeight: '900' },
  tag: { flexShrink: 0, fontSize: 10, fontWeight: '900', letterSpacing: 1, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden', opacity: 0.8 },
  coach: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: '#26221e', borderWidth: 1, borderColor: 'rgba(255,210,63,0.35)' },
  coachArrow: { position: 'absolute', top: -7, left: 28, width: 12, height: 12, backgroundColor: '#26221e', borderLeftWidth: 1, borderTopWidth: 1, borderColor: 'rgba(255,210,63,0.35)', transform: [{ rotate: '45deg' }] },
  coachText: { flex: 1, color: '#f7f3ea', fontSize: 13, fontWeight: '700', lineHeight: 20 },
  coachBtn: { borderRadius: 999, backgroundColor: '#ffd23f', paddingVertical: 8, paddingHorizontal: 12 },
  coachBtnText: { color: '#141210', fontSize: 12, fontWeight: '900' },
  ruleItem: { padding: 12, borderRadius: 12, backgroundColor: 'rgba(247,243,234,0.06)' },
  ruleItemHead: { color: '#ffd23f', fontWeight: '900', fontSize: 14 },
  ruleItemText: { color: 'rgba(247,243,234,0.85)', fontSize: 13, lineHeight: 20, marginTop: 2 },
  ruleOut: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 10 },
  ruleOutText: { fontSize: 12, fontWeight: '900' },
  sheetBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1d1a17', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  sheetLabel: { color: '#ff6b6b', fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  sheetRule: { color: 'rgba(247,243,234,0.62)', fontSize: 13, lineHeight: 20 },
  sheetTitle: { color: '#f7f3ea', fontSize: 18, fontWeight: '900' },
  sheetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingVertical: 10, paddingRight: 14, paddingLeft: 10, borderRadius: 999, backgroundColor: 'rgba(247,243,234,0.08)' },
  sheetChipText: { color: '#f7f3ea', fontWeight: '900', fontSize: 15 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  sheetGhost: { borderWidth: 2, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 14, padding: 14, alignItems: 'center' },
  sheetGhostText: { color: '#f7f3ea', fontWeight: '900' },
  sheetVerdict: { fontFamily: F.display, fontSize: 24, color: '#ff3b3b' },
  sheetPen: { fontFamily: F.display, fontSize: 22, lineHeight: 32, color: '#f7f3ea', textAlign: 'center' },
  sheetBig: { borderRadius: 16, backgroundColor: '#f7f3ea', padding: 16, alignItems: 'center' },
  sheetBigText: { fontFamily: F.display, fontSize: 20, color: '#141210' },
  verdict: { flex: 1, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', gap: 2, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  verdictTitle: { fontSize: 20, fontWeight: '900', lineHeight: 26 },
  verdictSub: { fontSize: 12, fontWeight: '900', opacity: 0.8 },
  swipeHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  swipeHintText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  link: { fontSize: 12, fontWeight: '900', textDecorationLine: 'underline', opacity: 0.8, padding: 6 },
  swStamp: { position: 'absolute', top: 46, fontFamily: F.display, fontSize: 28, paddingHorizontal: 12, paddingVertical: 2, borderWidth: 4, borderRadius: 10, overflow: 'hidden' },
  stampOk: { left: 18, color: '#1aa64b', borderColor: '#1aa64b', transform: [{ rotate: '-12deg' }] },
  stampNg: { right: 18, color: PEN_RED, borderColor: PEN_RED, transform: [{ rotate: '12deg' }] },
  mirror: { transform: [{ rotate: '180deg' }] },
  mirrorText: { fontSize: 14, lineHeight: 20 },
  dualLine: { borderTopWidth: 2, borderStyle: 'dashed', opacity: 0.22 },
  cardText: { fontFamily: F.display, fontSize: 32, lineHeight: 46 },
  gachaWhoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mark: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  markText: { fontSize: 10, fontWeight: '900' },
  batsuHead: { fontFamily: F.display, fontSize: 22, color: '#e8202a', letterSpacing: 2 },
  gachaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gachaWho: { fontSize: 12, fontWeight: '900', letterSpacing: 1, opacity: 0.7 },
  gachaText: { fontFamily: F.display, fontSize: 22, lineHeight: 32 },
  penQRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  penQ: { fontSize: 16, fontWeight: '900' },
  penQSub: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  penGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  penTile: { width: '31.5%', minHeight: 64, borderRadius: 14, borderWidth: 2, paddingVertical: 8, paddingRight: 8, paddingLeft: 16, justifyContent: 'center', overflow: 'hidden' },
  penBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 7 },
  penName: { fontSize: 17, fontWeight: '900' },
  penMeta: { fontSize: 10, fontWeight: '900', opacity: 0.7 },
  stamp: { position: 'absolute', right: 6, top: '50%', marginTop: -18, width: 36, height: 36, borderRadius: 18, borderWidth: 3, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-14deg' }] },
  stampText: { fontFamily: F.display, fontSize: 18 },
  penHead: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingVertical: 10, paddingRight: 14, paddingLeft: 10, borderRadius: 999 },
  chipDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.25)' },
  chipText: { fontWeight: '900', fontSize: 15 },
  chipN: { fontSize: 11, opacity: 0.7 },
  choices: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, borderRadius: 16, borderWidth: 2, paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', gap: 4 },
  choiceHot: { fontSize: 17, fontWeight: '900' },
  choiceTitle: { fontWeight: '900', fontSize: 15 },
  choiceSub: { fontSize: 11, fontWeight: '700', opacity: 0.75, textAlign: 'center' },
  subActs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1.5, borderColor: 'rgba(247,243,234,0.35)' },
  revenge: { borderWidth: 1.5 },
  subText: { fontWeight: '900', fontSize: 14 },
  ghost: { borderWidth: 2, borderRadius: 14, padding: 14, alignItems: 'center' },
  ghostText: { fontWeight: '900' },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  big: {
    paddingVertical: 18, borderRadius: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  bigText: { fontSize: 19, fontWeight: '900' },
});
