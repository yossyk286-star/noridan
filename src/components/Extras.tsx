import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Switch, isCalm } from './Motion';
import { Tap } from './Tap';
import { Icon } from './Icon';
import { C, F, colorOf } from '../theme';
import { TEAM, minsLeft, shiftTime, teamScore, type Tally } from '../lib/extras';
import { play } from '../lib/sound';
import { Haptics } from '../lib/vibe';
import qr from '../data/qr.json';
import type { Member } from '../types';

/** ===== 第3弾の画面部品（Web版の extras.js と同じ中身） ===== */

const shuffle = <T,>(a: T[]) => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.back} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            <View style={s.grip} />
            <Text style={s.title}>{title}</Text>
            {children}
            <Tap style={s.ghost} onPress={onClose}>
              <Text style={s.ghostText}>閉じる</Text>
            </Tap>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Chip({ members, i }: { members: Member[]; i: number }) {
  return (
    <View style={s.chip}>
      <View style={[s.chipDot, { backgroundColor: colorOf(i) }]}>
        <Text style={s.chipIni}>{members[i].name.slice(0, 1)}</Text>
      </View>
      <Text style={s.chipName} numberOfLines={1}>{members[i].name}</Text>
    </View>
  );
}

// ---------- 14 チーム戦 ----------
export function TeamPick({ members, on, teams, onToggle, onShuffle }: { members: Member[]; on: boolean; teams: number[]; onToggle: () => void; onShuffle: () => void }) {
  if (members.length < 4) return null;
  return (
    <View style={{ gap: 8 }}>
      <Tap style={s.toggle} onPress={onToggle} accessibilityRole="switch" accessibilityState={{ checked: on }}>
        <View style={{ flex: 1 }}>
          <Text style={s.toggleText}>チーム戦</Text>
          <Text style={s.toggleSub}>赤と青に分かれて、チームの罰の合計で勝負</Text>
        </View>
        <Switch on={on} />
      </Tap>
      {on && (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[0, 1].map((t) => (
              <View key={t} style={[s.teamCol, { borderColor: TEAM[t].color, backgroundColor: TEAM[t].color + '24' }]}>
                <Text style={[s.teamHead, { color: TEAM[t].color }]}>{TEAM[t].name}チーム</Text>
                <Text style={s.teamNames}>{members.filter((_, i) => teams[i] === t).map((m) => m.name).join('　')}</Text>
              </View>
            ))}
          </View>
          <Tap onPress={onShuffle} style={{ alignSelf: 'flex-end', padding: 4 }}>
            <Text style={s.link}>チームを組み直す</Text>
          </Tap>
        </>
      )}
    </View>
  );
}

export function TeamResult({ members, teams, pen, batsu }: { members: Member[]; teams: number[]; pen: number[]; batsu: string }) {
  const sc = teamScore(teams, pen);
  const uneven = sc[0].who.length !== sc[1].who.length;
  const v = (x: (typeof sc)[number]) => (uneven ? Math.round(x.avg * 10) / 10 : x.sum);
  const lose = v(sc[0]) === v(sc[1]) ? -1 : v(sc[0]) > v(sc[1]) ? 0 : 1;
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.h2}>{`チーム戦${uneven ? '（人数が違うので1人あたり）' : ''}`}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {sc.map((x, k) => (
          <View key={x.t} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {k === 1 && <Text style={s.vs}>VS</Text>}
            <View style={[s.tv, { borderColor: TEAM[x.t].color }, lose === x.t && { backgroundColor: TEAM[x.t].color + '38' }]}>
              <Text style={[s.tvHead, { color: TEAM[x.t].color }]}>{TEAM[x.t].name}チーム</Text>
              <Text style={s.tvNum}>{v(x)}</Text>
              <Text style={s.tvNames} numberOfLines={2}>{x.who.map((i) => members[i].name).join('・')}</Text>
              <Text style={[s.tvRes, lose === x.t && { backgroundColor: '#e8202a', color: '#fff' }]}>{lose < 0 ? '引き分け' : lose === x.t ? '負け' : '勝ち'}</Text>
            </View>
          </View>
        ))}
      </View>
      {lose >= 0 && (
        <View style={s.teamBatsu}>
          <Text style={s.teamBatsuHead}>{`${TEAM[lose].name}チームの罰`}</Text>
          <Text style={s.teamBatsuText}>{batsu}</Text>
        </View>
      )}
    </View>
  );
}

