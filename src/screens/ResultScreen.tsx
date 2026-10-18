import { useEffect, useRef, useState } from 'react';
import { Tap } from '../components/Tap';
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { Confetti } from '../components/Fx';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Icon } from '../components/Icon';
import { play } from '../lib/sound';
import { usePrefs } from '../lib/prefs';
import { speak } from '../lib/speech';
import { titles, whyText, type Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, colorOf } from '../theme';
import type { Level, Member, Mode, Night } from '../types';
import { ALLOW_SHINYA } from '../lib/game';

type Props = {
  members: Member[];
  pen: number[];
  turns: number;
  stats?: Stats;
  night?: Night;
  mode: Mode;
  level: Level;
  onHome: () => void;
  onAgain: () => void;
  /** NGワードの時：最後のみんなのワード */
  words?: string[];
  /** 神経衰弱の点数 */
  scores?: number[];
};

const MODE_LABEL: Record<Mode, string> = { odai: 'アホお題', sugoroku: 'すごろく', memory: '神経衰弱', ito: '価値観ナンバー', gesture: '早押しジェスチャー', homeru: '褒め殺し', ngword: 'NGワード', vote: 'ぶっちゃけ投票', wolf: 'ワードウルフ', pittari: 'ピッタリ予想' };

export default function ResultScreen({ members, pen, turns, stats, night, mode, level, onHome, onAgain, words, scores }: Props) {
  const rows = members.map((m, i) => ({ m, i, n: pen[i] ?? 0 })).sort((a, b) => b.n - a.n);
  const top = rows[0]?.n ?? 0;
  const who = top === 0 ? '該当者なし' : rows.filter((r) => r.n === top).map((r) => r.m.name).join('・');
  const ts = titles(pen, stats);
  const [tip] = useState(() => resultTip(night ?? false));
  const { voice } = usePrefs();
  const line = mode === 'ngword' ? `NGワード・${LEVEL_LABEL[level]}・アウト${turns}回` : `${MODE_LABEL[mode]}・${LEVEL_LABEL[level]}・${turns}${mode === 'vote' || mode === 'ito' || mode === 'pittari' ? '問' : mode === 'wolf' ? '回戦' : mode === 'memory' ? 'ペア' : mode === 'gesture' ? '問正解' : mode === 'homeru' ? '回' : 'ターン'}`;
  // 戦犯の名前がスロットみたいに回って、止まったら揺れて紙吹雪（それまで下の称号やランキングは隠す）
  const slot = top > 0 && members.length > 1;
  const SLOT_MS = 2400;
  const [shown, setShown] = useState(slot ? '？？？' : who);
  const [landed, setLanded] = useState(!slot);
  const [boom, setBoom] = useState(0);
  const land = useRef(new Animated.Value(slot ? 0 : 1)).current;
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const say = () => voice && speak(top === 0 ? '本日の戦犯は、該当者なし。平和すぎる' : `本日の戦犯は、${who.replace(/・/g, 'と')}。罰${top}回`);
    if (!slot) {
      play('fanfare');
      say();
      return;
    }
    play('drumroll');
    let t = 0;
    let k = 0;
    while (t < SLOT_MS) {
      const nm = members[k % members.length].name;
      timers.push(setTimeout(() => setShown(nm), t));
      t += 60 + (t / SLOT_MS) ** 2 * 260;
      k++;
    }
    timers.push(setTimeout(() => {
      setShown(who);
      setLanded(true);
      setBoom(1);
      Animated.spring(land, { toValue: 1, friction: 3, tension: 140, useNativeDriver: true }).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      say();
    }, SLOT_MS));
    return () => timers.forEach(clearTimeout);
  }, []);
  const mvpAnim = {
    transform: [
      { scale: land.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] }) },
      { rotate: land.interpolate({ inputRange: [0, 0.4, 0.7, 1], outputRange: ['0deg', '-3deg', '2deg', '0deg'] }) },
    ],
  };

  const shot = useRef<View>(null); // シェア用のストーリー画像（画面の外に置いて撮る）
  const [msg, setMsg] = useState('');

  /** 結果を画像にして共有シートを出す（そのままストーリーに貼れる） */
  const share = async () => {
    try {
      const uri = await captureRef(shot, { format: 'png', quality: 1, width: 1080, height: 1920 });
      if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '本日の戦犯' });
      } else setMsg('この端末では共有できへんかった。スクショで撮ってな');
    } catch {
      setMsg('画像にできへんかった。スクショで撮ってな');
    }
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.shot}>
      <Text style={s.brand}>ノリダン</Text>
      <Text style={s.head}>本日の戦犯</Text>
      <Text style={s.sub}>{line}</Text>

      <Animated.View style={[s.mvp, mvpAnim]}>
        <Text style={s.mvpLabel}>MVP（悪い意味で）</Text>
        <Text style={s.mvpName}>{shown}</Text>
        <Text style={[s.mvpCount, !landed && { opacity: 0 }]}>{top === 0 ? '全員セーフ。平和すぎる' : `罰 ${top}回`}</Text>
      </Animated.View>
      <View style={[{ gap: 18 }, !landed && { opacity: 0 }]} pointerEvents={landed ? 'auto' : 'none'}>

      {ts.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={s.h2}>称号</Text>
          <View style={s.titles}>
            {ts.map((t) => (
              <View key={t.title} style={s.title}>
                <Text style={s.titleName}>{t.title}</Text>
                <Text style={s.titleWho}>{t.idx.map((i) => members[i].name).join('・')}</Text>
                <Text style={s.titleDesc}>{t.desc}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View>
        {(mode === 'memory' || mode === 'gesture') && !!scores?.length && (
          <View style={{ gap: 8 }}>
            <Text style={s.h2}>{mode === 'gesture' ? 'ジェスチャーの点数' : '神経衰弱の点数'}</Text>
            {members.map((m, j) => ({ m, j })).sort((a, b) => scores[b.j] - scores[a.j]).map(({ m, j }) => (
              <View key={j} style={[s.ngRow, { borderLeftColor: colorOf(j) }]}>
                <Text style={s.ngName} numberOfLines={1}>{m.name}</Text>
                <Text style={s.ngWord}>{scores[j]}点</Text>
              </View>
            ))}
          </View>
        )}
        {mode === 'ngword' && !!words?.length && (
          <View style={{ gap: 8 }}>
            <Text style={s.h2}>みんなのNGワード</Text>
            {members.map((m, j) => (
              <View key={j} style={[s.ngRow, { borderLeftColor: colorOf(j) }]}>
                <Text style={s.ngName} numberOfLines={1}>{m.name}</Text>
                <Text style={s.ngWord}>{words[j]}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={s.h2}>罰ランキング</Text>
        {rows.map((r, i) => (
          <View key={i} style={s.rank}>
            <Text style={s.no}>{i + 1}</Text>
            <View style={[s.pc, { backgroundColor: colorOf(r.i) }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{r.m.name}</Text>
              {!!whyText(stats, r.i) && <Text style={s.why}>{whyText(stats, r.i)}</Text>}
            </View>
            <Text style={s.ct}>{r.n}</Text>
          </View>
        ))}
      </View>
      </View>
      </View>

      <View style={s.tipRow}>
        <Icon name="moon" color={C.muted} size={14} />
        <Text style={s.tip}>{tip}</Text>
      </View>
      <Tap style={({ pressed }) => [s.share, pressed && { transform: [{ translateY: 4 }] }]} onPress={share}>
        <Icon name="share" color="#fff" />
        <Text style={s.shareText}>画像で保存・シェア</Text>
      </Tap>
      {!!msg && <Text style={s.sub}>{msg}</Text>}

      <View style={s.row}>
        <Tap style={s.ghost} onPress={onHome}>
          <Text style={s.ghostText}>メンバー変更</Text>
        </Tap>
        <Tap style={s.again} onPress={onAgain}>
          <Text style={s.againText}>もう一回</Text>
        </Tap>
      </View>
    </ScrollView>
    {/* シェア用のストーリー画像（360×640 で組んで 1080×1920 で撮る） */}
    <View pointerEvents="none" style={s.offscreen}>
      <View ref={shot} collapsable={false}>
        <StoryCard members={members} rows={rows} top={top} who={who} line={line} ts={ts.slice(0, 4)} why={top > 0 && rows.filter((r) => r.n === top).length === 1 ? whyText(stats, rows[0].i) : ''} />
      </View>
    </View>
    <Confetti trigger={boom} />
    </View>
  );
}

/** シェア画像：黒地に赤い光、傾いたMVPステッカーとドクロ、罰ランキングのバー、称号バッジ */
function StoryCard({ members, rows, top, who, line, ts, why }: { members: Member[]; rows: { m: Member; i: number; n: number }[]; top: number; who: string; line: string; ts: { title: string; idx: number[] }[]; why: string }) {
  const maxRows = ts.length > 2 ? 5 : ts.length ? 6 : 8;
  const d = new Date();
  return (
    <View style={st.card}>
      <View style={st.glow} />
      <View style={st.topRow}>
        <Text style={st.logo}>ノリダン</Text>
        <Text style={st.date}>{`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`}</Text>
      </View>
      <Text style={st.line} numberOfLines={1}>{line}</Text>
      <Text style={st.title}>本日の戦犯</Text>
      <View style={st.mvpWrap}>
        <View style={st.mvpShadow} />
        <View style={st.mvp}>
          <Text style={st.mvpLabel}>MVP（悪い意味で）</Text>
          <Text style={st.mvpName} numberOfLines={1} adjustsFontSizeToFit>{who}</Text>
          <Text style={st.mvpCount}>{top === 0 ? '全員セーフ。平和すぎる' : `罰 ${top}回`}</Text>
          {!!why && <Text style={st.mvpWhy} numberOfLines={1}>{why}</Text>}
        </View>
        <View style={st.skull}>
          <Svg width={78} height={78} viewBox="0 0 100 100">
            <Path d="M50 6C25 6 10 23 10 45c0 14 8 23 17 27v11c0 4 3 7 7 7h32c4 0 7-3 7-7V72c9-4 17-13 17-27C90 23 75 6 50 6z" fill="#f7f3ea" stroke="#141210" strokeWidth={3} />
            <Ellipse cx={33} cy={47} rx={11} ry={12} fill="#e8202a" />
            <Ellipse cx={67} cy={47} rx={11} ry={12} fill="#e8202a" />
            <Path d="M50 58l-6 10h12z" fill="#141210" />
            <Path d="M40 76v14M50 76v14M60 76v14" stroke="#141210" strokeWidth={3} />
          </Svg>
        </View>
      </View>
      <Text style={st.h2}>罰ランキング</Text>
      {rows.slice(0, maxRows).map((r, k) => (
        <View key={r.i} style={st.row}>
          <View style={[st.no, k === 0 && r.n > 0 && { backgroundColor: '#e8202a' }]}><Text style={st.noText}>{k + 1}</Text></View>
          <View style={[st.dot, { backgroundColor: colorOf(r.i) }]} />
          <Text style={st.name} numberOfLines={1}>{r.m.name}</Text>
          <View style={st.track}>{r.n > 0 && <View style={[st.fill, { backgroundColor: colorOf(r.i), width: `${Math.max(8, (r.n / Math.max(1, top)) * 100)}%` }]} />}</View>
          <Text style={st.ct}>{r.n}</Text>
        </View>
      ))}
      {rows.length > maxRows && <Text style={st.more}>ほか{rows.length - maxRows}人</Text>}
      {ts.length > 0 && (
        <>
          <Text style={st.tsHead}>称号</Text>
          <View style={st.badges}>
            {ts.map((t) => (
              <View key={t.title} style={st.badge}>
                <Text style={st.badgeTitle} numberOfLines={1}>{t.title}</Text>
                <Text style={st.badgeWho} numberOfLines={1} adjustsFontSizeToFit>{t.idx.map((i) => members[i].name).join('・')}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      <View style={{ flex: 1 }} />
      <View style={st.foot}>
        <Text style={st.footLogo}>ノリダン</Text>
        <Text style={st.footText}>ノリで断れない飲み会ゲーム</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { width: 360, height: 640, backgroundColor: '#141210', paddingHorizontal: 30, paddingTop: 40, paddingBottom: 30, overflow: 'hidden' },
  glow: { position: 'absolute', left: -60, top: 60, width: 480, height: 420, borderRadius: 240, backgroundColor: 'rgba(232,32,42,0.28)' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  logo: { fontFamily: F.display, fontSize: 24, color: C.yuru },
  date: { color: C.muted, fontSize: 11, fontWeight: '900' },
  line: { color: C.muted, fontSize: 11, fontWeight: '900', marginTop: 2 },
  title: { fontFamily: F.display, fontSize: 48, lineHeight: 60, color: '#e8202a', marginTop: 14, transform: [{ rotate: '-2deg' }], textShadowColor: C.yuru, textShadowRadius: 1, textShadowOffset: { width: 2, height: 2 } },
  mvpWrap: { marginTop: 22, transform: [{ rotate: '-1.5deg' }] },
  mvpShadow: { position: 'absolute', left: 4, top: 8, right: -4, bottom: -8, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)' },
  mvp: { backgroundColor: C.yuru, borderRadius: 16, borderWidth: 2, borderColor: '#141210', paddingVertical: 16, paddingHorizontal: 20, gap: 2 },
  mvpLabel: { color: '#141210', fontSize: 12, fontWeight: '900' },
  mvpName: { fontFamily: F.display, fontSize: 40, lineHeight: 50, color: '#141210', marginRight: 70 },
  mvpCount: { color: '#141210', fontSize: 15, fontWeight: '900' },
  mvpWhy: { color: 'rgba(20,18,16,0.6)', fontSize: 10, fontWeight: '900' },
  skull: { position: 'absolute', right: -14, top: -26, transform: [{ rotate: '10deg' }] },
  h2: { color: C.muted, fontSize: 11, fontWeight: '900', marginTop: 26, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 22 },
  no: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(247,243,234,0.12)', alignItems: 'center', justifyContent: 'center' },
  noText: { fontFamily: F.display, fontSize: 10, color: C.paper },
  dot: { width: 9, height: 9, borderRadius: 5 },
  name: { width: 100, color: C.paper, fontWeight: '900', fontSize: 14 },
  track: { flex: 1, height: 9, borderRadius: 5, backgroundColor: 'rgba(247,243,234,0.1)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  ct: { width: 26, textAlign: 'right', fontFamily: F.display, fontSize: 17, color: C.paper },
  more: { color: C.muted, fontSize: 10, fontWeight: '900', marginLeft: 44 },
  tsHead: { fontFamily: F.display, fontSize: 16, color: C.yuru, marginTop: 14, marginBottom: 6 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { width: '48%', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,210,63,0.45)', backgroundColor: 'rgba(247,243,234,0.08)', paddingVertical: 6, paddingHorizontal: 9 },
  badgeTitle: { color: C.yuru, fontSize: 10, fontWeight: '900' },
  badgeWho: { color: C.paper, fontSize: 15, fontWeight: '900' },
  foot: { flexDirection: 'row', alignItems: 'baseline', gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(247,243,234,0.18)', paddingTop: 10, marginBottom: 30 },
  footLogo: { fontFamily: F.display, fontSize: 17, color: C.paper },
  footText: { color: C.muted, fontSize: 11, fontWeight: '900' },
});

/** 結果画面のひとこと。夜モードに入ってない人には噂として隠しモードをにおわせる */
const TIPS = ['罰ガチャの天使はだいたい7回に1回', 'リベンジ権は罰を食らった人だけのご褒美', '倍プッシュは勝てば誰かに罰、負けたら罰2倍', '設定の「向かい合わせ表示」で机の真ん中に置ける'];
function resultTip(night: Night) {
  if (!night && Math.random() < 0.6) return '噂：ロゴを3回連打すると、何かが起きるらしい';
  if (night === 'yoru' && ALLOW_SHINYA && Math.random() < 0.6) return '噂：夜の、さらに奥があるらしい';
  return '豆知識：' + TIPS[Math.floor(Math.random() * TIPS.length)];
}

const s = StyleSheet.create({
  why: { color: C.muted, fontSize: 11, fontWeight: '700' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tip: { flex: 1, color: C.muted, fontSize: 13, fontWeight: '700' },
  wrap: { padding: 16, paddingBottom: 40, gap: 18, maxWidth: 560, width: '100%', alignSelf: 'center' },
  shot: { gap: 18, backgroundColor: C.ink, padding: 4 },
  offscreen: { position: 'absolute', left: -2000, top: 0, width: 360, height: 640 },
  brand: { fontFamily: F.display, fontSize: 28, color: C.yuru },
  share: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 16, backgroundColor: '#ff6f6f',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  shareText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  head: { fontFamily: F.display, fontSize: 52, lineHeight: 60, color: C.blood, marginTop: 12 },
  sub: { color: C.muted, fontWeight: '700' },
  mvp: {
    backgroundColor: C.yuru, borderRadius: 20, padding: 22, gap: 4,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 0, shadowOffset: { width: 0, height: 10 }, elevation: 6,
  },
  pc: { width: 12, height: 12, borderRadius: 6 },
  mvpLabel: { color: C.ink, fontSize: 11, fontWeight: '900', letterSpacing: 3 },
  mvpName: { fontFamily: F.display, fontSize: 40, lineHeight: 48, color: C.ink },
  mvpCount: { color: C.ink, fontWeight: '700' },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(247,243,234,0.16)' },
  no: { width: 28, color: C.muted, fontWeight: '900' },
  name: { flex: 1, color: C.paper, fontWeight: '900' },
  ct: { fontFamily: F.display, color: C.paper },
  row: { flexDirection: 'row', gap: 10 },
  ngRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderLeftWidth: 6, backgroundColor: 'rgba(247,243,234,0.06)' },
  ngName: { color: C.paper, fontWeight: '900', fontSize: 15, flexShrink: 1 },
  ngWord: { color: C.paper, fontFamily: F.display, fontSize: 22 },
  h2: { color: C.muted, fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  titles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  title: { flexBasis: '48%', flexGrow: 1, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', gap: 2 },
  titleName: { color: C.yuru, fontWeight: '900', fontSize: 12 },
  titleWho: { fontFamily: F.display, color: C.paper, fontSize: 20, lineHeight: 26 },
  titleDesc: { color: C.muted, fontSize: 11, fontWeight: '700' },
  ghost: { flex: 1, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(247,243,234,0.16)', padding: 16, alignItems: 'center' },
  ghostText: { color: C.paper, fontWeight: '900' },
  again: { flex: 1, borderRadius: 14, backgroundColor: C.paper, padding: 16, alignItems: 'center' },
  againText: { fontFamily: F.display, fontSize: 20, color: C.ink },
});
