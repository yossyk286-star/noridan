import { useEffect, useRef, useState } from 'react';
import { Tap } from '../components/Tap';
import { Animated, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, F, LEVEL_LABEL, LEVEL_SUB, colorOf } from '../theme';
import { Icon } from '../components/Icon';
import type { Level, Member, Mode, Night } from '../types';

type Props = {
  members: Member[];
  isExample: boolean;
  level: Level;
  night: Night;
  onMembers: (m: Member[]) => void;
  onLevel: (l: Level) => void;
  onNight: (n: Night) => void;
  onStart: (m: Mode) => void;
  onSettings: () => void;
  /** 前回遊んだメンバー（最大3組） */
  groups?: Member[][];
  /** 2=モード選択から始める（ゲームから戻ってきた時） */
  initialStep?: 1 | 2;
};

const LEVELS: Level[] = ['yurume', 'futsu', 'jigoku'];
const MAX = 12;
const TAPS = 5;

export default function HomeScreen(props: Props) {
  const { night, onNight } = props;
  const [step, setStep] = useState<1 | 2>(props.initialStep ?? 1);
  const [asking, setAsking] = useState(false);
  const taps = useRef<number[]>([]);

  /** 隠しコマンド：ロゴを素早く5回タップ */
  const tapLogo = () => {
    const now = Date.now();
    taps.current = taps.current.filter((x) => now - x < 2500).concat(now);
    if (taps.current.length >= TAPS) {
      taps.current = [];
      setAsking(true);
    }
  };

  if (asking) return <NightAsk onOk={() => { onNight('yoru'); setAsking(false); }} onCancel={() => setAsking(false)} />;
  return step === 1 ? (
    <StepMembers {...props} night={night} onLogo={tapLogo} onNext={() => setStep(2)} />
  ) : (
    <StepMode {...props} onBack={() => setStep(1)} />
  );
}

function Dot({ i, name, size = 34 }: { i: number; name: string; size?: number }) {
  return (
    <View style={[s.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: colorOf(i) }]}>
      <Text style={[s.dotText, { fontSize: size * 0.44 }]}>{name.slice(0, 1)}</Text>
    </View>
  );
}

function Steps({ n, label }: { n: 1 | 2; label: string }) {
  return (
    <View style={s.steps}>
      <View style={[s.stepBar, s.stepOn]} />
      <View style={[s.stepBar, n === 2 && s.stepOn]} />
      <Text style={s.stepLabel}>{label}</Text>
    </View>
  );
}

function Gear({ onPress }: { onPress: () => void }) {
  return (
    <Tap onPress={onPress} style={s.iconBtn} accessibilityLabel="設定">
      <Icon name="gear" color={C.paper} />
    </Tap>
  );
}

