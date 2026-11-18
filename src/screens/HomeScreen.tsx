import { TOD_COLOR, todNow } from '../lib/live';
import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { iniFit, initialOf } from '../lib/game';
import { Tap } from '../components/Tap';
import { Animated, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, F, LEVEL_LABEL, LEVEL_SUB, colorOf } from '../theme';
import { Icon } from '../components/Icon';
import { Pop, expandFrom, useBootOnce } from '../components/Motion';
import { ALLOW_SHINYA } from '../lib/game';
import { HELP } from '../lib/help';
import { usePrefs } from '../lib/prefs';
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
  /** 設定の「夜モードをオンにする」が押されたら増える（確認画面を出す合図） */
  nightAskReq?: number;
  /** モード選択の上に出す道具（帰る時間・幹事の道具・チーム戦） */
  tools?: React.ReactNode;
  /** 「前回のメンバー」に出すひとこと（前回の戦犯・通算） */
  lastNote?: string;
};

const LEVELS: Level[] = ['yurume', 'futsu', 'jigoku'];
const MAX = 12;

export default function HomeScreen(props: Props) {
  const { night, onNight, isExample, onMembers, nightAskReq } = props;
  const [step, setStep] = useState<1 | 2>(props.initialStep ?? 1);
  /** 確認画面：夜モード（設定から）か深夜モード（夜モード中に「深夜」を選んだ時） */
  const [asking, setAsking] = useState<false | 'yoru' | 'shinya'>(false);
  /** メンバーをいじったら「前回のメンバー」の大きいボタンは引っ込める */
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    if (nightAskReq) setAsking('yoru');
  }, [nightAskReq]);

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
    <StepMembers
      {...props}
      restored={!isExample && !edited}
      onMembers={(m) => {
        setEdited(true);
        onMembers(m);
      }}
      onNext={() => setStep(2)}
    />
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

