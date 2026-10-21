import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts, DelaGothicOne_400Regular } from '@expo-google-fonts/dela-gothic-one';

import HomeScreen from './src/screens/HomeScreen';
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
import BpassScreen from './src/screens/BpassScreen';
import HiloScreen from './src/screens/HiloScreen';
import ReflexScreen from './src/screens/ReflexScreen';
import VoiceScreen from './src/screens/VoiceScreen';
import { cleanMembers, load, save } from './src/lib/storage';
import { play, setSoundEnabled, setVolume } from './src/lib/sound';
import { setVibeEnabled, Vibration } from './src/lib/vibe';
import { cancelFx, quakeX, resetStreak } from './src/lib/fx';
import FxLayer from './src/components/FxLayer';
import { PrefsContext } from './src/lib/prefs';
import { speak, stopSpeak } from './src/lib/speech';
import type { Stats } from './src/lib/titles';
import SettingsSheet from './src/components/SettingsSheet';
import Tutorial from './src/components/Tutorial';
import { C, NEON_BG, STAGE } from './src/theme';
import type { Level, Member, Mode, Night } from './src/types';

/**
 * 遊び方ごとの画面。新しい遊び方はここに1行足すだけ（ホームのカードと説明は別）。
 * 画面ごとに使うpropsが少しずつ違う（onBgはお題・すごろくだけ、skipIntroは対応してる画面だけ）ので any で受ける
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STAGES: Record<Mode, ComponentType<any>> = {
  odai: OdaiScreen, sugoroku: SugorokuScreen, memory: MemoryScreen, ito: ItoScreen, gesture: GestureScreen, homeru: HomeruScreen,
  ngword: NgWordScreen, vote: VoteScreen, wolf: WolfScreen, pittari: PittariScreen, tilt: TiltScreen, shake: ShakeScreen, stop: StopScreen,
  rtap: RtapScreen, bpass: BpassScreen, hilo: HiloScreen, reflex: ReflexScreen, voice: VoiceScreen,
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
  const [members, setMembers] = useState<Member[]>(EXAMPLE);
  const [isExample, setIsExample] = useState(true);
  const [level, setLevel] = useState<Level>('futsu');
  const [night, setNight] = useState<Night>(false);
  const [sound, setSound] = useState(true);
  const [vol, setVol] = useState(3); // 音量 1=小 2=中 3=大
  const [vibe, setVibe] = useState(true);
  const [dual, setDual] = useState(false);
  const [voice, setVoice] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [sheet, setSheet] = useState(false);
  const [tut, setTut] = useState(false);
  const [groups, setGroups] = useState<Member[][]>([]);
  const [stageBg, setStageBg] = useState<string | null>(null);

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
      const sv = await load<boolean>('nd_sound', true);
      setSound(sv);
      setSoundEnabled(sv);
      const vl = await load<number>('nd_vol', 3);
      const v3 = [1, 2, 3].includes(vl) ? vl : 3;
      setVol(v3);
      setVolume(v3);
      const vb = await load<boolean>('nd_vibe', true);
      setVibe(vb);
      setVibeEnabled(vb);
      if (!(await load<boolean>('nd_tut', false))) setTut(true); // 初回だけ遊び方
      const gs = await load<unknown>('nd_groups', []);
      setGroups((Array.isArray(gs) ? gs : []).map(cleanMembers).filter((g): g is Member[] => !!g).slice(0, 3));
      setDual(await load<boolean>('nd_dual', false));
      setVoice(await load<boolean>('nd_voice', false));
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
  const start = (mode: Mode, again = false) => {
    if (screen.name === 'home') rememberGroup();
    resetStreak(); // 連続罰はゲームごとに数え直し
    cancelFx();
    setScreen({ name: mode, key: Date.now(), again });
  };
  const finish = (mode: Mode) => (pen: number[], turns: number, stats: Stats, words?: string[], scores?: number[]) => setScreen({ name: 'result', mode, pen, turns, stats: { ...stats }, words, scores });
  const home = () => {
    stopSpeak();
    setScreen({ name: 'home', step: 2 });
  };
  const tutDone = () => {
    setTut(false);
    save('nd_tut', true);
  };

  // 画面が変わったらスッとスライドして入ってくる（進む時は右から、戻る時は左から）
  const ORDER = (name: string) => (name === 'home' ? 0 : name === 'result' ? 3 : 2);
  const slide = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  const prev = useRef(screen.name);
  useEffect(() => {
    if (prev.current === screen.name && !isStage(screen.name)) return;
    dir.current = ORDER(screen.name) < ORDER(prev.current) ? -1 : 1;
    prev.current = screen.name;
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [screen]);

  const onStage = isStage(screen.name);
  const neonHome = screen.name === 'home' && !!night;
  const bg = onStage ? stageBg ?? STAGE[level].bg : neonHome ? NEON_BG : C.ink;
  useEffect(() => {
    if (!onStage) setStageBg(null);
  }, [onStage]);

  return (
    <PrefsContext.Provider value={{ dual, voice, setDual: updateDual }}>
    <SafeAreaProvider>
      <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
        <StatusBar style="light" />
        <Animated.View style={[s.root, { opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }), transform: [{ translateX: Animated.add(slide.interpolate({ inputRange: [0, 1], outputRange: [dir.current * 28, 0] }), quakeX) }] }]}>
          {screen.name === 'home' && (
            <HomeScreen
              members={members}
              isExample={isExample}
              level={level}
              night={night}
              initialStep={members.length >= 2 ? screen.step : 1}
              onMembers={updateMembers}
              onLevel={updateLevel}
              onNight={updateNight}
              onStart={start}
              onSettings={() => setSheet(true)}
              groups={groups}
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
            />
          )}
        </Animated.View>
        <FxLayer deep={night === 'shinya' && screen.name !== 'result'} />
        <SettingsSheet
          visible={sheet}
          sound={sound}
          vol={vol}
          vibe={vibe}
          onVol={updateVol}
          onVibe={updateVibe}
          dual={dual}
          voice={voice}
          night={night}
          onSound={updateSound}
          onDual={updateDual}
          onVoice={updateVoice}
          onNight={updateNight}
          onTutorial={() => {
            setSheet(false);
            setTut(true);
          }}
          onClose={() => setSheet(false)}
        />
        <Tutorial visible={tut} onDone={tutDone} />
      </SafeAreaView>
    </SafeAreaProvider>
    </PrefsContext.Provider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
});