// ---------- 12 途中参加・先に帰る ----------
export function InoutSheet({ visible, members, pen, left, onJoin, onLeave, onClose }: { visible: boolean; members: Member[]; pen: number[]; left: { name: string; pen: number }[]; onJoin: (name: string) => string; onLeave: (i: number) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const avg = pen.length ? Math.round(pen.reduce((a, b) => a + b, 0) / pen.length) : 0;
  const add = () => {
    const n = name.trim().slice(0, 10);
    if (!n) return;
    const err = onJoin(n);
    setMsg(err);
    if (!err) setName('');
  };
  return (
    <Sheet visible={visible} title="メンバーの出入り" onClose={onClose}>
      <Text style={s.note}>{`罰の数はそのまま引き継ぐ。今来た人は、今おる人の平均（${avg}）から`}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput value={name} onChangeText={setName} onSubmitEditing={add} placeholder="今来た人の名前" placeholderTextColor={C.muted} maxLength={10} returnKeyType="done" style={s.input} />
        <Tap style={s.addBtn} onPress={add} accessibilityLabel="追加">
          <Icon name="plus" color={C.ink} />
        </Tap>
      </View>
      {!!msg && <Text style={s.err}>{msg}</Text>}
      {members.map((m, i) => (
        <View key={m.name} style={[s.inRow, { borderLeftColor: colorOf(i) }]}>
          <Text style={s.inName} numberOfLines={1}>{m.name}<Text style={s.inPen}>{`  罰${pen[i] ?? 0}`}</Text></Text>
          <Tap style={[s.smBtn, members.length <= 2 && { opacity: 0.35 }]} disabled={members.length <= 2} onPress={() => onLeave(i)}>
            <Text style={s.smText}>先に帰る</Text>
          </Tap>
        </View>
      ))}
      {left.length > 0 && <Text style={s.note}>{`先に帰った人：${left.map((x) => `${x.name}（罰${x.pen}）`).join('・')}`}</Text>}
    </Sheet>
  );
}

export function LeftResult({ left }: { left: { name: string; pen: number }[] }) {
  if (!left.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.h2}>先に帰った人</Text>
      {left.map((x) => (
        <View key={x.name} style={[s.inRow, { borderLeftColor: C.muted }]}>
          <Text style={s.inName}>{x.name}</Text>
          <Text style={s.tallyN}>{`罰${x.pen}・途中退場`}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------- 16 帰る時間 ----------
export function GoHome({ time, onChange }: { time: string | null; onChange: (t: string | null) => void }) {
  const left = minsLeft(time);
  return (
    <View style={[s.tool, !!time && { borderColor: '#4dd4ff' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="gohome" color="#4dd4ff" size={18} /><Text style={s.toolHead}>帰る時間</Text></View>
      {time ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Tap style={s.step} onPress={() => onChange(shiftTime(time, -10))} accessibilityLabel="10分早く"><Text style={s.stepText}>−</Text></Tap>
            <Text style={s.time}>{time}</Text>
            <Tap style={s.step} onPress={() => onChange(shiftTime(time, 10))} accessibilityLabel="10分遅く"><Text style={s.stepText}>＋</Text></Tap>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.toolSub}>{left != null && left > 0 ? `あと${Math.floor(left / 60) ? `${Math.floor(left / 60)}時間` : ''}${left % 60}分` : 'もう時間やで'}</Text>
            <Tap onPress={() => onChange(null)}><Text style={s.link}>消す</Text></Tap>
          </View>
        </>
      ) : (
        <Tap onPress={() => onChange('23:30')}>
          <Text style={s.toolSub}>入れとくと30分前と10分前に知らせる</Text>
          <Text style={[s.link, { marginTop: 4 }]}>時間を入れる ›</Text>
        </Tap>
      )}
    </View>
  );
}

// ---------- お知らせ ----------
export function Toast({ text, kind, onHide }: { text: string; kind: string; onHide: () => void }) {
  const y = useRef(new Animated.Value(-160)).current;
  useEffect(() => {
    if (!text) return;
    Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
    const t = setTimeout(() => Animated.timing(y, { toValue: -160, duration: 250, useNativeDriver: true }).start(onHide), kind ? 12000 : 3500);
    return () => clearTimeout(t);
  }, [text]);
  if (!text) return null;
  return (
    <Animated.View style={[s.toastWrap, { transform: [{ translateY: y }] }]} pointerEvents="box-none">
      <Tap onPress={onHide} style={[s.toast, kind === 'train' && { backgroundColor: '#4dd4ff' }, kind === 'water' && { backgroundColor: '#7cf06b' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {kind === 'train' && <Icon name="gohome" color={C.ink} size={22} />}
          {kind === 'water' && <Icon name="drop" color={C.ink} size={22} />}
          <Text style={[s.toastText, { flexShrink: 1 }]}>{text}</Text>
        </View>
      </Tap>
    </Animated.View>
  );
}

// ---------- 17 幹事の道具 ----------
const ROLES = ['注文係', '会計係', '写真係', '乾杯の音頭', '二次会の店探し', 'タクシー呼ぶ係', 'お水を配る係', '盛り上げ係'];
const NEXT = ['カラオケ', 'ラーメン', 'もう1軒', '帰る'];
type KTab = 'seat' | 'role' | 'order' | 'next';
export function KanjiSheet({ visible, members, onClose }: { visible: boolean; members: Member[]; onClose: () => void }) {
  const [tab, setTab] = useState<KTab>('seat');
  const [shape, setShape] = useState<'face' | 'round'>('face');
  const mk = () => shuffle(members.map((_, i) => i));
  const [seat, setSeat] = useState(mk);
  const [roles, setRoles] = useState(mk);
  const [order, setOrder] = useState(mk);
  const [votes, setVotes] = useState(() => NEXT.map(() => 0));
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (visible) { setSeat(mk()); setRoles(mk()); setOrder(mk()); }
  }, [visible, members.length]);
  const voted = votes.reduce((a, b) => a + b, 0);
  const again = () => {
    play('pop');
    if (tab === 'seat') setSeat(mk());
    if (tab === 'role') setRoles(mk());
    if (tab === 'order') setOrder(mk());
  };
  const [box, setBox] = useState(300);
  let body: React.ReactNode = null;
  if (tab === 'seat') {
    const half = Math.ceil(seat.length / 2);
    body = (
      <>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['face', 'round'] as const).map((v) => (
            <Tap key={v} onPress={() => setShape(v)} style={[s.seg, shape === v && s.segOn]}>
              <Text style={[s.segText, shape === v && { color: C.ink }]}>{v === 'face' ? '向かい合わせ' : '丸テーブル'}</Text>
            </Tap>
          ))}
        </View>
        {shape === 'face' ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, gap: 8 }}>{seat.slice(0, half).map((i) => <Chip key={i} members={members} i={i} />)}</View>
            <View style={s.table} />
            <View style={{ flex: 1, gap: 8, alignItems: 'flex-end' }}>{seat.slice(half).map((i) => <Chip key={i} members={members} i={i} />)}</View>
          </View>
        ) : (
          <View style={{ width: '100%', aspectRatio: 1, maxWidth: 330, alignSelf: 'center' }} onLayout={(e) => setBox(e.nativeEvent.layout.width)}>
            <View style={[s.table, { position: 'absolute', left: box * 0.3, top: box * 0.3, width: box * 0.4, height: box * 0.4, borderRadius: box }]} />
            {seat.map((i, j) => {
              const a = (j / seat.length) * 2 * Math.PI - Math.PI / 2;
              return (
                <View key={i} style={{ position: 'absolute', left: box / 2 + box * 0.4 * Math.cos(a) - 45, top: box / 2 + box * 0.4 * Math.sin(a) - 18, width: 90, alignItems: 'center' }}>
                  <Chip members={members} i={i} />
                </View>
              );
            })}
          </View>
        )}
        <Text style={s.note}>{shape === 'face' ? '左の列と右の列で向かい合わせ。上から順に座る' : '時計回りに座る'}</Text>
      </>
    );
  } else if (tab === 'role' || tab === 'order') {
    const list = tab === 'role' ? roles.slice(0, Math.min(members.length, ROLES.length)) : order;
    body = list.map((i, j) => (
      <View key={i} style={s.kRow}>
        <Text style={s.kLabel}>{tab === 'role' ? ROLES[j] : `${j + 1}番`}</Text>
        <Chip members={members} i={i} />
      </View>
    ));
  } else {
    const max = Math.max(...votes);
    body = show ? (
      NEXT.map((t, j) => (
        <View key={t} style={[s.kRow, votes[j] === max && max > 0 && { backgroundColor: C.paper }]}>
          <Text style={[s.kLabel, votes[j] === max && max > 0 && { color: C.ink }]}>{`${votes[j]}票`}</Text>
          <Text style={[s.inName, votes[j] === max && max > 0 && { color: C.ink }]}>{t}</Text>
        </View>
      ))
    ) : (
      <>
        <Text style={s.note}>{`スマホを回して、1人ずつこっそり押す（${voted}/${members.length}人）`}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {NEXT.map((t, j) => (
            <Tap key={t} disabled={voted >= members.length} onPress={() => { play('tik'); setVotes((v) => v.map((x, k) => (k === j ? x + 1 : x))); }} style={[s.voteBtn, voted >= members.length && { opacity: 0.35 }]}>
              <Text style={s.ghostText}>{t}</Text>
            </Tap>
          ))}
        </View>
      </>
    );
  }
  const bigLabel = tab === 'next' ? (show ? 'もう1回投票' : '結果を見る') : tab === 'seat' ? 'もう1回シャッフル' : 'もう1回決める';
  const bigPress = tab === 'next' ? (show ? () => { setVotes(NEXT.map(() => 0)); setShow(false); } : () => { if (voted) { setShow(true); play('fanfare'); } }) : again;
  return (
    <Sheet visible={visible} title="幹事の道具" onClose={onClose}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {([['seat', '席替え'], ['role', '役割決め'], ['order', '順番決め'], ['next', '二次会']] as const).map(([v, t]) => (
          <Tap key={v} onPress={() => setTab(v)} style={[s.tab, tab === v && s.tabOn]}>
            <Text style={[s.tabText, tab === v && { color: C.ink }]}>{t}</Text>
          </Tap>
        ))}
      </ScrollView>
      {body}
      <Tap style={s.big} onPress={bigPress}>
        <Text style={s.bigText}>{bigLabel}</Text>
      </Tap>
    </Sheet>
  );
}

// ---------- 誰が罰か決める1画面ルーレット ----------
export function RouletteSheet({ visible, members, onClose }: { visible: boolean; members: Member[]; onClose: () => void }) {
  const n = members.length;
  const [cur, setCur] = useState(-1);
  const [phase, setPhase] = useState<'idle' | 'spin' | 'done'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!visible) { if (timer.current) clearTimeout(timer.current); setCur(-1); setPhase('idle'); }
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [visible]);
  const go = () => {
    if (phase === 'spin' || n < 1) return;
    setPhase('spin');
    const win = Math.floor(Math.random() * n);
    const start = cur < 0 ? 0 : cur;
    // 止まる場所から逆算して、だんだん遅くなる
    const steps = isCalm() ? 1 : 14 + ((win - start + n * 3) % n);
    let k = 0;
    let pos = start;
    const tick = () => {
      pos = (pos + 1) % n;
      k++;
      setCur(pos);
      play('tik');
      Haptics.selectionAsync().catch(() => {});
      if (k >= steps) { setCur(win); setPhase('done'); play('buzzer'); return; }
      timer.current = setTimeout(tick, 70 + k * k * 1.4);
    };
    tick();
  };
  return (
    <Sheet visible={visible} title="誰が罰か決める" onClose={onClose}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {members.map((m, i) => (
          <View key={i} style={[s.rlItem, i === cur && (phase === 'done' ? s.rlWin : s.rlOn)]}>
            <View style={[s.rlDot, { backgroundColor: colorOf(i) }]} />
            <Text style={[s.rlName, i === cur && { color: phase === 'done' ? '#fff' : C.ink }]} numberOfLines={1}>{m.name}</Text>
          </View>
        ))}
      </View>
      <Text style={s.rlMsg} accessibilityLiveRegion="polite">{phase === 'done' && cur >= 0 ? `${members[cur].name}が罰！` : phase === 'spin' ? 'どーれーにーしーよーうーかーな…' : 'ボタンを押したら回るで'}</Text>
      <Tap style={[s.big, phase === 'spin' && { opacity: 0.4 }]} disabled={phase === 'spin'} onPress={go}>
        <Text style={s.bigText}>{phase === 'done' ? 'もう1回' : '回す'}</Text>
      </Tap>
    </Sheet>
  );
}

