import { useState } from 'react';
import type React from 'react';
import { LayoutAnimation, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from 'react-native';
import { Icon } from './Icon';
import { isCalm, Switch, SwipeSheet } from './Motion';
import { Tap } from './Tap';
import { ALLOW_SHINYA } from '../lib/game';
import { useSeen } from '../lib/coach';
import { C, F } from '../theme';
import type { Night } from '../types';
import { GoHome } from './Extras';
import { LiveSettings } from './Live';

type Props = {
  visible: boolean;
  sound: boolean;
  vol: number;
  vibe: boolean;
  onVol: (v: number) => void;
  onVibe: (on: boolean) => void;
  dual: boolean;
  handoff: boolean;
  onHandoff: (on: boolean) => void;
  sober: boolean;
  onSober: (on: boolean) => void;
  noTouch: boolean;
  onNoTouch: (on: boolean) => void;
  passOn: boolean;
  onPass: (on: boolean) => void;
  gamble: boolean;
  onGamble: (on: boolean) => void;
  goHome: string | null;
  onGoHome: (t: string | null) => void;
  water: boolean;
  onWater: (on: boolean) => void;
  voice: boolean;
  night: Night;
  onSound: (on: boolean) => void;
  onDual: (on: boolean) => void;
  onVoice: (on: boolean) => void;
  onNight: (n: Night) => void;
  /** ホーム画面の時だけ：夜モードの確認画面を出す */
  onNightAsk?: () => void;
  onClose: () => void;
};

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

/** まとまりごとに畳むグループ（開くとスッと伸びる） */
function Group({ title, count, sub, children }: { title: string; count: number; sub: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.grp}>
      <Tap style={s.grpHead} accessibilityState={{ expanded: open }} onPress={() => { if (!isCalm()) LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity')); setOpen(!open); }}>
        <View style={{ flex: 1 }}>
          <Text style={s.toggleText}>{title}<Text style={s.grpCount}>{`  ${count}こ`}</Text></Text>
          <Text style={s.toggleSub}>{sub}</Text>
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }], opacity: 0.6 }}><Icon name="chev" color={C.paper} size={20} /></View>
      </Tap>
      {open && <View style={{ gap: 8, padding: 10, paddingTop: 0 }}>{children}</View>}
    </View>
  );
}

