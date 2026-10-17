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
};
export type SoundName = keyof typeof FILES;

let enabled = true;
const players: Partial<Record<SoundName, AudioPlayer>> = {};
let ready = false;

function init() {
  if (ready) return;
  ready = true;
  // マナーモードでも鳴らす（飲み会のテーブルで使う前提）
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  (Object.keys(FILES) as SoundName[]).forEach((k) => {
    try {
      players[k] = createAudioPlayer(FILES[k]);
    } catch {}
  });
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

export function play(name: SoundName) {
  if (!enabled) return;
  try {
    init();
    const p = players[name];
    if (!p) return;
    p.seekTo(0);
    p.play();
  } catch {}
}
