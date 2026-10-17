import { useState, type ReactElement } from 'react';
import { Tap } from './Tap';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { C, F } from '../theme';
import { Capsule } from './Fx';

type Slide = { title: string; text: { t: string; b?: boolean }[]; art: () => ReactElement };

const MODES = ['アホお題', 'すごろく', '神経衰弱', '価値観ナンバー', 'ジェスチャー', '褒め殺し', 'NGワード', 'ぶっちゃけ投票'];
const SLIDES: Slide[] = [
  {
    title: '名前を入れて、\n遊び方を選ぶ',
    text: [{ t: '遊ぶ人の名前を入れて、遊び方を選ぶだけ。遊び方は' }, { t: '8つ', b: true }, { t: '。どれも始める前に' }, { t: '説明が出る', b: true }, { t: 'から大丈夫。' }],
    art: () => (
      <View style={s.grid}>
        {MODES.map((m) => (
          <View key={m} style={s.modeChip}>
            <Text style={s.modeChipText}>{m}</Text>
          </View>
        ))}
      </View>
    ),
  },
  {
    title: '負けたら罰ガチャ',
    text: [{ t: '負けた人は' }, { t: '罰ガチャ', b: true }, { t: 'を引く。ドクロなら罰、たまに出る' }, { t: '天使', b: true }, { t: 'なら罰なし。飲む罰は全部ソフドリでOK。' }],
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
    title: '困ったら「⋯」',
    text: [{ t: '画面のフチの色は' }, { t: 'いまの人の色', b: true }, { t: '。右上の' }, { t: '「⋯」', b: true }, { t: 'で、ルール・結果発表・設定が開ける。「〇〇だけ見て」の時は、他の人は見たらアカン。' }],
    art: () => (
      <View style={{ width: 240, gap: 8 }}>
        {['📖 ルール早見表', '🏁 結果発表', '⚙️ 設定'].map((m) => (
          <View key={m} style={s.menuRow}>
            <Text style={s.menuText}>{m}</Text>
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
  gachaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: 280 },
  gachaWho: { color: C.muted, fontSize: 12, fontWeight: '900' },
  gachaText: { color: C.paper, fontFamily: F.display, fontSize: 20, lineHeight: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', maxWidth: 320, justifyContent: 'center' },
  modeChip: { width: '47%', paddingVertical: 10, borderRadius: 12, backgroundColor: C.paper, alignItems: 'center' },
  modeChipText: { color: C.ink, fontWeight: '900', fontSize: 14 },
  menuRow: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#26221e' },
  menuText: { color: C.paper, fontWeight: '900', fontSize: 15 },
});
