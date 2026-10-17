import { useState, type ReactElement } from 'react';
import { Tap } from './Tap';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { C, F, alpha } from '../theme';
import { Capsule } from './Fx';

type Slide = { title: string; text: { t: string; b?: boolean }[]; art: () => ReactElement };

const SLIDES: Slide[] = [
  {
    title: 'お題をやって、\nセーフかアウトか',
    text: [
      { t: 'スマホをテーブルの真ん中に置くか、順番に回す。画面のフチの色が' },
      { t: 'いまの番の人の色', b: true },
      { t: '。出たお題をやって、やり切ったら' },
      { t: 'セーフ', b: true },
      { t: '、逃げたりできんかったら' },
      { t: 'アウト', b: true },
      { t: '。' },
    ],
    art: () => (
      <View style={{ width: 240, gap: 10 }}>
        <View style={[s.miniCard, { aspectRatio: undefined, transform: [] }]}>
          <Text style={s.miniKind}>ひとり</Text>
          <Text style={s.miniText}>
            <Text style={{ backgroundColor: alpha(C.yuru, 0.55) }}>たく</Text>、今日のMVPを発表しろ
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.miniKind}>← アウト</Text>
            <Text style={s.miniKind}>セーフ →</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={[s.miniBtn, { backgroundColor: '#e8202a' }]}>
            <Text style={[s.miniBtnText, { color: '#fff' }]}>アウト</Text>
            <Text style={[s.miniBtnSub, { color: '#fff' }]}>たくに罰</Text>
          </View>
          <View style={[s.miniBtn, { backgroundColor: C.paper }]}>
            <Text style={[s.miniBtnText, { color: C.ink }]}>セーフ！</Text>
            <Text style={[s.miniBtnSub, { color: C.ink }]}>→ 次へ</Text>
          </View>
        </View>
      </View>
    ),
  },
  {
    title: '罰はガチャで決まる',
    text: [
      { t: 'アウトの人は' },
      { t: '罰ガチャ', b: true },
      { t: 'で中身が決まる。ドクロなら罰、たまに出る天使なら帳消し。ドクロを引いた人は' },
      { t: 'リベンジ権 ↺', b: true },
      { t: 'をゲットして、次の自分のお題を1回だけ誰かに押し付けられる。札を右にスワイプでセーフ、左でアウトでもOK。' },
    ],
    art: () => (
      <View style={s.gachaRow}>
        <Capsule color={C.futsu} delay={100} />
        <View style={{ flex: 1 }}>
          <Text style={s.gachaWho}>まゆの罰</Text>
          <Text style={s.gachaText}>次の番まで語尾が「ござる」</Text>
        </View>
      </View>
    ),
  },
  {
    title: 'たまに起きること',
    text: [{ t: 'この4つは突然やってくる。初めて出た時は画面にひとこと説明が出るから安心してな。' }],
    art: () => (
      <View style={s.grid}>
        {[
          ['倍プッシュ', 'お題を見る前に賭ける。勝てば誰かに罰'],
          ['時限爆弾', '仕掛け人だけが知るNG行動。やったら爆発で罰'],
          ['緊急指令', '数ターン続くルール。破った人は「違反者に罰」'],
          ['当てはまらん', '恋人おらん等のお題は、罰なしで誰かに回せる'],
        ].map(([h, b]) => (
          <View key={h} style={s.tile}>
            <Text style={s.tileHead}>{h}</Text>
            <Text style={s.tileBody}>{b}</Text>
          </View>
        ))}
      </View>
    ),
  },
];

export default function Tutorial({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const done = () => {
    setI(0);
    onDone();
  };
  const slide = SLIDES[i];
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={done}>
      <View style={s.wrap}>
        <View style={s.top}>
          <View style={s.dots}>
            {SLIDES.map((_, k) => (
              <View key={k} style={[s.dot, k <= i && { backgroundColor: C.yuru }]} />
            ))}
          </View>
          <Tap onPress={done} hitSlop={10}>
            <Text style={s.skip}>スキップ</Text>
          </Tap>
        </View>
        <View style={s.art} key={i}>{slide.art()}</View>
        <Text style={s.step}>{i + 1} / {SLIDES.length}</Text>
        <Text style={s.title}>{slide.title}</Text>
        <Text style={s.body}>
          {slide.text.map((x, k) => (
            <Text key={k} style={x.b ? s.bold : undefined}>{x.t}</Text>
          ))}
        </Text>
        <Tap style={s.big} onPress={() => (last ? done() : setI(i + 1))}>
          <Text style={s.bigText}>{last ? 'はじめる' : '次へ'}</Text>
        </Tap>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.ink, padding: 20, paddingTop: 56, paddingBottom: 36, gap: 18, width: '100%', maxWidth: 560, alignSelf: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 26, height: 5, borderRadius: 3, backgroundColor: 'rgba(247,243,234,0.18)' },
  skip: { color: C.muted, fontWeight: '900' },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  step: { color: C.yuru, fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  title: { fontFamily: F.display, fontSize: 36, lineHeight: 44, color: C.paper },
  body: { color: '#cfc7bb', fontSize: 15, lineHeight: 27, fontWeight: '700' },
  bold: { color: C.paper, fontWeight: '900' },
  big: { backgroundColor: C.yuru, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  bigText: { fontFamily: F.display, fontSize: 22, color: C.ink },
  miniCard: { width: 240, aspectRatio: 3 / 4, borderRadius: 18, backgroundColor: C.cream, padding: 18, justifyContent: 'center', gap: 10, borderWidth: 5, borderColor: C.futsu, transform: [{ rotate: '-4deg' }] },
  miniKind: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: C.muted },
  miniBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  miniBtnText: { fontFamily: F.display, fontSize: 17 },
  miniBtnSub: { fontSize: 10, fontWeight: '900', opacity: 0.8 },
  miniText: { fontFamily: F.display, fontSize: 22, lineHeight: 32, color: C.ink },
  gachaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: 280 },
  gachaWho: { color: C.muted, fontSize: 12, fontWeight: '900' },
  gachaText: { color: C.paper, fontFamily: F.display, fontSize: 20, lineHeight: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%' },
  tile: { width: '47%', borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 14, padding: 14, gap: 6 },
  tileHead: { color: C.paper, fontWeight: '900', fontSize: 15 },
  tileBody: { color: C.muted, fontSize: 12, lineHeight: 18 },
});
