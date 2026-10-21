import * as RealHaptics from 'expo-haptics';
import { Vibration as RealVibration } from 'react-native';

/** バイブ・触感（設定でOFFにできる）。各画面は react-native / expo-haptics の代わりにここから使う */
let enabled = true;
export function setVibeEnabled(on: boolean) {
  enabled = on;
}

export const Vibration = {
  vibrate: (pattern?: number | number[], repeat?: boolean) => {
    if (enabled) RealVibration.vibrate(pattern as number[], repeat);
  },
  cancel: () => RealVibration.cancel(),
};

const off = () => Promise.resolve();
export const Haptics = {
  ImpactFeedbackStyle: RealHaptics.ImpactFeedbackStyle,
  NotificationFeedbackType: RealHaptics.NotificationFeedbackType,
  impactAsync: (style?: Parameters<typeof RealHaptics.impactAsync>[0]) => (enabled ? RealHaptics.impactAsync(style) : off()),
  notificationAsync: (type?: Parameters<typeof RealHaptics.notificationAsync>[0]) => (enabled ? RealHaptics.notificationAsync(type) : off()),
  selectionAsync: () => (enabled ? RealHaptics.selectionAsync() : off()),
};
