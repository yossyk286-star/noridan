import { ExpandLayer, shrinkBack } from './src/components/Motion';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Animated, BackHandler, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { Tap } from './src/components/Tap';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts, DelaGothicOne_400Regular } from '@expo-google-fonts/dela-gothic-one';

import HomeScreen, { countPlay } from './src/screens/HomeScreen';
import OdaiScreen from './src/screens/OdaiScreen';
import SugorokuScreen from './src/screens/SugorokuScreen';
import ResultScreen from './src/screens/ResultScreen';
import NgWordScreen from './src/screens/NgWordScreen';
import MemoryScreen from './src/screens/MemoryScreen';
import ItoScreen from './src/screens/ItoScreen';
import GestureScreen from './src/screens/GestureScreen';
import HomeruScreen from './src/screens/HomeruScreen';
import VoteScreen from './src/screens/VoteScreen';
import WolfScreen from './src/screens/WolfScreen';
import PittariScreen from './src/screens/PittariScreen';
import TiltScreen from './src/screens/TiltScreen';
import ShakeScreen from './src/screens/ShakeScreen';
import StopScreen from './src/screens/StopScreen';
import RtapScreen from './src/screens/RtapScreen';
import YamaScreen from './src/screens/YamaScreen';
import NyokScreen from './src/screens/NyokScreen';
import BpassScreen from './src/screens/BpassScreen';
import HiloScreen from './src/screens/HiloScreen';
import ReflexScreen from './src/screens/ReflexScreen';
import VoiceScreen from './src/screens/VoiceScreen';
import BlindScreen from './src/screens/BlindScreen';
import PockyScreen from './src/screens/PockyScreen';
import TickleScreen from './src/screens/TickleScreen';
import HugScreen from './src/screens/HugScreen';
import QuizScreen from './src/screens/QuizScreen';
import FaceScreen from './src/screens/FaceScreen';
import DekoScreen from './src/screens/DekoScreen';
import DoubtScreen from './src/screens/DoubtScreen';
import KingScreen from './src/screens/KingScreen';
import DrawScreen from './src/screens/DrawScreen';
import WhackScreen from './src/screens/WhackScreen';
import { cleanMembers, load, save } from './src/lib/storage';
import { play, setSoundEnabled, setVolume } from './src/lib/sound';
import { setVibeEnabled, Vibration } from './src/lib/vibe';
import { cancelFx, quakeX, resetStreak } from './src/lib/fx';
import FxLayer from './src/components/FxLayer';
import { Entrance, MeterGraph, MeterHost, Polaroids } from './src/components/Live';
import { liveNow, loadLive, setLiveLevel, useLive } from './src/lib/live';
import { PrefsContext } from './src/lib/prefs';
import { DATE, Decks, PASS, setContent } from './src/lib/game';
import { markFirstOpen, maybeAskReview } from './src/lib/review';
import { getTally, makeTeams, minsLeft, recordTally, setToastHandler, toast, type Tally } from './src/lib/extras';
import { InoutSheet, KanjiSheet, LeftResult, QrSheet, RouletteSheet, TallyResult, TeamCols, TeamResult, Toast, tallyText } from './src/components/Extras';
import { MODE_TITLE } from './src/components/ModeParts';
import { speak, stopSpeak } from './src/lib/speech';
import type { Stats } from './src/lib/titles';
import SettingsSheet from './src/components/SettingsSheet';
import { C, NEON_BG, STAGE } from './src/theme';
import type { Level, Member, Mode, Night } from './src/types';
import { MED_POOL, MODE_CAT, MODE_MIN } from './src/lib/medley';