function StepMembers({ members, isExample, night, groups, onMembers, onSettings, onLogo, onNext }: Props & { onLogo: () => void; onNext: () => void }) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [neta, setNeta] = useState('');
  const input = useRef<TextInput>(null);
  const ok = members.length >= 2;
  const others = (groups ?? []).filter((g) => g.map((m) => m.name).join() !== members.map((m) => m.name).join());

  /** 名前を入れてEnterでどんどん追加 */
  const add = () => {
    const n = name.trim();
    if (!n) return;
    const base = isExample ? [] : members;
    if (base.length >= MAX) return;
    onMembers([...base, { name: n, neta: '' }]);
    setName('');
    setTimeout(() => input.current?.focus(), 0);
  };
  const startEdit = (i: number) => {
    setEditing(i);
    setNeta(members[i].neta);
  };
  const saveNeta = () => {
    if (editing === null) return;
    onMembers(members.map((m, j) => (j === editing ? { ...m, neta: neta.trim() } : m)));
    setEditing(null);
  };
  const toggleNg = (i: number) => onMembers(members.map((m, j) => (j === i ? { ...m, ng: !m.ng } : m)));
  const logoColor = night === 'shinya' ? C.deep : night ? C.night : C.yuru;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={s.top}>
          <View style={{ flex: 1 }}>
            <Tap onPress={onLogo} accessibilityLabel="ノリダン" haptic={false} scaleTo={0.98}>
              {night ? (
                <Neon color={logoColor} style={s.logo}>ノリダン</Neon>
              ) : (
                <Text style={[s.logo, { color: logoColor }]} numberOfLines={1} adjustsFontSizeToFit>ノリダン</Text>
              )}
            </Tap>
            <Text style={[s.catch, night && { color: logoColor, textShadowColor: logoColor, textShadowRadius: 8 }]}>{night === 'shinya' ? '深夜モード 発動中' : night ? '夜モード 発動中' : 'ノリで断れない飲み会ゲーム'}</Text>
          </View>
          <Gear onPress={onSettings} />
        </View>
        <Steps n={1} label="メンバー" />

        <View style={s.row}>
          <TextInput
            ref={input}
            style={[s.input, { flex: 1 }]}
            value={name}
            onChangeText={setName}
            maxLength={10}
            placeholder="名前を入れて＋（続けて入れられる）"
            placeholderTextColor={C.muted}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={add}
          />
          <Tap style={s.plus} onPress={add} accessibilityLabel="追加">
            <Icon name="plus" color={C.ink} size={24} />
          </Tap>
        </View>

        <View style={s.memHead}>
          <Text style={s.h2}>今日のメンバー {members.length}人</Text>
          {isExample && (
            <Tap onPress={() => onMembers([])} hitSlop={8}>
              <Text style={s.textBtn}>例を全部消す</Text>
            </Tap>
          )}
        </View>
        {isExample && <Text style={s.note}>↓は例。自分らの名前に入れ替えてな</Text>}

        {members.map((m, i) =>
          editing === i ? (
            <View key={`${m.name}-${i}`} style={[s.mem, { borderColor: C.yuru }]}>
              <Dot i={i} name={m.name} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.memName}>{m.name}</Text>
                <TextInput
                  style={s.netaInput}
                  value={neta}
                  onChangeText={setNeta}
                  maxLength={20}
                  autoFocus
                  placeholder="イジりネタ（例：すぐ寝る）"
                  placeholderTextColor={C.muted}
                  returnKeyType="done"
                  onSubmitEditing={saveNeta}
                />
              </View>
              <Tap style={s.okBtn} onPress={saveNeta}>
                <Text style={s.okText}>完了</Text>
              </Tap>
            </View>
          ) : (
            <View key={`${m.name}-${i}`} style={s.mem}>
              <Dot i={i} name={m.name} />
              <Tap style={{ flex: 1 }} onPress={() => startEdit(i)} accessibilityLabel={`${m.name}のイジりネタを編集`}>
                <Text style={s.memName}>{m.name}</Text>
                <Text style={s.memNeta}>{m.neta ? m.neta : 'タップでイジりネタを追加'}</Text>
              </Tap>
              {night && (
                <Tap onPress={() => toggleNg(i)} accessibilityState={{ selected: !!m.ng }} style={[s.ng, m.ng && s.ngOn]}>
                  <Text style={[s.ngText, m.ng && { color: C.ink }]}>{m.ng ? '下ネタNG' : '下ネタOK'}</Text>
                </Tap>
              )}
              <Tap onPress={() => onMembers(members.filter((_, j) => j !== i))} accessibilityLabel={`${m.name}を外す`} style={s.x}>
                <Icon name="close" color={C.muted} size={18} />
              </Tap>
            </View>
          ),
        )}

        {others.length > 0 && (
          <View style={{ gap: 8, marginTop: 6 }}>
            <Text style={s.h2}>前回のメンバー</Text>
            {others.map((g, k) => (
              <Tap key={k} style={s.group} onPress={() => onMembers(g.map((m) => ({ ...m })))}>
                <Icon name="users" color={C.muted} size={20} />
                <Text style={s.groupText} numberOfLines={1}>{g.map((m) => m.name).join('・')}</Text>
              </Tap>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={s.dock}>
        <Tap style={[s.big, !ok && { opacity: 0.35 }]} disabled={!ok} onPress={onNext}>
          <Text style={s.bigText}>{ok ? `この${members.length}人で遊ぶ` : '2人以上入れてな'}</Text>
        </Tap>
      </View>
    </View>
  );
}

function StepMode({ members, level, night, onLevel, onStart, onSettings, onBack }: Props & { onBack: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.top}>
        <Tap onPress={onBack} style={s.iconBtn} accessibilityLabel="メンバーに戻る">
          <Icon name="back" color={C.paper} />
        </Tap>
        <Steps n={2} label="モード" />
        <Gear onPress={onSettings} />
      </View>

      <View style={s.mchips}>
        {members.map((m, i) => (
          <View key={i} style={s.mchip}>
            <Dot i={i} name={m.name} size={26} />
            <Text style={s.mchipText}>{m.name}</Text>
          </View>
        ))}
      </View>

      <Text style={s.h2}>地獄度</Text>
      <View style={s.row}>
        {LEVELS.map((l) => {
          const on = level === l;
          const look = l === 'yurume' ? { bg: C.yuru, fg: C.ink } : l === 'futsu' ? { bg: C.futsu, fg: C.ink } : { bg: '#000', fg: C.blood };
          return (
            <Tap
              key={l}
              onPress={() => onLevel(l)}
              accessibilityState={{ selected: on }}
              style={[
                s.lv,
                { backgroundColor: look.bg, opacity: on ? 1 : 0.5, transform: [{ translateY: on ? -3 : 0 }] },
                l === 'jigoku' && { borderWidth: 2, borderColor: C.blood },
              ]}
            >
              <Text style={[s.lvText, { color: look.fg }]}>{LEVEL_LABEL[l]}</Text>
              <Text style={[s.lvSub, { color: look.fg }]}>{LEVEL_SUB[l]}</Text>
            </Tap>
          );
        })}
      </View>

      <Text style={s.h2}>何で遊ぶ？</Text>
      <ModeCard title="アホお題" desc="スマホを回して、出たお題をやるだけ" onPress={() => onStart('odai')} />
      <ModeCard title="すごろく" desc="あるあるマスを進む。1番にゴールで終了" onPress={() => onStart('sugoroku')} />

      {night && (
        <Text style={[s.nightNote, { color: night === 'shinya' ? C.deep : C.night }]}>
          {night === 'shinya' ? '深夜モード：お題が全部下ネタ' : '夜モード：下ネタがたまに混ざる'}
        </Text>
      )}
      <Text style={s.note}>お酒は20歳になってから。飲めへん人はソフドリでOK、無理は絶対させんこと。</Text>
    </ScrollView>
  );
}

function ModeCard({ title, desc, onPress }: { title: string; desc: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} style={({ pressed }) => [s.mode, { transform: [{ translateY: pressed ? 4 : 0 }] }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.modeTitle}>{title}</Text>
        <Text style={s.modeDesc}>{desc}</Text>
      </View>
      <View style={s.go}>
        <Text style={s.goText}>開始</Text>
      </View>
    </Tap>
  );
}

function NightAsk({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <Text style={[s.h2, { color: C.night, marginTop: 24 }]}>隠しコマンド発動</Text>
      <Neon color={C.night} style={s.nightTitle}>夜モード</Neon>
      <Text style={s.nightLead}>恋愛・下ネタ寄りのお題が混ざるモード。夜はしゃべるだけ、深夜はハグや手つなぎくらいの軽いタッチもあり（脱ぐ系はなし）。嫌なお題は罰なしでパスできる。</Text>
      <View style={{ gap: 8 }}>
        {['全員20歳以上で、全員がOKしてること', '夜お題は「無理」を押したら罰なしでパスできる', 'メンバーごとに「下ネタNG」にできる。NGの人には振られへん'].map((r) => (
          <Text key={r} style={s.nightRule}>・{r}</Text>
        ))}
      </View>
      <View style={s.row}>
        <Tap style={s.ghostBtn} onPress={onCancel}>
          <Text style={s.ghostText}>やめとく</Text>
        </Tap>
        <Tap style={[s.big, { flex: 1 }]} onPress={onOk}>
          <Text style={s.bigText}>全員OK</Text>
        </Tap>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  logo: { fontFamily: F.display, fontSize: 84, lineHeight: 92 },
  catch: { color: C.muted, fontWeight: '900', fontSize: 13, letterSpacing: 4, marginTop: 4 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(247,243,234,0.08)', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: C.paper, fontSize: 22, fontWeight: '900' },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  stepBar: { width: 22, height: 4, borderRadius: 2, backgroundColor: 'rgba(247,243,234,0.16)' },
  stepOn: { backgroundColor: C.yuru },
  stepLabel: { color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  h2: { color: C.muted, fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  mem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingRight: 6, borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 12 },
  dot: { alignItems: 'center', justifyContent: 'center' },
  dotText: { color: C.ink, fontWeight: '900' },
  memName: { color: C.paper, fontSize: 17, fontWeight: '700' },
  memNeta: { color: C.muted, fontSize: 12 },
  x: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  xText: { color: C.muted, fontSize: 20 },
  ng: { borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  ngOn: { backgroundColor: C.night, borderColor: C.night },
  ngText: { color: C.muted, fontSize: 11, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    color: C.paper, fontSize: 16, padding: 13, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', backgroundColor: 'rgba(247,243,234,0.06)',
  },
  addBtn: { backgroundColor: C.paper, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  plus: { width: 54, borderRadius: 14, backgroundColor: C.yuru, alignItems: 'center', justifyContent: 'center' },
  memHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  textBtn: { color: C.futsu, fontSize: 12, fontWeight: '900' },
  netaInput: { color: C.paper, fontSize: 15, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', backgroundColor: 'rgba(247,243,234,0.08)' },
  okBtn: { backgroundColor: C.yuru, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  okText: { color: C.ink, fontWeight: '900' },
  group: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(247,243,234,0.16)' },
  groupText: { flex: 1, color: C.paper, fontWeight: '900', fontSize: 14 },
  addText: { color: C.ink, fontWeight: '900' },
  dock: { padding: 16, paddingBottom: 20, maxWidth: 560, width: '100%', alignSelf: 'center' },
  big: {
    backgroundColor: C.paper, borderRadius: 16, paddingVertical: 18, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  bigText: { fontFamily: F.display, fontSize: 21, color: C.ink },
  mchips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mchip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 4, paddingRight: 12, borderRadius: 999, backgroundColor: 'rgba(247,243,234,0.08)' },
  mchipText: { color: C.paper, fontWeight: '900', fontSize: 14 },
  lv: { flex: 1, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  lvText: { fontWeight: '900', fontSize: 17 },
  lvSub: { fontSize: 10, fontWeight: '700', opacity: 0.75, marginTop: 2 },
  mode: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.paper, borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  modeTitle: { fontFamily: F.display, fontSize: 28, color: C.ink },
  modeDesc: { fontSize: 12, color: '#5d564c', lineHeight: 18 },
  go: { backgroundColor: C.ink, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  goText: { fontFamily: F.display, fontSize: 15, color: C.paper },
  nightNote: { fontSize: 12, fontWeight: '900' },
  note: { color: C.muted, fontSize: 12, lineHeight: 20 },
  nightTitle: { fontFamily: F.display, fontSize: 72, lineHeight: 80, color: C.night },
  nightLead: { color: C.paper, fontSize: 16, lineHeight: 28, fontWeight: '700' },
  nightRule: { color: C.muted, fontSize: 14, lineHeight: 22 },
  ghostBtn: { flex: 1, borderWidth: 2, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 14, padding: 14, alignItems: 'center', justifyContent: 'center' },
  ghostText: { color: C.paper, fontWeight: '900' },
});

/** 夜モード中のロゴ：ネオン管。たまにチカチカする */
function Neon({ color, style, children }: { color: string; style: object; children: string }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const blink = (ms: number) => [
      Animated.timing(v, { toValue: 0.42, duration: 50, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.delay(ms),
    ];
    const loop = Animated.loop(Animated.sequence([Animated.delay(1300), ...blink(90), ...blink(2600), ...blink(1800)]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.Text
      style={[style, { color: '#fff', opacity: v, textShadowColor: color, textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 } }]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {children}
    </Animated.Text>
  );
}
