import { useEffect, useRef, useState } from 'react';
import { Tap } from '../components/Tap';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
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
};

export default function ResultScreen({ members, pen, turns, stats, night, mode, level, onHome, onAgain }: Props) {
  const rows = members.map((m, i) => ({ m, i, n: pen[i] ?? 0 })).sort((a, b) => b.n - a.n);
  const top = rows[0]?.n ?? 0;
  const who = top === 0 ? '該当者なし' : rows.filter((r) => r.n === top).map((r) => r.m.name).join('・');
  const ts = titles(pen, stats);
  const [tip] = useState(() => resultTip(night ?? false));
  const { voice } = usePrefs();
  useEffect(() => {
    play('fanfare');
    if (voice) speak(top === 0 ? '本日の戦犯は、該当者なし。平和すぎる' : `本日の戦犯は、${who.replace(/・/g, 'と')}。罰${top}回`);
  }, []);

  const shot = useRef<View>(null);
  const [msg, setMsg] = useState('');

  /** 結果を画像にして共有シートを出す（そのままストーリーに貼れる） */
  const share = async () => {
    try {
      const uri = await captureRef(shot, { format: 'png', quality: 1 });
      if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '本日の戦犯' });
      } else setMsg('この端末では共有できへんかった。スクショで撮ってな');
    } catch {
      setMsg('画像にできへんかった。スクショで撮ってな');
    }
  };

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      {/* ここから下が画像になる */}
      <View ref={shot} collapsable={false} style={s.shot}>
      <Text style={s.brand}>ノリダン</Text>
      <Text style={s.head}>本日の戦犯</Text>
      <Text style={s.sub}>
        {mode === 'odai' ? 'アホお題' : 'すごろく'}・{LEVEL_LABEL[level]}・{turns}ターン
      </Text>

      <View style={s.mvp}>
        <Text style={s.mvpLabel}>MVP（悪い意味で）</Text>
        <Text style={s.mvpName}>{who}</Text>
        <Text style={s.mvpCount}>{top === 0 ? '全員セーフ。平和すぎる' : `罰 ${top}回`}</Text>
      </View>

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
  );
}

/** 結果画面のひとこと。夜モードに入ってない人には噂として隠しモードをにおわせる */
const TIPS = ['罰ガチャの天使はだいたい7回に1回', 'リベンジ権は罰を食らった人だけのご褒美', '倍プッシュは勝てば誰かに罰、負けたら罰2倍', 'スマホを振っても次のお題に進める', '設定の「向かい合わせ表示」で机の真ん中に置ける'];
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