/**
 * 遊び方ごとの画面。新しい遊び方はここに1行足すだけ（ホームのカードと説明は別）。
 * 画面ごとに使うpropsが少しずつ違う（onBgはお題・すごろくだけ、skipIntroは対応してる画面だけ）ので any で受ける
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STAGES: Record<Mode, ComponentType<any>> = {
  odai: OdaiScreen, sugoroku: SugorokuScreen, memory: MemoryScreen, ito: ItoScreen, gesture: GestureScreen, homeru: HomeruScreen,
  ngword: NgWordScreen, vote: VoteScreen, wolf: WolfScreen, pittari: PittariScreen, tilt: TiltScreen, shake: ShakeScreen, stop: StopScreen,
  rtap: RtapScreen, yama: YamaScreen, nyok: NyokScreen, bpass: BpassScreen, hilo: HiloScreen, reflex: ReflexScreen, voice: VoiceScreen, blind: BlindScreen, pocky: PockyScreen, tickle: TickleScreen, hug: HugScreen, quiz: QuizScreen, face: FaceScreen, deko: DekoScreen, doubt: DoubtScreen, king: KingScreen, draw: DrawScreen, whack: WhackScreen,
};
const isStage = (name: string): name is Mode => name in STAGES;

const EXAMPLE: Member[] = [
  { name: 'よし' },
  { name: 'たく' },
  { name: 'まゆ' },
];

type Screen = { name: 'home'; step?: 1 | 2 } | { name: Mode; key: number; again?: boolean } | { name: 'result'; mode: Mode; pen: number[]; turns: number; stats?: Stats; words?: string[]; scores?: number[] };

export default function App() {
  useFonts({ DelaGothicOne_400Regular }); // 読み込み前はシステムフォントで表示
  const [members, setMembers] = useState<Member[]>([]); // 最初は空。例の3人は「例で試す」を押した時だけ
  const [isExample, setIsExample] = useState(false);
  const [level, setLevel] = useState<Level>('futsu');
  const [night, setNight] = useState<Night>(false);
  const [sound, setSound] = useState(true);
  const [vol, setVol] = useState(3); // 音量 1=小 2=中 3=大
  const [vibe, setVibe] = useState(true);
  const [dual, setDual] = useState(false);
  const [voice, setVoice] = useState(false);
  const [handoff, setHandoff] = useState(true); // お題の前に「つぎは○○」をはさむ
  const [sober, setSober] = useState(false); // お酒なし
  const [noTouch, setNoTouch] = useState(false); // 体に触るのなし
  const [passOn, setPassOn] = useState(true); // パス券（1人1回）
  const [date, setDate] = useState(true); // デートモード（2人の時だけ）
  const [gamble, setGamble] = useState(true); // 駆け引きあり
  const [itCoop, setItCoop] = useState(false); // 価値観ナンバーの協力型
  const [medN, setMedN] = useState(5); // おまかせメドレーのゲーム数
  const [medley, setMedley] = useState<{ list: Mode[]; idx: number } | null>(null);
  const medKeep = useRef(false); // メドレーから始めた時だけメドレーを続ける
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [sheet, setSheet] = useState(false);
  const [nightAskReq, setNightAskReq] = useState(0);
  const [groups, setGroups] = useState<Member[][]>([]);
  const [stageBg, setStageBg] = useState<string | null>(null);
  // ===== 第3弾 =====
  const [team, setTeam] = useState(false); // チーム戦
  const [teams, setTeams] = useState<number[]>([]);
  const [goHome, setGoHome] = useState<string | null>(null); // 帰る時間 "23:40"
  const [water, setWater] = useState(true); // お水タイム
  const [left, setLeft] = useState<{ name: string; pen: number }[]>([]); // 先に帰った人
  const [carry, setCarry] = useState<Record<string, number> | null>(null); // メンバーの出入りで引き継ぐ罰
  const [inout, setInout] = useState(false);
  const [kanji, setKanji] = useState(false);
  const [roul, setRoul] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [tally, setTally] = useState<Tally | null>(null);
  const [teamBatsu, setTeamBatsu] = useState('');
  const [toastMsg, setToastMsg] = useState({ text: '', kind: '' });
  const livePen = useRef<number[]>([]);
  const since = useRef(0);
  const alerted = useRef<Record<string, boolean>>({});
  const teamDecks = useRef(new Decks()).current;
  const live = useLive();
  /** 選手入場（ゲームの最初だけ） */
  const entSeen = useRef('');
  const [entrance, setEntrance] = useState<{ mode: Mode; k: number } | null>(null);

  useEffect(() => {
    (async () => {
      const m = cleanMembers(await load<unknown>('nd_members', null));
      if (m) {
        setMembers(m);
        setIsExample(false);
      }
      const lv = await load<unknown>('nd_level', 'futsu');
      setLevel(lv === 'yurume' || lv === 'jigoku' ? lv : 'futsu');
      const nv = await load<unknown>('nd_night', false);
      setNight(nv === true ? 'yoru' : nv === 'yoru' || nv === 'shinya' ? nv : false);
      const sv = (await load<unknown>('nd_sound', true)) !== false;
      setSound(sv);
      setSoundEnabled(sv);
      const vl = await load<number>('nd_vol', 3);
      const v3 = [1, 2, 3].includes(vl) ? vl : 3;
      setVol(v3);
      setVolume(v3);
      const vb = (await load<unknown>('nd_vibe', true)) !== false;
      setVibe(vb);
      setVibeEnabled(vb);
      const gs = await load<unknown>('nd_groups', []);
      setGroups((Array.isArray(gs) ? gs : []).map(cleanMembers).filter((g): g is Member[] => !!g).slice(0, 3));
      setDual((await load<unknown>('nd_dual', false)) === true);
      setVoice((await load<unknown>('nd_voice', false)) === true);
      setHandoff((await load<unknown>('nd_handoff', true)) !== false);
      const so = (await load<unknown>('nd_sober', false)) === true;
      const nt = (await load<unknown>('nd_notouch', false)) === true;
      const po = (await load<unknown>('nd_pass', true)) !== false;
      setSober(so);
      setNoTouch(nt);
      setPassOn(po);
      setContent(so, nt);
      PASS.on = po;
      const dt = (await load<unknown>('nd_date', true)) !== false;
      setDate(dt);
      DATE.on = dt;
      setGamble((await load<unknown>('nd_gamble', true)) !== false);
      setItCoop((await load<unknown>('nd_itcoop', false)) === true);
      const mn = await load<number>('nd_medn', 5);
      setMedN([3, 5, 7].includes(mn) ? mn : 5);
      setTeam((await load<unknown>('nd_team', false)) === true);
      setWater((await load<unknown>('nd_water', true)) !== false);
      await loadLive();
      const gh = await load<{ t?: string; at?: number } | null>('nd_gohome', null);
      if (gh && typeof gh.t === 'string' && Date.now() - (gh.at ?? 0) < 12 * 3600e3) setGoHome(gh.t);
    })();
  }, []);

  const updateMembers = (m: Member[]) => {
    setMembers(m);
    setIsExample(false);
    save('nd_members', m);
  };
  const updateLevel = (l: Level) => {
    setLevel(l);
    save('nd_level', l);
  };
  const updateSound = (on: boolean) => {
    setSound(on);
    setSoundEnabled(on);
    save('nd_sound', on);
  };
  const updateVol = (v: number) => {
    setVol(v);
    setVolume(v);
    save('nd_vol', v);
    play('jan');
  };
  const updateVibe = (on: boolean) => {
    setVibe(on);
    setVibeEnabled(on);
    save('nd_vibe', on);
    if (on) Vibration.vibrate(40);
  };
  const updateDual = (on: boolean) => {
    setDual(on);
    save('nd_dual', on);
  };
  const updateVoice = (on: boolean) => {
    setVoice(on);
    save('nd_voice', on);
    if (on) speak('読み上げオン');
    else stopSpeak();
  };
  const updateHandoff = (on: boolean) => {
    setHandoff(on);
    save('nd_handoff', on);
  };
  const updateSober = (on: boolean) => {
    setSober(on);
    setContent(on, noTouch);
    save('nd_sober', on);
  };
  const updateNoTouch = (on: boolean) => {
    setNoTouch(on);
    setContent(sober, on);
    save('nd_notouch', on);
  };
  const updatePass = (on: boolean) => {
    setPassOn(on);
    PASS.on = on;
    save('nd_pass', on);
  };
  const updateDate = (on: boolean) => {
    setDate(on);
    DATE.on = on;
    save('nd_date', on);
  };
  const updateGamble = (on: boolean) => {
    setGamble(on);
    save('nd_gamble', on);
  };
  const updateItCoop = (on: boolean) => {
    setItCoop(on);
    save('nd_itcoop', on);
  };
  const updateMedN = (v: number) => {
    setMedN(v);
    save('nd_medn', v);
  };
  const updateNight = (n: Night) => {
    setNight(n);
    save('nd_night', n);
  };
  /** ゲームを始めた時のメンバーを「前回のメンバー」として3組まで覚えておく */
  const rememberGroup = () => {
    if (isExample) return;
    const key = members.map((m) => m.name).join();
    const next = [members.map((m) => ({ ...m })), ...groups.filter((g) => g.map((m) => m.name).join() !== key)].slice(0, 3);
    setGroups(next);
    save('nd_groups', next);
  };
  // チーム戦（4人以上）。メンバーが変わったら組み直す
  const teamOn = team && members.length >= 4;
  useEffect(() => {
    if (teamOn && teams.length !== members.length) setTeams(makeTeams(members.length));
  }, [teamOn, members]);
  const updateTeam = () => {
    const on = !teamOn;
    setTeam(on);
    save('nd_team', on);
    if (on) setTeams(makeTeams(members.length));
  };
  const updateWater = (on: boolean) => {
    setWater(on);
    save('nd_water', on);
  };
  const updateGoHome = (t: string | null) => {
    setGoHome(t);
    alerted.current = {};
    save('nd_gohome', t ? { t, at: Date.now() } : null);
  };
  // このメンバーの通算（前回の戦犯）
  useEffect(() => {
    if (!isExample) getTally(members).then(setTally);
  }, [members, isExample]);
  // お知らせ
  useEffect(() => {
    setToastHandler((text, kind = '') => setToastMsg({ text, kind }));
  }, []);
  const carryArr = members.map((m) => carry?.[m.name] ?? 0);

  // メンバーの出入り：今の罰を引き継いで、同じ遊び方をやり直す
  const totals = () => members.map((_, i) => (livePen.current[i] ?? 0) + carryArr[i]);
  const restart = (ms: Member[], c: Record<string, number>, msg: string) => {
    updateMembers(ms);
    setCarry(c);
    setInout(false);
    if (teamOn) setTeams(makeTeams(ms.length));
    if (isStage(screen.name)) {
      resetStreak();
      cancelFx();
      setScreen({ name: screen.name, key: Date.now(), again: true });
    }
    toast(msg);
  };
  const join = (name: string) => {
    if (members.length >= 12) return '12人までやで';
    if (members.some((m) => m.name === name)) return `「${name}」はもうおるで`;
    const t = totals();
    const c: Record<string, number> = {};
    members.forEach((m, i) => (c[m.name] = t[i]));
    const back = left.find((x) => x.name === name);
    c[name] = back ? back.pen : t.length ? Math.round(t.reduce((a, b) => a + b, 0) / t.length) : 0;
    setLeft(left.filter((x) => x.name !== name));
    restart([...members, { name }], c, `${name}が参加！罰${c[name]}からスタート`);
    return '';
  };
  const leave = (i: number) => {
    if (members.length <= 2) return;
    const t = totals();
    const c: Record<string, number> = {};
    members.forEach((m, j) => j !== i && (c[m.name] = t[j]));
    setLeft([...left, { name: members[i].name, pen: t[i] }]);
    restart(members.filter((_, j) => j !== i), c, `${members[i].name}は先に帰った。おつかれ！`);
  };

  // 終電アラートとお水タイム（ゲーム中だけ、20秒ごとに見る）
  const onStageNow = isStage(screen.name);
  useEffect(() => {
    if (!onStageNow) return;
    if (!since.current) since.current = Date.now();
    const check = () => {
      const l = minsLeft(goHome);
      if (l != null && goHome) {
        for (const k of [30, 10, 0]) {
          const key = `${goHome}:${k}`;
          if (l <= k && l > k - 10 && !alerted.current[key]) {
            alerted.current[key] = true;
            toast(k === 0 ? `${goHome}、帰る時間やで！忘れ物ないように` : `帰る時間（${goHome}）まであと${l}分`, 'train');
            play('alarm');
            return;
          }
        }
      }
      if (water) {
        const n = Math.floor((Date.now() - since.current) / (30 * 60e3));
        if (n > 0 && !alerted.current[`water${n}`]) {
          alerted.current[`water${n}`] = true;
          toast('お水タイム！全員お水かソフドリをひと口（罰ちゃうで）', 'water');
          play('chin');
        }
      }
    };
    check();
    const t = setInterval(check, 20000);
    return () => clearInterval(t);
  }, [onStageNow, goHome, water]);

  const start = (mode: Mode, again = false) => {
    if (screen.name === 'home') rememberGroup();
    const fromMed = medKeep.current;
    if (medKeep.current) medKeep.current = false;
    else setMedley(null); // 普通に始めた時はメドレーをやめる
    setCarry(null); // 普通に始めた時は引き継ぎなし
    setLeft([]);
    resetStreak(); // 連続罰はゲームごとに数え直し
    if (!again) countPlay(mode); // 「よく遊ぶ」タブ用
    cancelFx();
    PASS.used.clear(); // パス券はゲームごとに1人1枚
    setScreen({ name: mode, key: Date.now(), again });
    // 選手入場は、その日そのメンバーでの最初のゲームだけ（2ゲーム目から・メドレー中は出さへん）
    const entKey = new Date().toDateString() + '|' + members.map((m) => m.name).join(',');
    const showEnt = !again && !fromMed && entSeen.current !== entKey;
    if (showEnt) entSeen.current = entKey;
    setEntrance(showEnt && liveNow().entrance && members.length >= 2 ? { mode, k: Date.now() } : null);
  };
  /** おまかせメドレー：人数に合う長くないゲームを、種類が続かんように並べる */
  const startMedley = () => {
    const ok = MED_POOL.filter((m) => members.length >= (MODE_MIN[m] ?? 2));
    const pool = ok.slice().sort(() => Math.random() - 0.5);
    const list: Mode[] = [];
    while (list.length < medN && pool.length) {
      const k = Math.max(0, pool.findIndex((m) => !list.length || MODE_CAT[m] !== MODE_CAT[list[list.length - 1]]));
      list.push(pool.splice(k, 1)[0]);
    }
    if (list.length < 2) return;
    medKeep.current = true;
    setMedley({ list, idx: 0 });
    start(list[0]);
  };
  /** 次のゲームへ：今の罰を引き継ぐ */
  const medNext = () => {
    if (!medley || medley.idx >= medley.list.length - 1) return;
    const t = totals();
    const c: Record<string, number> = {};
    members.forEach((m, i) => (c[m.name] = t[i]));
    const idx = medley.idx + 1;
    medKeep.current = true;
    setMedley({ ...medley, idx });
    start(medley.list[idx]);
    setCarry(c); // start() が消すので、そのあとで引き継ぐ
  };
  const finish = (mode: Mode) => (pen0: number[], turns: number, stats: Stats, words?: string[], scores?: number[]) => {
    const pen = pen0.map((v, i) => v + carryArr[i]); // 出入りで引き継いだ罰も足す
    setScreen({ name: 'result', mode, pen, turns, stats: { ...stats }, words, scores });
    if (teamOn) {
      const b = teamDecks.groupBatsu(members);
      setTeamBatsu(b.lucky ? '天使が来た！今回はセーフ' : b.segments.map((x) => x.text).join(''));
    }
    if (!isExample) recordTally(members, pen, stats.lucky ?? [], mode).then(setTally);
    // 結果発表の演出が終わったころに、条件がそろってたら星のお願い
    setTimeout(maybeAskReview, 6000);
  };
  useEffect(() => {
    markFirstOpen();
  }, []);
  const home = () => {
    stopSpeak();
    setScreen({ name: 'home', step: 2 });
  };

  // Androidの「戻る」：遊び中は確認を出して、ゲームを守る（ホームでは今まで通り）
  const [backAsk, setBackAsk] = useState(false);
  const stageRef = useRef(false);
  stageRef.current = isStage(screen.name);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!stageRef.current) return false;
      setBackAsk(true);
      return true;
    });
    return () => h.remove();
  }, []);

  // 画面が変わったらスッとスライドして入ってくる（進む時は右から、戻る時は左から）
  const ORDER = (name: string) => (name === 'home' ? 0 : name === 'result' ? 3 : 2);
  const slide = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  const prev = useRef(screen.name);
  useEffect(() => {
    if (prev.current === screen.name && !isStage(screen.name)) return;
    dir.current = ORDER(screen.name) < ORDER(prev.current) ? -1 : 1;
    if (screen.name === 'home' && prev.current !== 'home' && prev.current !== 'result') shrinkBack();
    prev.current = screen.name;
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [screen]);

  const onStage = isStage(screen.name);
  setLiveLevel(level);
  const neonHome = screen.name === 'home' && !!night;
  const bg = onStage ? stageBg ?? STAGE[level].bg : neonHome ? NEON_BG : C.ink;
  useEffect(() => {
    if (!onStage) setStageBg(null);
  }, [onStage]);

  return (
    <PrefsContext.Provider value={{ date, setDate: updateDate, gamble, itCoop, setItCoop: updateItCoop, medley: medley ? { idx: medley.idx, total: medley.list.length, rest: medley.list.slice(medley.idx + 1).map((m) => MODE_TITLE[m]) } : undefined, onMedNext: medNext, dual, voice, handoff, noTouch, setDual: updateDual, teams: teamOn ? teams : undefined, carry: carry ? carryArr : undefined, livePen, onInout: () => setTimeout(() => setInout(true), 400) }}>
    <SafeAreaProvider>
      <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
        <StatusBar style="light" />
        <Animated.View style={[s.root, { opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }), transform: [{ translateX: Animated.add(slide.interpolate({ inputRange: [0, 1], outputRange: [dir.current * 28, 0] }), quakeX) }, { translateY: Animated.multiply(quakeX, -0.5) }] }]}>
          {screen.name === 'home' && (
            <HomeScreen
              members={members}
              isExample={isExample}
              level={level}
              night={night}
              initialStep={members.length >= 2 ? screen.step : 1}
              onMembers={updateMembers}
              onExample={() => { setMembers(EXAMPLE); setIsExample(true); }}
              onKanji={() => setKanji(true)}
              onRoulette={() => setRoul(true)}
              team={{ on: teamOn, onToggle: updateTeam }}
              onLevel={updateLevel}
              onNight={updateNight}
              onStart={start}
              medN={medN}
              onMedN={updateMedN}
              onMedley={startMedley}
              onSettings={() => setSheet(true)}
              groups={groups}
              nightAskReq={nightAskReq}
              lastNote={tallyText(tally, (m) => MODE_TITLE[m as Mode] ?? '')}
              tools={teamOn && members.length >= 4 ? <TeamCols members={members} teams={teams} onShuffle={() => setTeams(makeTeams(members.length))} /> : null}
            />
          )}
          {screen.name !== 'home' && screen.name !== 'result' && (() => {
            const Stage = STAGES[screen.name];
            return <Stage key={screen.key} members={members} level={level} night={night} onQuit={home} onSettings={() => setSheet(true)} onBg={setStageBg} onFinish={finish(screen.name)} skipIntro={screen.again} />;
          })()}
          {screen.name === 'result' && (
            <ResultScreen
              members={members}
              pen={screen.pen}
              turns={screen.turns}
              stats={screen.stats}
              night={night}
              mode={screen.mode}
              words={screen.words}
              scores={screen.scores}
              level={level}
              onHome={home}
              onMembers={() => { stopSpeak(); setScreen({ name: 'home', step: 1 }); }}
              onAgain={() => start(screen.mode, true)}
              onStart={medley ? undefined : (m) => start(m)}
              extraTop={
                <>
                  <Tap style={s.qrBtn} onPress={() => setQrOpen(true)}>
                    <Text style={s.qrText}>隣の人にもノリダン（QR）</Text>
                  </Tap>
                  {teamOn && teams.length === members.length && <TeamResult members={members} teams={teams} pen={screen.pen} batsu={teamBatsu} />}
                </>
              }
              extraBottom={
                <>
                  <Polaroids members={members} />
                  <MeterGraph />
                  <LeftResult left={left} />
                  <TallyResult members={members} tally={tally} />
                </>
              }
            />
          )}
        </Animated.View>
        <MeterHost active={live.meter && onStage} screen={screen.name} level={level} onLevel={updateLevel} />
        {entrance && onStage && <Entrance key={entrance.k} members={members} tally={tally} mode={entrance.mode} onDone={() => setEntrance(null)} />}
        <FxLayer deep={night === 'shinya' && screen.name !== 'result'} />
        <SettingsSheet
          visible={sheet}
          sound={sound}
          vol={vol}
          vibe={vibe}
          onVol={updateVol}
          onVibe={updateVibe}
          dual={dual}
          handoff={handoff}
          onHandoff={updateHandoff}
          sober={sober}
          onSober={updateSober}
          noTouch={noTouch}
          onNoTouch={updateNoTouch}
          passOn={passOn}
          onPass={updatePass}
          gamble={gamble}
          onGamble={updateGamble}
          goHome={goHome}
          onGoHome={updateGoHome}
          water={water}
          onWater={updateWater}
          voice={voice}
          night={night}
          onSound={updateSound}
          onDual={updateDual}
          onVoice={updateVoice}
          onNight={updateNight}
          onNightAsk={screen.name === 'home' ? () => { setSheet(false); setNightAskReq((n) => n + 1); } : undefined}
          onClose={() => setSheet(false)}
        />
        <InoutSheet visible={inout && onStageNow} members={members} pen={totals()} left={left} onJoin={join} onLeave={leave} onClose={() => setInout(false)} />
        <KanjiSheet visible={kanji} members={members} onClose={() => setKanji(false)} />
        <RouletteSheet visible={roul} members={members} onClose={() => setRoul(false)} />
        <QrSheet visible={qrOpen} onClose={() => setQrOpen(false)} />
        <Modal visible={backAsk && stageRef.current} transparent animationType="fade" onRequestClose={() => setBackAsk(false)}>
          <View style={s.askBack}>
            <View style={s.askBox}>
              <Text style={s.askTitle}>ゲームをやめる？</Text>
              <Text style={s.askSub}>罰の記録は消える</Text>
              <Tap style={s.askKeep} onPress={() => setBackAsk(false)}><Text style={s.askKeepText}>続ける</Text></Tap>
              <Tap style={s.askQuit} onPress={() => { setBackAsk(false); home(); }}><Text style={s.askQuitText}>やめてホームへ</Text></Tap>
            </View>
          </View>
        </Modal>
        <Toast text={toastMsg.text} kind={toastMsg.kind} onHide={() => setToastMsg({ text: '', kind: '' })} />
      </SafeAreaView>
      <ExpandLayer />
    </SafeAreaProvider>
    </PrefsContext.Provider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  qrBtn: { borderWidth: 2, borderColor: 'rgba(247,243,234,0.16)', borderRadius: 14, padding: 14, alignItems: 'center' },
  qrText: { color: '#f7f3ea', fontWeight: '900' },
  askBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  askBox: { width: '100%', maxWidth: 340, backgroundColor: '#211e1a', borderRadius: 20, padding: 20, gap: 10 },
  askTitle: { color: '#f7f3ea', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  askSub: { color: 'rgba(247,243,234,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 6 },
  askKeep: { backgroundColor: '#ffd23f', borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  askKeepText: { color: '#141210', fontSize: 17, fontWeight: '900' },
  askQuit: { borderWidth: 1.5, borderColor: 'rgba(247,243,234,0.3)', borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  askQuitText: { color: '#f7f3ea', fontSize: 15, fontWeight: '900' },
});