function StepMembers({ members, isExample, night, groups, restored, onMembers, onSettings, onNext, lastNote }: Props & { restored: boolean; onNext: () => void }) {
  const [name, setName] = useState('');
  const input = useRef<TextInput>(null);
  const [addMsg, setAddMsg] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const ok = members.length >= 2;
  const others = (groups ?? []).filter((g) => g.map((m) => m.name).join() !== members.map((m) => m.name).join());
  const last = restored && ok; // 前回のメンバーがそのまま残ってる

  /** 名前を入れてEnterでどんどん追加 */
  const add = () => {
    const n = name.trim().slice(0, 10);
    if (!n) return;
    const base = isExample ? [] : members;
    // 同じ名前・13人目は入れへん（投票や順位で誰かわからへんようになるので）。理由はひとこと出す
    const err = base.length >= MAX ? `${MAX}人までやで` : base.some((m) => m.name === n) ? `「${n}」はもうおるで。ちょっと変えて入れて` : '';
    setAddMsg(err);
    if (err) return;
    onMembers([...base, { name: n }]);
    setName('');
    setTimeout(() => input.current?.focus(), 0);
  };
  const toggleNg = (i: number) => onMembers(members.map((m, j) => (j === i ? { ...m, ng: !m.ng } : m)));
  // 性別：押したらその性別、もう1回押したら未設定に戻る
  const setSex = (i: number, v: 'm' | 'f') =>
    onMembers(members.map((m, j) => {
      if (j !== i) return m;
      const { sex, ...rest } = m;
      return sex === v ? rest : { ...rest, sex: v };
    }));
  const boot = useBootOnce();
  const logoColor = night === 'shinya' ? C.deep : night ? C.night : C.yuru;
  // 夜が深まると画面も変わる（夜モードの時はそっちを優先）
  const tod = night ? null : todNow();
  const sel = open !== null && members[open] ? open : null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={s.top}>
          <View style={{ flex: 1 }}>
            {tod && <Text style={[s.todSub, { color: TOD_COLOR[tod.k] }]}>{tod.sub}</Text>}
            <Pop on={boot}>
              {night ? (
                <Neon color={logoColor} style={s.logo}>ノリダン</Neon>
              ) : (
                <Text style={[s.logo, { color: logoColor }]} numberOfLines={1} adjustsFontSizeToFit>ノリダン</Text>
              )}
            </Pop>
            <Text style={[s.catch, night && { color: logoColor, textShadowColor: logoColor, textShadowRadius: 8 }]}>{night === 'shinya' ? '深夜モード 発動中' : night ? '夜モード 発動中' : tod ? tod.line : 'ノリで断れない飲み会ゲーム'}</Text>
          </View>
          <Gear onPress={onSettings} />
        </View>

        {last && (
          <>
            <Pop on={boot} delay={180}><Tap style={s.lastGroup} onPress={onNext} accessibilityLabel="前回のメンバーでこのまま遊ぶ">
              <Text style={s.lastHead}>前回のメンバー</Text>
              <View style={s.lastRow}>
                {members.slice(0, 6).map((m, i) => (
                  <Pop key={i} on={boot} delay={240 + i * 50} style={s.lastDot}><Dot i={i} name={initialOf(members, i)} size={30} /></Pop>
                ))}
                <Text style={s.lastNames} numberOfLines={1}>{members.map((m) => m.name).join('・')}</Text>
              </View>
              {!!lastNote && <Text style={s.lastNote}>{lastNote}</Text>}
              <View style={s.lastGoRow}><Text style={s.lastGo}>このまま遊ぶ</Text><Icon name="play" color={C.ink} size={18} /></View>
            </Tap></Pop>
            <Text style={s.h2}>それか、メンバーを変える</Text>
          </>
        )}

        <View style={s.memHead}>
          <StepHead title="メンバー" sub={`${members.length}人`} />
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
            placeholder="名前を入れて Enter"
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

        <View style={s.chips}>
          {members.map((m, i) => (
            <View key={`${m.name}-${i}`} style={[s.chip, sel === i && { borderColor: colorOf(i) }]}>
              <Tap onPress={() => setOpen(sel === i ? null : i)} accessibilityLabel={`${m.name}の男女を選ぶ`} accessibilityState={{ expanded: sel === i }} style={s.chipName}>
                <Dot i={i} name={initialOf(members, i)} size={30} />
                <Text style={s.chipText} numberOfLines={1}>{m.name}</Text>
                {!!m.sex && <Text style={s.chipSub}>{m.sex === 'm' ? '男' : '女'}</Text>}
                {night && m.ng && <Text style={[s.chipSub, { color: C.night }]}>NG</Text>}
              </Tap>
              <Tap onPress={() => { setOpen(null); onMembers(members.filter((_, j) => j !== i)); }} accessibilityLabel={`${m.name}を外す`} style={s.x}>
                <Icon name="close" color={C.muted} size={15} />
              </Tap>
            </View>
          ))}
        </View>
        {sel !== null && (
          <View style={[s.detail, { borderColor: colorOf(sel) }]}>
            <Text style={[s.memName, { flex: 1 }]} numberOfLines={1}>{members[sel].name}</Text>
            <View style={s.sex} accessibilityLabel={`${members[sel].name}の性別`}>
              {(['m', 'f'] as const).map((v, k) => {
                const on = members[sel].sex === v;
                return (
                  <Tap key={v} onPress={() => setSex(sel, v)} accessibilityState={{ selected: on }} style={[s.sexBtn, k > 0 && s.sexSep, on && { backgroundColor: v === 'm' ? '#3ec7ff' : '#ff5aa5' }]}>
                    <Text style={[s.sexText, on && { color: C.ink }]}>{v === 'm' ? '男' : '女'}</Text>
                  </Tap>
                );
              })}
            </View>
            {night && (
              <Tap onPress={() => toggleNg(sel)} accessibilityState={{ selected: !!members[sel].ng }} style={[s.ng, members[sel].ng && s.ngOn]}>
                <Text style={[s.ngText, members[sel].ng && { color: C.ink }]}>{members[sel].ng ? '下ネタNG' : '下ネタOK'}</Text>
              </Tap>
            )}
          </View>
        )}
        <Text style={s.note}>{`名前を押すと 男/女${night ? '・下ネタNG' : ''} を選べる（深夜のペアゲームだけで使う。入れんでもOK）`}</Text>

        {others.length > 0 && (
          <View style={{ gap: 8, marginTop: 6 }}>
            <Text style={s.h2}>ほかのメンバー</Text>
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

function StepMode({ members, level, night, onLevel, onNight, onStart, onSettings, onBack, onAskDeep, tools }: Props & { onBack: () => void; onAskDeep: () => void }) {
  const hero = (() => {
    const t = night ? null : todNow();
    const e = t && t.hero !== 'odai' ? MODE_LIST.find((x) => x.m === t.hero) : null;
    if (!t || !e || (e.min && members.length < e.min)) return { m: 'odai' as Mode, label: '迷ったらこれ' };
    return { m: e.m, label: t.k === 'late' ? '深夜のおすすめ' : '今の時間のおすすめ' };
  })();
  const heroRef = useRef<View>(null);
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={[s.top, { alignItems: 'center' }]}>
        <Tap onPress={onBack} style={s.iconBtn} accessibilityLabel="メンバーに戻る">
          <Icon name="back" color={C.paper} />
        </Tap>
        <Tap onPress={onBack} style={s.memPill} accessibilityLabel="メンバーを変える">
          {members.slice(0, 6).map((m, i) => (
            <Dot key={i} i={i} name={initialOf(members, i)} size={28} />
          ))}
          <Text style={s.memPillText}>{members.length}人</Text>
          <Text style={s.memPillSub}>変える</Text>
        </Tap>
        <Gear onPress={onSettings} />
      </View>

      {/* 地獄度：細い切り替えスイッチ（お題・罰の攻め具合） */}
      <Text style={s.lvNote}>地獄度：お題と罰のキツさ</Text>
      <View style={s.seg} accessibilityLabel="地獄度（お題・罰の攻め具合）">
        {LEVELS.map((l) => {
          const on = level === l;
          const look = l === 'yurume' ? { bg: C.yuru, fg: C.ink } : l === 'futsu' ? { bg: C.futsu, fg: C.ink } : { bg: '#000', fg: C.blood };
          return (
            <Tap
              key={l}
              onPress={() => onLevel(l)}
              accessibilityState={{ selected: on }}
              style={[s.segBtn, on && { backgroundColor: look.bg }, on && l === 'jigoku' && { borderWidth: 2, borderColor: C.blood }]}
            >
              <Text style={[s.segText, on && { color: look.fg }]}>{LEVEL_LABEL[l]}</Text>
              <Text style={[s.segSub, on && { color: look.fg }]}>{LEVEL_SUB[l]}</Text>
            </Tap>
          );
        })}
      </View>

      {tools}
      {/* 迷ったらこれ（夜は時間でおすすめが変わる） */}
      <View ref={heroRef} collapsable={false}><Tap style={s.hero} onPress={() => go(heroRef, C.yuru, 22, () => onStart(hero.m))} accessibilityLabel={`${hero.label}：${MODE_TITLE[hero.m]}`}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.heroHead}>{hero.label}</Text>
          <Text style={s.heroTitle}>{MODE_TITLE[hero.m]}</Text>
          <Text style={s.heroDesc}>{HELP[hero.m].desc}</Text>
        </View>
        <View style={s.heroGo}>
          <Icon name="play" color={C.yuru} size={26} />
        </View>
      </Tap></View>

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

/** 準備画面の見出し */
function StepHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <Text style={s.stepTitle}>{title}</Text>
      {!!sub && <Text style={s.stepSub}>{sub}</Text>}
    </View>
  );
}

// 遊び方の一覧（タブで分ける）。cat: basic=定番 / phone=スマホで勝負 / talk=話す・ノリ / brain=頭を使う / deep=深夜。min=最低人数、ok=下ネタOKの人の最低人数、t=目安時間
type Cat = 'basic' | 'phone' | 'talk' | 'brain' | 'deep';
const MODE_LIST: { m: Mode; ic: IconName; cat: Cat; t: string; min?: number; ok?: number }[] = [
  { m: 'odai', ic: 'cards', cat: 'basic', t: '好きなだけ' },
  { m: 'king', ic: 'king', cat: 'basic', t: '1回 2分', min: 3 },
  { m: 'sugoroku', ic: 'dice', cat: 'basic', t: '15〜30分' },
  { m: 'memory', ic: 'grid', cat: 'basic', t: '10分' },
  { m: 'tilt', ic: 'tilt', cat: 'phone', t: '1人 30秒' },
  { m: 'shake', ic: 'shake', cat: 'phone', t: '1人 15秒' },
  { m: 'stop', ic: 'stop', cat: 'phone', t: '1人 20秒' },
  { m: 'reflex', ic: 'reflex', cat: 'phone', t: '1回 3分' },
  { m: 'voice', ic: 'voice', cat: 'phone', t: '1回 3分' },
  { m: 'rtap', ic: 'rtap', cat: 'phone', t: '1回 2分' },
  { m: 'yama', ic: 'yama', cat: 'basic', t: '1回 2分', min: 3 },
  { m: 'nyok', ic: 'nyok', cat: 'basic', t: '1回 1分', min: 3 },
  { m: 'bpass', ic: 'bpass', cat: 'phone', t: '1回 2分' },
  { m: 'deko', ic: 'deko', cat: 'phone', t: '1人 60秒' },
  { m: 'whack', ic: 'whack', cat: 'phone', t: '1人 15秒' },
  { m: 'ngword', ic: 'mute', cat: 'talk', t: '10分〜' },
  { m: 'doubt', ic: 'doubt', cat: 'talk', t: '1人 2分', min: 3 },
  { m: 'homeru', ic: 'heart', cat: 'talk', t: '1回 2分' },
  { m: 'gesture', ic: 'hand', cat: 'talk', t: '1人 60秒', min: 3 },
  { m: 'face', ic: 'face', cat: 'talk', t: '1回 5分', min: 3 },
  { m: 'draw', ic: 'draw', cat: 'talk', t: '1回 5分', min: 3 },
  { m: 'wolf', ic: 'wolf', cat: 'talk', t: '1回 5分', min: 3 },
  { m: 'quiz', ic: 'quiz', cat: 'brain', t: '1回 5分' },
  { m: 'ito', ic: 'num', cat: 'brain', t: '1回 3分' },
  { m: 'hilo', ic: 'hilo', cat: 'brain', t: '1回 2分' },
  { m: 'pittari', ic: 'target', cat: 'brain', t: '1回 3分', min: 3 },
  { m: 'vote', ic: 'vote', cat: 'brain', t: '1回 2分', min: 3 },
  { m: 'blind', ic: 'blind', cat: 'deep', t: '1回 1分', ok: 3 },
  { m: 'pocky', ic: 'pocky', cat: 'deep', t: '1回 1分', ok: 2 },
  { m: 'tickle', ic: 'tickle', cat: 'deep', t: '1回 30秒', ok: 2 },
  { m: 'hug', ic: 'hug', cat: 'deep', t: '1回 30秒', ok: 2 },
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
  const { noTouch } = usePrefs();
  // 「体に触るのなし」の時は深夜の触る遊びを出さへん
  const deep = night === 'shinya' && !noTouch;
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
          const n = k === 'fav' ? favs.length : k === 'all' ? list.length : list.filter((x) => x.cat === k).length;
          return (
            <Tap key={k} onPress={() => { setTab(k); save('nd_tab', k); }} accessibilityState={{ selected: on }} style={[s.tab, isDeep && { borderWidth: 1.5, borderColor: C.deep }, on && { backgroundColor: isDeep ? C.deep : C.yuru }]}>
              <Text style={[s.tabText, isDeep && { color: C.deep }, on && { color: isDeep ? '#fff' : C.ink }]}>
                {t}
                <Text style={s.tabCount}>{` ${n}`}</Text>
              </Text>
            </Tap>
          );
        })}
      </ScrollView>
      <View style={{ gap: 8 }}>
        {shown.map((x) => {
          const why = x.min && members.length < x.min ? `${x.min}人から遊べる` : x.ok && okN < x.ok ? `下ネタOKの人が${x.ok}人から` : '';
          return (
            <RowStart key={x.m}>{(ref) => (
              <Tap onPress={() => go(ref, CAT_COLOR[x.cat], 14, () => onStart(x.m))} disabled={!!why} style={({ pressed }) => [s.rowItem, { opacity: why ? 0.45 : 1, transform: [{ translateY: pressed ? 2 : 0 }] }]}>
                <View style={[s.rowIc, { backgroundColor: CAT_COLOR[x.cat] }]}>
                  <Icon name={x.ic} color={x.cat === 'deep' ? '#fff' : C.ink} size={22} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>{MODE_TITLE[x.m]}</Text>
                  <Text style={s.rowDesc} numberOfLines={1}>{why || HELP[x.m].desc}</Text>
                </View>
                <View style={s.rowMetaBox}>
                  <Text style={s.rowBadge}>{x.t}</Text>
                  <Text style={s.rowMeta}>{x.ok ? `OK${x.ok}人〜` : `${x.min ?? 2}人〜`}</Text>
                </View>
              </Tap>
            )}</RowStart>
          );
        })}
      </View>
    </View>
  );
}