/** 歯車から開く設定。夜モード（20歳以上）もここからオンにする */
export default function SettingsSheet({ visible, sound, vol, vibe, onVol, onVibe, dual, handoff, onHandoff, sober, onSober, noTouch, onNoTouch, passOn, onPass, gamble, onGamble, goHome, onGoHome, water, onWater, voice, night, onSound, onDual, onVoice, onNight, onNightAsk, onClose }: Props) {
  const { resetSeen } = useSeen();
  const [privacy, setPrivacy] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.back} onPress={onClose}>
        <SwipeSheet style={s.sheet} onClose={onClose}>
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            <Text style={s.title}>設定</Text>
            <Text style={s.sec}>よく変えるもの</Text>
            <Toggle label="効果音" sub="めくる音・ガチャ・爆発" on={sound} onPress={() => onSound(!sound)} />
            {sound && (
              <View style={s.volRow} accessibilityLabel="音量">
                <Text style={s.volLabel}>音量</Text>
                {([[1, '小'], [2, '中'], [3, '大']] as const).map(([v, t]) => (
                  <Tap key={v} onPress={() => onVol(v)} accessibilityState={{ selected: vol === v }} style={[s.volBtn, vol === v && s.volOn]}>
                    <Text style={[s.volText, vol === v && { color: C.ink }]}>{t}</Text>
                  </Tap>
                ))}
              </View>
            )}
            <Toggle label="お酒なし" sub="「飲む」罰やお題を出さへん" on={sober} onPress={() => onSober(!sober)} />
            <Toggle label="お題の読み上げ" sub="札が出たら声で読む（爆弾の中身は読まへん）" on={voice} onPress={() => onVoice(!voice)} />
            <Text style={s.sec}>まとまりごと</Text>
            <Group title="遊びのルール" count={5} sub="体に触るのなし・パス券・駆け引き・帰る時間・お水タイム">
              <Toggle label="駆け引きあり" sub="ハイ&ローで降りられる・ロシアンタップで1回パス" on={gamble} onPress={() => onGamble(!gamble)} />
              <Toggle label="体に触るのなし" sub="くすぐり・ハグ・肩もみ系の罰と命令を出さへん" on={noTouch} onPress={() => onNoTouch(!noTouch)} />
              <Toggle label="パス券" sub="1人1回、罰をゆるい罰に替えられる" on={passOn} onPress={() => onPass(!passOn)} />
              <GoHome time={goHome} onChange={onGoHome} />
              <Toggle label="お水タイム" sub="30分ごとに「全員お水をひと口」のお知らせ" on={water} onPress={() => onWater(!water)} />
            </Group>
            <Group title="演出" count={6} sub="実況・入場・伏せて出す・振ってガチャ・カメラ・メーター">
              <LiveSettings Toggle={Toggle} hideHead />
            </Group>
            <Group title="音と画面" count={3} sub="バイブ・番の交代・向かい合わせ">
              <Toggle label="バイブ" sub="罰・爆発・ボタンでブルッ" on={vibe} onPress={() => onVibe(!vibe)} />
              <Toggle label="番の交代画面" sub="アホお題で「つぎは○○」を1枚はさむ" on={handoff} onPress={() => onHandoff(!handoff)} />
              <Toggle label="向かい合わせ表示" sub="机の真ん中に置いて両側から読める" on={dual} onPress={() => onDual(!dual)} />
            </Group>
            {!night && (
              <View style={[s.nightBox, { borderColor: 'rgba(182,156,255,0.6)' }]}>
                <View style={s.nightHeadRow}>
                  <Text style={s.nightHead}>夜モード</Text>
                  <Text style={s.age}>20歳以上</Text>
                </View>
                <Text style={s.note}>恋愛・下ネタ寄りのお題が混ざる。全員が20歳以上で、全員OKの時だけ。</Text>
                {onNightAsk ? (
                  <Tap style={s.ghost} onPress={onNightAsk}>
                    <Text style={s.ghostText}>夜モードをオンにする</Text>
                  </Tap>
                ) : (
                  <Text style={s.note}>ゲームが終わってから、最初の画面の設定でオンにできる</Text>
                )}
              </View>
            )}
            {night && (
              <View style={s.nightBox}>
                <View style={s.nightHeadRow}>
                  <Text style={s.nightHead}>夜モード</Text>
                  <Text style={s.age}>20歳以上</Text>
                </View>
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
            <Tap
              style={s.ghost}
              onPress={() => {
                resetSeen();
                onClose();
              }}
            >
              <Text style={s.ghostText}>ひとこと説明をもう1回出す</Text>
              <Text style={s.ghostSub}>ゲーム中に出る「わかった」の説明がまた出る</Text>
            </Tap>
            <Tap style={s.ghost} onPress={onClose}>
              <Text style={s.ghostText}>閉じる</Text>
            </Tap>
            <Tap onPress={() => setPrivacy(true)} hitSlop={8}>
              <Text style={s.foot}>プライバシーポリシー・お酒は20歳から。飲めへん人はソフドリでOK</Text>
            </Tap>
          </ScrollView>
        </SwipeSheet>
      </Pressable>
      <Modal visible={privacy} transparent animationType="slide" onRequestClose={() => setPrivacy(false)}>
        <Pressable style={s.back} onPress={() => setPrivacy(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <ScrollView contentContainerStyle={{ gap: 10 }}>
              <Text style={s.title}>プライバシーポリシー</Text>
              {PRIVACY.map(([h, t]) => (
                <View key={h} style={{ gap: 2 }}>
                  <Text style={s.toggleText}>{h}</Text>
                  <Text style={s.note}>{t}</Text>
                </View>
              ))}
              <Tap style={s.ghost} onPress={() => setPrivacy(false)}>
                <Text style={s.ghostText}>閉じる</Text>
              </Tap>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

/** プライバシーポリシー（Web版の /privacy.html と同じ中身） */
const PRIVACY: [string, string][] = [
  ['集める情報', 'ノリダンは、個人を特定できる情報を集めません。アカウント登録もありません。'],
  ['端末の中だけに保存するもの', '入力したメンバーの名前・性別・「下ネタNG」の設定、効果音などの設定、よく遊ぶモードの回数。端末の中にだけ保存して、外には送りません。アプリを消すと一緒に消えます。'],
  ['マイク・モーションセンサー', '「声デカ選手権」はマイクで声の大きさだけを測ります。録音・保存・送信はしません。「傾けたらアウト」「全力シェイク」「おでこ当て」は端末の傾きや動きを使います。これも保存・送信はしません。'],
  ['結果画像の共有', '「画像でシェア」は、作った画像を端末の共有機能に渡すだけです。どこに送るかは使う人が選びます。'],
  ['広告・解析', '広告や利用状況の解析ツールは使っていません。'],
  ['お酒について', 'お酒は20歳になってから。飲めない人はソフトドリンクで遊べます。無理に飲ませないでください。'],
];

function Toggle({ label, sub, on, onPress }: { label: string; sub: string; on: boolean; onPress: () => void }) {
  return (
    <Tap style={s.toggle} onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleText}>{label}</Text>
        <Text style={s.toggleSub}>{sub}</Text>
      </View>
      <Switch on={on} />
    </Tap>
  );
}

const s = StyleSheet.create({
  grp: { borderRadius: 14, backgroundColor: 'rgba(247,243,234,0.05)' },
  grpHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  grpCount: { color: C.muted, fontSize: 12, fontWeight: '800' },
  sec: { color: C.paper, opacity: 0.6, fontSize: 12, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  volRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  volLabel: { color: C.muted, fontSize: 13, fontWeight: '800', paddingHorizontal: 4 },
  volBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', alignItems: 'center' },
  volOn: { backgroundColor: C.cream, borderColor: 'transparent' },
  volText: { color: C.paper, fontSize: 14, fontWeight: '900' },
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1d1a17', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 34, maxHeight: '88%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(247,243,234,0.25)', alignSelf: 'center' },
  title: { fontFamily: F.display, fontSize: 24, color: C.paper },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)' },
  toggleText: { color: C.paper, fontWeight: '900', fontSize: 15 },
  toggleSub: { color: C.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  state: { color: C.paper, fontWeight: '900', fontSize: 12, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(247,243,234,0.1)', overflow: 'hidden' },
  stateOn: { backgroundColor: C.yuru, color: C.ink },
  nightBox: { borderWidth: 1, borderColor: C.night, borderRadius: 12, padding: 14, gap: 10 },
  nightHead: { color: C.night, fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  nightHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  age: { color: C.ink, backgroundColor: C.night, fontSize: 12, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  foot: { color: C.muted, fontSize: 12, fontWeight: '700', textAlign: 'center', textDecorationLine: 'underline' },
  row: { flexDirection: 'row', gap: 8 },
  lv: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  lvText: { color: C.paper, fontWeight: '900', fontSize: 16 },
  lvSub: { color: C.paper, fontSize: 12, fontWeight: '700' },
  note: { color: C.muted, fontSize: 12, lineHeight: 20 },
  ghost: { borderWidth: 2, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 14, padding: 14, alignItems: 'center' },
  ghostText: { color: C.paper, fontWeight: '900' },
  ghostSub: { color: C.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
});
