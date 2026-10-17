import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tap } from './Tap';
import { C } from '../theme';
import { Icon, type IconName } from './Icon';

type Props = {
  visible: boolean;
  meta: string;
  flipped: boolean;
  onFlip: () => void;
  onEnd: () => void;
  onRules: () => void;
  onSettings: () => void;
  onQuit: () => void;
  onClose: () => void;
  /** ルール早見表の説明（モードごと） */
  rulesSub?: string;
};

/** ゲーム中の「⋯」メニュー。画面をスッキリさせるために、たまにしか使わん操作はここに寄せる */
export default function GameMenu({ visible, meta, flipped, onFlip, onEnd, onRules, onSettings, onQuit, onClose, rulesSub }: Props) {
  const item = (icon: IconName, title: string, sub: string, onPress: () => void, extra?: { danger?: boolean; state?: string }) => (
    <Tap
      style={({ pressed }) => [s.item, pressed && { opacity: 0.7 }]}
      onPress={() => {
        onClose();
        onPress();
      }}
    >
      <Icon name={icon} color={extra?.danger ? '#ff6b62' : C.paper} />
      <View style={{ flex: 1 }}>
        <Text style={[s.title, extra?.danger && { color: '#ff6b62' }]}>{title}</Text>
        <Text style={s.sub}>{sub}</Text>
      </View>
      {extra?.state && <Text style={s.state}>{extra.state}</Text>}
    </Tap>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.back} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.grip} />
          <Text style={s.meta}>{meta}</Text>
          {item('flip', '上下反転', '向かいの人に見せる', onFlip, { state: flipped ? 'ON' : 'OFF' })}
          {item('book', 'ルール早見表', rulesSub ?? '倍プッシュ・時限爆弾・リベンジ権…', onRules)}
          {item('flag', '結果発表', 'ここで終わって戦犯を発表', onEnd)}
          {item('gear', '設定', '効果音・読み上げ・遊び方', onSettings)}
          {item('exit', 'ゲームをやめる', '罰の記録は消える', onQuit, { danger: true })}
          <Tap style={s.ghost} onPress={onClose}>
            <Text style={s.ghostText}>閉じる</Text>
          </Tap>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1d1a17', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 34, gap: 8, width: '100%', maxWidth: 560, alignSelf: 'center' },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(247,243,234,0.25)', alignSelf: 'center', marginBottom: 6 },
  meta: { color: C.muted, fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, backgroundColor: 'rgba(247,243,234,0.06)' },
  title: { color: C.paper, fontWeight: '900', fontSize: 16 },
  sub: { color: C.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  state: { color: C.paper, fontSize: 12, fontWeight: '900', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(247,243,234,0.1)', overflow: 'hidden' },
  ghost: { borderWidth: 2, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 4 },
  ghostText: { color: C.paper, fontWeight: '900' },
});
