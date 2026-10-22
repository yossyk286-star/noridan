import { useEffect, useRef, useState, type ReactNode } from 'react';
import { iniFit, initialOf } from '../lib/game';
import { Tap } from '../components/Tap';
import { Animated, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, F, LEVEL_LABEL, LEVEL_SUB, colorOf } from '../theme';
import { Icon } from '../components/Icon';
import { ALLOW_SHINYA } from '../lib/game';
import { useSeen } from '../lib/coach';
import { HELP } from '../lib/help';
import { play } from '../lib/sound';
import type { Level, Member, Mode, Night } from '../types';
import type { IconName } from '../components/Icon';
import { load, save } from '../lib/storage';
import { MODE_TITLE } from '../components/ModeParts';

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
      <Text style={[s.dotText, { fontSize: size * 0.44 }, iniFit(name)]}>{name}</Text>
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
  const [addMsg, setAddMsg] = useState('');
  const ok = members.length >= 2;
  const others = (groups ?? []).filter((g) => g.map((m) => m.name).join() !== members.map((m) => m.name).join());

  /** 名前を入れてEnterでどんどん追加 */
  const add = () => {
    const n = name.trim().slice(0, 10);
    if (!n) return;
    const base = isExample ? [] : members;
    // 同じ名前・13人目は入れへん（投票や順位で誰か分からんようになるので）。理由はひとこと出す
    const err = base.length >= MAX ? `${MAX}人までやで` : base.some((m) => m.name === n) ? `「${n}」はもうおるで。ちょっと変えて入れて` : '';
    setAddMsg(err);
    if (err) return;
    onMembers([...base, { name: n }]);
    setName('');
    setTimeout(() => input.current?.focus(), 0);
  };
  const toggleNg = (i: number) => onMembers(members.map((m, j) => (j === i ? { ...m, ng: !m.ng } : m)));
  // 性別：押したらその性別、もう一回押したら未設定に戻る
  const setSex = (i: number, v: 'm' | 'f') =>
    onMembers(members.map((m, j) => {
      if (j !== i) return m;
      const { sex, ...rest } = m;
      return sex === v ? rest : { ...rest, sex: v };
    }));
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
            onChangeText={(t) => { setName(t); if (addMsg) setAddMsg(""); }}
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
        {!!addMsg && <Text style={s.addMsg} accessibilityRole="alert">{addMsg}</Text>}

        {isExample && <Text style={s.note}>↓は例。自分らの名前に入れ替えてな</Text>}

        {members.map((m, i) => (
          <View key={`${m.name}-${i}`} style={s.mem}>
            <Dot i={i} name={initialOf(members, i)} />
            <Text style={[s.memName, { flex: 1 }]} numberOfLines={1}>{m.name}</Text>
            <View style={s.sex} accessibilityLabel={`${m.name}の性別`}>
              {(['m', 'f'] as const).map((v, k) => {
                const on = m.sex === v;
                return (
                  <Tap key={v} onPress={() => setSex(i, v)} accessibilityState={{ selected: on }} style={[s.sexBtn, k > 0 && s.sexSep, on && { backgroundColor: v === 'm' ? '#3ec7ff' : '#ff5aa5' }]}>
                    <Text style={[s.sexText, on && { color: C.ink }]}>{v === 'm' ? '男' : '女'}</Text>
                  </Tap>
                );
              })}
            </View>
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
            <Dot i={i} name={initialOf(members, i)} size={26} />
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
      <ModeTabs members={members} night={night} onStart={onStart} />

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

// 遊び方の一覧（タブで分ける）。cat: basic=定番 / phone=スマホで勝負 / talk=話す・ノリ / brain=頭を使う / deep=深夜。min=最低人数、ok=下ネタOKの人の最低人数、t=目安時間
type Cat = 'basic' | 'phone' | 'talk' | 'brain' | 'deep';
const MODE_LIST: { m: Mode; ic: IconName; cat: Cat; t: string; min?: number; ok?: number }[] = [
  { m: 'odai', ic: 'cards', cat: 'basic', t: '好きなだけ' },
  { m: 'king', ic: 'king', cat: 'basic', t: '1回2分', min: 3 },
  { m: 'sugoroku', ic: 'dice', cat: 'basic', t: '15〜30分' },
  { m: 'memory', ic: 'grid', cat: 'basic', t: '10分' },
  { m: 'tilt', ic: 'tilt', cat: 'phone', t: '1人30秒' },
  { m: 'shake', ic: 'shake', cat: 'phone', t: '1人15秒' },
  { m: 'stop', ic: 'stop', cat: 'phone', t: '1人20秒' },
  { m: 'reflex', ic: 'reflex', cat: 'phone', t: '1回戦3分' },
  { m: 'voice', ic: 'voice', cat: 'phone', t: '1回戦3分' },
  { m: 'rtap', ic: 'rtap', cat: 'phone', t: '1回戦2分' },
  { m: 'bpass', ic: 'bpass', cat: 'phone', t: '1回戦2分' },
  { m: 'deko', ic: 'deko', cat: 'phone', t: '1人60秒' },
  { m: 'whack', ic: 'whack', cat: 'phone', t: '1人15秒' },
  { m: 'ngword', ic: 'mute', cat: 'talk', t: '10分〜' },
  { m: 'doubt', ic: 'doubt', cat: 'talk', t: '1人2分', min: 3 },
  { m: 'homeru', ic: 'heart', cat: 'talk', t: '1回2分' },
  { m: 'gesture', ic: 'hand', cat: 'talk', t: '1人60秒', min: 3 },
  { m: 'face', ic: 'face', cat: 'talk', t: '1回戦5分', min: 3 },
  { m: 'draw', ic: 'draw', cat: 'talk', t: '1周5分', min: 3 },
  { m: 'wolf', ic: 'wolf', cat: 'talk', t: '1回戦5分', min: 3 },
  { m: 'quiz', ic: 'quiz', cat: 'brain', t: '10問5分' },
  { m: 'ito', ic: 'num', cat: 'brain', t: '1問3分' },
  { m: 'hilo', ic: 'hilo', cat: 'brain', t: '1回戦2分' },
  { m: 'pittari', ic: 'target', cat: 'brain', t: '1問3分', min: 3 },
  { m: 'vote', ic: 'vote', cat: 'brain', t: '1問2分', min: 3 },
  { m: 'blind', ic: 'blind', cat: 'deep', t: '1回1分', ok: 3 },
  { m: 'pocky', ic: 'pocky', cat: 'deep', t: '1回1分', ok: 2 },
  { m: 'tickle', ic: 'tickle', cat: 'deep', t: '1回30秒', ok: 2 },
  { m: 'hug', ic: 'hug', cat: 'deep', t: '1回30秒', ok: 2 },
];
const TABS: [string, string][] = [['fav', '★ よく遊ぶ'], ['all', 'すべて'], ['basic', '定番'], ['phone', 'スマホで勝負'], ['talk', '話す・ノリ'], ['brain', '頭を使う'], ['deep', '深夜']];

/** 遊んだ回数を数える（「よく遊ぶ」タブ用）。App がゲームを始める時に呼ぶ */
export async function countPlay(m: Mode) {
  const v = await load<Record<string, number>>('nd_plays', {});
  const pl = v && typeof v === 'object' ? v : {};
  pl[m] = (pl[m] ?? 0) + 1;
  save('nd_plays', pl);
}

function ModeTabs({ members, night, onStart }: { members: Member[]; night: Night; onStart: (m: Mode) => void }) {
  const [plays, setPlays] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<string | null>(null);
  useEffect(() => {
    load<Record<string, number>>('nd_plays', {}).then((v) => setPlays(v && typeof v === 'object' ? v : {}));
    load<string | null>('nd_tab', null).then((v) => setTab(v));
  }, []);
  const deep = night === 'shinya';
  const list = MODE_LIST.filter((x) => x.cat !== 'deep' || deep);
  const favs = list.filter((x) => (plays[x.m] ?? 0) > 0).sort((a, b) => plays[b.m] - plays[a.m]).slice(0, 6);
  const tabs = TABS.filter(([k]) => (k !== 'deep' || deep) && (k !== 'fav' || favs.length));
  const cur = tabs.some(([k]) => k === tab) ? tab! : favs.length ? 'fav' : 'all';
  const shown = cur === 'fav' ? favs : cur === 'all' ? list : list.filter((x) => x.cat === cur);
  const okN = members.filter((m) => !m.ng).length;
  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
        {tabs.map(([k, t]) => {
          const on = k === cur;
          const isDeep = k === 'deep';
          return (
            <Tap key={k} onPress={() => { setTab(k); save('nd_tab', k); }} accessibilityState={{ selected: on }} style={[s.tab, isDeep && { borderWidth: 1.5, borderColor: C.deep }, on && { backgroundColor: isDeep ? C.deep : C.yuru }]}>
              <Text style={[s.tabText, isDeep && { color: C.deep }, on && { color: isDeep ? '#fff' : C.ink }]}>{t}</Text>
            </Tap>
          );
        })}
      </ScrollView>
      <View style={s.grid}>
        {shown.map((x) => {
          const why = x.min && members.length < x.min ? `${x.min}人から遊べる` : x.ok && okN < x.ok ? `下ネタOKの人が${x.ok}人から` : '';
          return (
            <Tap key={x.m} onPress={() => onStart(x.m)} disabled={!!why} style={({ pressed }) => [s.card2, x.cat === 'deep' && { borderWidth: 2, borderColor: C.deep }, { opacity: why ? 0.45 : 1, transform: [{ translateY: pressed ? 3 : 0 }] }]}>
              <View style={s.cardTop}>
                <View style={s.modeIc2}><Icon name={x.ic} color={C.ink} size={20} /></View>
                <Text style={s.time}>{x.t}</Text>
              </View>
              <Text style={s.cardTitle}>{MODE_TITLE[x.m]}</Text>
              <Text style={s.cardDesc}>{why || HELP[x.m].desc}</Text>
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

function NightAsk({ kind, onOk, onCancel }: { kind: 'yoru' | 'shinya'; onOk: () => void; onCancel: () => void }) {
  if (kind === 'shinya')
    return (
      <ScrollView contentContainerStyle={s.wrap}>
        <Text style={[s.h2, { color: C.deep, marginTop: 24 }]}>さらに奥へ…</Text>
        <Neon color={C.deep} style={s.nightTitle}>深夜モード</Neon>
        <Neon color={C.deep} style={[s.nightTitle, { fontSize: 28, lineHeight: 34, marginTop: -6 }]}>（エロがりモード）</Neon>
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
  tab: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(247,243,234,0.08)' },
  tabText: { color: C.muted, fontWeight: '900', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  card2: { width: '48.5%', minHeight: 120, padding: 12, borderRadius: 16, backgroundColor: C.paper, gap: 4, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 0, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modeIc2: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,18,16,0.08)' },
  time: { fontSize: 10, fontWeight: '900', color: '#8d857a', backgroundColor: 'rgba(20,18,16,0.06)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  cardTitle: { fontSize: 17, fontWeight: '900', color: C.ink },
  cardDesc: { fontSize: 11, lineHeight: 16, color: '#5d564c' },
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
  sex: { flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 999, overflow: 'hidden' },
  sexBtn: { width: 30, height: 28, alignItems: 'center', justifyContent: 'center' },
  sexSep: { borderLeftWidth: 1, borderLeftColor: 'rgba(247,243,234,0.16)' },
  sexText: { color: C.muted, fontSize: 12, fontWeight: '900' },
  ngOn: { backgroundColor: C.night, borderColor: C.night },
  ngText: { color: C.muted, fontSize: 11, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    color: C.paper, fontSize: 16, padding: 13, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', backgroundColor: 'rgba(247,243,234,0.06)',
  },
  addMsg: { color: '#ff6b6b', fontSize: 13, fontWeight: '800', marginTop: -4 },
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
