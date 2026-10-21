import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/** 効果音（assets/sounds は scripts/make_sounds.py で生成） */
const FILES = {
  flip: require('../../assets/sounds/flip.wav'),
  tick: require('../../assets/sounds/tick.wav'),
  coin: require('../../assets/sounds/coin.wav'),
  pop: require('../../assets/sounds/pop.wav'),
  alarm: require('../../assets/sounds/alarm.wav'),
  boom: require('../../assets/sounds/boom.wav'),
  warn: require('../../assets/sounds/warn.wav'),
  fanfare: require('../../assets/sounds/fanfare.wav'),
  lucky: require('../../assets/sounds/lucky.wav'),
  gacha: require('../../assets/sounds/gacha.wav'),
  gachaLucky: require('../../assets/sounds/gachaLucky.wav'),
  drumroll: require('../../assets/sounds/drumroll.wav'),
  hurry: require('../../assets/sounds/hurry.wav'),
  jan1: require('../../assets/sounds/jan1.wav'),
  jan2: require('../../assets/sounds/jan2.wav'),
  jan3: require('../../assets/sounds/jan3.wav'),
  sad: require('../../assets/sounds/sad.wav'),
  chin: require('../../assets/sounds/chin.wav'),
  kira: require('../../assets/sounds/kira.wav'),
  clack: require('../../assets/sounds/clack.wav'),
  step: require('../../assets/sounds/step.wav'),
  land: require('../../assets/sounds/land.wav'),
  pinpon: require('../../assets/sounds/pinpon.wav'),
  buzzer: require('../../assets/sounds/buzzer.wav'),
  timeup: require('../../assets/sounds/timeup.wav'),
  tik: require('../../assets/sounds/tik.wav'),
  tok: require('../../assets/sounds/tok.wav'),
  heart: require('../../assets/sounds/heart.wav'),
  boo: require('../../assets/sounds/boo.wav'),
  laugh: require('../../assets/sounds/laugh.wav'),
  streak: require('../../assets/sounds/streak.wav'),
};
export type SoundName = keyof typeof FILES | 'jan'; // jan はお題が出る音（3種類からランダム）

let enabled = true;
let volume = 1;
const players: Partial<Record<keyof typeof FILES, AudioPlayer>> = {};
let ready = false;

function init() {
  if (ready) return;
  ready = true;
  // マナーモードでも鳴らす（飲み会のテーブルで使う前提）
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  (Object.keys(FILES) as (keyof typeof FILES)[]).forEach((k) => {
    try {
      players[k] = createAudioPlayer(FILES[k]);
      players[k]!.volume = volume;
    } catch {}
  });
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

/** 音量（設定の 小・中・大 = 1・2・3） */
export const VOL_LEVEL: Record<number, number> = { 1: 0.4, 2: 0.7, 3: 1 };
export function setVolume(level: number) {
  volume = VOL_LEVEL[level] ?? 1;
  (Object.values(players) as AudioPlayer[]).forEach((p) => {
    try {
      p.volume = volume;
    } catch {}
  });
}

export function play(name: SoundName) {
  if (!enabled) return;
  try {
    init();
    const key = name === 'jan' ? (['jan1', 'jan2', 'jan3'] as const)[Math.floor(Math.random() * 3)] : name;
    const p = players[key];
    if (!p) return;
    p.seekTo(0);
    p.play();
  } catch {}
}