/** 遊び方の種類ごとのアイコンの色（定番=黄・スマホ=水色・話す=ピンク・頭=緑・深夜=濃いピンク） */
const CAT_COLOR: Record<Cat, string> = { basic: C.paper, phone: '#4dd4ff', talk: C.futsu, brain: '#7cf06b', deep: C.deep };

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
      <Text style={[s.h2, { color: C.night, marginTop: 24 }]}>20歳以上だけ</Text>
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

/** 押した行の位置を測って、そこから札が広がる（33） */
function go(ref: React.RefObject<View | null>, bg: string, _r: number, run: () => void) {
  const v = ref.current;
  if (!v) { run(); return; }
  v.measureInWindow((x, y, width, height) => {
    if (width > 0) expandFrom({ x, y, width, height }, bg);
    run();
  });
}
function RowStart({ children }: { children: (ref: React.RefObject<View | null>) => React.ReactNode }) {
  const ref = useRef<View>(null);
  return <View ref={ref} collapsable={false}>{children(ref)}</View>;
}

const s = StyleSheet.create({
  tabCount: { fontSize: 12, opacity: 0.6 },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(247,243,234,0.06)' },
  rowIc: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: C.paper, fontSize: 16, fontWeight: '900' },
  rowDesc: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  rowMetaBox: { alignItems: 'flex-end', gap: 4 },
  rowBadge: { color: C.paper, fontSize: 12, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(247,243,234,0.14)', overflow: 'hidden' },
  rowMeta: { color: C.muted, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  memPill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: 14, backgroundColor: 'rgba(247,243,234,0.08)' },
  memPillText: { color: C.paper, fontWeight: '900', fontSize: 14, marginLeft: 4 },
  memPillSub: { color: C.muted, fontWeight: '700', fontSize: 12, marginLeft: 'auto' },
  lastNote: { color: '#141210', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: 'rgba(247,243,234,0.08)' },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segText: { color: C.muted, fontWeight: '900', fontSize: 15 },
  lvNote: { color: C.muted, fontWeight: '700', fontSize: 12, opacity: 0.75, marginBottom: -4 },
  segSub: { color: C.muted, fontWeight: '700', fontSize: 12, opacity: 0.8 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, backgroundColor: C.yuru, shadowColor: '#b8901a', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  heroHead: { color: C.ink, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: C.ink, fontFamily: F.display, fontSize: 28, lineHeight: 34 },
  heroDesc: { color: C.ink, fontSize: 13, fontWeight: '700' },
  heroGo: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  heroGoText: { color: C.yuru, fontSize: 22 },
  lastGroup: { gap: 8, padding: 16, borderRadius: 20, backgroundColor: C.paper, shadowColor: '#a89f8c', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  lastHead: { color: C.ink, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  lastRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lastDot: { borderRadius: 17, borderWidth: 2, borderColor: C.ink },
  lastNames: { flex: 1, color: C.ink, fontWeight: '900', fontSize: 16, marginLeft: 6 },
  lastGoRow: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 4 },
  lastGo: { color: C.ink, fontFamily: F.display, fontSize: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: 'rgba(247,243,234,0.08)', borderWidth: 1.5, borderColor: 'transparent' },
  chipName: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5, paddingLeft: 5, paddingRight: 2 },
  chipText: { color: C.paper, fontWeight: '900', fontSize: 16, maxWidth: 160 },
  chipSub: { color: C.muted, fontWeight: '900', fontSize: 12 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingLeft: 14, borderRadius: 14, borderWidth: 1.5 },
  tab: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(247,243,234,0.08)' },
  tabText: { color: C.muted, fontWeight: '900', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  card2: { width: '48.5%', minHeight: 120, padding: 12, borderRadius: 16, backgroundColor: C.paper, gap: 4, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 0, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modeIc2: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,18,16,0.08)' },
  time: { fontSize: 12, fontWeight: '900', color: '#8d857a', backgroundColor: 'rgba(20,18,16,0.06)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  cardTitle: { fontSize: 17, fontWeight: '900', color: C.ink },
  cardDesc: { fontSize: 12, lineHeight: 16, color: '#5d564c' },
  guide: { gap: 6, padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,210,63,0.1)', borderWidth: 1, borderColor: 'rgba(255,210,63,0.4)' },
  guideHead: { color: C.yuru, fontWeight: '900', fontSize: 14 },
  guideText: { color: C.paper, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  guideBtn: { alignSelf: 'flex-end', borderRadius: 999, backgroundColor: C.yuru, paddingVertical: 8, paddingHorizontal: 14 },
  guideBtnText: { color: C.ink, fontSize: 12, fontWeight: '900' },
  wrap: { padding: 16, paddingBottom: 40, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  logo: { fontFamily: F.display, fontSize: 60, lineHeight: 68 },
  todSub: { fontWeight: '900', fontSize: 12, letterSpacing: 2 },
  catch: { color: C.muted, fontWeight: '900', fontSize: 13, letterSpacing: 1, marginTop: 4 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(247,243,234,0.08)', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: C.paper, fontSize: 22, fontWeight: '900' },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  stepBar: { width: 22, height: 4, borderRadius: 2, backgroundColor: 'rgba(247,243,234,0.16)' },
  stepOn: { backgroundColor: C.yuru },
  stepLabel: { color: C.muted, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  h2: { color: C.muted, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  stepNum: { color: C.yuru, fontSize: 18, fontWeight: '900' },
  stepTitle: { color: C.paper, fontSize: 18, fontWeight: '900' },
  stepSub: { color: C.muted, fontSize: 12, fontWeight: '700' },
  modeIc: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(20,18,16,0.08)', alignItems: 'center', justifyContent: 'center' },
  mem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingRight: 6, borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 12 },
  dot: { alignItems: 'center', justifyContent: 'center' },
  dotText: { color: C.ink, fontWeight: '900' },
  memName: { color: C.paper, fontSize: 17, fontWeight: '700' },
  x: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  xText: { color: C.muted, fontSize: 20 },
  ng: { borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  sex: { flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 999, overflow: 'hidden' },
  sexBtn: { width: 44, height: 34, alignItems: 'center', justifyContent: 'center' },
  sexSep: { borderLeftWidth: 1, borderLeftColor: 'rgba(247,243,234,0.16)' },
  sexText: { color: C.muted, fontSize: 12, fontWeight: '900' },
  ngOn: { backgroundColor: C.night, borderColor: C.night },
  ngText: { color: C.muted, fontSize: 12, fontWeight: '900' },
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
  lvSub: { fontSize: 12, fontWeight: '700', opacity: 0.75, marginTop: 2 },
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
  nightLvSub: { color: C.paper, fontSize: 12, fontWeight: '700' },
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
