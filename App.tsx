import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts, DelaGothicOne_400Regular } from '@expo-google-fonts/dela-gothic-one';

import HomeScreen from './src/screens/HomeScreen';
import OdaiScreen from './src/screens/OdaiScreen';
import SugorokuScreen from './src/screens/SugorokuScreen';
import ResultScreen from './src/screens/ResultScreen';
import NgWordScreen from './src/screens/NgWordScreen';
import VoteScreen from './src/screens/VoteScreen';
import { load, save } from './src/lib/storage';
import { requestMotionPermission } from './src/lib/useShake';
import { setSoundEnabled } from './src/lib/sound';
import { PrefsContext } from './src/lib/prefs';
import { speak, stopSpeak } from './src/lib/speech';
import type { Stats } from './src/lib/titles';
import SettingsSheet from './src/components/SettingsSheet';
import Tutorial from './src/components/Tutorial';
import { C, NEON_BG, STAGE } from './src/theme';
import type { Level, Member, Mode, Night } from './src/types';

const EXAMPLE: Member[] = [
  { name: 'よし', neta: 'すぐ寝る' },
  { name: 'たく', neta: '遅刻常習犯' },
  { name: 'まゆ', neta: '' },
];

type Screen = { name: 'home'; step?: 1 | 2 } | { name: Mode; key: number } | { name: 'result'; mode: Mode; pen: number[]; turns: number; stats?: Stats; words?: string[] };

export default function App() {
  useFonts({ DelaGothicOne_400Regular }); // 読み込み前はシステムフォントで表示
  const [members, setMembers] = useState<Member[]>(EXAMPLE);
  const [isExample, setIsExample] = useState(true);
  const [level, setLevel] = useState<Level>('futsu');
  const [shake, setShake] = useState(true);
  const [night, setNight] = useState<Night>(false);
  const [sound, setSound] = useState(true);
  const [dual, setDual] = useState(false);
  const [voice, setVoice] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [sheet, setSheet] = useState(false);
  const [tut, setTut] = useState(false);
  const [groups, setGroups] = useState<Member[][]>([]);
  const [stageBg, setStageBg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const m = await load<Member[] | null>('nd_members', null);
      if (m) {
        setMembers(m);
        setIsExample(false);
      }
      setLevel(await load<Level>('nd_level', 'futsu'));
      setShake(await load<boolean>('nd_shake', true));
      const nv = await load<Night | true>('nd_night', false);
      setNight(nv === true ? 'yoru' : nv);
      const sv = await load<boolean>('nd_sound', true);
      setSound(sv);
      setSoundEnabled(sv);
      if (!(await load<boolean>('nd_tut', false))) setTut(true); // 初回だけ遊び方
      setGroups(await load<Member[][]>('nd_groups', []));
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
  const updateShake = (on: boolean) => {
    setShake(on);
    save('nd_shake', on);
  };
  const updateSound = (on: boolean) => {
    setSound(on);
    setSoundEnabled(on);
    save('nd_sound', on);
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
  const start = (mode: Mode) => {
    if (shake) requestMotionPermission(); // iPhoneのブラウザはタップの中で許可を聞く
    if (screen.name === 'home') rememberGroup();
    setScreen({ name: mode, key: Date.now() });
  };
  const finish = (mode: Mode) => (pen: number[], turns: number, stats: Stats, words?: string[]) => setScreen({ name: 'result', mode, pen, turns, stats: { ...stats }, words });
  const home = () => {
    stopSpeak();
    setScreen({ name: 'home', step: 2 });
  };
  const tutDone = () => {
    setTut(false);
    save('nd_tut', true);
  };

  // 画面が変わったらスッとスライドして入ってくる（進む時は右から、戻る時は左から）
  const ORDER: Record<string, number> = { home: 0, odai: 2, sugoroku: 2, ngword: 2, vote: 2, result: 3 };
  const slide = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  const prev = useRef(screen.name);
  useEffect(() => {
    if (prev.current === screen.name && screen.name !== 'odai' && screen.name !== 'sugoroku' && screen.name !== 'ngword' && screen.name !== 'vote') return;
    dir.current = ORDER[screen.name] < ORDER[prev.current] ? -1 : 1;
    prev.current = screen.name;
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [screen]);

  const onStage = screen.name === 'odai' || screen.name === 'sugoroku' || screen.name === 'ngword' || screen.name === 'vote';
  const neonHome = screen.name === 'home' && !!night;
  const bg = onStage ? stageBg ?? STAGE[level].bg : neonHome ? NEON_BG : C.ink;
  useEffect(() => {
    if (!onStage) setStageBg(null);
  }, [onStage]);

  return (
    <PrefsContext.Provider value={{ dual, voice }}>
    <SafeAreaProvider>
      <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
        <StatusBar style="light" />
        <Animated.View style={[s.root, { opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }), transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [dir.current * 28, 0] }) }] }]}>
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
          {screen.name === 'odai' && (
            <OdaiScreen key={screen.key} members={members} level={level} shake={shake} night={night} onQuit={home} onSettings={() => setSheet(true)} onBg={setStageBg} onFinish={finish('odai')} />
          )}
          {screen.name === 'sugoroku' && (
            <SugorokuScreen key={screen.key} members={members} level={level} shake={shake} night={night} onQuit={home} onSettings={() => setSheet(true)} onBg={setStageBg} onFinish={finish('sugoroku')} />
          )}
          {screen.name === 'ngword' && (
            <NgWordScreen key={screen.key} members={members} level={level} night={night} onQuit={home} onSettings={() => setSheet(true)} onFinish={finish('ngword')} />
          )}
          {screen.name === 'vote' && (
            <VoteScreen key={screen.key} members={members} level={level} night={night} onQuit={home} onSettings={() => setSheet(true)} onFinish={finish('vote')} />
          )}
          {screen.name === 'result' && (
            <ResultScreen
              members={members}
              pen={screen.pen}
              turns={screen.turns}
              stats={screen.stats}
              night={night}
              mode={screen.mode}
              words={screen.words}
              level={level}
              onHome={home}
              onAgain={() => start(screen.mode)}
            />
          )}
        </Animated.View>
        <SettingsSheet
          visible={sheet}
          shake={shake}
          sound={sound}
          dual={dual}
          voice={voice}
          night={night}
          onShake={updateShake}
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
