import * as Speech from 'expo-speech';
import type { Segment } from '../types';

/** お題の読み上げ（端末の日本語音声を使う） */
export function speak(text: string) {
  if (!text) return;
  try {
    Speech.stop();
    Speech.speak(text, { language: 'ja-JP', rate: 1.05, pitch: 1.1 });
  } catch {}
}
export function stopSpeak() {
  try {
    Speech.stop();
  } catch {}
}
export const plain = (segs: Segment[]) => segs.map((s) => s.text).join('');