// ---------- 18 隣の人にQR ----------
export function QrSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const n = qr.size + 4;
  return (
    <Sheet visible={visible} title="隣の人にもノリダン" onClose={onClose}>
      <Text style={s.note}>カメラで読むとWeb版がすぐ開く。アプリを入れんでも遊べる</Text>
      <View style={{ alignSelf: 'center', borderRadius: 14, overflow: 'hidden' }}>
        <Svg width={240} height={240} viewBox={`-2 -2 ${n} ${n}`}>
          <Rect x={-2} y={-2} width={n} height={n} fill="#fff" />
          <Path d={qr.path} fill="#141210" />
        </Svg>
      </View>
      <Text style={s.qrUrl}>{qr.url.replace('https://', '')}</Text>
    </Sheet>
  );
}

// ---------- 19 このメンバーの通算 ----------
export function tallyText(t: Tally | null, modeName: (m: string) => string) {
  if (!t?.last) return '';
  const who = t.last.names.length ? t.last.names.join('・') : 'なし（全員セーフ）';
  return `前回の戦犯：${who}（${modeName(t.last.mode)}）・このメンバーで${t.games}回`;
}
export function TallyResult({ members, tally }: { members: Member[]; tally: Tally | null }) {
  if (!tally || tally.games < 2) return null;
  const rows = members.map((m, i) => ({ m, i, n: tally.pen[m.name] ?? 0, l: tally.lucky[m.name] ?? 0 })).sort((a, b) => b.n - a.n);
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.h2}>{`このメンバーの通算（${tally.games}回）`}</Text>
      {rows.map((r) => (
        <View key={r.m.name} style={[s.inRow, { borderLeftColor: colorOf(r.i) }]}>
          <Text style={s.inName} numberOfLines={1}>{r.m.name}</Text>
          <Text style={s.tallyN}>{`罰${r.n}${r.l ? `・天使${r.l}` : ''}`}</Text>
        </View>
      ))}
    </View>
  );
}

