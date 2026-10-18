import { useEffect, useRef, useState } from 'react';
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
import { load, save } from './src/lib/storage';
import { setSoundEnabled } from './src/lib/sound';
import { PrefsContext } from './src/lib/prefs';
import { speak, stopSpeak } from './src/lib/speech';
import type { Stats } from './src/lib/titles';
import SettingsSheet from './src/components/SettingsSheet';
import Tutorial from './src/components/Tutorial';
import { C, NEON_BG, STAGE } from './src/theme';
import type { Level, Member, Mode, Night } from './src/types';

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
        setMembers(m.map((x) => ({ name: x.name, ...(x.ng ? { ng: true } : {}) })));
        setIsExample(false);
      }
      setLevel(await load<Level>('nd_level', 'futsu'));
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
  const start = (mode: Mode, again = false) => {
    if (screen.name === 'home') rememberGroup();
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
  const ORDER: Record<string, number> = { home: 0, odai: 2, sugoroku: 2, memory: 2, ito: 2, gesture: 2, homeru: 2, ngword: 2, vote: 2, wolf: 2, pittari: 2, tilt: 2, result: 3 };
  const slide = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  const prev = useRef(screen.name);
  useEffect(() => {
    if (prev.current === screen.name && screen.name !== 'odai' && screen.name !== 'sugoroku' && screen.name !== 'memory' && screen.name !== 'ito' && screen.name !== 'gesture' && screen.name !== 'homeru' && screen.name !== 'ngword' && screen.name !== 'vote' && screen.name !== 'wolf' && screen.name !== 'pittari' && screen.name !== 'tilt') return;
    dir.current = ORDER[screen.name] < ORDER[prev.current] ? -1 : 1;
    prev.current = screen.name;
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [screen]);

  const onStage = screen.name === 'odai' || screen.name === 'sugoroku' || screen.name === 'memory' || screen.name === 'ito' || screen.name === 'gesture' || screen.name === 'homeru' || screen.name === 'ngword' || screen.name === 'vote' || screen.name === 'wolf' || screen.name === 'pittari' || screen.name === 'tilt';
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
            <OdaiScreen key={screen.key} members={members} level={level} night={night} onQuit={home} onSettings={() => setSheet(true)} onBg={setStageBg} onFinish={finish('odai')} skipIntro={screen.again} />
          )}
          {screen.name === 'sugoroku' && (
            <SugorokuScreen key={screen.key} members={members} level={level} night={night} onQuit={home} onSettings={() => setSheet(true)} onBg={setStageBg} onFinish={finish('sugoroku')} skipIntro={screen.again} />
          )}
          {screen.name === 'memory' && (
            <MemoryScreen key={screen.key} members={members} level={level} night={night} onQuit={home} onSettings={() => setSheet(true)} onFinish={finish('memory')} />
          )}
          {screen.name === 'ito' && (
            <ItoScreen key={screen.key} members={members} level={level} night={night} onQuit={home} onSettings={() => setSheet(true)} onFinish={finish('ito')} />
          )}
          {screen.name === 'gesture' && (
            <GestureScreen key={screen.key} members={members} level={level} night={night} onQuit={home} onSettings={() => setSheet(true)} onFinish={finish('gesture')} />
          )}
          {screen.name === 'homeru' && (
            <HomeruScreen key={screen.key} members={members} level={level} night={night} onQuit={home} onSettings={() => setSheet(true)} onFinish={finish('homeru')} />
          )}
          {screen.name === 'ngword' && (
            <NgWordScreen key={screen.key} members={members} level={level} night={night} onQuit={home} onSettings={() => setSheet(true)} onFinish={finish('ngword')} />
          )}
          {screen.name === 'vote' && (
            <VoteScreen key={screen.key} members={members} level={level} night={night} onQuit={home} onSettings={() => setSheet(true)} onFinish={finish('vote')} skipIntro={screen.again} />
          )}
          {screen.name === 'wolf' && (
            <WolfScreen key={screen.key} members={members} level={level} night={night} onQuit={home} onSettings={() => setSheet(true)} onFinish={finish('wolf')} />
          )}
          {screen.name === 'pittari' && (
            <PittariScreen key={screen.key} members={members} level={level} night={night} onQuit={home} onSettings={() => setSheet(true)} onFinish={finish('pittari')} skipIntro={screen.again} />
          )}
          {screen.name === 'tilt' && (
            <TiltScreen key={screen.key} members={members} level={level} night={night} onQuit={home} onSettings={() => setSheet(true)} onFinish={finish('tilt')} skipIntro={screen.again} />
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
              scores={screen.scores}
              level={level}
              onHome={home}
              onMembers={() => { stopSpeak(); setScreen({ name: 'home', step: 1 }); }}
              onAgain={() => start(screen.mode, true)}
            />
          )}
        </Animated.View>
        <SettingsSheet
          visible={sheet}
          sound={sound}
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
