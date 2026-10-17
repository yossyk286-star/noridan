import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Tap } from '../components/Tap';
import { Animated, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, F, LEVEL_LABEL, LEVEL_SUB, colorOf } from '../theme';
import { Icon } from '../components/Icon';
import { ALLOW_SHINYA } from '../lib/game';
import { useSeen } from '../lib/coach';
import { HELP } from '../lib/help';
import { play } from '../lib/sound';
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
const TAPS = 3;

export default function HomeScreen(props: Props) {
  const { night, onNight } = props;
  const [step, setStep] = useState<1 | 2>(props.initialStep ?? 1);
  /** 確認画面：夜モード（1回目）か深夜モード（夜モード中にもう一回） */
  const [asking, setAsking] = useState<false | 'yoru' | 'shinya'>(false);
  const [tease, setTease] = useState(0);
  const taps = useRef<number[]>([]);

  /** 隠しコマンド：ロゴを素早く3回タップ。1回タップするごとにロゴが震えて光る */
  const tapLogo = () => {
    const now = Date.now();
    taps.current = taps.current.filter((x) => now - x < 2500).concat(now);
    const n = taps.current.length;
    if (n < TAPS) {
      setTease((t) => t + 1);
      play('tick');
    }
    if (n >= TAPS) {
      taps.current = [];
      if (!night) setAsking('yoru');
      else if (night === 'yoru' && ALLOW_SHINYA) setAsking('shinya');
      else return; // もう一番奥
      play('warn');
    }
  };

  if (asking)
    return (
      <NightAsk
        kind={asking}
        onOk={() => {
          onNight(asking);
          setAsking(false);
        }}
        onCancel={() => setAsking(false)}
      />
    );
  return step === 1 ? (
    <StepMembers {...props} night={night} tease={tease} onLogo={tapLogo} onNext={() => setStep(2)} />
  ) : (
    <StepMode {...props} onBack={() => setStep(1)} onAskDeep={() => setAsking('shinya')} />
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

function StepMembers({ members, isExample, night, groups, tease, onMembers, onSettings, onLogo, onNext }: Props & { tease: number; onLogo: () => void; onNext: () => void }) {
  const [name, setName] = useState('');
  const input = useRef<TextInput>(null);
  const ok = members.length >= 2;
  const others = (groups ?? []).filter((g) => g.map((m) => m.name).join() !== members.map((m) => m.name).join());

  /** 名前を入れてEnterでどんどん追加 */
  const add = () => {
    const n = name.trim();
    if (!n) return;
    const base = isExample ? [] : members;
    if (base.length >= MAX) return;
    onMembers([...base, { name: n }]);
    setName('');
    setTimeout(() => input.current?.focus(), 0);
  };
  const toggleNg = (i: number) => onMembers(members.map((m, j) => (j === i ? { ...m, ng: !m.ng } : m)));
  const logoColor = night === 'shinya' ? C.deep : night ? C.night : C.yuru;
  // ロゴをタップするたびに一瞬光る
  const [glow, setGlow] = useState(false);
  useEffect(() => {
    if (!tease) return;
    setGlow(true);
    const t = setTimeout(() => setGlow(false), 420);
    return () => clearTimeout(t);
  }, [tease]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={s.top}>
          <View style={{ flex: 1 }}>
            <Tap onPress={onLogo} accessibilityLabel="ノリダン" haptic={false} scaleTo={0.98}>
              <Wiggle trigger={tease}>
                {night ? (
                  <Neon color={glow ? C.deep : logoColor} style={s.logo}>ノリダン</Neon>
                ) : (
                  <Text style={[s.logo, { color: logoColor }, glow && { textShadowColor: C.night, textShadowRadius: 22, textShadowOffset: { width: 0, height: 0 } }]} numberOfLines={1} adjustsFontSizeToFit>ノリダン</Text>
                )}
              </Wiggle>
            </Tap>
            <Text style={[s.catch, night && { color: logoColor, textShadowColor: logoColor, textShadowRadius: 8 }]}>{night === 'shinya' ? '深夜モード 発動中' : night ? '夜モード 発動中' : 'ノリで断れない飲み会ゲーム'}</Text>
            <Whisper night={night} />
          </View>
          <Gear onPress={onSettings} />
        </View>
        <Steps n={1} label="メンバー" />
        <MembersGuide />

        <View style={s.memHead}>
          <StepHead num="①" title="メンバー" sub={`${members.length}人`} />
          {isExample && (
            <Tap onPress={() => onMembers([])} hitSlop={8}>
              <Text style={s.textBtn}>例を全部消す</Text>
            </Tap>
          )}
        </View>
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

        {isExample && <Text style={s.note}>↓は例。自分らの名前に入れ替えてな</Text>}

        {members.map((m, i) => (
          <View key={`${m.name}-${i}`} style={s.mem}>
            <Dot i={i} name={m.name} />
            <Text style={[s.memName, { flex: 1 }]} numberOfLines={1}>{m.name}</Text>
            {night && (
              <Tap onPress={() => toggleNg(i)} accessibilityState={{ selected: !!m.ng }} style={[s.ng, m.ng && s.ngOn]}>
                <Text style={[s.ngText, m.ng && { color: C.ink }]}>{m.ng ? '下ネタNG' : '下ネタOK'}</Text>
              </Tap>
            )}
            <Tap onPress={() => onMembers(members.filter((_, j) => j !== i))} accessibilityLabel={`${m.name}を外す`} style={s.x}>
              <Icon name="close" color={C.muted} size={18} />
            </Tap>
          </View>
        ))}

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

function StepMode({ members, level, night, onLevel, onNight, onStart, onSettings, onBack, onAskDeep }: Props & { onBack: () => void; onAskDeep: () => void }) {
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
      <ModeGuide />

      <StepHead num="②" title="地獄度" sub="お題・罰の攻め具合" />
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

      <StepHead num="③" title="遊び方" />
      <ModeCard icon="cards" title="アホお題" desc={HELP.odai.desc} onPress={() => onStart('odai')} />
      <ModeCard icon="dice" title="すごろく" desc={HELP.sugoroku.desc} onPress={() => onStart('sugoroku')} />
      <ModeCard icon="grid" title="神経衰弱" desc={HELP.memory.desc} onPress={() => onStart('memory')} />
      <ModeCard icon="num" title="価値観ナンバー" desc={HELP.ito.desc} onPress={() => onStart('ito')} />
      <ModeCard icon="hand" title="早押しジェスチャー" desc={members.length < 3 ? '3人から遊べる' : HELP.gesture.desc} disabled={members.length < 3} onPress={() => onStart('gesture')} />
      <ModeCard icon="heart" title="褒め殺し" desc={HELP.homeru.desc} onPress={() => onStart('homeru')} />
      <ModeCard icon="mute" title="NGワード" desc={HELP.ngword.desc} onPress={() => onStart('ngword')} />
      <ModeCard icon="vote" title="ぶっちゃけ投票" desc={members.length < 3 ? '3人から遊べる' : HELP.vote.desc} disabled={members.length < 3} onPress={() => onStart('vote')} />

      {night && (
        <View style={{ gap: 10 }}>
          <Text style={s.h2}>夜の深さ</Text>
          <View style={s.row}>
            {(['off', 'yoru', 'shinya'] as const).filter((v) => v !== 'shinya' || ALLOW_SHINYA).map((v) => {
              const on = night === v;
              const col = v === 'shinya' ? C.deep : v === 'off' ? 'rgba(247,243,234,0.35)' : C.night;
              return (
                <Tap
                  key={v}
                  // 深夜に入る時は確認画面をはさむ
                  onPress={() => (v === 'off' ? onNight(false) : v === 'shinya' && night !== 'shinya' ? onAskDeep() : onNight(v))}
                  accessibilityState={{ selected: on }}
                  style={[s.nightLv, { borderColor: col }, on && { backgroundColor: col }]}
                >
                  <Text style={[s.nightLvText, on && { color: C.ink }]}>{v === 'off' ? '通常' : v === 'yoru' ? '夜' : '深夜'}</Text>
                  <Text style={[s.nightLvSub, on && { color: C.ink }]}>{v === 'off' ? '夜モードをやめる' : v === 'yoru' ? 'たまに下ネタ' : night === 'shinya' ? '全部下ネタ' : '？？？'}</Text>
                </Tap>
              );
            })}
          </View>
        </View>
      )}
      <Text style={s.note}>お酒は20歳になってから。飲めへん人はソフドリでOK、無理は絶対させんこと。</Text>
    </ScrollView>
  );
}

/** 準備画面の番号つき見出し（① メンバー → ② 地獄度 → ③ 遊び方） */
function StepHead({ num, title, sub }: { num: string; title: string; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <Text style={s.stepNum}>{num}</Text>
      <Text style={s.stepTitle}>{title}</Text>
      {!!sub && <Text style={s.stepSub}>{sub}</Text>}
    </View>
  );
}

function ModeCard({ icon, title, desc, onPress, disabled }: { icon: 'cards' | 'dice' | 'grid' | 'num' | 'hand' | 'heart' | 'mute' | 'vote'; title: string; desc: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Tap onPress={onPress} disabled={disabled} style={({ pressed }) => [s.mode, { opacity: disabled ? 0.45 : 1, transform: [{ translateY: pressed ? 4 : 0 }] }]}>
      <View style={s.modeIc}>
        <Icon name={icon} color={C.ink} size={24} />
      </View>
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

function NightAsk({ kind, onOk, onCancel }: { kind: 'yoru' | 'shinya'; onOk: () => void; onCancel: () => void }) {
  if (kind === 'shinya')
    return (
      <ScrollView contentContainerStyle={s.wrap}>
        <Text style={[s.h2, { color: C.deep, marginTop: 24 }]}>さらに奥へ…</Text>
        <Neon color={C.deep} style={s.nightTitle}>深夜モード</Neon>
        <Text style={s.nightLead}>お題が全部下ネタになる。ハグや手つなぎくらいの軽いタッチもあり（脱ぐ系はなし）。嫌なお題は罰なしでパスできる。</Text>
        <View style={{ gap: 8 }}>
          {['全員20歳以上で、全員がOKしてること', '触られるのが嫌な人は「下ネタNG」に。NGの人には振られへん', '戻りたくなったらモード選択の「夜」で戻れる'].map((r) => (
            <Text key={r} style={s.nightRule}>・{r}</Text>
          ))}
        </View>
        <View style={s.row}>
          <Tap style={s.ghostBtn} onPress={onCancel}>
            <Text style={s.ghostText}>やめとく</Text>
          </Tap>
          <Tap style={[s.big, { flex: 1, backgroundColor: C.deep }]} onPress={onOk}>
            <Text style={s.bigText}>全員OK</Text>
          </Tap>
        </View>
      </ScrollView>
    );
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
  guide: { gap: 6, padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,210,63,0.1)', borderWidth: 1, borderColor: 'rgba(255,210,63,0.4)' },
  guideHead: { color: C.yuru, fontWeight: '900', fontSize: 14 },
  guideText: { color: C.paper, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  guideBtn: { alignSelf: 'flex-end', borderRadius: 999, backgroundColor: C.yuru, paddingVertical: 8, paddingHorizontal: 14 },
  guideBtnText: { color: C.ink, fontSize: 12, fontWeight: '900' },
  wrap: { padding: 16, paddingBottom: 40, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  logo: { fontFamily: F.display, fontSize: 84, lineHeight: 92 },
  catch: { color: C.muted, fontWeight: '900', fontSize: 13, letterSpacing: 1, marginTop: 4 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(247,243,234,0.08)', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: C.paper, fontSize: 22, fontWeight: '900' },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  stepBar: { width: 22, height: 4, borderRadius: 2, backgroundColor: 'rgba(247,243,234,0.16)' },
  stepOn: { backgroundColor: C.yuru },
  stepLabel: { color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  h2: { color: C.muted, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  stepNum: { color: C.yuru, fontSize: 18, fontWeight: '900' },
  stepTitle: { color: C.paper, fontSize: 18, fontWeight: '900' },
  stepSub: { color: C.muted, fontSize: 12, fontWeight: '700' },
  modeIc: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(20,18,16,0.08)', alignItems: 'center', justifyContent: 'center' },
  mem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingRight: 6, borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 12 },
  dot: { alignItems: 'center', justifyContent: 'center' },
  dotText: { color: C.ink, fontWeight: '900' },
  memName: { color: C.paper, fontSize: 17, fontWeight: '700' },
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
  modeTitle: { fontSize: 22, fontWeight: '900', color: C.ink },
  modeDesc: { fontSize: 12, color: '#5d564c', lineHeight: 18 },
  go: { backgroundColor: C.ink, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  goText: { fontFamily: F.display, fontSize: 15, color: C.paper },
  nightNote: { fontSize: 12, fontWeight: '900' },
  nightLv: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  nightLvText: { color: C.paper, fontWeight: '900', fontSize: 16 },
  nightLvSub: { color: C.paper, fontSize: 10, fontWeight: '700' },
  whisper: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  whisperText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
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

/** 昼間でもたまにヒントを出す（起動ごとに固定） */
const WHISPER_DAY = Math.random() < 0.35;

/** 隠しモードのヒント（ささやき）。夜モード前は「ロゴに秘密がある」、夜モード中は「まだ奥がある」 */
function Whisper({ night }: { night: Night }) {
  const v = useRef(new Animated.Value(0)).current;
  const h = new Date().getHours();
  const late = h >= 21 || h < 5;
  const text =
    night === 'yoru' && ALLOW_SHINYA ? 'まだ奥がある…ロゴをもう一回'
    : !night && late ? '夜が更けてきた…ロゴ、連打してみ？'
    : !night && WHISPER_DAY ? 'ロゴには秘密があるらしい'
    : '';
  useEffect(() => {
    if (!text) return;
    const loop = Animated.sequence([
      Animated.delay(600),
      Animated.timing(v, { toValue: 0.85, duration: 800, useNativeDriver: true }),
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 0.5, duration: 1600, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.95, duration: 1600, useNativeDriver: true }),
      ])),
    ]);
    loop.start();
    return () => loop.stop();
  }, [text]);
  if (!text) return null;
  const col = night === 'yoru' ? C.deep : C.night;
  return (
    <Animated.View style={[s.whisper, { opacity: v }]}>
      <Icon name="moon" color={col} size={14} />
      <Text style={[s.whisperText, { color: col }]}>{text}</Text>
    </Animated.View>
  );
}

/** ロゴ連打で震える */
function Wiggle({ trigger, children }: { trigger: number; children: ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!trigger) return;
    v.setValue(0);
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(v, { toValue: -1, duration: 70, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [trigger]);
  const rotate = v.interpolate({ inputRange: [-1, 1], outputRange: ['-2deg', '2deg'] });
  const translateX = v.interpolate({ inputRange: [-1, 1], outputRange: [-3, 3] });
  return <Animated.View style={{ transform: [{ rotate }, { translateX }] }}>{children}</Animated.View>;
}

/** メンバー登録の初回だけ出す説明（「わかった」で二度と出えへん） */
function MembersGuide() {
  const { seen, markSeen } = useSeen();
  if (seen.members) return null;
  return (
    <View style={s.guide}>
      <Text style={s.guideHead}>遊ぶ人の名前を入れよう</Text>
      <Text style={s.guideText}>1. 名前を入れて「＋」を押す（12人まで）</Text>
      <Text style={s.guideText}>2. 2人以上入れたら「遊ぶ」を押す</Text>
      <Tap onPress={() => markSeen('members')} style={s.guideBtn}>
        <Text style={s.guideBtnText}>わかった</Text>
      </Tap>
    </View>
  );
}

/** モード選択の初回だけ出す説明 */
function ModeGuide() {
  const { seen, markSeen } = useSeen();
  if (seen.mode) return null;
  return (
    <View style={s.guide}>
      <Text style={s.guideHead}>遊び方を選ぼう</Text>
      <Text style={s.guideText}>1. 地獄度はお題の攻め具合。迷ったら「普通」</Text>
      <Text style={s.guideText}>2. 遊び方を押したら、まず説明が出る</Text>
      <Text style={s.guideText}>3. やめたい時は「⋯」→結果発表</Text>
      <Tap onPress={() => markSeen('mode')} style={s.guideBtn}>
        <Text style={s.guideBtnText}>わかった</Text>
      </Tap>
    </View>
  );
}
