import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Tap } from './Tap';
import { ALLOW_SHINYA } from '../lib/game';
import { useSeen } from '../lib/coach';
import { C, F } from '../theme';
import type { Night } from '../types';

type Props = {
  visible: boolean;
  shake: boolean;
  sound: boolean;
  dual: boolean;
  voice: boolean;
  night: Night;
  onShake: (on: boolean) => void;
  onSound: (on: boolean) => void;
  onDual: (on: boolean) => void;
  onVoice: (on: boolean) => void;
  onNight: (n: Night) => void;
  onTutorial: () => void;
  onClose: () => void;
};

/** 歯車から開く設定。夜モードはONの時だけ出る（隠しコマンドなので存在は書かない） */
export default function SettingsSheet({ visible, shake, sound, dual, voice, night, onShake, onSound, onDual, onVoice, onNight, onTutorial, onClose }: Props) {
  const { resetSeen } = useSeen();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.back} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            <View style={s.grip} />
            <Text style={s.title}>設定</Text>
            <Toggle label="振ってルーレット" sub="振ったら次のお題・サイコロへ" on={shake} onPress={() => onShake(!shake)} />
            <Toggle label="効果音" sub="めくる音・ガチャ・爆発" on={sound} onPress={() => onSound(!sound)} />
            <Toggle label="お題の読み上げ" sub="札が出たら声で読む（爆弾の中身は読まへん）" on={voice} onPress={() => onVoice(!voice)} />
            <Toggle label="向かい合わせ表示" sub="机の真ん中に置いて両側から読める" on={dual} onPress={() => onDual(!dual)} />
            {night && (
              <View style={s.nightBox}>
                <Text style={s.nightHead}>夜モード</Text>
                {ALLOW_SHINYA && (
                  <View style={s.row}>
                    {(['yoru', 'shinya'] as const).map((v) => {
                      const on = night === v;
                      const col = v === 'shinya' ? C.deep : C.night;
                      return (
                        <Tap
                          key={v}
                          onPress={() => onNight(v)}
                          accessibilityState={{ selected: on }}
                          style={[s.lv, { borderColor: col, opacity: on ? 1 : 0.55 }, on && { backgroundColor: col }]}
                        >
                          <Text style={[s.lvText, on && { color: C.ink }]}>{v === 'yoru' ? '夜' : '深夜'}</Text>
                          <Text style={[s.lvSub, on && { color: C.ink }]}>{v === 'yoru' ? 'たまに下ネタ' : '全部下ネタ'}</Text>
                        </Tap>
                      );
                    })}
                  </View>
                )}
                <Text style={s.note}>夜はしゃべるだけ、深夜は軽いタッチあり（脱ぐは無し）。下ネタNGの人には振られへん。夜お題は「無理」で罰なしパス。</Text>
                <Tap style={s.ghost} onPress={() => { onNight(false); onClose(); }}>
                  <Text style={s.ghostText}>夜モードをやめる</Text>
                </Tap>
              </View>
            )}
            <Tap style={s.ghost} onPress={onTutorial}>
              <Text style={s.ghostText}>遊び方を見る</Text>
            </Tap>
            <Tap
              style={s.ghost}
              onPress={() => {
                resetSeen();
                onTutorial();
              }}
            >
              <Text style={s.ghostText}>説明をもう一回ぜんぶ出す</Text>
              <Text style={s.ghostSub}>メンバー登録・モード選択・ゲーム中のひとこと説明</Text>
            </Tap>
            <Tap style={s.ghost} onPress={onClose}>
              <Text style={s.ghostText}>閉じる</Text>
            </Tap>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Toggle({ label, sub, on, onPress }: { label: string; sub: string; on: boolean; onPress: () => void }) {
  return (
    <Tap style={s.toggle} onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleText}>{label}</Text>
        <Text style={s.toggleSub}>{sub}</Text>
      </View>
      <Text style={[s.state, on && s.stateOn]}>{on ? 'ON' : 'OFF'}</Text>
    </Tap>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1d1a17', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 34, maxHeight: '88%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(247,243,234,0.25)', alignSelf: 'center' },
  title: { fontFamily: F.display, fontSize: 24, color: C.paper },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)' },
  toggleText: { color: C.paper, fontWeight: '900', fontSize: 15 },
  toggleSub: { color: C.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  state: { color: C.paper, fontWeight: '900', fontSize: 12, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(247,243,234,0.1)', overflow: 'hidden' },
  stateOn: { backgroundColor: C.yuru, color: C.ink },
  nightBox: { borderWidth: 1, borderColor: C.night, borderRadius: 12, padding: 14, gap: 10 },
  nightHead: { color: C.night, fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  row: { flexDirection: 'row', gap: 8 },
  lv: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  lvText: { color: C.paper, fontWeight: '900', fontSize: 16 },
  lvSub: { color: C.paper, fontSize: 10, fontWeight: '700' },
  note: { color: C.muted, fontSize: 12, lineHeight: 20 },
  ghost: { borderWidth: 2, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 14, padding: 14, alignItems: 'center' },
  ghostText: { color: C.paper, fontWeight: '900' },
  ghostSub: { color: C.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
});