export function ToolButton({ label, sub, onPress, icon = 'users' }: { label: string; sub: string; onPress: () => void; icon?: 'users' | 'target' }) {
  return (
    <Tap style={[s.tool, { flexDirection: 'row', alignItems: 'center', gap: 10 }]} onPress={onPress}>
      <Icon name={icon} color={C.paper} />
      <View style={{ flex: 1 }}>
        <Text style={s.toolHead}>{label}</Text>
        <Text style={s.toolSub}>{sub}</Text>
      </View>
    </Tap>
  );
}

const s = StyleSheet.create({
  rlItem: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(247,243,234,0.18)' },
  rlOn: { backgroundColor: C.paper, borderColor: C.paper },
  rlWin: { backgroundColor: C.blood, borderColor: C.blood },
  rlDot: { width: 14, height: 14, borderRadius: 7 },
  rlName: { flex: 1, color: C.paper, fontSize: 16, fontWeight: '900' },
  rlMsg: { color: C.paper, fontSize: 18, fontWeight: '900', textAlign: 'center', marginVertical: 14, minHeight: 28 },
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1d1a17', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 34, maxHeight: '90%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(247,243,234,0.25)', alignSelf: 'center' },
  title: { fontFamily: F.display, fontSize: 24, color: C.paper },
  note: { color: C.muted, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  err: { color: '#ff6b6b', fontSize: 13, fontWeight: '800' },
  ghost: { borderWidth: 2, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 14, padding: 14, alignItems: 'center' },
  ghostText: { color: C.paper, fontWeight: '900' },
  big: { backgroundColor: C.paper, borderRadius: 16, padding: 16, alignItems: 'center' },
  bigText: { fontFamily: F.display, fontSize: 18, color: C.ink },
  link: { color: C.futsu, fontSize: 12, fontWeight: '900' },
  h2: { color: C.muted, fontSize: 12, fontWeight: '900', marginTop: 18 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)' },
  toggleText: { color: C.paper, fontWeight: '900', fontSize: 15 },
  toggleSub: { color: C.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  state: { color: C.paper, fontWeight: '900', fontSize: 12, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(247,243,234,0.1)', overflow: 'hidden' },
  stateOn: { backgroundColor: C.yuru, color: C.ink },
  teamCol: { flex: 1, borderWidth: 2, borderRadius: 14, padding: 10, gap: 4 },
  teamHead: { fontSize: 13, fontWeight: '900' },
  teamNames: { color: C.paper, fontWeight: '900', fontSize: 14, lineHeight: 20 },
  vs: { color: C.muted, fontFamily: F.display, fontSize: 16 },
  tv: { flex: 1, borderWidth: 3, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  tvHead: { fontWeight: '900', fontSize: 13 },
  tvNum: { fontFamily: F.display, fontSize: 44, color: C.paper, lineHeight: 52 },
  tvNames: { color: C.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  tvRes: { color: C.paper, fontWeight: '900', paddingHorizontal: 12, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(247,243,234,0.1)', overflow: 'hidden', marginTop: 4 },
  teamBatsu: { padding: 12, borderRadius: 14, backgroundColor: '#1a0606', borderWidth: 2, borderColor: '#e8202a', gap: 2 },
  teamBatsuHead: { color: '#ff6b62', fontSize: 12, fontWeight: '900' },
  teamBatsuText: { color: C.paper, fontWeight: '900', fontSize: 15, lineHeight: 22 },
  input: { flex: 1, fontSize: 16, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', backgroundColor: 'rgba(247,243,234,0.06)', color: C.paper },
  addBtn: { width: 50, borderRadius: 12, backgroundColor: C.yuru, alignItems: 'center', justifyContent: 'center' },
  inRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8, paddingRight: 8, paddingLeft: 14, borderRadius: 12, backgroundColor: 'rgba(247,243,234,0.06)', borderLeftWidth: 6 },
  inName: { flex: 1, color: C.paper, fontWeight: '900', fontSize: 15 },
  inPen: { color: C.muted, fontSize: 12 },
  smBtn: { borderWidth: 2, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  smText: { color: C.paper, fontWeight: '900', fontSize: 13 },
  tallyN: { fontFamily: F.display, fontSize: 18, color: C.paper },
  tool: { padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(247,243,234,0.16)', gap: 6 },
  toolHead: { color: C.paper, fontWeight: '900', fontSize: 14 },
  toolSub: { color: C.muted, fontSize: 12, fontWeight: '700' },
  step: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(247,243,234,0.1)', alignItems: 'center', justifyContent: 'center' },
  stepText: { color: C.paper, fontSize: 20, fontWeight: '900' },
  time: { flex: 1, textAlign: 'center', fontFamily: F.display, fontSize: 24, color: C.paper },
  toastWrap: { position: 'absolute', top: 50, left: 12, right: 12, alignItems: 'center', zIndex: 100 },
  toast: { maxWidth: 520, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 16, backgroundColor: C.paper, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  toastText: { color: C.ink, fontWeight: '900', fontSize: 15, lineHeight: 22 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 4, paddingRight: 10, borderRadius: 999, backgroundColor: 'rgba(247,243,234,0.08)', maxWidth: '100%' },
  chipDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  chipIni: { color: C.ink, fontWeight: '900', fontSize: 12 },
  chipName: { color: C.paper, fontWeight: '900', fontSize: 14, flexShrink: 1 },
  table: { width: 44, borderRadius: 12, backgroundColor: '#5a3d27' },
  seg: { flex: 1, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(247,243,234,0.16)', alignItems: 'center' },
  segOn: { backgroundColor: C.yuru, borderColor: 'transparent' },
  segText: { color: C.muted, fontWeight: '900', fontSize: 13 },
  tab: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(247,243,234,0.08)' },
  tabOn: { backgroundColor: C.yuru },
  tabText: { color: C.muted, fontWeight: '900', fontSize: 13 },
  kRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(247,243,234,0.05)' },
  kLabel: { color: C.muted, fontWeight: '900', fontSize: 13 },
  voteBtn: { width: '48%', borderWidth: 2, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 14, padding: 14, alignItems: 'center' },
  qrUrl: { color: C.paper, fontWeight: '900', fontSize: 18, textAlign: 'center' },
});
